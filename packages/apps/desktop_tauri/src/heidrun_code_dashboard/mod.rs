//! The live observation sources of the Heidrun Code Dashboard: the Claude Code observer mod, the start of the chat of a new Codex pane,
//! the one shared collector that reads the sources while a Heidrun Code Dashboard view is open, the separate Heidrun Code Dashboard window, and the Heidrun Code Dashboard on
//! the local network. See
//! `CONTEXT.md`.

pub mod claude_observer_mod;
pub mod claude_snapshots;
pub mod codex_chat_preparation;
pub mod codex_connection;
pub mod codex_threads;
pub mod collector;
pub mod contract;
pub mod local_network;
pub mod heidrun_code_dashboard_window;
