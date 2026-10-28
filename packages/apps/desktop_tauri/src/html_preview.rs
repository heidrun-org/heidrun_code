//! HTML preview of the file view pane: a small web server on the loopback address `127.0.0.1` serves an HTML file of a
//! project, and the images, the style sheets, the scripts, and the data files next to it, to a frame of the file view
//! pane (issues #925 and #930).
//!
//! The address is `http://127.0.0.1:<port>/<secret key>/<path inside the project>`. The server runs only while an HTML
//! preview is open, on a free port. Each preview gets its own random secret key, and the key gives the project folder,
//! so another program on the computer cannot read the files of the project, and a relative address of the page never
//! leaves the project. The page has a real web origin, so `fetch()`, module scripts, and `localStorage` work. The server
//! serves only a project that the file view pane resolved, with the same checks as the other file commands: no
//! symbolic link, no path out of the project, and nothing inside `.git`.

use crate::files::{full_path, not_in_git_dir};
use axum::body::Body;
use axum::extract::{Request, State as AxumState};
use axum::http::{header, Method, Response, StatusCode};
use axum::Router;
use percent_encoding::percent_decode_str;
use serde::Serialize;
use std::collections::HashMap;
use std::io::Read;
use std::net::Ipv4Addr;
use std::sync::{Arc, Mutex};
use tauri::State;
use tokio::sync::oneshot;

/// The largest file that the preview serves, in bytes.
const MAX_FILE_SIZE: u64 = 50 * 1024 * 1024;

/// The content security policy of every answer. The page loads the files of its own origin, `data:` and `blob:`
/// addresses, and web sites in HTTPS. It cannot reach the address `ipc:` of the Tauri commands, and it cannot send a
/// form.
const CONTENT_SECURITY_POLICY: &str = "default-src 'self' data: blob: https: 'unsafe-inline' 'unsafe-eval'; \
     connect-src 'self' data: blob: https:; form-action 'none'";

/// Added at the end of every HTML page: a click on a link to a web site goes to the file view pane, which opens it in
/// the browser. A link to another file of the project stays in the frame. The frame has another origin than the
/// window of Heidrun Code, so the file view pane cannot read the clicks itself.
const LINK_SCRIPT: &str = r#"
<script>
document.addEventListener("click", function (event) {
  var anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (anchor === null) {
    return;
  }
  var url = new URL(anchor.getAttribute("href"), location.href);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return;
  }
  if (url.origin === location.origin) {
    return;
  }
  event.preventDefault();
  parent.postMessage({ type: "heidrun-html-preview-open-url", url: url.href }, "*");
}, true);
</script>
"#;

/// The secret keys of the open previews, and the project folder of each key.
type Keys = Arc<Mutex<HashMap<String, String>>>;

/// The server of the HTML preview, while at least one preview is open.
#[derive(Default)]
pub struct HtmlPreviewState {
    server: Mutex<Option<RunningServer>>,
}

/// A server that listens on the loopback address.
struct RunningServer {
    /// The port that the system gave to the server.
    port: u16,
    /// The secret keys of the open previews.
    keys: Keys,
    /// Stops the server when it is sent.
    shutdown: oneshot::Sender<()>,
}

/// What the file view pane receives when it opens an HTML preview.
#[derive(Serialize)]
pub struct HtmlPreviewOpening {
    /// The secret key of this preview, which the file view pane gives back when the preview closes.
    key: String,
    /// The address of the project folder, `http://127.0.0.1:<port>/<secret key>/`. The file view pane adds the path of
    /// the file.
    address: String,
}

/// Opens an HTML preview of a project: starts the server if it does not run, and gives a new secret key for the
/// project folder.
#[tauri::command]
pub async fn html_preview_open(state: State<'_, HtmlPreviewState>, root: String) -> Result<HtmlPreviewOpening, String> {
    state.open(root).await
}

/// Closes an HTML preview: forgets its secret key, and stops the server when no preview is open.
#[tauri::command]
pub fn html_preview_close(state: State<'_, HtmlPreviewState>, key: String) {
    state.close(&key);
}

impl HtmlPreviewState {
    /// Gives a new secret key for a project folder that the file view pane resolved, and starts the server if needed.
    async fn open(&self, root: String) -> Result<HtmlPreviewOpening, String> {
        crate::git::known_root(&root)?;
        let key = random_key()?;
        let running = {
            let server = self.server.lock().unwrap();
            server.as_ref().map(|server| (server.keys.clone(), server.port))
        };
        let (keys, port) = match running {
            Some(running) => running,
            None => self.start().await?,
        };
        keys.lock().unwrap().insert(key.clone(), root);
        Ok(HtmlPreviewOpening { address: format!("http://127.0.0.1:{port}/{key}/"), key })
    }

