//! Pure functions on the paths of the files of a GitHub repository.

use std::path::PathBuf;
use super::types::{RepositoryFile, is_valid_name};

/// The path of `full` inside `dir`, or `None` when the path goes out of `dir` or holds a `..` part.
pub(super) fn relative_path(dir: &str, full: &str) -> Option<PathBuf> {
    let rest = if dir.is_empty() { full } else { full.strip_prefix(dir)?.strip_prefix('/')? };
    let path = PathBuf::from(rest);
    let is_safe = !rest.is_empty() && path.components().all(|c| matches!(c, std::path::Component::Normal(_)));
    if is_safe {
        Some(path)
    } else {
        None
    }
}

/// The folder of the skill `skill_id` among the file paths of a repository: a folder with this name that holds a
/// `SKILL.md` file, at any depth. With several folders, the one under `skills/` wins, then the shallowest.
pub(super) fn pick_skill_dir(paths: &[String], skill_id: &str) -> Option<String> {
    let ending = format!("/{skill_id}/SKILL.md");
    let own = format!("{skill_id}/SKILL.md");
    let mut dirs: Vec<&str> = paths
        .iter()
        .filter_map(|path| {
            if *path == own {
                Some(skill_id)
            } else {
                path.strip_suffix("/SKILL.md").filter(|_| path.ends_with(&ending))
            }
        })
        .collect();
    dirs.sort_by_key(|dir| (!dir.starts_with("skills/"), dir.matches('/').count(), dir.to_string()));
    dirs.first().map(|dir| dir.to_string())
}

/// A path of a repository for a URL: every byte that is not a letter, a digit, or one of `-_.~/` becomes `%XX`.
pub(super) fn encode_path(path: &str) -> String {
    path.bytes()
        .map(|byte| match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' | b'/' => (byte as char).to_string(),
            _ => format!("%{byte:02X}"),
        })
        .collect()
}

/// The files of the folder `dir` of a repository, each with its path inside the folder.
pub(super) fn files_in_dir(files: &[RepositoryFile], dir: &str) -> Vec<(PathBuf, RepositoryFile)> {
    files.iter().filter_map(|file| relative_path(dir, &file.path).map(|relative| (relative, file.clone()))).collect()
}

/// The folders of all the `SKILL.md` files of a repository, the most likely first for the skill `skill_id`: the folders
/// whose name and `skill_id` contain one another (`react-best-practices` for `vercel-react-best-practices`), then the
/// folders under `skills/`, then the shallowest.
pub(super) fn candidate_dirs(paths: &[String], skill_id: &str) -> Vec<String> {
    let mut dirs: Vec<&str> = paths.iter().filter_map(|path| path.strip_suffix("/SKILL.md")).collect();
    dirs.sort_by_key(|dir| {
        let name = dir.rsplit('/').next().unwrap_or(dir);
        let is_related = name.len() >= 4 && (skill_id.contains(name) || name.contains(skill_id));
        (!is_related, !dir.starts_with("skills/"), dir.matches('/').count(), dir.to_string())
    });
    dirs.into_iter().map(|dir| dir.to_string()).collect()
}

/// What a folder of a repository holds, as far as skills go.
#[derive(Debug, PartialEq)]
pub(super) enum SkillFolders {
    /// The folder holds a `SKILL.md` file: the folder is one skill.
    Itself,
    /// The names of the direct subfolders that hold a `SKILL.md` file, sorted. Empty when no subfolder holds one.
    Subfolders(Vec<String>),
}

