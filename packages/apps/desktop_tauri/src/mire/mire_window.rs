//! The separate Mire window: one Tauri window with the label `mire`, for a second screen. It loads the same web page
//! as the main window, with the query `window=mire`, so that `main.ts` starts only the Mire. Only one Mire window
//! exists at a time: a second request focuses the existing one. The window state plugin does not save this window, so
//! it always opens at a reasonable size on the screen of the main window.

use serde::Serialize;
use serde_json::json;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

/// The label of the separate Mire window.
pub const MIRE_WINDOW_LABEL: &str = "mire";
/// The label of the main window of Heidrun Code.
pub const MAIN_WINDOW_LABEL: &str = "main";
/// The page of the separate Mire window: the page of the main window, with the query that `main.ts` reads.
pub const MIRE_WINDOW_PAGE: &str = "index.html?window=mire";
/// The event that asks the main window to show one workspace, one tab, or one pane. Only the main window receives it.
pub const OPEN_IN_MAIN_WINDOW_EVENT: &str = "mire://open-in-main-window";
/// The kinds of target that the main window can show.
const OPEN_TARGET_KINDS: [&str; 3] = ["workspace", "tab", "pane"];
/// The title of the separate Mire window.
const MIRE_WINDOW_TITLE: &str = "Mire";
/// The size that the window takes when the screen has room for it, in logical pixels.
const PREFERRED_WIDTH: f64 = 1280.0;
const PREFERRED_HEIGHT: f64 = 820.0;
/// The smallest size of the window, in logical pixels.
const MINIMUM_WIDTH: f64 = 720.0;
const MINIMUM_HEIGHT: f64 = 480.0;
/// The largest part of the work area of the screen that the window takes at its opening.
const LARGEST_SCREEN_SHARE: f64 = 0.9;
/// The background of the window before the page draws, the same as the main window in `tauri.conf.json`.
const BACKGROUND_COLOR: tauri::window::Color = tauri::window::Color(11, 12, 14, 255);

/// A rectangle in logical pixels.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Frame {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// What `mire_window_open` did.
#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum MireWindowOpening {
    /// A new Mire window opened.
    Opened,
    /// The Mire window was already open: it now has the focus.
    Focused,
}

/// Gives the frame of the window at its opening: the preferred size, or at most 90 percent of the work area of the
/// screen, never smaller than the minimum size, centered in the work area.
pub fn frame_in_work_area(work_area: Frame) -> Frame {
    let width = PREFERRED_WIDTH
        .min(work_area.width * LARGEST_SCREEN_SHARE)
        .max(MINIMUM_WIDTH);
    let height = PREFERRED_HEIGHT
        .min(work_area.height * LARGEST_SCREEN_SHARE)
        .max(MINIMUM_HEIGHT);
    Frame {
        x: work_area.x + ((work_area.width - width) / 2.0).max(0.0),
        y: work_area.y + ((work_area.height - height) / 2.0).max(0.0),
        width,
        height,
    }
}

/// The work area of the screen that shows the main window, in logical pixels, or None when it is not known.
fn work_area_of_main_window(app: &AppHandle) -> Option<Frame> {
    let main_window = app.get_webview_window(MAIN_WINDOW_LABEL)?;
    let monitor = main_window.current_monitor().ok().flatten()?;
    let scale_factor = monitor.scale_factor();
    let area = monitor.work_area();
    Some(Frame {
        x: area.position.x as f64 / scale_factor,
        y: area.position.y as f64 / scale_factor,
        width: area.size.width as f64 / scale_factor,
        height: area.size.height as f64 / scale_factor,
    })
}

/// Opens the separate Mire window, or focuses it when it is already open. The command is asynchronous, because a
/// window built in a synchronous command can block the main thread.
#[tauri::command]
pub async fn mire_window_open(app: AppHandle) -> Result<MireWindowOpening, String> {
    if let Some(window) = app.get_webview_window(MIRE_WINDOW_LABEL) {
        let _ = window.unminimize();
        let _ = window.show();
        window
            .set_focus()
            .map_err(|error| format!("mire_window_focus_failed: {error}"))?;
        return Ok(MireWindowOpening::Focused);
    }
    let mut builder = WebviewWindowBuilder::new(
        &app,
        MIRE_WINDOW_LABEL,
        WebviewUrl::App(MIRE_WINDOW_PAGE.into()),
    )
    .title(MIRE_WINDOW_TITLE)
    .min_inner_size(MINIMUM_WIDTH, MINIMUM_HEIGHT)
    .background_color(BACKGROUND_COLOR)
    .focused(true);
    match work_area_of_main_window(&app) {
        Some(work_area) => {
            let frame = frame_in_work_area(work_area);
            builder = builder
                .inner_size(frame.width, frame.height)
                .position(frame.x, frame.y);
        }
        None => {
            builder = builder
                .inner_size(PREFERRED_WIDTH, PREFERRED_HEIGHT)
                .center();
        }
    }
    builder
        .build()
        .map_err(|error| format!("mire_window_open_failed: {error}"))?;
    Ok(MireWindowOpening::Opened)
}

/// Called by the separate Mire window: asks the main window to show one workspace, one tab, or one pane, and gives the
/// focus to the main window. The main window reads the Herdr session again before it selects the target, and says when
/// the target is gone.
#[tauri::command]
pub fn mire_open_in_main_window(app: AppHandle, kind: String, id: String) -> Result<(), String> {
    let payload = open_in_main_window_payload(&kind, &id)?;
    let main_window = app
        .get_webview_window(MAIN_WINDOW_LABEL)
        .ok_or_else(|| "main_window_missing".to_string())?;
    app.emit_to(MAIN_WINDOW_LABEL, OPEN_IN_MAIN_WINDOW_EVENT, payload)
        .map_err(|error| format!("mire_open_in_main_window_failed: {error}"))?;
    let _ = main_window.unminimize();
    let _ = main_window.show();
    let _ = main_window.set_focus();
    Ok(())
}