    /// Forgets a secret key, and stops the server when no key is left.
    fn close(&self, key: &str) {
        let mut server = self.server.lock().unwrap();
        let is_empty = match server.as_ref() {
            Some(running) => {
                let mut keys = running.keys.lock().unwrap();
                keys.remove(key);
                keys.is_empty()
            }
            None => false,
        };
        if is_empty {
            if let Some(running) = server.take() {
                let _ = running.shutdown.send(());
            }
        }
    }

    /// Starts the server on a free port of the loopback address, and keeps it in the state. When another call started
    /// a server in the meantime, that server is kept and the new one stops at once.
    async fn start(&self) -> Result<(Keys, u16), String> {
        let listener = tokio::net::TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await.map_err(|e| e.to_string())?;
        let port = listener.local_addr().map_err(|e| e.to_string())?.port();
        let keys: Keys = Arc::default();
        let (shutdown, stopped) = oneshot::channel::<()>();
        let router = router(keys.clone(), port);
        tauri::async_runtime::spawn(async move {
            let stopped = async move {
                let _ = stopped.await;
            };
            let _ = axum::serve(listener, router).with_graceful_shutdown(stopped).await;
        });
        let mut server = self.server.lock().unwrap();
        if let Some(running) = server.as_ref() {
            let _ = shutdown.send(());
            return Ok((running.keys.clone(), running.port));
        }
        *server = Some(RunningServer { port, keys: keys.clone(), shutdown });
        Ok((keys, port))
    }
}

/// The router of the server: every request goes to `serve`.
fn router(keys: Keys, port: u16) -> Router {
    Router::new().fallback(serve).with_state((keys, port))
}

/// Answers one request. It reads the disk off the asynchronous threads.
async fn serve(AxumState((keys, port)): AxumState<(Keys, u16)>, request: Request) -> Response<Body> {
    let host = request.headers().get(header::HOST).and_then(|value| value.to_str().ok()).unwrap_or("").to_string();
    let method = request.method().clone();
    let path = request.uri().path().to_string();
    let answer = tokio::task::spawn_blocking(move || respond(&keys, port, &method, &host, &path)).await;
    match answer {
        Ok(response) => response.map(Body::from),
        Err(_) => error(StatusCode::INTERNAL_SERVER_ERROR, "internal error".into()).map(Body::from),
    }
}

/// Answers one request: checks the host name and the method, finds the project of the secret key, and reads the file.
fn respond(keys: &Keys, port: u16, method: &Method, host: &str, address_path: &str) -> Response<Vec<u8>> {
    // The host name stops a web site that gives its own name to the loopback address (DNS rebinding).
    if host != format!("127.0.0.1:{port}") {
        return error(StatusCode::FORBIDDEN, "bad host".into());
    }
    if method != Method::GET && method != Method::HEAD {
        return error(StatusCode::METHOD_NOT_ALLOWED, "only GET".into());
    }
    match read(keys, address_path) {
        Ok((mime, body)) => Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, mime)
            .header(header::CONTENT_SECURITY_POLICY, CONTENT_SECURITY_POLICY)
            .header(header::CACHE_CONTROL, "no-store")
            .header(header::X_CONTENT_TYPE_OPTIONS, "nosniff")
            .body(body)
            .unwrap(),
        Err((status, message)) => error(status, message),
    }
}

/// An answer with an error message.
fn error(status: StatusCode, message: String) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, "text/plain; charset=utf-8")
        .header(header::CONTENT_SECURITY_POLICY, CONTENT_SECURITY_POLICY)
        .body(message.into_bytes())
        .unwrap()
}

/// Reads the file of the address path, and gives its type and its bytes, with the link script for an HTML page.
fn read(keys: &Keys, address_path: &str) -> Result<(&'static str, Vec<u8>), (StatusCode, String)> {
    let (key, path) = split(address_path).ok_or((StatusCode::NOT_FOUND, "bad address".to_string()))?;
    let root = keys.lock().unwrap().get(&key).cloned().ok_or((StatusCode::NOT_FOUND, "unknown key".to_string()))?;
    not_in_git_dir(&path).map_err(|e| (StatusCode::FORBIDDEN, e))?;
    let real = full_path(&root, &path).map_err(|e| (StatusCode::NOT_FOUND, e))?;
    let meta = std::fs::metadata(&real).map_err(|e| (StatusCode::NOT_FOUND, e.to_string()))?;
    if meta.is_file() == false {
        return Err((StatusCode::NOT_FOUND, "not a file".into()));
    }
    if meta.len() > MAX_FILE_SIZE {
        return Err((StatusCode::PAYLOAD_TOO_LARGE, "file too large for the preview".into()));
    }
    let mut body = std::fs::read(&real).map_err(|e| (StatusCode::NOT_FOUND, e.to_string()))?;
    let mime = mime_type(&path);
    if mime.starts_with("text/html") {
        body.extend_from_slice(LINK_SCRIPT.as_bytes());
    }
    Ok((mime, body))
}

