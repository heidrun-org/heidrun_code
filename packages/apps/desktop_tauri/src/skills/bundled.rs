//! Installs the command lines and skills that are included with the Heidrun Code application.

use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

use super::agent_folders::SkillLocation;

const COMMANDS: [&str; 2] = ["heidrun_code_ctrl", "heidrun_data"];
const SKILLS: [&str; 2] = ["heidrun-code-ctrl", "heidrun-data"];
/// The command lines of the former names, linked by an older version of Heidrun or of Heidrun Code.
const FORMER_COMMANDS: [&str; 2] = ["heidrun_ctrl", "heidrun_code_data"];
/// The skills of the former names, installed by an older version of Heidrun or of Heidrun Code.
const FORMER_SKILLS: [&str; 4] = ["heidrun_ctrl", "heidrun-ctrl", "heidrun_data", "heidrun-code-data"];
/// The names of the application folders of Heidrun Code, the former name included, that hold the bundled command lines.
const APPLICATION_FOLDERS: [&str; 2] = ["Heidrun Code.app", "Heidrun.app"];
/// The `source` of the origin file of a skill that Heidrun Code installed from its own resources.
const BUNDLED_SOURCE: &str = "heidrun-org/heidrun";

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
    remove_former_links(&bin_folder)?;
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
            if is_bundled_command_link(&target, link) == false {
                return Err(format!("{} already points to another program", link.display()));
            }
            std::fs::remove_file(link).map_err(|error| error.to_string())?;
        } else {
            return Err(format!("{} already exists and is not a Heidrun Code link", link.display()));
        }
    }
    #[cfg(unix)]
    std::os::unix::fs::symlink(source, link).map_err(|error| error.to_string())?;
    #[cfg(not(unix))]
    return Err("symbolic links are not supported on this system".into());
    Ok(())
}

