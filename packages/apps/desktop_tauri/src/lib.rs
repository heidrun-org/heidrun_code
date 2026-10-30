mod app_data;
mod application_log;
mod application_profile;
mod build_settings;
mod antigravity;
mod chat_images;
mod claude;
mod clipboard;
mod coding_agent_models;
mod durable_storage;
mod environment_file;
mod file_watch;
mod files;
mod forge_cache;
mod former_web_view_storage;
mod git;
mod git_source_control;
mod history;
mod html_preview;
mod image_preview;
mod legacy;
mod login_shell_path;
mod herdr;
mod macros;
mod mire;
mod mobile;
mod past_chats;
mod project;
mod pty;
mod required_programs;
mod skills;
mod statistics;
mod status_item;
mod status_item_icon;
mod status_item_picture;
mod system_sound;
mod topic_clusters;
mod usage;
mod user_activity;
mod user_launchers;
mod voice_commands;
mod voice_words;
mod worktree_actions;
mod workspace_folders;

/// Tests that read or change the environment variable `HOME` take this lock, because the variable belongs to the whole process.
#[cfg(test)]
pub(crate) static HOME_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

use serde_json::{json, Value};
use tauri::menu::{Menu, MenuBuilder, SubmenuBuilder};
use tauri::{AppHandle, State};

/// Generic socket call: the frontend passes the raw method and params.
#[tauri::command]
async fn herdr_request(method: String, params: Option<Value>) -> Result<Value, String> {
    herdr::request(&method, params.unwrap_or_else(|| json!({}))).await
}

/// Runs the herdr CLI (used for `pane run`, which handles bracketed paste for us), in the session that Heidrun Code uses.
#[tauri::command]
async fn herdr_cli(args: Vec<String>) -> Result<String, String> {
    let out = tokio::process::Command::new(herdr::herdr_bin())
        .args(herdr::command_arguments_from(&args))
        .output()
        .await
        .map_err(|e| format!("herdr_cli_failed: {e}"))?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).into_owned())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
    }
}

#[tauri::command]
fn herdr_watch_panes(app: AppHandle, watcher: State<'_, herdr::StatusWatcher>, pane_ids: Vec<String>) {
    watcher.watch(app, pane_ids);
}

/// Starts the Herdr server in the background, without any terminal window.
/// It goes through the login shell so panes get the same PATH as in Terminal
/// (an app opened from the Finder only has a minimal one).
#[tauri::command]
async fn herdr_server_start() -> Result<String, String> {
    if herdr::request("ping", json!({})).await.is_ok() {
        return Ok("already_running".into());
    }
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".into());
    let mut cmd = std::process::Command::new(shell);
    let mut server_command = herdr::server_shell_command(&herdr::herdr_bin());
    if let Some(user_bin_folder) = skills::bundled::user_bin_folder() {
        cmd.env("HEIDRUN_CODE_USER_BIN", user_bin_folder);
        server_command = format!("export PATH=\"$HEIDRUN_CODE_USER_BIN:$PATH\"; {server_command}");
    }
    cmd.arg("-lc")
        .arg(server_command)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());
    if let Some(home) = dirs::home_dir() {
        cmd.current_dir(home);
    }
    // Every pane inherits the environment of the server. Without this, a coding agent in a pane connects to Visual
    // Studio Code when the developer started Heidrun Code from the terminal of Visual Studio Code.
    herdr::remove_editor_variables(&mut cmd);
    #[cfg(unix)]
    {
        // Own process group: the server is not stopped by a signal sent to Heidrun Code. Heidrun Code stops the server itself
        // when the user quits, unless the user chose "Keep agents running after quit".
        use std::os::unix::process::CommandExt;
        cmd.process_group(0);
    }
    cmd.spawn().map_err(|e| format!("herdr_start_failed: {e}"))?;
    for _ in 0..50 {
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        if herdr::request("ping", json!({})).await.is_ok() {
            return Ok("started".into());
        }
    }
    Err("herdr_start_timeout: le serveur Herdr n’a pas répondu en 5 s".into())
}

#[tauri::command]
fn herdr_paths() -> Value {
    let socket = herdr::socket_path();
    let bin = herdr::herdr_bin();
    json!({
        "socket": socket.display().to_string(),
        "socket_exists": socket.exists(),
        "bin": bin.display().to_string(),
        "bin_exists": bin.exists(),
    })
}

