//! The checks of every request: the header Host, the header Origin, the pairing key, and the lock after bad keys. The only
//! host name that passes is the host name of the ngrok tunnel.

use axum::http::StatusCode;
use std::time::{Duration, Instant};

const MAX_FAILURES: u32 = 10;
const LOCK: Duration = Duration::from_secs(60);

/// Why a request is refused.
#[derive(Debug, PartialEq, Eq)]
pub enum Denial {
    /// The header Host is not the host name of the tunnel, or the tunnel has no host name yet.
    UnexpectedHost,
    /// The header Origin is not the page of the tunnel.
    UnexpectedOrigin,
    /// The mobile access is off.
    Off,
    /// Too many bad keys in a row: wait.
    TooManyAttempts,
    /// The pairing key is missing or wrong.
    Unpaired,
}

impl Denial {
    /// The status and the text that the phone receives.
    pub fn status_and_text(&self) -> (StatusCode, &'static str) {
        match self {
            Denial::UnexpectedHost => (StatusCode::FORBIDDEN, "Unexpected host"),
            Denial::UnexpectedOrigin => (StatusCode::FORBIDDEN, "Origin refused"),
            Denial::Off => (StatusCode::SERVICE_UNAVAILABLE, "Mobile access is off on the computer"),
            Denial::TooManyAttempts => (StatusCode::TOO_MANY_REQUESTS, "Too many attempts: try again in one minute"),
            Denial::Unpaired => (StatusCode::UNAUTHORIZED, "Pairing needed: scan the QR code in Heidrun Code"),
        }
    }
}

/// The pairing key and the host name of the tunnel that are accepted right now, and the count of the bad keys.
#[derive(Default)]
pub struct AccessGuard {
    /// The key accepted right now: None once the access is turned off. Checked on every request, so revoking cuts off
    /// connections that are still open.
    token: Option<String>,
    /// The host name of the tunnel, in lower case, for example "words-of-the-tunnel.ngrok-free.dev". None while the
    /// tunnel has no address: then no request passes.
    tunnel_host: Option<String>,
    failures: u32,
    locked_until: Option<Instant>,
}

impl AccessGuard {
    /// Accepts this pairing key from now on, and forgets the bad keys.
    pub fn set_token(&mut self, token: Option<String>) {
        self.token = token;
    }

    /// Accepts only this host name from now on: the host name of the tunnel, or None when the tunnel is down.
    pub fn set_tunnel_host(&mut self, host: Option<String>) {
        self.tunnel_host = host.map(|host| host.to_ascii_lowercase());
    }

    /// Checks one request. The arguments are the headers of the request.
    pub fn authorize(&mut self, host: Option<&str>, origin: Option<&str>, given: Option<&str>, now: Instant) -> Result<(), Denial> {
        // Only requests addressed to the tunnel, from its own page: a request to the loopback address, a web page
        // elsewhere, or a DNS-rebinding trick cannot even get to the token check.
        let Some(expected_host) = self.tunnel_host.as_deref() else {
            return Err(Denial::UnexpectedHost);
        };
        if !host.unwrap_or("").eq_ignore_ascii_case(expected_host) {
            return Err(Denial::UnexpectedHost);
        }
        if let Some(origin) = origin {
            if !origin.eq_ignore_ascii_case(&format!("https://{expected_host}")) {
                return Err(Denial::UnexpectedOrigin);
            }
        }
        let Some(token) = self.token.as_deref() else {
            return Err(Denial::Off);
        };
        let given = given.unwrap_or("");
        // The right token always passes: bad attempts cannot lock the owner out.
        if !given.is_empty() && same(given, token) {
            return Ok(());
        }
        if let Some(until) = self.locked_until {
            if now < until {
                return Err(Denial::TooManyAttempts);
            }
            self.locked_until = None;
        }
        self.failures += 1;
        if self.failures >= MAX_FAILURES {
            self.failures = 0;
            self.locked_until = Some(now + LOCK);
        }
        Err(Denial::Unpaired)
    }
}

