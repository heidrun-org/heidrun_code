//! The cache of the lists of files and of the SKILL.md texts, in memory and in the cache folder.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use super::types::RepositoryFile;

/// How long the list of the files of a repository is used without asking GitHub again: GitHub allows only 60 such
/// calls per hour.
pub(super) const FILE_LIST_TTL: Duration = Duration::from_secs(3600);
/// How long a list is kept on the disk, to be used when GitHub refuses a new call.
pub(super) const FILE_LIST_KEPT: Duration = Duration::from_secs(30 * 24 * 3600);

/// The list of the files of a repository, as kept in memory and in a file of the cache folder.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub(super) struct FileListEntry {
    /// When GitHub gave the list, in seconds since 1970.
    pub(super) fetched_at: u64,
    /// The immutable revision of the file list, when the lookup resolved one.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(super) revision: Option<String>,
    pub(super) files: Vec<RepositoryFile>,
}

pub(super) fn now_seconds() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

/// The folder of the cache on the disk: `~/Library/Caches/heidrun/skills` on macOS.
pub(super) fn cache_folder() -> PathBuf {
    dirs::cache_dir().unwrap_or_else(std::env::temp_dir).join("heidrun").join("skills")
}

/// The file of the cache for a repository: `owner/repository` is written `owner__repository.json`.
pub(super) fn cache_file(folder: &Path, source: &str) -> PathBuf {
    folder.join(format!("{}.json", source.replace('/', "__")))
}

pub(super) fn read_entry(folder: &Path, source: &str) -> Option<FileListEntry> {
    serde_json::from_str(&std::fs::read_to_string(cache_file(folder, source)).ok()?).ok()
}

/// Writes the entry of a repository, and deletes the files of the cache that are older than `FILE_LIST_KEPT`.
pub(super) fn write_entry(folder: &Path, source: &str, entry: &FileListEntry) {
    writeCacheFile(&cache_file(folder, source), entry);
    prune_old(folder);
}

/// Deletes the `.json` files of a cache folder whose `fetched_at` is older than `FILE_LIST_KEPT`, or unreadable.
pub(super) fn prune_old(folder: &Path) {
    let Ok(entries) = std::fs::read_dir(folder) else {
        return;
    };
    for file in entries.flatten() {
        if file.path().extension().is_some_and(|extension| extension == "json") == false {
            continue;
        }
        let fetched_at = std::fs::read_to_string(file.path())
            .ok()
            .and_then(|text| serde_json::from_str::<serde_json::Value>(&text).ok())
            .and_then(|value| value.get("fetched_at").and_then(|moment| moment.as_u64()));
        if fetched_at.map_or(true, |moment| now_seconds().saturating_sub(moment) > FILE_LIST_KEPT.as_secs()) {
            let _ = std::fs::remove_file(file.path());
        }
    }
}

/// True when a moment (seconds since 1970) is not older than `max_age`; with no `max_age`, any moment is good.
pub(super) fn is_recent(fetched_at: u64, max_age: Option<Duration>) -> bool {
    max_age.map_or(true, |age| now_seconds().saturating_sub(fetched_at) <= age.as_secs())
}

/// True when the entry is not older than `max_age`; with no `max_age`, any entry is good.
pub(super) fn is_fresh(entry: &FileListEntry, max_age: Option<Duration>) -> bool {
    is_recent(entry.fetched_at, max_age)
}

/// The text of the `SKILL.md` file of a skill, as kept in a file of the cache folder `texts`.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub(super) struct SkillTextEntry {
    /// When the text was downloaded, in seconds since 1970.
    pub(super) fetched_at: u64,
    /// The folder of the skill in its repository.
    pub(super) dir: String,
    /// The text of the `SKILL.md` file.
    pub(super) text: String,
}

/// The folder of the cache for the `SKILL.md` texts.
pub(super) fn text_cache_folder() -> PathBuf {
    cache_folder().join("texts")
}

/// The file of the cache for a skill: `owner~repository~skill.json`. The character `~` cannot be in a name.
pub(super) fn text_cache_file(folder: &Path, source: &str, skill_id: &str) -> PathBuf {
    folder.join(format!("{}~{skill_id}.json", source.replace('/', "~")))
}

pub(super) fn read_text_entry(folder: &Path, source: &str, skill_id: &str) -> Option<SkillTextEntry> {
    serde_json::from_str(&std::fs::read_to_string(text_cache_file(folder, source, skill_id)).ok()?).ok()
}

