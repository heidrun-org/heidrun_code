//! The Heidrun Code Dashboard on the local network, the Tauri side: the commands of the section "Heidrun Code Dashboard" of the Settings window, and the
//! handler that gives the Heidrun Code Dashboard server the files of the page and the state of the Heidrun Code Dashboard. The page reads the one shared
//! collector: the devices of the local network register one view while they read, and no view when they stop.
//!
//! The server itself (the port, the pairing key, the checks, the routes) is the package `heidrun_code_dashboard_server`.

use heidrun_code_dashboard_server::{AssetFuture, HeidrunCodeDashboardAsset, HeidrunCodeDashboardServer, HeidrunCodeDashboardServerConfig, HeidrunCodeDashboardServerEvent, HeidrunCodeDashboardServerHandler, HeidrunCodeDashboardServerStatus, StateFuture};
use serde_json::{json, Value};
use std::sync::{LazyLock, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager, State};

/// The view of the devices of the local network in the shared collector, and its label. No window has this label.
const LOCAL_NETWORK_VIEW: &str = "heidrun_code_dashboard_local_network";

/// The devices stopped reading when no request came for this time: the view leaves the collector.
const IDLE_AFTER: Duration = Duration::from_secs(15);

/// A Herdr snapshot younger than this is given again, so that several devices read Herdr once.
const SNAPSHOT_REUSE: Duration = Duration::from_secs(1);

/// The server of the Heidrun Code Dashboard on the local network. One value lives as long as the application.
#[derive(Default)]
pub struct HeidrunCodeDashboardLocalNetworkState {
    server: HeidrunCodeDashboardServer,
}

/// The time of the last request of a device, and whether the view of the devices is in the collector.
struct Activity {
    last_request: Option<Instant>,
    is_subscribed: bool,
}

static ACTIVITY: LazyLock<Mutex<Activity>> = LazyLock::new(|| Mutex::new(Activity { last_request: None, is_subscribed: false }));

/// The last Herdr snapshot that a device received, with the time of its reading.
static SNAPSHOT: LazyLock<Mutex<Option<(Instant, Value)>>> = LazyLock::new(|| Mutex::new(None));

/// Gives the page and the state of the Heidrun Code Dashboard to the Heidrun Code Dashboard server.
struct DesktopHandler {
    app: AppHandle,
}

impl HeidrunCodeDashboardServerHandler for DesktopHandler {
    fn state(&self) -> StateFuture {
        let app = self.app.clone();
        Box::pin(async move { read_state(app).await })
    }

    fn asset(&self, path: String) -> AssetFuture {
        let app = self.app.clone();
        Box::pin(async move { read_asset(&app, path).await })
    }

    fn record_event(&self, event: HeidrunCodeDashboardServerEvent) {
        let (name, fields) = log_line(event);
        crate::application_log::write(name, fields);
    }
}

/// The kind and the fields of the line of the application log for one event of the Heidrun Code Dashboard server.
fn log_line(event: HeidrunCodeDashboardServerEvent) -> (&'static str, Value) {
    match event {
        HeidrunCodeDashboardServerEvent::Refused { reason } => ("heidrun_code_dashboard_local_network_request_refused", json!({ "reason": reason })),
        HeidrunCodeDashboardServerEvent::Locked => ("heidrun_code_dashboard_local_network_pairing_locked", json!({})),
    }
}

/// The state of the Heidrun Code Dashboard for the page: the Herdr snapshot, the latest observations of the shared collector, and the Herdr
/// socket of Heidrun Code, which the Heidrun Code Dashboard model needs to match a Claude Code session to its pane.
async fn read_state(app: AppHandle) -> Result<Value, String> {
    let must_subscribe = {
        let mut activity = ACTIVITY.lock().unwrap();
        activity.last_request = Some(Instant::now());
        let must_subscribe = activity.is_subscribed == false;
        activity.is_subscribed = true;
        must_subscribe
    };
    let observations = if must_subscribe {
        let observations = super::collector::subscribe_view(app, LOCAL_NETWORK_VIEW, LOCAL_NETWORK_VIEW).await;
        tauri::async_runtime::spawn(unsubscribe_when_idle());
        observations
    } else {
        super::collector::latest()
    };
    let snapshot = read_snapshot().await?;
    Ok(json!({
        "snapshot": snapshot,
        "observations": observations,
        "herdrSocketPath": crate::herdr::socket_path().display().to_string(),
    }))
}