/// Constant-time comparison (the token must not leak through timing).
fn same(a: &str, b: &str) -> bool {
    a.len() == b.len() && a.bytes().zip(b.bytes()).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    const HOST: &str = "words-of-the-tunnel.ngrok-free.dev";
    const TOKEN: &str = "0123456789abcdef";

    fn guard() -> AccessGuard {
        let mut guard = AccessGuard::default();
        guard.set_token(Some(TOKEN.to_string()));
        guard.set_tunnel_host(Some(HOST.to_string()));
        guard
    }

    fn check(guard: &mut AccessGuard, given: Option<&str>, now: Instant) -> Result<(), Denial> {
        guard.authorize(Some(HOST), None, given, now)
    }

    #[test]
    fn compares_tokens_by_content() {
        assert!(same("abc", "abc"));
        assert!(!same("abc", "abd"));
        assert!(!same("abc", "abcd"));
        assert!(same("", ""));
    }

    #[test]
    fn the_right_key_passes() {
        assert_eq!(check(&mut guard(), Some(TOKEN), Instant::now()), Ok(()));
    }

    #[test]
    fn a_missing_or_wrong_key_is_unpaired() {
        let now = Instant::now();
        assert_eq!(check(&mut guard(), None, now), Err(Denial::Unpaired));
        assert_eq!(check(&mut guard(), Some(""), now), Err(Denial::Unpaired));
        assert_eq!(check(&mut guard(), Some("wrong"), now), Err(Denial::Unpaired));
    }

    #[test]
    fn a_wrong_host_is_refused_before_the_key_is_read() {
        let mut guard = guard();
        let now = Instant::now();
        assert_eq!(guard.authorize(Some("evil.example"), None, Some(TOKEN), now), Err(Denial::UnexpectedHost));
        assert_eq!(guard.authorize(None, None, Some(TOKEN), now), Err(Denial::UnexpectedHost));
        assert_eq!(guard.authorize(Some(""), None, Some(TOKEN), now), Err(Denial::UnexpectedHost));
    }

    #[test]
    fn the_loopback_address_is_refused_even_with_the_right_key() {
        let mut guard = guard();
        let now = Instant::now();
        assert_eq!(guard.authorize(Some("127.0.0.1:47823"), None, Some(TOKEN), now), Err(Denial::UnexpectedHost));
        assert_eq!(guard.authorize(Some("localhost:47823"), None, Some(TOKEN), now), Err(Denial::UnexpectedHost));
    }

    #[test]
    fn a_host_that_only_starts_or_ends_like_the_tunnel_is_refused() {
        let mut guard = guard();
        let now = Instant::now();
        assert_eq!(guard.authorize(Some("evil-words-of-the-tunnel.ngrok-free.dev"), None, Some(TOKEN), now), Err(Denial::UnexpectedHost));
        assert_eq!(guard.authorize(Some("words-of-the-tunnel.ngrok-free.dev.evil.example"), None, Some(TOKEN), now), Err(Denial::UnexpectedHost));
        assert_eq!(guard.authorize(Some("words-of-the-tunnel.ngrok-free.dev:443"), None, Some(TOKEN), now), Err(Denial::UnexpectedHost));
    }

    #[test]
    fn the_host_name_is_compared_without_the_case_of_the_letters() {
        let mut guard = guard();
        assert_eq!(guard.authorize(Some("Words-Of-The-Tunnel.NGROK-free.dev"), None, Some(TOKEN), Instant::now()), Ok(()));
        guard.set_tunnel_host(Some("Other-Words.NGROK-free.dev".to_string()));
        assert_eq!(guard.authorize(Some("other-words.ngrok-free.dev"), None, Some(TOKEN), Instant::now()), Ok(()));
    }

    #[test]
    fn nothing_passes_while_the_tunnel_has_no_host_name() {
        let mut guard = guard();
        guard.set_tunnel_host(None);
        assert_eq!(check(&mut guard, Some(TOKEN), Instant::now()), Err(Denial::UnexpectedHost));
    }

    #[test]
    fn a_new_host_name_of_the_tunnel_replaces_the_old_host_name_at_once() {
        let mut guard = guard();
        guard.set_tunnel_host(Some("second-tunnel.ngrok-free.dev".to_string()));
        let now = Instant::now();
        assert_eq!(check(&mut guard, Some(TOKEN), now), Err(Denial::UnexpectedHost));
        assert_eq!(guard.authorize(Some("second-tunnel.ngrok-free.dev"), None, Some(TOKEN), now), Ok(()));
    }

    #[test]
    fn a_wrong_origin_is_refused_and_the_origin_of_the_tunnel_passes() {
        let mut guard = guard();
        let now = Instant::now();
        let origin_of_the_tunnel = format!("https://{HOST}");
        let origin_without_encryption = format!("http://{HOST}");
        assert_eq!(guard.authorize(Some(HOST), Some("https://evil.example"), Some(TOKEN), now), Err(Denial::UnexpectedOrigin));
        assert_eq!(guard.authorize(Some(HOST), Some(&origin_without_encryption), Some(TOKEN), now), Err(Denial::UnexpectedOrigin));
        assert_eq!(guard.authorize(Some(HOST), Some("null"), Some(TOKEN), now), Err(Denial::UnexpectedOrigin));
        assert_eq!(guard.authorize(Some(HOST), Some(&origin_of_the_tunnel), Some(TOKEN), now), Ok(()));
    }

    #[test]
    fn nothing_passes_when_the_access_is_off() {
        let mut guard = guard();
        guard.set_token(None);
        assert_eq!(check(&mut guard, Some(TOKEN), Instant::now()), Err(Denial::Off));
    }

    #[test]
    fn ten_bad_keys_lock_the_wrong_keys_for_one_minute_but_never_the_right_key() {
        let mut guard = guard();
        let start = Instant::now();
        for _ in 0..10 {
            assert_eq!(check(&mut guard, Some("wrong"), start), Err(Denial::Unpaired));
        }
        assert_eq!(check(&mut guard, Some("wrong"), start), Err(Denial::TooManyAttempts));
        assert_eq!(check(&mut guard, Some(TOKEN), start), Ok(()));
        assert_eq!(check(&mut guard, Some("wrong"), start + Duration::from_secs(59)), Err(Denial::TooManyAttempts));
        assert_eq!(check(&mut guard, Some("wrong"), start + Duration::from_secs(61)), Err(Denial::Unpaired));
    }

    #[test]
    fn a_new_key_replaces_the_old_key_at_once() {
        let mut guard = guard();
        guard.set_token(Some("fedcba9876543210".to_string()));
        let now = Instant::now();
        assert_eq!(check(&mut guard, Some(TOKEN), now), Err(Denial::Unpaired));
        assert_eq!(check(&mut guard, Some("fedcba9876543210"), now), Ok(()));
    }
}
