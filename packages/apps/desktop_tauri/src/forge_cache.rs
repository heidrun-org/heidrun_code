//! Forge cache: the answers of the read-only calls of `gh` and `glab`, kept on the disk for a short time.
//!
//! The card of an issue or of a pull request reads the title, the state, and the description from the forge, which takes
//! about a second for each call. An answer is kept in `forge_cache.json`, in the folder of the data of Heidrun Code, for ten
//! minutes. A call with `keep_until_refresh` uses its kept answer, whatever its age, until a refresh asks the forge again:
//! the lists of the Code hosting sidebar section use it, because each call takes points of the GitHub rate limit (issue
//! #870). Every read of an issue or of a pull request in the application goes through this cache. When the forge does not answer (no network, no login), an answer that is at most seven days old is used
//! instead of the failure.

use crate::application_log::{self, ForgeAnswerSource, ForgeCall};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

/// The name of the file of the cache, in the folder of the data of Heidrun Code.
const CACHE_FILE: &str = "forge_cache.json";

/// The version of the content of the cache. A cache with another version is thrown away and made again.
const CACHE_VERSION: u32 = 1;

/// How long an answer is used without a new call to the forge, in milliseconds.
const FRESH_FOR: i64 = 10 * 60_000;

/// How long an answer is kept, and used when the forge fails, in milliseconds.
const KEPT_FOR: i64 = 7 * 24 * 3_600_000;

/// One answer of the forge.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
struct CacheEntry {
    /// When the forge answered, in milliseconds since 1970.
    at: i64,
    /// What the command printed.
    output: String,
}

/// What the file of the cache holds.
#[derive(Serialize, Deserialize, Debug, Default)]
struct CacheContent {
    version: u32,
    /// The answers, by key.
    answers: BTreeMap<String, CacheEntry>,
}

/// The cache of the answers.
struct ForgeCache {
    /// The file of the cache, or `None` for a cache that stays in memory.
    path: Option<PathBuf>,
    content: CacheContent,
    /// True when `content` differs from the file.
    is_dirty: bool,
}

/// The cache of the application. It is opened on the first call.
static CACHE: Mutex<Option<ForgeCache>> = Mutex::new(None);

impl ForgeCache {
    #[cfg(test)]
    fn in_memory() -> Self {
        ForgeCache { path: None, content: CacheContent { version: CACHE_VERSION, ..Default::default() }, is_dirty: false }
    }

    /// Opens the cache in `path`. A missing file, a file that is not valid, and a file with another version give an empty
    /// cache.
    fn open(path: PathBuf) -> Self {
        let content = std::fs::read_to_string(&path)
            .ok()
            .and_then(|text| serde_json::from_str::<CacheContent>(&text).ok())
            .filter(|content| content.version == CACHE_VERSION)
            .unwrap_or_else(|| CacheContent { version: CACHE_VERSION, ..Default::default() });
        ForgeCache { path: Some(path), content, is_dirty: false }
    }

    /// Writes the cache to its file when it changed. The file is written aside then renamed: a crash never leaves half a
    /// file.
    fn save(&mut self) {
        let Some(path) = self.path.as_ref().filter(|_| self.is_dirty) else { return };
        let Ok(text) = serde_json::to_string(&self.content) else { return };
        if let Some(dir) = path.parent() {
            let _ = std::fs::create_dir_all(dir);
        }
        let temporary = path.with_extension("json.tmp");
        if std::fs::write(&temporary, text).is_ok() && std::fs::rename(&temporary, path).is_ok() {
            self.is_dirty = false;
        }
    }

    /// The answer for `key` when it is at most ten minutes old at `now`.
    fn fresh(&self, key: &str, now: i64) -> Option<String> {
        self.content.answers.get(key).filter(|entry| now - entry.at < FRESH_FOR).map(|entry| entry.output.clone())
    }

    /// The answer for `key` that a call uses before it asks the forge: none when `is_refresh` is true, because a refresh
    /// must ask the forge again, the kept answer of any age when `is_kept_until_refresh` is true, and else the fresh answer.
    fn usable(&self, key: &str, now: i64, is_refresh: bool, is_kept_until_refresh: bool) -> Option<String> {
        if is_refresh {
            return None;
        }
        if is_kept_until_refresh {
            return self.kept(key, now);
        }
        self.fresh(key, now)
    }

