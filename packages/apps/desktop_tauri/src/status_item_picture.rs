//! Draws the picture of the status item in the macOS menu bar: the icon of Heidrun Code and flat discs side by side.
//!
//! Every function here is pure: the same slots and the same time always give the same pixels. The module
//! `status_item` owns the timer and gives the time of each frame.

use std::f32::consts::PI;

/// Width of one slot, in pixels. The picture is drawn at twice the size of the menu bar, for Retina screens. The disc is
/// 36 pixels wide, so 10 pixels of empty space separate two discs.
pub const SLOT_WIDTH: u32 = 46;

/// Height of the picture, in pixels. The library that shows the picture in the menu bar always scales it to 18 points
/// high. Empty space above and below the discs would make the discs smaller than the icons of the other applications,
/// so the discs nearly fill the height.
pub const PICTURE_HEIGHT: u32 = 44;

/// Radius of the disc of a slot, in pixels.
const RADIUS: f32 = 18.0;

/// Width of the thin border of a disc, in pixels. The border has the normal color of the disc, whatever the number of
/// agents.
const BORDER_WIDTH: f32 = 2.0;

/// Width of the border of a disc without agent, in pixels: thicker than `BORDER_WIDTH`.
const EMPTY_BORDER_WIDTH: f32 = 3.5;

/// Width of the glow around a disc that shows three agents or more, in pixels.
const HALO_WIDTH: f32 = 4.0;

/// Opacity of the glow next to the edge of the disc, from 0 to 1.
const HALO_OPACITY: f32 = 0.8;

/// Opacity of a disc without agent: the color is very faded, from 0 to 1.
const FADED_OPACITY: f32 = 0.22;

/// Share of white mixed into the color of a disc that shows two agents or more, from 0 to 1. The disc looks brighter.
const BRIGHT_WHITE_SHARE: f32 = 0.35;

/// Empty space on the left and on the right of the whole picture, in pixels.
pub const PICTURE_PADDING: u32 = 4;

/// Empty space on each side of a sprite, in pixels. The same space as between two discs.
const SPRITE_MARGIN: u32 = 5;

/// Number of frames of a walking sprite per second.
const WALK_FRAMES_PER_SECOND: f32 = 8.0;

/// Color of the glow behind the whole picture while an agent stays blocked for too long: red, green, blue.
const BLOCKED_ALARM_COLOR: [u8; 3] = [235, 64, 52];

/// Number of pulses per second of the glow behind the whole picture.
const ALARM_FREQUENCY: f32 = 1.2;

/// Radius of the rounded corners of the glow behind the whole picture, in pixels.
const ALARM_CORNER_RADIUS: f32 = 12.0;

/// One slot of the picture.
#[derive(Clone, Debug)]
pub enum Slot {
    /// A flat disc with the number of agents inside. The number of agents sets how lit the disc is: zero is very
    /// faded, one has the normal color, two is brighter, three or more is brighter and has a glow.
    Disc {
        /// Number of agents. Numbers above 99 are drawn as 99.
        count: usize,
        /// Normal color of the disc: red, green, blue.
        color: [u8; 3],
    },
    /// A small picture with one or several frames, for example the icon of Heidrun Code. The slot is as wide as the frames.
    Sprite {
        /// The frames of the walk. All the frames have the same size.
        frames: &'static [Sprite],
        /// `true` plays the frames in a loop, `false` shows the first frame.
        is_walking: bool,
    },
}

/// A small picture: red, green, blue, alpha bytes, row by row.
#[derive(Clone, Debug)]
pub struct Sprite {
    /// Width in pixels.
    pub width: u32,
    /// Height in pixels.
    pub height: u32,
    /// The pixels, `width * height * 4` bytes.
    pub pixels: Vec<u8>,
}

impl Slot {
    /// Width of the slot, in pixels.
    pub fn width(&self) -> u32 {
        match self {
            Slot::Sprite { frames, .. } => frames.first().map_or(0, |frame| frame.width + 2 * SPRITE_MARGIN),
            _ => SLOT_WIDTH,
        }
    }

    /// True when the slot looks different from one frame to the next.
    pub fn is_animated(&self) -> bool {
        match self {
            Slot::Disc { .. } => false,
            Slot::Sprite { frames, is_walking } => *is_walking && frames.len() > 1,
        }
    }
}

/// Width of the slots side by side, in pixels.
pub fn slots_width(slots: &[Slot]) -> u32 {
    slots.iter().map(Slot::width).sum()
}

/// Width of the whole picture: the slots side by side, and the empty space on the left and on the right.
pub fn picture_width(slots: &[Slot]) -> u32 {
    slots_width(slots) + 2 * PICTURE_PADDING
}

