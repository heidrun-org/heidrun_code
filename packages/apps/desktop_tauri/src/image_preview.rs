//! Image preview: gives the composition bar a picture of an image file, small or large, as a `data:` address.

use crate::clipboard::is_image_path;
use base64::Engine;
use std::sync::atomic::{AtomicU64, Ordering};
use tokio::process::Command;

/// Gives every call its own PNG file, so that two previews at the same time do not overwrite each other.
static CALL_COUNTER: AtomicU64 = AtomicU64::new(0);

/// The smallest longest side that a caller can ask for, in pixels.
const LONGEST_SIDE_MIN: u32 = 16;

/// The largest longest side that a caller can ask for, in pixels.
const LONGEST_SIDE_MAX: u32 = 4096;

/// Makes a PNG picture of the image file with `sips`, with its longest side at most `longest_side` pixels, and returns
/// it as a `data:image/png;base64,` address. `longest_side` is kept between 16 and 4096.
/// Fails with `not_an_image` when the extension is not an image extension.
#[tauri::command]
pub async fn image_preview(path: String, longest_side: u32) -> Result<String, String> {
    if !is_image_path(&path) {
        return Err("not_an_image".into());
    }
    let longest_side = longest_side.clamp(LONGEST_SIDE_MIN, LONGEST_SIDE_MAX).to_string();
    let png = std::env::temp_dir().join(format!(
        "heidrun-preview-{}-{}.png",
        std::process::id(),
        CALL_COUNTER.fetch_add(1, Ordering::Relaxed)
    ));
    let png_str = png.to_string_lossy().to_string();
    let convert = Command::new("/usr/bin/sips")
        .args(["-s", "format", "png", "-Z", &longest_side, &path, "--out", &png_str])
        .output()
        .await
        .map_err(|e| e.to_string())?;
    if !convert.status.success() {
        let _ = std::fs::remove_file(&png);
        return Err(format!("conversion_failed: {}", String::from_utf8_lossy(&convert.stderr).trim()));
    }
    // `sips` exits with the code 0 and writes no file when the input file does not exist, so a missing output is a failure.
    let bytes = std::fs::read(&png).map_err(|e| format!("conversion_failed: {e}"));
    let _ = std::fs::remove_file(&png);
    Ok(format!("data:image/png;base64,{}", base64::engine::general_purpose::STANDARD.encode(bytes?)))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A PNG of one pixel, written by hand, so that the test needs no other image tool.
    #[cfg(target_os = "macos")]
    const ONE_PIXEL_PNG: &[u8] = &[
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00,
        0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0d, 0x49,
        0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0xf8, 0xcf, 0xc0, 0xf0, 0x1f, 0x00, 0x05, 0x00, 0x01, 0xff, 0x89, 0x99, 0x3d,
        0x1d, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ];

    #[tokio::test]
    async fn refuses_a_text_file_with_not_an_image() {
        let result = image_preview("/tmp/notes.txt".into(), 256).await;
        assert_eq!(result, Err("not_an_image".to_string()));
    }

    #[cfg(target_os = "macos")]
    #[tokio::test]
    async fn makes_a_png_data_address_from_a_png_file() {
        let folder = std::env::temp_dir().join(format!("heidrun-preview-test-{}", std::process::id()));
        std::fs::create_dir_all(&folder).unwrap();
        let file = folder.join("one_pixel.png");
        std::fs::write(&file, ONE_PIXEL_PNG).unwrap();
        let result = image_preview(file.to_string_lossy().to_string(), 256).await;
        let _ = std::fs::remove_dir_all(&folder);
        let address = result.unwrap();
        assert!(address.starts_with("data:image/png;base64,iVBORw0KGgo"), "got {address}");
    }

    #[cfg(target_os = "macos")]
    #[tokio::test]
    async fn keeps_the_longest_side_in_range_instead_of_failing() {
        let folder = std::env::temp_dir().join(format!("heidrun-preview-range-test-{}", std::process::id()));
        std::fs::create_dir_all(&folder).unwrap();
        let file = folder.join("one_pixel.png");
        std::fs::write(&file, ONE_PIXEL_PNG).unwrap();
        let path = file.to_string_lossy().to_string();
        let too_small = image_preview(path.clone(), 0).await;
        let too_large = image_preview(path, u32::MAX).await;
        let _ = std::fs::remove_dir_all(&folder);
        assert!(too_small.unwrap().starts_with("data:image/png;base64,"));
        assert!(too_large.unwrap().starts_with("data:image/png;base64,"));
    }

    #[cfg(target_os = "macos")]
    #[tokio::test]
    async fn reports_a_file_that_does_not_exist() {
        let result = image_preview("/tmp/heidrun-no-such-file.png".into(), 256).await;
        assert!(result.unwrap_err().starts_with("conversion_failed"));
    }
}
