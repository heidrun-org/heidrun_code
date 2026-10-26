//! Moves the data written under a former name, "Herdr Desk" or "Heidrun", to the folders named "Heidrun Code".

use std::path::Path;

/// Moves the former data folder of the application to its folder named "Heidrun Code", once ([issue
/// 881](https://github.com/heidrun-org/heidrun_code/issues/881)). Heidrun Code moves `~/.config/heidrun` (the versions
/// 0.3.0 and older) or `~/.config/herdr-desk` to `~/.config/heidrun_code`. Heidrun Code Development moves
/// `~/.config/heidrun-development` to `~/.config/heidrun_code_development`.
pub fn migrate_config_dir(is_development: bool) {
    let config = dirs::home_dir().unwrap_or_default().join(".config");
    if is_development {
        move_former_folder(&config, &["heidrun-development"], "heidrun_code_development");
    } else {
        move_former_folder(&config, &["heidrun", "herdr-desk"], "heidrun_code");
    }
}

/// Renames the first folder of `former_names` that exists in `config` to `current_name`. Does nothing when the folder
/// `current_name` exists already, so a second start moves nothing.
fn move_former_folder(config: &Path, former_names: &[&str], current_name: &str) {
    let current = config.join(current_name);
    if current.exists() {
        return;
    }
    let Some(former) = former_names.iter().map(|name| config.join(name)).find(|folder| folder.is_dir()) else {
        return;
    };
    match std::fs::rename(&former, &current) {
        Ok(()) => eprintln!("Heidrun Code: moved {} to {}", former.display(), current.display()),
        Err(error) => eprintln!("Heidrun Code: cannot move {} to {}: {error}", former.display(), current.display()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temporary_config(name: &str) -> std::path::PathBuf {
        let config = std::env::temp_dir().join(format!("hd-legacy-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&config);
        std::fs::create_dir_all(&config).unwrap();
        config
    }

    #[test]
    fn the_former_folder_moves_to_the_new_folder_with_its_files() {
        let config = temporary_config("move");
        std::fs::create_dir_all(config.join("heidrun")).unwrap();
        std::fs::write(config.join("heidrun/history.jsonl"), "line\n").unwrap();
        move_former_folder(&config, &["heidrun", "herdr-desk"], "heidrun_code");
        assert!(config.join("heidrun").exists() == false);
        assert_eq!(std::fs::read_to_string(config.join("heidrun_code/history.jsonl")).unwrap(), "line\n");
        std::fs::remove_dir_all(config).unwrap();
    }

    #[test]
    fn the_folder_heidrun_wins_over_the_folder_herdr_desk() {
        let config = temporary_config("order");
        std::fs::create_dir_all(config.join("heidrun")).unwrap();
        std::fs::create_dir_all(config.join("herdr-desk")).unwrap();
        move_former_folder(&config, &["heidrun", "herdr-desk"], "heidrun_code");
        assert!(config.join("heidrun").exists() == false);
        assert!(config.join("herdr-desk").is_dir());
        std::fs::remove_dir_all(config).unwrap();
    }

    #[test]
    fn an_existing_new_folder_is_never_replaced() {
        let config = temporary_config("existing");
        std::fs::create_dir_all(config.join("heidrun-development")).unwrap();
        std::fs::create_dir_all(config.join("heidrun_code_development")).unwrap();
        std::fs::write(config.join("heidrun_code_development/macros.json"), "[]").unwrap();
        move_former_folder(&config, &["heidrun-development"], "heidrun_code_development");
        assert!(config.join("heidrun-development").is_dir());
        assert_eq!(std::fs::read_to_string(config.join("heidrun_code_development/macros.json")).unwrap(), "[]");
        std::fs::remove_dir_all(config).unwrap();
    }

    #[test]
    fn nothing_happens_without_a_former_folder() {
        let config = temporary_config("nothing");
        move_former_folder(&config, &["heidrun-development"], "heidrun_code_development");
        assert!(config.join("heidrun_code_development").exists() == false);
        std::fs::remove_dir_all(config).unwrap();
    }
}