/// True when at least one slot moves, so that the picture must be drawn again for every frame.
pub fn is_animated(slots: &[Slot]) -> bool {
    slots.iter().any(Slot::is_animated)
}

/// A color with red, green, blue, alpha, each from 0 to 1. The alpha is not multiplied into the other values.
type Color = [f32; 4];

const TRANSPARENT: Color = [0.0, 0.0, 0.0, 0.0];

/// Puts `top` over `bottom`.
fn over(top: Color, bottom: Color) -> Color {
    let alpha = top[3] + bottom[3] * (1.0 - top[3]);
    if alpha <= 0.0 {
        return TRANSPARENT;
    }
    let mix = |index: usize| (top[index] * top[3] + bottom[index] * bottom[3] * (1.0 - top[3])) / alpha;
    [mix(0), mix(1), mix(2), alpha]
}

fn to_float(color: [u8; 3]) -> [f32; 3] {
    [color[0] as f32 / 255.0, color[1] as f32 / 255.0, color[2] as f32 / 255.0]
}

///////////////////////////////////////////////////////////////////////////////
// Digits
///////////////////////////////////////////////////////////////////////////////

/// Digits of a font that is 3 pixels wide and 5 pixels high. Each row is 3 bits, the left pixel is the highest bit.
const DIGIT_ROWS: [[u8; 5]; 10] = [
    [0b111, 0b101, 0b101, 0b101, 0b111],
    [0b010, 0b110, 0b010, 0b010, 0b111],
    [0b111, 0b001, 0b111, 0b100, 0b111],
    [0b111, 0b001, 0b111, 0b001, 0b111],
    [0b101, 0b101, 0b111, 0b001, 0b001],
    [0b111, 0b100, 0b111, 0b001, 0b111],
    [0b111, 0b100, 0b111, 0b101, 0b111],
    [0b111, 0b001, 0b001, 0b010, 0b010],
    [0b111, 0b101, 0b111, 0b101, 0b111],
    [0b111, 0b101, 0b111, 0b001, 0b111],
];

/// The pixels of a number, placed in the middle of a slot.
struct Digits {
    /// Left side of the first digit, in pixels from the left side of the slot.
    left: i32,
    /// Top side of the digits, in pixels from the top side of the slot.
    top: i32,
    /// Size of one font pixel, in pixels of the picture.
    scale: i32,
    /// The digits, from left to right.
    digits: Vec<usize>,
}

impl Digits {
    /// The digits of `count`, or `None` when the count is zero.
    fn of(count: usize) -> Option<Digits> {
        if count == 0 {
            return None;
        }
        let count = count.min(99);
        let digits: Vec<usize> = count.to_string().bytes().map(|byte| (byte - b'0') as usize).collect();
        let scale = if digits.len() == 1 { 4 } else { 3 };
        let width = digits.len() as i32 * 3 * scale + (digits.len() as i32 - 1) * scale;
        let height = 5 * scale;
        Some(Digits {
            left: (SLOT_WIDTH as i32 - width) / 2,
            top: (PICTURE_HEIGHT as i32 - height) / 2,
            scale,
            digits,
        })
    }

    /// True when the pixel (`x`, `y`) of the slot belongs to a digit.
    fn contains(&self, x: i32, y: i32) -> bool {
        let font_x = x - self.left;
        let font_y = y - self.top;
        if font_x < 0 || font_y < 0 {
            return false;
        }
        let column = font_x / self.scale;
        let row = font_y / self.scale;
        if row >= 5 {
            return false;
        }
        let digit_index = (column / 4) as usize;
        let column_in_digit = column % 4;
        if digit_index >= self.digits.len() || column_in_digit >= 3 {
            return false;
        }
        DIGIT_ROWS[self.digits[digit_index]][row as usize] >> (2 - column_in_digit) & 1 == 1
    }
}

///////////////////////////////////////////////////////////////////////////////
// Discs
///////////////////////////////////////////////////////////////////////////////

