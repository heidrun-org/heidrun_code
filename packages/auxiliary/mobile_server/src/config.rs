//! The file `mobile.json`: whether the mobile access is on, the pairing key, and the port.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

const DEFAULT_PORT: u16 = 47823;

/// The content of the file `mobile.json`.
#[derive(Serialize, Deserialize, Clone, Default)]
pub struct MobileConfig {
    /// True when the developer turned the mobile access on.
    pub enabled: bool,
    /// The pairing key: 32 random bytes as hexadecimal text. Empty until the first time that the access is turned on.
    pub token: String,
    /// The port of the server on the loopback address. The tunnel forwards to this port.
    pub port: u16,
}

/// The folder of the configuration of Heidrun Code: the variable `HEIDRUN_CODE_DIR`, or `~/.config/heidrun_code`.
pub(crate) fn config_folder() -> PathBuf {
    std::env::var("HEIDRUN_CODE_DIR")
        .ok().filter(|value| value.is_empty() == false)
        .or_else(|| std::env::var("HEIDRUN_DIR").ok().filter(|value| value.is_empty() == false))
        .map(PathBuf::from)
        .unwrap_or_else(|| default_data_folder(&dirs::home_dir().unwrap_or_default()))
}

fn config_path() -> PathBuf {
    config_folder().join("mobile.json")
}

/// Reads the file `mobile.json`. A missing or a wrong file gives the default values.
pub fn load_config() -> MobileConfig {
    load_from(&config_path())
}

/// Writes the file `mobile.json`, readable by this user only.
pub fn save_config(config: &MobileConfig) -> Result<(), String> {
    save_to(&config_path(), config)
}

fn load_from(path: &Path) -> MobileConfig {
    let mut config: MobileConfig = std::fs::read_to_string(path).ok().and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default();
    config.port = selected_port(config.port, std::env::var("HEIDRUN_CODE_MOBILE_PORT").ok().as_deref());
    config
}

fn selected_port(saved: u16, custom: Option<&str>) -> u16 {
    if saved != 0 {
        return saved;
    }
    custom.and_then(|value| value.parse::<u16>().ok()).filter(|port| *port != 0).unwrap_or(DEFAULT_PORT)
}

fn save_to(path: &Path, config: &MobileConfig) -> Result<(), String> {
    let body = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    write_private(path, &body)
}

/// Writes a file that this user alone can read, from the first byte.
pub(crate) fn write_private(path: &Path, body: &str) -> Result<(), String> {
    if let Some(d) = path.parent() {
        std::fs::create_dir_all(d).map_err(|e| e.to_string())?;
    }
    // The token gives access to the agents: readable by this user only, from the start.
    let mut opts = std::fs::OpenOptions::new();
    opts.write(true).create(true).truncate(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        opts.mode(0o600);
    }
    use std::io::Write;
    opts.open(path).and_then(|mut f| f.write_all(body.as_bytes())).map_err(|e| e.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600));
    }
    Ok(())
}

/// 32 random bytes from the system.
pub(crate) fn random_bytes() -> Result<[u8; 32], String> {
    use std::io::Read;
    let mut buf = [0u8; 32];
    std::fs::File::open("/dev/urandom").and_then(|mut f| f.read_exact(&mut buf)).map_err(|e| format!("aléa indisponible : {e}"))?;
    Ok(buf)
}

/// A new pairing key: 32 random bytes as hex.
pub fn new_token() -> Result<String, String> {
    Ok(random_bytes()?.iter().map(|b| format!("{b:02x}")).collect())
}

/// `~/.config/heidrun_code`, or the former folder `~/.config/heidrun` when it exists and the new folder does not.
fn default_data_folder(home: &std::path::Path) -> PathBuf {
    let current = home.join(".config").join("heidrun_code");
    let former = home.join(".config").join("heidrun");
    if current.is_dir() == false && former.is_dir() {
        return former;
    }
    current
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temporary_path(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("mobile_server_config_{}_{name}", std::process::id())).join("mobile.json")
    }

    #[test]
    fn a_saved_mobile_port_wins_over_the_development_default() {
        assert_eq!(selected_port(5000, Some("47824")), 5000);
        assert_eq!(selected_port(0, Some("47824")), 47824);
        for invalid in [None, Some(""), Some("0"), Some("65536"), Some("wrong")] {
            assert_eq!(selected_port(0, invalid), DEFAULT_PORT);
        }
    }

    #[test]
    fn generates_a_long_random_hexadecimal_token() {
        let a = new_token().unwrap();
        let b = new_token().unwrap();
        assert_eq!(a.len(), 64);
        assert!(a.chars().all(|c| c.is_ascii_hexdigit()));
        assert_ne!(a, b);
    }

    #[test]
    fn a_missing_file_gives_the_default_port_and_the_access_off() {
        let config = load_from(&temporary_path("missing"));
        assert!(!config.enabled);
        assert!(config.token.is_empty());
        assert_eq!(config.port, DEFAULT_PORT);
    }

    #[test]
    fn a_wrong_file_gives_the_default_values() {
        let path = temporary_path("wrong");
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, "not json").unwrap();
        let config = load_from(&path);
        assert!(!config.enabled);
        assert_eq!(config.port, DEFAULT_PORT);
    }

    #[test]
    fn saves_and_loads_the_values_of_the_file() {
        let path = temporary_path("round_trip");
        save_to(&path, &MobileConfig { enabled: true, token: "abc".into(), port: 5000 }).unwrap();
        let config = load_from(&path);
        assert!(config.enabled);
        assert_eq!(config.token, "abc");
        assert_eq!(config.port, 5000);
    }

    #[cfg(unix)]
    #[test]
    fn the_file_is_readable_by_this_user_only() {
        use std::os::unix::fs::PermissionsExt;
        let path = temporary_path("permissions");
        save_to(&path, &MobileConfig::default()).unwrap();
        assert_eq!(std::fs::metadata(&path).unwrap().permissions().mode() & 0o777, 0o600);
        // A second save keeps the permission of the file.
        save_to(&path, &MobileConfig::default()).unwrap();
        assert_eq!(std::fs::metadata(&path).unwrap().permissions().mode() & 0o777, 0o600);
    }
}
