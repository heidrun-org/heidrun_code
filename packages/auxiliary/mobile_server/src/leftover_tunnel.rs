//! The program `ngrok` that an earlier Heidrun Code left running. A hard stop of Heidrun Code (Ctrl+C on `pnpm dev`, a restart of
//! `tauri dev`, a crash) does not kill `ngrok`, and the leftover program keeps the fixed address of the account, so the
//! next tunnel fails with `ERR_NGROK_334` (issue 583). Heidrun Code records the process id of each `ngrok` that it starts in a
//! file of its own, and kills only a recorded process that is still an `ngrok`.

use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

/// The process id of the first process of the system. A process whose parent ended gets this parent.
const ORPHAN_PARENT: u32 = 1;

/// How long a killed `ngrok` may take to end.
const END_WAIT: Duration = Duration::from_secs(3);

/// The records of the `ngrok` of each Heidrun Code: one file per Heidrun Code, named after the process id of that Heidrun Code, that holds
/// the process id of its `ngrok`. With one file for all, a second Heidrun Code wrote over the record of the first (issue 585).
pub struct TunnelRecord {
    /// The folder of the files.
    folder: PathBuf,
    /// The process id of this Heidrun Code: the name of its own file.
    owner_id: u32,
}

impl TunnelRecord {
    /// The records in the folder `folder`, for the Heidrun Code with the process id `owner_id`.
    pub fn new(folder: PathBuf, owner_id: u32) -> Self {
        Self { folder, owner_id }
    }

    /// Writes the process id of the `ngrok` that this Heidrun Code just started.
    pub fn save(&self, process_id: u32) {
        let _ = std::fs::create_dir_all(&self.folder);
        let _ = std::fs::write(self.path_of(self.owner_id), process_id.to_string());
    }

    /// Removes the file of this Heidrun Code, after it killed its `ngrok`.
    pub fn clear(&self) {
        let _ = std::fs::remove_file(self.path_of(self.owner_id));
    }

    /// At the start of a tunnel: kills each recorded `ngrok` whose Heidrun Code ended, so its parent is now the first process of
    /// the system. An `ngrok` whose Heidrun Code still runs is not killed. True when a program was killed.
    pub fn kill_leftover(&self) -> bool {
        self.kill_each(true, |parent_id| parent_id == ORPHAN_PARENT)
    }

    /// For the button "Stop the old ngrok": kills the recorded `ngrok` of every other Heidrun Code, whatever its parent, but
    /// never the `ngrok` of this Heidrun Code. True when a program was killed. False when the other `ngrok` is not a recorded one.
    pub fn kill_recorded(&self) -> bool {
        self.kill_each(false, |_| true)
    }

    fn path_of(&self, owner_id: u32) -> PathBuf {
        self.folder.join(format!("{owner_id}.pid"))
    }

    /// Each record of the folder: its file and the process id of its `ngrok`. The file of this Heidrun Code is left out when
    /// `is_own_included` is false.
    fn records(&self, is_own_included: bool) -> Vec<(PathBuf, u32)> {
        let Ok(entries) = std::fs::read_dir(&self.folder) else {
            return Vec::new();
        };
        entries
            .filter_map(|entry| entry.ok().map(|entry| entry.path()))
            .filter(|path| path.extension().is_some_and(|extension| extension == "pid"))
            .filter(|path| is_own_included || *path != self.path_of(self.owner_id))
            .filter_map(|path| {
                let process_id = std::fs::read_to_string(&path).ok()?.trim().parse().ok()?;
                Some((path, process_id))
            })
            .collect()
    }

    /// Kills each recorded `ngrok` whose parent `is_parent_accepted` accepts. A record of a process that has ended, or that
    /// is no longer an `ngrok`, is removed, and the process is never killed.
    fn kill_each(&self, is_own_included: bool, is_parent_accepted: impl Fn(u32) -> bool) -> bool {
        let mut is_any_killed = false;
        for (path, process_id) in self.records(is_own_included) {
            let Some((parent_id, command)) = process_info(process_id) else {
                let _ = std::fs::remove_file(&path);
                continue;
            };
            if !is_ngrok(&command) {
                let _ = std::fs::remove_file(&path);
                continue;
            }
            if is_parent_accepted(parent_id) && kill_and_wait(process_id) {
                let _ = std::fs::remove_file(&path);
                is_any_killed = true;
            }
        }
        is_any_killed
    }
}