/// True when the first preferred language of the Mac is French.
fn is_system_language_french() -> bool {
    let output = std::process::Command::new("defaults").args(["read", "-g", "AppleLanguages"]).output();
    let Ok(output) = output else {
        return false;
    };
    let text = String::from_utf8_lossy(&output.stdout);
    let first_language = text.lines().find(|line| line.contains('"') || line.trim().starts_with(|c: char| c.is_alphabetic()));
    match first_language {
        Some(line) => line.trim().trim_start_matches('"').starts_with("fr"),
        None => false,
    }
}

/// Custom menu: the default macOS menu binds ⌘W to "Close Window", which would
/// close the app instead of reaching our "close pane" shortcut.
fn build_menu(app: &AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let is_french = is_system_language_french();
    let about_label = if is_french { "À propos de Heidrun Code" } else { "About Heidrun Code" };
    let quit_label = if is_french { "Quitter Heidrun Code" } else { "Quit Heidrun Code" };
    let edit_label = if is_french { "Édition" } else { "Edit" };
    let window_label = if is_french { "Fenêtre" } else { "Window" };
    let app_menu = SubmenuBuilder::new(app, "Heidrun Code")
        // Our own item: the About window is drawn by the web frontend, with an image.
        .item(&tauri::menu::MenuItemBuilder::with_id("hd-about", about_label).build(app)?)
        .separator()
        .services()
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        // Our own item: with unsaved files, ⌘Q shows them instead of quitting.
        .item(&tauri::menu::MenuItemBuilder::with_id("hd-quit", quit_label).accelerator("CmdOrCtrl+Q").build(app)?)
        .build()?;
    let edit = SubmenuBuilder::new(app, edit_label)
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;
    let window = SubmenuBuilder::new(app, window_label)
        .minimize()
        .maximize()
        .separator()
        .fullscreen()
        .build()?;
    MenuBuilder::new(app).items(&[&app_menu, &edit, &window]).build()
}

/// File view panes with unsaved changes: quitting or closing the window asks first (issue #899).
static UNSAVED: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

#[tauri::command]
fn set_unsaved(on: bool) {
    UNSAVED.store(on, std::sync::atomic::Ordering::Relaxed);
}

/// The main window is created hidden (see `visible` in `tauri.conf.json`), so the user never sees an empty window
/// before the splash image. This flag is true once the window has been shown.
static MAIN_WINDOW_SHOWN: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

/// The longest time the main window stays hidden. After this time the window appears even if the web page never
/// tells that the splash image is ready, for example when the web page fails to load.
const MAIN_WINDOW_SHOW_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(5);

/// What the window-state plugin saves when Heidrun Code quits, and puts back when the main window is created: the position,
/// the size, and the maximized and full screen states. The visible state is not in the list, because the main window
/// stays hidden until the splash image is ready (see `MAIN_WINDOW_SHOWN`).
fn window_state_flags() -> tauri_plugin_window_state::StateFlags {
    use tauri_plugin_window_state::StateFlags;
    StateFlags::POSITION | StateFlags::SIZE | StateFlags::MAXIMIZED | StateFlags::FULLSCREEN
}

/// The windows that the window-state plugin never saves: the separate Mire window always opens at a reasonable size on
/// the screen of the main window (issue 973).
const WINDOW_STATE_DENYLIST: [&str; 1] = [mire::mire_window::MIRE_WINDOW_LABEL];

/// True for the first call with this flag, false for every later call. The flag is set by the first call.
fn claim_first_show(flag: &std::sync::atomic::AtomicBool) -> bool {
    !flag.swap(true, std::sync::atomic::Ordering::SeqCst)
}