/// Reads the Herdr snapshot, or gives the snapshot of the last second again.
async fn read_snapshot() -> Result<Value, String> {
    if let Some((read_at, snapshot)) = SNAPSHOT.lock().unwrap().as_ref() {
        if read_at.elapsed() < SNAPSHOT_REUSE {
            return Ok(snapshot.clone());
        }
    }
    let result = crate::herdr::request("session.snapshot", json!({})).await?;
    let snapshot = result.get("snapshot").cloned().unwrap_or(Value::Null);
    *SNAPSHOT.lock().unwrap() = Some((Instant::now(), snapshot.clone()));
    Ok(snapshot)
}

/// Removes the view of the devices from the collector when no device read for a while, so that the collector stops when no
/// Heidrun Code Dashboard is shown anywhere.
async fn unsubscribe_when_idle() {
    loop {
        tokio::time::sleep(Duration::from_secs(5)).await;
        let mut activity = ACTIVITY.lock().unwrap();
        if is_idle(activity.last_request, Instant::now()) {
            activity.is_subscribed = false;
            super::collector::heidrun_code_dashboard_unsubscribe(LOCAL_NETWORK_VIEW.to_string());
            return;
        }
    }
}

/// True when the last request of a device is older than `IDLE_AFTER`, or when no device ever read.
fn is_idle(last_request: Option<Instant>, now: Instant) -> bool {
    last_request.map(|last_request| now.duration_since(last_request) >= IDLE_AFTER).unwrap_or(true)
}

/// One file of the page. A release build gives the files that it holds, the same files as its windows. A development build
/// asks the development server of the page, so that the device shows the code of the checkout.
async fn read_asset(app: &AppHandle, path_and_query: String) -> Option<HeidrunCodeDashboardAsset> {
    if tauri::is_dev() {
        let development_address = app.config().build.dev_url.clone()?;
        return read_development_asset(development_address.as_str(), &path_and_query).await;
    }
    let path = path_and_query.split('?').next().unwrap_or("").to_string();
    let asset = app.asset_resolver().get(path)?;
    Some(HeidrunCodeDashboardAsset { bytes: asset.bytes, mime_type: asset.mime_type })
}

async fn read_development_asset(development_address: &str, path_and_query: &str) -> Option<HeidrunCodeDashboardAsset> {
    let address = format!("{}/{}", development_address.trim_end_matches('/'), path_and_query);
    let response = reqwest::get(address).await.ok()?;
    if response.status().is_success() == false {
        return None;
    }
    let mime_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("application/octet-stream")
        .to_string();
    let bytes = response.bytes().await.ok()?.to_vec();
    Some(HeidrunCodeDashboardAsset { bytes, mime_type })
}

fn start(app: &AppHandle, state: &HeidrunCodeDashboardLocalNetworkState, config: &HeidrunCodeDashboardServerConfig) {
    let handler = std::sync::Arc::new(DesktopHandler { app: app.clone() });
    tauri::async_runtime::spawn(state.server.start(handler, config));
}

/// Called at launch: the server comes back if the option was on.
pub fn start_if_enabled(app: &AppHandle) {
    let config = heidrun_code_dashboard_server::load_config();
    if is_ready(&config) {
        start(app, &app.state::<HeidrunCodeDashboardLocalNetworkState>(), &config);
    }
}

/// Called when Heidrun Code quits: the server stops.
pub fn stop_on_quit(app: &AppHandle) {
    app.state::<HeidrunCodeDashboardLocalNetworkState>().server.stop();
}

/// True when the saved option is on with a key and a port.
fn is_ready(config: &HeidrunCodeDashboardServerConfig) -> bool {
    config.enabled && config.key.is_empty() == false && config.port != 0
}

/// Turns the option on: a key and a port the first time, both saved for the next starts.
fn enabled_config(mut config: HeidrunCodeDashboardServerConfig) -> Result<HeidrunCodeDashboardServerConfig, String> {
    if config.key.is_empty() {
        config.key = heidrun_code_dashboard_server::new_key()?;
    }
    if config.port == 0 {
        config.port = heidrun_code_dashboard_server::free_port()?;
    }
    config.enabled = true;
    Ok(config)
}

fn status_of(state: &HeidrunCodeDashboardLocalNetworkState) -> HeidrunCodeDashboardServerStatus {
    state.server.status(&heidrun_code_dashboard_server::load_config())
}