/// The color of the pixel at (`dx`, `dy`) from the center of a disc, without the digits. The disc is flat, with a thin
/// border in its normal color. The number of agents sets how lit the inside of the disc is:
/// - zero: the inside is gray, the same gray for every status, and the border is thicker;
/// - one: the normal color;
/// - two: a brighter color;
/// - three or more: the brighter color, with a glow around the disc.
fn disc_color(dx: f32, dy: f32, color: [u8; 3], count: usize) -> Color {
    let distance = (dx * dx + dy * dy).sqrt();
    let base = to_float(color);
    let is_empty = count == 0;
    let border_width = if is_empty { EMPTY_BORDER_WIDTH } else { BORDER_WIDTH };
    let lit = match count {
        0 => to_float(EMPTY_DOT_COLOR),
        1 => base,
        _ => base.map(|channel| channel + (1.0 - channel) * BRIGHT_WHITE_SHARE),
    };
    let opacity = if is_empty { FADED_OPACITY } else { 1.0 };

    let mut halo = TRANSPARENT;
    if count >= 3 {
        let falloff = (1.0 - (distance - RADIUS).max(0.0) / HALO_WIDTH).clamp(0.0, 1.0);
        halo = [base[0], base[1], base[2], HALO_OPACITY * falloff * falloff];
    }

    let coverage = (RADIUS + 0.5 - distance).clamp(0.0, 1.0);
    let inside = (RADIUS - border_width + 0.5 - distance).clamp(0.0, 1.0);
    let border = [base[0], base[1], base[2], coverage * (1.0 - inside)];
    let fill = [lit[0], lit[1], lit[2], inside * opacity];
    over(fill, over(border, halo))
}

///////////////////////////////////////////////////////////////////////////////
// Sprites
///////////////////////////////////////////////////////////////////////////////

/// The frame of a sprite that is shown at `time` seconds: the walk plays in a loop, the stop shows the first frame.
fn frame_at(frames: &[Sprite], is_walking: bool, time: f32) -> Option<&Sprite> {
    if frames.is_empty() {
        return None;
    }
    let index = if is_walking { (time * WALK_FRAMES_PER_SECOND) as usize % frames.len() } else { 0 };
    frames.get(index)
}

/// The color of the pixel (`local_x`, `y`) of a sprite slot. The sprite stands in the middle of the height.
fn sprite_color(frames: &[Sprite], is_walking: bool, time: f32, local_x: u32, y: u32) -> Color {
    let Some(sprite) = frame_at(frames, is_walking, time) else {
        return TRANSPARENT;
    };
    let top = PICTURE_HEIGHT.saturating_sub(sprite.height) / 2;
    if local_x < SPRITE_MARGIN || y < top {
        return TRANSPARENT;
    }
    let (sprite_x, sprite_y) = (local_x - SPRITE_MARGIN, y - top);
    if sprite_x >= sprite.width || sprite_y >= sprite.height {
        return TRANSPARENT;
    }
    let offset = ((sprite_y * sprite.width + sprite_x) * 4) as usize;
    let byte = |channel: usize| sprite.pixels[offset + channel] as f32 / 255.0;
    [byte(0), byte(1), byte(2), byte(3)]
}

///////////////////////////////////////////////////////////////////////////////
// Picture
///////////////////////////////////////////////////////////////////////////////

/// True when the picture looks different from one frame to the next.
pub fn is_frame_animated(slots: &[Slot], is_alarm: bool) -> bool {
    is_alarm || is_animated(slots)
}

/// The red glow behind the whole picture, at the pixel (`x`, `y`) of a picture `width` pixels wide.
fn alarm_color(x: f32, y: f32, width: f32, time: f32) -> Color {
    let half_width = width / 2.0 - 1.0;
    let half_height = PICTURE_HEIGHT as f32 / 2.0 - 1.0;
    let to_corner_x = (x - width / 2.0).abs() - (half_width - ALARM_CORNER_RADIUS);
    let to_corner_y = (y - PICTURE_HEIGHT as f32 / 2.0).abs() - (half_height - ALARM_CORNER_RADIUS);
    let outside = (to_corner_x.max(0.0).powi(2) + to_corner_y.max(0.0).powi(2)).sqrt()
        + to_corner_x.max(to_corner_y).min(0.0)
        - ALARM_CORNER_RADIUS;
    let coverage = (0.5 - outside).clamp(0.0, 1.0);
    let pulse = 0.5 + 0.5 * (2.0 * PI * ALARM_FREQUENCY * time).sin();
    let color = to_float(BLOCKED_ALARM_COLOR);
    [color[0], color[1], color[2], coverage * (0.3 + 0.45 * pulse)]
}