/// The parent process id and the command of the process `process_id`, or None when no such process runs.
fn process_info(process_id: u32) -> Option<(u32, String)> {
    let output = Command::new("ps")
        .args(["-o", "ppid=,comm=", "-p", &process_id.to_string()])
        .stdin(Stdio::null())
        .stderr(Stdio::null())
        .output()
        .ok()?;
    let text = String::from_utf8_lossy(&output.stdout);
    let line = text.lines().next()?.trim();
    let (parent_id, command) = line.split_once(char::is_whitespace)?;
    Some((parent_id.parse().ok()?, command.trim().to_string()))
}

/// True when the command is the program `ngrok`, with or without its folder.
fn is_ngrok(command: &str) -> bool {
    Path::new(command).file_name().is_some_and(|name| name == "ngrok")
}

/// Asks the process to end, and waits until it has ended. True when it has ended.
fn kill_and_wait(process_id: u32) -> bool {
    let is_sent = Command::new("kill")
        .arg(process_id.to_string())
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .is_ok_and(|status| status.success());
    if !is_sent {
        return false;
    }
    let start = Instant::now();
    while start.elapsed() < END_WAIT {
        if process_info(process_id).is_none() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(50));
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temporary_folder(name: &str) -> PathBuf {
        let folder = std::env::temp_dir().join(format!("heidrun_leftover_tunnel_{}_{name}", std::process::id()));
        let _ = std::fs::remove_dir_all(&folder);
        std::fs::create_dir_all(&folder).unwrap();
        folder
    }

    /// A fake `ngrok`: a symbolic link named `ngrok` to the program `sleep`, so that `ps` shows the command `ngrok`. A copy
    /// of `sleep` does not work: macOS kills a copy of a program of the system.
    fn fake_ngrok(folder: &Path) -> PathBuf {
        let program = folder.join("ngrok");
        std::os::unix::fs::symlink("/bin/sleep", &program).unwrap();
        program
    }

    /// Starts `program` through a shell that ends at once, so the program loses its parent, like the `ngrok` of a Heidrun Code
    /// that was stopped hard. Returns its process id.
    fn start_orphan(program: &Path) -> u32 {
        let output = Command::new("/bin/sh")
            .arg("-c")
            .arg(format!("'{}' 600 >/dev/null 2>&1 & echo $!", program.display()))
            .output()
            .unwrap();
        let process_id = String::from_utf8_lossy(&output.stdout).trim().parse().unwrap();
        let start = Instant::now();
        while start.elapsed() < END_WAIT && process_info(process_id).map(|(parent_id, _)| parent_id) != Some(ORPHAN_PARENT) {
            std::thread::sleep(Duration::from_millis(20));
        }
        process_id
    }

    /// The process id of this Heidrun Code, in the tests.
    const THIS_HEIDRUN: u32 = 111;

    /// The process id of another Heidrun Code, in the tests.
    const OTHER_HEIDRUN: u32 = 222;

    fn records_of(folder: &Path, owner_id: u32) -> TunnelRecord {
        TunnelRecord::new(folder.join("records"), owner_id)
    }

    fn record_file(folder: &Path, owner_id: u32) -> PathBuf {
        folder.join("records").join(format!("{owner_id}.pid"))
    }

    #[test]
    fn a_recorded_ngrok_with_no_parent_is_killed() {
        let folder = temporary_folder("orphan");
        let process_id = start_orphan(&fake_ngrok(&folder));
        records_of(&folder, OTHER_HEIDRUN).save(process_id);
        assert_eq!(records_of(&folder, THIS_HEIDRUN).kill_leftover(), true);
        assert_eq!(process_info(process_id), None);
        assert_eq!(record_file(&folder, OTHER_HEIDRUN).exists(), false);
    }

    #[test]
    fn a_recorded_ngrok_whose_heidrun_still_runs_is_not_killed_at_the_start() {
        let folder = temporary_folder("parent");
        let mut child = Command::new(fake_ngrok(&folder)).arg("600").spawn().unwrap();
        records_of(&folder, OTHER_HEIDRUN).save(child.id());
        assert_eq!(records_of(&folder, THIS_HEIDRUN).kill_leftover(), false);
        assert_eq!(process_info(child.id()).is_some(), true);
        assert_eq!(record_file(&folder, OTHER_HEIDRUN).exists(), true);
        child.kill().unwrap();
        child.wait().unwrap();
    }

    #[test]
    fn a_recorded_process_that_is_not_ngrok_is_never_killed() {
        let folder = temporary_folder("not_ngrok");
        let process_id = start_orphan(Path::new("/bin/sleep"));
        records_of(&folder, OTHER_HEIDRUN).save(process_id);
        assert_eq!(records_of(&folder, THIS_HEIDRUN).kill_recorded(), false);
        assert_eq!(process_info(process_id).is_some(), true);
        assert_eq!(record_file(&folder, OTHER_HEIDRUN).exists(), false);
        kill_and_wait(process_id);
    }

    #[test]
    fn the_start_of_a_second_heidrun_keeps_the_record_of_the_first() {
        let folder = temporary_folder("two_records");
        let program = fake_ngrok(&folder);
        let mut first = Command::new(&program).arg("600").spawn().unwrap();
        let mut second = Command::new(&program).arg("600").spawn().unwrap();
        records_of(&folder, OTHER_HEIDRUN).save(first.id());
        let this_record = records_of(&folder, THIS_HEIDRUN);
        this_record.save(second.id());
        this_record.clear();
        assert_eq!(std::fs::read_to_string(record_file(&folder, OTHER_HEIDRUN)).unwrap(), first.id().to_string());
        for child in [&mut first, &mut second] {
            child.kill().unwrap();
            child.wait().unwrap();
        }
    }

    #[test]
    fn the_button_kills_the_ngrok_of_the_other_heidrun_and_keeps_the_ngrok_of_this_heidrun() {
        let folder = temporary_folder("button");
        let program = fake_ngrok(&folder);
        let other = Command::new(&program).arg("600").spawn().unwrap();
        let other_id = other.id();
        // The parent reaps the ended program, like the other Heidrun Code does.
        let other_parent = std::thread::spawn(move || {
            let mut other = other;
            other.wait()
        });
        let mut own = Command::new(&program).arg("600").spawn().unwrap();
        records_of(&folder, OTHER_HEIDRUN).save(other_id);
        let this_record = records_of(&folder, THIS_HEIDRUN);
        this_record.save(own.id());
        assert_eq!(this_record.kill_recorded(), true);
        other_parent.join().unwrap().unwrap();
        assert_eq!(process_info(own.id()).is_some(), true);
        assert_eq!(record_file(&folder, THIS_HEIDRUN).exists(), true);
        assert_eq!(this_record.kill_recorded(), false);
        own.kill().unwrap();
        own.wait().unwrap();
    }

    #[test]
    fn nothing_is_killed_with_no_record_or_with_an_ended_process() {
        let folder = temporary_folder("empty");
        let record = records_of(&folder, THIS_HEIDRUN);
        assert_eq!(record.kill_leftover(), false);
        assert_eq!(record.kill_recorded(), false);
        let mut child = Command::new("/usr/bin/true").spawn().unwrap();
        child.wait().unwrap();
        records_of(&folder, OTHER_HEIDRUN).save(child.id());
        assert_eq!(record.kill_leftover(), false);
        assert_eq!(record_file(&folder, OTHER_HEIDRUN).exists(), false);
    }

    #[test]
    fn the_command_ngrok_is_known_with_or_without_its_folder() {
        assert_eq!(is_ngrok("/opt/homebrew/bin/ngrok"), true);
        assert_eq!(is_ngrok("ngrok"), true);
        assert_eq!(is_ngrok("/bin/sleep"), false);
        assert_eq!(is_ngrok("/tmp/ngrok_hidden"), false);
    }
}
