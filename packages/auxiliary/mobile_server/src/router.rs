//! The routes of the mobile server: the calls of the phone on `/api`, and the files of the mobile website everywhere
//! else.

use crate::access::AccessGuard;
use crate::embedded::{self, EmbeddedFile};
use crate::handler::MobileCallHandler;
use axum::body::Bytes;
use axum::extract::State;
use axum::http::{header, HeaderMap, StatusCode, Uri};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::Router;
use serde::Deserialize;
use serde_json::Value;
use std::sync::{Arc, Mutex};
use std::time::Instant;

/// Only files of the server itself may load or run: no inline script, no inline style, nothing from another address.
const CONTENT_SECURITY_POLICY: &str = "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; manifest-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

/// The files of the folder `assets` have a hash of their content in their name, so a browser may keep them for ever.
const ASSETS_CACHE_CONTROL: &str = "public, max-age=31536000, immutable";

/// A closed list: nothing else than these few actions is reachable from the phone.
const METHODS: &[&str] = &["state", "read", "answer", "prompt", "keys", "macros", "launchers", "launch", "pushKey", "subscribe", "unsubscribe"];

/// The methods that the server answers itself, because they touch the file of the push keys, not a coding agent.
const PUSH_METHODS: &[&str] = &["pushKey", "subscribe", "unsubscribe"];

const MAX_BODY_BYTES: usize = 64 * 1024;

/// What every route needs.
#[derive(Clone)]
pub struct Shared {
    /// The pairing key, the host name of the tunnel (a request for any other Host is refused, which stops DNS
    /// rebinding), and the count of the bad keys.
    pub guard: Arc<Mutex<AccessGuard>>,
    /// The desktop application.
    pub handler: Arc<dyn MobileCallHandler>,
}

/// The routes of the server.
pub fn router(shared: Shared) -> Router {
    Router::new().route("/api", post(api)).fallback_service(get(site)).with_state(shared)
}

fn header_text<'a>(headers: &'a HeaderMap, name: &str) -> Option<&'a str> {
    headers.get(name).and_then(|v| v.to_str().ok())
}

fn authorized(shared: &Shared, headers: &HeaderMap) -> Result<(), Response> {
    let host = header_text(headers, "host");
    let origin = header_text(headers, "origin");
    let given = header_text(headers, "x-herdr-token");
    let result = shared.guard.lock().unwrap().authorize(host, origin, given, Instant::now());
    result.map_err(|denial| denial.status_and_text().into_response())
}

/// Serves one file of the mobile website. The address `/` is the file `index.html`. A path that is not in the table of
/// the embedded files is a 404: no other path reaches the disk.
async fn site(uri: Uri) -> Response {
    let request_path = uri.path();
    let path = if request_path == "/" { "index.html" } else { request_path.strip_prefix('/').unwrap_or("") };
    match embedded::find(path) {
        Some(file) => site_file(path, file),
        None => StatusCode::NOT_FOUND.into_response(),
    }
}

fn site_file(path: &str, file: EmbeddedFile) -> Response {
    let cache_control = if path.starts_with("assets/") { ASSETS_CACHE_CONTROL } else { "no-store" };
    (
        [
            (header::CONTENT_TYPE, file.content_type),
            (header::CACHE_CONTROL, cache_control),
            (header::CONTENT_SECURITY_POLICY, CONTENT_SECURITY_POLICY),
            (header::REFERRER_POLICY, "no-referrer"),
            (header::X_CONTENT_TYPE_OPTIONS, "nosniff"),
        ],
        file.bytes,
    )
        .into_response()
}

#[derive(Deserialize)]
struct ApiCall {
    method: String,
    #[serde(default)]
    params: Value,
}

