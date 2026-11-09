//! The trait that the desktop application implements: the only way for the Heidrun Code Dashboard server to get the files of the page and
//! the state of the Heidrun Code Dashboard, and for the events of the server to reach the application log.

use serde_json::Value;
use std::future::Future;
use std::pin::Pin;

/// The state of the Heidrun Code Dashboard that the page shows, or a text for the device.
pub type StateFuture = Pin<Box<dyn Future<Output = Result<Value, String>> + Send>>;

/// One file of the page, or None when the application has no such file.
pub type AssetFuture = Pin<Box<dyn Future<Output = Option<HeidrunCodeDashboardAsset>> + Send>>;

/// One file of the page: the same files as the window of the desktop application.
#[derive(Debug, Clone, PartialEq)]
pub struct HeidrunCodeDashboardAsset {
    /// The content of the file.
    pub bytes: Vec<u8>,
    /// The media type of the file, for example `text/html`.
    pub mime_type: String,
}

/// One event of the Heidrun Code Dashboard server, for the application log. No event holds a pairing key or an address.
#[derive(Debug, Clone, PartialEq)]
pub enum HeidrunCodeDashboardServerEvent {
    /// A request was refused before it reached the handler.
    Refused {
        /// Why: `unexpected_host`, `unexpected_origin`, `off`, `too_many_attempts`, or `unpaired`.
        reason: &'static str,
    },
    /// Ten bad pairing keys in a row: the wrong keys are refused for one minute.
    Locked,
}

/// What the desktop application gives to the Heidrun Code Dashboard server. Nothing here sends text to a pane or changes anything.
pub trait HeidrunCodeDashboardServerHandler: Send + Sync {
    /// The state of the Heidrun Code Dashboard: the Herdr snapshot and the live observations, read from the one shared collector.
    fn state(&self) -> StateFuture;

    /// One file of the page. `path` has no leading slash, for example `index.html` or `assets/index-1234.js`.
    fn asset(&self, path: String) -> AssetFuture;

    /// Writes one event to the application log.
    fn record_event(&self, event: HeidrunCodeDashboardServerEvent);
}
