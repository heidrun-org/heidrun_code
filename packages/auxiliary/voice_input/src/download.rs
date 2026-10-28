//! The download of a model file. The file is written under a temporary name and renamed when it is complete, so Heidrun Code never
//! reads a broken model.

use crate::error::VoiceError;
use crate::models::WhisperModel;
use std::path::{Path, PathBuf};
use tokio::io::AsyncWriteExt;

/// How far a download went.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DownloadProgress {
    /// The bytes written so far.
    pub received_bytes: u64,
    /// The size that the server announced, or the size in the list of models when the server did not announce one.
    pub total_bytes: u64,
}

/// Downloads a model into the folder, and returns the path of the file. `base_url` is the folder of the files on the server
/// (`MODELS_BASE_URL` for the real one). `on_progress` runs after each part of the file.
pub async fn download_model(
    base_url: &str,
    model: &WhisperModel,
    folder: &Path,
    mut on_progress: impl FnMut(DownloadProgress),
) -> Result<PathBuf, VoiceError> {
    tokio::fs::create_dir_all(folder).await.map_err(|error| VoiceError::DownloadFailed(format!("folder: {error}")))?;
    let final_path = crate::models::model_path(folder, model);
    let temporary_path = folder.join(format!("{}.part", model.file_name));
    let result = write_file(base_url, model, &temporary_path, &mut on_progress).await;
    match result {
        Ok(()) => {
            tokio::fs::rename(&temporary_path, &final_path)
                .await
                .map_err(|error| VoiceError::DownloadFailed(format!("rename: {error}")))?;
            Ok(final_path)
        }
        Err(error) => {
            let _ = tokio::fs::remove_file(&temporary_path).await;
            Err(error)
        }
    }
}

async fn write_file(
    base_url: &str,
    model: &WhisperModel,
    temporary_path: &Path,
    on_progress: &mut impl FnMut(DownloadProgress),
) -> Result<(), VoiceError> {
    let address = format!("{}/{}", base_url.trim_end_matches('/'), model.file_name);
    let mut response = reqwest::get(&address).await.map_err(|error| VoiceError::DownloadFailed(format!("request: {error}")))?;
    if response.status().is_success() == false {
        return Err(VoiceError::DownloadFailed(format!("status {}", response.status())));
    }
    let announced = response.content_length();
    let total_bytes = announced.unwrap_or(model.size_bytes);
    let mut file = tokio::fs::File::create(temporary_path)
        .await
        .map_err(|error| VoiceError::DownloadFailed(format!("create: {error}")))?;
    let mut received_bytes: u64 = 0;
    on_progress(DownloadProgress { received_bytes, total_bytes });
    loop {
        let chunk = response.chunk().await.map_err(|error| VoiceError::DownloadFailed(format!("read: {error}")))?;
        let Some(chunk) = chunk else {
            break;
        };
        file.write_all(&chunk).await.map_err(|error| VoiceError::DownloadFailed(format!("write: {error}")))?;
        received_bytes += chunk.len() as u64;
        on_progress(DownloadProgress { received_bytes, total_bytes });
    }
    file.flush().await.map_err(|error| VoiceError::DownloadFailed(format!("write: {error}")))?;
    if let Some(announced) = announced {
        if received_bytes != announced {
            return Err(VoiceError::DownloadFailed(format!("incomplete: {received_bytes} of {announced} bytes")));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    const FAKE_MODEL: WhisperModel = WhisperModel { id: "fake", file_name: "ggml-fake.bin", size_bytes: 1000, is_english_only: false };

    /// Starts a fake server that answers one request with the given head and body, then closes the connection. The body is sent
    /// in parts of 100 bytes.
    async fn serve_once(head: &'static str, body: Vec<u8>) -> String {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = format!("http://{}", listener.local_addr().unwrap());
        tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            let mut request = vec![0u8; 4096];
            let _ = socket.read(&mut request).await;
            socket.write_all(head.as_bytes()).await.unwrap();
            for part in body.chunks(100) {
                socket.write_all(part).await.unwrap();
                socket.flush().await.unwrap();
                tokio::time::sleep(std::time::Duration::from_millis(5)).await;
            }
            let _ = socket.shutdown().await;
        });
        address
    }

    fn temporary_folder(name: &str) -> PathBuf {
        let folder = std::env::temp_dir().join(format!("voice_input_{}_{}", name, std::process::id()));
        let _ = std::fs::remove_dir_all(&folder);
        folder
    }

    #[tokio::test]
    async fn a_complete_download_writes_the_file_and_reports_the_progress() {
        let body: Vec<u8> = (0..1000u32).map(|index| (index % 251) as u8).collect();
        let address = serve_once("HTTP/1.1 200 OK\r\nContent-Length: 1000\r\nConnection: close\r\n\r\n", body.clone()).await;
        let folder = temporary_folder("complete");
        let mut reports: Vec<DownloadProgress> = Vec::new();
        let path = download_model(&address, &FAKE_MODEL, &folder, |progress| reports.push(progress)).await.unwrap();
        assert_eq!(std::fs::read(&path).unwrap(), body);
        assert_eq!(path, folder.join("ggml-fake.bin"));
        assert!(folder.join("ggml-fake.bin.part").exists() == false);
        assert_eq!(reports.first().unwrap().received_bytes, 0);
        assert_eq!(*reports.last().unwrap(), DownloadProgress { received_bytes: 1000, total_bytes: 1000 });
        assert!(reports.windows(2).all(|pair| pair[0].received_bytes <= pair[1].received_bytes));
        assert!(reports.len() > 2);
        std::fs::remove_dir_all(&folder).unwrap();
    }

    #[tokio::test]
    async fn a_download_that_stops_early_leaves_no_file() {
        let address = serve_once("HTTP/1.1 200 OK\r\nContent-Length: 1000\r\nConnection: close\r\n\r\n", vec![7u8; 400]).await;
        let folder = temporary_folder("broken");
        let error = download_model(&address, &FAKE_MODEL, &folder, |_| {}).await.unwrap_err();
        assert_eq!(error.category(), "download_failed");
        assert!(folder.join("ggml-fake.bin").exists() == false);
        assert!(folder.join("ggml-fake.bin.part").exists() == false);
        std::fs::remove_dir_all(&folder).unwrap();
    }

    #[tokio::test]
    async fn a_missing_file_on_the_server_is_a_failure() {
        let address = serve_once("HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n", Vec::new()).await;
        let folder = temporary_folder("missing");
        let error = download_model(&address, &FAKE_MODEL, &folder, |_| {}).await.unwrap_err();
        assert_eq!(error, VoiceError::DownloadFailed("status 404 Not Found".to_string()));
        assert!(folder.join("ggml-fake.bin").exists() == false);
        std::fs::remove_dir_all(&folder).unwrap();
    }

    #[tokio::test]
    async fn a_server_that_is_not_there_is_a_failure() {
        let folder = temporary_folder("offline");
        let error = download_model("http://127.0.0.1:9", &FAKE_MODEL, &folder, |_| {}).await.unwrap_err();
        assert_eq!(error.category(), "download_failed");
        assert!(folder.join("ggml-fake.bin").exists() == false);
        let _ = std::fs::remove_dir_all(&folder);
    }
}
