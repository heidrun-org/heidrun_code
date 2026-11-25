//! The skills installed on the disk: list, read, and delete.

use std::path::{Path, PathBuf};
use super::agentFolders::{AGENTS, SkillLocation, skill_locations, skills_dir, workspaceBoundary};
use super::skillText::parse_description;
use super::types::{InstalledSkill, ORIGIN_FILE, SkillOrigin, is_valid_name};

pub fn read_origin(dir: &Path) -> Option<SkillOrigin> {
    let text = std::fs::read_to_string(dir.join(ORIGIN_FILE)).ok()?;
    serde_json::from_str(&text).ok()
}

/// The skills of `level`, sorted by name. A skill that is in the folders of several agents is listed once.
pub(super) fn list_level(level: &str, cwd: Option<&str>) -> Vec<InstalledSkill> {
    // name → the agents that have the skill, and the folder with the real files (or else any folder of the skill)
    let mut found: std::collections::BTreeMap<String, (Vec<String>, PathBuf, bool)> = std::collections::BTreeMap::new();
    for agent in AGENTS {
        let Ok(dir) = skills_dir(agent, level, cwd) else {
            continue;
        };
        let Ok(entries) = std::fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().into_owned();
            let path = entry.path();
            if is_valid_name(&name) == false || path.join("SKILL.md").is_file() == false {
                continue;
            }
            let is_real = std::fs::symlink_metadata(&path).map(|m| m.file_type().is_symlink() == false).unwrap_or(false);
            let slot = found.entry(name).or_insert_with(|| (Vec::new(), path.clone(), is_real));
            slot.0.push(agent.to_string());
            if is_real && slot.2 == false {
                slot.1 = path;
                slot.2 = true;
            }
        }
    }
    found
        .into_iter()
        .filter_map(|(name, (agents, path, _))| {
            let text = std::fs::read_to_string(path.join("SKILL.md")).ok()?;
            Some(InstalledSkill {
                description: parse_description(&text),
                level: level.into(),
                origin: read_origin(&path),
                path: path.display().to_string(),
                agents,
                name,
            })
        })
        .collect()
}

/// The skills of the workspace folder, then the skills of the user.
pub fn skills_list(cwd: Option<String>) -> Vec<InstalledSkill> {
    let mut skills = Vec::new();
    if cwd.as_deref().is_some_and(|folder| folder.is_empty() == false) {
        skills.extend(list_level("workspace", cwd.as_deref()));
    }
    skills.extend(list_level("user", None));
    skills
}

/// The text of the `SKILL.md` file of an installed skill.
pub fn skills_read(level: String, cwd: Option<String>, name: String) -> Result<String, String> {
    for location in skill_locations(&level, cwd.as_deref(), &name)? {
        if let Ok(text) = std::fs::read_to_string(location.path.join("SKILL.md")) {
            return Ok(text);
        }
    }
    Err(format!("skills_not_installed: {name}"))
}

/// Deletes the links of a skill, then the real folders with `remove_real`. Gives the number of places removed.
pub fn delete_locations(locations: &[SkillLocation], remove_real: &dyn Fn(&Path) -> Result<(), String>) -> Result<usize, String> {
    for location in locations.iter().filter(|location| location.is_link) {
        std::fs::remove_file(&location.path).map_err(|e| format!("skills_delete_failed: {e}"))?;
    }
    for location in locations.iter().filter(|location| location.is_link == false) {
        remove_real(&location.path)?;
    }
    Ok(locations.len())
}

/// Moves a folder to the Trash, never a permanent delete.
pub fn move_to_trash(path: &Path) -> Result<(), String> {
    #[allow(unused_mut)]
    let mut context = trash::TrashContext::default();
    // NSFileManager: no Finder automation prompt, like the file explorer.
    #[cfg(target_os = "macos")]
    {
        use trash::macos::{DeleteMethod, TrashContextExtMacos};
        context.set_delete_method(DeleteMethod::NsFileManager);
    }
    context.delete(path).map_err(|e| format!("skills_delete_failed: {e}"))
}

/// Deletes an installed skill from the folders of all the agents: the links are removed, the real folder goes to the
/// Trash.
pub fn skills_delete(level: String, cwd: Option<String>, name: String) -> Result<(), String> {
    let locations = skill_locations(&level, cwd.as_deref(), &name)?;
    if locations.is_empty() {
        return Err(format!("skills_not_installed: {name}"));
    }
    delete_locations(&locations, &move_to_trash).map(|_| ())
}