/// Draws the whole picture: the slots with the empty space on the left and on the right. When `is_alarm` is true, a
/// red glow pulses behind everything, the empty space included. Returns the pixels as red, green, blue, alpha bytes,
/// row by row.
///
/// `time` is the time of the frame, in seconds. It moves the animations.
pub fn draw_frame(slots: &[Slot], is_alarm: bool, time: f32) -> Vec<u8> {
    let slots_pixels = draw_slots(slots, time);
    let width = picture_width(slots);
    let slots_row_bytes = (slots_width(slots) * 4) as usize;
    let padding_bytes = (PICTURE_PADDING * 4) as usize;
    let mut pixels = vec![0u8; (width * PICTURE_HEIGHT * 4) as usize];
    if slots_row_bytes > 0 {
        for (row, slots_row) in slots_pixels.chunks(slots_row_bytes).enumerate() {
            let start = row * (width * 4) as usize + padding_bytes;
            pixels[start..start + slots_row_bytes].copy_from_slice(slots_row);
        }
    }
    if is_alarm {
        for y in 0..PICTURE_HEIGHT {
            for x in 0..width {
                let offset = ((y * width + x) * 4) as usize;
                let drawn = [0, 1, 2, 3].map(|channel| pixels[offset + channel] as f32 / 255.0);
                let color = over(drawn, alarm_color(x as f32 + 0.5, y as f32 + 0.5, width as f32, time));
                for channel in 0..4 {
                    pixels[offset + channel] = (color[channel].clamp(0.0, 1.0) * 255.0).round() as u8;
                }
            }
        }
    }
    pixels
}

/// Draws the slots side by side, without the empty space and without the red glow, and returns the pixels as red,
/// green, blue, alpha bytes, row by row.
fn draw_slots(slots: &[Slot], time: f32) -> Vec<u8> {
    let width = slots_width(slots);
    let mut pixels = vec![0u8; (width * PICTURE_HEIGHT * 4) as usize];
    let center_y = PICTURE_HEIGHT as f32 / 2.0;
    let mut slot_left = 0;
    for slot in slots {
        let slot_width = slot.width();
        let center_x = slot_width as f32 / 2.0;
        let digits = match slot {
            Slot::Disc { count, .. } => Digits::of(*count),
            Slot::Sprite { .. } => None,
        };
        for y in 0..PICTURE_HEIGHT {
            for local_x in 0..slot_width {
                let dx = local_x as f32 + 0.5 - center_x;
                let dy = y as f32 + 0.5 - center_y;
                let mut color = match slot {
                    Slot::Disc { count, color } => disc_color(dx, dy, *color, *count),
                    Slot::Sprite { frames, is_walking } => sprite_color(frames, *is_walking, time, local_x, y),
                };
                if let Some(digits) = &digits {
                    if digits.contains(local_x as i32, y as i32 - 2) {
                        color = over([0.0, 0.0, 0.0, 0.45], color);
                    }
                    if digits.contains(local_x as i32, y as i32) {
                        color = [1.0, 1.0, 1.0, 1.0];
                    }
                }
                let x = slot_left + local_x;
                let offset = ((y * width + x) * 4) as usize;
                for channel in 0..4 {
                    pixels[offset + channel] = (color[channel].clamp(0.0, 1.0) * 255.0).round() as u8;
                }
            }
        }
        slot_left += slot_width;
    }
    pixels
}

///////////////////////////////////////////////////////////////////////////////
// Dots
///////////////////////////////////////////////////////////////////////////////

/// Width and height of the picture of a dot, in pixels. The library that shows the menu scales the picture of a menu
/// item to 18 points high. The disc is 36 pixels wide, so it is 9 points wide, and the empty space around it keeps the
/// dot small beside the text of the menu item.
pub const DOT_SIZE: u32 = 72;

/// Color of the thin circle that stands before a section without agent: gray, red, green, blue.
pub const EMPTY_DOT_COLOR: [u8; 3] = [142, 142, 147];

/// Width of the line of the thin circle of an empty section, in pixels.
const EMPTY_DOT_LINE_WIDTH: f32 = 3.0;

/// Draws the picture that stands before the text of a section without agent: a thin gray circle, transparent in the
/// middle, at the place and with the size of a dot. Returns the pixels as red, green, blue, alpha bytes, row by row,
/// `DOT_SIZE` pixels wide.
pub fn draw_empty_dot() -> Vec<u8> {
    let center = DOT_SIZE as f32 / 2.0;
    let base = to_float(EMPTY_DOT_COLOR);
    let mut pixels = vec![0u8; (DOT_SIZE * DOT_SIZE * 4) as usize];
    for y in 0..DOT_SIZE {
        for x in 0..DOT_SIZE {
            let (dx, dy) = (x as f32 + 0.5 - center, y as f32 + 0.5 - center);
            let distance = (dx * dx + dy * dy).sqrt();
            let outside = (RADIUS + 0.5 - distance).clamp(0.0, 1.0);
            let inside = (distance - (RADIUS - EMPTY_DOT_LINE_WIDTH) + 0.5).clamp(0.0, 1.0);
            let drawn = [base[0], base[1], base[2], outside * inside];
            let offset = ((y * DOT_SIZE + x) * 4) as usize;
            for channel in 0..4 {
                pixels[offset + channel] = (drawn[channel].clamp(0.0, 1.0) * 255.0).round() as u8;
            }
        }
    }
    pixels
}

