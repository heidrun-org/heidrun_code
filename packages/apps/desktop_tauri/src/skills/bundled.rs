//! Installs the command lines and skills that are included with the Heidrun Code application.

use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

const COMMANDS: [&str; 2] = ["heidrun_code_ctrl", "heidrun_data"];
const SKILLS: [&str; 2] = ["heidrun-code-ctrl", "heidrun-data"];

/// Makes the included command lines available to the coding agents and installs the included skills once per version.
pub(crate) fn install(app: &AppHandle) {
    let Ok(resource_folder) = app.path().resource_dir() else {
        eprintln!("Heidrun Code: cannot find the application resource folder.");
        return;
    };
    if let Err(error) = install_commands(&resource_folder) {
        eprintln!("Heidrun Code: cannot install the command lines: {error}");
    }
    if let Err(error) = install_skills(&resource_folder) {
        eprintln!("Heidrun Code: cannot install the included skills: {error}");
    }
}

fn install_commands(resource_folder: &Path) -> Result<(), String> {
    let Some(home_folder) = dirs::home_dir() else {
        return Err("the home folder is not available".into());
    };
    let bin_folder = home_folder.join(".local/bin");
    std::fs::create_dir_all(&bin_folder).map_err(|error| error.to_string())?;
    for command in COMMANDS {
        let source = resource_folder.join("binaries").join(command);
        if source.is_file() == false {
            return Err(format!("the bundled command line {command} is missing"));
        }
        install_link(&source, &bin_folder.join(command))?;
    }
    Ok(())
}

fn install_link(source: &Path, link: &Path) -> Result<(), String> {
    if let Ok(metadata) = std::fs::symlink_metadata(link) {
        if metadata.file_type().is_symlink() {
            let target = std::fs::read_link(link).map_err(|error| error.to_string())?;
            if target == source {
                return Ok(());
            }
            return Err(format!("{} already points to another program", link.display()));
        }
        return Err(format!("{} already exists and is not a Heidrun Code link", link.display()));
    }
    #[cfg(unix)]
    std::os::unix::fs::symlink(source, link).map_err(|error| error.to_string())?;
    #[cfg(not(unix))]
    return Err("symbolic links are not supported on this system".into());
    Ok(())
}

fn install_skills(resource_folder: &Path) -> Result<(), String> {
    let state_folder = crate::app_data::data_dir();
    let state_file = state_folder.join("bundled-skills-version");
    let version = env!("CARGO_PKG_VERSION");
    if std::fs::read_to_string(&state_file).is_ok_and(|installed| installed.trim() == version) {
        return Ok(());
    }
    for skill in SKILLS {
        let source = resource_folder.join("bundled_skills").join(skill);
        if source.join("SKILL.md").is_file() == false {
            return Err(format!("the bundled skill {skill} is missing"));
        }
        if let Err(error) = super::install::install_bundled_skill(&source, skill) {
            if error.starts_with("skills_already_installed:") == false {
                return Err(error);
            }
        }
    }
    std::fs::create_dir_all(&state_folder).map_err(|error| error.to_string())?;
    std::fs::write(state_file, version).map_err(|error| error.to_string())
}

/// Returns the user bin folder for adding it to the path of programs started by Heidrun Code.
pub(crate) fn user_bin_folder() -> Option<PathBuf> {
    dirs::home_dir().map(|home_folder| home_folder.join(".local/bin"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    const DESTINATION_PREFIX: &str = "bundled_skills/";

    /// The resource list of `tauri.conf.json`, kept only for the skills: the source folder and the destination name.
    fn skill_resources() -> Vec<(String, String)> {
        let config: Value = serde_json::from_str(include_str!("../../tauri.conf.json")).unwrap();
        let resources = config["bundle"]["resources"].as_object().unwrap();
        resources
            .iter()
            .filter_map(|(source, destination)| {
                let destination = destination.as_str().unwrap();
                let name = destination.strip_prefix(DESTINATION_PREFIX)?;
                Some((source.clone(), name.trim_end_matches('/').to_string()))
            })
            .collect()
    }

    #[test]
    fn every_skill_folder_of_the_resource_list_exists_and_has_a_skill_file() {
        let resources = skill_resources();
        assert_eq!(resources.len(), SKILLS.len());
        for (source, _) in resources {
            let skill_file = Path::new(env!("CARGO_MANIFEST_DIR")).join(&source).join("SKILL.md");
            assert!(skill_file.is_file(), "the resource {source} has no SKILL.md: {}", skill_file.display());
        }
    }

    #[test]
    fn the_destination_names_of_the_resource_list_are_the_names_of_the_skills_that_are_installed() {
        let mut destinations: Vec<String> = skill_resources().into_iter().map(|(_, name)| name).collect();
        destinations.sort();
        let mut names: Vec<String> = SKILLS.iter().map(|name| name.to_string()).collect();
        names.sort();
        assert_eq!(destinations, names);
    }
}
