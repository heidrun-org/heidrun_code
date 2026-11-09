//! The life of the server: it listens on every address of the computer, so that a device of the local network reaches
//! it, and stops on demand.

use crate::access::AccessGuard;
use crate::config::HeidrunCodeDashboardServerConfig;
use crate::handler::HeidrunCodeDashboardServerHandler;
use crate::router::{router, Shared, PAGE_PATH};
use serde::Serialize;
use std::future::Future;
use std::net::{Ipv4Addr, SocketAddr, UdpSocket};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::sync::watch;

/// What the section "Heidrun Code Dashboard" of the Settings window shows.
#[derive(Serialize, Debug)]
pub struct HeidrunCodeDashboardServerStatus {
    /// True when the developer turned on "Show the Heidrun Code Dashboard on the local network".
    pub enabled: bool,
    /// True when the server listens.
    pub running: bool,
    /// The address of the page with the pairing key, for example `http://192.168.1.20:51234/heidrun_code_dashboard?key=…`. None while the
    /// server does not listen, or while the computer has no address on a local network.
    pub address: Option<String>,
    /// The same address as a QR code (SVG).
    pub qr: Option<String>,
    /// Why the server does not work.
    pub error: Option<HeidrunCodeDashboardServerError>,
}

/// Why the server does not work. The Settings window writes the sentence, in the language of the developer.
#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct HeidrunCodeDashboardServerError {
    /// What went wrong.
    pub kind: HeidrunCodeDashboardServerErrorKind,
    /// The words of the system about the problem. It can be empty.
    pub detail: String,
}

/// What can go wrong. The names reach the Settings window in camel case, for example `cannotListen`.
#[derive(Serialize, Clone, Copy, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum HeidrunCodeDashboardServerErrorKind {
    /// The server cannot listen on its port.
    CannotListen,
    /// The computer has no address on a local network: no Wi-Fi and no cable.
    NoNetwork,
}

#[derive(Default)]
struct Inner {
    /// The number of the current run. A task of an older run changes nothing.
    run: u64,
    /// Stops the current server (and its open connections).
    stop: Option<watch::Sender<bool>>,
    /// True while the server of the current run listens.
    is_listening: bool,
    error: Option<HeidrunCodeDashboardServerError>,
}

/// The Heidrun Code Dashboard server. One value lives as long as the application. Every method takes `&self`.
#[derive(Default)]
pub struct HeidrunCodeDashboardServer {
    inner: Arc<Mutex<Inner>>,
    guard: Arc<Mutex<AccessGuard>>,
}

impl HeidrunCodeDashboardServer {
    /// A server that does not listen yet.
    pub fn new() -> Self {
        Self::default()
    }

    /// Prepares a new run, and returns the future that runs it. The caller must spawn the future on its async runtime:
    /// nothing listens before that. A run that is already going stops.
    pub fn start(&self, handler: Arc<dyn HeidrunCodeDashboardServerHandler>, config: &HeidrunCodeDashboardServerConfig) -> impl Future<Output = ()> + Send + 'static {
        self.start_on(handler, config, Ipv4Addr::UNSPECIFIED)
    }

    /// Accepts this new pairing key from now on, and refuses the old key at once. Nothing happens while no run is going.
    pub fn replace_key(&self, key: &str) {
        let inner = self.inner.lock().unwrap();
        if inner.stop.is_some() {
            self.guard.lock().unwrap().set_key(Some(key.to_string()));
        }
    }

    /// Turns the option off: the server stops, and no key is accepted.
    pub fn stop(&self) {
        let mut inner = self.inner.lock().unwrap();
        if let Some(stop) = inner.stop.take() {
            let _ = stop.send(true);
        }
        inner.run += 1;
        inner.is_listening = false;
        inner.error = None;
        self.guard.lock().unwrap().set_key(None);
    }

    /// What the Settings window shows. `config` gives the pairing key and the port that the address carries.
    pub fn status(&self, config: &HeidrunCodeDashboardServerConfig) -> HeidrunCodeDashboardServerStatus {
        self.status_with(config, local_network_address())
    }

    fn status_with(&self, config: &HeidrunCodeDashboardServerConfig, network_address: Option<Ipv4Addr>) -> HeidrunCodeDashboardServerStatus {
        let inner = self.inner.lock().unwrap();
        let is_running = config.enabled && inner.is_listening && inner.error.is_none();
        let mut error = inner.error.clone();
        if is_running && network_address.is_none() {
            error = Some(HeidrunCodeDashboardServerError { kind: HeidrunCodeDashboardServerErrorKind::NoNetwork, detail: String::new() });
        }
        let address = network_address
            .filter(|_| is_running)
            .map(|network_address| page_address(network_address, config.port, &config.key));
        let qr = address.as_deref().and_then(page_qr);
        HeidrunCodeDashboardServerStatus { enabled: config.enabled, running: is_running, address, qr, error }
    }

    fn start_on(&self, handler: Arc<dyn HeidrunCodeDashboardServerHandler>, config: &HeidrunCodeDashboardServerConfig, listen_address: Ipv4Addr) -> impl Future<Output = ()> + Send + 'static {
        let mut inner = self.inner.lock().unwrap();
        if let Some(stop) = inner.stop.take() {
            let _ = stop.send(true);
        }
        inner.run += 1;
        let run = inner.run;
        let (sender, receiver) = watch::channel(false);
        inner.stop = Some(sender);
        inner.is_listening = false;
        inner.error = None;
        let mut guard = self.guard.lock().unwrap();
        guard.set_key(Some(config.key.clone()));
        guard.set_port(config.port);
        serve(self.inner.clone(), self.guard.clone(), handler, SocketAddr::new(listen_address.into(), config.port), run, receiver)
    }
}