/// Draws a dot for a menu item: the flat disc of a slot with one agent, without number, in the middle of a square
/// picture. Returns the pixels as red, green, blue, alpha bytes, row by row, `DOT_SIZE` pixels wide.
pub fn draw_dot(color: [u8; 3]) -> Vec<u8> {
    let center = DOT_SIZE as f32 / 2.0;
    let mut pixels = vec![0u8; (DOT_SIZE * DOT_SIZE * 4) as usize];
    for y in 0..DOT_SIZE {
        for x in 0..DOT_SIZE {
            let drawn = disc_color(x as f32 + 0.5 - center, y as f32 + 0.5 - center, color, 1);
            let offset = ((y * DOT_SIZE + x) * 4) as usize;
            for channel in 0..4 {
                pixels[offset + channel] = (drawn[channel].clamp(0.0, 1.0) * 255.0).round() as u8;
            }
        }
    }
    pixels
}

#[cfg(test)]
mod tests {
    use super::*;

    const RED: [u8; 3] = [235, 64, 52];
    const BLUE: [u8; 3] = [10, 132, 255];

    /// The row in the middle of the picture, where the centers of the discs are.
    const MIDDLE: u32 = PICTURE_HEIGHT / 2;

    /// The horizontal center of a slot, in pixels.
    const CENTER: u32 = SLOT_WIDTH / 2;

    fn disc(count: usize) -> Slot {
        Slot::Disc { count, color: RED }
    }

    fn pixel(pixels: &[u8], width: u32, x: u32, y: u32) -> [u8; 4] {
        let offset = ((y * width + x) * 4) as usize;
        [pixels[offset], pixels[offset + 1], pixels[offset + 2], pixels[offset + 3]]
    }

    fn brightness(color: [u8; 4]) -> u32 {
        color[0] as u32 + color[1] as u32 + color[2] as u32
    }

    #[test]
    fn a_dot_is_a_flat_disc_in_the_middle_of_a_transparent_square() {
        let pixels = draw_dot(RED);
        assert_eq!(pixels.len() as u32, DOT_SIZE * DOT_SIZE * 4);
        let middle = DOT_SIZE / 2;
        let center = pixel(&pixels, DOT_SIZE, middle, middle);
        assert_eq!(center[3], 255);
        assert!(center[0] > center[1] && center[0] > center[2], "the center is red: {center:?}");
        assert_eq!(pixel(&pixels, DOT_SIZE, 0, 0)[3], 0);
        assert_eq!(pixel(&pixels, DOT_SIZE, DOT_SIZE - 1, DOT_SIZE - 1)[3], 0);
    }

    #[test]
    fn the_empty_dot_is_a_thin_gray_circle_with_a_transparent_middle() {
        let pixels = draw_empty_dot();
        assert_eq!(pixels.len() as u32, DOT_SIZE * DOT_SIZE * 4);
        let middle = DOT_SIZE / 2;
        assert_eq!(pixel(&pixels, DOT_SIZE, middle, middle)[3], 0);
        assert_eq!(pixel(&pixels, DOT_SIZE, middle + 8, middle)[3], 0);
        let line = pixel(&pixels, DOT_SIZE, middle + 16, middle);
        assert_eq!(line, [EMPTY_DOT_COLOR[0], EMPTY_DOT_COLOR[1], EMPTY_DOT_COLOR[2], 255]);
        assert_eq!(pixel(&pixels, DOT_SIZE, middle + 19, middle)[3], 0);
        assert_eq!(pixel(&pixels, DOT_SIZE, 0, 0)[3], 0);
    }

    #[test]
    fn the_empty_dot_has_the_size_of_a_dot() {
        let outer = |pixels: &[u8]| {
            let middle = DOT_SIZE / 2;
            (0..DOT_SIZE).filter(|x| pixel(pixels, DOT_SIZE, *x, middle)[3] > 0).max()
        };
        assert_eq!(outer(&draw_empty_dot()), outer(&draw_dot(RED)));
    }

    #[test]
    fn dots_of_different_colors_look_different() {
        let middle = DOT_SIZE / 2;
        let red = pixel(&draw_dot(RED), DOT_SIZE, middle, middle);
        let blue = pixel(&draw_dot(BLUE), DOT_SIZE, middle, middle);
        assert!(red[0] > red[2]);
        assert!(blue[2] > blue[0]);
    }

    #[test]
    fn the_picture_is_as_wide_as_the_slots() {
        let slots = vec![disc(1), disc(2), disc(3)];
        assert_eq!(draw_slots(&slots, 0.0).len() as u32, SLOT_WIDTH * 3 * PICTURE_HEIGHT * 4);
    }