/// Shows the main window and gives it the keyboard focus. Only the first call does the work, and writes in the application log
/// the time from the start of the application, with `reason`: `splash_image_ready` or `timeout`.
fn show_main_window_once(app: &AppHandle, reason: &str) {
    use tauri::Manager;
    if !claim_first_show(&MAIN_WINDOW_SHOWN) {
        return;
    }
    application_log::record_main_window_shown(reason);
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Called by the web page when the splash image is loaded and decoded: the window can appear with the image already
/// in its first frame.
#[tauri::command]
fn show_main_window(app: AppHandle) {
    show_main_window_once(&app, "splash_image_ready");
}

/// The command line option that starts Heidrun Code without the splash screen. A program that drives Heidrun Code, for example to
/// take a screenshot, uses it so that it never waits for the splash screen to close.
const NO_SPLASH_SCREEN_OPTION: &str = "--no-splash-screen";

/// True when `arguments` holds `option`.
fn has_option(arguments: &[String], option: &str) -> bool {
    arguments.iter().any(|argument| argument == option)
}

/// Called by the web page at the start: true when Heidrun Code was started with the option `--no-splash-screen`. The web
/// page then does not show the splash screen, and shows the main window at once.
#[tauri::command]
fn is_splash_screen_disabled() -> bool {
    let arguments: Vec<String> = std::env::args().collect();
    has_option(&arguments, NO_SPLASH_SCREEN_OPTION)
}

/// The setting "Keep agents running after quit": when true, quitting Heidrun Code does not stop the Herdr session `heidrun`.
/// The web page sends the value at the start and at each change. Until then the value is false, the default.
static KEEP_AGENTS_RUNNING: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

#[tauri::command]
fn set_keep_agents_running(is_keeping: bool) {
    KEEP_AGENTS_RUNNING.store(is_keeping, std::sync::atomic::Ordering::Relaxed);
}

/// "Quit without saving": the developer chose, the application leaves.
#[tauri::command]
fn quit_now(app: AppHandle) {
    UNSAVED.store(false, std::sync::atomic::Ordering::Relaxed);
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    application_log::mark_application_start();
    let context = tauri::generate_context!();
    application_profile::initialize(&context.config().identifier);
    login_shell_path::apply();
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(window_state_flags())
                .with_denylist(&WINDOW_STATE_DENYLIST)
                .build(),
        )
        .manage(pty::PtyState::default())
        .manage(herdr::StatusWatcher::default())
        .manage(mobile::MobileState::default())
        .manage(mire::local_network::MireLocalNetworkState::default())
        .manage(html_preview::HtmlPreviewState::default())
        .manage(voice_commands::VoiceState::default())
        .manage(status_item::StatusItemState::default())
        .manage(file_watch::FileWatchState::default())
        .setup(|app| {
            if application_profile::is_development() == false {
                claude::migrate_legacy();
                antigravity::migrate_former_folder();
            }
            voice_commands::open_whisper_log();
            if application_profile::is_development() == false {
                skills::bundled::install(app.handle());
            }
            app.set_menu(build_menu(app.handle())?)?;
            herdr::spawn_event_loop(app.handle().clone());
            mobile::start_if_enabled(app.handle());
            mire::local_network::start_if_enabled(app.handle());
            status_item::create(app.handle())?;
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(MAIN_WINDOW_SHOW_TIMEOUT).await;
                show_main_window_once(&handle, "timeout");
            });
            Ok(())
        })
        .on_menu_event(|app, event| {
            if event.id().as_ref() == "hd-about" {
                use tauri::Emitter;
                let _ = app.emit("show-about", ());
            }
            if event.id().as_ref() == "hd-quit" {
                if UNSAVED.load(std::sync::atomic::Ordering::Relaxed) {
                    use tauri::Emitter;
                    let _ = app.emit("quit-blocked", ());
                } else {
                    app.exit(0);
                }
            }
        })
        .on_window_event(|window, event| {
            // Only the main window holds the file views: the separate Mire window always closes (issue 973).
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == mire::mire_window::MAIN_WINDOW_LABEL && UNSAVED.load(std::sync::atomic::Ordering::Relaxed) {
                    api.prevent_close();
                    use tauri::Emitter;
                    let _ = window.emit("quit-blocked", ());
                }
            }
            if let tauri::WindowEvent::Destroyed = event {
                use tauri::Manager;
                mire::mire_window::on_window_destroyed(window.app_handle(), window.label());
            }
        })
        .invoke_handler(tauri::generate_handler![
            set_unsaved,
            set_keep_agents_running,
            quit_now,
            show_main_window,
            application_log::application_log_load_time,
            is_splash_screen_disabled,
            status_item::status_item_update,
            status_item::status_item_set_visible,
            status_item::status_item_set_user_active,
            herdr_request,
            workspace_folders::workspace_folder_recover,
            herdr_cli,
            herdr_watch_panes,
            herdr_paths,
            herdr_server_start,
            required_programs::required_programs_status,
            required_programs::coding_agents_available,
            pty::pty_spawn,
            pty::pty_write,
            pty::pty_resize,
            pty::pty_kill,
            clipboard::clipboard_set_image,
            durable_storage::durable_storage_read,
            durable_storage::durable_storage_write,
            former_web_view_storage::former_web_view_storage_read,
            image_preview::image_preview,
            voice_commands::voice_options,
            voice_commands::voice_download_model,
            voice_commands::voice_start_recording,
            voice_commands::voice_cancel_recording,
            voice_commands::voice_stop_recording,
            voice_commands::voice_discard_recording,
            voice_commands::voice_transcribe_recording,
            voice_words::voice_words_read,
            voice_words::voice_words_add,
            voice_words::voice_words_update,
            voice_words::voice_words_delete,
            usage::codex_usage,
            mire::collector::mire_subscribe,
            mire::collector::mire_unsubscribe,
            mire::claude_observer_mod::mire_claude_observer_mod_path,
            mire::claude_observer_mod::mire_claude_observation_folder,
            mire::codex_chat_preparation::codex_prepare_chat,
            mire::mire_window::mire_window_open,
            mire::mire_window::mire_open_in_main_window,
            mire::local_network::mire_local_network_status,
            mire::local_network::mire_local_network_enable,
            mire::local_network::mire_local_network_disable,
            mire::local_network::mire_local_network_new_key,
            project::project_load,
            project::project_package_scripts,
            project::project_save,
            project::project_refs,
            project::project_config_text,
            macros::macros_hard_coded,
            macros::macros_personal_read,
            macros::macros_personal_write,
            user_launchers::launchers_user_read,
            user_launchers::launchers_user_write,
            user_launchers::launcher_folder_exists,
            git::git_status,
            git::git_worktrees,
            git::forge_rate_limit_reset,
            git::forge_gitlab_rate_limit_reset,
            forge_cache::forge_cli_cached,
            forge_cache::forge_cli_cached_with_source,
            topic_clusters::topic_clusters_read,
            topic_clusters::topic_clusters_write,
            topic_clusters::coding_agent_ask,
            coding_agent_models::coding_agent_models_run,
            git::forge_merge,
            git::git_diff,
            git::git_file,
            git_source_control::git_stage,
            git_source_control::git_unstage,
            git_source_control::git_discard,
            git_source_control::git_commit,
            git_source_control::git_stash,
            git_source_control::git_sync,
            git_source_control::git_branches,
            git_source_control::git_remote_branches,
            git_source_control::git_synchronize,
            git_source_control::git_checkout,
            git_source_control::git_commit_diff,
            claude::claude_statusline_state,
            claude::claude_statusline_install,
            claude::claude_statusline_uninstall,
            claude::claude_statusline_set_hidden,
            antigravity::antigravity_statusline_state,
            antigravity::antigravity_statusline_install,
            antigravity::antigravity_statusline_uninstall,
            claude::claude_rc_startup,
            claude::claude_set_rc_startup,
            claude::claude_commands,
            claude::claude_session_agents,
            chat_images::chat_images::chat_images_find,
            chat_images::chat_images::chat_images_find_codex_chat,
            past_chats::chats::chats_synchronize,
            past_chats::chats::chats_list,
            past_chats::chats_files::chats_files_exist,
            past_chats::chats_files::chats_worktrees_exist,
            past_chats::chats_files::chats_worktrees_branches,
            past_chats::chat_references::chat_references_synchronize,
            past_chats::chat_references::chat_references_find,
            worktree_actions::chats_worktree_open_in_vscode,
            history::history_append,
            history::history_read,
            history::history_export,
            user_activity::user_activity_append,
            user_activity::user_activity_read,
            statistics::user_activity_records::user_activity_synchronize,
            statistics::user_activity_records::user_activity_records_in_range,
            statistics::person_work::person_work_synchronize,
            statistics::person_work::person_work_in_range,
            statistics::ai_cost::ai_cost_synchronize,
            statistics::ai_cost::ai_cost_in_range,
            files::files_list,
            files::folder_children,
            files::files_resolve,
            html_preview::html_preview_open,
            html_preview::html_preview_close,
            files::file_image,
            files::file_open_external,
            files::file_full_path,
            files::file_read,
            files::file_stat,
            files::file_write,
            file_watch::file_watch_start,
            file_watch::file_watch_stop,
            files::files_grep,
            files::file_create,
            files::dirs_existing,
            mobile::mobile_reply,
            mobile::mobile_status,
            mobile::mobile_push,
            system_sound::play_system_sound,
            mobile::mobile_enable,
            mobile::mobile_disable,
            mobile::mobile_revoke,
            mobile::mobile_stop_leftover_ngrok,
            skills::installed::skills_list,
            skills::installed::skills_read,
            skills::installed::skills_delete,
            skills::search::skills_search,
            skills::search::skills_find_local_folders,
            skills::search::skills_find_folders,
            skills::install::skills_preview,
            skills::install::skills_install,
            skills::install::skills_preview_folder,
            skills::install::skills_install_folder,
            skills::install::skills_preview_local_folder,
            skills::install::skills_install_local_folder,
            skills::agent_folders::skills_link_agent,
        ])
        .build(context)
        .expect("error while running Heidrun Code")
        .run(|app, event| {
            // ⌘Q with unsaved files: the app stays and shows them.
            if let tauri::RunEvent::ExitRequested { api, code, .. } = &event {
                if code.is_none() && UNSAVED.load(std::sync::atomic::Ordering::Relaxed) {
                    api.prevent_exit();
                    use tauri::Emitter;
                    let _ = app.emit("quit-blocked", ());
                }
            }
            // The app leaves for good: the Herdr session of Heidrun Code stops with it, like the processes of a normal macOS app.
            if let tauri::RunEvent::Exit = event {
                herdr::stop_session_on_quit(KEEP_AGENTS_RUNNING.load(std::sync::atomic::Ordering::Relaxed));
                mobile::stop_on_quit(app);
                mire::local_network::stop_on_quit(app);
            }
        });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_main_window_is_created_hidden_so_the_user_never_sees_it_empty() {
        let config: Value = serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
        let window = &config["app"]["windows"][0];
        assert_eq!(window["visible"], json!(false));
    }

    #[test]
    fn the_window_state_restores_the_position_the_size_and_the_maximized_and_full_screen_states() {
        use tauri_plugin_window_state::StateFlags;
        let flags = window_state_flags();
        assert!(flags.contains(StateFlags::POSITION));
        assert!(flags.contains(StateFlags::SIZE));
        assert!(flags.contains(StateFlags::MAXIMIZED));
        assert!(flags.contains(StateFlags::FULLSCREEN));
    }

    #[test]
    fn the_window_state_never_restores_the_visible_state_so_the_window_stays_hidden_until_the_splash_image_is_ready() {
        use tauri_plugin_window_state::StateFlags;
        assert!(!window_state_flags().contains(StateFlags::VISIBLE));
    }

    #[test]
    fn the_default_size_in_the_configuration_stays_the_size_of_the_first_start() {
        let config: Value = serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
        let window = &config["app"]["windows"][0];
        assert_eq!(window["width"], json!(1440));
        assert_eq!(window["height"], json!(900));
    }

    #[test]
    fn the_window_state_never_saves_the_separate_mire_window() {
        assert_eq!(WINDOW_STATE_DENYLIST, ["mire"]);
    }

    #[test]
    fn the_option_that_disables_the_splash_screen_is_no_splash_screen() {
        assert_eq!(NO_SPLASH_SCREEN_OPTION, "--no-splash-screen");
    }

    #[test]
    fn an_option_in_the_arguments_is_found_wherever_it_is() {
        let arguments: Vec<String> = ["heidrun", "--no-splash-screen"].map(String::from).to_vec();
        assert!(has_option(&arguments, NO_SPLASH_SCREEN_OPTION));
        let arguments: Vec<String> = ["heidrun", "--no-splash-screen", "--other"].map(String::from).to_vec();
        assert!(has_option(&arguments, NO_SPLASH_SCREEN_OPTION));
    }

    #[test]
    fn an_option_that_is_not_in_the_arguments_is_not_found() {
        let arguments: Vec<String> = ["heidrun", "--no-splash", "--splash-screen"].map(String::from).to_vec();
        assert!(!has_option(&arguments, NO_SPLASH_SCREEN_OPTION));
        assert!(!has_option(&[], NO_SPLASH_SCREEN_OPTION));
    }

    #[test]
    fn only_the_first_claim_to_show_the_main_window_succeeds() {
        let flag = std::sync::atomic::AtomicBool::new(false);
        assert!(claim_first_show(&flag));
        assert!(!claim_first_show(&flag));
        assert!(!claim_first_show(&flag));
    }
}
