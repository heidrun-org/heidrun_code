//! The skills folders of the coding agents, and the links between them.

use std::path::{Path, PathBuf};
use super::types::is_valid_name;

/// The ids of the coding agents that Heidrun Code knows: the ids of `lib/agents.ts` of the frontend.
pub(super) const AGENTS: [&str; 3] = ["claude", "codex", "antigravity"];
/// The agent whose skills folder holds the real files. Every other agent gets a link to them.
pub(super) const REAL_FILES_AGENT: &str = "codex";

/// The folder of the workspace, or the home folder of the user, under which the folders of the skills are.
pub(super) fn level_root(level: &str, cwd: Option<&str>) -> Result<PathBuf, String> {
    match level {
        "user" => Ok(dirs::home_dir().unwrap_or_default()),
        "workspace" => match cwd {
            Some(cwd) if !cwd.is_empty() => Ok(PathBuf::from(cwd)),
            _ => Err("skills_no_workspace_folder".into()),
        },
        _ => Err(format!("skills_unknown_level: {level}")),
    }
}

/// The folder where `agent` reads the skills of `level`.
pub(super) fn skills_dir(agent: &str, level: &str, cwd: Option<&str>) -> Result<PathBuf, String> {
    let root = level_root(level, cwd)?;
    match (agent, level) {
        ("claude", "user") => Ok(crate::claude::claude_dir().join("skills")),
        ("claude", _) => Ok(root.join(".claude").join("skills")),
        ("codex", _) => Ok(root.join(".agents").join("skills")),
        ("antigravity", "user") => Ok(root.join(".gemini").join("antigravity-cli").join("skills")),
        ("antigravity", _) => Ok(root.join(".agents").join("skills")),
        _ => Err(format!("skills_unknown_agent: {agent}")),
    }
}

/// Where a skill is, for one agent.
#[derive(Debug, PartialEq)]
pub(super) struct SkillLocation {
    pub(super) agent: &'static str,
    pub(super) path: PathBuf,
    /// True when the path is a link to the real files, false for a real folder.
    pub(super) is_link: bool,
}

/// The places of a skill in the skills folders of all the agents: a real folder, or a link (broken or not).
pub(super) fn skill_locations(level: &str, cwd: Option<&str>, name: &str) -> Result<Vec<SkillLocation>, String> {
    if !is_valid_name(name) {
        return Err(format!("skills_invalid_name: {name}"));
    }
    let mut locations = Vec::new();
    for agent in AGENTS {
        let path = skills_dir(agent, level, cwd)?.join(name);
        if let Ok(metadata) = std::fs::symlink_metadata(&path) {
            if locations.iter().any(|location: &SkillLocation| location.path == path) {
                continue;
            }
            locations.push(SkillLocation { agent, path, is_link: metadata.file_type().is_symlink() });
        }
    }
    Ok(locations)
}

/// The path to write in the link `link` so that it leads to `target`: relative, so the link stays right when the
/// workspace folder moves. `../../.agents/skills/pdf` for the link `.claude/skills/pdf`.
pub(super) fn relative_link_target(link: &Path, target: &Path) -> PathBuf {
    let from: Vec<_> = link.parent().unwrap_or(Path::new("")).components().collect();
    let to: Vec<_> = target.components().collect();
    let common = from.iter().zip(to.iter()).take_while(|(a, b)| a == b).count();
    let mut result = PathBuf::new();
    for _ in common..from.len() {
        result.push("..");
    }
    for component in &to[common..] {
        result.push(component.as_os_str());
    }
    result
}

#[cfg(unix)]
pub(super) fn make_link(target: &Path, link: &Path) -> Result<(), String> {
    std::os::unix::fs::symlink(target, link).map_err(|e| format!("skills_install_failed: {e}"))
}

#[cfg(not(unix))]
pub(super) fn make_link(_target: &Path, _link: &Path) -> Result<(), String> {
    Err("skills_install_failed: links are not supported on this system".into())
}

/// Adds, in the skills folder of every agent of `agents` except the agent of the real files, a link to `target`.
pub(super) fn link_agents(level: &str, cwd: Option<&str>, name: &str, target: &Path, agents: &[String]) -> Result<(), String> {
    for agent in agents.iter().filter(|agent| agent.as_str() != REAL_FILES_AGENT) {
        let folder = skills_dir(agent, level, cwd)?;
        if folder == target.parent().unwrap_or(Path::new("")) {
            continue;
        }
        std::fs::create_dir_all(&folder).map_err(|e| format!("skills_install_failed: {e}"))?;
        let link = folder.join(name);
        make_link(&relative_link_target(&link, target), &link)?;
    }
    Ok(())
}