    #[test]
    fn a_disc_is_flat_with_the_normal_color_for_one_agent() {
        let pixels = draw_slots(&[disc(1)], 0.0);
        let top_left = pixel(&pixels, SLOT_WIDTH, CENTER - 12, MIDDLE - 8);
        let bottom_right = pixel(&pixels, SLOT_WIDTH, CENTER + 12, MIDDLE + 8);
        assert_eq!(top_left, [RED[0], RED[1], RED[2], 255]);
        assert_eq!(bottom_right, top_left);
    }

    #[test]
    fn the_corner_of_a_slot_is_transparent() {
        let pixels = draw_slots(&[disc(1)], 0.0);
        assert_eq!(pixel(&pixels, SLOT_WIDTH, 0, 0)[3], 0);
    }

    /// The pixel at the right of the center of the disc of `count` agents, away from the digits.
    fn disc_pixel(count: usize) -> [u8; 4] {
        pixel(&draw_slots(&[disc(count)], 0.0), SLOT_WIDTH, CENTER + 12, MIDDLE)
    }

    #[test]
    fn a_disc_without_agent_has_a_very_faded_color() {
        let faded = disc_pixel(0);
        assert_eq!(&faded[..3], &EMPTY_DOT_COLOR[..]);
        assert!(faded[3] > 0 && faded[3] < 100, "the disc is faded: {faded:?}");
    }

    #[test]
    fn the_empty_discs_of_every_status_have_the_same_gray_inside_and_their_own_color_on_the_border() {
        let green: [u8; 3] = [52, 199, 89];
        let blue: [u8; 3] = [10, 132, 255];
        let at = |color: [u8; 3], offset: u32| {
            let pixels = draw_slots(&[Slot::Disc { count: 0, color }], 0.0);
            pixel(&pixels, SLOT_WIDTH, CENTER + offset, MIDDLE)
        };
        assert_eq!(at(RED, 12), at(green, 12));
        assert_eq!(at(RED, 12), at(blue, 12));
        assert_eq!(&at(RED, 12)[..3], &EMPTY_DOT_COLOR[..]);
        assert_eq!(at(RED, 16), [RED[0], RED[1], RED[2], 255]);
        assert_eq!(at(green, 16), [green[0], green[1], green[2], 255]);
        assert_eq!(at(blue, 16), [blue[0], blue[1], blue[2], 255]);
    }

    #[test]
    fn the_border_of_an_empty_disc_is_thicker_than_the_border_of_a_disc_with_agents() {
        let inside_border = |count: usize| pixel(&draw_slots(&[disc(count)], 0.0), SLOT_WIDTH, CENTER + 15, MIDDLE);
        assert!(inside_border(0)[3] > 250 && inside_border(1)[3] > 250);
        assert_eq!(&inside_border(0)[..3], &RED[..]);
        assert_ne!(inside_border(1), [RED[0], RED[1], RED[2], 255]);
    }

    #[test]
    fn a_disc_with_two_agents_is_brighter_than_a_disc_with_one_agent() {
        let (one, two) = (disc_pixel(1), disc_pixel(2));
        assert_eq!(two[3], 255);
        assert!(brightness(two) > brightness(one) + 60, "one: {one:?}, two: {two:?}");
    }

    #[test]
    fn a_disc_with_three_agents_or_more_has_a_glow_and_the_color_of_two_agents() {
        let outside = |count: usize| {
            let pixels = draw_slots(&[disc(count)], 0.0);
            pixel(&pixels, SLOT_WIDTH, CENTER + 20, MIDDLE)
        };
        assert_eq!(outside(0)[3], 0);
        assert_eq!(outside(1)[3], 0);
        assert_eq!(outside(2)[3], 0);
        assert!(outside(3)[3] > 10);
        assert_eq!(disc_pixel(3), disc_pixel(2));
        assert_eq!(disc_pixel(9), disc_pixel(3));
    }

    #[test]
    fn a_disc_has_a_thin_border_in_its_normal_color_whatever_the_number_of_agents() {
        for count in [0, 1, 2, 3] {
            let pixels = draw_slots(&[disc(count)], 0.0);
            let border = pixel(&pixels, SLOT_WIDTH, CENTER + 16, MIDDLE);
            assert_eq!(border, [RED[0], RED[1], RED[2], 255], "the border of {count} agents");
        }
    }

