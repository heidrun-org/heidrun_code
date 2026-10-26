//! The commands of the voice input: the options, the download of a model, and the recording of the microphone with its change
//! into text. The package `voice_input` does the work. This file holds the state of the application and talks with the web page.

use crate::app_data;
use crate::application_log;
use crate::voice_words::replace_spoken_words;
use serde::Serialize;
use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, State};
use voice_input::{
    download_model, find_model, list_models, model_path, ModelInfo, Recorder, Transcriber, VoiceError, DEFAULT_MODEL_ID, LANGUAGES,
    MODELS_BASE_URL,
};

/// The name of the event that tells the web page how far a download went.
const DOWNLOAD_PROGRESS_EVENT: &str = "voice-download-progress";

/// The name of the event that tells the web page the level of the voice, from 0 to 1, 20 times a second while the microphone records.
const LEVEL_EVENT: &str = "voice-input-level";

/// The shortest time between two progress events of a download.
const PROGRESS_INTERVAL: Duration = Duration::from_millis(100);

/// What the application keeps for the voice input.
#[derive(Default)]
pub struct VoiceState {
    /// The recording that runs, if any.
    recorder: Mutex<Option<Recorder>>,
    /// Whisper, with the last model in memory.
    transcriber: Arc<Transcriber>,
    /// The identifiers of the models that are downloading now. A model downloads once at a time.
    downloading: Mutex<HashSet<String>>,
}

/// What the web page learns before it shows the options of the voice input.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VoiceOptions {
    /// The 12 models with their state on the disk.
    models: Vec<ModelInfo>,
    /// The codes of the languages, without the automatic choice.
    languages: Vec<&'static str>,
    /// The model that Heidrun Code proposes first.
    default_model_id: &'static str,
}

/// The payload of the event that tells how far a download went.
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct DownloadProgressEvent {
    /// The model that downloads.
    model_id: String,
    /// The bytes written so far.
    received_bytes: u64,
    /// The size of the file.
    total_bytes: u64,
}

/// The folder of the model files: `models` in the folder of the data of Heidrun Code.
fn models_folder() -> PathBuf {
    app_data::data_dir().join("models")
}

/// The file where the logs of Whisper go: `logs/whisper.log` in the folder of the data of Heidrun Code.
fn whisper_log_path() -> PathBuf {
    app_data::data_dir().join("logs").join("whisper.log")
}

/// Sends the logs of Whisper to the file `whisper_log_path`, so that they never fill the terminal of the developer. A file that
/// cannot open is reported once in the terminal, and the logs are then dropped.
pub fn open_whisper_log() {
    if let Err(error) = voice_input::whisper_log::write_to_file(&whisper_log_path()) {
        eprintln!("voice input: the log file of Whisper cannot open: {error}");
    }
}

/// Changes an error into its category, and writes its details in the terminal of the developer.
fn report(error: VoiceError) -> String {
    eprintln!("voice input: {error}");
    error.category().to_string()
}

/// The options of the voice input.
#[tauri::command]
pub fn voice_options() -> VoiceOptions {
    VoiceOptions { models: list_models(&models_folder()), languages: LANGUAGES.to_vec(), default_model_id: DEFAULT_MODEL_ID }
}

/// Downloads a model into the folder `models`, and sends the event `voice-download-progress` while it downloads.
#[tauri::command]
pub async fn voice_download_model(app: AppHandle, state: State<'_, VoiceState>, model_id: String) -> Result<(), String> {
    let model = find_model(&model_id).ok_or_else(|| report(VoiceError::UnknownModel(model_id.clone())))?;
    {
        let mut downloading = state.downloading.lock().map_err(|_| "download_failed".to_string())?;
        if downloading.insert(model_id.clone()) == false {
            return Err("download_failed".to_string());
        }
    }
    let mut last_sent: Option<Instant> = None;
    let result = download_model(MODELS_BASE_URL, model, &models_folder(), |progress| {
        let is_last = progress.received_bytes >= progress.total_bytes;
        let is_due = last_sent.map(|moment| moment.elapsed() >= PROGRESS_INTERVAL).unwrap_or(true);
        if is_last || is_due {
            last_sent = Some(Instant::now());
            let _ = app.emit(
                DOWNLOAD_PROGRESS_EVENT,
                DownloadProgressEvent {
                    model_id: model_id.clone(),
                    received_bytes: progress.received_bytes,
                    total_bytes: progress.total_bytes,
                },
            );
        }
    })
    .await;
    if let Ok(mut downloading) = state.downloading.lock() {
        downloading.remove(&model_id);
    }
    result.map(|_| ()).map_err(report)
}

