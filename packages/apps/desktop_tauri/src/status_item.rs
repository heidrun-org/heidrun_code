//! The status item of Heidrun Code in the macOS menu bar: one wide picture with four slots, and a menu that opens on click.
//!
//! The slots, from left to right: the icon of Heidrun Code, blocked agents, finished agents, working agents. The
//! quota is not in the picture and not in the menu: the status bar of the Heidrun Code window shows it.
//! The web page sends the data with the command `status_item_update`. This module draws the picture, builds the
//! menu, and tells the web page which agent the user chose in the menu.

use crate::status_item_icon as icon;
use crate::status_item_picture::{self as picture, Slot, Sprite, PICTURE_HEIGHT};
use serde::Deserialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, MutexGuard};
use std::time::{Duration, Instant};
use tauri::image::Image;
use tauri::menu::{IconMenuItemBuilder, Menu, MenuBuilder, MenuItemBuilder};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager, State, Wry};

/// Identifier of the status item inside Tauri.
pub const STATUS_ITEM_ID: &str = "hd-status-item";

/// Name of the event that tells the web page which agent the user chose in the menu. The value is the pane identifier.
pub const SELECT_PANE_EVENT: &str = "status-item-select-pane";

/// Menu item that shows the main window.
const OPEN_MENU_ID: &str = "hd-status-open";

/// Start of the identifier of the menu item of an agent. The pane identifier follows.
const PANE_MENU_ID_PREFIX: &str = "hd-status-pane:";

/// Start of the identifier of the menu item of a section title. The position of the title in the menu follows.
const TITLE_MENU_ID_PREFIX: &str = "hd-status-title:";

/// Time between two pictures while a slot moves: twenty pictures per second.
const FRAME_INTERVAL: Duration = Duration::from_millis(50);

const BLOCKED_COLOR: [u8; 3] = [235, 64, 52];
const DONE_COLOR: [u8; 3] = [52, 199, 89];
const WORKING_COLOR: [u8; 3] = [191, 90, 242];

///////////////////////////////////////////////////////////////////////////////
// Data from the web page
///////////////////////////////////////////////////////////////////////////////

/// One agent in the menu.
#[derive(Deserialize, Clone, Default, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StatusAgent {
    /// Identifier of the pane of the agent.
    pub pane_id: String,
    /// Name shown in the menu.
    pub name: String,
}

/// The agents of one status, with the title of the section of the menu.
#[derive(Deserialize, Clone, Default, Debug, PartialEq)]
#[serde(default)]
pub struct StatusSection {
    /// Title of the section, already translated, with the number of agents.
    pub title: String,
    /// The agents of the section.
    pub agents: Vec<StatusAgent>,
}

/// Everything the status item shows.
#[derive(Deserialize, Clone, Default, Debug, PartialEq)]
#[serde(default, rename_all = "camelCase")]
pub struct StatusItemPayload {
    /// Agents that wait for an answer.
    pub blocked: StatusSection,
    /// Agents that finished their work.
    pub done: StatusSection,
    /// Agents that work now.
    pub working: StatusSection,
    /// Text of the menu item that shows the main window, already translated.
    pub open_label: String,
    /// Text of a section without agent, already translated.
    pub empty_label: String,
    /// True when an agent stays blocked for longer than the limit: a red glow pulses behind the whole picture.
    pub is_urgent: bool,
}

/// Name of the environment variable that makes the status item show fake agents, to look at the animations.
const DEMO_VARIABLE: &str = "HEIDRUN_CODE_STATUS_ITEM_DEMO";

/// Name of the environment variable that makes the icon of Heidrun Code fade while the user is not active in front of
/// Heidrun Code. It shows by eye that the detection of the activity of the user works.
const USER_ACTIVITY_VARIABLE: &str = "HEIDRUN_CODE_STATUS_ITEM_USER_ACTIVITY";

