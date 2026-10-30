//! The routes of the Heidrun Code Dashboard server: the page on `/heidrun_code_dashboard`, the state of the Heidrun Code Dashboard on `/heidrun_code_dashboard/api/state`, and the other files of
//! the page everywhere else. Every route only reads, and every route needs the pairing key.

use crate::access::AccessGuard;
use crate::handler::{HeidrunCodeDashboardServerEvent, HeidrunCodeDashboardServerHandler};
use axum::http::{header, HeaderMap, HeaderValue, StatusCode, Uri};
use axum::response::{IntoResponse, Response};
use axum::extract::State;
use axum::routing::get;
use axum::Router;
use std::sync::{Arc, Mutex};
use std::time::Instant;

/// The address of the page. The QR code carries it with `?key=<pairing key>`.
pub const PAGE_PATH: &str = "/heidrun_code_dashboard";

/// The address of the state of the Heidrun Code Dashboard, which the page reads again and again.
pub const STATE_PATH: &str = "/heidrun_code_dashboard/api/state";

/// The address of the page before the Mire became the Heidrun Code Dashboard (issue 989). It sends the device to the new
/// address, with the same query, so that a saved address keeps working.
pub const OLD_MIRE_PAGE_PATH: &str = "/mire";

/// The cookie that keeps the pairing key on the device, so that the other files of the page and the state pass too.
const KEY_COOKIE: &str = "heidrun_code_dashboard_key";

/// The cookie of the pairing key before the Mire became the Heidrun Code Dashboard (issue 989). It is still read, and the
/// page copies it to the new cookie, so that the device does not scan the QR code again.
const OLD_MIRE_KEY_COOKIE: &str = "heidrun_mire_key";

/// The header that can carry the pairing key in place of the cookie.
const KEY_HEADER: &str = "x-heidrun-code-dashboard-key";

/// The cookie lives one year: the developer scans the QR code once.
const KEY_COOKIE_MAX_AGE_SECONDS: u32 = 365 * 24 * 60 * 60;

/// The files of the folder `assets` have a hash of their content in their name, so a browser may keep them for ever.
const ASSETS_CACHE_CONTROL: &str = "public, max-age=31536000, immutable";

/// What every route needs.
#[derive(Clone)]
pub struct Shared {
    /// The pairing key, the port, and the count of the bad keys.
    pub guard: Arc<Mutex<AccessGuard>>,
    /// The desktop application.
    pub handler: Arc<dyn HeidrunCodeDashboardServerHandler>,
}

/// The routes of the server. A method other than GET or HEAD gets the status 405.
pub fn router(shared: Shared) -> Router {
    Router::new()
        .route(PAGE_PATH, get(page))
        .route(OLD_MIRE_PAGE_PATH, get(old_mire_page))
        .route(STATE_PATH, get(state))
        .fallback_service(get(asset).with_state(shared.clone()))
        .with_state(shared)
}

fn header_text<'a>(headers: &'a HeaderMap, name: &str) -> Option<&'a str> {
    headers.get(name).and_then(|value| value.to_str().ok())
}

/// The value of the parameter `key` of the query of the address, or None.
fn query_key(uri: &Uri) -> Option<&str> {
    uri.query()?.split('&').find_map(|pair| pair.strip_prefix("key="))
}

/// The value of the cookie of the pairing key, or else of the old cookie of the Mire, or None.
fn cookie_key(headers: &HeaderMap) -> Option<&str> {
    named_cookie(headers, KEY_COOKIE).or_else(|| named_cookie(headers, OLD_MIRE_KEY_COOKIE))
}

/// The value of the cookie with this name, or None.
fn named_cookie<'a>(headers: &'a HeaderMap, name: &str) -> Option<&'a str> {
    headers
        .get_all(header::COOKIE)
        .iter()
        .filter_map(|value| value.to_str().ok())
        .flat_map(|value| value.split(';'))
        .find_map(|pair| pair.trim().strip_prefix(name)?.strip_prefix('='))
}

/// Checks a request with the key that it gives. A refused request, and the lock after ten bad keys, are sent to the
/// application log.
fn authorized(shared: &Shared, headers: &HeaderMap, given: Option<&str>) -> Result<(), Response> {
    let host = header_text(headers, "host");
    let origin = header_text(headers, "origin");
    let now = Instant::now();
    let (result, is_newly_locked) = {
        let mut guard = shared.guard.lock().unwrap();
        let was_locked = guard.is_locked(now);
        let result = guard.authorize(host, origin, given, now);
        (result, was_locked == false && guard.is_locked(now))
    };
    let Err(denial) = result else {
        return Ok(());
    };
    shared.handler.record_event(HeidrunCodeDashboardServerEvent::Refused { reason: denial.name() });
    if is_newly_locked {
        shared.handler.record_event(HeidrunCodeDashboardServerEvent::Locked);
    }
    Err(with_common_headers(denial.status_and_text().into_response(), "no-store"))
}

