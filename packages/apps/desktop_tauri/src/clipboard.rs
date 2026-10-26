//! Image clipboard: puts an image file in the macOS clipboard as PNG data, so that
//! a Control+V in a terminal makes Claude Code or Codex read the image.

use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use tokio::process::Command;

/// Gives every call its own PNG file, so that two drops at the same time do not overwrite each other.
static CALL_COUNTER: AtomicU64 = AtomicU64::new(0);

/// File extensions that Heidrun Code accepts as images. `sips` converts all of them to PNG.
const IMAGE_EXTENSIONS: &[&str] = &["png", "jpg", "jpeg", "gif", "webp", "heic", "tif", "tiff", "bmp"];

pub(crate) fn is_image_path(path: &str) -> bool {
    match Path::new(path).extension().and_then(|e| e.to_str()) {
        Some(ext) => IMAGE_EXTENSIONS.contains(&ext.to_ascii_lowercase().as_str()),
        None => false,
    }
}

/// Converts the image file to PNG, then puts the PNG data in the clipboard.
/// Fails with `not_an_image` when the extension is not an image extension.
#[tauri::command]
pub async fn clipboard_set_image(path: String) -> Result<(), String> {
    if !is_image_path(&path) {
        return Err("not_an_image".into());
    }
    let png = std::env::temp_dir().join(format!(
        "heidrun-clipboard-{}-{}.png",
        std::process::id(),
        CALL_COUNTER.fetch_add(1, Ordering::Relaxed)
    ));
    let png_str = png.to_string_lossy().to_string();
    let convert = Command::new("/usr/bin/sips")
        .args(["-s", "format", "png", &path, "--out", &png_str])
        .output()
        .await
        .map_err(|e| e.to_string())?;
    if !convert.status.success() {
        let _ = std::fs::remove_file(&png);
        return Err(format!("conversion_failed: {}", String::from_utf8_lossy(&convert.stderr).trim()));
    }
    let script = format!("set the clipboard to (read (POSIX file \"{}\") as «class PNGf»)", png_str);
    let result = Command::new("/usr/bin/osascript").args(["-e", &script]).output().await;
    let _ = std::fs::remove_file(&png);
    let out = result.map_err(|e| e.to_string())?;
    if out.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_image_extensions_in_any_case() {
        assert!(is_image_path("/a/b/photo.PNG"));
        assert!(is_image_path("/a/b/photo.jpeg"));
        assert!(is_image_path("/a/b/photo.HEIC"));
    }

    #[test]
    fn refuses_other_files() {
        assert!(!is_image_path("/a/b/notes.txt"));
        assert!(!is_image_path("/a/b/no_extension"));
        assert!(!is_image_path("/a/b/folder.png/readme"));
    }

    #[tokio::test]
    async fn refuses_a_text_file_with_not_an_image() {
        let result = clipboard_set_image("/tmp/notes.txt".into()).await;
        assert_eq!(result, Err("not_an_image".to_string()));
    }
}