/// The data that the status item shows now, and the time of its creation, which gives the time of each picture.
pub struct StatusItemState {
    payload: Mutex<StatusItemPayload>,
    started: Instant,
    /// True when the environment variable `HEIDRUN_CODE_STATUS_ITEM_DEMO` is set: the data of the web page is ignored.
    is_demo: bool,
    /// True when the environment variable `HEIDRUN_CODE_STATUS_ITEM_USER_ACTIVITY` is set: the icon of Heidrun Code is faded
    /// while the user is not active in front of Heidrun Code.
    is_user_activity_shown: bool,
    /// True while the user is active in front of Heidrun Code. The web page sends it with `status_item_set_user_active`.
    is_user_active: AtomicBool,
}

impl Default for StatusItemState {
    fn default() -> Self {
        let is_demo = std::env::var_os(DEMO_VARIABLE).is_some();
        let payload = if is_demo { demo_payload() } else { StatusItemPayload::default() };
        StatusItemState {
            payload: Mutex::new(payload),
            started: Instant::now(),
            is_demo,
            is_user_activity_shown: std::env::var_os(USER_ACTIVITY_VARIABLE).is_some(),
            is_user_active: AtomicBool::new(false),
        }
    }
}

/// Fake agents for the demo: two blocked, one finished, and three working.
fn demo_payload() -> StatusItemPayload {
    let section = |title: &str, count: usize| StatusSection {
        title: title.to_string(),
        agents: (1..=count)
            .map(|number| StatusAgent { pane_id: format!("demo-{title}-{number}"), name: format!("Demo · agent {number}") })
            .collect(),
    };
    StatusItemPayload {
        blocked: section("Blocked", 2),
        done: section("Finished", 1),
        working: section("Working", 3),
        open_label: "Open Heidrun Code".to_string(),
        empty_label: "No agent".to_string(),
        is_urgent: true,
    }
}

impl StatusItemState {
    fn lock(&self) -> MutexGuard<'_, StatusItemPayload> {
        self.payload.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    /// True when the icon of Heidrun Code must be drawn faded: the environment variable is set and the user is not active.
    fn is_icon_faded(&self) -> bool {
        self.is_user_activity_shown && !self.is_user_active.load(Ordering::Relaxed)
    }
}

///////////////////////////////////////////////////////////////////////////////
// Picture
///////////////////////////////////////////////////////////////////////////////

/// The slots for the data of the web page: the icon of Heidrun Code, then blocked, finished, and working. The quota is not
/// in the picture: the status bar of the Heidrun Code window shows it. The icon of Heidrun Code
/// does not move.
pub fn slots_for(payload: &StatusItemPayload) -> Vec<Slot> {
    slots_with_icon(payload, icon::frames())
}

/// The slots of `slots_for`, with `icon` as the frames of the icon of Heidrun Code: the normal icon or the faded icon.
fn slots_with_icon(payload: &StatusItemPayload, icon: &'static [Sprite]) -> Vec<Slot> {
    let mut slots = Vec::new();
    if !icon.is_empty() {
        slots.push(Slot::Sprite { frames: icon, is_walking: false });
    }
    slots.push(Slot::Disc { count: payload.blocked.agents.len(), color: BLOCKED_COLOR });
    slots.push(Slot::Disc { count: payload.done.agents.len(), color: DONE_COLOR });
    slots.push(Slot::Disc { count: payload.working.agents.len(), color: WORKING_COLOR });
    slots
}

/// Draws the picture of the status item for the data of the web page, at `time` seconds after the start. The icon of
/// Heidrun Code is faded when `is_icon_faded` is true.
fn draw(payload: &StatusItemPayload, is_icon_faded: bool, time: f32) -> Image<'static> {
    let icon = if is_icon_faded { icon::faded_frames() } else { icon::frames() };
    let slots = slots_with_icon(payload, icon);
    Image::new_owned(picture::draw_frame(&slots, payload.is_urgent, time), picture::picture_width(&slots), PICTURE_HEIGHT)
}