    /// The answer for `key` when it is at most seven days old at `now`.
    fn kept(&self, key: &str, now: i64) -> Option<String> {
        self.content.answers.get(key).filter(|entry| now - entry.at < KEPT_FOR).map(|entry| entry.output.clone())
    }

    /// Keeps the answer for `key`, and forgets the answers that are older than seven days.
    fn put(&mut self, key: String, output: String, now: i64) {
        self.content.answers.retain(|_, entry| now - entry.at < KEPT_FOR);
        self.content.answers.insert(key, CacheEntry { at: now, output });
        self.is_dirty = true;
    }
}

/// The file of the cache: `forge_cache.json` in the folder of the data of Heidrun Code.
fn cache_path() -> PathBuf {
    crate::app_data::data_dir().join(CACHE_FILE)
}

/// The current time, in milliseconds since 1970.
fn now_ms() -> i64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as i64).unwrap_or(0)
}

/// The key of a call: the root of the repository, the tool, and the arguments. A folder and a worktree of the same
/// repository share their answers.
fn key_of(root: &Path, tool: &str, args: &[String]) -> String {
    format!("{}\n{}\n{}", root.display(), tool, args.join("\u{1f}"))
}

/// Runs `body` on the cache of the application, and opens the cache first when it is not open.
fn with_cache<T>(body: impl FnOnce(&mut ForgeCache) -> T) -> T {
    let mut guard = CACHE.lock().unwrap_or_else(|e| e.into_inner());
    let cache = guard.get_or_insert_with(|| ForgeCache::open(cache_path()));
    body(cache)
}

