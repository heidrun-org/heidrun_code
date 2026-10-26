//! The Heidrun Code icon of the status item: loads the icon of the application, a white goat on an orange rounded square,
//! from the folder `data/images`, cuts the empty margins away, and scales the icon to the height of the picture of the
//! status item.

use crate::status_item_picture::Sprite;
use std::sync::OnceLock;
use tauri::image::Image;

/// The icon of Heidrun Code, from the folder `data/images` at the root of the repository.
const ICON_FILE: &[u8] = include_bytes!("../../../../data/images/heidrun_icon.png");

/// Height of the icon in the picture, in pixels: nearly the whole height of the picture.
const ICON_HEIGHT: u32 = 42;

/// A pixel with an alpha below this value counts as empty when the margins are cut.
const MIN_ALPHA: u8 = 16;

/// The frames of the icon, ready to draw. Loaded once, at the first use.
static FRAMES: OnceLock<Vec<Sprite>> = OnceLock::new();

/// The frames of the icon: one frame, because the icon does not move. The list is empty when the file cannot be read.
pub fn frames() -> &'static [Sprite] {
    FRAMES.get_or_init(|| load(ICON_FILE))
}

/// Opacity of the faded icon, from 0 to 1: the icon shows that the user is not active in front of Heidrun Code.
const INACTIVE_OPACITY: f32 = 0.25;

/// The frames of the faded icon. Made once, at the first use.
static FADED_FRAMES: OnceLock<Vec<Sprite>> = OnceLock::new();

/// The frames of the icon, with a smaller opacity: the same pixels as `frames`, with the alpha of each pixel multiplied
/// by `INACTIVE_OPACITY`.
pub fn faded_frames() -> &'static [Sprite] {
    FADED_FRAMES.get_or_init(|| frames().iter().map(faded).collect())
}

/// A copy of `sprite` with the alpha of each pixel multiplied by `INACTIVE_OPACITY`. The colors do not change.
fn faded(sprite: &Sprite) -> Sprite {
    let mut pixels = sprite.pixels.clone();
    for pixel in pixels.chunks_exact_mut(4) {
        pixel[3] = (pixel[3] as f32 * INACTIVE_OPACITY).round() as u8;
    }
    Sprite { width: sprite.width, height: sprite.height, pixels }
}

/// Reads the icon from a PNG file, and cuts and scales it.
fn load(file: &[u8]) -> Vec<Sprite> {
    let Ok(image) = Image::from_bytes(file) else {
        return Vec::new();
    };
    match visible_region(&image) {
        Some(region) => vec![scale(&image, region, ICON_HEIGHT)],
        None => Vec::new(),
    }
}

/// A rectangle of an image, in pixels: the left and top sides are inside, the right and bottom sides are outside.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct Region {
    left: u32,
    top: u32,
    right: u32,
    bottom: u32,
}

/// The smallest rectangle that holds every visible pixel of the image, or `None` when the image is empty.
fn visible_region(image: &Image<'static>) -> Option<Region> {
    let mut region: Option<Region> = None;
    for y in 0..image.height() {
        for x in 0..image.width() {
            if image.rgba()[((y * image.width() + x) * 4 + 3) as usize] < MIN_ALPHA {
                continue;
            }
            region = Some(match region {
                None => Region { left: x, top: y, right: x + 1, bottom: y + 1 },
                Some(known) => Region {
                    left: known.left.min(x),
                    top: known.top.min(y),
                    right: known.right.max(x + 1),
                    bottom: known.bottom.max(y + 1),
                },
            });
        }
    }
    region
}

