//! Real terminals for the panes: each view runs `herdr terminal attach <terminal_id>`
//! inside a pseudo-terminal, and xterm.js renders its output byte for byte.

use base64::Engine;
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

use crate::herdr::{command_arguments, herdr_bin};

struct Session {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn Child + Send + Sync>,
}

#[derive(Default)]
pub struct PtyState {
    sessions: Mutex<HashMap<String, Session>>,
}

#[derive(Clone, Serialize)]
struct DataEvent<'a> {
    id: &'a str,
    data: String,
}

#[derive(Clone, Serialize)]
struct ExitEvent<'a> {
    id: &'a str,
}

/// The arguments of the command that attaches to the terminal `terminal_id`, in the session that Heidrun Code uses.
fn attach_arguments(terminal_id: &str, takeover: bool) -> Vec<String> {
    let mut arguments = vec!["terminal", "attach", terminal_id];
    if takeover {
        arguments.push("--takeover");
    }
    command_arguments(&arguments)
}

#[tauri::command]
pub fn pty_spawn(
    app: AppHandle,
    state: State<'_, PtyState>,
    id: String,
    terminal_id: String,
    cols: u16,
    rows: u16,
    takeover: bool,
) -> Result<(), String> {
    let pair = native_pty_system()
        .openpty(PtySize { rows: rows.max(2), cols: cols.max(10), pixel_width: 0, pixel_height: 0 })
        .map_err(|e| e.to_string())?;

    let mut cmd = CommandBuilder::new(herdr_bin());
    cmd.args(attach_arguments(&terminal_id, takeover));
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");
    if let Some(home) = dirs::home_dir() {
        cmd.cwd(home);
    }

    let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    drop(pair.slave);
    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    state
        .sessions
        .lock()
        .unwrap()
        .insert(id.clone(), Session { master: pair.master, writer, child });

    std::thread::spawn(move || {
        let engine = base64::engine::general_purpose::STANDARD;
        let mut buf = [0u8; 16 * 1024];
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    let _ = app.emit("pty://data", DataEvent { id: &id, data: engine.encode(&buf[..n]) });
                }
            }
        }
        let _ = app.emit("pty://exit", ExitEvent { id: &id });
    });
    Ok(())
}

#[tauri::command]
pub fn pty_write(state: State<'_, PtyState>, id: String, data: String) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap();
    let s = sessions.get_mut(&id).ok_or("pty_not_found")?;
    s.writer.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
    s.writer.flush().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn pty_resize(state: State<'_, PtyState>, id: String, cols: u16, rows: u16) -> Result<(), String> {
    let sessions = state.sessions.lock().unwrap();
    let s = sessions.get(&id).ok_or("pty_not_found")?;
    s.master
        .resize(PtySize { rows: rows.max(2), cols: cols.max(10), pixel_width: 0, pixel_height: 0 })
        .map_err(|e| e.to_string())
}

/// Closing a view only stops the attach client: the pane keeps running inside Herdr.
#[tauri::command]
pub fn pty_kill(state: State<'_, PtyState>, id: String) -> Result<(), String> {
    if let Some(mut s) = state.sessions.lock().unwrap().remove(&id) {
        // Detach cleanly (prefix ctrl+b, then q) before forcing the client to exit.
        let _ = s.writer.write_all(b"\x02q");
        let _ = s.writer.flush();
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(400));
            let _ = s.child.kill();
            let _ = s.child.wait();
        });
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_attach_command_uses_the_heidrun_session() {
        let _guard = crate::herdr::ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        crate::herdr::clear_env();
        let session = crate::herdr::session_name();
        assert_eq!(attach_arguments("term_1", false), vec!["--session", session.as_str(), "terminal", "attach", "term_1"]);
        assert_eq!(
            attach_arguments("term_1", true),
            vec!["--session", session.as_str(), "terminal", "attach", "term_1", "--takeover"]
        );
    }
}