/// The page. The key comes from the address that the QR code carries, or from the cookie of an earlier visit. A key from
/// the address, or from the old cookie of the Mire, is kept in the cookie.
async fn page(State(shared): State<Shared>, uri: Uri, headers: HeaderMap) -> Response {
    let address_key = query_key(&uri);
    let old_mire_cookie_key = match named_cookie(&headers, KEY_COOKIE) {
        Some(_) => None,
        None => named_cookie(&headers, OLD_MIRE_KEY_COOKIE),
    };
    let given = address_key.or_else(|| cookie_key(&headers));
    if let Err(response) = authorized(&shared, &headers, given) {
        return response;
    }
    let Some(file) = shared.handler.asset("index.html".to_string()).await else {
        return with_common_headers(StatusCode::NOT_FOUND.into_response(), "no-store");
    };
    let mut response = with_common_headers(file_response(file.bytes, &file.mime_type), "no-store");
    if let Some(key) = address_key.or(old_mire_cookie_key) {
        let cookie = format!("{KEY_COOKIE}={key}; Path=/; Max-Age={KEY_COOKIE_MAX_AGE_SECONDS}; HttpOnly; SameSite=Strict");
        if let Ok(value) = HeaderValue::from_str(&cookie) {
            response.headers_mut().insert(header::SET_COOKIE, value);
        }
    }
    response
}

/// The old address of the Mire: sends the device to the address of the page, with the same query.
async fn old_mire_page(uri: Uri) -> Response {
    let location = match uri.query() {
        Some(query) => format!("{PAGE_PATH}?{query}"),
        None => PAGE_PATH.to_string(),
    };
    with_common_headers(axum::response::Redirect::permanent(&location).into_response(), "no-store")
}

/// The state of the Heidrun Code Dashboard, as JSON.
async fn state(State(shared): State<Shared>, headers: HeaderMap) -> Response {
    let given = header_text(&headers, KEY_HEADER).or_else(|| cookie_key(&headers));
    if let Err(response) = authorized(&shared, &headers, given) {
        return response;
    }
    let response = match shared.handler.state().await {
        Ok(value) => axum::Json(value).into_response(),
        Err(text) => (StatusCode::SERVICE_UNAVAILABLE, text).into_response(),
    };
    with_common_headers(response, "no-store")
}

/// Another file of the page, with the query of its address: the development server of the page needs the query.
async fn asset(State(shared): State<Shared>, uri: Uri, headers: HeaderMap) -> Response {
    let given = header_text(&headers, KEY_HEADER).or_else(|| cookie_key(&headers));
    if let Err(response) = authorized(&shared, &headers, given) {
        return response;
    }
    let path = uri.path().trim_start_matches('/');
    if path.is_empty() || path.split('/').any(|part| part == "..") {
        return with_common_headers(StatusCode::NOT_FOUND.into_response(), "no-store");
    }
    let path_and_query = match uri.query() {
        Some(query) => format!("{path}?{query}"),
        None => path.to_string(),
    };
    let cache_control = if path.starts_with("assets/") { ASSETS_CACHE_CONTROL } else { "no-store" };
    match shared.handler.asset(path_and_query).await {
        Some(file) => with_common_headers(file_response(file.bytes, &file.mime_type), cache_control),
        None => with_common_headers(StatusCode::NOT_FOUND.into_response(), "no-store"),
    }
}

fn file_response(bytes: Vec<u8>, mime_type: &str) -> Response {
    let mut response = bytes.into_response();
    if let Ok(value) = HeaderValue::from_str(mime_type) {
        response.headers_mut().insert(header::CONTENT_TYPE, value);
    }
    response
}

