//! The life of the server: it listens on the loopback address only, keeps an ngrok tunnel open to it, and stops on demand.

use crate::access::AccessGuard;
use crate::config::MobileConfig;
use crate::handler::MobileCallHandler;
use crate::leftover_tunnel::TunnelRecord;
use crate::router::{router, Shared};
use crate::tunnel;
use serde::Serialize;
use std::future::Future;
use std::net::{Ipv4Addr, SocketAddr};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::process::Child;
use tokio::sync::{oneshot, watch};

/// What the settings window shows about the mobile access.
#[derive(Serialize)]
pub struct MobileStatus {
    /// True when the developer turned the mobile access on.
    pub enabled: bool,
    /// True when the tunnel has its public address and the server listens.
    pub running: bool,
    /// The public address of the page, the address of the tunnel.
    pub url: Option<String>,
    /// The pairing link (the address of the tunnel, then `#t=` and the pairing key) as a QR code (SVG).
    pub qr: Option<String>,
    /// The pairing link itself, for the settings window to open it in the web browser of this computer. It holds the
    /// pairing key, like the QR code, and it is None in the same cases.
    pub link: Option<String>,
    /// Why the mobile access does not work.
    pub error: Option<MobileError>,
}

/// Why the mobile access does not work. The settings window writes the sentence, in the language of the developer.
#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct MobileError {
    /// What went wrong.
    pub kind: MobileErrorKind,
    /// The words of the system or of the program `ngrok` about the problem. It can be empty.
    pub detail: String,
}

/// What can go wrong. The names reach the settings window in camel case, for example `ngrokMissing`.
#[derive(Serialize, Clone, Copy, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum MobileErrorKind {
    /// The program `ngrok` is not on this computer.
    NgrokMissing,
    /// The system refused to start the program `ngrok`.
    NgrokCannotStart,
    /// The program `ngrok` did not announce an address in time.
    NgrokNoAddress,
    /// The program `ngrok` ended, and the developer has an account (the reason is in the detail).
    NgrokStopped,
    /// The program `ngrok` ended because the developer has no account, or no authtoken in the configuration of `ngrok`.
    NgrokNotSignedIn,
    /// The program `ngrok` ended because another program `ngrok` already holds the fixed address of the account.
    NgrokAddressInUse,
    /// The server cannot listen on the loopback address.
    CannotListen,
}

impl MobileError {
    fn new(kind: MobileErrorKind, detail: impl Into<String>) -> Self {
        Self { kind, detail: detail.into() }
    }
}

/// Where the server finds the program `ngrok`. A test gives a fake program.
type ProgramFinder = Arc<dyn Fn() -> Option<PathBuf> + Send + Sync>;

/// The waits of the supervision. A test gives short waits.
#[derive(Clone, Copy)]
struct Timing {
    /// How long the program `ngrok` may take to announce the address of the tunnel.
    no_address: Duration,
    /// How long to wait before the next try, after a problem. After the problem "not signed in" the wait is three times
    /// longer, because every try opens a connection to the servers of ngrok.
    retry: Duration,
}

impl Default for Timing {
    fn default() -> Self {
        Self { no_address: Duration::from_secs(30), retry: Duration::from_secs(5) }
    }
}

#[derive(Default)]
struct Inner {
    /// The number of the current run. A task of an older run stops, and changes nothing.
    run: u64,
    /// Stops the current server (and its open connections).
    stop: Option<watch::Sender<bool>>,
    /// The host name of the tunnel, once the program `ngrok` announced it.
    tunnel_host: Option<String>,
    /// The program `ngrok`. It is here, and not in the task, so that `stop` kills it at once, with no async runtime.
    tunnel: Option<Child>,
    /// The file that holds the process id of the program `ngrok`, so that the next Heidrun Code kills it after a hard stop.
    /// None in the tests of the server, which must not touch the file of the developer.
    record: Option<Arc<TunnelRecord>>,
    error: Option<MobileError>,
}

/// The mobile server. One value lives as long as the application. It is cheap to share: every method takes `&self`.
#[derive(Default)]
pub struct MobileServer {
    inner: Arc<Mutex<Inner>>,
    guard: Arc<Mutex<AccessGuard>>,
}

impl MobileServer {
    /// A server that does not listen yet.
    pub fn new() -> Self {
        Self::default()
    }

