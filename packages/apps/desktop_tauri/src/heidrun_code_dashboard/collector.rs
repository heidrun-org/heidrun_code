//! The one shared collector of the Heidrun Code Dashboard. Each Heidrun Code Dashboard view (the modal or the separate window) registers itself. The
//! collector reads the sources every 2 seconds while at least one view is registered, and reads nothing when no view is
//! registered. Each collection goes to every window as the event `heidrun_code_dashboard://observations`.

use std::collections::HashMap;
use std::future::Future;
use std::sync::{Arc, LazyLock, Mutex};
use std::time::Duration;

use serde_json::json;
use tauri::{AppHandle, Emitter, WebviewWindow};

use super::contract::{HeidrunCodeDashboardObservations, ObservationError, MAXIMUM_CHILDREN_PER_ROOT, SCHEMA_VERSION};
use super::{claude_snapshots, codex_connection, codex_threads};

/// The time between two collections while a view is registered.
pub const COLLECTION_INTERVAL: Duration = Duration::from_secs(2);
/// The longest time of the reading of the shared Codex server in one collection.
const CODEX_COLLECTION_TIMEOUT: Duration = Duration::from_secs(10);
/// The event that carries each collection to the web page.
pub const OBSERVATIONS_EVENT: &str = "heidrun_code_dashboard://observations";

/// The registered views with the label of their window, the latest collection, and whether the loop of collections
/// runs.
pub struct CollectorState {
    views: HashMap<String, String>,
    latest: HeidrunCodeDashboardObservations,
    is_running: bool,
}

impl CollectorState {
    pub fn new() -> Self {
        CollectorState {
            views: HashMap::new(),
            latest: HeidrunCodeDashboardObservations::empty(now_ms()),
            is_running: false,
        }
    }

    /// Registers a view of the window `window_label`. Gives true when the loop of collections must start.
    pub fn subscribe(&mut self, view_id: &str, window_label: &str) -> bool {
        self.views.insert(view_id.to_string(), window_label.to_string());
        if self.is_running {
            return false;
        }
        self.is_running = true;
        true
    }

    /// Removes a view. The loop stops at its next turn when no view remains.
    pub fn unsubscribe(&mut self, view_id: &str) {
        self.views.remove(view_id);
    }

    /// Removes every view of a window: a closed window never unmounts its views itself.
    pub fn forget_window(&mut self, window_label: &str) {
        self.views.retain(|_, label| label != window_label);
    }

    /// Called by the loop before each collection: gives false, and marks the loop as stopped, when no view remains.
    fn should_continue(&mut self) -> bool {
        if self.views.is_empty() {
            self.is_running = false;
            return false;
        }
        true
    }

    #[cfg(test)]
    pub fn view_count(&self) -> usize {
        self.views.len()
    }
}

static COLLECTOR: LazyLock<Arc<Mutex<CollectorState>>> = LazyLock::new(|| Arc::new(Mutex::new(CollectorState::new())));

/// Registers one Heidrun Code Dashboard view and gives the latest observations. The first view starts the collector, and gets a fresh
/// collection.
#[tauri::command]
pub async fn heidrun_code_dashboard_subscribe(app: AppHandle, webview_window: WebviewWindow, view_id: String) -> HeidrunCodeDashboardObservations {
    subscribe_view(app, &view_id, webview_window.label()).await
}

/// Registers one Heidrun Code Dashboard view with a label: the label of its window, or a label that no window has, for the devices of the
/// local network. Gives the latest observations.
pub async fn subscribe_view(app: AppHandle, view_id: &str, label: &str) -> HeidrunCodeDashboardObservations {
    let emitter = app.clone();
    subscribe(
        COLLECTOR.clone(),
        view_id,
        label,
        COLLECTION_INTERVAL,
        // Boxed: the future of a whole collection is large, and a worker thread has a small stack (issue 968).
        || Box::pin(collect_once()),
        move |observations| {
            let _ = emitter.emit(OBSERVATIONS_EVENT, observations);
        },
    )
    .await
}

/// Removes one Heidrun Code Dashboard view. When no view remains, the collector stops within one collection interval.
#[tauri::command]
pub fn heidrun_code_dashboard_unsubscribe(view_id: String) {
    COLLECTOR.lock().unwrap().unsubscribe(&view_id);
}

/// The latest collection, without a new reading.
pub fn latest() -> HeidrunCodeDashboardObservations {
    COLLECTOR.lock().unwrap().latest.clone()
}

/// Removes every Heidrun Code Dashboard view of a closed window. `lib.rs` calls it when a window is destroyed.
pub fn forget_window(window_label: &str) {
    COLLECTOR.lock().unwrap().forget_window(window_label);
}