    #[test]
    fn the_border_of_a_faded_disc_stands_out_from_its_inside() {
        let pixels = draw_slots(&[disc(0)], 0.0);
        let border = pixel(&pixels, SLOT_WIDTH, CENTER + 16, MIDDLE);
        let inside = pixel(&pixels, SLOT_WIDTH, CENTER + 12, MIDDLE);
        assert!(border[3] > 250);
        assert!(inside[3] < 100);
    }

    #[test]
    fn the_border_is_thin() {
        let pixels = draw_slots(&[disc(2)], 0.0);
        let border = pixel(&pixels, SLOT_WIDTH, CENTER + 16, MIDDLE);
        let inside = pixel(&pixels, SLOT_WIDTH, CENTER + 14, MIDDLE);
        assert!(brightness(inside) > brightness(border) + 60, "border: {border:?}, inside: {inside:?}");
    }

    #[test]
    fn a_disc_never_moves() {
        assert!(!is_animated(&[disc(0), disc(1), disc(2), disc(3)]));
    }

    #[test]
    fn the_number_is_drawn_in_white_in_the_middle_of_the_disc() {
        let pixels = draw_slots(&[disc(1)], 0.0);
        let digits = Digits::of(1).expect("one agent has a digit");
        let (x, y) = (0..SLOT_WIDTH as i32)
            .flat_map(|x| (0..PICTURE_HEIGHT as i32).map(move |y| (x, y)))
            .find(|(x, y)| digits.contains(*x, *y))
            .expect("the digit has at least one pixel");
        assert_eq!(pixel(&pixels, SLOT_WIDTH, x as u32, y as u32), [255, 255, 255, 255]);
    }

    #[test]
    fn a_number_above_99_is_drawn_as_99() {
        let large = Digits::of(250).expect("a digit");
        let ninety_nine = Digits::of(99).expect("a digit");
        assert_eq!(large.digits, ninety_nine.digits);
        assert!(Digits::of(0).is_none());
    }

    #[test]
    fn the_picture_moves_only_when_a_slot_moves() {
        let still = vec![disc(2), Slot::Sprite { frames: sprite_frames(), is_walking: false }];
        let walking = vec![Slot::Sprite { frames: sprite_frames(), is_walking: true }];
        assert!(!is_animated(&still));
        assert!(is_animated(&walking));
    }

