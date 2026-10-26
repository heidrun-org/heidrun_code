//! Plays one of the 14 system sounds of macOS, for the sound of a notification (issue 857).
//!
//! The sound is played by the program `afplay` of macOS, not by the system notification, so the sound does not depend on
//! the way that macOS shows the banner (in development, macOS shows the banner as a banner of Terminal).

use std::process::{Child, Command, Stdio};

/// The folder of the system sounds of macOS.
const SYSTEM_SOUND_FOLDER: &str = "/System/Library/Sounds";

/// The program of macOS that plays a sound file.
const SOUND_PLAYER: &str = "/usr/bin/afplay";

/// The names of the 14 system sounds of macOS. The web page offers the same names.
const SYSTEM_SOUND_NAMES: [&str; 14] = [
    "Basso",
    "Blow",
    "Bottle",
    "Frog",
    "Funk",
    "Glass",
    "Hero",
    "Morse",
    "Ping",
    "Pop",
    "Purr",
    "Sosumi",
    "Submarine",
    "Tink",
];

/// Gives the path of the file of a system sound, or an error when the name is not one of the 14 names.
fn sound_path(name: &str) -> Result<String, String> {
    if SYSTEM_SOUND_NAMES.contains(&name) == false {
        return Err(format!("unknown_system_sound: {name}"));
    }
    Ok(format!("{SYSTEM_SOUND_FOLDER}/{name}.aiff"))
}

/// Starts `afplay` for a system sound at a volume from 0 (silent) to 1 (full), and gives the process back.
fn start_player(name: &str, volume: f32) -> Result<Child, String> {
    let path = sound_path(name)?;
    Command::new(SOUND_PLAYER)
        .args(["-v", &volume.to_string(), &path])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| format!("sound_player_failed: {error}"))
}

/// Plays a system sound of macOS without waiting for its end. A thread waits for the process, so it leaves no zombie.
#[tauri::command]
pub fn play_system_sound(name: String) -> Result<(), String> {
    let mut child = start_player(&name, 1.0)?;
    std::thread::spawn(move || {
        let _ = child.wait();
    });
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn gives_the_path_of_each_of_the_14_system_sounds() {
        assert_eq!(SYSTEM_SOUND_NAMES.len(), 14);
        for name in SYSTEM_SOUND_NAMES {
            assert_eq!(sound_path(name).unwrap(), format!("/System/Library/Sounds/{name}.aiff"));
        }
    }

    #[test]
    fn refuses_a_name_that_is_not_a_system_sound() {
        for name in ["", "ping", "Airhorn", "../../etc/passwd", "Ping.aiff", "Ping "] {
            assert!(sound_path(name).is_err(), "{name:?} must be refused");
        }
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn every_system_sound_has_a_file_on_macos() {
        for name in SYSTEM_SOUND_NAMES {
            let path = sound_path(name).unwrap();
            assert!(std::path::Path::new(&path).exists(), "{path} is missing");
        }
    }

    /// The volume is 0, so this test plays no audible sound.
    #[cfg(target_os = "macos")]
    #[test]
    fn plays_each_system_sound_at_volume_zero_and_the_player_ends_well() {
        for name in SYSTEM_SOUND_NAMES {
            let mut child = start_player(name, 0.0).unwrap();
            assert!(child.wait().unwrap().success(), "{name} did not play");
        }
    }

    #[test]
    fn refuses_to_play_an_unknown_sound() {
        assert!(play_system_sound("Airhorn".to_string()).is_err());
    }
}