/// The payload of the event `mire://open-in-main-window`, or an error for an unknown kind of target.
fn open_in_main_window_payload(kind: &str, id: &str) -> Result<serde_json::Value, String> {
    if OPEN_TARGET_KINDS.contains(&kind) == false {
        return Err(format!("mire_open_target_kind_unknown: {kind}"));
    }
    Ok(json!({ "kind": kind, "id": id }))
}

/// Called for every window event: the Mire views of a closed window leave the collector, and the Mire window closes
/// with the main window, so that Heidrun Code never stays open with the Mire window alone.
pub fn on_window_destroyed(app: &AppHandle, label: &str) {
    super::collector::forget_window(label);
    if label == MAIN_WINDOW_LABEL {
        if let Some(window) = app.get_webview_window(MIRE_WINDOW_LABEL) {
            let _ = window.close();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    fn work_area(width: f64, height: f64) -> Frame {
        Frame {
            x: 0.0,
            y: 25.0,
            width,
            height,
        }
    }

    #[test]
    fn the_window_takes_the_preferred_size_centered_on_a_large_screen() {
        let frame = frame_in_work_area(work_area(2560.0, 1415.0));
        assert_eq!(frame.width, PREFERRED_WIDTH);
        assert_eq!(frame.height, PREFERRED_HEIGHT);
        assert_eq!(frame.x, (2560.0 - PREFERRED_WIDTH) / 2.0);
        assert_eq!(frame.y, 25.0 + (1415.0 - PREFERRED_HEIGHT) / 2.0);
    }

    #[test]
    fn the_window_takes_at_most_ninety_percent_of_a_small_screen() {
        let frame = frame_in_work_area(work_area(1280.0, 775.0));
        assert_eq!(frame.width, 1280.0 * 0.9);
        assert_eq!(frame.height, 775.0 * 0.9);
        assert!(frame.x > 0.0 && frame.x + frame.width < 1280.0);
    }

    #[test]
    fn the_window_never_gets_smaller_than_the_minimum_size_and_stays_on_the_screen() {
        let frame = frame_in_work_area(work_area(600.0, 400.0));
        assert_eq!(frame.width, MINIMUM_WIDTH);
        assert_eq!(frame.height, MINIMUM_HEIGHT);
        assert_eq!(frame.x, 0.0);
        assert_eq!(frame.y, 25.0);
    }

    #[test]
    fn the_window_opens_on_a_second_screen_placed_left_of_the_first() {
        let frame = frame_in_work_area(Frame {
            x: -1920.0,
            y: 0.0,
            width: 1920.0,
            height: 1055.0,
        });
        assert!(frame.x >= -1920.0 && frame.x + frame.width <= 0.0);
    }

    #[test]
    fn the_page_of_the_window_is_the_main_page_with_the_query_that_main_ts_reads() {
        assert_eq!(MIRE_WINDOW_LABEL, "mire");
        assert_eq!(MIRE_WINDOW_PAGE, "index.html?window=mire");
        let main_script = include_str!("../../../web_frontend/src/main.ts");
        assert!(
            main_script.contains("\"mire\""),
            "main.ts reads the query window=mire"
        );
    }

    #[test]
    fn the_request_to_open_names_the_kind_and_the_identifier_of_the_target() {
        assert_eq!(
            open_in_main_window_payload("pane", "w1:p3"),
            Ok(json!({ "kind": "pane", "id": "w1:p3" }))
        );
        assert_eq!(
            open_in_main_window_payload("tab", "w1:t2"),
            Ok(json!({ "kind": "tab", "id": "w1:t2" }))
        );
        assert_eq!(
            open_in_main_window_payload("workspace", "w1"),
            Ok(json!({ "kind": "workspace", "id": "w1" }))
        );
        assert!(open_in_main_window_payload("subagent", "a1").is_err());
        assert_eq!(OPEN_IN_MAIN_WINDOW_EVENT, "mire://open-in-main-window");
    }

    #[test]
    fn the_opening_result_is_written_in_snake_case() {
        assert_eq!(
            serde_json::to_value(MireWindowOpening::Opened).unwrap(),
            json!("opened")
        );
        assert_eq!(
            serde_json::to_value(MireWindowOpening::Focused).unwrap(),
            json!("focused")
        );
    }

    #[test]
    fn the_capability_of_the_mire_window_gives_only_the_permissions_that_the_window_needs() {
        let capability: Value =
            serde_json::from_str(include_str!("../../capabilities/mire_window.json")).unwrap();
        assert_eq!(capability["windows"], json!([MIRE_WINDOW_LABEL]));
        let mut permissions: Vec<String> = capability["permissions"]
            .as_array()
            .unwrap()
            .iter()
            .map(|permission| permission.as_str().unwrap().to_string())
            .collect();
        permissions.sort();
        assert_eq!(
            permissions,
            vec![
                "core:event:allow-listen",
                "core:event:allow-unlisten",
                "core:webview:allow-set-webview-zoom",
                "core:window:allow-close",
                "core:window:allow-is-fullscreen",
                "core:window:allow-set-fullscreen",
            ]
        );
    }

    #[test]
    fn the_main_capability_stays_for_the_main_window_only() {
        let capability: Value =
            serde_json::from_str(include_str!("../../capabilities/default.json")).unwrap();
        assert_eq!(capability["windows"], json!([MAIN_WINDOW_LABEL]));
    }
}