/// The address of the page that the QR code carries.
pub fn page_address(network_address: Ipv4Addr, port: u16, key: &str) -> String {
    format!("http://{network_address}:{port}{PAGE_PATH}?key={key}")
}

fn page_qr(address: &str) -> Option<String> {
    let code = qrcode::QrCode::new(address.as_bytes()).ok()?;
    Some(
        code.render::<qrcode::render::svg::Color>()
            .min_dimensions(220, 220)
            .dark_color(qrcode::render::svg::Color("#0b0c0e"))
            .light_color(qrcode::render::svg::Color("#ffffff"))
            .build(),
    )
}

/// The IPv4 address of this computer on the local network: the address of the interface that the system uses for the
/// outside, usually the Wi-Fi. A UDP socket with a destination sends no packet: the system only chooses the interface.
/// None when the computer has no network, or only the loopback address.
pub fn local_network_address() -> Option<Ipv4Addr> {
    let socket = UdpSocket::bind((Ipv4Addr::UNSPECIFIED, 0)).ok()?;
    socket.connect((Ipv4Addr::new(192, 0, 2, 1), 9)).ok()?;
    match socket.local_addr().ok()?.ip() {
        std::net::IpAddr::V4(address) if address.is_loopback() == false && address.is_unspecified() == false => Some(address),
        _ => None,
    }
}

/// Changes the state, unless a newer run has taken over.
fn publish(inner: &Mutex<Inner>, run: u64, is_listening: bool, error: Option<HeidrunCodeDashboardServerError>) {
    let mut inner = inner.lock().unwrap();
    if inner.run != run {
        return;
    }
    inner.is_listening = is_listening;
    inner.error = error;
}

/// Waits for the duration, or for the stop. True when the stop came.
async fn pause(stop: &watch::Receiver<bool>, duration: Duration) -> bool {
    let mut stop = stop.clone();
    tokio::select! {
        _ = tokio::time::sleep(duration) => false,
        _ = stop.changed() => true,
    }
}