    /// Prepares a new run, and returns the future that runs it. The caller must spawn the future on its async runtime:
    /// nothing listens before that. A run that is already going stops, and the new pairing key applies at once, even to
    /// connections that are still open.
    pub fn start(&self, handler: Arc<dyn MobileCallHandler>, config: &MobileConfig) -> impl Future<Output = ()> + Send + 'static {
        self.inner.lock().unwrap().record = Some(Arc::new(TunnelRecord::new(record_folder(), std::process::id())));
        self.start_with(handler, config, Arc::new(tunnel::find_ngrok), Timing::default())
    }

    /// For the button "Stop the old ngrok" of the error `ngrokAddressInUse`: kills the recorded program `ngrok` of every
    /// earlier or other Heidrun Code, but never the program of this Heidrun Code. True when a program was killed. The tunnel starts
    /// again at the next try.
    pub fn stop_leftover_tunnel(&self) -> bool {
        TunnelRecord::new(record_folder(), std::process::id()).kill_recorded()
    }

    /// Accepts this new pairing key from now on, and refuses the old key at once, even on connections that are still open.
    /// The tunnel keeps its address, so the developer only shows the new QR code. Nothing happens while no run is going.
    pub fn replace_token(&self, token: &str) {
        let inner = self.inner.lock().unwrap();
        if inner.stop.is_some() {
            self.guard.lock().unwrap().set_token(Some(token.to_string()));
        }
    }

    /// Turns the access off: the server stops, the program `ngrok` is killed, and no key is accepted.
    pub fn stop(&self) {
        let mut inner = self.inner.lock().unwrap();
        if let Some(stop) = inner.stop.take() {
            let _ = stop.send(true);
        }
        kill_tunnel(&mut inner);
        inner.run += 1;
        let mut guard = self.guard.lock().unwrap();
        guard.set_token(None);
        guard.set_tunnel_host(None);
        inner.tunnel_host = None;
        inner.error = None;
    }

    /// What the settings window shows. `config` gives the pairing key that the QR code carries.
    pub fn status(&self, config: &MobileConfig) -> MobileStatus {
        let inner = self.inner.lock().unwrap();
        let url = inner.tunnel_host.as_ref().map(|host| format!("https://{host}/"));
        let paired_host = inner.tunnel_host.as_ref().filter(|_| config.enabled);
        let qr = paired_host.and_then(|host| pairing_qr(host, &config.token));
        let link = paired_host.map(|host| pairing_link(host, &config.token));
        MobileStatus { enabled: config.enabled, running: inner.tunnel_host.is_some() && inner.error.is_none(), url, qr, link, error: inner.error.clone() }
    }

    fn start_with(&self, handler: Arc<dyn MobileCallHandler>, config: &MobileConfig, find_program: ProgramFinder, timing: Timing) -> impl Future<Output = ()> + Send + 'static {
        let mut inner = self.inner.lock().unwrap();
        if let Some(stop) = inner.stop.take() {
            let _ = stop.send(true);
        }
        kill_tunnel(&mut inner);
        inner.run += 1;
        let run = inner.run;
        let (tx, rx) = watch::channel(false);
        inner.stop = Some(tx);
        let mut guard = self.guard.lock().unwrap();
        guard.set_token(Some(config.token.clone()));
        guard.set_tunnel_host(None);
        inner.tunnel_host = None;
        inner.error = None;
        supervise(self.inner.clone(), self.guard.clone(), handler, config.port, run, rx, find_program, timing)
    }
}

/// The link that the QR code carries. The part after `#` never goes to a server.
fn pairing_link(host: &str, token: &str) -> String {
    format!("https://{host}/#t={token}")
}

fn pairing_qr(host: &str, token: &str) -> Option<String> {
    let code = qrcode::QrCode::new(pairing_link(host, token).as_bytes()).ok()?;
    Some(
        code.render::<qrcode::render::svg::Color>()
            .min_dimensions(220, 220)
            .dark_color(qrcode::render::svg::Color("#0b0c0e"))
            .light_color(qrcode::render::svg::Color("#ffffff"))
            .build(),
    )
}

/// The folder of the records of the program `ngrok` of each Heidrun Code, next to the file `mobile.json`.
fn record_folder() -> PathBuf {
    crate::config::config_folder().join("mobile_ngrok")
}

fn kill_tunnel(inner: &mut Inner) {
    if let Some(mut child) = inner.tunnel.take() {
        let _ = child.start_kill();
        if let Some(record) = &inner.record {
            record.clear();
        }
    }
}

/// Shows a new state, unless a newer run has taken over. The guard learns the host name of the tunnel at the same time, so a
/// request passes only while the status says that the tunnel is up.
fn publish(inner: &Mutex<Inner>, guard: &Mutex<AccessGuard>, run: u64, tunnel_host: Option<String>, error: Option<MobileError>) {
    let mut inner = inner.lock().unwrap();
    if inner.run != run {
        return;
    }
    guard.lock().unwrap().set_tunnel_host(tunnel_host.clone());
    inner.tunnel_host = tunnel_host;
    inner.error = error;
}

/// Waits for the number of seconds, or for the stop. True when the stop came.
async fn pause(stop: &watch::Receiver<bool>, duration: Duration) -> bool {
    let mut stop = stop.clone();
    tokio::select! {
        _ = tokio::time::sleep(duration) => false,
        _ = stop.changed() => true,
    }
}

/// How one run of the program `ngrok` ended.
enum TunnelEnd {
    /// The developer turned the access off, or a new run replaced this run.
    Stopped,
    /// The tunnel is down for this reason.
    Failed(MobileError),
}