/// Registers a view of a window in `state`. When the loop does not run, runs one collection at once, then starts the
/// loop.
pub async fn subscribe<C, F, E>(
    state: Arc<Mutex<CollectorState>>,
    view_id: &str,
    window_label: &str,
    interval: Duration,
    collect: C,
    emit: E,
) -> HeidrunCodeDashboardObservations
where
    C: Fn() -> F + Send + Sync + 'static,
    F: Future<Output = HeidrunCodeDashboardObservations> + Send + 'static,
    E: Fn(&HeidrunCodeDashboardObservations) + Send + Sync + 'static,
{
    let must_start = state.lock().unwrap().subscribe(view_id, window_label);
    if must_start == false {
        return state.lock().unwrap().latest.clone();
    }
    let observations = collect().await;
    state.lock().unwrap().latest = observations.clone();
    emit(&observations);
    tauri::async_runtime::spawn(run_loop(state, interval, collect, emit));
    observations
}

async fn run_loop<C, F, E>(state: Arc<Mutex<CollectorState>>, interval: Duration, collect: C, emit: E)
where
    C: Fn() -> F,
    F: Future<Output = HeidrunCodeDashboardObservations>,
    E: Fn(&HeidrunCodeDashboardObservations),
{
    loop {
        tokio::time::sleep(interval).await;
        if state.lock().unwrap().should_continue() == false {
            return;
        }
        let observations = collect().await;
        state.lock().unwrap().latest = observations.clone();
        emit(&observations);
    }
}

/// One collection of every source: the snapshot files of the observer mod, the Codex panes of the Herdr session that
/// Heidrun Code uses, and their chats on the shared Codex server. It never sends input and never starts a chat.
pub async fn collect_once() -> HeidrunCodeDashboardObservations {
    let observed_at_ms = now_ms();
    let folder = claude_snapshots::observation_folder();
    let mut claude = claude_snapshots::read_folder(&folder, observed_at_ms).await;
    if folder.exists() {
        if let Err(error) = claude_snapshots::ensure_private_folder(&folder) {
            claude
                .errors
                .push(ObservationError::new(folder.display().to_string(), error));
        }
    }
    let mut codex_errors = Vec::new();
    let root_thread_ids = match crate::herdr::request("session.snapshot", json!({})).await {
        Ok(snapshot) => codex_threads::codex_root_thread_ids(&snapshot),
        Err(error) => {
            codex_errors.push(ObservationError::new("session.snapshot", error));
            Vec::new()
        }
    };
    let socket_path = codex_connection::shared_server_socket_path();
    let codex = match tokio::time::timeout(
        CODEX_COLLECTION_TIMEOUT,
        Box::pin(codex_threads::collect(
            &socket_path,
            &root_thread_ids,
            MAXIMUM_CHILDREN_PER_ROOT,
            observed_at_ms,
            codex_errors.clone(),
        )),
    )
    .await
    {
        Ok(codex) => codex,
        Err(_) => {
            let reason = format!(
                "The shared Codex server did not answer in {} seconds",
                CODEX_COLLECTION_TIMEOUT.as_secs()
            );
            codex_errors.push(ObservationError::new(socket_path.display().to_string(), reason.clone()));
            super::contract::CodexObservations::unavailable(reason, codex_errors)
        }
    };
    HeidrunCodeDashboardObservations {
        schema_version: SCHEMA_VERSION,
        observed_at_ms,
        claude,
        codex,
    }
}