async fn api(State(shared): State<Shared>, headers: HeaderMap, body: Bytes) -> Response {
    if let Err(r) = authorized(&shared, &headers) {
        return r;
    }
    if body.len() > MAX_BODY_BYTES {
        return (StatusCode::PAYLOAD_TOO_LARGE, "Request too large").into_response();
    }
    let Ok(call) = serde_json::from_slice::<ApiCall>(&body) else {
        return (StatusCode::BAD_REQUEST, "Invalid request").into_response();
    };
    if !METHODS.contains(&call.method.as_str()) {
        return (StatusCode::NOT_FOUND, "Unknown method").into_response();
    }
    if PUSH_METHODS.contains(&call.method.as_str()) {
        return match push_call(&call.method, &call.params) {
            Ok(v) => axum::Json(v).into_response(),
            Err(e) => (StatusCode::SERVICE_UNAVAILABLE, e).into_response(),
        };
    }
    match shared.handler.handle_call(call.method, call.params).await {
        Ok(v) => axum::Json(v).into_response(),
        Err(e) => (StatusCode::SERVICE_UNAVAILABLE, e).into_response(),
    }
}

fn push_call(method: &str, params: &Value) -> Result<Value, String> {
    let endpoint = params.get("endpoint").and_then(Value::as_str).unwrap_or("");
    match method {
        "pushKey" => Ok(serde_json::json!({ "key": crate::push::public_key()? })),
        "subscribe" => crate::push::subscribe(endpoint).map(|_| serde_json::json!({ "ok": true })),
        _ => crate::push::unsubscribe(endpoint).map(|_| serde_json::json!({ "ok": true })),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::handler::CallFuture;
    use axum::body::Body;
    use axum::http::Request;
    use serde_json::json;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use tower::ServiceExt;

    const HOST: &str = "words-of-the-tunnel.ngrok-free.dev";
    const TOKEN: &str = "0123456789abcdef";

    /// Answers every call with the name of the method, and counts the calls.
    struct FakeHandler {
        calls: AtomicUsize,
    }

    impl MobileCallHandler for FakeHandler {
        fn handle_call(&self, method: String, params: Value) -> CallFuture {
            self.calls.fetch_add(1, Ordering::Relaxed);
            Box::pin(async move {
                if method == "read" {
                    return Err("Heidrun Code does not answer on the computer".to_string());
                }
                Ok(json!({ "method": method, "params": params }))
            })
        }
    }

    fn setup(token: Option<&str>) -> (Router, Arc<FakeHandler>) {
        let handler = Arc::new(FakeHandler { calls: AtomicUsize::new(0) });
        let mut guard = AccessGuard::default();
        guard.set_token(token.map(str::to_string));
        guard.set_tunnel_host(Some(HOST.to_string()));
        let shared = Shared { guard: Arc::new(Mutex::new(guard)), handler: handler.clone() };
        (router(shared), handler)
    }

    fn api_request(host: &str, origin: Option<&str>, token: Option<&str>, body: Vec<u8>) -> Request<Body> {
        let mut builder = Request::builder().method("POST").uri("/api").header("host", host).header("content-type", "application/json");
        if let Some(origin) = origin {
            builder = builder.header("origin", origin);
        }
        if let Some(token) = token {
            builder = builder.header("x-herdr-token", token);
        }
        builder.body(Body::from(body)).unwrap()
    }

    async fn status_of(router: Router, request: Request<Body>) -> StatusCode {
        router.oneshot(request).await.unwrap().status()
    }

    fn call_body(method: &str) -> Vec<u8> {
        serde_json::to_vec(&json!({ "method": method, "params": { "paneId": "p1" } })).unwrap()
    }

    #[tokio::test]
    async fn a_paired_call_reaches_the_handler_and_returns_its_answer() {
        let (router, handler) = setup(Some(TOKEN));
        let response = router.oneshot(api_request(HOST, Some("https://words-of-the-tunnel.ngrok-free.dev"), Some(TOKEN), call_body("state"))).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(response.into_body(), 1024).await.unwrap();
        let answer: Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(answer, json!({ "method": "state", "params": { "paneId": "p1" } }));
        assert_eq!(handler.calls.load(Ordering::Relaxed), 1);
    }

    #[tokio::test]
    async fn an_error_of_the_handler_becomes_a_503_with_its_text() {
        let (router, _) = setup(Some(TOKEN));
        let response = router.oneshot(api_request(HOST, None, Some(TOKEN), call_body("read"))).await.unwrap();
        assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
        let bytes = axum::body::to_bytes(response.into_body(), 1024).await.unwrap();
        assert_eq!(String::from_utf8(bytes.to_vec()).unwrap(), "Heidrun Code does not answer on the computer");
    }

    #[tokio::test]
    async fn a_method_outside_the_closed_list_never_reaches_the_handler() {
        let (router, handler) = setup(Some(TOKEN));
        for method in ["close", "delete_pane", "STATE", ""] {
            let status = status_of(router.clone(), api_request(HOST, None, Some(TOKEN), call_body(method))).await;
            assert_eq!(status, StatusCode::NOT_FOUND, "method {method:?}");
        }
        assert_eq!(handler.calls.load(Ordering::Relaxed), 0);
    }

    #[tokio::test]
    async fn every_method_of_the_closed_list_reaches_the_handler() {
        let (router, handler) = setup(Some(TOKEN));
        // The fake handler fails on "read", for the test of the error 503.
        let methods = ["state", "answer", "prompt", "keys", "macros", "launchers", "launch"];
        for method in methods {
            let status = status_of(router.clone(), api_request(HOST, None, Some(TOKEN), call_body(method))).await;
            assert_eq!(status, StatusCode::OK, "method {method:?}");
        }
        assert_eq!(handler.calls.load(Ordering::Relaxed), methods.len());
    }

    #[tokio::test]
    async fn the_push_methods_are_answered_by_the_server_and_never_reach_the_handler() {
        let folder = std::env::temp_dir().join(format!("mobile_server_router_push_{}", std::process::id()));
        std::env::set_var("HEIDRUN_CODE_DIR", &folder);
        let (router, handler) = setup(Some(TOKEN));
        let ask = |method: &str, endpoint: &str| {
            let body = serde_json::to_vec(&json!({ "method": method, "params": { "endpoint": endpoint } })).unwrap();
            api_request(HOST, None, Some(TOKEN), body)
        };
        let response = router.clone().oneshot(ask("pushKey", "")).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(response.into_body(), 4096).await.unwrap();
        let key = serde_json::from_slice::<Value>(&bytes).unwrap()["key"].as_str().unwrap().to_string();
        assert_eq!(key.len(), 87);
        assert_eq!(status_of(router.clone(), ask("subscribe", "https://push.example.com/a")).await, StatusCode::OK);
        assert_eq!(status_of(router.clone(), ask("subscribe", "http://push.example.com/a")).await, StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(status_of(router.clone(), ask("unsubscribe", "https://push.example.com/a")).await, StatusCode::OK);
        assert_eq!(handler.calls.load(Ordering::Relaxed), 0);
        let without_key = api_request(HOST, None, None, serde_json::to_vec(&json!({ "method": "pushKey" })).unwrap());
        assert_eq!(status_of(router, without_key).await, StatusCode::UNAUTHORIZED);
        let _ = std::fs::remove_dir_all(folder);
    }

    #[tokio::test]
    async fn a_wrong_host_is_refused() {
        let (router, handler) = setup(Some(TOKEN));
        let status = status_of(router, api_request("evil.example", None, Some(TOKEN), call_body("state"))).await;
        assert_eq!(status, StatusCode::FORBIDDEN);
        assert_eq!(handler.calls.load(Ordering::Relaxed), 0);
    }

    #[tokio::test]
    async fn the_loopback_address_is_refused_even_with_the_right_key() {
        let (router, handler) = setup(Some(TOKEN));
        let status = status_of(router, api_request("127.0.0.1:47823", None, Some(TOKEN), call_body("state"))).await;
        assert_eq!(status, StatusCode::FORBIDDEN);
        assert_eq!(handler.calls.load(Ordering::Relaxed), 0);
    }

    #[tokio::test]
    async fn a_wrong_origin_is_refused() {
        let (router, handler) = setup(Some(TOKEN));
        let status = status_of(router, api_request(HOST, Some("https://evil.example"), Some(TOKEN), call_body("state"))).await;
        assert_eq!(status, StatusCode::FORBIDDEN);
        assert_eq!(handler.calls.load(Ordering::Relaxed), 0);
    }

    #[tokio::test]
    async fn a_missing_or_wrong_key_is_a_401() {
        let (router, handler) = setup(Some(TOKEN));
        assert_eq!(status_of(router.clone(), api_request(HOST, None, None, call_body("state"))).await, StatusCode::UNAUTHORIZED);
        assert_eq!(status_of(router, api_request(HOST, None, Some("wrong"), call_body("state"))).await, StatusCode::UNAUTHORIZED);
        assert_eq!(handler.calls.load(Ordering::Relaxed), 0);
    }

    #[tokio::test]
    async fn ten_wrong_keys_lock_the_wrong_keys_but_not_the_right_key() {
        let (router, _) = setup(Some(TOKEN));
        for _ in 0..10 {
            assert_eq!(status_of(router.clone(), api_request(HOST, None, Some("wrong"), call_body("state"))).await, StatusCode::UNAUTHORIZED);
        }
        assert_eq!(status_of(router.clone(), api_request(HOST, None, Some("wrong"), call_body("state"))).await, StatusCode::TOO_MANY_REQUESTS);
        assert_eq!(status_of(router, api_request(HOST, None, Some(TOKEN), call_body("state"))).await, StatusCode::OK);
    }

    #[tokio::test]
    async fn the_access_off_answers_a_503_even_with_the_right_key() {
        let (router, handler) = setup(None);
        let status = status_of(router, api_request(HOST, None, Some(TOKEN), call_body("state"))).await;
        assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(handler.calls.load(Ordering::Relaxed), 0);
    }

    #[tokio::test]
    async fn a_body_larger_than_64_kilobytes_is_refused() {
        let (router, handler) = setup(Some(TOKEN));
        let status = status_of(router.clone(), api_request(HOST, None, Some(TOKEN), vec![b' '; 64 * 1024 + 1])).await;
        assert_eq!(status, StatusCode::PAYLOAD_TOO_LARGE);
        let status = status_of(router, api_request(HOST, None, Some(TOKEN), b"not json".to_vec())).await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
        assert_eq!(handler.calls.load(Ordering::Relaxed), 0);
    }

    async fn get_response(router: Router, address: &str) -> Response {
        let request = Request::builder().uri(address).header("host", HOST).body(Body::empty()).unwrap();
        router.oneshot(request).await.unwrap()
    }

    /// The type that each kind of file must have. It is written here on its own, so a mistake in the table of the
    /// server does not hide itself. A file of a kind that is not listed stops the test: add its type here.
    fn expected_content_type(path: &str) -> &'static str {
        match path.rsplit('.').next().unwrap() {
            "html" => "text/html; charset=utf-8",
            "js" => "text/javascript; charset=utf-8",
            "css" => "text/css; charset=utf-8",
            "webmanifest" => "application/manifest+json",
            "svg" => "image/svg+xml",
            "png" => "image/png",
            "jpg" | "jpeg" => "image/jpeg",
            "webp" => "image/webp",
            "ico" => "image/x-icon",
            other => panic!("the test does not know the type of a file .{other}: {path}"),
        }
    }

    #[tokio::test]
    async fn the_page_has_the_security_headers_and_needs_no_key() {
        let (router, _) = setup(Some(TOKEN));
        let response = get_response(router, "/").await;
        assert_eq!(response.status(), StatusCode::OK);
        let headers = response.headers();
        assert_eq!(headers[header::CONTENT_TYPE], "text/html; charset=utf-8");
        assert_eq!(headers[header::CACHE_CONTROL], "no-store");
        assert_eq!(headers[header::X_CONTENT_TYPE_OPTIONS], "nosniff");
        assert_eq!(headers[header::REFERRER_POLICY], "no-referrer");
        let policy = headers[header::CONTENT_SECURITY_POLICY].to_str().unwrap().to_string();
        assert!(policy.starts_with("default-src 'none'"));
        assert!(policy.contains("script-src 'self';"));
        assert!(policy.contains("style-src 'self';"));
        assert!(!policy.contains("unsafe-inline"));
        assert!(!policy.contains("unsafe-eval"));
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024).await.unwrap();
        assert!(String::from_utf8(bytes.to_vec()).unwrap().contains("<title>Heidrun Code Mobile</title>"));
    }

    #[tokio::test]
    async fn every_embedded_file_is_served_with_its_type_and_its_bytes() {
        let (router, _) = setup(Some(TOKEN));
        let dist = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../mobile_website/dist");
        let paths: Vec<&str> = embedded::paths().collect();
        assert!(paths.len() >= 4, "the page, the manifest, a script, and a style: {paths:?}");
        for path in paths {
            let response = get_response(router.clone(), &format!("/{path}")).await;
            assert_eq!(response.status(), StatusCode::OK, "file {path}");
            assert_eq!(response.headers()[header::CONTENT_TYPE], expected_content_type(path), "file {path}");
            let bytes = axum::body::to_bytes(response.into_body(), 4 * 1024 * 1024).await.unwrap();
            assert_eq!(bytes.to_vec(), std::fs::read(dist.join(path)).unwrap(), "file {path}");
        }
    }

    #[tokio::test]
    async fn the_files_of_the_assets_folder_are_kept_for_ever_and_the_others_are_not_kept() {
        let (router, _) = setup(Some(TOKEN));
        for path in embedded::paths() {
            let response = get_response(router.clone(), &format!("/{path}")).await;
            let expected = if path.starts_with("assets/") { ASSETS_CACHE_CONTROL } else { "no-store" };
            assert_eq!(response.headers()[header::CACHE_CONTROL], expected, "file {path}");
        }
    }

    #[tokio::test]
    async fn the_manifest_is_served() {
        let (router, _) = setup(Some(TOKEN));
        let response = get_response(router, "/manifest.webmanifest").await;
        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(response.headers()[header::CONTENT_TYPE], "application/manifest+json");
        let bytes = axum::body::to_bytes(response.into_body(), 1024).await.unwrap();
        let manifest: Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(manifest["name"], "Heidrun Code");
    }

    #[tokio::test]
    async fn the_service_worker_is_served_as_javascript_from_the_root_and_is_not_kept() {
        let (router, _) = setup(Some(TOKEN));
        let response = get_response(router, "/sw.js").await;
        assert_eq!(response.status(), StatusCode::OK);
        assert!(response.headers()[header::CONTENT_TYPE].to_str().unwrap().starts_with("text/javascript"));
        assert_eq!(response.headers()[header::CACHE_CONTROL], "no-store");
        let bytes = axum::body::to_bytes(response.into_body(), 64 * 1024).await.unwrap();
        assert!(String::from_utf8(bytes.to_vec()).unwrap().contains("notificationclick"));
    }

    #[tokio::test]
    async fn an_address_that_is_not_a_file_of_the_website_is_a_404() {
        let (router, _) = setup(Some(TOKEN));
        let addresses = [
            "/nope",
            "/assets/",
            "/assets",
            "/../Cargo.toml",
            "/assets/../index.html",
            "/%2e%2e/Cargo.toml",
            "//index.html",
            "/index.html/",
            "/manifest.json",
        ];
        for address in addresses {
            let response = get_response(router.clone(), address).await;
            assert_eq!(response.status(), StatusCode::NOT_FOUND, "address {address}");
        }
    }

    #[tokio::test]
    async fn a_file_of_the_website_cannot_be_changed_by_a_post() {
        let (router, handler) = setup(Some(TOKEN));
        let request = Request::builder().method("POST").uri("/index.html").header("host", HOST).body(Body::empty()).unwrap();
        assert_eq!(status_of(router, request).await, StatusCode::METHOD_NOT_ALLOWED);
        assert_eq!(handler.calls.load(Ordering::Relaxed), 0);
    }
}