/// Writes the text of a skill, and deletes the files of the folder that are older than `FILE_LIST_KEPT`.
pub(super) fn write_text_entry(folder: &Path, source: &str, skill_id: &str, entry: &SkillTextEntry) {
    if std::fs::create_dir_all(folder).is_err() {
        return;
    }
    if let Ok(text) = serde_json::to_string(entry) {
        let _ = std::fs::write(text_cache_file(folder, source, skill_id), text);
    }
    prune_old(folder);
}

/// The answer when the network failed: the kept text, unless the skill is really gone from its repository.
pub(super) fn fallback_to_cached_text(error: String, cached: Option<SkillTextEntry>) -> Result<(String, String), String> {
    match cached {
        Some(entry) if error.starts_with("skills_not_found") == false => Ok((entry.dir, entry.text)),
        _ => Err(error),
    }
}

/// The lists of the files of the repositories already asked, in memory, in front of the cache folder.
pub(super) fn file_list_cache() -> &'static Mutex<HashMap<String, FileListEntry>> {
    static CACHE: OnceLock<Mutex<HashMap<String, FileListEntry>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

/// The cached list of a repository, from memory or from the cache folder: `None` when there is none, or when it is
/// older than `max_age`.
pub(super) fn cached_files(source: &str, max_age: Option<Duration>) -> Option<Vec<RepositoryFile>> {
    cachedFileList(source, max_age).map(|entry| entry.files)
}

/// Returns an eligible cached tree, including its revision when available.
pub(super) fn cachedFileList(source: &str, max_age: Option<Duration>) -> Option<FileListEntry> {
    let mut cache = file_list_cache().lock().unwrap_or_else(|e| e.into_inner());
    if let Some(entry) = cache.get(source).filter(|entry| is_fresh(entry, max_age)) {
        return Some(entry.clone());
    }
    let entry = read_entry(&cache_folder(), source).filter(|entry| is_fresh(entry, max_age))?;
    cache.insert(source.to_string(), entry.clone());
    Some(entry)
}

/// The file paths and content hashes of a complete skill source.
pub(super) type SkillManifest = Vec<(std::path::PathBuf, String)>;

/// Builds the cache path for the exact source, including its folder or pinned revision when supplied.
pub(super) fn manifestPath(
    source: &str,
    skillId: &str,
    folderUrl: Option<&str>,
    folderPath: Option<&str>,
) -> PathBuf {
    use sha2::{Digest, Sha256};
    let identity = serde_json::to_vec(&(source, skillId, folderUrl, folderPath))
        .expect("a tuple of strings can be serialized");
    cache_folder().join("manifests").join(format!("{:x}.json", Sha256::digest(identity)))
}

/// Returns the cached manifest regardless of age. A partial or unreadable cache entry is ignored.
pub(super) fn readManifest(cachePath: &Path) -> Option<SkillManifest> {
    serde_json::from_reader(std::fs::File::open(cachePath).ok()?).ok()
}

/// Atomically saves a complete manifest. A full or unavailable cache does not prevent a live comparison.
pub(super) fn writeManifest(cachePath: &Path, manifest: &SkillManifest) {
    writeCacheFile(cachePath, manifest);
}