/// What the section "Heidrun Code Dashboard" of the Settings window shows: the option, and the address and the QR code while the server
/// listens.
#[tauri::command]
pub fn heidrun_code_dashboard_local_network_status(state: State<'_, HeidrunCodeDashboardLocalNetworkState>) -> HeidrunCodeDashboardServerStatus {
    status_of(&state)
}

/// Turns on "Show the Heidrun Code Dashboard on the local network".
#[tauri::command]
pub async fn heidrun_code_dashboard_local_network_enable(app: AppHandle, state: State<'_, HeidrunCodeDashboardLocalNetworkState>) -> Result<HeidrunCodeDashboardServerStatus, String> {
    let config = enabled_config(heidrun_code_dashboard_server::load_config())?;
    heidrun_code_dashboard_server::save_config(&config)?;
    start(&app, &state, &config);
    // Let the listener bind (or fail) before answering.
    tokio::time::sleep(Duration::from_millis(300)).await;
    Ok(status_of(&state))
}

/// Turns off "Show the Heidrun Code Dashboard on the local network": the server stops at once.
#[tauri::command]
pub fn heidrun_code_dashboard_local_network_disable(state: State<'_, HeidrunCodeDashboardLocalNetworkState>) -> Result<HeidrunCodeDashboardServerStatus, String> {
    let mut config = heidrun_code_dashboard_server::load_config();
    config.enabled = false;
    heidrun_code_dashboard_server::save_config(&config)?;
    state.server.stop();
    Ok(status_of(&state))
}

/// A new pairing key: every device must scan the new QR code. The old key is refused at once.
#[tauri::command]
pub fn heidrun_code_dashboard_local_network_new_key(state: State<'_, HeidrunCodeDashboardLocalNetworkState>) -> Result<HeidrunCodeDashboardServerStatus, String> {
    let mut config = heidrun_code_dashboard_server::load_config();
    config.key = heidrun_code_dashboard_server::new_key()?;
    heidrun_code_dashboard_server::save_config(&config)?;
    if config.enabled {
        state.server.replace_key(&config.key);
    }
    Ok(status_of(&state))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn writes_each_event_of_the_heidrun_code_dashboard_server_as_a_line_of_the_application_log() {
        assert_eq!(
            log_line(HeidrunCodeDashboardServerEvent::Refused { reason: "unpaired" }),
            ("heidrun_code_dashboard_local_network_request_refused", json!({ "reason": "unpaired" }))
        );
        assert_eq!(log_line(HeidrunCodeDashboardServerEvent::Locked), ("heidrun_code_dashboard_local_network_pairing_locked", json!({})));
    }

    #[test]
    fn the_first_start_gives_a_key_and_a_port_and_a_later_start_keeps_them() {
        let first = enabled_config(HeidrunCodeDashboardServerConfig::default()).unwrap();
        assert!(first.enabled);
        assert_eq!(first.key.len(), 64);
        assert_ne!(first.port, 0);
        let saved = HeidrunCodeDashboardServerConfig { enabled: false, key: "ab".repeat(32), port: 51234 };
        let later = enabled_config(saved).unwrap();
        assert_eq!(later, HeidrunCodeDashboardServerConfig { enabled: true, key: "ab".repeat(32), port: 51234 });
    }

    #[test]
    fn the_server_starts_at_launch_only_when_the_option_is_on_with_a_key_and_a_port() {
        assert!(is_ready(&HeidrunCodeDashboardServerConfig { enabled: true, key: "ab".into(), port: 51234 }));
        assert!(is_ready(&HeidrunCodeDashboardServerConfig { enabled: false, key: "ab".into(), port: 51234 }) == false);
        assert!(is_ready(&HeidrunCodeDashboardServerConfig { enabled: true, key: String::new(), port: 51234 }) == false);
        assert!(is_ready(&HeidrunCodeDashboardServerConfig { enabled: true, key: "ab".into(), port: 0 }) == false);
    }

    #[test]
    fn the_devices_are_idle_when_none_read_for_fifteen_seconds() {
        let now = Instant::now() + Duration::from_secs(60);
        assert!(is_idle(None, now));
        assert!(is_idle(Some(now - Duration::from_secs(14)), now) == false);
        assert!(is_idle(Some(now - IDLE_AFTER), now));
    }
}