/// True when the picture for the data of the web page looks different from one frame to the next.
fn is_animated(payload: &StatusItemPayload) -> bool {
    picture::is_frame_animated(&slots_for(payload), payload.is_urgent)
}

/// Draws the picture again and gives it to the status item.
fn redraw(app: &AppHandle) {
    let state = app.state::<StatusItemState>();
    let image = draw(&state.lock(), state.is_icon_faded(), state.started.elapsed().as_secs_f32());
    if let Some(tray) = app.tray_by_id(STATUS_ITEM_ID) {
        let _ = tray.set_icon(Some(image));
    }
}

///////////////////////////////////////////////////////////////////////////////
// Menu
///////////////////////////////////////////////////////////////////////////////

/// The identifier of the menu item of the agent in the pane `pane_id`.
fn pane_menu_id(pane_id: &str) -> String {
    format!("{PANE_MENU_ID_PREFIX}{pane_id}")
}

/// The pane identifier inside the identifier of a menu item, or `None` when the item is not an agent.
fn pane_id_from_menu_id(menu_id: &str) -> Option<&str> {
    menu_id.strip_prefix(PANE_MENU_ID_PREFIX)
}

/// The identifier of the menu item of a section title, at the place `position` in the menu, from the top, with the
/// separators counted.
fn title_menu_id(position: usize) -> String {
    format!("{TITLE_MENU_ID_PREFIX}{position}")
}

/// True when the identifier of a menu item is the identifier of a section title.
fn is_title_menu_id(menu_id: &str) -> bool {
    menu_id.starts_with(TITLE_MENU_ID_PREFIX)
}

/// The three sections of the menu, from top to bottom, each with the color of the dots of its agents. The colors are
/// the colors of the discs of the picture.
fn sections_with_colors(payload: &StatusItemPayload) -> [(&StatusSection, [u8; 3]); 3] {
    [(&payload.blocked, BLOCKED_COLOR), (&payload.done, DONE_COLOR), (&payload.working, WORKING_COLOR)]
}

/// The picture of the dot that the menu shows before the name of an agent, in `color`.
fn dot_image(color: [u8; 3]) -> Image<'static> {
    Image::new_owned(picture::draw_dot(color), picture::DOT_SIZE, picture::DOT_SIZE)
}

/// The picture of the thin gray circle that the menu shows before the text of a section without agent.
fn empty_dot_image() -> Image<'static> {
    Image::new_owned(picture::draw_empty_dot(), picture::DOT_SIZE, picture::DOT_SIZE)
}

/// One line of the menu of the status item.
#[derive(Debug, PartialEq)]
enum MenuLine {
    /// The item that shows the main window. The text is already translated.
    Open(String),
    /// A line between two groups of lines.
    Separator,
    /// The title of a section, already translated, with the number of agents. The item is enabled, so that macOS draws
    /// it in normal black.
    Title(String),
    /// The text of a section without agent, already translated, with a thin gray circle before it so that the line is
    /// indented like the lines of the agents.
    Empty(String),
    /// An agent, with the dot in the color of its section.
    Agent {
        /// Identifier of the pane of the agent.
        pane_id: String,
        /// Name shown in the menu.
        name: String,
        /// Color of the dot.
        color: [u8; 3],
    },
}

/// The lines of the menu that opens on a click, from top to bottom: the item that shows the main window and a
/// separator, then one section per status. The menu ends with the last line of the Working section, never with a
/// separator.
fn menu_lines(payload: &StatusItemPayload) -> Vec<MenuLine> {
    let mut lines = vec![MenuLine::Open(payload.open_label.clone()), MenuLine::Separator];
    let sections = sections_with_colors(payload);
    for (index, (section, color)) in sections.iter().enumerate() {
        lines.push(MenuLine::Title(section.title.clone()));
        if section.agents.is_empty() {
            lines.push(MenuLine::Empty(payload.empty_label.clone()));
        }
        for agent in &section.agents {
            lines.push(MenuLine::Agent { pane_id: agent.pane_id.clone(), name: agent.name.clone(), color: *color });
        }
        let is_last_section = index + 1 == sections.len();
        if !is_last_section {
            lines.push(MenuLine::Separator);
        }
    }
    lines
}