/// Listens on the loopback address, and keeps the tunnel open: it starts the program `ngrok` again after a problem.
#[allow(clippy::too_many_arguments)]
async fn supervise(
    inner: Arc<Mutex<Inner>>,
    guard: Arc<Mutex<AccessGuard>>,
    handler: Arc<dyn MobileCallHandler>,
    port: u16,
    run: u64,
    mut stop: watch::Receiver<bool>,
    find_program: ProgramFinder,
    timing: Timing,
) {
    let requested = SocketAddr::new(Ipv4Addr::LOCALHOST.into(), port);
    let listener = loop {
        if *stop.borrow() {
            return;
        }
        match tokio::net::TcpListener::bind(requested).await {
            Ok(listener) => break listener,
            Err(e) => {
                publish(&inner, &guard, run, None, Some(MobileError::new(MobileErrorKind::CannotListen, format!("{requested}: {e}"))));
                // Often the previous server still closing (revoke, restart): retry soon.
                if pause(&stop, Duration::from_secs(2)).await {
                    return;
                }
            }
        }
    };
    let local_port = listener.local_addr().map(|address| address.port()).unwrap_or(port);
    let shared = Shared { guard: guard.clone(), handler };
    let (down_tx, down_rx) = oneshot::channel::<()>();
    let server = tokio::spawn(async move {
        let _ = axum::serve(listener, router(shared))
            .with_graceful_shutdown(async move {
                let _ = down_rx.await;
            })
            .await;
    });
    loop {
        if *stop.borrow() {
            break;
        }
        let end = match find_program() {
            Some(program) => run_tunnel(&inner, &guard, run, &program, local_port, &mut stop, timing).await,
            None => TunnelEnd::Failed(MobileError::new(MobileErrorKind::NgrokMissing, "")),
        };
        match end {
            TunnelEnd::Stopped => break,
            TunnelEnd::Failed(error) => {
                let wait = if error.kind == MobileErrorKind::NgrokNotSignedIn { timing.retry * 3 } else { timing.retry };
                publish(&inner, &guard, run, None, Some(error));
                if pause(&stop, wait).await {
                    break;
                }
            }
        }
    }
    let _ = down_tx.send(());
    // Open connections get a moment to finish, then the old server is gone.
    let _ = tokio::time::timeout(Duration::from_secs(3), server).await;
    publish(&inner, &guard, run, None, None);
}

/// Runs the program `ngrok` once, and reads its messages until it ends or until the stop. The address of the tunnel is
/// published at once when the program announces it: the host name of the account is fixed, so every name server already
/// knows it.
async fn run_tunnel(inner: &Mutex<Inner>, guard: &Mutex<AccessGuard>, run: u64, program: &Path, local_port: u16, stop: &mut watch::Receiver<bool>, timing: Timing) -> TunnelEnd {
    let record = inner.lock().unwrap().record.clone();
    if let Some(record) = &record {
        let record = record.clone();
        let _ = tokio::task::spawn_blocking(move || record.kill_leftover()).await;
    }
    let (child, mut messages) = match tunnel::spawn(program, local_port) {
        Ok(started) => started,
        Err(e) => return TunnelEnd::Failed(MobileError::new(MobileErrorKind::NgrokCannotStart, format!("{}: {e}", program.display()))),
    };
    {
        let mut inner = inner.lock().unwrap();
        if inner.run != run {
            return TunnelEnd::Stopped;
        }
        if let (Some(record), Some(process_id)) = (&record, child.id()) {
            record.save(process_id);
        }
        inner.tunnel = Some(child);
    }
    let no_address = tokio::time::sleep(timing.no_address);
    tokio::pin!(no_address);
    let mut is_announced = false;
    let mut kind_of_end: Option<MobileErrorKind> = None;
    let mut last_problem = String::new();
    let mut last_text = String::new();
    loop {
        tokio::select! {
            _ = stop.changed() => {
                kill_own_tunnel(inner, run);
                return TunnelEnd::Stopped;
            }
            _ = &mut no_address, if !is_announced => {
                kill_own_tunnel(inner, run);
                return TunnelEnd::Failed(MobileError::new(MobileErrorKind::NgrokNoAddress, ""));
            }
            line = messages.recv() => match line {
                Some(line) => match tunnel::read_message(&line) {
                    tunnel::Message::Announced(host) => {
                        if !is_announced {
                            is_announced = true;
                            publish(inner, guard, run, Some(host), None);
                        }
                    }
                    tunnel::Message::Problem(text) => {
                        kind_of_end = kind_of_end.or_else(|| kind_of_problem(&text));
                        last_problem = text;
                    }
                    tunnel::Message::Plain(text) => {
                        kind_of_end = kind_of_end.or_else(|| kind_of_problem(&text));
                        last_text = text;
                    }
                    tunnel::Message::Other => {}
                },
                None => {
                    kill_own_tunnel(inner, run);
                    let detail = if last_problem.is_empty() { last_text } else { last_problem };
                    return TunnelEnd::Failed(MobileError::new(kind_of_end.unwrap_or(MobileErrorKind::NgrokStopped), detail));
                }
            }
        }
    }
}

/// The kind of end that a text of `ngrok` tells, when the text holds the code of a problem that Heidrun Code knows.
fn kind_of_problem(text: &str) -> Option<MobileErrorKind> {
    if text.contains(tunnel::NOT_SIGNED_IN_CODE) {
        Some(MobileErrorKind::NgrokNotSignedIn)
    } else if text.contains(tunnel::ADDRESS_IN_USE_CODE) {
        Some(MobileErrorKind::NgrokAddressInUse)
    } else {
        None
    }
}

