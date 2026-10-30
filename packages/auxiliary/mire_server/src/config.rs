//! The file `mire_local_network.json`: whether the Mire is shown on the local network, the pairing key, and the port.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// The content of the file `mire_local_network.json`.
#[derive(Serialize, Deserialize, Clone, Default, Debug, PartialEq)]
pub struct MireServerConfig {
    /// True when the developer turned on "Show the Mire on the local network".
    pub enabled: bool,
    /// The pairing key: 32 random bytes as hexadecimal text. Empty until the first time that the option is turned on.
    pub key: String,
    /// The port of the server on the local network. 0 until the first time that the option is turned on: then the system
    /// gives a free port, and the port is saved, so that the QR code stays valid after a restart.
    pub port: u16,
}

/// The folder of the configuration of Heidrun Code: the variable `HEIDRUN_CODE_DIR`, or `~/.config/heidrun_code`.
fn config_folder() -> PathBuf {
    std::env::var("HEIDRUN_CODE_DIR")
        .ok()
        .filter(|value| value.is_empty() == false)
        .map(PathBuf::from)
        .unwrap_or_else(|| dirs::home_dir().unwrap_or_default().join(".config").join("heidrun_code"))
}

fn config_path() -> PathBuf {
    config_folder().join("mire_local_network.json")
}

/// Reads the file `mire_local_network.json`. A missing or a wrong file gives the default values: off, no key, no port.
pub fn load_config() -> MireServerConfig {
    load_from(&config_path())
}

/// Writes the file `mire_local_network.json`, readable by this user only.
pub fn save_config(config: &MireServerConfig) -> Result<(), String> {
    save_to(&config_path(), config)
}

/// A new pairing key: 32 random bytes of the system as hexadecimal text.
pub fn new_key() -> Result<String, String> {
    use std::io::Read;
    let mut bytes = [0u8; 32];
    std::fs::File::open("/dev/urandom")
        .and_then(|mut file| file.read_exact(&mut bytes))
        .map_err(|error| format!("no random bytes: {error}"))?;
    Ok(bytes.iter().map(|byte| format!("{byte:02x}")).collect())
}

/// A port that is free now on every address of this computer, given by the system.
pub fn free_port() -> Result<u16, String> {
    let listener = std::net::TcpListener::bind((std::net::Ipv4Addr::UNSPECIFIED, 0)).map_err(|error| error.to_string())?;
    listener.local_addr().map(|address| address.port()).map_err(|error| error.to_string())
}

fn load_from(path: &Path) -> MireServerConfig {
    std::fs::read_to_string(path)
        .ok()
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default()
}

fn save_to(path: &Path, config: &MireServerConfig) -> Result<(), String> {
    let body = serde_json::to_string_pretty(config).map_err(|error| error.to_string())?;
    if let Some(folder) = path.parent() {
        std::fs::create_dir_all(folder).map_err(|error| error.to_string())?;
    }
    // The key shows the Mire: readable by this user only, from the first byte.
    let mut options = std::fs::OpenOptions::new();
    options.write(true).create(true).truncate(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    use std::io::Write;
    options
        .open(path)
        .and_then(|mut file| file.write_all(body.as_bytes()))
        .map_err(|error| error.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temporary_folder(name: &str) -> PathBuf {
        let folder = std::env::temp_dir().join(format!("mire_server_config_{name}_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&folder);
        folder
    }

    #[test]
    fn a_missing_or_wrong_file_gives_off_with_no_key_and_no_port() {
        let folder = temporary_folder("missing");
        let path = folder.join("mire_local_network.json");
        assert_eq!(load_from(&path), MireServerConfig::default());
        std::fs::create_dir_all(&folder).unwrap();
        std::fs::write(&path, "not json").unwrap();
        assert_eq!(load_from(&path), MireServerConfig::default());
        let _ = std::fs::remove_dir_all(&folder);
    }

    #[test]
    fn keeps_the_option_the_key_and_the_port_in_a_file_that_only_this_user_reads() {
        let folder = temporary_folder("saved");
        let path = folder.join("mire_local_network.json");
        let config = MireServerConfig { enabled: true, key: "ab".repeat(32), port: 51234 };
        save_to(&path, &config).unwrap();
        assert_eq!(load_from(&path), config);
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(std::fs::metadata(&path).unwrap().permissions().mode() & 0o777, 0o600);
        }
        let _ = std::fs::remove_dir_all(&folder);
    }

    #[test]
    fn a_new_key_is_64_hexadecimal_characters_and_never_the_same() {
        let first = new_key().unwrap();
        let second = new_key().unwrap();
        assert_eq!(first.len(), 64);
        assert!(first.chars().all(|character| character.is_ascii_hexdigit()));
        assert_ne!(first, second);
    }

    #[test]
    fn a_free_port_is_not_zero() {
        assert_ne!(free_port().unwrap(), 0);
    }
}