/// Removes a named skill only when its coding agent entries refer to one valid installation in scope.
pub fn skillsDeleteUnambiguous(level: &str, workspacePath: Option<&str>, name: &str) -> Result<(), String> {
    let locations = skill_locations(level, workspacePath, name)?;
    let workspaceRoot = workspaceBoundary(level, workspacePath)?;
    let mut destinations = std::collections::BTreeSet::new();
    let mut validated = Vec::new();
    let mut validatedPaths = std::collections::BTreeSet::new();
    for mut location in locations {
        let parent = location.path.parent().ok_or("The skill path has no parent.")?;
        let absoluteParent = parent.canonicalize().map_err(|error| format!("Cannot resolve {}: {error}", parent.display()))?;
        if workspaceRoot.as_ref().is_some_and(|root| absoluteParent.starts_with(root) == false) {
            return Err(format!("The skill entry {} is outside the selected workspace.", location.path.display()));
        }
        location.path = absoluteParent.join(name);
        if validatedPaths.insert(location.path.clone()) == false {
            continue;
        }
        let destination = match location.path.canonicalize() {
            Ok(destination) => destination,
            Err(error) if location.is_link && error.kind() == std::io::ErrorKind::NotFound => continue,
            Err(error) => return Err(format!("Cannot resolve {}: {error}", location.path.display())),
        };
        if destination.join("SKILL.md").is_file() == false {
            return Err(format!("{} is not an installed skill. No files were removed.", location.path.display()));
        }
        if location.is_link == false && workspaceRoot.as_ref().is_some_and(|root| {
            destination == *root || destination.starts_with(root) == false
        }) {
            return Err(format!("The skill folder {} is outside the selected workspace.", destination.display()));
        }
        destinations.insert(destination);
        validated.push(location);
    }
    match destinations.len() {
        0 => Err(format!("skills_not_installed: {name}")),
        1 => delete_locations(&validated, &move_to_trash).map(|_| ()),
        _ => Err(format!("More than one independent installation is named {name}. No folders were removed.")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::skills::testSupport::*;
    use super::super::agentFolders::{link_agents, make_link, relative_link_target};

    #[test]
    fn lists_the_skills_with_their_origin() {
        let workspace = temp_folder("list");
        let folder = workspace.join(".agents/skills");
        let pdf = write_skill_folder(&folder, "pdf", "---\ndescription: Read PDF files.\n---\n");
        std::fs::write(pdf.join(ORIGIN_FILE), r#"{"source":"anthropics/skills","skill_id":"pdf"}"#).unwrap();
        write_skill_folder(&folder, "release-notes", "# Release notes");
        std::fs::create_dir_all(folder.join("not-a-skill")).unwrap();
        let skills = list_level("workspace", cwd_of(&workspace).as_deref());
        let names: Vec<_> = skills.iter().map(|s| s.name.as_str()).collect();
        assert_eq!(names, ["pdf", "release-notes"]);
        assert_eq!(skills[0].origin, Some(SkillOrigin { source: "anthropics/skills".into(), skill_id: "pdf".into(), folder_url: None, folder_path: None }));
        assert_eq!(skills[0].description, "Read PDF files.");
        assert_eq!(skills[0].agents, ["codex", "antigravity"]);
        assert_eq!(skills[1].origin, None);
        assert_eq!(skills[1].level, "workspace");
        let _ = std::fs::remove_dir_all(&workspace);
    }

    #[test]
    fn lists_a_skill_of_several_agents_once() {
        let workspace = temp_folder("list-once");
        let real = write_skill_folder(&workspace.join(".agents/skills"), "pdf", "# PDF");
        let claude_folder = workspace.join(".claude/skills");
        std::fs::create_dir_all(&claude_folder).unwrap();
        make_link(&relative_link_target(&claude_folder.join("pdf"), &real), &claude_folder.join("pdf")).unwrap();
        write_skill_folder(&claude_folder, "only-claude", "# Only Claude");
        let skills = list_level("workspace", cwd_of(&workspace).as_deref());
        let found: Vec<_> = skills.iter().map(|s| (s.name.as_str(), s.agents.clone())).collect();
        assert_eq!(
            found,
            [
                ("only-claude", vec!["claude".to_string()]),
                ("pdf", vec!["claude".to_string(), "codex".to_string(), "antigravity".to_string()]),
            ]
        );
        let pdf = skills.iter().find(|s| s.name == "pdf").unwrap();
        assert_eq!(pdf.path, real.display().to_string());
        let _ = std::fs::remove_dir_all(&workspace);
    }

    #[test]
    fn deletes_the_links_and_gives_the_real_folder_to_the_remover() {
        let workspace = temp_folder("delete");
        let cwd = cwd_of(&workspace);
        let real = write_skill_folder(&workspace.join(".agents/skills"), "pdf", "# PDF");
        link_agents("workspace", cwd.as_deref(), "pdf", &real, &["claude".to_string()]).unwrap();
        let places = skill_locations("workspace", cwd.as_deref(), "pdf").unwrap();
        let removed = std::cell::RefCell::new(Vec::new());
        let count = delete_locations(&places, &|path| {
            removed.borrow_mut().push(path.to_path_buf());
            Ok(())
        })
        .unwrap();
        assert_eq!(count, 2);
        assert_eq!(*removed.borrow(), [real.clone()]);
        // The link is gone; the real folder is the business of the remover (the Trash).
        assert!(std::fs::symlink_metadata(workspace.join(".claude/skills/pdf")).is_err());
        assert!(real.join("SKILL.md").exists());
        let _ = std::fs::remove_dir_all(&workspace);
    }
}
