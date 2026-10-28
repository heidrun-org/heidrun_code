//! The Whisper models that the developer can choose, the languages, and the files of the models on the disk.

use serde::Serialize;
use std::path::{Path, PathBuf};

/// The address of the folder of the official model files of whisper.cpp on Hugging Face.
pub const MODELS_BASE_URL: &str = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main";

/// The model that Heidrun Code proposes first. On the computer of the developer, it changed a sentence of 5 seconds into text in
/// 0.36 second, and the model `tiny`, which is faster, made a mistake in the sentence (issue 662).
pub const DEFAULT_MODEL_ID: &str = "base";

/// The value of the language that lets Whisper find the language of the speech.
pub const AUTOMATIC_LANGUAGE: &str = "auto";

/// The languages that the developer can choose, as two-letter codes. The list is the one of the project voice_to_keyboard.
pub const LANGUAGES: [&str; 20] = [
    "en", "es", "fr", "de", "it", "pt", "nl", "ru", "zh", "ja", "ko", "ar", "hi", "tr", "pl", "uk", "sv", "fi", "da", "no",
];

/// One Whisper model: a file of whisper.cpp that Heidrun Code downloads on request.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct WhisperModel {
    /// The identifier of the model, for example `base` or `large-v3-turbo`.
    pub id: &'static str,
    /// The name of the file on Hugging Face and on the disk.
    pub file_name: &'static str,
    /// The size of the file, in bytes.
    pub size_bytes: u64,
    /// The model understands only English. The name of its identifier ends with `.en`.
    pub is_english_only: bool,
}

/// The 12 models of the list, from the smallest to the largest.
pub const MODELS: [WhisperModel; 12] = [
    WhisperModel { id: "tiny", file_name: "ggml-tiny.bin", size_bytes: 77_691_713, is_english_only: false },
    WhisperModel { id: "tiny.en", file_name: "ggml-tiny.en.bin", size_bytes: 77_704_715, is_english_only: true },
    WhisperModel { id: "base", file_name: "ggml-base.bin", size_bytes: 147_951_465, is_english_only: false },
    WhisperModel { id: "base.en", file_name: "ggml-base.en.bin", size_bytes: 147_964_211, is_english_only: true },
    WhisperModel { id: "small", file_name: "ggml-small.bin", size_bytes: 487_601_967, is_english_only: false },
    WhisperModel { id: "small.en", file_name: "ggml-small.en.bin", size_bytes: 487_614_201, is_english_only: true },
    WhisperModel { id: "medium", file_name: "ggml-medium.bin", size_bytes: 1_533_763_059, is_english_only: false },
    WhisperModel { id: "medium.en", file_name: "ggml-medium.en.bin", size_bytes: 1_533_774_781, is_english_only: true },
    WhisperModel { id: "large-v1", file_name: "ggml-large-v1.bin", size_bytes: 3_094_623_691, is_english_only: false },
    WhisperModel { id: "large-v2", file_name: "ggml-large-v2.bin", size_bytes: 3_094_623_691, is_english_only: false },
    WhisperModel { id: "large-v3", file_name: "ggml-large-v3.bin", size_bytes: 3_095_033_483, is_english_only: false },
    WhisperModel { id: "large-v3-turbo", file_name: "ggml-large-v3-turbo.bin", size_bytes: 1_624_555_275, is_english_only: false },
];

/// What the web page learns about one model.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelInfo {
    /// The identifier of the model.
    pub id: String,
    /// The size of the model file, in bytes.
    pub size_bytes: u64,
    /// The model understands only English.
    pub is_english_only: bool,
    /// The model file is on the disk, complete.
    pub is_downloaded: bool,
}

/// Finds a model by its identifier.
pub fn find_model(id: &str) -> Option<&'static WhisperModel> {
    MODELS.iter().find(|model| model.id == id)
}

/// The path of the file of a model in the folder of the models.
pub fn model_path(folder: &Path, model: &WhisperModel) -> PathBuf {
    folder.join(model.file_name)
}

/// The model file is on the disk. A download writes under a temporary name and renames the file when it is complete, so a file
/// with the final name is never a broken file.
pub fn is_downloaded(folder: &Path, model: &WhisperModel) -> bool {
    model_path(folder, model).is_file()
}

/// The 12 models with their state on the disk, in the order of the list.
pub fn list_models(folder: &Path) -> Vec<ModelInfo> {
    MODELS
        .iter()
        .map(|model| ModelInfo {
            id: model.id.to_string(),
            size_bytes: model.size_bytes,
            is_english_only: model.is_english_only,
            is_downloaded: is_downloaded(folder, model),
        })
        .collect()
}

/// The language is the automatic choice or one of the languages of the list.
pub fn is_known_language(language: &str) -> bool {
    language == AUTOMATIC_LANGUAGE || LANGUAGES.contains(&language)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_list_has_12_models_with_unique_identifiers_and_files() {
        assert_eq!(MODELS.len(), 12);
        for (index, model) in MODELS.iter().enumerate() {
            assert_eq!(MODELS.iter().filter(|other| other.id == model.id).count(), 1, "{}", model.id);
            assert_eq!(MODELS.iter().filter(|other| other.file_name == model.file_name).count(), 1, "{}", model.id);
            assert_eq!(model.file_name, format!("ggml-{}.bin", model.id));
            assert_eq!(model.is_english_only, model.id.ends_with(".en"), "{}", model.id);
            assert!(model.size_bytes > 70_000_000, "{} index {}", model.id, index);
        }
    }

    #[test]
    fn the_default_model_is_in_the_list() {
        assert!(find_model(DEFAULT_MODEL_ID).is_some());
        assert!(find_model("no_such_model").is_none());
    }

    #[test]
    fn a_model_is_downloaded_only_when_its_file_exists() {
        let folder = std::env::temp_dir().join(format!("voice_input_models_{}", std::process::id()));
        std::fs::create_dir_all(&folder).unwrap();
        let model = find_model("tiny").unwrap();
        assert!(list_models(&folder).iter().all(|info| info.is_downloaded == false));
        std::fs::write(model_path(&folder, model), b"model").unwrap();
        let infos = list_models(&folder);
        assert!(infos.iter().find(|info| info.id == "tiny").unwrap().is_downloaded);
        assert!(infos.iter().find(|info| info.id == "base").unwrap().is_downloaded == false);
        std::fs::remove_dir_all(&folder).unwrap();
    }

    #[test]
    fn the_languages_are_the_automatic_choice_and_the_20_codes() {
        assert!(is_known_language("auto"));
        assert!(is_known_language("fr"));
        assert!(is_known_language("xx") == false);
        assert!(is_known_language("") == false);
    }
}
