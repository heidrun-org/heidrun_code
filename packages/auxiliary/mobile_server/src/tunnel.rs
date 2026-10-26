//! The ngrok tunnel: it finds the program `ngrok`, starts it, and reads the public address that it announces.

use serde_json::Value;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, AsyncRead, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::mpsc;

/// The usual folders of programs that Homebrew and the system use. An application that the Finder starts does not get the
/// variable `PATH` of the shell, so Heidrun Code looks in these folders, like it does for the program `herdr`.
const COMMON_FOLDERS: [&str; 3] = ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"];

/// The code that `ngrok` gives when the developer has no account, or no authtoken in the configuration of `ngrok`.
pub const NOT_SIGNED_IN_CODE: &str = "ERR_NGROK_4018";

/// The code that `ngrok` gives when another program `ngrok` already holds the fixed address of the account.
pub const ADDRESS_IN_USE_CODE: &str = "ERR_NGROK_334";

/// The longest text of a problem that `read_message` returns, in characters.
const LONGEST_PROBLEM: usize = 400;

/// Finds the program `ngrok`. The variable `HEIDRUN_CODE_NGROK` gives its path. Without the variable, the usual folders are
/// searched: `~/.local/bin`, then `COMMON_FOLDERS`. None when the program is not there.
pub fn find_ngrok() -> Option<PathBuf> {
    let mut folders: Vec<PathBuf> = dirs::home_dir().map(|home| home.join(".local").join("bin")).into_iter().collect();
    folders.extend(COMMON_FOLDERS.iter().map(PathBuf::from));
    find_with(std::env::var("HEIDRUN_CODE_NGROK").ok(), &folders)
}

fn find_with(override_path: Option<String>, folders: &[PathBuf]) -> Option<PathBuf> {
    if let Some(path) = override_path.filter(|path| !path.is_empty()) {
        let path = PathBuf::from(path);
        return is_program(&path).then_some(path);
    }
    folders.iter().map(|folder| folder.join("ngrok")).find(|path| is_program(path))
}

fn is_program(path: &Path) -> bool {
    let Ok(metadata) = std::fs::metadata(path) else {
        return false;
    };
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        metadata.is_file() && metadata.permissions().mode() & 0o111 != 0
    }
    #[cfg(not(unix))]
    {
        metadata.is_file()
    }
}

/// Starts the program `ngrok` for a tunnel to the server on the loopback address. The program writes its messages as one
/// JSON record per line on its standard output, and a failure that comes before the log starts on its standard error:
/// both arrive, line by line, in the returned receiver, which closes when the program has ended. The caller kills the
/// program with the returned `Child`. The program is also killed when the `Child` is dropped.
///
/// The option `--inspect=false` keeps the local web interface of `ngrok` from remembering the requests, so that the
/// pairing key of a call never stays in a list that another program of this computer can read.
pub fn spawn(program: &Path, local_port: u16) -> std::io::Result<(Child, mpsc::UnboundedReceiver<String>)> {
    let mut child = Command::new(program)
        .args(["http", &format!("127.0.0.1:{local_port}"), "--inspect=false", "--log=stdout", "--log-format=json"])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()?;
    let stdout = child.stdout.take().ok_or_else(|| std::io::Error::other("the standard output of ngrok is not open"))?;
    let stderr = child.stderr.take().ok_or_else(|| std::io::Error::other("the standard error of ngrok is not open"))?;
    let (sender, receiver) = mpsc::unbounded_channel();
    forward_lines(stdout, sender.clone());
    forward_lines(stderr, sender);
    Ok((child, receiver))
}

fn forward_lines<R: AsyncRead + Unpin + Send + 'static>(stream: R, sender: mpsc::UnboundedSender<String>) {
    tokio::spawn(async move {
        let mut lines = BufReader::new(stream).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            if sender.send(line).is_err() {
                break;
            }
        }
    });
}

/// What one line of the messages of `ngrok` says.
#[derive(Debug, PartialEq)]
pub enum Message {
    /// The tunnel is up at this host name, in lower case, with no `https://`.
    Announced(String),
    /// A record of the log at the level error or critical, with its text on one line.
    Problem(String),
    /// A line that is not a record of the log: the program writes such a line when it fails before the log starts.
    Plain(String),
    /// Any other line.
    Other,
}

