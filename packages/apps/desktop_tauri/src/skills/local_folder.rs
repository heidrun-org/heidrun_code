//! A skill folder on this computer: the check of the folder, and the copy of its files. Nothing here uses the network.

use std::path::{Path, PathBuf};
use super::types::{ORIGIN_FILE, is_valid_name};

/// A skill folder on this computer, checked.
#[derive(Debug, PartialEq)]
pub(super) struct LocalSkill {
    /// The folder, as the developer gave it.
    pub(super) folder: PathBuf,
    /// The folder name of the skill: the last part of the path.
    pub(super) name: String,
    /// The text of the file `SKILL.md` of the folder.
    pub(super) text: String,
}

/// Checks that `path` is the full path of a folder with a file `SKILL.md`, and reads that file. The errors are
/// `skills_invalid_path: <path>` (not a full path), `skills_invalid_name: <name>` (a folder name that a skill cannot have),
/// `skills_local_folder_not_found: <path>`, and `skills_local_folder_no_skill_file: <path>`.
pub(super) fn read_local_skill(path: &str) -> Result<LocalSkill, String> {
    let trimmed = path.trim();
    let folder = PathBuf::from(trimmed);
    let Some(name) = folder.file_name().and_then(|name| name.to_str()).map(str::to_string) else {
        return Err(format!("skills_invalid_path: {trimmed}"));
    };
    if folder.is_absolute() == false {
        return Err(format!("skills_invalid_path: {trimmed}"));
    }
    if is_valid_name(&name) == false {
        return Err(format!("skills_invalid_name: {name}"));
    }
    if folder.is_dir() == false {
        return Err(format!("skills_local_folder_not_found: {trimmed}"));
    }
    let text = std::fs::read_to_string(folder.join("SKILL.md")).map_err(|_| format!("skills_local_folder_no_skill_file: {trimmed}"))?;
    Ok(LocalSkill { folder, name, text })
}

/// Finds the skill folders at `path`, the full path of a folder: the folder itself when it holds a file `SKILL.md`,
/// otherwise each direct subfolder that holds one, sorted by path. A link and a hidden folder are not read. The errors
/// are those of `read_local_skill`, and a folder with no skill at all is `skills_local_folder_no_skill: <path>`.
pub(super) fn find_local_skills(path: &str) -> Result<Vec<PathBuf>, String> {
    let trimmed = path.trim();
    let folder = PathBuf::from(trimmed);
    if folder.is_absolute() == false || folder.file_name().is_none() {
        return Err(format!("skills_invalid_path: {trimmed}"));
    }
    if folder.is_dir() == false {
        return Err(format!("skills_local_folder_not_found: {trimmed}"));
    }
    if folder.join("SKILL.md").is_file() {
        return read_local_skill(trimmed).map(|skill| vec![skill.folder]);
    }
    let entries = std::fs::read_dir(&folder).map_err(|_| format!("skills_local_folder_not_found: {trimmed}"))?;
    let mut skills: Vec<PathBuf> = Vec::new();
    for entry in entries.flatten() {
        let is_folder = entry.file_type().is_ok_and(|file_type| file_type.is_dir());
        let has_valid_name = entry.file_name().to_str().is_some_and(is_valid_name);
        if is_folder && has_valid_name && entry.path().join("SKILL.md").is_file() {
            skills.push(entry.path());
        }
    }
    skills.sort();
    if skills.is_empty() {
        return Err(format!("skills_local_folder_no_skill: {trimmed}"));
    }
    Ok(skills)
}