/// Writes a complete cache entry before making it visible to another process.
fn writeCacheFile(cachePath: &Path, entry: &impl Serialize) {
    let Some(folder) = cachePath.parent() else {
        return;
    };
    if std::fs::create_dir_all(folder).is_err() {
        return;
    }
    let Ok(mut staging) = tempfile::NamedTempFile::new_in(folder) else {
        return;
    };
    if serde_json::to_writer(staging.as_file_mut(), entry).is_ok() {
        let _ = staging.persist(cachePath);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::skills::testSupport::*;

    #[test]
    fn writes_and_reads_the_list_of_a_repository_in_the_cache_folder() {
        let folder = temp_folder("cache");
        let entry = FileListEntry { fetched_at: now_seconds(), revision: None, files: vec![RepositoryFile { path: "a/SKILL.md".into(), size: 1 }] };
        assert_eq!(read_entry(&folder, "owner/repository"), None);
        write_entry(&folder, "owner/repository", &entry);
        assert!(folder.join("owner__repository.json").exists());
        assert_eq!(read_entry(&folder, "owner/repository"), Some(entry));
        let _ = std::fs::remove_dir_all(&folder);
    }

    #[test]
    fn tells_a_fresh_list_from_an_old_one() {
        let now = now_seconds();
        let fresh = FileListEntry { fetched_at: now - 60, revision: None, files: Vec::new() };
        let old = FileListEntry { fetched_at: now - 7200, revision: None, files: Vec::new() };
        assert!(is_fresh(&fresh, Some(FILE_LIST_TTL)));
        assert!(is_fresh(&old, Some(FILE_LIST_TTL)) == false);
        // An old list is still good when GitHub refuses a new call.
        assert!(is_fresh(&old, None));
    }

    fn text_entry(age: u64) -> SkillTextEntry {
        SkillTextEntry { fetched_at: now_seconds() - age, dir: "skills/pdf".into(), text: "# PDF".into() }
    }

    #[test]
    fn writes_and_reads_the_text_of_a_skill_in_the_cache_folder() {
        let folder = temp_folder("texts");
        assert_eq!(read_text_entry(&folder, "anthropics/skills", "pdf"), None);
        let entry = text_entry(0);
        write_text_entry(&folder, "anthropics/skills", "pdf", &entry);
        assert!(folder.join("anthropics~skills~pdf.json").exists());
        assert_eq!(read_text_entry(&folder, "anthropics/skills", "pdf"), Some(entry));
        assert_eq!(read_text_entry(&folder, "anthropics/skills", "docx"), None);
        let _ = std::fs::remove_dir_all(&folder);
    }

    #[test]
    fn deletes_the_texts_older_than_thirty_days_when_it_writes() {
        let folder = temp_folder("texts-prune");
        let day = 24 * 3600;
        write_text_entry(&folder, "a/b", "old", &text_entry(31 * day));
        write_text_entry(&folder, "a/b", "recent", &text_entry(29 * day));
        write_text_entry(&folder, "a/b", "new", &text_entry(0));
        assert!(folder.join("a~b~old.json").exists() == false);
        assert!(folder.join("a~b~recent.json").exists());
        assert!(folder.join("a~b~new.json").exists());
        let _ = std::fs::remove_dir_all(&folder);
    }

    #[test]
    fn uses_the_kept_text_when_the_network_fails_but_not_when_the_skill_is_gone() {
        let kept = Some(text_entry(7200));
        assert_eq!(fallback_to_cached_text("skills_github_rate_limit".into(), kept.clone()), Ok(("skills/pdf".into(), "# PDF".into())));
        assert_eq!(fallback_to_cached_text("skills_download_failed: timeout".into(), kept.clone()), Ok(("skills/pdf".into(), "# PDF".into())));
        assert_eq!(fallback_to_cached_text("skills_not_found: a/b pdf".into(), kept), Err("skills_not_found: a/b pdf".into()));
        assert_eq!(fallback_to_cached_text("skills_download_failed: timeout".into(), None), Err("skills_download_failed: timeout".into()));
    }

    #[test]
    fn deletes_the_lists_older_than_thirty_days_when_it_writes() {
        let folder = temp_folder("prune");
        let day = 24 * 3600;
        write_entry(&folder, "old/repository", &FileListEntry { fetched_at: now_seconds() - 31 * day, revision: None, files: Vec::new() });
        write_entry(&folder, "recent/repository", &FileListEntry { fetched_at: now_seconds() - 29 * day, revision: None, files: Vec::new() });
        write_entry(&folder, "new/repository", &FileListEntry { fetched_at: now_seconds(), revision: None, files: Vec::new() });
        assert!(folder.join("old__repository.json").exists() == false);
        assert!(folder.join("recent__repository.json").exists());
        assert!(folder.join("new__repository.json").exists());
        let _ = std::fs::remove_dir_all(&folder);
    }

    #[test]
    fn keeps_a_list_in_memory_in_front_of_the_cache_folder() {
        let source = "test-owner/memory-test";
        let files = vec![RepositoryFile { path: "a/SKILL.md".into(), size: 1 }];
        let old = FileListEntry { fetched_at: now_seconds() - 7200, revision: None, files: files.clone() };
        file_list_cache().lock().unwrap().insert(source.into(), old);
        assert_eq!(cached_files(source, Some(FILE_LIST_TTL)), None);
        assert_eq!(cached_files(source, None), Some(files));
    }
}
