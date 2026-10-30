//! The checks of every request: the header Host, the header Origin, the pairing key, and the lock after bad keys. The only
//! host that passes is an IPv4 address with the port of the server, so a page of another site that a name server points
//! to this computer (DNS rebinding) never passes.

use axum::http::StatusCode;
use std::net::Ipv4Addr;
use std::time::{Duration, Instant};

const MAX_FAILURES: u32 = 10;
const LOCK: Duration = Duration::from_secs(60);

/// Why a request is refused.
#[derive(Debug, PartialEq, Eq)]
pub enum Denial {
    /// The header Host is not an IPv4 address with the port of the server.
    UnexpectedHost,
    /// The header Origin is not the page of the same host.
    UnexpectedOrigin,
    /// The option is off.
    Off,
    /// Too many bad keys in a row: wait.
    TooManyAttempts,
    /// The pairing key is missing or wrong.
    Unpaired,
}

impl Denial {
    /// The name of the denial for the application log, in snake case.
    pub fn name(&self) -> &'static str {
        match self {
            Denial::UnexpectedHost => "unexpected_host",
            Denial::UnexpectedOrigin => "unexpected_origin",
            Denial::Off => "off",
            Denial::TooManyAttempts => "too_many_attempts",
            Denial::Unpaired => "unpaired",
        }
    }

    /// The status and the text that the device receives. The text holds nothing of the Mire.
    pub fn status_and_text(&self) -> (StatusCode, &'static str) {
        match self {
            Denial::UnexpectedHost => (StatusCode::FORBIDDEN, "Unexpected host"),
            Denial::UnexpectedOrigin => (StatusCode::FORBIDDEN, "Origin refused"),
            Denial::Off => (StatusCode::SERVICE_UNAVAILABLE, "The Mire is not shown on the local network"),
            Denial::TooManyAttempts => (StatusCode::TOO_MANY_REQUESTS, "Too many attempts: try again in one minute"),
            Denial::Unpaired => (StatusCode::UNAUTHORIZED, "Pairing needed: scan the QR code in the Settings window of Heidrun Code"),
        }
    }
}

/// The pairing key and the port that are accepted right now, and the count of the bad keys.
#[derive(Default)]
pub struct AccessGuard {
    /// The key accepted right now: None once the option is turned off. Checked on every request, so a new key cuts off
    /// the devices that still use the old key.
    key: Option<String>,
    /// The port of the server. The header Host must name it.
    port: u16,
    failures: u32,
    locked_until: Option<Instant>,
}

impl AccessGuard {
    /// Accepts this pairing key from now on.
    pub fn set_key(&mut self, key: Option<String>) {
        self.key = key;
    }

    /// Accepts only this port in the header Host from now on.
    pub fn set_port(&mut self, port: u16) {
        self.port = port;
    }

    /// True while the wrong keys are refused, after ten bad keys in a row.
    pub fn is_locked(&self, now: Instant) -> bool {
        self.locked_until.map(|until| now < until).unwrap_or(false)
    }

    /// Checks one request. The arguments are the header Host, the header Origin, and the key that the request gives.
    pub fn authorize(&mut self, host: Option<&str>, origin: Option<&str>, given: Option<&str>, now: Instant) -> Result<(), Denial> {
        let host = host.unwrap_or("");
        if self.is_expected_host(host) == false {
            return Err(Denial::UnexpectedHost);
        }
        if let Some(origin) = origin {
            if origin != format!("http://{host}") {
                return Err(Denial::UnexpectedOrigin);
            }
        }
        let Some(key) = self.key.as_deref() else {
            return Err(Denial::Off);
        };
        let given = given.unwrap_or("");
        // The right key always passes: bad attempts cannot lock the owner out.
        if given.is_empty() == false && same(given, key) {
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

    /// True for `<IPv4 address>:<port of the server>`. A host name, an IPv6 address, or another port is refused.
    fn is_expected_host(&self, host: &str) -> bool {
        let Some((address, port)) = host.rsplit_once(':') else {
            return false;
        };
        address.parse::<Ipv4Addr>().is_ok() && port.parse::<u16>().ok() == Some(self.port) && self.port != 0
    }
}

/// Constant-time comparison (the key must not leak through timing).
fn same(a: &str, b: &str) -> bool {
    a.len() == b.len() && a.bytes().zip(b.bytes()).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    const HOST: &str = "192.168.1.20:51234";
    const KEY: &str = "0123456789abcdef";

    fn guard() -> AccessGuard {
        let mut guard = AccessGuard::default();
        guard.set_key(Some(KEY.to_string()));
        guard.set_port(51234);
        guard
    }

    #[test]
    fn accepts_the_right_key_on_an_ipv4_address_with_the_port_of_the_server() {
        let now = Instant::now();
        assert_eq!(guard().authorize(Some(HOST), None, Some(KEY), now), Ok(()));
        assert_eq!(guard().authorize(Some("10.0.0.7:51234"), Some("http://10.0.0.7:51234"), Some(KEY), now), Ok(()));
    }

    #[test]
    fn refuses_a_host_name_another_port_or_no_host_even_with_the_right_key() {
        let now = Instant::now();
        for host in ["evil.example:51234", "localhost:51234", "192.168.1.20:80", "192.168.1.20", "[::1]:51234", ""] {
            assert_eq!(guard().authorize(Some(host), None, Some(KEY), now), Err(Denial::UnexpectedHost), "{host}");
        }
        assert_eq!(guard().authorize(None, None, Some(KEY), now), Err(Denial::UnexpectedHost));
    }

    #[test]
    fn refuses_a_page_of_another_origin() {
        let now = Instant::now();
        assert_eq!(guard().authorize(Some(HOST), Some("http://evil.example"), Some(KEY), now), Err(Denial::UnexpectedOrigin));
        assert_eq!(guard().authorize(Some(HOST), Some("https://192.168.1.20:51234"), Some(KEY), now), Err(Denial::UnexpectedOrigin));
    }

    #[test]
    fn refuses_every_request_while_the_option_is_off() {
        let mut guard = guard();
        guard.set_key(None);
        assert_eq!(guard.authorize(Some(HOST), None, Some(KEY), Instant::now()), Err(Denial::Off));
    }

    #[test]
    fn refuses_a_missing_or_wrong_key_and_locks_after_ten_bad_keys_but_never_locks_the_right_key() {
        let mut guard = guard();
        let now = Instant::now();
        assert_eq!(guard.authorize(Some(HOST), None, None, now), Err(Denial::Unpaired));
        for _ in 0..9 {
            assert_eq!(guard.authorize(Some(HOST), None, Some("wrong"), now), Err(Denial::Unpaired));
        }
        assert!(guard.is_locked(now));
        assert_eq!(guard.authorize(Some(HOST), None, Some("wrong"), now), Err(Denial::TooManyAttempts));
        assert_eq!(guard.authorize(Some(HOST), None, Some(KEY), now), Ok(()));
        let later = now + LOCK + Duration::from_secs(1);
        assert_eq!(guard.authorize(Some(HOST), None, Some("wrong"), later), Err(Denial::Unpaired));
    }

    #[test]
    fn a_new_key_refuses_the_old_key_at_once() {
        let mut guard = guard();
        guard.set_key(Some("fedcba9876543210".to_string()));
        assert_eq!(guard.authorize(Some(HOST), None, Some(KEY), Instant::now()), Err(Denial::Unpaired));
    }
}
