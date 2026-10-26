//! The trait that the desktop application implements: the only way for a call of the phone to reach the desktop, and for the
//! events of the mobile server to reach the application log of the desktop application.

use serde_json::Value;
use std::future::Future;
use std::pin::Pin;

/// The answer of the desktop application to one call of the phone. `Err` carries a text for the phone.
pub type CallFuture = Pin<Box<dyn Future<Output = Result<Value, String>> + Send>>;

/// One event of the mobile server, for the application log of the desktop application. No event holds a pairing key, the
/// address of the tunnel, or the parameters of a call.
#[derive(Debug, Clone, PartialEq)]
pub enum MobileEvent {
    /// A request on `/api` that passed the checks ended. `method` is a method of the closed list, or `unknown`.
    Call {
        /// The method of the call.
        method: String,
        /// The HTTP status of the answer.
        status: u16,
        /// The time from the arrival of the request to the answer.
        duration_ms: u64,
        /// The first line of the failure, or None.
        error: Option<String>,
    },
    /// A request on `/api` was refused before it reached the handler.
    Refused {
        /// Why: `unexpected_host`, `unexpected_origin`, `off`, `too_many_attempts`, or `unpaired` (a missing or wrong
        /// pairing key).
        reason: &'static str,
    },
    /// Ten bad pairing keys in a row: the wrong keys are refused for one minute.
    Locked,
    /// The program `ngrok` started.
    TunnelStart,
    /// The program `ngrok` announced the address of the tunnel.
    TunnelReady {
        /// The time from the start of the program to the address.
        duration_ms: u64,
    },
    /// The tunnel stopped, or could not start.
    TunnelStop {
        /// The time since the start of this try, the search of the program `ngrok` included.
        duration_ms: u64,
        /// What went wrong, in camel case like `MobileErrorKind`, for example `ngrokNotSignedIn`, or None when the
        /// developer turned the access off. Never the words of `ngrok`, which can hold the address of the tunnel.
        error: Option<String>,
    },
}

/// Answers the calls that the phone sends. The mobile server checks the pairing key and the method name before it
/// calls `handle_call`, so the handler only sees the methods of the closed list.
pub trait MobileCallHandler: Send + Sync + 'static {
    /// Answers one call of the phone, with the same data and the same guards as the desktop window.
    fn handle_call(&self, method: String, params: Value) -> CallFuture;

    /// Receives one event of the mobile server, for the application log. It must return at once. By default it does nothing.
    fn record_event(&self, _event: MobileEvent) {}
}