/// Adds, in the skills folder of `agent`, a link to the real folder of an installed skill. It never replaces a real
/// folder or a link that is already there.
pub(super) fn link_installed_skill(level: &str, cwd: Option<&str>, name: &str, agent: &str) -> Result<(), String> {
    if AGENTS.contains(&agent) == false {
        return Err(format!("skills_unknown_agent: {agent}"));
    }
    let locations = skill_locations(level, cwd, name)?;
    if locations.iter().any(|location| location.agent == agent) {
        return Err(format!("skills_already_linked: {name}"));
    }
    let agent_folder = skills_dir(agent, level, cwd)?;
    if locations.iter().any(|location| location.path.parent() == Some(agent_folder.as_path())) {
        return Err(format!("skills_already_linked: {name}"));
    }
    let Some(real) = locations.iter().find(|location| location.is_link == false && location.path.join("SKILL.md").is_file()) else {
        return Err(format!("skills_not_installed: {name}"));
    };
    let folder = skills_dir(agent, level, cwd)?;
    std::fs::create_dir_all(&folder).map_err(|e| format!("skills_install_failed: {e}"))?;
    let link = folder.join(name);
    make_link(&relative_link_target(&link, &real.path), &link)
}

/// Adds the link of an installed skill for an agent whose skills folder lacks the skill.
#[tauri::command]
pub fn skills_link_agent(level: String, cwd: Option<String>, name: String, agent: String) -> Result<(), String> {
    link_installed_skill(&level, cwd.as_deref(), &name, &agent)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::skills::test_support::*;

    #[test]
    fn writes_the_link_of_an_agent_relative_to_the_real_files() {
        let link = Path::new("/work/app/.claude/skills/pdf");
        let target = Path::new("/work/app/.agents/skills/pdf");
        assert_eq!(relative_link_target(link, target), PathBuf::from("../../.agents/skills/pdf"));
        let other = Path::new("/home/me/.config/claude/skills/pdf");
        assert_eq!(relative_link_target(other, Path::new("/home/me/.agents/skills/pdf")), PathBuf::from("../../../.agents/skills/pdf"));
    }

    #[test]
    fn links_the_agents_that_are_not_the_agent_of_the_real_files() {
        let workspace = temp_folder("link");
        let cwd = cwd_of(&workspace);
        let real = write_skill_folder(&workspace.join(".agents/skills"), "pdf", "# PDF");
        link_agents("workspace", cwd.as_deref(), "pdf", &real, &["claude".to_string(), "codex".to_string()]).unwrap();
        let link = workspace.join(".claude/skills/pdf");
        assert!(std::fs::symlink_metadata(&link).unwrap().file_type().is_symlink());
        assert_eq!(std::fs::read_to_string(link.join("SKILL.md")).unwrap(), "# PDF");
        assert_eq!(std::fs::read_link(&link).unwrap(), PathBuf::from("../../.agents/skills/pdf"));
        // Codex reads the real folder: no link in it.
        assert!(std::fs::symlink_metadata(&real).unwrap().file_type().is_symlink() == false);
        // The link is relative: it still works after the workspace folder moves.
        let moved = temp_folder("link-moved");
        std::fs::remove_dir_all(&moved).unwrap();
        std::fs::rename(&workspace, &moved).unwrap();
        assert_eq!(std::fs::read_to_string(moved.join(".claude/skills/pdf/SKILL.md")).unwrap(), "# PDF");
        let _ = std::fs::remove_dir_all(&moved);
    }

    #[test]
    fn finds_the_places_of_a_skill_and_tells_a_link_from_a_real_folder() {
        let workspace = temp_folder("places");
        let cwd = cwd_of(&workspace);
        assert_eq!(skill_locations("workspace", cwd.as_deref(), "pdf").unwrap(), []);
        let real = write_skill_folder(&workspace.join(".agents/skills"), "pdf", "# PDF");
        link_agents("workspace", cwd.as_deref(), "pdf", &real, &["claude".to_string()]).unwrap();
        let places = skill_locations("workspace", cwd.as_deref(), "pdf").unwrap();
        let summary: Vec<_> = places.iter().map(|p| (p.agent, p.is_link)).collect();
        assert_eq!(summary, [("claude", true), ("codex", false)]);
        assert!(skill_locations("workspace", cwd.as_deref(), "../x").is_err());
        let _ = std::fs::remove_dir_all(&workspace);
    }

    #[test]
    fn adds_the_link_of_an_installed_skill_for_an_agent_switched_on_later() {
        let workspace = temp_folder("link-later");
        let cwd = cwd_of(&workspace);
        let real = write_skill_folder(&workspace.join(".agents/skills"), "pdf", "# PDF");
        link_installed_skill("workspace", cwd.as_deref(), "pdf", "claude").unwrap();
        let link = workspace.join(".claude/skills/pdf");
        assert_eq!(std::fs::read_link(&link).unwrap(), PathBuf::from("../../.agents/skills/pdf"));
        assert_eq!(std::fs::read_to_string(link.join("SKILL.md")).unwrap(), "# PDF");
        assert!(std::fs::symlink_metadata(&real).unwrap().file_type().is_symlink() == false);
        let _ = std::fs::remove_dir_all(&workspace);
    }

    #[test]
    fn links_to_the_real_folder_even_when_it_is_in_the_folder_of_another_agent() {
        let workspace = temp_folder("link-local");
        let cwd = cwd_of(&workspace);
        let real = write_skill_folder(&workspace.join(".claude/skills"), "notes", "# Notes");
        link_installed_skill("workspace", cwd.as_deref(), "notes", "codex").unwrap();
        let link = workspace.join(".agents/skills/notes");
        assert_eq!(std::fs::read_link(&link).unwrap(), PathBuf::from("../../.claude/skills/notes"));
        assert_eq!(std::fs::read_to_string(link.join("SKILL.md")).unwrap(), "# Notes");
        assert!(real.join("SKILL.md").is_file());
        let _ = std::fs::remove_dir_all(&workspace);
    }

    #[test]
    fn never_replaces_a_real_folder_or_a_link_with_a_new_link() {
        let workspace = temp_folder("link-keep");
        let cwd = cwd_of(&workspace);
        let real = write_skill_folder(&workspace.join(".agents/skills"), "pdf", "# PDF");
        let own = write_skill_folder(&workspace.join(".claude/skills"), "pdf", "# Own copy");
        let result = link_installed_skill("workspace", cwd.as_deref(), "pdf", "claude");
        assert_eq!(result, Err("skills_already_linked: pdf".into()));
        assert_eq!(std::fs::read_to_string(own.join("SKILL.md")).unwrap(), "# Own copy");
        assert!(std::fs::symlink_metadata(&own).unwrap().file_type().is_symlink() == false);
        std::fs::remove_dir_all(&own).unwrap();
        link_agents("workspace", cwd.as_deref(), "pdf", &real, &["claude".to_string()]).unwrap();
        let result = link_installed_skill("workspace", cwd.as_deref(), "pdf", "claude");
        assert_eq!(result, Err("skills_already_linked: pdf".into()));
        let _ = std::fs::remove_dir_all(&workspace);
    }

    #[test]
    fn refuses_a_link_for_a_skill_that_is_not_installed_or_an_unknown_agent() {
        let workspace = temp_folder("link-refuse");
        let cwd = cwd_of(&workspace);
        let result = link_installed_skill("workspace", cwd.as_deref(), "pdf", "claude");
        assert_eq!(result, Err("skills_not_installed: pdf".into()));
        write_skill_folder(&workspace.join(".agents/skills"), "pdf", "# PDF");
        let result = link_installed_skill("workspace", cwd.as_deref(), "pdf", "gemini");
        assert_eq!(result, Err("skills_unknown_agent: gemini".into()));
        assert!(link_installed_skill("workspace", cwd.as_deref(), "../x", "claude").is_err());
        let _ = std::fs::remove_dir_all(&workspace);
    }

    #[test]
    fn needs_a_folder_for_the_workspace_level() {
        assert_eq!(skills_dir("codex", "workspace", None), Err("skills_no_workspace_folder".into()));
        assert_eq!(skills_dir("codex", "workspace", Some("/work/app")), Ok(PathBuf::from("/work/app/.agents/skills")));
        assert_eq!(skills_dir("claude", "workspace", Some("/work/app")), Ok(PathBuf::from("/work/app/.claude/skills")));
        assert!(skills_dir("codex", "team", None).is_err());
        assert_eq!(skills_dir("cursor", "workspace", Some("/work/app")), Err("skills_unknown_agent: cursor".into()));
    }
}
