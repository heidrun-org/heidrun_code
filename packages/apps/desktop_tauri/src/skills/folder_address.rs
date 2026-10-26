//! The web address of a skill folder in a GitHub or GitLab repository, read as text. Pure functions: no input or output.

use super::types::{is_valid_gitlab_source, is_valid_name, is_valid_source};

/// The code hosting service that holds the repository of a skill folder.
#[derive(Debug, PartialEq, Clone, Copy)]
pub(super) enum CodeHost {
    /// github.com
    GitHub,
    /// gitlab.com
    GitLab,
}

/// A web address of a folder of a public repository, as shown by GitHub or GitLab:
/// `https://github.com/<owner>/<repository>/tree/<branch>/<path of the folder>`, or
/// `https://gitlab.com/<group>/<project>/-/tree/<branch>/<path of the folder>`. A GitLab project can be in subgroups:
/// `https://gitlab.com/<group>/<subgroup>/<project>/-/tree/<branch>/<path of the folder>`.
#[derive(Debug, PartialEq, Clone)]
pub(super) struct FolderAddress {
    /// The service that holds the repository.
    pub(super) host: CodeHost,
    /// The repository: `owner/repository` on GitHub, `group/project` (with the subgroups) on GitLab.
    pub(super) source: String,
    /// The parts of the address after `tree/`: the branch, then the path of the folder. A branch name can hold slashes,
    /// so the address alone does not say where the branch ends. At least two parts.
    pub(super) parts: Vec<String>,
}

impl FolderAddress {
    /// The folder name of the skill: the last part of the address.
    pub(super) fn skill_id(&self) -> &str {
        self.parts.last().map(String::as_str).unwrap_or_default()
    }

    /// The address in its normal form, without a query, a fragment, or a slash at the end.
    pub(super) fn url(&self) -> String {
        match self.host {
            CodeHost::GitHub => format!("https://github.com/{}/tree/{}", self.source, self.parts.join("/")),
            CodeHost::GitLab => format!("https://gitlab.com/{}/-/tree/{}", self.source, self.parts.join("/")),
        }
    }

    /// The address of the folder `name` directly below this folder.
    pub(super) fn child(&self, name: &str) -> FolderAddress {
        let mut parts = self.parts.clone();
        parts.push(name.to_string());
        FolderAddress { host: self.host, source: self.source.clone(), parts }
    }

    /// The parts of the address after `tree/`, joined by slashes, as raw.githubusercontent.com reads them.
    pub(super) fn reference_and_path(&self) -> String {
        self.parts.join("/")
    }

    /// The branch and the path of the folder, when the branch is the first `branch_length` parts.
    pub(super) fn split(&self, branch_length: usize) -> (String, String) {
        (self.parts[..branch_length].join("/"), self.parts[branch_length..].join("/"))
    }

    /// The lengths that the branch can have, the shortest first, because most branches (`main`) have no slash.
    /// The path of the folder keeps at least one part.
    pub(super) fn branch_lengths(&self) -> std::ops::Range<usize> {
        1..self.parts.len()
    }
}

/// True for a part of an address after `tree/`: letters, digits, and `- _ . ~ + @`, and not `.` or `..`.
fn is_valid_part(part: &str) -> bool {
    part != "." && part != ".." && !part.is_empty() && part.chars().all(|c| c.is_ascii_alphanumeric() || "-_.~+@".contains(c))
}

