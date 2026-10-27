//! Runs a coding agent command line tool (`codex`, `claude`, or `agy`) on this computer.
//!
//! The library has two calls. `ask` sends one prompt to a coding agent and gives the answer. `run_tool` runs a tool with
//! arguments and gives what it printed, for example the list of the models of the tool. Both go through an `AgentShell`:
//! the desktop application uses the login shell, and the command line of this package uses a plain shell.

mod agent_shell;
mod ask;
#[cfg(test)]
mod fake_commands;
mod run_tool;

pub use agent_shell::{login_shell, AgentShell};
pub use ask::{ask, ask_light, coding_agent_names, Answer, CODING_AGENTS, DEFAULT_CODING_AGENTS, NO_CODING_AGENT};
pub use run_tool::run_tool;
