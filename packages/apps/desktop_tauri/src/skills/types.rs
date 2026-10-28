//! The shapes of the data of the skills, and the checks on the names that come from outside.

use serde::{Deserialize, Serialize};

pub(super) const ORIGIN_FILE: &str = ".heidrun_origin.json";

/// Where an installed skill comes from: written in `.heidrun_origin.json` at the installation.
#[derive(Serialize, Deserialize, Debug, PartialEq, Clone)]
pub struct SkillOrigin {
    /// The repository, as `owner/repository` on GitHub, or `group/project` on GitLab (a project in a subgroup has more
    /// parts). Empty for a skill installed from a folder on this computer.
    #[serde(default)]
    pub source: String,
    /// The folder name of the skill.
    pub skill_id: String,
    /// The web address of the GitHub or GitLab folder, for a skill installed from that address. `None` otherwise.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub folder_url: Option<String>,
    /// The full path of the folder on this computer, for a skill installed from that folder. `None` otherwise.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub folder_path: Option<String>,
}

/// A skill found on the disk.
#[derive(Serialize, Debug, PartialEq)]
pub struct InstalledSkill {
    /// The folder name of the skill.
    pub name: String,
    /// The `description` of the frontmatter of the file `SKILL.md`.
    pub description: String,
    /// "workspace" or "user".
    pub level: String,
    /// `None` for a skill that Heidrun Code did not install.
    pub origin: Option<SkillOrigin>,
    /// The folder of the skill that holds the real files.
    pub path: String,
    /// The ids of the agents whose skills folder has the skill, a real folder or a link.
    pub agents: Vec<String>,
}

/// A result of the search on skills.sh.
#[derive(Serialize, Deserialize, Debug, PartialEq)]
pub struct SearchResult {
    /// The GitHub repository, as `owner/repository`.
    pub source: String,
    /// The folder name of the skill in the repository.
    #[serde(rename = "skillId", alias = "skill_id")]
    pub skill_id: String,
    /// The name shown by skills.sh.
    pub name: String,
    /// How many times the skill was installed.
    #[serde(default)]
    pub installs: u64,
}

/// A file of a GitHub or GitLab repository, from the list of the files of the repository or of a folder.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub(super) struct RepositoryFile {
    pub(super) path: String,
    pub(super) size: u64,
}

/// True for a part of a repository name: letters, digits, and `- _ .`, and not `.` or `..`.
fn is_source_part(part: &str) -> bool {
    !part.is_empty() && part != "." && part != ".." && part.chars().all(|c| c.is_ascii_alphanumeric() || "-_.".contains(c))
}

/// True for `owner/repository` with only the characters GitHub allows.
pub(super) fn is_valid_source(source: &str) -> bool {
    let Some((owner, repository)) = source.split_once('/') else {
        return false;
    };
    is_source_part(owner) && is_source_part(repository)
}

/// True for `group/project`, or `group/subgroup/project`, with only the characters GitLab allows.
pub(super) fn is_valid_gitlab_source(source: &str) -> bool {
    let parts: Vec<&str> = source.split('/').collect();
    parts.len() >= 2 && parts.iter().all(|part| is_source_part(part))
}

/// True for a folder name that cannot leave the folder of the skills.
pub(super) fn is_valid_name(name: &str) -> bool {
    !name.is_empty() && name != "." && name != ".." && !name.starts_with('.') && name.chars().all(|c| c.is_ascii_alphanumeric() || "-_.".contains(c))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn writes_the_address_of_the_folder_only_when_there_is_one() {
        let from_skills_sh = SkillOrigin { source: "a/b".into(), skill_id: "c".into(), folder_url: None, folder_path: None };
        assert_eq!(serde_json::to_string(&from_skills_sh).unwrap(), r#"{"source":"a/b","skill_id":"c"}"#);
        let from_address = SkillOrigin {
            source: "a/b".into(),
            skill_id: "c".into(),
            folder_url: Some("https://github.com/a/b/tree/main/c".into()),
            folder_path: None,
        };
        let text = serde_json::to_string(&from_address).unwrap();
        assert_eq!(serde_json::from_str::<SkillOrigin>(&text).unwrap(), from_address);
        assert_eq!(serde_json::from_str::<SkillOrigin>(r#"{"source":"a/b","skill_id":"c"}"#).unwrap(), from_skills_sh);
    }

    #[test]
    fn writes_the_path_of_the_folder_only_for_a_skill_installed_from_a_local_folder() {
        let from_folder = SkillOrigin { source: String::new(), skill_id: "pdf".into(), folder_url: None, folder_path: Some("/Users/a/skills/pdf".into()) };
        let text = serde_json::to_string(&from_folder).unwrap();
        assert_eq!(text, r#"{"source":"","skill_id":"pdf","folder_path":"/Users/a/skills/pdf"}"#);
        assert_eq!(serde_json::from_str::<SkillOrigin>(&text).unwrap(), from_folder);
        assert_eq!(serde_json::from_str::<SkillOrigin>(r#"{"skill_id":"pdf","folder_path":"/x/pdf"}"#).unwrap().source, "");
    }

    #[test]
    fn accepts_a_source_of_a_gitlab_project_with_or_without_subgroups() {
        assert!(is_valid_gitlab_source("group/project"));
        assert!(is_valid_gitlab_source("group/sub-group/project.v2"));
    }

    #[test]
    fn refuses_a_source_that_is_not_a_gitlab_project() {
        for source in ["project", "group//project", "../x", "group/..", "group/pro ject", "/group/project", "group/project/"] {
            assert!(!is_valid_gitlab_source(source), "{source}");
        }
    }

    #[test]
    fn accepts_a_source_of_a_repository() {
        assert!(is_valid_source("anthropics/skills"));
        assert!(is_valid_source("obra/super-powers.v2"));
    }

    #[test]
    fn refuses_a_source_that_is_not_a_repository() {
        for source in ["skills", "a/b/c", "../x", "a/..", "a/b c", "/skills", "a/"] {
            assert!(!is_valid_source(source), "{source}");
        }
    }

    #[test]
    fn refuses_a_name_that_leaves_the_folder_of_the_skills() {
        for name in ["", ".", "..", "../x", "a/b", ".hidden", "a b"] {
            assert!(!is_valid_name(name), "{name}");
        }
        assert!(is_valid_name("frontend-design"));
    }
}