/// The menu that opens on a click, built from `menu_lines`. Each agent has a dot in the color of its section.
///
/// macOS draws a disabled menu item in gray, whatever color its text has. The section titles are enabled, so that
/// they show the normal black text of the other lines. Only the lines "None" are disabled, and gray.
fn build_menu(app: &AppHandle, payload: &StatusItemPayload) -> tauri::Result<Menu<Wry>> {
    let mut builder = MenuBuilder::new(app);
    for (position, line) in menu_lines(payload).into_iter().enumerate() {
        builder = match line {
            MenuLine::Open(text) => builder.item(&MenuItemBuilder::with_id(OPEN_MENU_ID, text).build(app)?),
            MenuLine::Separator => builder.separator(),
            MenuLine::Title(text) => {
                builder.item(&MenuItemBuilder::with_id(title_menu_id(position), text).build(app)?)
            }
            MenuLine::Empty(text) => {
                let item = IconMenuItemBuilder::new(text).icon(empty_dot_image()).enabled(false);
                builder.item(&item.build(app)?)
            }
            MenuLine::Agent { pane_id, name, color } => {
                let item = IconMenuItemBuilder::with_id(pane_menu_id(&pane_id), name).icon(dot_image(color));
                builder.item(&item.build(app)?)
            }
        };
    }
    builder.build()
}

/// Shows the main window and gives it the keyboard focus.
fn focus_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// The user chose an item of the menu: the main window comes forward. The web page selects the agent of an agent line.
/// A section title only brings the main window forward.
fn handle_menu_event(app: &AppHandle, menu_id: &str) {
    if menu_id == OPEN_MENU_ID || is_title_menu_id(menu_id) {
        focus_main_window(app);
    } else if let Some(pane_id) = pane_id_from_menu_id(menu_id) {
        focus_main_window(app);
        let _ = app.emit(SELECT_PANE_EVENT, pane_id);
    }
}

///////////////////////////////////////////////////////////////////////////////
// Status item
///////////////////////////////////////////////////////////////////////////////

/// Creates the status item in the menu bar and starts the timer that moves the picture.
pub fn create(app: &AppHandle) -> tauri::Result<()> {
    let state = app.state::<StatusItemState>();
    let mut payload = state.lock().clone();
    if crate::application_profile::is_development() {
        payload.open_label = "Open Heidrun Code Development".into();
        *state.lock() = payload.clone();
    }
    TrayIconBuilder::with_id(STATUS_ITEM_ID)
        .icon(draw(&payload, state.is_icon_faded(), 0.0))
        .icon_as_template(false)
        .tooltip(crate::application_profile::name())
        .menu(&build_menu(app, &payload)?)
        .on_menu_event(|app, event| handle_menu_event(app, event.id().as_ref()))
        .build(app)?;

    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval(FRAME_INTERVAL);
        loop {
            interval.tick().await;
            if is_animated(&handle.state::<StatusItemState>().lock()) {
                redraw(&handle);
            }
        }
    });
    Ok(())
}

/// Called by the web page each time the agents change.
#[tauri::command]
pub fn status_item_update(
    app: AppHandle,
    state: State<StatusItemState>,
    payload: StatusItemPayload,
) -> Result<(), String> {
    if state.is_demo {
        return Ok(());
    }
    let mut payload = payload;
    if crate::application_profile::is_development() {
        payload.open_label = "Open Heidrun Code Development".into();
    }
    let menu = build_menu(&app, &payload).map_err(|error| error.to_string())?;
    *state.lock() = payload;
    if let Some(tray) = app.tray_by_id(STATUS_ITEM_ID) {
        tray.set_menu(Some(menu)).map_err(|error| error.to_string())?;
    }
    redraw(&app);
    Ok(())
}