/// Starts to record the microphone, and sends the event `voice-input-level` while it records. The error says why it cannot:
/// `no_microphone`, `microphone_denied`, `already_recording`, or `recording_failed`.
#[tauri::command]
pub fn voice_start_recording(app: AppHandle, state: State<'_, VoiceState>) -> Result<(), String> {
    let mut recorder = state.recorder.lock().map_err(|_| "recording_failed".to_string())?;
    if recorder.is_some() {
        return Err(report(VoiceError::AlreadyRecording));
    }
    let started = Recorder::start_with_levels(move |level| {
        let _ = app.emit(LEVEL_EVENT, level);
    });
    let error = started.as_ref().err().map(|error| error.category().to_string());
    application_log::write("voice_recording_start", serde_json::json!({ "error": error }));
    *recorder = Some(started.map_err(report)?);
    Ok(())
}

/// Throws the recording away. It does nothing when no recording runs.
#[tauri::command]
pub fn voice_cancel_recording(state: State<'_, VoiceState>) {
    if let Ok(mut recorder) = state.recorder.lock() {
        if recorder.take().is_some() {
            application_log::write("voice_recording_cancel", serde_json::json!({}));
        }
    }
}

/// Stops the recording and changes the speech into text with the model and the language, then replaces the listed texts of the
/// word replacement list. A recording with no speech gives an empty text. The change runs on a background thread, so the window
/// stays fast.
#[tauri::command]
pub async fn voice_stop_recording(state: State<'_, VoiceState>, model_id: String, language: String) -> Result<String, String> {
    let recorder = state
        .recorder
        .lock()
        .map_err(|_| "recording_failed".to_string())?
        .take()
        .ok_or_else(|| report(VoiceError::NotRecording))?;
    let transcriber = state.transcriber.clone();
    let work = move || -> Result<String, VoiceError> {
        let recording = recorder.stop();
        let recording_seconds = recording.as_ref().map(|recording| recording.seconds()).ok();
        let error = recording.as_ref().err().map(|error| error.category().to_string());
        application_log::write(
            "voice_recording_stop",
            serde_json::json!({ "recording_seconds": recording_seconds, "error": error }),
        );
        let recording = recording?;
        let model = find_model(&model_id).ok_or_else(|| VoiceError::UnknownModel(model_id.clone()))?;
        application_log::write(
            "voice_transcription_start",
            serde_json::json!({ "model": model_id, "language": language, "recording_seconds": recording_seconds }),
        );
        let started = Instant::now();
        let text = transcriber.transcribe(&model_path(&models_folder(), model), model, &language, &recording.samples);
        let text = text.map(|text| replace_spoken_words(&text));
        application_log::write(
            "voice_transcription_end",
            serde_json::json!({
                "duration_ms": started.elapsed().as_millis() as u64,
                "characters": text.as_ref().map(|text| text.chars().count()).ok(),
                "error": text.as_ref().err().map(|error| error.category().to_string()),
            }),
        );
        text
    };
    match tauri::async_runtime::spawn_blocking(work).await {
        Ok(result) => result.map_err(report),
        Err(error) => Err(report(VoiceError::TranscriptionFailed(error.to_string()))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_models_folder_is_in_the_folder_of_the_data_of_heidrun() {
        assert_eq!(models_folder(), app_data::data_dir().join("models"));
    }

    #[test]
    fn the_logs_of_whisper_go_to_a_file_in_the_folder_of_the_data_of_heidrun() {
        assert_eq!(whisper_log_path(), app_data::data_dir().join("logs").join("whisper.log"));
    }

    #[test]
    fn the_options_list_12_models_20_languages_and_a_default_model_of_the_list() {
        let options = voice_options();
        assert_eq!(options.models.len(), 12);
        assert_eq!(options.languages.len(), 20);
        assert!(options.models.iter().any(|model| model.id == options.default_model_id));
    }

    #[test]
    fn the_options_are_written_in_camel_case_for_the_web_page() {
        let value = serde_json::to_value(voice_options()).unwrap();
        assert!(value.get("defaultModelId").is_some());
        assert!(value["models"][0].get("sizeBytes").is_some());
        assert!(value["models"][0].get("isDownloaded").is_some());
        assert!(value["models"][0].get("isEnglishOnly").is_some());
    }

    #[test]
    fn an_error_is_reported_as_its_category_only() {
        assert_eq!(report(VoiceError::RecordingFailed("secret detail".to_string())), "recording_failed");
        assert_eq!(report(VoiceError::MicrophoneDenied), "microphone_denied");
    }

    #[test]
    fn the_level_event_has_the_name_that_the_web_page_listens_to() {
        assert_eq!(LEVEL_EVENT, "voice-input-level");
        assert_eq!(DOWNLOAD_PROGRESS_EVENT, "voice-download-progress");
    }

    #[test]
    fn the_progress_event_is_written_in_camel_case() {
        let event = DownloadProgressEvent { model_id: "base".to_string(), received_bytes: 5, total_bytes: 10 };
        let value = serde_json::to_value(event).unwrap();
        assert_eq!(value["modelId"], "base");
        assert_eq!(value["receivedBytes"], 5);
        assert_eq!(value["totalBytes"], 10);
    }
}