/// Removes the links of the former command lines, only when Heidrun or Heidrun Code made them.
fn remove_former_links(bin_folder: &Path) -> Result<(), String> {
    for command in FORMER_COMMANDS {
        let link = bin_folder.join(command);
        let Ok(target) = std::fs::read_link(&link) else {
            continue;
        };
        if is_bundled_command_link(&target, &link) {
            std::fs::remove_file(&link).map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}

/// True when `target`, the target of `link`, is the bundled command line of the same name in an application folder of
/// Heidrun Code or of Heidrun: `<folder>/Heidrun.app/Contents/Resources/binaries/<name>`. The target may not exist.
fn is_bundled_command_link(target: &Path, link: &Path) -> bool {
    let names: Vec<_> = target.components().rev().take(5).map(|component| component.as_os_str().to_os_string()).collect();
    let [name, binaries, resources, contents, application] = names.as_slice() else {
        return false;
    };
    Some(name.as_os_str()) == link.file_name()
        && binaries == "binaries"
        && resources == "Resources"
        && contents == "Contents"
        && APPLICATION_FOLDERS.iter().any(|folder| application == folder)
}

/// Removes the skills of the former names from the folders of all the agents, only when Heidrun Code installed them from
/// its own resources: the links are removed, the real folder goes to the Trash.
fn remove_former_skills() -> Result<(), String> {
    for skill in FORMER_SKILLS {
        let locations = super::agent_folders::skill_locations("user", None, skill)?;
        remove_bundled_skill(&locations, skill, &super::installed::move_to_trash)?;
    }
    Ok(())
}

/// Deletes the places of the skill `skill` with `remove_real` for the real folders, only when every real folder has
/// the origin of a skill bundled with Heidrun Code. Gives true when the skill was deleted.
fn remove_bundled_skill(locations: &[SkillLocation], skill: &str, remove_real: &dyn Fn(&Path) -> Result<(), String>) -> Result<bool, String> {
    let real_folders: Vec<_> = locations.iter().filter(|location| location.is_link == false).collect();
    if real_folders.is_empty() {
        return Ok(false);
    }
    let is_bundled = real_folders.iter().all(|location| {
        super::installed::read_origin(&location.path)
            .is_some_and(|origin| origin.source == BUNDLED_SOURCE && origin.skill_id == skill)
    });
    if is_bundled == false {
        return Ok(false);
    }
    super::installed::delete_locations(locations, remove_real)?;
    Ok(true)
}

fn install_skills(resource_folder: &Path) -> Result<(), String> {
    let state_folder = crate::app_data::data_dir();
    let state_file = state_folder.join("bundled-skills-version");
    let version = env!("CARGO_PKG_VERSION");
    if std::fs::read_to_string(&state_file).is_ok_and(|installed| installed.trim() == version) {
        return Ok(());
    }
    if let Err(error) = remove_former_skills() {
        eprintln!("Heidrun Code: cannot remove the skills of the former names: {error}");
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
    use crate::skills::test_support::*;
    use crate::skills::types::ORIGIN_FILE;
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

    fn link(bin_folder: &Path, name: &str, target: &str) -> PathBuf {
        let link = bin_folder.join(name);
        std::os::unix::fs::symlink(target, &link).unwrap();
        link
    }

    fn exists(path: &Path) -> bool {
        std::fs::symlink_metadata(path).is_ok()
    }

    #[test]
    fn removes_the_former_links_that_point_into_an_application_folder_of_heidrun() {
        let bin_folder = temp_folder("former-links");
        let heidrun_ctrl = link(&bin_folder, "heidrun_ctrl", "/Applications/Heidrun.app/Contents/Resources/binaries/heidrun_ctrl");
        let heidrun_code_data = link(
            &bin_folder,
            "heidrun_code_data",
            "/Applications/Heidrun Code.app/Contents/Resources/binaries/heidrun_code_data",
        );
        remove_former_links(&bin_folder).unwrap();
        assert!(exists(&heidrun_ctrl) == false);
        assert!(exists(&heidrun_code_data) == false);
    }

    #[test]
    fn keeps_a_former_link_or_a_file_that_heidrun_did_not_make() {
        let bin_folder = temp_folder("former-links-kept");
        let other_link = link(&bin_folder, "heidrun_ctrl", "/usr/local/bin/heidrun_ctrl");
        let other_name = link(&bin_folder, "heidrun_code_data", "/Applications/Heidrun.app/Contents/Resources/binaries/other");
        let file = bin_folder.join("heidrun_data");
        std::fs::write(&file, "#!/bin/sh").unwrap();
        remove_former_links(&bin_folder).unwrap();
        assert!(exists(&other_link));
        assert!(exists(&other_name));
        assert!(exists(&file));
    }

    #[test]
    fn replaces_a_link_to_the_former_application_with_a_link_to_this_application() {
        let folder = temp_folder("replace-link");
        let source = folder.join("Heidrun Code.app/Contents/Resources/binaries/heidrun_data");
        std::fs::create_dir_all(source.parent().unwrap()).unwrap();
        std::fs::write(&source, "").unwrap();
        let link = link(&folder, "heidrun_data", "/Applications/Heidrun.app/Contents/Resources/binaries/heidrun_data");
        install_link(&source, &link).unwrap();
        assert_eq!(std::fs::read_link(&link).unwrap(), source);
    }

    #[test]
    fn keeps_a_link_to_another_program_and_reports_it() {
        let folder = temp_folder("keep-link");
        let source = folder.join("Heidrun Code.app/Contents/Resources/binaries/heidrun_data");
        let link = link(&folder, "heidrun_data", "/usr/local/bin/heidrun_data");
        assert!(install_link(&source, &link).unwrap_err().contains("another program"));
        assert_eq!(std::fs::read_link(&link).unwrap(), Path::new("/usr/local/bin/heidrun_data"));
    }

    fn skill_with_origin(folder: &Path, name: &str, origin: &str) -> Vec<SkillLocation> {
        let real = write_skill_folder(folder, name, "---\nname: x\n---\n");
        std::fs::write(real.join(ORIGIN_FILE), origin).unwrap();
        let claude_folder = folder.join("claude");
        std::fs::create_dir_all(&claude_folder).unwrap();
        let link = claude_folder.join(name);
        std::os::unix::fs::symlink(&real, &link).unwrap();
        vec![
            SkillLocation { agent: "codex", path: real, is_link: false },
            SkillLocation { agent: "claude", path: link, is_link: true },
        ]
    }

    fn remove_folder(path: &Path) -> Result<(), String> {
        std::fs::remove_dir_all(path).map_err(|error| error.to_string())
    }

    #[test]
    fn removes_a_former_skill_that_heidrun_installed() {
        let folder = temp_folder("former-skill");
        let locations = skill_with_origin(&folder, "heidrun_ctrl", r#"{"source":"heidrun-org/heidrun","skill_id":"heidrun_ctrl"}"#);
        assert!(remove_bundled_skill(&locations, "heidrun_ctrl", &remove_folder).unwrap());
        assert!(locations.iter().all(|location| exists(&location.path) == false));
    }

    #[test]
    fn keeps_a_former_skill_from_another_source() {
        let folder = temp_folder("former-skill-kept");
        let locations = skill_with_origin(&folder, "heidrun_ctrl", r#"{"source":"someone/skills","skill_id":"heidrun_ctrl"}"#);
        assert!(remove_bundled_skill(&locations, "heidrun_ctrl", &remove_folder).unwrap() == false);
        assert!(locations.iter().all(|location| exists(&location.path)));
    }

    #[test]
    fn keeps_a_former_skill_with_no_origin_file() {
        let folder = temp_folder("former-skill-no-origin");
        let real = write_skill_folder(&folder, "heidrun-ctrl", "---\nname: x\n---\n");
        let locations = vec![SkillLocation { agent: "codex", path: real.clone(), is_link: false }];
        assert!(remove_bundled_skill(&locations, "heidrun-ctrl", &remove_folder).unwrap() == false);
        assert!(exists(&real));
    }
}