/// Splits the address path `/<secret key>/<path inside the project>` into the key and the decoded path, or gives `None`
/// when a part is missing or is not valid UTF-8.
fn split(address_path: &str) -> Option<(String, String)> {
    let (key, path) = address_path.strip_prefix('/')?.split_once('/')?;
    let path = percent_decode_str(path).decode_utf8().ok()?.into_owned();
    if key.is_empty() || path.is_empty() {
        return None;
    }
    Some((key.to_string(), path))
}

/// A new secret key: 16 random bytes of the system as hexadecimal text.
fn random_key() -> Result<String, String> {
    let mut bytes = [0u8; 16];
    std::fs::File::open("/dev/urandom").and_then(|mut file| file.read_exact(&mut bytes)).map_err(|e| e.to_string())?;
    Ok(bytes.iter().map(|byte| format!("{byte:02x}")).collect())
}

/// The media type of a file, from its extension.
fn mime_type(path: &str) -> &'static str {
    let extension = path.rsplit_once('.').map(|(_, extension)| extension.to_ascii_lowercase()).unwrap_or_default();
    match extension.as_str() {
        "html" | "htm" => "text/html; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "js" | "mjs" => "text/javascript; charset=utf-8",
        "json" | "map" => "application/json",
        "csv" => "text/csv; charset=utf-8",
        "txt" | "md" => "text/plain; charset=utf-8",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "ico" => "image/x-icon",
        "bmp" => "image/bmp",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        "ttf" => "font/ttf",
        "otf" => "font/otf",
        "wasm" => "application/wasm",
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        _ => "application/octet-stream",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::remember_root;
    use std::io::Write;

    /// A temporary project with a page, a style sheet, a script, an image, a file of Git, and a link out of the project.
    fn project(name: &str) -> String {
        let dir = std::env::temp_dir().join(format!("hd-html-preview-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(dir.join("reports/assets")).unwrap();
        std::fs::create_dir_all(dir.join(".git")).unwrap();
        std::fs::write(dir.join("reports/index.html"), "<!doctype html><p>Report</p>").unwrap();
        std::fs::write(dir.join("reports/assets/style.css"), "p { color: red; }").unwrap();
        std::fs::write(dir.join("reports/assets/chart.js"), "console.log(1);").unwrap();
        std::fs::write(dir.join("reports/assets/image.png"), [137u8, 80, 78, 71]).unwrap();
        std::fs::write(dir.join(".git/config"), "[core]").unwrap();
        std::os::unix::fs::symlink("/etc/hosts", dir.join("reports/hosts.html")).unwrap();
        let root = std::fs::canonicalize(&dir).unwrap().display().to_string();
        remember_root(&root);
        root
    }

    /// The keys of a server with one key, `secret`, for the project.
    fn keys_of(root: &str) -> Keys {
        Arc::new(Mutex::new(HashMap::from([("secret".to_string(), root.to_string())])))
    }

    fn get(keys: &Keys, path: &str) -> Response<Vec<u8>> {
        respond(keys, 4000, &Method::GET, "127.0.0.1:4000", &format!("/secret/{path}"))
    }

    /// Sends one raw HTTP request to the server, and gives the status line and the body.
    fn http_get(port: u16, path: &str) -> std::io::Result<String> {
        let mut stream = std::net::TcpStream::connect(("127.0.0.1", port))?;
        write!(stream, "GET {path} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nConnection: close\r\n\r\n")?;
        let mut answer = String::new();
        stream.read_to_string(&mut answer)?;
        Ok(answer)
    }

    #[test]
    fn serves_the_page_with_the_link_script_and_the_security_policy() {
        let keys = keys_of(&project("page"));
        let response = get(&keys, "reports/index.html");
        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(response.headers()["Content-Type"], "text/html; charset=utf-8");
        assert_eq!(response.headers()["Cache-Control"], "no-store");
        let policy = response.headers()["Content-Security-Policy"].to_str().unwrap();
        assert!(policy.contains("connect-src 'self' data: blob: https:;"));
        assert!(policy.contains("ipc") == false);
        let body = String::from_utf8(response.body().clone()).unwrap();
        assert!(body.starts_with("<!doctype html><p>Report</p>"));
        assert!(body.contains("heidrun-html-preview-open-url"));
        assert!(body.contains("url.origin === location.origin"));
    }

    #[test]
    fn serves_the_files_next_to_the_page_with_their_types_and_without_the_link_script() {
        let keys = keys_of(&project("files"));
        let style = get(&keys, "reports/assets/style.css");
        assert_eq!(style.headers()["Content-Type"], "text/css; charset=utf-8");
        assert_eq!(style.body(), b"p { color: red; }");
        assert_eq!(get(&keys, "reports/assets/chart.js").headers()["Content-Type"], "text/javascript; charset=utf-8");
        let image = get(&keys, "reports/assets/image.png");
        assert_eq!(image.headers()["Content-Type"], "image/png");
        assert_eq!(image.body(), &vec![137u8, 80, 78, 71]);
    }

    #[test]
    fn decodes_an_encoded_path() {
        let root = project("encoded");
        std::fs::write(std::path::Path::new(&root).join("reports/a b.html"), "x").unwrap();
        assert_eq!(get(&keys_of(&root), "reports/a%20b.html").status(), StatusCode::OK);
    }

    #[test]
    fn refuses_a_wrong_key_a_wrong_host_a_wrong_method_a_parent_folder_a_symbolic_link_git_and_a_missing_file() {
        let root = project("refused");
        let keys = keys_of(&root);
        let wrong_key = respond(&keys, 4000, &Method::GET, "127.0.0.1:4000", "/other/reports/index.html");
        assert_eq!(wrong_key.status(), StatusCode::NOT_FOUND);
        let wrong_host = respond(&keys, 4000, &Method::GET, "evil.example:4000", "/secret/reports/index.html");
        assert_eq!(wrong_host.status(), StatusCode::FORBIDDEN);
        let wrong_method = respond(&keys, 4000, &Method::POST, "127.0.0.1:4000", "/secret/reports/index.html");
        assert_eq!(wrong_method.status(), StatusCode::METHOD_NOT_ALLOWED);
        assert_eq!(get(&keys, "reports/%2E%2E/%2E%2E/x.html").status(), StatusCode::NOT_FOUND);
        assert_eq!(get(&keys, "reports/hosts.html").status(), StatusCode::NOT_FOUND);
        assert_eq!(get(&keys, ".git/config").status(), StatusCode::FORBIDDEN);
        assert_eq!(get(&keys, "reports/missing.html").status(), StatusCode::NOT_FOUND);
        assert_eq!(respond(&keys, 4000, &Method::GET, "127.0.0.1:4000", "/secret").status(), StatusCode::NOT_FOUND);
    }

    #[test]
    fn refuses_a_project_that_the_file_view_pane_did_not_resolve() {
        let state = HtmlPreviewState::default();
        let answer = tauri::async_runtime::block_on(state.open("/not/a/known/project".into()));
        assert!(answer.is_err());
        assert!(state.server.lock().unwrap().is_none());
    }

    #[test]
    fn the_server_runs_on_the_loopback_address_while_a_preview_is_open() {
        let root = project("live");
        let state = HtmlPreviewState::default();
        let first = tauri::async_runtime::block_on(state.open(root.clone())).unwrap();
        let second = tauri::async_runtime::block_on(state.open(root)).unwrap();
        assert_ne!(first.key, second.key);
        assert_eq!(first.key.len(), 32);
        let port: u16 = first.address.trim_start_matches("http://127.0.0.1:").split('/').next().unwrap().parse().unwrap();
        assert_eq!(second.address, format!("http://127.0.0.1:{port}/{}/", second.key));
        let page = http_get(port, &format!("/{}/reports/index.html", first.key)).unwrap();
        assert!(page.starts_with("HTTP/1.1 200"));
        assert!(page.contains("<p>Report</p>"));
        assert!(http_get(port, "/0123456789abcdef0123456789abcdef/reports/index.html").unwrap().starts_with("HTTP/1.1 404"));
        state.close(&first.key);
        assert!(http_get(port, &format!("/{}/reports/index.html", first.key)).unwrap().starts_with("HTTP/1.1 404"));
        state.close(&second.key);
        assert!(state.server.lock().unwrap().is_none());
        let mut is_stopped = false;
        for _ in 0..100 {
            if http_get(port, "/").is_err() {
                is_stopped = true;
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(10));
        }
        assert!(is_stopped);
    }

    #[test]
    fn gives_the_media_type_of_the_extension() {
        assert_eq!(mime_type("a/B.HTM"), "text/html; charset=utf-8");
        assert_eq!(mime_type("data.json"), "application/json");
        assert_eq!(mime_type("font.woff2"), "font/woff2");
        assert_eq!(mime_type("no_extension"), "application/octet-stream");
    }
}