/// Copies the files below `source` into the folder `staging`, with the folders between them. The folder `.git`, the file
/// `.heidrun_origin.json` at the top, the symbolic links, and the files larger than `max_file_bytes` are not copied. More
/// than `max_files` files is the error `skills_too_many_files`. The other errors are `skills_install_failed: <details>`.
pub(super) fn copy_local_folder(source: &Path, staging: &Path, max_files: usize, max_file_bytes: u64) -> Result<(), String> {
    let failed = |error: std::io::Error| format!("skills_install_failed: {error}");
    let mut folders = vec![PathBuf::new()];
    let mut file_count = 0;
    while let Some(relative_folder) = folders.pop() {
        std::fs::create_dir_all(staging.join(&relative_folder)).map_err(failed)?;
        for entry in std::fs::read_dir(source.join(&relative_folder)).map_err(failed)? {
            let entry = entry.map_err(failed)?;
            let file_type = entry.file_type().map_err(failed)?;
            let file_name = entry.file_name();
            let relative = relative_folder.join(&file_name);
            if file_type.is_symlink() {
                continue;
            }
            if file_type.is_dir() {
                if file_name != ".git" {
                    folders.push(relative);
                }
                continue;
            }
            let is_origin_file = relative_folder.as_os_str().is_empty() && file_name == ORIGIN_FILE;
            if is_origin_file || entry.metadata().map_err(failed)?.len() > max_file_bytes {
                continue;
            }
            file_count += 1;
            if file_count > max_files {
                return Err("skills_too_many_files".into());
            }
            std::fs::copy(entry.path(), staging.join(&relative)).map_err(failed)?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::skills::test_support::*;

    #[test]
    fn reads_the_name_and_the_text_of_a_skill_folder() {
        let parent = temp_folder("local-read");
        let folder = write_skill_folder(&parent, "pdf", "---\nname: pdf\n---\n# pdf");
        let skill = read_local_skill(&format!("  {}/  ", folder.display())).unwrap();
        assert_eq!(skill.name, "pdf");
        assert_eq!(skill.text, "---\nname: pdf\n---\n# pdf");
        assert_eq!(skill.folder, folder);
        let _ = std::fs::remove_dir_all(&parent);
    }

    #[test]
    fn refuses_a_path_that_is_not_a_full_path() {
        for path in ["", "   ", "pdf", "./skills/pdf", "~/skills/pdf", "/", "/skills/.."] {
            assert_eq!(read_local_skill(path), Err(format!("skills_invalid_path: {}", path.trim())), "{path}");
        }
    }

    #[test]
    fn refuses_a_folder_name_that_a_skill_cannot_have() {
        let parent = temp_folder("local-name");
        for name in ["my skill", ".hidden"] {
            let folder = write_skill_folder(&parent, name, "# x");
            assert_eq!(read_local_skill(&folder.display().to_string()), Err(format!("skills_invalid_name: {name}")), "{name}");
        }
        let _ = std::fs::remove_dir_all(&parent);
    }

    #[test]
    fn says_that_the_folder_is_missing_or_has_no_skill_file() {
        let parent = temp_folder("local-missing");
        let missing = parent.join("nothing");
        assert_eq!(read_local_skill(&missing.display().to_string()), Err(format!("skills_local_folder_not_found: {}", missing.display())));
        let file = parent.join("a-file");
        std::fs::write(&file, "x").unwrap();
        assert_eq!(read_local_skill(&file.display().to_string()), Err(format!("skills_local_folder_not_found: {}", file.display())));
        let empty = parent.join("empty");
        std::fs::create_dir_all(&empty).unwrap();
        assert_eq!(read_local_skill(&empty.display().to_string()), Err(format!("skills_local_folder_no_skill_file: {}", empty.display())));
        let _ = std::fs::remove_dir_all(&parent);
    }

    #[test]
    fn finds_the_folder_itself_when_it_holds_a_skill_file() {
        let parent = temp_folder("local-find-itself");
        let folder = write_skill_folder(&parent, "pdf", "# pdf");
        write_skill_folder(&folder, "nested", "# nested");
        assert_eq!(find_local_skills(&format!("  {}  ", folder.display())), Ok(vec![folder]));
        let _ = std::fs::remove_dir_all(&parent);
    }

    #[test]
    fn finds_every_subfolder_with_a_skill_file_sorted() {
        let parent = temp_folder("local-find-many");
        let pdf = write_skill_folder(&parent, "pdf", "# pdf");
        let docx = write_skill_folder(&parent, "docx", "# docx");
        write_skill_folder(&parent, ".hidden", "# hidden");
        write_skill_folder(&parent, "my skill", "# spaces");
        std::fs::create_dir_all(parent.join("notes")).unwrap();
        std::fs::write(parent.join("notes/readme.md"), "x").unwrap();
        std::fs::write(parent.join("a-file"), "x").unwrap();
        let deeper = parent.join("group");
        write_skill_folder(&deeper, "inner", "# inner");
        assert_eq!(find_local_skills(&parent.display().to_string()), Ok(vec![docx, pdf]));
        let _ = std::fs::remove_dir_all(&parent);
    }

    #[test]
    fn does_not_follow_a_link_to_a_skill_folder() {
        let parent = temp_folder("local-find-link");
        let elsewhere = temp_folder("local-find-link-target");
        let target = write_skill_folder(&elsewhere, "pdf", "# pdf");
        std::os::unix::fs::symlink(&target, parent.join("linked")).unwrap();
        let kept = write_skill_folder(&parent, "kept", "# kept");
        assert_eq!(find_local_skills(&parent.display().to_string()), Ok(vec![kept]));
        let _ = std::fs::remove_dir_all(&parent);
        let _ = std::fs::remove_dir_all(&elsewhere);
    }

    #[test]
    fn says_that_a_folder_has_no_skill_in_it_or_in_its_subfolders() {
        let parent = temp_folder("local-find-none");
        std::fs::create_dir_all(parent.join("notes")).unwrap();
        let path = parent.display().to_string();
        assert_eq!(find_local_skills(&path), Err(format!("skills_local_folder_no_skill: {path}")));
        let missing = parent.join("nothing").display().to_string();
        assert_eq!(find_local_skills(&missing), Err(format!("skills_local_folder_not_found: {missing}")));
        for bad in ["", "pdf", "./skills", "/"] {
            assert_eq!(find_local_skills(bad), Err(format!("skills_invalid_path: {bad}")), "{bad}");
        }
        let _ = std::fs::remove_dir_all(&parent);
    }

    #[test]
    fn copies_every_file_below_the_folder() {
        let parent = temp_folder("local-copy");
        let folder = write_skill_folder(&parent, "pdf", "# pdf");
        std::fs::create_dir_all(folder.join("scripts/deep")).unwrap();
        std::fs::write(folder.join("scripts/a.py"), "print(1)").unwrap();
        std::fs::write(folder.join("scripts/deep/b.md"), "# b").unwrap();
        let staging = parent.join("staging");
        copy_local_folder(&folder, &staging, 200, 2_000_000).unwrap();
        assert_eq!(std::fs::read_to_string(staging.join("SKILL.md")).unwrap(), "# pdf");
        assert_eq!(std::fs::read_to_string(staging.join("scripts/a.py")).unwrap(), "print(1)");
        assert_eq!(std::fs::read_to_string(staging.join("scripts/deep/b.md")).unwrap(), "# b");
        let _ = std::fs::remove_dir_all(&parent);
    }

    #[test]
    fn does_not_copy_the_git_folder_the_origin_file_the_links_and_the_large_files() {
        let parent = temp_folder("local-skip");
        let folder = write_skill_folder(&parent, "pdf", "# pdf");
        std::fs::create_dir_all(folder.join(".git")).unwrap();
        std::fs::write(folder.join(".git/config"), "x").unwrap();
        std::fs::write(folder.join(ORIGIN_FILE), "{}").unwrap();
        std::fs::write(folder.join("big.bin"), vec![0u8; 100]).unwrap();
        std::os::unix::fs::symlink("/etc/hosts", folder.join("link")).unwrap();
        std::fs::create_dir_all(folder.join("docs")).unwrap();
        std::fs::write(folder.join("docs").join(ORIGIN_FILE), "{}").unwrap();
        let staging = parent.join("staging");
        copy_local_folder(&folder, &staging, 200, 50).unwrap();
        assert!(staging.join("SKILL.md").exists());
        assert!(staging.join(".git").exists() == false);
        assert!(staging.join(ORIGIN_FILE).exists() == false);
        assert!(staging.join("big.bin").exists() == false);
        assert!(std::fs::symlink_metadata(staging.join("link")).is_err());
        assert!(staging.join("docs").join(ORIGIN_FILE).exists(), "only the file at the top is the origin file of the skill");
        let _ = std::fs::remove_dir_all(&parent);
    }

    #[test]
    fn refuses_a_folder_with_more_files_than_the_limit() {
        let parent = temp_folder("local-many");
        let folder = write_skill_folder(&parent, "pdf", "# pdf");
        std::fs::write(folder.join("a.md"), "a").unwrap();
        std::fs::write(folder.join("b.md"), "b").unwrap();
        let too_many = copy_local_folder(&folder, &parent.join("staging"), 2, 2_000_000);
        assert_eq!(too_many, Err("skills_too_many_files".into()));
        let _ = std::fs::remove_dir_all(&parent);
    }
}