/// Called by the web page each time the user starts or stops to be active in front of Heidrun Code. The menu does not change.
#[tauri::command]
pub fn status_item_set_user_active(app: AppHandle, state: State<StatusItemState>, is_active: bool) {
    state.is_user_active.store(is_active, Ordering::Relaxed);
    redraw(&app);
}

/// Called by the web page when the user shows or hides the status item in the menu bar.
#[tauri::command]
pub fn status_item_set_visible(app: AppHandle, is_visible: bool) -> Result<(), String> {
    match app.tray_by_id(STATUS_ITEM_ID) {
        Some(tray) => tray.set_visible(is_visible).map_err(|error| error.to_string()),
        None => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn agent(pane_id: &str) -> StatusAgent {
        StatusAgent { pane_id: pane_id.to_string(), name: format!("name of {pane_id}") }
    }

    #[test]
    fn the_web_page_data_is_read_from_json() {
        let json = r#"{
            "blocked": { "title": "Blocked (1)", "agents": [{ "paneId": "p1", "name": "api · fix" }] },
            "done": { "title": "Finished (0)", "agents": [] },
            "working": { "title": "Working (0)", "agents": [] },
            "openLabel": "Open Heidrun Code",
            "emptyLabel": "No agent"
        }"#;
        let payload: StatusItemPayload = serde_json::from_str(json).expect("the data is valid");
        assert_eq!(payload.blocked.agents, vec![StatusAgent { pane_id: "p1".into(), name: "api · fix".into() }]);
        assert_eq!(payload.open_label, "Open Heidrun Code");
    }

    #[test]
    fn the_urgent_flag_is_read_from_json_and_makes_the_picture_move() {
        let urgent: StatusItemPayload = serde_json::from_str(r#"{ "isUrgent": true }"#).expect("the data is valid");
        assert!(urgent.is_urgent);
        assert!(is_animated(&urgent));
        assert!(!is_animated(&StatusItemPayload::default()));
    }

    #[test]
    fn old_data_with_quotas_is_still_read_and_the_quotas_are_ignored() {
        let json = r#"{ "quotas": [{ "label": "Claude", "percent": 35.0, "level": "ok", "text": "Claude quota" }] }"#;
        let payload: StatusItemPayload = serde_json::from_str(json).expect("the data is valid");
        assert_eq!(payload, StatusItemPayload::default());
    }

    #[test]
    fn the_dots_of_the_menu_have_the_color_of_the_section_of_the_agent() {
        let section = |title: &str| StatusSection { title: title.to_string(), agents: vec![agent(title)] };
        let payload = StatusItemPayload {
            blocked: section("blocked"),
            done: section("done"),
            working: section("working"),
            ..StatusItemPayload::default()
        };
        let colors: Vec<(&str, [u8; 3])> = sections_with_colors(&payload)
            .iter()
            .map(|(section, color)| (section.title.as_str(), *color))
            .collect();
        assert_eq!(colors, vec![("blocked", BLOCKED_COLOR), ("done", DONE_COLOR), ("working", WORKING_COLOR)]);
    }

    #[test]
    fn the_dot_of_the_menu_is_a_square_picture() {
        let image = dot_image(DONE_COLOR);
        assert_eq!((image.width(), image.height()), (picture::DOT_SIZE, picture::DOT_SIZE));
        assert_eq!(image.rgba().len() as u32, picture::DOT_SIZE * picture::DOT_SIZE * 4);
    }

    #[test]
    fn the_slots_show_the_number_of_agents_of_each_status() {
        let payload = StatusItemPayload {
            blocked: StatusSection { title: String::new(), agents: vec![agent("p1"), agent("p2")] },
            done: StatusSection { title: String::new(), agents: vec![agent("p3")] },
            ..StatusItemPayload::default()
        };
        let counts: Vec<Option<usize>> = slots_for(&payload)
            .iter()
            .map(|slot| match slot {
                Slot::Disc { count, .. } => Some(*count),
                Slot::Sprite { .. } => None,
            })
            .collect();
        assert_eq!(counts, vec![None, Some(2), Some(1), Some(0)]);
    }

    #[test]
    fn the_blocked_finished_and_working_discs_are_red_green_and_violet() {
        let colors: Vec<[u8; 3]> = slots_for(&StatusItemPayload::default())
            .iter()
            .filter_map(|slot| match slot {
                Slot::Disc { color, .. } => Some(*color),
                _ => None,
            })
            .collect();
        assert_eq!(colors, vec![[235, 64, 52], [52, 199, 89], [191, 90, 242]]);
    }

    fn state_with(is_user_activity_shown: bool, is_user_active: bool) -> StatusItemState {
        StatusItemState {
            payload: Mutex::new(StatusItemPayload::default()),
            started: Instant::now(),
            is_demo: false,
            is_user_activity_shown,
            is_user_active: AtomicBool::new(is_user_active),
        }
    }

    #[test]
    fn the_icon_is_faded_only_when_the_variable_is_set_and_the_user_is_not_active() {
        assert!(state_with(true, false).is_icon_faded());
        assert!(!state_with(true, true).is_icon_faded());
        assert!(!state_with(false, false).is_icon_faded());
        assert!(!state_with(false, true).is_icon_faded());
    }

    #[test]
    fn the_faded_icon_is_more_transparent_than_the_normal_icon() {
        let alpha = |slots: Vec<Slot>| match slots.first() {
            Some(Slot::Sprite { frames, .. }) => frames[0].pixels.chunks(4).map(|pixel| pixel[3]).max(),
            _ => None,
        };
        let normal = alpha(slots_for(&StatusItemPayload::default()));
        let faded = alpha(slots_with_icon(&StatusItemPayload::default(), icon::faded_frames()));
        assert_eq!(normal, Some(255));
        assert!(faded < Some(255));
    }

    #[test]
    fn the_faded_icon_has_the_same_width_as_the_icon_so_the_picture_does_not_jump() {
        let payload = StatusItemPayload::default();
        let normal = picture::picture_width(&slots_for(&payload));
        let faded = picture::picture_width(&slots_with_icon(&payload, icon::faded_frames()));
        assert_eq!(normal, faded);
    }

    #[test]
    fn nothing_moves_when_no_agent_runs() {
        assert!(!picture::is_animated(&slots_for(&StatusItemPayload::default())));
    }

    #[test]
    fn a_finished_agent_does_not_make_the_picture_move() {
        let section = StatusSection { title: String::new(), agents: vec![agent("p1")] };
        let finished = StatusItemPayload { done: section, ..StatusItemPayload::default() };
        assert!(!picture::is_animated(&slots_for(&finished)));
    }

    #[test]
    fn the_first_slot_is_the_icon_of_heidrun_and_it_does_not_move_while_an_agent_works() {
        let section = StatusSection { title: String::new(), agents: vec![agent("p1")] };
        let working = StatusItemPayload { working: section, ..StatusItemPayload::default() };
        match slots_for(&working).first() {
            Some(Slot::Sprite { frames, is_walking }) => {
                assert_eq!(frames.len(), 1);
                assert!(!is_walking);
            }
            _ => panic!("the first slot is the icon of Heidrun Code"),
        }
        assert!(!picture::is_animated(&slots_for(&working)));
    }

    #[test]
    fn the_demo_has_blocked_agents_and_makes_the_picture_move() {
        let payload = demo_payload();
        assert_eq!(payload.blocked.agents.len(), 2);
        assert!(is_animated(&payload));
    }

    #[test]
    fn a_blocked_agent_alone_does_not_make_the_picture_move() {
        let payload = StatusItemPayload {
            blocked: StatusSection { title: String::new(), agents: vec![agent("p1")] },
            ..StatusItemPayload::default()
        };
        assert!(!picture::is_animated(&slots_for(&payload)));
    }

    #[test]
    fn the_menu_starts_with_the_item_that_opens_heidrun_and_a_separator() {
        let payload = StatusItemPayload { open_label: "Open Heidrun Code".into(), ..demo_payload() };
        let lines = menu_lines(&payload);
        assert_eq!(lines[0], MenuLine::Open("Open Heidrun Code".into()));
        assert_eq!(lines[1], MenuLine::Separator);
        assert!(matches!(lines[2], MenuLine::Title(_)));
        let open_count = lines.iter().filter(|line| matches!(line, MenuLine::Open(_))).count();
        assert_eq!(open_count, 1);
    }

    #[test]
    fn the_menu_has_no_separator_at_its_end() {
        assert_ne!(menu_lines(&StatusItemPayload::default()).last(), Some(&MenuLine::Separator));
        assert_ne!(menu_lines(&demo_payload()).last(), Some(&MenuLine::Separator));
    }

    #[test]
    fn a_separator_stands_between_two_sections() {
        let separators = |payload: &StatusItemPayload| {
            menu_lines(payload).iter().filter(|line| **line == MenuLine::Separator).count()
        };
        assert_eq!(separators(&StatusItemPayload::default()), 3);
        assert_eq!(separators(&demo_payload()), 3);
    }

    #[test]
    fn each_agent_line_has_the_color_of_its_section() {
        let section = |name: &str| StatusSection { title: name.to_string(), agents: vec![agent(name)] };
        let payload = StatusItemPayload {
            blocked: section("blocked"),
            done: section("done"),
            working: section("working"),
            ..StatusItemPayload::default()
        };
        let colors: Vec<[u8; 3]> = menu_lines(&payload)
            .into_iter()
            .filter_map(|line| match line {
                MenuLine::Agent { color, .. } => Some(color),
                _ => None,
            })
            .collect();
        assert_eq!(colors, vec![BLOCKED_COLOR, DONE_COLOR, WORKING_COLOR]);
    }

    #[test]
    fn a_section_without_agent_shows_the_empty_text() {
        let payload = StatusItemPayload { empty_label: "No agent".into(), ..StatusItemPayload::default() };
        let lines = menu_lines(&payload);
        assert_eq!(lines.iter().filter(|line| **line == MenuLine::Empty("No agent".into())).count(), 3);
    }

    #[test]
    fn the_menu_has_no_quota_line_and_ends_with_the_last_line_of_the_working_section() {
        let lines = menu_lines(&demo_payload());
        let last_working_agent = demo_payload().working.agents.last().cloned().expect("the demo has working agents");
        assert_eq!(
            lines.last(),
            Some(&MenuLine::Agent { pane_id: last_working_agent.pane_id, name: last_working_agent.name, color: WORKING_COLOR })
        );
        let empty = StatusItemPayload { empty_label: "No agent".into(), ..StatusItemPayload::default() };
        assert_eq!(menu_lines(&empty).last(), Some(&MenuLine::Empty("No agent".into())));
    }

    #[test]
    fn the_menu_item_of_a_title_has_its_own_kind_of_identifier() {
        let id = title_menu_id(4);
        assert!(is_title_menu_id(&id));
        assert_ne!(id, title_menu_id(5));
        assert_eq!(pane_id_from_menu_id(&id), None);
        assert!(!is_title_menu_id(OPEN_MENU_ID));
        assert!(!is_title_menu_id(&pane_menu_id("w1-p2")));
    }

    #[test]
    fn the_menu_item_of_an_agent_gives_back_its_pane_identifier() {
        assert_eq!(pane_id_from_menu_id(&pane_menu_id("w1-p2")), Some("w1-p2"));
        assert_eq!(pane_id_from_menu_id(OPEN_MENU_ID), None);
    }
}