/// Reads one line of the messages of `ngrok`. Only the record "started tunnel" of the tunnels counts as the address of
/// the tunnel, for example `{"lvl":"info","msg":"started tunnel","obj":"tunnels","url":"https://words.ngrok-free.dev"}`.
/// An address in any other record, or in a line that is not a record, never counts. The address must be `https://` and a
/// host name, with no port and no path.
pub fn read_message(line: &str) -> Message {
    let line = line.trim();
    if line.is_empty() {
        return Message::Other;
    }
    let Ok(Value::Object(record)) = serde_json::from_str::<Value>(line) else {
        return Message::Plain(one_line(line));
    };
    let text_of = |key: &str| record.get(key).and_then(Value::as_str);
    if text_of("msg") == Some("started tunnel") && text_of("obj") == Some("tunnels") {
        return text_of("url").and_then(host_of_url).map_or(Message::Other, Message::Announced);
    }
    match (text_of("lvl"), text_of("err")) {
        (Some("eror" | "crit"), Some(error)) if !error.trim().is_empty() => Message::Problem(one_line(error)),
        _ => Message::Other,
    }
}

fn host_of_url(url: &str) -> Option<String> {
    let host = url.strip_prefix("https://")?.trim_end_matches('/').to_ascii_lowercase();
    let is_host_name = host.contains('.') && host.split('.').all(|label| !label.is_empty() && label.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-'));
    is_host_name.then_some(host)
}

fn one_line(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ").chars().take(LONGEST_PROBLEM).collect()
}

#[cfg(test)]
pub mod fake {
    use std::path::{Path, PathBuf};

    /// The first records of the log of a real `ngrok` 3.39.11 that starts a tunnel: the start of the local web interface,
    /// the session, and the record "started tunnel" with the fixed address of the account.
    pub const ANNOUNCEMENT: &str = r#"
printf '%s\n' '{"t":"2026-10-16T02:49:54+0200","lvl":"info","msg":"no configuration paths supplied"}'
printf '%s\n' '{"t":"2026-10-16T02:49:54+0200","lvl":"info","msg":"starting web service","obj":"web","addr":"127.0.0.1:4040","allow_hosts":null}'
printf '%s\n' '{"t":"2026-10-16T02:49:54+0200","lvl":"info","msg":"client session established","obj":"tunnels.session"}'
printf '%s\n' '{"t":"2026-10-16T02:49:54+0200","lvl":"info","msg":"tunnel session started","obj":"tunnels.session"}'
printf '%s\n' '{"t":"2026-10-16T02:49:54+0200","lvl":"info","msg":"started tunnel","obj":"tunnels","name":"command_line","addr":{"Scheme":"http","Opaque":"","User":null,"Host":"127.0.0.1:47990","Path":"","Fragment":"","RawQuery":"","RawPath":"","RawFragment":"","ForceQuery":false,"OmitHost":false},"url":"https://fake-words-of-the-tunnel.ngrok-free.dev"}'
"#;

    /// The host name that `ANNOUNCEMENT` announces.
    pub const ANNOUNCED_HOST: &str = "fake-words-of-the-tunnel.ngrok-free.dev";

    /// The records of a real `ngrok` 3.39.11 that has no account: the critical record, then the program ends.
    pub const NOT_SIGNED_IN: &str = r#"
printf '%s\n' '{"t":"2026-10-16T02:55:20+0200","lvl":"eror","msg":"session closing","obj":"tunnels.session","err":"authentication failed: This ngrok session is not authenticated. ngrok requires an account and a valid credential to start a session.\n\nSign up for an account: https://dashboard.ngrok.com/signup\nGet your credential: https://dashboard.ngrok.com/get-started/your-authtoken\r\n\r\nERR_NGROK_4018\r\n"}'
printf '%s\n' '{"t":"2026-10-16T02:55:20+0200","lvl":"warn","msg":"failed to check for update","obj":"updater","err":"Post \"https://update.ngrok-agent.com/check\": context canceled"}'
echo 'ERROR:  ERR_NGROK_4018' >&2
exit 1
"#;

    /// The records of a real `ngrok` 3.39.11 that finds its fixed address already online in another program `ngrok`.
    pub const ADDRESS_IN_USE: &str = r#"
printf '%s\n' '{"t":"2026-10-16T02:55:21+0200","lvl":"eror","msg":"session closing","obj":"tunnels.session","err":"failed to start tunnel: The endpoint '"'"'https://properly-pouring-thaw.ngrok-free.dev'"'"' is already online. Either\n1. stop your existing endpoint first, or\n2. start both endpoints with `--pooling-enabled` to load balance between them.\r\n\r\nERR_NGROK_334\r\n"}'
exit 1
"#;

    /// Writes a fake `ngrok` in its own folder, and returns its path. Before the `body`, the program writes its process
    /// number in the file `pid`, and its arguments in the file `args`, both next to the program.
    pub fn write(name: &str, body: &str) -> PathBuf {
        let folder = std::env::temp_dir().join(format!("mobile_server_fake_ngrok_{}_{name}", std::process::id()));
        let _ = std::fs::remove_dir_all(&folder);
        std::fs::create_dir_all(&folder).unwrap();
        let path = folder.join("ngrok");
        let script = format!("#!/bin/sh\nfolder=\"$(dirname \"$0\")\"\necho \"$$\" > \"$folder/pid\"\necho \"$@\" > \"$folder/args\"\n{body}\n");
        std::fs::write(&path, script).unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755)).unwrap();
        }
        path
    }

    /// The process number that the fake program wrote, or None while the file is not there yet.
    pub fn pid_of(program: &Path) -> Option<u32> {
        std::fs::read_to_string(program.with_file_name("pid")).ok()?.trim().parse().ok()
    }

    /// The loopback port that the fake program received in its arguments (the word `127.0.0.1:<port>`), or None while the
    /// file is not there yet.
    pub fn port_of(program: &Path) -> Option<u16> {
        let arguments = std::fs::read_to_string(program.with_file_name("args")).ok()?;
        let address = arguments.split_whitespace().find(|word| word.starts_with("127.0.0.1:"))?;
        address.rsplit(':').next()?.parse().ok()
    }

    /// True while the process exists and has not ended (a process that ended and waits for its parent does not count).
    pub fn is_alive(pid: u32) -> bool {
        let output = std::process::Command::new("ps").args(["-p", &pid.to_string(), "-o", "stat="]).output().unwrap();
        let state = String::from_utf8_lossy(&output.stdout).trim().to_string();
        !state.is_empty() && !state.starts_with('Z')
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The record "started tunnel", as `ngrok` 3.39.11 writes it.
    const STARTED_TUNNEL: &str = r#"{"t":"2026-10-16T02:49:54+0200","lvl":"info","msg":"started tunnel","obj":"tunnels","name":"command_line","addr":{"Scheme":"http","Opaque":"","User":null,"Host":"127.0.0.1:47990","Path":"","Fragment":"","RawQuery":"","RawPath":"","RawFragment":"","ForceQuery":false,"OmitHost":false},"url":"https://properly-pouring-thaw.ngrok-free.dev"}"#;

    fn temporary_folder(name: &str) -> PathBuf {
        let folder = std::env::temp_dir().join(format!("mobile_server_tunnel_{}_{name}", std::process::id()));
        let _ = std::fs::remove_dir_all(&folder);
        std::fs::create_dir_all(&folder).unwrap();
        folder
    }

    fn started_tunnel_with(url: &str) -> String {
        format!(r#"{{"lvl":"info","msg":"started tunnel","obj":"tunnels","name":"command_line","url":"{url}"}}"#)
    }

    #[test]
    fn reads_the_host_name_from_the_record_started_tunnel() {
        assert_eq!(read_message(STARTED_TUNNEL), Message::Announced("properly-pouring-thaw.ngrok-free.dev".to_string()));
    }

    #[test]
    fn gives_the_host_name_in_lower_case_and_accepts_a_slash_at_its_end() {
        assert_eq!(read_message(&started_tunnel_with("https://Properly-Pouring.NGROK-free.dev/")), Message::Announced("properly-pouring.ngrok-free.dev".to_string()));
    }

    #[test]
    fn the_other_records_of_a_real_start_give_no_host_name() {
        let lines = [
            r#"{"t":"2026-10-16T02:49:54+0200","lvl":"info","msg":"no configuration paths supplied"}"#,
            r#"{"t":"2026-10-16T02:49:54+0200","lvl":"info","msg":"using configuration at default config path","path":"/Users/someone/Library/Application Support/ngrok/ngrok.yml"}"#,
            r#"{"t":"2026-10-16T02:49:54+0200","lvl":"info","msg":"starting web service","obj":"web","addr":"127.0.0.1:4040","allow_hosts":null}"#,
            r#"{"t":"2026-10-16T02:49:54+0200","lvl":"info","msg":"client session established","obj":"tunnels.session"}"#,
            r#"{"t":"2026-10-16T02:49:54+0200","lvl":"info","msg":"tunnel session started","obj":"tunnels.session"}"#,
            r#"{"t":"2026-10-16T02:49:54+0200","lvl":"warn","msg":"failed to check for update","obj":"updater","err":"Post \"https://update.ngrok-agent.com/check\": context canceled"}"#,
            "",
            "   ",
        ];
        for line in lines {
            assert_eq!(read_message(line), Message::Other, "line {line:?}");
        }
    }

    #[test]
    fn an_address_in_any_other_record_or_line_gives_no_host_name() {
        let lines = [
            r#"{"lvl":"info","msg":"something else","obj":"tunnels","url":"https://words.ngrok-free.dev"}"#,
            r#"{"lvl":"info","msg":"started tunnel","obj":"other","url":"https://words.ngrok-free.dev"}"#,
            r#"{"lvl":"info","msg":"started tunnel","obj":"tunnels","addr":"https://words.ngrok-free.dev"}"#,
            r#"{"lvl":"info","msg":"started tunnel","obj":"tunnels"}"#,
            r#"{"lvl":"info","msg":"started tunnel","obj":"tunnels","url":42}"#,
        ];
        for line in lines {
            assert_eq!(read_message(line), Message::Other, "line {line:?}");
        }
        assert_eq!(read_message("started tunnel https://words.ngrok-free.dev"), Message::Plain("started tunnel https://words.ngrok-free.dev".to_string()));
    }

    #[test]
    fn an_address_that_is_not_a_host_name_of_https_gives_no_host_name() {
        let urls = [
            "http://words.ngrok-free.dev",
            "https://",
            "https://.ngrok-free.dev",
            "https://words",
            "https://words.ngrok-free.dev/path",
            "https://words.ngrok-free.dev:443",
            "https://words_and_more.ngrok-free.dev",
            "https://user@words.ngrok-free.dev",
            "https://words..ngrok-free.dev",
            "tcp://0.tcp.ngrok.io:12345",
            "",
        ];
        for url in urls {
            assert_eq!(read_message(&started_tunnel_with(url)), Message::Other, "url {url:?}");
        }
    }

    #[test]
    fn a_record_at_the_level_error_or_critical_gives_its_text_on_one_line() {
        let line = r#"{"lvl":"crit","msg":"command failed","err":"authentication failed: This ngrok session is not authenticated.\n\nSign up for an account: https://dashboard.ngrok.com/signup\r\n\r\nERR_NGROK_4018\r\n"}"#;
        assert_eq!(
            read_message(line),
            Message::Problem("authentication failed: This ngrok session is not authenticated. Sign up for an account: https://dashboard.ngrok.com/signup ERR_NGROK_4018".to_string())
        );
        let error = r#"{"lvl":"eror","msg":"session closing","err":"connection reset by peer"}"#;
        assert_eq!(read_message(error), Message::Problem("connection reset by peer".to_string()));
    }

    #[test]
    fn a_record_with_no_error_or_at_a_lower_level_is_not_a_problem() {
        assert_eq!(read_message(r#"{"lvl":"eror","msg":"something","err":null}"#), Message::Other);
        assert_eq!(read_message(r#"{"lvl":"eror","msg":"something","err":"  "}"#), Message::Other);
        assert_eq!(read_message(r#"{"lvl":"info","msg":"open config file","err":"a text"}"#), Message::Other);
        assert_eq!(read_message(r#"{"lvl":"warn","msg":"failed to check for update","err":"a text"}"#), Message::Other);
    }

    #[test]
    fn a_text_that_is_not_a_record_comes_on_one_line() {
        assert_eq!(read_message("ERROR:  authentication failed: not signed in  "), Message::Plain("ERROR: authentication failed: not signed in".to_string()));
    }

    #[test]
    fn a_very_long_problem_is_cut() {
        let line = format!(r#"{{"lvl":"eror","msg":"x","err":"{}"}}"#, "word ".repeat(500));
        let Message::Problem(text) = read_message(&line) else {
            panic!("not a problem");
        };
        assert_eq!(text.chars().count(), LONGEST_PROBLEM);
    }

    #[test]
    fn the_folders_give_the_first_program_that_exists() {
        let first = temporary_folder("first");
        let second = temporary_folder("second");
        std::fs::copy(fake::write("search_second", ""), second.join("ngrok")).unwrap();
        assert_eq!(find_with(None, &[first, second.clone()]), Some(second.join("ngrok")));
    }

    #[test]
    fn a_folder_without_the_program_gives_nothing() {
        let folder = temporary_folder("no_program");
        assert_eq!(find_with(None, &[folder]), None);
    }

    #[test]
    fn a_file_that_is_not_executable_is_not_a_program() {
        let folder = temporary_folder("not_executable");
        std::fs::write(folder.join("ngrok"), "#!/bin/sh\n").unwrap();
        assert_eq!(find_with(None, &[folder]), None);
    }

    #[test]
    fn the_variable_of_the_program_wins_over_the_folders() {
        let program = fake::write("override", "");
        let other_folder = temporary_folder("other_folder");
        std::fs::copy(&program, other_folder.join("ngrok")).unwrap();
        assert_eq!(find_with(Some(program.to_string_lossy().into_owned()), &[other_folder]), Some(program));
    }

    #[test]
    fn a_variable_that_points_to_nothing_finds_no_program_even_when_a_folder_has_one() {
        let folder = temporary_folder("folder_has_one");
        std::fs::copy(fake::write("folder_has_one", ""), folder.join("ngrok")).unwrap();
        assert_eq!(find_with(Some("/nowhere/ngrok".to_string()), &[folder]), None);
    }

    #[test]
    fn an_empty_variable_is_the_same_as_no_variable() {
        let folder = temporary_folder("empty_variable");
        std::fs::copy(fake::write("empty_variable", ""), folder.join("ngrok")).unwrap();
        assert_eq!(find_with(Some(String::new()), &[folder.clone()]), Some(folder.join("ngrok")));
    }

    #[tokio::test]
    async fn starts_the_program_for_the_loopback_port_and_gives_its_messages() {
        let program = fake::write("spawn", &format!("{}\nexec sleep 600", fake::ANNOUNCEMENT));
        let (mut child, mut messages) = spawn(&program, 47123).unwrap();
        let mut announced = None;
        while let Some(line) = messages.recv().await {
            if let Message::Announced(host) = read_message(&line) {
                announced = Some(host);
                break;
            }
        }
        assert_eq!(announced.as_deref(), Some(fake::ANNOUNCED_HOST));
        let arguments = std::fs::read_to_string(program.with_file_name("args")).unwrap();
        assert_eq!(arguments.trim(), "http 127.0.0.1:47123 --inspect=false --log=stdout --log-format=json");
        child.kill().await.unwrap();
    }

    #[tokio::test]
    async fn gives_the_lines_of_the_standard_error_too_and_closes_when_the_program_ends() {
        let program = fake::write("both_streams", "echo 'out line'\necho 'error line' >&2\nexit 3");
        let (_child, mut messages) = spawn(&program, 47125).unwrap();
        let mut lines = Vec::new();
        while let Some(line) = messages.recv().await {
            lines.push(line);
        }
        lines.sort();
        assert_eq!(lines, vec!["error line".to_string(), "out line".to_string()]);
    }

    #[tokio::test]
    async fn dropping_the_child_kills_the_program() {
        let program = fake::write("drop", &format!("{}\nexec sleep 600", fake::ANNOUNCEMENT));
        let (child, mut messages) = spawn(&program, 47124).unwrap();
        messages.recv().await.unwrap();
        let pid = fake::pid_of(&program).unwrap();
        assert!(fake::is_alive(pid));
        drop(child);
        for _ in 0..100 {
            if !fake::is_alive(pid) {
                return;
            }
            tokio::time::sleep(std::time::Duration::from_millis(50)).await;
        }
        panic!("the program is still alive after the drop");
    }
}