    fn sprite_frames() -> &'static [Sprite] {
        let frame = |red: u8| Sprite { width: 4, height: 4, pixels: [red, 0, 0, 255].repeat(16) };
        Box::leak(vec![frame(10), frame(20), frame(30)].into_boxed_slice())
    }

    #[test]
    fn a_sprite_slot_is_as_wide_as_its_frames_plus_a_margin_on_each_side() {
        let sprite = Slot::Sprite { frames: sprite_frames(), is_walking: false };
        assert_eq!(sprite.width(), 4 + 2 * SPRITE_MARGIN);
        assert_eq!(slots_width(&[sprite, disc(1)]), 4 + 2 * SPRITE_MARGIN + SLOT_WIDTH);
    }

    #[test]
    fn the_slot_after_a_sprite_starts_where_the_sprite_slot_ends() {
        let sprite = Slot::Sprite { frames: sprite_frames(), is_walking: false };
        let sprite_width = sprite.width();
        let slots = [sprite, disc(1)];
        let pixels = draw_slots(&slots, 0.0);
        let width = slots_width(&slots);
        assert_eq!(pixels.len() as u32, width * PICTURE_HEIGHT * 4);
        assert_eq!(pixel(&pixels, width, sprite_width + 14, MIDDLE)[3], 255);
        assert_eq!(pixel(&pixels, width, sprite_width + 2, 0)[3], 0);
    }

    #[test]
    fn a_walking_sprite_plays_its_frames_and_a_stopped_sprite_shows_the_first_frame() {
        let red_at = |is_walking: bool, time: f32| {
            let slots = [Slot::Sprite { frames: sprite_frames(), is_walking }];
            let pixels = draw_slots(&slots, time);
            pixel(&pixels, slots_width(&slots), SPRITE_MARGIN, MIDDLE - 2)[0]
        };
        assert_eq!(red_at(true, 0.0), 10);
        assert_eq!(red_at(true, 0.13), 20);
        assert_eq!(red_at(true, 0.26), 30);
        assert_eq!(red_at(true, 0.4), 10);
        assert_eq!(red_at(false, 0.26), 10);
    }

    #[test]
    fn a_sprite_stands_in_the_middle_of_the_height_and_the_margins_are_transparent() {
        let slots = [Slot::Sprite { frames: sprite_frames(), is_walking: false }];
        let pixels = draw_slots(&slots, 0.0);
        let width = slots_width(&slots);
        assert_eq!(pixel(&pixels, width, SPRITE_MARGIN, MIDDLE - 3)[3], 0);
        assert_eq!(pixel(&pixels, width, SPRITE_MARGIN, MIDDLE - 2)[3], 255);
        assert_eq!(pixel(&pixels, width, SPRITE_MARGIN, MIDDLE + 1)[3], 255);
        assert_eq!(pixel(&pixels, width, SPRITE_MARGIN, MIDDLE + 2)[3], 0);
        assert_eq!(pixel(&pixels, width, 0, MIDDLE - 2)[3], 0);
    }

    #[test]
    fn only_a_walking_sprite_makes_the_picture_move() {
        assert!(is_animated(&[Slot::Sprite { frames: sprite_frames(), is_walking: true }]));
        assert!(!is_animated(&[Slot::Sprite { frames: sprite_frames(), is_walking: false }]));
        assert!(!is_animated(&[Slot::Sprite { frames: &[], is_walking: true }]));
    }

    #[test]
    fn a_sprite_slot_without_frame_is_empty() {
        let slot = Slot::Sprite { frames: &[], is_walking: true };
        assert_eq!(slot.width(), 0);
        assert!(draw_slots(&[slot], 0.0).is_empty());
    }

    #[test]
    fn the_alarm_puts_a_red_glow_behind_the_whole_picture_and_the_glow_pulses() {
        let slots = [Slot::Sprite { frames: sprite_frames(), is_walking: false }, disc(1)];
        let width = picture_width(&slots);
        let quiet = draw_frame(&slots, false, 0.0);
        let at_low = draw_frame(&slots, true, 0.0);
        let at_high = draw_frame(&slots, true, 0.21);
        let behind_sprite = |pixels: &[u8]| pixel(pixels, width, 1, MIDDLE);
        assert_eq!(behind_sprite(&quiet)[3], 0);
        assert!(behind_sprite(&at_low)[3] > 0);
        assert!(behind_sprite(&at_low)[0] > 200);
        assert!(behind_sprite(&at_high)[3] > behind_sprite(&at_low)[3] + 40);
    }

    #[test]
    fn the_alarm_keeps_the_corners_of_the_picture_round() {
        let slots = [disc(1), disc(1)];
        let width = picture_width(&slots);
        let pixels = draw_frame(&slots, true, 0.2);
        assert_eq!(pixel(&pixels, width, 0, 0)[3], 0);
        assert_eq!(pixel(&pixels, width, width - 1, PICTURE_HEIGHT - 1)[3], 0);
    }

    #[test]
    fn the_picture_has_empty_space_on_the_left_and_on_the_right_of_the_slots() {
        let slots = [disc(1), disc(1)];
        let width = picture_width(&slots);
        assert_eq!(width, 2 * SLOT_WIDTH + 2 * PICTURE_PADDING);
        let pixels = draw_frame(&slots, false, 0.0);
        assert_eq!(pixels.len() as u32, width * PICTURE_HEIGHT * 4);
        for x in (0..PICTURE_PADDING).chain(width - PICTURE_PADDING..width) {
            assert_eq!(pixel(&pixels, width, x, PICTURE_HEIGHT / 2)[3], 0);
        }
    }

    #[test]
    fn the_first_slot_starts_after_the_empty_space_and_keeps_its_pixels() {
        let slots = [disc(1)];
        let width = picture_width(&slots);
        let frame = draw_frame(&slots, false, 0.0);
        let content = draw_slots(&slots, 0.0);
        let slots_width = slots_width(&slots);
        for y in 0..PICTURE_HEIGHT {
            for x in 0..slots_width {
                assert_eq!(pixel(&frame, width, PICTURE_PADDING + x, y), pixel(&content, slots_width, x, y));
            }
        }
    }

    #[test]
    fn the_red_glow_also_covers_the_empty_space_on_the_left_and_on_the_right() {
        let slots = [disc(1)];
        let width = picture_width(&slots);
        let pixels = draw_frame(&slots, true, 0.0);
        assert!(pixel(&pixels, width, 2, PICTURE_HEIGHT / 2)[3] > 0);
        assert!(pixel(&pixels, width, width - 3, PICTURE_HEIGHT / 2)[3] > 0);
    }

    #[test]
    fn a_picture_without_slot_is_empty_space_only() {
        let width = picture_width(&[]);
        assert_eq!(width, 2 * PICTURE_PADDING);
        assert!(draw_frame(&[], false, 0.0).iter().all(|byte| *byte == 0));
    }

    #[test]
    fn the_alarm_makes_the_picture_move_even_when_no_slot_moves() {
        let still = [disc(0)];
        assert!(!is_frame_animated(&still, false));
        assert!(is_frame_animated(&still, true));
    }
}
