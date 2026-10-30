//! The Heidrun Code Dashboard server of Heidrun Code: it serves the Heidrun Code Dashboard page to a phone or a tablet of the local network, used as a second
//! screen. It only reads: the page shows the Heidrun Code Dashboard, and sends nothing to a pane. A pairing key protects every request. The
//! server knows nothing about coding agents and nothing about Tauri: the desktop application gives the files of the page
//! and the state of the Heidrun Code Dashboard through the trait `HeidrunCodeDashboardServerHandler`.

mod access;
mod config;
mod handler;
mod router;
mod server;

pub use config::{free_port, load_config, new_key, save_config, HeidrunCodeDashboardServerConfig};
pub use handler::{AssetFuture, HeidrunCodeDashboardAsset, HeidrunCodeDashboardServerEvent, HeidrunCodeDashboardServerHandler, StateFuture};
pub use router::{PAGE_PATH, STATE_PATH};
pub use server::{local_network_address, page_address, HeidrunCodeDashboardServer, HeidrunCodeDashboardServerError, HeidrunCodeDashboardServerErrorKind, HeidrunCodeDashboardServerStatus};