/// Reads the address of a skill folder. The error is `skills_invalid_address: <text>`.
pub(super) fn parse_folder_address(text: &str) -> Result<FolderAddress, String> {
    let invalid = || format!("skills_invalid_address: {}", text.trim());
    let trimmed = text.trim();
    let (host, rest) = if let Some(rest) = trimmed.strip_prefix("https://github.com/").or_else(|| trimmed.strip_prefix("https://www.github.com/")) {
        (CodeHost::GitHub, rest)
    } else if let Some(rest) = trimmed.strip_prefix("https://gitlab.com/") {
        (CodeHost::GitLab, rest)
    } else {
        return Err(invalid());
    };
    let rest = rest.split(['?', '#']).next().unwrap_or_default().trim_end_matches('/');
    let (source, after_tree) = match host {
        CodeHost::GitHub => {
            let mut parts = rest.splitn(4, '/');
            let (Some(owner), Some(repository), Some("tree"), Some(after_tree)) = (parts.next(), parts.next(), parts.next(), parts.next()) else {
                return Err(invalid());
            };
            (format!("{owner}/{repository}"), after_tree)
        }
        CodeHost::GitLab => {
            let (project, after_tree) = rest.split_once("/-/tree/").ok_or_else(invalid)?;
            (project.to_string(), after_tree)
        }
    };
    let parts: Vec<String> = after_tree.split('/').map(str::to_string).collect();
    let is_valid_repository = match host {
        CodeHost::GitHub => is_valid_source(&source),
        CodeHost::GitLab => is_valid_gitlab_source(&source),
    };
    if is_valid_repository == false || parts.len() < 2 || parts.iter().all(|part| is_valid_part(part)) == false {
        return Err(invalid());
    }
    let address = FolderAddress { host, source, parts };
    if is_valid_name(address.skill_id()) == false {
        return Err(invalid());
    }
    Ok(address)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn address(parts: &[&str]) -> FolderAddress {
        FolderAddress { host: CodeHost::GitHub, source: "anthropics/skills".into(), parts: parts.iter().map(|part| part.to_string()).collect() }
    }

    #[test]
    fn reads_the_address_of_a_skill_folder() {
        let parsed = parse_folder_address("https://github.com/anthropics/skills/tree/main/skills/pdf").unwrap();
        assert_eq!(parsed, address(&["main", "skills", "pdf"]));
        assert_eq!(parsed.skill_id(), "pdf");
        assert_eq!(parsed.reference_and_path(), "main/skills/pdf");
    }

    #[test]
    fn ignores_the_spaces_the_query_the_fragment_and_the_slash_at_the_end() {
        let parsed = parse_folder_address("  https://github.com/anthropics/skills/tree/main/skills/pdf/?tab=readme#top \n").unwrap();
        assert_eq!(parsed.url(), "https://github.com/anthropics/skills/tree/main/skills/pdf");
        assert!(parse_folder_address("https://www.github.com/anthropics/skills/tree/main/pdf").is_ok());
    }

    #[test]
    fn keeps_a_branch_name_with_slashes_in_the_parts() {
        let parsed = parse_folder_address("https://github.com/anthropics/skills/tree/klazuka/doc-skills/skill-creator").unwrap();
        assert_eq!(parsed.parts, ["klazuka", "doc-skills", "skill-creator"]);
        assert_eq!(parsed.branch_lengths(), 1..3);
        assert_eq!(parsed.split(1), ("klazuka".to_string(), "doc-skills/skill-creator".to_string()));
        assert_eq!(parsed.split(2), ("klazuka/doc-skills".to_string(), "skill-creator".to_string()));
    }

    #[test]
    fn writes_the_address_of_a_folder_below_a_folder_on_github_and_on_gitlab() {
        let github = parse_folder_address("https://github.com/jeromeetienne/coding_agent_plugin/tree/main/skills").unwrap();
        assert_eq!(github.child("pdf").url(), "https://github.com/jeromeetienne/coding_agent_plugin/tree/main/skills/pdf");
        assert_eq!(github.child("pdf").skill_id(), "pdf");
        let gitlab = parse_folder_address("https://gitlab.com/acme/team/tools/-/tree/main/skills").unwrap();
        assert_eq!(gitlab.child("pdf").url(), "https://gitlab.com/acme/team/tools/-/tree/main/skills/pdf");
    }

    #[test]
    fn refuses_a_text_that_is_not_the_address_of_a_folder() {
        for text in [
            "pdf",
            "https://github.com/anthropics/skills",
            "https://github.com/anthropics/skills/tree/main",
            "https://github.com/anthropics/skills/blob/main/skills/pdf/SKILL.md",
            "http://github.com/anthropics/skills/tree/main/skills/pdf",
            "https://gitlab.com/anthropics/skills/tree/main/skills/pdf",
            "https://github.com.evil.example/anthropics/skills/tree/main/skills/pdf",
            "https://github.com/anthropics//tree/main/skills/pdf",
            "https://github.com/anthropics/skills/tree/main//pdf",
        ] {
            assert_eq!(parse_folder_address(text), Err(format!("skills_invalid_address: {text}")), "{text}");
        }
    }

    #[test]
    fn refuses_a_part_that_could_leave_the_folder_or_break_the_call_to_github() {
        for text in [
            "https://github.com/anthropics/skills/tree/main/../pdf",
            "https://github.com/anthropics/skills/tree/main/skills/.hidden",
            "https://github.com/anthropics/skills/tree/main/skills/my%20skill",
            "https://github.com/anthropics/skills/tree/main:x/pdf",
        ] {
            assert!(parse_folder_address(text).is_err(), "{text}");
        }
    }

    fn gitlab_address(source: &str, parts: &[&str]) -> FolderAddress {
        FolderAddress { host: CodeHost::GitLab, source: source.into(), parts: parts.iter().map(|part| part.to_string()).collect() }
    }

    #[test]
    fn reads_the_address_of_a_skill_folder_on_gitlab() {
        let parsed = parse_folder_address("https://gitlab.com/acme/agent-skills/-/tree/main/skills/pdf").unwrap();
        assert_eq!(parsed, gitlab_address("acme/agent-skills", &["main", "skills", "pdf"]));
        assert_eq!(parsed.skill_id(), "pdf");
        assert_eq!(parsed.url(), "https://gitlab.com/acme/agent-skills/-/tree/main/skills/pdf");
    }

    #[test]
    fn reads_the_address_of_a_gitlab_project_in_subgroups_and_a_branch_with_slashes() {
        let parsed = parse_folder_address(" https://gitlab.com/acme/team/tools/-/tree/feature/skills/skills/pdf/?ref_type=heads#top ").unwrap();
        assert_eq!(parsed.source, "acme/team/tools");
        assert_eq!(parsed.parts, ["feature", "skills", "skills", "pdf"]);
        assert_eq!(parsed.split(2), ("feature/skills".to_string(), "skills/pdf".to_string()));
        assert_eq!(parsed.url(), "https://gitlab.com/acme/team/tools/-/tree/feature/skills/skills/pdf");
    }

    #[test]
    fn refuses_a_text_that_is_not_the_address_of_a_folder_on_gitlab() {
        for text in [
            "https://gitlab.com/acme/agent-skills",
            "https://gitlab.com/acme/agent-skills/-/tree/main",
            "https://gitlab.com/acme/agent-skills/-/blob/main/skills/pdf/SKILL.md",
            "https://gitlab.com/acme/-/tree/main/skills/pdf",
            "https://gitlab.com/acme//agent-skills/-/tree/main/skills/pdf",
            "http://gitlab.com/acme/agent-skills/-/tree/main/skills/pdf",
            "https://gitlab.com.evil.example/acme/agent-skills/-/tree/main/skills/pdf",
            "https://gitlab.com/acme/agent-skills/-/tree/main/../pdf",
            "https://gitlab.com/acme/agent-skills/-/tree/main/skills/.hidden",
        ] {
            assert_eq!(parse_folder_address(text), Err(format!("skills_invalid_address: {text}")), "{text}");
        }
    }
}