/// Reads what a folder holds from the paths of the files below it, each path inside the folder. A `SKILL.md` file at the
/// top makes the folder one skill, and the subfolders are not read. Otherwise a skill is each direct subfolder with a
/// `SKILL.md` file and a name that a skill folder can have.
pub(super) fn find_skill_folders(files: &[RepositoryFile]) -> SkillFolders {
    if files.iter().any(|file| file.path == "SKILL.md") {
        return SkillFolders::Itself;
    }
    let mut names: Vec<String> = files
        .iter()
        .filter_map(|file| file.path.strip_suffix("/SKILL.md"))
        .filter(|name| is_valid_name(name))
        .map(str::to_string)
        .collect();
    names.sort();
    names.dedup();
    SkillFolders::Subfolders(names)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn files(paths: &[&str]) -> Vec<RepositoryFile> {
        paths.iter().map(|path| RepositoryFile { path: path.to_string(), size: 1 }).collect()
    }

    #[test]
    fn takes_a_folder_with_a_skill_file_as_one_skill() {
        let listed = files(&["SKILL.md", "scripts/a.py", "sub/SKILL.md"]);
        assert_eq!(find_skill_folders(&listed), SkillFolders::Itself);
    }

    #[test]
    fn lists_the_direct_subfolders_with_a_skill_file_sorted() {
        let listed = files(&["pdf/SKILL.md", "pdf/scripts/a.py", "docx/SKILL.md", "notes/readme.md", "a/b/SKILL.md", ".hidden/SKILL.md", "my skill/SKILL.md"]);
        assert_eq!(find_skill_folders(&listed), SkillFolders::Subfolders(vec!["docx".into(), "pdf".into()]));
    }

    #[test]
    fn lists_no_subfolder_for_a_folder_with_no_skill_file() {
        assert_eq!(find_skill_folders(&files(&["readme.md", "docs/guide.md"])), SkillFolders::Subfolders(Vec::new()));
        assert_eq!(find_skill_folders(&[]), SkillFolders::Subfolders(Vec::new()));
    }

    #[test]
    fn gives_the_path_of_a_file_inside_the_skill_folder() {
        assert_eq!(relative_path("skills/pdf", "skills/pdf/scripts/a.py"), Some(PathBuf::from("scripts/a.py")));
        assert_eq!(relative_path("", "a.txt"), Some(PathBuf::from("a.txt")));
    }

    #[test]
    fn refuses_a_path_outside_the_skill_folder() {
        assert_eq!(relative_path("skills/pdf", "skills/pdfx/a.py"), None);
        assert_eq!(relative_path("skills/pdf", "skills/pdf/../../etc/passwd"), None);
        assert_eq!(relative_path("skills/pdf", "skills/pdf"), None);
    }

    fn paths(list: &[&str]) -> Vec<String> {
        list.iter().map(|p| p.to_string()).collect()
    }

    #[test]
    fn finds_a_skill_in_a_nested_folder() {
        let all = paths(&["README.md", "docs/productivity/grill-me.md", "skills/productivity/grill-me/SKILL.md", "skills/productivity/grill-me/agents/openai.yaml"]);
        assert_eq!(pick_skill_dir(&all, "grill-me"), Some("skills/productivity/grill-me".into()));
    }

    #[test]
    fn finds_a_skill_at_the_top_of_the_repository() {
        assert_eq!(pick_skill_dir(&paths(&["pdf/SKILL.md"]), "pdf"), Some("pdf".into()));
    }

    #[test]
    fn prefers_the_folder_skills_then_the_shallowest_folder() {
        let all = paths(&["examples/deep/a/pdf/SKILL.md", "tools/pdf/SKILL.md", "skills/team/pdf/SKILL.md", "skills/pdf/SKILL.md"]);
        assert_eq!(pick_skill_dir(&all, "pdf"), Some("skills/pdf".into()));
        let without_skills = paths(&["examples/deep/a/pdf/SKILL.md", "tools/pdf/SKILL.md"]);
        assert_eq!(pick_skill_dir(&without_skills, "pdf"), Some("tools/pdf".into()));
    }

    #[test]
    fn does_not_take_a_folder_whose_name_only_ends_like_the_skill() {
        let all = paths(&["skills/batch-grill-me/SKILL.md", "skills/grill-me.md", "skills/grill-me/notes/SKILL.md"]);
        assert_eq!(pick_skill_dir(&all, "grill-me"), None);
    }

    #[test]
    fn encodes_a_path_for_a_url() {
        assert_eq!(encode_path("skills/my skill/a#b.md"), "skills/my%20skill/a%23b.md");
        assert_eq!(encode_path("skills/pdf/scripts/a-b_c.py"), "skills/pdf/scripts/a-b_c.py");
    }

    #[test]
    fn lists_the_files_of_a_folder_with_their_path_inside_it() {
        let all = vec![
            RepositoryFile { path: "skills/pdf/SKILL.md".into(), size: 10 },
            RepositoryFile { path: "skills/pdf/scripts/a.py".into(), size: 20 },
            RepositoryFile { path: "skills/pdfx/SKILL.md".into(), size: 30 },
            RepositoryFile { path: "README.md".into(), size: 40 },
        ];
        let inside: Vec<_> = files_in_dir(&all, "skills/pdf").into_iter().map(|(relative, file)| (relative, file.size)).collect();
        assert_eq!(inside, [(PathBuf::from("SKILL.md"), 10), (PathBuf::from("scripts/a.py"), 20)]);
    }

    #[test]
    fn puts_the_related_folders_first() {
        let all = paths(&["skills/zeta/SKILL.md", "skills/react-best-practices/SKILL.md", "a/SKILL.md", "docs/readme.md"]);
        let dirs = candidate_dirs(&all, "vercel-react-best-practices");
        assert_eq!(dirs, ["skills/react-best-practices", "skills/zeta", "a"]);
    }
}