/// Runs a read-only `glab` / `gh` call (see `crate::git::allowed`), with the answer kept on the disk for ten minutes. A
/// call that fails gives the last answer of the same call when it is at most seven days old. With `refresh` true, the
/// forge is asked again even when a fresh answer exists, and the new answer replaces the kept one. With
/// `keep_until_refresh` true, the kept answer is used whatever its age, and only a refresh asks the forge again. Each call
/// writes one line in the application log, with `caller`, the part of the application that asked (issue #879).
#[tauri::command]
pub async fn forge_cli_cached(
    cwd: String,
    tool: String,
    args: Vec<String>,
    refresh: Option<bool>,
    keep_until_refresh: Option<bool>,
    caller: Option<String>,
) -> Result<String, String> {
    if !crate::git::allowed(&tool, &args) {
        return Err(format!("forge_cli_cached : appel non autorisé ({tool} {})", args.join(" ")));
    }
    let key = key_of(&crate::project::find_root(Path::new(&cwd)), &tool, &args);
    let is_refresh = refresh == Some(true);
    let is_kept_until_refresh = keep_until_refresh == Some(true);
    if let Some(output) = with_cache(|cache| cache.usable(&key, now_ms(), is_refresh, is_kept_until_refresh)) {
        application_log::record_forge_cache_hit(caller.as_deref(), &tool, &args);
        return Ok(output);
    }
    let call = ForgeCall::start(caller.as_deref(), &tool, &args, is_refresh);
    match crate::git::run_forge(&cwd, &tool, &args, 20).await {
        Ok(output) => {
            with_cache(|cache| {
                cache.put(key, output.clone(), now_ms());
                cache.save();
            });
            call.end(ForgeAnswerSource::Forge, None);
            Ok(output)
        }
        Err(failure) => match with_cache(|cache| cache.kept(&key, now_ms())) {
            Some(output) => {
                call.end(ForgeAnswerSource::KeptAfterFailure, Some(&failure));
                Ok(output)
            }
            None => {
                call.end(ForgeAnswerSource::Failed, Some(&failure));
                Err(failure)
            }
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const NOW: i64 = 1_800_000_000_000;

    #[test]
    fn gives_an_answer_that_is_less_than_ten_minutes_old() {
        let mut cache = ForgeCache::in_memory();
        cache.put("a".into(), "{}".into(), NOW);
        assert_eq!(cache.fresh("a", NOW + FRESH_FOR - 1), Some("{}".to_string()));
    }

    #[test]
    fn gives_the_fresh_answer_unless_the_call_is_a_refresh() {
        let mut cache = ForgeCache::in_memory();
        cache.put("a".into(), "{}".into(), NOW);
        assert_eq!(cache.usable("a", NOW, false, false), Some("{}".to_string()));
        assert_eq!(cache.usable("a", NOW, true, false), None);
        assert_eq!(cache.kept("a", NOW), Some("{}".to_string()));
    }

    #[test]
    fn keeps_an_old_answer_until_a_refresh_when_the_call_asks_for_it() {
        let mut cache = ForgeCache::in_memory();
        cache.put("a".into(), "old".into(), NOW);
        let later = NOW + FRESH_FOR * 50;
        assert_eq!(cache.usable("a", later, false, false), None);
        assert_eq!(cache.usable("a", later, false, true), Some("old".to_string()));
        assert_eq!(cache.usable("a", later, true, true), None);
        assert_eq!(cache.usable("a", NOW + KEPT_FOR, false, true), None);
        assert_eq!(cache.usable("b", NOW, false, true), None);
    }

    #[test]
    fn gives_no_fresh_answer_after_ten_minutes_or_for_another_key() {
        let mut cache = ForgeCache::in_memory();
        cache.put("a".into(), "{}".into(), NOW);
        assert_eq!(cache.fresh("a", NOW + FRESH_FOR), None);
        assert_eq!(cache.fresh("b", NOW), None);
    }

    #[test]
    fn keeps_an_old_answer_for_seven_days_for_a_failure_of_the_forge() {
        let mut cache = ForgeCache::in_memory();
        cache.put("a".into(), "old".into(), NOW);
        assert_eq!(cache.kept("a", NOW + KEPT_FOR - 1), Some("old".to_string()));
        assert_eq!(cache.kept("a", NOW + KEPT_FOR), None);
    }

    #[test]
    fn replaces_the_answer_of_a_key_and_forgets_the_answers_older_than_seven_days() {
        let mut cache = ForgeCache::in_memory();
        cache.put("old".into(), "x".into(), NOW);
        cache.put("a".into(), "1".into(), NOW + KEPT_FOR);
        cache.put("a".into(), "2".into(), NOW + KEPT_FOR + 1);
        assert_eq!(cache.content.answers.len(), 1);
        assert_eq!(cache.fresh("a", NOW + KEPT_FOR + 1), Some("2".to_string()));
    }

    #[test]
    fn writes_the_file_and_reads_it_again() {
        let dir = std::env::temp_dir().join(format!("heidrun_forge_cache_{}", std::process::id()));
        let path = dir.join(CACHE_FILE);
        let mut cache = ForgeCache::open(path.clone());
        cache.put("a".into(), "{\"title\":\"x\"}".into(), NOW);
        cache.save();
        assert!(!cache.is_dirty);
        let reopened = ForgeCache::open(path);
        assert_eq!(reopened.fresh("a", NOW), Some("{\"title\":\"x\"}".to_string()));
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn starts_empty_when_the_file_is_not_valid_or_has_another_version() {
        let dir = std::env::temp_dir().join(format!("heidrun_forge_cache_bad_{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join(CACHE_FILE);
        std::fs::write(&path, "not json").unwrap();
        assert!(ForgeCache::open(path.clone()).content.answers.is_empty());
        std::fs::write(&path, "{\"version\":99,\"answers\":{\"a\":{\"at\":1,\"output\":\"x\"}}}").unwrap();
        assert!(ForgeCache::open(path).content.answers.is_empty());
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn gives_the_same_key_for_the_same_call_and_another_key_for_another_argument() {
        let root = Path::new("/work/app");
        let args = vec!["issue".to_string(), "view".to_string(), "250".to_string()];
        assert_eq!(key_of(root, "gh", &args), key_of(root, "gh", &args));
        let other = vec!["issue".to_string(), "view".to_string(), "251".to_string()];
        assert_ne!(key_of(root, "gh", &args), key_of(root, "gh", &other));
        assert_ne!(key_of(root, "gh", &args), key_of(Path::new("/work/other"), "gh", &args));
    }
}