/// The address of the page holds the pairing key: no other site receives it. The device never guesses a media type.
fn with_common_headers(mut response: Response, cache_control: &'static str) -> Response {
    let headers = response.headers_mut();
    headers.insert(header::REFERRER_POLICY, HeaderValue::from_static("no-referrer"));
    headers.insert(header::X_CONTENT_TYPE_OPTIONS, HeaderValue::from_static("nosniff"));
    headers.insert(header::X_FRAME_OPTIONS, HeaderValue::from_static("DENY"));
    headers.insert(header::CACHE_CONTROL, HeaderValue::from_static(cache_control));
    response
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::handler::{AssetFuture, HeidrunCodeDashboardAsset, StateFuture};
    use axum::body::Body;
    use axum::http::Request;
    use serde_json::json;
    use tower::ServiceExt;

    const HOST: &str = "192.168.1.20:51234";
    const KEY: &str = "0123456789abcdef";

    /// A fake desktop application: one page, one script, and a fixed state. It counts the calls of `state`.
    #[derive(Default)]
    struct FakeHandler {
        events: Mutex<Vec<HeidrunCodeDashboardServerEvent>>,
        state_calls: Mutex<u32>,
        asset_paths: Mutex<Vec<String>>,
    }

    impl HeidrunCodeDashboardServerHandler for FakeHandler {
        fn state(&self) -> StateFuture {
            *self.state_calls.lock().unwrap() += 1;
            Box::pin(async { Ok(json!({ "snapshot": { "workspaces": [] } })) })
        }

        fn asset(&self, path: String) -> AssetFuture {
            self.asset_paths.lock().unwrap().push(path.clone());
            let file = match path.split('?').next().unwrap_or("") {
                "index.html" => Some(HeidrunCodeDashboardAsset { bytes: b"<html>heidrun_code_dashboard</html>".to_vec(), mime_type: "text/html".into() }),
                "assets/index-1234.js" => Some(HeidrunCodeDashboardAsset { bytes: b"console.log(1)".to_vec(), mime_type: "text/javascript".into() }),
                "src/main.ts" => Some(HeidrunCodeDashboardAsset { bytes: b"export {}".to_vec(), mime_type: "text/javascript".into() }),
                _ => None,
            };
            Box::pin(async move { file })
        }

        fn record_event(&self, event: HeidrunCodeDashboardServerEvent) {
            self.events.lock().unwrap().push(event);
        }
    }

    fn app(handler: Arc<FakeHandler>) -> Router {
        let mut guard = AccessGuard::default();
        guard.set_key(Some(KEY.to_string()));
        guard.set_port(51234);
        router(Shared { guard: Arc::new(Mutex::new(guard)), handler })
    }

    async fn send(app: Router, method: &str, uri: &str, headers: &[(&str, &str)]) -> Response {
        let mut request = Request::builder().method(method).uri(uri).header("host", HOST);
        for (name, value) in headers {
            request = request.header(*name, *value);
        }
        app.oneshot(request.body(Body::empty()).unwrap()).await.unwrap()
    }

    async fn body_text(response: Response) -> String {
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024).await.unwrap();
        String::from_utf8(bytes.to_vec()).unwrap()
    }

    #[tokio::test]
    async fn the_address_of_the_qr_code_gives_the_page_and_keeps_the_key_in_a_cookie() {
        let response = send(app(Arc::new(FakeHandler::default())), "GET", &format!("/heidrun_code_dashboard?key={KEY}"), &[]).await;
        assert_eq!(response.status(), StatusCode::OK);
        let cookie = response.headers().get(header::SET_COOKIE).unwrap().to_str().unwrap().to_string();
        assert!(cookie.starts_with(&format!("heidrun_code_dashboard_key={KEY};")));
        assert!(cookie.contains("HttpOnly"));
        assert!(cookie.contains("SameSite=Strict"));
        assert_eq!(response.headers().get(header::REFERRER_POLICY).unwrap(), "no-referrer");
        assert_eq!(response.headers().get(header::CACHE_CONTROL).unwrap(), "no-store");
        assert_eq!(response.headers().get(header::CONTENT_TYPE).unwrap(), "text/html");
        assert_eq!(body_text(response).await, "<html>heidrun_code_dashboard</html>");
    }

    #[tokio::test]
    async fn the_cookie_gives_the_page_the_state_and_the_other_files() {
        let handler = Arc::new(FakeHandler::default());
        let cookie = format!("other=1; heidrun_code_dashboard_key={KEY}");
        let page = send(app(handler.clone()), "GET", "/heidrun_code_dashboard", &[("cookie", &cookie)]).await;
        assert_eq!(page.status(), StatusCode::OK);
        assert!(page.headers().get(header::SET_COOKIE).is_none());
        let state = send(app(handler.clone()), "GET", "/heidrun_code_dashboard/api/state", &[("cookie", &cookie)]).await;
        assert_eq!(state.status(), StatusCode::OK);
        assert_eq!(body_text(state).await, r#"{"snapshot":{"workspaces":[]}}"#);
        let script = send(app(handler.clone()), "GET", "/assets/index-1234.js", &[("cookie", &cookie)]).await;
        assert_eq!(script.status(), StatusCode::OK);
        assert_eq!(script.headers().get(header::CACHE_CONTROL).unwrap(), ASSETS_CACHE_CONTROL);
        let module = send(app(handler.clone()), "GET", "/src/main.ts?t=12", &[("cookie", &cookie)]).await;
        assert_eq!(module.status(), StatusCode::OK);
        assert!(handler.asset_paths.lock().unwrap().contains(&"src/main.ts?t=12".to_string()));
        let missing = send(app(handler), "GET", "/nothing.js", &[("cookie", &cookie)]).await;
        assert_eq!(missing.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn a_request_without_the_right_key_gets_nothing_and_goes_to_the_application_log() {
        let handler = Arc::new(FakeHandler::default());
        for uri in ["/heidrun_code_dashboard", "/heidrun_code_dashboard?key=wrong", "/heidrun_code_dashboard/api/state", "/assets/index-1234.js", "/"] {
            let response = send(app(handler.clone()), "GET", uri, &[]).await;
            assert_eq!(response.status(), StatusCode::UNAUTHORIZED, "{uri}");
            assert!(body_text(response).await.contains("heidrun_code_dashboard") == false, "{uri}");
        }
        assert_eq!(*handler.state_calls.lock().unwrap(), 0);
        assert!(handler.asset_paths.lock().unwrap().is_empty());
        assert_eq!(handler.events.lock().unwrap()[0], HeidrunCodeDashboardServerEvent::Refused { reason: "unpaired" });
    }

    #[tokio::test]
    async fn the_old_address_of_the_mire_sends_the_device_to_the_new_address_with_the_same_query() {
        let handler = Arc::new(FakeHandler::default());
        let response = send(app(handler.clone()), "GET", &format!("/mire?key={KEY}"), &[]).await;
        assert_eq!(response.status(), StatusCode::PERMANENT_REDIRECT);
        assert_eq!(response.headers().get(header::LOCATION).unwrap(), &format!("/heidrun_code_dashboard?key={KEY}"));
        let response = send(app(handler.clone()), "GET", "/mire", &[]).await;
        assert_eq!(response.headers().get(header::LOCATION).unwrap(), "/heidrun_code_dashboard");
        assert!(handler.asset_paths.lock().unwrap().is_empty());
    }

    #[tokio::test]
    async fn the_old_cookie_of_the_mire_gives_the_page_and_the_state_and_the_page_copies_it_to_the_new_cookie() {
        let handler = Arc::new(FakeHandler::default());
        let cookie = format!("heidrun_mire_key={KEY}");
        let page = send(app(handler.clone()), "GET", "/heidrun_code_dashboard", &[("cookie", &cookie)]).await;
        assert_eq!(page.status(), StatusCode::OK);
        let new_cookie = page.headers().get(header::SET_COOKIE).unwrap().to_str().unwrap().to_string();
        assert!(new_cookie.starts_with(&format!("heidrun_code_dashboard_key={KEY};")));
        let state = send(app(handler), "GET", "/heidrun_code_dashboard/api/state", &[("cookie", &cookie)]).await;
        assert_eq!(state.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn the_header_of_the_key_also_gives_the_state() {
        let response = send(app(Arc::new(FakeHandler::default())), "GET", "/heidrun_code_dashboard/api/state", &[(KEY_HEADER, KEY)]).await;
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn ten_bad_keys_lock_the_server_and_write_the_lock_to_the_application_log() {
        let handler = Arc::new(FakeHandler::default());
        let router = app(handler.clone());
        for _ in 0..10 {
            let _ = send(router.clone(), "GET", "/heidrun_code_dashboard?key=wrong", &[]).await;
        }
        let response = send(router.clone(), "GET", "/heidrun_code_dashboard?key=wrong", &[]).await;
        assert_eq!(response.status(), StatusCode::TOO_MANY_REQUESTS);
        assert!(handler.events.lock().unwrap().contains(&HeidrunCodeDashboardServerEvent::Locked));
        let response = send(router, "GET", &format!("/heidrun_code_dashboard?key={KEY}"), &[]).await;
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn every_route_only_reads() {
        let handler = Arc::new(FakeHandler::default());
        let cookie = format!("heidrun_code_dashboard_key={KEY}");
        for uri in ["/heidrun_code_dashboard", "/heidrun_code_dashboard/api/state", "/assets/index-1234.js"] {
            for method in ["POST", "PUT", "DELETE", "PATCH"] {
                let response = send(app(handler.clone()), method, uri, &[("cookie", &cookie)]).await;
                assert_eq!(response.status(), StatusCode::METHOD_NOT_ALLOWED, "{method} {uri}");
            }
        }
        assert_eq!(*handler.state_calls.lock().unwrap(), 0);
    }

    #[tokio::test]
    async fn a_path_that_climbs_out_of_the_page_is_refused() {
        let handler = Arc::new(FakeHandler::default());
        let cookie = format!("heidrun_code_dashboard_key={KEY}");
        let response = send(app(handler.clone()), "GET", "/assets/../../secret", &[("cookie", &cookie)]).await;
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
        assert!(handler.asset_paths.lock().unwrap().is_empty());
    }
}
