//! The Mire server of Heidrun Code: it serves the Mire page to a phone or a tablet of the local network, used as a second
//! screen. It only reads: the page shows the Mire, and sends nothing to a pane. A pairing key protects every request. The
//! server knows nothing about coding agents and nothing about Tauri: the desktop application gives the files of the page
//! and the state of the Mire through the trait `MireServerHandler`.

mod access;
mod config;
mod handler;
mod router;
mod server;

pub use config::{free_port, load_config, new_key, save_config, MireServerConfig};
pub use handler::{AssetFuture, MireAsset, MireServerEvent, MireServerHandler, StateFuture};
pub use router::{PAGE_PATH, STATE_PATH};
pub use server::{local_network_address, page_address, MireServer, MireServerError, MireServerErrorKind, MireServerStatus};
