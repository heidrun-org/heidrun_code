//! The mobile server of Heidrun Code: it serves the mobile website on the loopback address only, and an ngrok tunnel (the
//! program `ngrok`) gives it a fixed public HTTPS address. It checks the host name of the tunnel and the pairing key of every
//! request, and hands each call of the phone to the desktop application through the trait `MobileCallHandler`. The server
//! knows nothing about coding agents, and nothing about Tauri.

mod access;
mod config;
mod embedded;
mod handler;
mod leftover_tunnel;
pub mod push;
mod router;
mod server;
mod tunnel;

pub use config::{load_config, new_token, save_config, MobileConfig};
pub use handler::{CallFuture, MobileCallHandler};
pub use server::{MobileError, MobileErrorKind, MobileServer, MobileStatus};
pub use tunnel::find_ngrok;