/// Kills the program of this run. A newer run has already killed it, and owns the slot now: then nothing happens.
fn kill_own_tunnel(inner: &Mutex<Inner>, run: u64) {
    let mut inner = inner.lock().unwrap();
    if inner.run == run {
        kill_tunnel(&mut inner);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::handler::CallFuture;
    use crate::tunnel::fake;
    use serde_json::{json, Value};
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    struct EchoHandler;

    impl MobileCallHandler for EchoHandler {
        fn handle_call(&self, method: String, _params: Value) -> CallFuture {
            Box::pin(async move { Ok(json!({ "method": method })) })
        }
    }

    /// A short retry, so that a test of a problem does not take half a minute. The wait for the address is long: the first start of a
    /// new fake program can take a second on a busy computer, and a test must not depend on that.
    const SHORT: Timing = Timing { no_address: Duration::from_secs(8), retry: Duration::from_millis(100) };

    /// A short wait for the address, only for the tests of a program that stays silent.
    const QUICK_NO_ADDRESS: Timing = Timing { no_address: Duration::from_millis(600), retry: Duration::from_millis(100) };

    fn finder(program: &Path) -> ProgramFinder {
        let program = program.to_path_buf();
        Arc::new(move || Some(program.clone()))
    }

    fn no_program() -> ProgramFinder {
        Arc::new(|| None)
    }

    fn config(enabled: bool, token: &str) -> MobileConfig {
        MobileConfig { enabled, token: token.to_string(), port: 0 }
    }

    /// A fake `ngrok` that announces the tunnel, then waits like the real program.
    fn announcing_program(name: &str) -> PathBuf {
        fake::write(name, &format!("{}\nexec sleep 600", fake::ANNOUNCEMENT))
    }

    async fn wait_until_running(server: &MobileServer, config: &MobileConfig) -> MobileStatus {
        for _ in 0..150 {
            let status = server.status(config);
            if status.running {
                return status;
            }
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
        panic!("the tunnel never came up: {:?}", server.status(config).error);
    }

    async fn wait_for_error(server: &MobileServer, config: &MobileConfig) -> MobileError {
        for _ in 0..150 {
            if let Some(error) = server.status(config).error {
                return error;
            }
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
        panic!("the status never showed an error");
    }

    /// Sends one raw HTTP request to the loopback port, and returns the status code (0 when the connection is refused or
    /// closed). `host` and `origin` are the headers that the tunnel of ngrok would send.
    async fn post_state(port: u16, host: &str, origin: Option<&str>, token: &str) -> u16 {
        let Ok(mut stream) = tokio::net::TcpStream::connect(("127.0.0.1", port)).await else {
            return 0;
        };
        let body = r#"{"method":"state"}"#;
        let origin_header = origin.map(|origin| format!("origin: {origin}\r\n")).unwrap_or_default();
        let request = format!("POST /api HTTP/1.1\r\nHost: {host}\r\n{origin_header}x-herdr-token: {token}\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{body}", body.len());
        if stream.write_all(request.as_bytes()).await.is_err() {
            return 0;
        }
        let mut answer = String::new();
        let _ = stream.read_to_string(&mut answer).await;
        answer.split_whitespace().nth(1).and_then(|code| code.parse().ok()).unwrap_or(0)
    }

    async fn paired_call(port: u16, token: &str) -> u16 {
        let origin = format!("https://{}", fake::ANNOUNCED_HOST);
        post_state(port, fake::ANNOUNCED_HOST, Some(&origin), token).await
    }

    #[test]
    fn the_pairing_link_is_the_address_of_the_tunnel_then_the_key_after_a_hash() {
        assert_eq!(pairing_link("words.ngrok-free.dev", "abc123"), "https://words.ngrok-free.dev/#t=abc123");
    }

    #[tokio::test]
    async fn reads_the_address_of_the_tunnel_and_shows_it_as_the_address_of_the_page() {
        let server = MobileServer::new();
        let config = config(true, "secret");
        let program = announcing_program("address");
        tokio::spawn(server.start_with(Arc::new(EchoHandler), &config, finder(&program), SHORT));
        let status = wait_until_running(&server, &config).await;
        assert_eq!(status.url.as_deref(), Some("https://fake-words-of-the-tunnel.ngrok-free.dev/"));
        assert!(status.error.is_none());
        server.stop();
    }

    #[tokio::test]
    async fn starts_the_program_for_the_port_where_the_server_listens() {
        let server = MobileServer::new();
        let config = config(true, "secret");
        let program = announcing_program("port");
        tokio::spawn(server.start_with(Arc::new(EchoHandler), &config, finder(&program), SHORT));
        wait_until_running(&server, &config).await;
        let port = fake::port_of(&program).unwrap();
        assert_ne!(port, 0);
        assert_eq!(paired_call(port, "secret").await, 200);
        server.stop();
    }

    #[tokio::test]
    async fn the_server_answers_the_host_of_the_tunnel_and_nothing_else() {
        let server = MobileServer::new();
        let config = config(true, "secret");
        let program = announcing_program("guards");
        tokio::spawn(server.start_with(Arc::new(EchoHandler), &config, finder(&program), SHORT));
        wait_until_running(&server, &config).await;
        let port = fake::port_of(&program).unwrap();
        let origin = format!("https://{}", fake::ANNOUNCED_HOST);
        assert_eq!(paired_call(port, "secret").await, 200);
        assert_eq!(paired_call(port, "wrong").await, 401);
        assert_eq!(post_state(port, &format!("127.0.0.1:{port}"), None, "secret").await, 403);
        assert_eq!(post_state(port, "evil.example", None, "secret").await, 403);
        assert_eq!(post_state(port, fake::ANNOUNCED_HOST, Some("https://evil.example"), "secret").await, 403);
        assert_eq!(post_state(port, fake::ANNOUNCED_HOST, Some(&origin), "secret").await, 200);
        server.stop();
    }

    /// The address that this computer has on its network, found with a UDP socket that sends nothing. None when the computer
    /// has no network: then the test below has nothing to try.
    fn address_on_the_network() -> Option<std::net::IpAddr> {
        let socket = std::net::UdpSocket::bind("0.0.0.0:0").ok()?;
        socket.connect("192.0.2.1:9").ok()?;
        let address = socket.local_addr().ok()?.ip();
        (!address.is_loopback() && !address.is_unspecified()).then_some(address)
    }

    #[tokio::test]
    async fn the_server_listens_on_the_loopback_address_and_not_on_the_address_of_the_network() {
        let server = MobileServer::new();
        let config = config(true, "secret");
        let program = announcing_program("loopback_only");
        tokio::spawn(server.start_with(Arc::new(EchoHandler), &config, finder(&program), SHORT));
        wait_until_running(&server, &config).await;
        let port = fake::port_of(&program).unwrap();
        assert!(tokio::net::TcpStream::connect(("127.0.0.1", port)).await.is_ok());
        if let Some(address) = address_on_the_network() {
            let attempt = tokio::net::TcpStream::connect((address, port)).await;
            assert!(attempt.is_err(), "the server answers on the address {address} of the network");
        }
        server.stop();
    }

    #[tokio::test]
    async fn nothing_passes_before_the_program_announces_the_address() {
        let server = MobileServer::new();
        let config = config(true, "secret");
        let program = fake::write("silent", "exec sleep 600");
        tokio::spawn(server.start_with(Arc::new(EchoHandler), &config, finder(&program), Timing::default()));
        for _ in 0..150 {
            if fake::port_of(&program).is_some() {
                break;
            }
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
        let port = fake::port_of(&program).unwrap();
        let status = server.status(&config);
        assert!(!status.running);
        assert!(status.url.is_none());
        assert!(status.qr.is_none());
        assert_eq!(paired_call(port, "secret").await, 403);
        server.stop();
    }

    #[tokio::test]
    async fn the_address_is_shown_at_once_when_the_program_announces_it_and_not_before() {
        let server = MobileServer::new();
        let config = config(true, "secret");
        let program = fake::write("late_announcement", &format!("sleep 1\n{}\nexec sleep 600", fake::ANNOUNCEMENT));
        let slow = Timing { no_address: Duration::from_secs(5), retry: Duration::from_millis(100) };
        let started = tokio::time::Instant::now();
        tokio::spawn(server.start_with(Arc::new(EchoHandler), &config, finder(&program), slow));
        for _ in 0..150 {
            if fake::port_of(&program).is_some() {
                break;
            }
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
        let port = fake::port_of(&program).unwrap();
        tokio::time::sleep(Duration::from_millis(300)).await;
        let early = server.status(&config);
        assert!(!early.running);
        assert!(early.url.is_none());
        assert!(early.qr.is_none());
        assert_eq!(paired_call(port, "secret").await, 403);
        wait_until_running(&server, &config).await;
        assert!(started.elapsed() >= Duration::from_millis(1000));
        assert_eq!(paired_call(port, "secret").await, 200);
        server.stop();
    }

    #[tokio::test]
    async fn the_qr_code_carries_the_pairing_link_only_when_the_access_is_on() {
        let server = MobileServer::new();
        let on = config(true, "secret");
        let program = announcing_program("qr");
        tokio::spawn(server.start_with(Arc::new(EchoHandler), &on, finder(&program), SHORT));
        let status = wait_until_running(&server, &on).await;
        let qr = status.qr.unwrap();
        assert!(qr.contains("<svg"));
        assert_eq!(Some(qr), pairing_qr(fake::ANNOUNCED_HOST, "secret"));
        assert_ne!(pairing_qr(fake::ANNOUNCED_HOST, "secret"), pairing_qr(fake::ANNOUNCED_HOST, "other"));
        assert!(server.status(&config(false, "secret")).qr.is_none());
        server.stop();
    }

    #[tokio::test]
    async fn the_status_gives_the_pairing_link_with_the_key_only_when_the_access_is_on() {
        let server = MobileServer::new();
        let on = config(true, "secret");
        let program = announcing_program("link");
        tokio::spawn(server.start_with(Arc::new(EchoHandler), &on, finder(&program), SHORT));
        let status = wait_until_running(&server, &on).await;
        assert_eq!(status.link.as_deref(), Some("https://fake-words-of-the-tunnel.ngrok-free.dev/#t=secret"));
        assert_eq!(status.url.as_deref(), Some("https://fake-words-of-the-tunnel.ngrok-free.dev/"));
        assert!(server.status(&config(false, "secret")).link.is_none());
        server.stop();
        assert!(server.status(&on).link.is_none());
    }

    #[tokio::test]
    async fn a_new_key_cuts_off_the_old_key_at_once() {
        let server = MobileServer::new();
        let first = config(true, "first");
        let program = announcing_program("new_key");
        tokio::spawn(server.start_with(Arc::new(EchoHandler), &first, finder(&program), SHORT));
        wait_until_running(&server, &first).await;
        let port = fake::port_of(&program).unwrap();
        assert_eq!(paired_call(port, "first").await, 200);
        // The same port again: the new run waits for the old listener to close.
        let second = MobileConfig { enabled: true, token: "second".to_string(), port };
        tokio::spawn(server.start_with(Arc::new(EchoHandler), &second, finder(&program), SHORT));
        for _ in 0..200 {
            if paired_call(port, "second").await == 200 {
                break;
            }
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
        assert_eq!(paired_call(port, "second").await, 200);
        assert_eq!(paired_call(port, "first").await, 401);
        server.stop();
    }

    #[tokio::test]
    async fn a_replaced_key_cuts_off_the_old_key_at_once_and_the_tunnel_keeps_its_address_and_its_program() {
        let server = MobileServer::new();
        let first = config(true, "first");
        let program = announcing_program("replace_key");
        tokio::spawn(server.start_with(Arc::new(EchoHandler), &first, finder(&program), SHORT));
        let before = wait_until_running(&server, &first).await;
        let port = fake::port_of(&program).unwrap();
        let pid = fake::pid_of(&program).unwrap();
        assert_eq!(paired_call(port, "first").await, 200);
        server.replace_token("second");
        assert_eq!(paired_call(port, "first").await, 401);
        assert_eq!(paired_call(port, "second").await, 200);
        let second = config(true, "second");
        let after = server.status(&second);
        assert!(after.running);
        assert_eq!(after.url, before.url);
        assert_ne!(after.qr, before.qr);
        assert_ne!(after.link, before.link);
        assert_eq!(after.link.as_deref(), Some("https://fake-words-of-the-tunnel.ngrok-free.dev/#t=second"));
        assert_eq!(fake::pid_of(&program), Some(pid));
        assert!(fake::is_alive(pid));
        server.stop();
    }

    #[tokio::test]
    async fn a_replaced_key_does_nothing_when_the_server_is_stopped() {
        let server = MobileServer::new();
        let config = config(true, "first");
        let program = announcing_program("replace_key_stopped");
        tokio::spawn(server.start_with(Arc::new(EchoHandler), &config, finder(&program), SHORT));
        wait_until_running(&server, &config).await;
        let port = fake::port_of(&program).unwrap();
        server.stop();
        server.replace_token("second");
        for _ in 0..100 {
            if paired_call(port, "second").await != 200 {
                return;
            }
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
        panic!("the server accepts a key after stop");
    }

    #[tokio::test]
    async fn stop_closes_the_server_kills_the_program_and_forgets_the_key() {
        let server = MobileServer::new();
        let config = config(true, "secret");
        let program = announcing_program("stop");
        tokio::spawn(server.start_with(Arc::new(EchoHandler), &config, finder(&program), SHORT));
        wait_until_running(&server, &config).await;
        let port = fake::port_of(&program).unwrap();
        let pid = fake::pid_of(&program).unwrap();
        assert!(fake::is_alive(pid));
        server.stop();
        let status = server.status(&config);
        assert!(!status.running);
        assert!(status.url.is_none());
        assert!(status.qr.is_none());
        for _ in 0..100 {
            if paired_call(port, "secret").await != 200 && !fake::is_alive(pid) {
                return;
            }
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
        panic!("the server still answers, or the program is still alive, after stop");
    }

    #[tokio::test]
    async fn without_the_program_the_status_says_that_it_is_missing() {
        let server = MobileServer::new();
        let config = config(true, "secret");
        tokio::spawn(server.start_with(Arc::new(EchoHandler), &config, no_program(), SHORT));
        let error = wait_for_error(&server, &config).await;
        assert_eq!(error.kind, MobileErrorKind::NgrokMissing);
        let status = server.status(&config);
        assert!(!status.running);
        assert!(status.url.is_none());
        server.stop();
    }

    #[tokio::test]
    async fn the_program_is_found_again_after_the_developer_installs_it() {
        let server = MobileServer::new();
        let config = config(true, "secret");
        let program = announcing_program("installed_later");
        let installed = Arc::new(Mutex::new(false));
        let installed_in_finder = installed.clone();
        let program_in_finder = program.clone();
        let find_program: ProgramFinder = Arc::new(move || (*installed_in_finder.lock().unwrap()).then(|| program_in_finder.clone()));
        tokio::spawn(server.start_with(Arc::new(EchoHandler), &config, find_program, SHORT));
        assert_eq!(wait_for_error(&server, &config).await.kind, MobileErrorKind::NgrokMissing);
        *installed.lock().unwrap() = true;
        let status = wait_until_running(&server, &config).await;
        assert!(status.error.is_none());
        server.stop();
    }

    #[tokio::test]
    async fn a_program_that_the_system_refuses_to_start_gives_an_error() {
        let server = MobileServer::new();
        let config = config(true, "secret");
        let program = fake::write("refused", "exit 0");
        let broken = program.with_file_name("not_there");
        tokio::spawn(server.start_with(Arc::new(EchoHandler), &config, finder(&broken), SHORT));
        let error = wait_for_error(&server, &config).await;
        assert_eq!(error.kind, MobileErrorKind::NgrokCannotStart);
        assert!(error.detail.contains("not_there"));
        server.stop();
    }

    #[tokio::test]
    async fn a_program_that_ends_gives_its_last_problem_and_is_started_again() {
        let server = MobileServer::new();
        let config = config(true, "secret");
        // The first run ends with an error. The second run announces the tunnel.
        let body = format!(
            "marker=\"$folder/second_run\"\nif [ ! -f \"$marker\" ]; then\n  touch \"$marker\"\n  printf '%s\\n' '{{\"lvl\":\"eror\",\"msg\":\"session closing\",\"err\":\"connection reset by peer\"}}'\n  exit 1\nfi\n{}\nexec sleep 600",
            fake::ANNOUNCEMENT
        );
        let program = fake::write("restart", &body);
        let slow_retry = Timing { no_address: Duration::from_secs(5), retry: Duration::from_millis(600) };
        tokio::spawn(server.start_with(Arc::new(EchoHandler), &config, finder(&program), slow_retry));
        let error = wait_for_error(&server, &config).await;
        assert_eq!(error.kind, MobileErrorKind::NgrokStopped);
        assert_eq!(error.detail, "connection reset by peer");
        let status = wait_until_running(&server, &config).await;
        assert_eq!(status.url.as_deref(), Some("https://fake-words-of-the-tunnel.ngrok-free.dev/"));
        server.stop();
    }

    #[tokio::test]
    async fn a_program_that_ends_with_no_problem_record_gives_its_last_plain_line() {
        let server = MobileServer::new();
        let config = config(true, "secret");
        let program = fake::write("plain_line", "echo 'ERROR: unknown flag' >&2\nexit 2");
        tokio::spawn(server.start_with(Arc::new(EchoHandler), &config, finder(&program), SHORT));
        let error = wait_for_error(&server, &config).await;
        assert_eq!(error.kind, MobileErrorKind::NgrokStopped);
        assert_eq!(error.detail, "ERROR: unknown flag");
        server.stop();
    }

    #[tokio::test]
    async fn a_program_without_an_account_gives_the_error_not_signed_in_with_the_words_of_ngrok() {
        let server = MobileServer::new();
        let config = config(true, "secret");
        let program = fake::write("not_signed_in", fake::NOT_SIGNED_IN);
        tokio::spawn(server.start_with(Arc::new(EchoHandler), &config, finder(&program), SHORT));
        let error = wait_for_error(&server, &config).await;
        assert_eq!(error.kind, MobileErrorKind::NgrokNotSignedIn);
        assert!(error.detail.contains("This ngrok session is not authenticated"), "{}", error.detail);
        assert!(!server.status(&config).running);
        server.stop();
    }

    #[tokio::test]
    async fn a_program_that_finds_its_fixed_address_in_use_gives_the_error_address_in_use() {
        let server = MobileServer::new();
        let config = config(true, "secret");
        let program = fake::write("address_in_use", fake::ADDRESS_IN_USE);
        tokio::spawn(server.start_with(Arc::new(EchoHandler), &config, finder(&program), SHORT));
        let error = wait_for_error(&server, &config).await;
        assert_eq!(error.kind, MobileErrorKind::NgrokAddressInUse);
        assert!(error.detail.contains("is already online"), "{}", error.detail);
        server.stop();
    }

    #[tokio::test]
    async fn after_the_error_not_signed_in_the_next_try_waits_three_times_longer() {
        let server = MobileServer::new();
        let config = config(true, "secret");
        let counting = format!("echo x >> \"$folder/starts\"\n{}", fake::NOT_SIGNED_IN);
        let program = fake::write("slow_retry_not_signed_in", &counting);
        let starts = |program: &Path| std::fs::read_to_string(program.with_file_name("starts")).map(|text| text.lines().count()).unwrap_or(0);
        let timing = Timing { no_address: Duration::from_secs(5), retry: Duration::from_millis(400) };
        tokio::spawn(server.start_with(Arc::new(EchoHandler), &config, finder(&program), timing));
        wait_for_error(&server, &config).await;
        tokio::time::sleep(Duration::from_millis(700)).await;
        assert_eq!(starts(&program), 1, "the second try came before three times the wait");
        tokio::time::sleep(Duration::from_millis(1300)).await;
        assert!(starts(&program) >= 2, "the second try never came");
        server.stop();
    }

    #[tokio::test]
    async fn a_program_that_prints_no_address_in_time_is_killed_and_gives_an_error() {
        let server = MobileServer::new();
        let config = config(true, "secret");
        let program = fake::write("no_address", "exec sleep 600");
        tokio::spawn(server.start_with(Arc::new(EchoHandler), &config, finder(&program), QUICK_NO_ADDRESS));
        for _ in 0..100 {
            if fake::pid_of(&program).is_some() {
                break;
            }
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
        let pid = fake::pid_of(&program).unwrap();
        let error = wait_for_error(&server, &config).await;
        assert_eq!(error.kind, MobileErrorKind::NgrokNoAddress);
        for _ in 0..100 {
            if !fake::is_alive(pid) {
                server.stop();
                return;
            }
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
        server.stop();
        panic!("the silent program is still alive after the error");
    }

    #[test]
    fn a_task_of_an_old_run_changes_nothing() {
        let inner = Mutex::new(Inner { run: 2, ..Inner::default() });
        let guard = Mutex::new(AccessGuard::default());
        publish(&inner, &guard, 1, Some("old.ngrok-free.dev".to_string()), None);
        assert_eq!(inner.lock().unwrap().tunnel_host, None);
        publish(&inner, &guard, 1, None, Some(MobileError::new(MobileErrorKind::NgrokStopped, "old")));
        assert_eq!(inner.lock().unwrap().error, None);
        publish(&inner, &guard, 2, Some("new.ngrok-free.dev".to_string()), None);
        assert_eq!(inner.lock().unwrap().tunnel_host.as_deref(), Some("new.ngrok-free.dev"));
    }

    #[test]
    fn the_guard_learns_the_host_name_of_the_tunnel_with_the_status() {
        let inner = Mutex::new(Inner { run: 1, ..Inner::default() });
        let guard = Mutex::new(AccessGuard::default());
        guard.lock().unwrap().set_token(Some("secret".to_string()));
        let now = std::time::Instant::now();
        let refused = guard.lock().unwrap().authorize(Some("words.ngrok-free.dev"), None, Some("secret"), now);
        assert!(refused.is_err());
        publish(&inner, &guard, 1, Some("words.ngrok-free.dev".to_string()), None);
        let accepted = guard.lock().unwrap().authorize(Some("words.ngrok-free.dev"), None, Some("secret"), now);
        assert!(accepted.is_ok());
        publish(&inner, &guard, 1, None, Some(MobileError::new(MobileErrorKind::NgrokStopped, "")));
        let refused_again = guard.lock().unwrap().authorize(Some("words.ngrok-free.dev"), None, Some("secret"), now);
        assert!(refused_again.is_err());
    }

    /// Asks the public address of the tunnel for one thing with `curl`, and returns the status code of the answer (`000`
    /// when `curl` gets no answer). A `call_key` of `Some(Some(key))` is a POST of the call "state" with that key,
    /// `Some(None)` is a POST with no key, and `None` is a plain GET of the page.
    async fn public_status(url: &str, call_key: Option<Option<&str>>) -> String {
        let mut command = tokio::process::Command::new("curl");
        command.args(["-sS", "-m", "10", "-o", "/dev/null", "-w", "%{http_code}"]);
        if let Some(key) = call_key {
            command.args(["-X", "POST", "-d", r#"{"method":"state"}"#]);
            if let Some(key) = key {
                command.args(["-H", &format!("x-herdr-token: {key}")]);
            }
        }
        let output = command.arg(url).output().await.unwrap();
        String::from_utf8_lossy(&output.stdout).trim().to_string()
    }

    /// Waits until the public address gives the wanted status. The tunnel needs a few seconds after its announcement.
    async fn wait_for_public_status(url: &str, call_key: Option<Option<&str>>, wanted: &str) -> String {
        let mut last = String::new();
        for _ in 0..30 {
            last = public_status(url, call_key).await;
            if last == wanted {
                return last;
            }
            tokio::time::sleep(Duration::from_secs(2)).await;
        }
        last
    }

    /// A check against the real ngrok: it opens a real tunnel on the Internet for a few seconds, with a server that
    /// answers every paired call with the name of the method. Run it by hand, with the program `ngrok` installed and
    /// signed in: `cargo test live_ -- --ignored --nocapture`. It also proves that a second start gives the same address.
    #[tokio::test]
    #[ignore = "opens a real ngrok tunnel on the Internet"]
    async fn live_the_real_ngrok_gives_the_same_public_address_that_reaches_the_server() {
        let program = tunnel::find_ngrok().expect("the program ngrok is not installed");
        let config = config(true, "live-test-key");
        let mut first_url = String::new();
        for round in 1..=2 {
            let server = MobileServer::new();
            tokio::spawn(server.start_with(Arc::new(EchoHandler), &config, finder(&program), Timing::default()));
            let mut status = server.status(&config);
            for _ in 0..600 {
                status = server.status(&config);
                if status.running || status.error.is_some() {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(100)).await;
            }
            let url = status.url.clone().unwrap_or_else(|| panic!("no public address: {:?}", status.error));
            println!("round {round}, public address: {url}");
            assert!(url.starts_with("https://") && url.ends_with('/'));
            assert!(status.qr.unwrap().contains("<svg"));
            let page = wait_for_public_status(&url, None, "200").await;
            assert_eq!(page, "200", "the page of the mobile website");
            let api = format!("{url}api");
            assert_eq!(wait_for_public_status(&api, Some(Some("live-test-key")), "200").await, "200", "a paired call");
            assert_eq!(public_status(&api, Some(Some("wrong-key"))).await, "401", "a wrong key");
            assert_eq!(public_status(&api, Some(None)).await, "401", "no key");
            if round == 1 {
                first_url = url;
            } else {
                assert_eq!(url, first_url, "the address changed after a restart");
            }
            server.stop();
            assert!(!server.status(&config).running);
            tokio::time::sleep(Duration::from_secs(3)).await;
        }
    }
}