/// Scales `region` of `image` to `target_height` pixels high, in the same proportions, by the average of the pixels
/// that fall in each new pixel. The colors are weighted by the alpha, so that a transparent pixel does not darken the
/// edge of the icon.
fn scale(image: &Image<'static>, region: Region, target_height: u32) -> Sprite {
    let step = (region.bottom - region.top) as f32 / target_height as f32;
    let target_width = (((region.right - region.left) as f32 / step).round() as u32).max(1);
    let rgba = image.rgba();
    let mut pixels = vec![0u8; (target_width * target_height * 4) as usize];
    for target_y in 0..target_height {
        for target_x in 0..target_width {
            let x_from = region.left as f32 + target_x as f32 * step;
            let y_from = region.top as f32 + target_y as f32 * step;
            let (x_to, y_to) = (x_from + step, y_from + step);
            let (mut weight_sum, mut alpha_sum, mut color_sum) = (0.0f32, 0.0f32, [0.0f32; 3]);
            for y in (y_from.floor() as u32)..(y_to.ceil() as u32).min(region.bottom) {
                for x in (x_from.floor() as u32)..(x_to.ceil() as u32).min(region.right) {
                    let overlap_x = (x_to.min((x + 1) as f32) - x_from.max(x as f32)).max(0.0);
                    let overlap_y = (y_to.min((y + 1) as f32) - y_from.max(y as f32)).max(0.0);
                    let weight = overlap_x * overlap_y;
                    let offset = ((y * image.width() + x) * 4) as usize;
                    let alpha = rgba[offset + 3] as f32 / 255.0;
                    weight_sum += weight;
                    alpha_sum += weight * alpha;
                    for channel in 0..3 {
                        color_sum[channel] += weight * alpha * rgba[offset + channel] as f32;
                    }
                }
            }
            if weight_sum > 0.0 && alpha_sum > 0.0 {
                let offset = ((target_y * target_width + target_x) * 4) as usize;
                for channel in 0..3 {
                    pixels[offset + channel] = (color_sum[channel] / alpha_sum).round().clamp(0.0, 255.0) as u8;
                }
                pixels[offset + 3] = (alpha_sum / weight_sum * 255.0).round().clamp(0.0, 255.0) as u8;
            }
        }
    }
    Sprite { width: target_width, height: target_height, pixels }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn solid(width: u32, height: u32, pixel: [u8; 4]) -> Image<'static> {
        Image::new_owned(pixel.repeat((width * height) as usize), width, height)
    }

    #[test]
    fn the_icon_is_read_as_one_frame_of_the_height_of_the_picture() {
        let frames = frames();
        assert_eq!(frames.len(), 1);
        assert_eq!(frames[0].height, ICON_HEIGHT);
        assert!(frames[0].width > 10);
    }

    #[test]
    fn the_icon_is_orange_with_a_white_goat_and_the_corner_is_transparent() {
        let frame = &frames()[0];
        let pixels: Vec<&[u8]> = frame.pixels.chunks(4).filter(|pixel| pixel[3] == 255).collect();
        assert!(pixels.iter().any(|pixel| pixel[0] > 200 && pixel[1] < 120 && pixel[2] < 60), "no orange pixel");
        assert!(pixels.iter().any(|pixel| pixel[0] > 240 && pixel[1] > 230 && pixel[2] > 200), "no white pixel");
        assert_eq!(frame.pixels[3], 0);
    }

    #[test]
    fn the_faded_icon_has_the_size_and_the_colors_of_the_icon_and_a_smaller_alpha() {
        let (icon, faded_icon) = (&frames()[0], &faded_frames()[0]);
        assert_eq!((faded_icon.width, faded_icon.height), (icon.width, icon.height));
        for (pixel, faded_pixel) in icon.pixels.chunks(4).zip(faded_icon.pixels.chunks(4)) {
            assert_eq!(&pixel[..3], &faded_pixel[..3]);
            assert_eq!(faded_pixel[3], (pixel[3] as f32 * INACTIVE_OPACITY).round() as u8);
        }
        assert!(faded_icon.pixels.chunks(4).all(|pixel| pixel[3] <= 64));
    }

    #[test]
    fn scaling_a_solid_image_keeps_its_color_and_its_proportions() {
        let image = solid(8, 4, [200, 100, 50, 255]);
        let region = Region { left: 0, top: 0, right: 8, bottom: 4 };
        let sprite = scale(&image, region, 2);
        assert_eq!((sprite.width, sprite.height), (4, 2));
        assert!(sprite.pixels.chunks(4).all(|pixel| pixel == [200, 100, 50, 255]));
    }

    #[test]
    fn scaling_a_transparent_image_gives_a_transparent_sprite() {
        let image = solid(4, 4, [255, 255, 255, 0]);
        let sprite = scale(&image, Region { left: 0, top: 0, right: 4, bottom: 4 }, 2);
        assert!(sprite.pixels.iter().all(|byte| *byte == 0));
    }

    #[test]
    fn a_transparent_pixel_does_not_darken_the_color_of_its_neighbors() {
        let pixels = [[255, 0, 0, 255], [0, 0, 0, 0], [255, 0, 0, 255], [0, 0, 0, 0]].concat();
        let image = Image::new_owned(pixels, 2, 2);
        let sprite = scale(&image, Region { left: 0, top: 0, right: 2, bottom: 2 }, 1);
        assert_eq!(&sprite.pixels[..3], &[255, 0, 0]);
        assert_eq!(sprite.pixels[3], 128);
    }

    #[test]
    fn the_visible_region_holds_the_visible_pixels_of_the_image() {
        let mut pixels = [0u8, 0, 0, 0].repeat(16);
        pixels[(1 * 4 + 1) * 4 + 3] = 255;
        pixels[(2 * 4 + 3) * 4 + 3] = 255;
        let image = Image::new_owned(pixels, 4, 4);
        assert_eq!(visible_region(&image), Some(Region { left: 1, top: 1, right: 4, bottom: 3 }));
        assert_eq!(visible_region(&solid(2, 2, [0, 0, 0, 0])), None);
    }
}