async fn serve(
    inner: Arc<Mutex<Inner>>,
    guard: Arc<Mutex<AccessGuard>>,
    handler: Arc<dyn HeidrunCodeDashboardServerHandler>,
    requested: SocketAddr,
    run: u64,
    mut stop: watch::Receiver<bool>,
) {
    let listener = loop {
        if *stop.borrow() {
            return;
        }
        match tokio::net::TcpListener::bind(requested).await {
            Ok(listener) => break listener,
            Err(error) => {
                let error = HeidrunCodeDashboardServerError { kind: HeidrunCodeDashboardServerErrorKind::CannotListen, detail: format!("{requested}: {error}") };
                publish(&inner, run, false, Some(error));
                // Often the previous server still closing (a new key, a restart): try again soon.
                if pause(&stop, Duration::from_secs(2)).await {
                    return;
                }
            }
        }
    };
    publish(&inner, run, true, None);
    let shared = Shared { guard, handler };
    let _ = axum::serve(listener, router(shared))
        .with_graceful_shutdown(async move {
            let _ = stop.wait_for(|is_stopped| *is_stopped).await;
        })
        .await;
    publish(&inner, run, false, None);
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::handler::{AssetFuture, HeidrunCodeDashboardAsset, HeidrunCodeDashboardServerEvent, StateFuture};
    use serde_json::json;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    const KEY: &str = "0123456789abcdef";

    struct FakeHandler;

    impl HeidrunCodeDashboardServerHandler for FakeHandler {
        fn state(&self) -> StateFuture {
            Box::pin(async { Ok(json!({ "observations": null })) })
        }

        fn asset(&self, _path: String) -> AssetFuture {
            Box::pin(async { Some(HeidrunCodeDashboardAsset { bytes: b"<html>heidrun_code_dashboard</html>".to_vec(), mime_type: "text/html".into() }) })
        }

        fn record_event(&self, _event: HeidrunCodeDashboardServerEvent) {}
    }

    fn config(port: u16) -> HeidrunCodeDashboardServerConfig {
        HeidrunCodeDashboardServerConfig { enabled: true, key: KEY.to_string(), port }
    }

    /// Sends one GET request to the loopback address with the given Host, and gives the first line of the answer.
    async fn first_line(port: u16, path: &str, host: &str) -> String {
        let mut stream = tokio::net::TcpStream::connect((Ipv4Addr::LOCALHOST, port)).await.unwrap();
        let request = format!("GET {path} HTTP/1.1\r\nHost: {host}\r\nconnection: close\r\n\r\n");
        stream.write_all(request.as_bytes()).await.unwrap();
        let mut answer = String::new();
        stream.read_to_string(&mut answer).await.unwrap();
        answer.lines().next().unwrap_or("").to_string()
    }

    async fn wait_for_listening(server: &HeidrunCodeDashboardServer, config: &HeidrunCodeDashboardServerConfig) {
        for _ in 0..100 {
            if server.status_with(config, Some(Ipv4Addr::new(192, 168, 1, 20))).running {
                return;
            }
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
        panic!("the server did not listen");
    }

    #[test]
    fn the_address_of_the_page_names_the_computer_the_port_and_the_key() {
        assert_eq!(page_address(Ipv4Addr::new(192, 168, 1, 20), 51234, KEY), format!("http://192.168.1.20:51234/heidrun_code_dashboard?key={KEY}"));
    }

    #[test]
    fn the_address_of_the_local_network_is_never_the_loopback_address() {
        if let Some(address) = local_network_address() {
            assert!(address.is_loopback() == false);
        }
    }

    #[test]
    fn the_status_shows_no_address_and_no_qr_code_while_the_server_does_not_listen() {
        let server = HeidrunCodeDashboardServer::new();
        let status = server.status_with(&config(51234), Some(Ipv4Addr::new(192, 168, 1, 20)));
        assert!(status.running == false);
        assert!(status.address.is_none());
        assert!(status.qr.is_none());
    }

    #[tokio::test]
    async fn listens_answers_with_the_key_shows_the_qr_code_and_stops() {
        let port = crate::config::free_port().unwrap();
        let config = config(port);
        let server = HeidrunCodeDashboardServer::new();
        tokio::spawn(server.start_on(Arc::new(FakeHandler), &config, Ipv4Addr::LOCALHOST));
        wait_for_listening(&server, &config).await;
        let host = format!("127.0.0.1:{port}");
        assert_eq!(first_line(port, &format!("/heidrun_code_dashboard?key={KEY}"), &host).await, "HTTP/1.1 200 OK");
        assert_eq!(first_line(port, "/heidrun_code_dashboard?key=wrong", &host).await, "HTTP/1.1 401 Unauthorized");
        assert_eq!(first_line(port, &format!("/heidrun_code_dashboard?key={KEY}"), &format!("evil.example:{port}")).await, "HTTP/1.1 403 Forbidden");
        let status = server.status_with(&config, Some(Ipv4Addr::new(192, 168, 1, 20)));
        assert_eq!(status.address, Some(format!("http://192.168.1.20:{port}/heidrun_code_dashboard?key={KEY}")));
        assert!(status.qr.unwrap().starts_with("<?xml"));
        server.replace_key("fedcba9876543210");
        assert_eq!(first_line(port, &format!("/heidrun_code_dashboard?key={KEY}"), &host).await, "HTTP/1.1 401 Unauthorized");
        server.stop();
        for _ in 0..100 {
            if tokio::net::TcpStream::connect((Ipv4Addr::LOCALHOST, port)).await.is_err() {
                return;
            }
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
        panic!("the server still listens after the stop");
    }

    #[tokio::test]
    async fn the_status_says_no_network_when_the_computer_has_no_local_address() {
        let port = crate::config::free_port().unwrap();
        let config = config(port);
        let server = HeidrunCodeDashboardServer::new();
        tokio::spawn(server.start_on(Arc::new(FakeHandler), &config, Ipv4Addr::LOCALHOST));
        wait_for_listening(&server, &config).await;
        let status = server.status_with(&config, None);
        assert_eq!(status.error.map(|error| error.kind), Some(HeidrunCodeDashboardServerErrorKind::NoNetwork));
        assert!(status.address.is_none());
        server.stop();
    }

    #[tokio::test]
    async fn a_port_in_use_gives_the_error_cannot_listen() {
        let holder = std::net::TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).unwrap();
        let port = holder.local_addr().unwrap().port();
        let config = config(port);
        let server = HeidrunCodeDashboardServer::new();
        tokio::spawn(server.start_on(Arc::new(FakeHandler), &config, Ipv4Addr::LOCALHOST));
        for _ in 0..100 {
            let status = server.status_with(&config, Some(Ipv4Addr::new(192, 168, 1, 20)));
            if let Some(error) = status.error {
                assert_eq!(error.kind, HeidrunCodeDashboardServerErrorKind::CannotListen);
                server.stop();
                return;
            }
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
        panic!("no error for a port in use");
    }
}
