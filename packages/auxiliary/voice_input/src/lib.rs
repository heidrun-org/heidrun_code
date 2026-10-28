//! The voice input of Heidrun Code: it records the microphone, downloads a Whisper model, and changes the speech into text on the
//! computer. It knows nothing about Tauri and the web page. The audio stays in memory, and only the download of a model file
//! uses the network.

pub mod audio;
pub mod download;
pub mod error;
pub mod models;
pub mod recording;
pub mod transcription;
pub mod whisper_log;
pub mod word_replacement;

pub use download::{download_model, DownloadProgress};
pub use error::VoiceError;
pub use models::{
    find_model, is_downloaded, is_known_language, list_models, model_path, ModelInfo, WhisperModel, AUTOMATIC_LANGUAGE,
    DEFAULT_MODEL_ID, LANGUAGES, MODELS, MODELS_BASE_URL,
};
pub use recording::{Recorder, Recording};
pub use transcription::Transcriber;
pub use word_replacement::replace_words;