/// The time now, in milliseconds since 1970, by the clock of the computer.
pub fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};

    #[test]
    fn the_first_view_starts_the_collector_and_the_others_do_not() {
        let mut state = CollectorState::new();
        assert!(state.subscribe("modal", "main"));
        assert!(state.subscribe("window", "heidrun_code_dashboard") == false);
        assert!(state.subscribe("modal", "main") == false);
        assert_eq!(state.view_count(), 2);
        state.unsubscribe("modal");
        assert!(state.should_continue());
        state.unsubscribe("window");
        state.unsubscribe("unknown");
        assert!(state.should_continue() == false);
        assert!(
            state.subscribe("modal", "main"),
            "a view after the stop starts the collector again"
        );
    }

    #[test]
    fn a_collection_is_a_small_task_that_fits_the_stack_of_a_worker_thread() {
        // A 64 kilobyte buffer inside the future of a collection overflowed the stack of a worker thread when the
        // Heidrun Code Dashboard opened (issue 968). The future is created but never run, so nothing is read.
        let future = collect_once();
        let size = std::mem::size_of_val(&future);
        assert!(size < 16 * 1024, "the future of a collection takes {size} bytes");
    }

    fn counting_collector() -> (
        Arc<AtomicUsize>,
        impl Fn() -> std::pin::Pin<Box<dyn Future<Output = HeidrunCodeDashboardObservations> + Send>> + Send + Sync + 'static,
    ) {
        let count = Arc::new(AtomicUsize::new(0));
        let counted = count.clone();
        let collect = move || {
            let counted = counted.clone();
            Box::pin(async move {
                let number = counted.fetch_add(1, Ordering::SeqCst) + 1;
                HeidrunCodeDashboardObservations::empty(number as i64)
            }) as std::pin::Pin<Box<dyn Future<Output = HeidrunCodeDashboardObservations> + Send>>
        };
        (count, collect)
    }

    #[tokio::test]
    async fn the_collector_reads_while_a_view_is_registered_and_stops_reading_without_a_view() {
        let state = Arc::new(Mutex::new(CollectorState::new()));
        let (count, collect) = counting_collector();
        let emitted = Arc::new(AtomicUsize::new(0));
        let emitted_counter = emitted.clone();
        let interval = Duration::from_millis(20);
        let first = subscribe(state.clone(), "modal", "main", interval, collect, move |_| {
            emitted_counter.fetch_add(1, Ordering::SeqCst);
        })
        .await;
        assert_eq!(
            first.observed_at_ms, 1,
            "the first view gets a fresh collection at once"
        );
        tokio::time::sleep(Duration::from_millis(130)).await;
        let while_registered = count.load(Ordering::SeqCst);
        assert!(while_registered >= 3, "only {while_registered} collections");
        assert_eq!(emitted.load(Ordering::SeqCst), while_registered);

        state.lock().unwrap().unsubscribe("modal");
        tokio::time::sleep(Duration::from_millis(60)).await;
        let after_stop = count.load(Ordering::SeqCst);
        tokio::time::sleep(Duration::from_millis(100)).await;
        assert_eq!(count.load(Ordering::SeqCst), after_stop, "no reading without a view");
        assert!(state.lock().unwrap().is_running == false);
    }

    #[tokio::test]
    async fn a_second_view_gets_the_latest_collection_without_a_new_reading() {
        let state = Arc::new(Mutex::new(CollectorState::new()));
        let (count, collect) = counting_collector();
        let interval = Duration::from_secs(60);
        subscribe(state.clone(), "modal", "main", interval, collect, |_| {}).await;
        let (_, other_collect) = counting_collector();
        let second = subscribe(state.clone(), "window", "heidrun_code_dashboard", interval, other_collect, |_| {}).await;
        assert_eq!(second.observed_at_ms, 1);
        assert_eq!(count.load(Ordering::SeqCst), 1);
        assert_eq!(state.lock().unwrap().view_count(), 2);
    }

    #[test]
    fn closing_the_modal_or_the_window_removes_only_the_views_of_that_mode() {
        let mut state = CollectorState::new();
        assert!(state.subscribe("modal_view", "main"));
        assert!(state.subscribe("window_view", "heidrun_code_dashboard") == false);
        state.forget_window("heidrun_code_dashboard");
        assert_eq!(state.view_count(), 1);
        assert!(state.should_continue(), "the modal keeps the collector");
        assert!(state.subscribe("window_view_again", "heidrun_code_dashboard") == false, "the running collector is shared");
        state.unsubscribe("modal_view");
        assert_eq!(state.view_count(), 1);
        assert!(state.should_continue(), "the window keeps the collector");
        state.forget_window("heidrun_code_dashboard");
        assert!(state.should_continue() == false);
    }

    #[tokio::test]
    async fn the_modal_and_the_window_share_one_loop_of_collections() {
        let state = Arc::new(Mutex::new(CollectorState::new()));
        let (count, collect) = counting_collector();
        let (other_count, other_collect) = counting_collector();
        let interval = Duration::from_millis(20);
        subscribe(state.clone(), "modal_view", "main", interval, collect, |_| {}).await;
        subscribe(state.clone(), "window_view", "heidrun_code_dashboard", interval, other_collect, |_| {}).await;
        tokio::time::sleep(Duration::from_millis(110)).await;
        let shared = count.load(Ordering::SeqCst);
        assert!(shared >= 3 && shared <= 7, "{shared} collections in 110 milliseconds: one loop only");
        assert_eq!(other_count.load(Ordering::SeqCst), 0, "the second view starts no second loop");
        state.lock().unwrap().unsubscribe("modal_view");
        tokio::time::sleep(Duration::from_millis(60)).await;
        assert!(count.load(Ordering::SeqCst) > shared, "the window keeps the collection running");
        state.lock().unwrap().forget_window("heidrun_code_dashboard");
        tokio::time::sleep(Duration::from_millis(60)).await;
        let after_stop = count.load(Ordering::SeqCst);
        tokio::time::sleep(Duration::from_millis(60)).await;
        assert_eq!(count.load(Ordering::SeqCst), after_stop, "no reading after both modes close");
    }
}
