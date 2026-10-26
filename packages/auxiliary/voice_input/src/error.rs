//! The errors of the voice input. Each error has a category, a short word that the web page changes into a text.

use std::fmt;

/// Why a part of the voice input failed.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum VoiceError {
    /// The computer has no microphone, or the microphone is not available.
    NoMicrophone,
    /// macOS refused the permission to use the microphone.
    MicrophoneDenied,
    /// The microphone gave only exact zeros: the permission is refused, or the microphone is off.
    NoSignal,
    /// The recording failed for another reason. The text is for the developers of Heidrun Code and never reaches the window.
    RecordingFailed(String),
    /// A recording is already running.
    AlreadyRecording,
    /// No recording is running.
    NotRecording,
    /// The identifier of the model is not in the list of models.
    UnknownModel(String),
    /// The code of the language is not in the list of languages.
    UnknownLanguage(String),
    /// The model file is not on the disk: the developer did not download it.
    ModelMissing(String),
    /// Whisper could not load the model file.
    ModelLoadFailed(String),
    /// Whisper could not change the audio into text.
    TranscriptionFailed(String),
    /// The download of a model file failed.
    DownloadFailed(String),
}

impl VoiceError {
    /// The category of the error: a stable word, written in snake case.
    pub fn category(&self) -> &'static str {
        match self {
            VoiceError::NoMicrophone => "no_microphone",
            VoiceError::MicrophoneDenied => "microphone_denied",
            VoiceError::NoSignal => "no_signal",
            VoiceError::RecordingFailed(_) => "recording_failed",
            VoiceError::AlreadyRecording => "already_recording",
            VoiceError::NotRecording => "not_recording",
            VoiceError::UnknownModel(_) => "unknown_model",
            VoiceError::UnknownLanguage(_) => "unknown_language",
            VoiceError::ModelMissing(_) => "model_missing",
            VoiceError::ModelLoadFailed(_) => "model_load_failed",
            VoiceError::TranscriptionFailed(_) => "transcription_failed",
            VoiceError::DownloadFailed(_) => "download_failed",
        }
    }
}

impl fmt::Display for VoiceError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            VoiceError::RecordingFailed(detail)
            | VoiceError::UnknownModel(detail)
            | VoiceError::UnknownLanguage(detail)
            | VoiceError::ModelMissing(detail)
            | VoiceError::ModelLoadFailed(detail)
            | VoiceError::TranscriptionFailed(detail)
            | VoiceError::DownloadFailed(detail) => write!(formatter, "{}: {}", self.category(), detail),
            _ => write!(formatter, "{}", self.category()),
        }
    }
}

impl std::error::Error for VoiceError {}
