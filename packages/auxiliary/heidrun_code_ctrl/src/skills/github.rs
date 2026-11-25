//! The lookup of a skill on GitHub: the list of the files of a repository and the folder of a skill.

use serde::Deserialize;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Duration;
use super::cache::{FILE_LIST_TTL, FileListEntry, SkillTextEntry, cache_folder, cached_files, cachedFileList, fallback_to_cached_text, file_list_cache, is_recent, now_seconds, read_text_entry, text_cache_folder, write_entry, write_text_entry};
use super::folderAddress::FolderAddress;
use super::repositoryPaths::{candidate_dirs, encode_path, pick_skill_dir};
use super::skillText::parse_name;
use super::types::RepositoryFile;

/// The last GitHub API refusal and the time at which requests can resume.
#[allow(non_upper_case_globals)]
static rateLimit: Mutex<Option<(u64, String)>> = Mutex::new(None);

/// How long a read-only comparison may reuse the latest repository tree.
#[allow(non_upper_case_globals)]
const comparisonTreeLifetime: Duration = Duration::from_secs(30);

/// Prevents simultaneous desktop comparisons from fetching the same tree again.
#[allow(non_upper_case_globals)]
static comparisonTreeRefresh: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

/// Repository trees shared by all comparisons in one operation.
#[derive(Default)]
pub struct RepositoryTrees {
	/// The trees already fetched, keyed by repository name and immutable revision.
	trees: HashMap<String, Vec<RepositoryFile>>,
	/// Immutable GitHub references already resolved during this operation.
	revisions: HashMap<(String, String), Option<String>>,
	/// Whether the operation will write skill files and requires a newly fetched tree.
	isUpdate: bool,
}

impl RepositoryTrees {
	/// Creates a tree lookup for a read-only comparison or an update that may write files.
	pub fn new(isUpdate: bool) -> Self {
		Self {
			isUpdate,
			..Self::default()
		}
	}

	/// Resolves a GitHub reference once per operation.
	pub(super) async fn revision(
		&mut self,
		client: &reqwest::Client,
		source: &str,
		reference: &str,
	) -> Result<Option<String>, String> {
		let key = (source.to_string(), reference.to_string());
		if let Some(revision) = self.revisions.get(&key) {
			return Ok(revision.clone());
		}
		let revision = resolveRevision(client, source, reference).await?;
		self.revisions.insert(key, revision.clone());
		Ok(revision)
	}

	/// Resolves the default branch to a revision. A read-only comparison may reuse a recent pinned tree.
	pub(super) async fn headRevision(&mut self, client: &reqwest::Client, source: &str) -> Result<Option<String>, String> {
		let key = (source.to_string(), "HEAD".to_string());
		if let Some(revision) = self.revisions.get(&key) {
			return Ok(revision.clone());
		}

		let cacheKey = format!("{source}@HEAD");
		let _refresh = if self.isUpdate { None } else { Some(comparisonTreeRefresh.lock().await) };
		if self.isUpdate == false {
			if let Some(entry) = cachedFileList(&cacheKey, Some(comparisonTreeLifetime)) {
				if let Some(revision) = entry.revision {
					self.trees.insert(format!("{source}@{revision}"), entry.files);
					self.revisions.insert(key, Some(revision.clone()));
					return Ok(Some(revision));
				}
			}
		}

		let Some(revision) = self.revision(client, source, "HEAD").await? else {
			return Ok(None);
		};
		let files = pinnedRepositoryFiles(self, client, source, &revision).await?;
		storeRepositoryFiles(&cacheKey, Some(revision.clone()), files);
		Ok(Some(revision))
	}
}

/// Returns a readable GitHub rate-limit message, or the original message for other errors.
pub fn readableGitHubError(error: &str) -> String {
	readableGitHubErrorAt(error, now_seconds())
}

/// Formats the retry delay relative to the supplied Unix time.
fn readableGitHubErrorAt(error: &str, now: u64) -> String {
	let Some(details) = error.strip_prefix("skills_github_rate_limit") else {
		return error.to_string();
	};
	let reset = details.strip_prefix(':').and_then(|value| value.trim().parse::<u64>().ok());
	match reset.map(|reset| reset.saturating_sub(now).div_ceil(60)) {
		Some(0) => "GitHub’s request limit was reached. You can retry now.".into(),
		Some(1) => "GitHub’s request limit was reached. Try again in about 1 minute.".into(),
		Some(minutes) => format!("GitHub’s request limit was reached. Try again in about {minutes} minutes."),
		None => "GitHub’s request limit was reached. Try again in a few minutes.".into(),
	}
}

/// Sends a GitHub API request and pauses only when GitHub reports a request limit.
async fn requestGitHubApi(client: &reqwest::Client, url: &str) -> Result<reqwest::Response, String> {
	if let Some((_, error)) = rateLimit.lock().unwrap_or_else(|error| error.into_inner())
		.as_ref().filter(|(reset, _)| *reset > now_seconds())
	{
		return Err(error.clone());
	}
	let response = client.get(url).send().await.map_err(|error| format!("skills_download_failed: {error}"))?;
	let status = response.status().as_u16();
	if matches!(status, 403 | 429) == false {
		return Ok(response);
	}
	let headers = response.headers().clone();
	let now = now_seconds();
	let retryAt = if status == 429 || hasRateLimitHeader(&headers) {
		Some(rateLimitRetryAt(&headers, now))
	} else {
		let error: Option<GitHubApiError> = response.json().await.ok();
		if error.is_some_and(|error| error.message.to_ascii_lowercase().contains("rate limit")) {
			Some(rateLimitRetryAt(&headers, now))
		} else {
			None
		}
	};
	let Some(retryAt) = retryAt else {
		return Err(format!("skills_download_failed: HTTP {status}"));
	};
	let error = format!("skills_github_rate_limit: {retryAt}");
	*rateLimit.lock().unwrap_or_else(|error| error.into_inner()) = Some((retryAt, error.clone()));
	Err(error)
}

/// The message GitHub sends for a request the service rejected.
#[derive(Deserialize)]
struct GitHubApiError {
	/// The server's description of the error.
	message: String,
}

/// Returns whether GitHub sent a retry delay or reported that the primary request quota is exhausted.
fn hasRateLimitHeader(headers: &reqwest::header::HeaderMap) -> bool {
	retryAfterSeconds(headers).is_some() || isQuotaExhausted(headers)
}

/// Returns whether the primary quota has no requests remaining.
fn isQuotaExhausted(headers: &reqwest::header::HeaderMap) -> bool {
	headers.get("x-ratelimit-remaining").is_some_and(|remaining| remaining == "0")
}

/// Returns the retry delay supplied by GitHub, when present.
fn retryAfterSeconds(headers: &reqwest::header::HeaderMap) -> Option<u64> {
	headers.get("retry-after").and_then(|value| value.to_str().ok())?.trim().parse().ok()
}

/// Returns the earliest retry time for a confirmed rate limit.
fn rateLimitRetryAt(headers: &reqwest::header::HeaderMap, now: u64) -> u64 {
	if let Some(delay) = retryAfterSeconds(headers) {
		return now.saturating_add(delay);
	}
	if isQuotaExhausted(headers) {
		if let Some(reset) = headers.get("x-ratelimit-reset")
			.and_then(|value| value.to_str().ok())
			.and_then(|value| value.trim().parse::<u64>().ok())
			.filter(|reset| *reset > now)
		{
			return reset;
		}
	}
	now.saturating_add(60)
}

/// The commit identifier returned by GitHub for a repository reference.
#[derive(Deserialize)]
struct GitHubRevision {
	/// The immutable commit identifier.
	sha: String,
}

/// Resolves a GitHub branch, tag, or commit to an immutable commit identifier.
async fn resolveRevision(client: &reqwest::Client, source: &str, reference: &str) -> Result<Option<String>, String> {
	let encodedReference = encode_path(reference).replace('/', "%2F");
	let url = format!("https://api.github.com/repos/{source}/commits/{encodedReference}");
	let response = requestGitHubApi(client, &url).await?;
	let status = response.status().as_u16();
	if matches!(status, 404 | 422) {
		return Ok(None);
	}
	if status != 200 {
		return Err(format!("skills_download_failed: HTTP {status}"));
	}
	let revision: GitHubRevision = response.json().await.map_err(|error| format!("skills_download_failed: {error}"))?;
	Ok(Some(revision.sha))
}

/// Finds the repository files at one immutable revision and reuses them within the update.
pub(super) async fn pinnedRepositoryFiles<'a>(
	repositoryTrees: &'a mut RepositoryTrees,
	client: &reqwest::Client,
	source: &str,
	revision: &str,
) -> Result<&'a [RepositoryFile], String> {
	let key = format!("{source}@{revision}");
	if repositoryTrees.trees.contains_key(&key) == false {
		let url = format!("https://api.github.com/repos/{source}/git/trees/{revision}?recursive=1");
		let response = requestGitHubApi(client, &url).await?;
		let status = response.status().as_u16();
		if status != 200 {
			return Err(format!("skills_download_failed: HTTP {status}"));
		}
		let tree: TreeResponse = response.json().await.map_err(|error| format!("skills_download_failed: {error}"))?;
		if tree.truncated {
			return Err("skills_too_many_files".into());
		}
		repositoryTrees.trees.insert(key.clone(), files_of_tree(tree));
	}
	Ok(&repositoryTrees.trees[&key])
}

/// Resolves a folder address and lists its files using the same immutable revision.
pub(super) async fn pinnedGitHubFolder(
	repositoryTrees: &mut RepositoryTrees,
	client: &reqwest::Client,
	address: &FolderAddress,
) -> Result<(String, String, Vec<RepositoryFile>), String> {
	for branchLength in address.branch_lengths() {
		let (reference, path) = address.split(branchLength);
		let Some(revision) = repositoryTrees.revision(client, &address.source, &reference).await? else {
			continue;
		};
		if let Some(files) = fetch_folder_files(client, &address.source, &revision, &path).await? {
			if files.iter().any(|file| file.path == "SKILL.md") {
				return Ok((revision, path, files));
			}
		}
	}
	Err(folder_not_found(address))
}

/// How many SKILL.md files of a repository are read to find a skill by its name.
pub(super) const MAX_NAME_LOOKUPS: usize = 60;

/// Folders of a GitHub repository where a skill is looked for, before the root of the repository.
pub(super) const SKILL_PARENTS: [&str; 5] = ["skills", "", ".claude/skills", "skills/.curated", ".agents/skills"];

#[derive(Deserialize)]
pub(super) struct TreeResponse {
    pub(super) tree: Vec<TreeEntry>,
    /// True when GitHub cut the list because the folder holds too many files.
    #[serde(default)]
    pub(super) truncated: bool,
}

#[derive(Deserialize)]
pub(super) struct TreeEntry {
    pub(super) path: String,
    #[serde(rename = "type")]
    pub(super) kind: String,
    pub(super) size: Option<u64>,
}

pub(super) fn http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent(concat!("Heidrun/", env!("CARGO_PKG_VERSION")))
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| format!("skills_http_failed: {e}"))
}

/// Downloads the text of a file of a repository, or `None` when the file does not exist.
pub(super) async fn fetch_text(client: &reqwest::Client, source: &str, path: &str) -> Result<Option<String>, String> {
    fetchTextAtRevision(client, source, "HEAD", path).await
}

/// Reads a text file from GitHub's independent raw file service.
async fn fetchTextAtRevision(
	client: &reqwest::Client, source: &str, revision: &str, path: &str,
) -> Result<Option<String>, String> {
	let url = format!("https://raw.githubusercontent.com/{source}/{revision}/{}", encode_path(path));
	let response = client.get(&url).send().await.map_err(|error| format!("skills_download_failed: {error}"))?;
	let status = response.status().as_u16();
	if status == 404 {
		return Ok(None);
	}
	if response.status().is_success() == false {
		return Err(format!("skills_download_failed: HTTP {status}"));
	}
	response.text().await.map(Some).map_err(|error| format!("skills_download_failed: {error}"))
}

/// All the files of a repository, in one call to GitHub. The answer is kept in memory and on the disk, and used for
/// one hour, because GitHub allows only 60 calls per hour. When GitHub refuses a new call, the older answer is used if there is one, otherwise the error
/// `skills_github_rate_limit: <seconds since 1970 when GitHub accepts requests again>`.
pub(super) async fn list_repository_files(client: &reqwest::Client, source: &str) -> Result<Vec<RepositoryFile>, String> {
    if let Some(files) = cached_files(source, Some(FILE_LIST_TTL)) {
        return Ok(files);
    }
    refreshRepositoryFiles(client, source).await.or_else(|error| cached_files(source, None).ok_or(error))
}

/// Fetches the current list and saves it for subsequent skill reads and installations.
#[allow(non_snake_case)]
pub(super) async fn refreshRepositoryFiles(client: &reqwest::Client, source: &str) -> Result<Vec<RepositoryFile>, String> {
    let files = fetch_repository_files(client, source).await?;
    storeRepositoryFiles(source, None, &files);
    Ok(files)
}

/// Saves a repository tree with the immutable revision used to read it, when that revision is known.
fn storeRepositoryFiles(source: &str, revision: Option<String>, files: &[RepositoryFile]) {
    let entry = FileListEntry {
        fetched_at: now_seconds(),
        revision,
        files: files.to_vec(),
    };
    write_entry(&cache_folder(), source, &entry);
    file_list_cache().lock().unwrap_or_else(|error| error.into_inner()).insert(source.to_string(), entry);
}

pub(super) async fn fetch_repository_files(client: &reqwest::Client, source: &str) -> Result<Vec<RepositoryFile>, String> {
    let url = format!("https://api.github.com/repos/{source}/git/trees/HEAD?recursive=1");
    let response = requestGitHubApi(client, &url).await?;
    let status = response.status().as_u16();
    if status != 200 {
        return Err(format!("skills_download_failed: HTTP {status}"));
    }
    let parsed: TreeResponse = response.json().await.map_err(|e| format!("skills_download_failed: {e}"))?;
    if parsed.truncated {
        return Err("skills_too_many_files".into());
    }
    Ok(files_of_tree(parsed))
}

/// The files (not the folders) of an answer of the GitHub tree call.
pub(super) fn files_of_tree(tree: TreeResponse) -> Vec<RepositoryFile> {
    tree.tree
        .into_iter()
        .filter(|entry| entry.kind == "blob")
        .map(|entry| RepositoryFile { path: entry.path, size: entry.size.unwrap_or(0) })
        .collect()
}

/// Downloads the `SKILL.md` text of the folder of an address. The error is `skills_folder_not_found: <folder>` when
/// GitHub has no such file, which is also what GitHub says for a private repository.
pub(super) async fn fetch_folder_text(client: &reqwest::Client, address: &FolderAddress) -> Result<String, String> {
    let url = format!("https://raw.githubusercontent.com/{}/{}/SKILL.md", address.source, encode_path(&address.reference_and_path()));
    let response = client.get(&url).send().await.map_err(|error| format!("skills_download_failed: {error}"))?;
    let status = response.status().as_u16();
    if status == 404 {
        return Err(folder_not_found(address));
    }
    if response.status().is_success() == false {
        return Err(format!("skills_download_failed: HTTP {status}"));
    }
    response.text().await.map_err(|e| format!("skills_download_failed: {e}"))
}

/// The error for a folder that GitHub does not give.
pub(super) fn folder_not_found(address: &FolderAddress) -> String {
    format!("skills_folder_not_found: {}/{}", address.source, address.reference_and_path())
}

/// All the files below the folder of an address, each with its path inside the folder, in one call to GitHub. The
/// address does not say where the branch ends and the path of the folder starts, so the shortest branch is tried
/// first, then each longer one, until GitHub knows the folder.
pub(super) async fn list_folder_files(client: &reqwest::Client, address: &FolderAddress) -> Result<Vec<RepositoryFile>, String> {
    for branch_length in address.branch_lengths() {
        let (branch, path) = address.split(branch_length);
        if let Some(files) = fetch_folder_files(client, &address.source, &branch, &path).await? {
            return Ok(files);
        }
    }
    Err(folder_not_found(address))
}

/// The files below `path` on `branch`, or `None` when GitHub does not know this branch with this folder.
async fn fetch_folder_files(client: &reqwest::Client, source: &str, branch: &str, path: &str) -> Result<Option<Vec<RepositoryFile>>, String> {
    let url = format!("https://api.github.com/repos/{source}/git/trees/{}:{}?recursive=1", encode_path(branch), encode_path(path));
    let response = requestGitHubApi(client, &url).await?;
    let status = response.status().as_u16();
    if status == 404 || status == 422 {
        return Ok(None);
    }
    if status != 200 {
        return Err(format!("skills_download_failed: HTTP {status}"));
    }
    let parsed: TreeResponse = response.json().await.map_err(|e| format!("skills_download_failed: {e}"))?;
    if parsed.truncated {
        return Err("skills_too_many_files".into());
    }
    Ok(Some(files_of_tree(parsed)))
}

/// Finds the folder of a skill in its repository: the folder and the text of its `SKILL.md` file.
/// The answer is kept in the cache folder and used for one hour. When the network fails, an older answer is used if
/// there is one, so a skill can be read without a network.
pub(super) async fn find_skill(client: &reqwest::Client, source: &str, skill_id: &str) -> Result<(String, String), String> {
    let folder = text_cache_folder();
    let cached = read_text_entry(&folder, source, skill_id);
    if let Some(entry) = &cached {
        if is_recent(entry.fetched_at, Some(FILE_LIST_TTL)) {
            return Ok((entry.dir.clone(), entry.text.clone()));
        }
    }
    refreshSkill(client, source, skill_id).await.or_else(|error| fallback_to_cached_text(error, cached))
}

/// Fetches the current skill text and saves it for subsequent previews and installations.
#[allow(non_snake_case)]
pub(super) async fn refreshSkill(client: &reqwest::Client, source: &str, skillId: &str) -> Result<(String, String), String> {
    let (dir, text) = find_skill_online(client, source, skillId).await?;
    let entry = SkillTextEntry { fetched_at: now_seconds(), dir: dir.clone(), text: text.clone() };
    write_text_entry(&text_cache_folder(), source, skillId, &entry);
    Ok((dir, text))
}

/// Finds the folder of a skill in its repository, on GitHub, with no cache.
/// The usual folders are tried first, with one download each. When none has the skill, the list of the files of the
/// repository gives the folder, at any depth (`skills/productivity/grill-me`). The last way is to read the `name` of
/// the `SKILL.md` files, because the folder of the skill `vercel-react-best-practices` is `react-best-practices`.
pub(super) async fn find_skill_online(client: &reqwest::Client, source: &str, skill_id: &str) -> Result<(String, String), String> {
    for parent in SKILL_PARENTS {
        let dir = if parent.is_empty() { skill_id.to_string() } else { format!("{parent}/{skill_id}") };
        if let Some(text) = fetch_text(client, source, &format!("{dir}/SKILL.md")).await? {
            return Ok((dir, text));
        }
    }
    let paths: Vec<String> = list_repository_files(client, source).await?.into_iter().map(|file| file.path).collect();
    if let Some(dir) = pick_skill_dir(&paths, skill_id) {
        if let Some(text) = fetch_text(client, source, &format!("{dir}/SKILL.md")).await? {
            return Ok((dir, text));
        }
    }
    // The identifier on skills.sh is the `name` of the frontmatter, which can differ from the folder name.
    for dir in candidate_dirs(&paths, skill_id).into_iter().take(MAX_NAME_LOOKUPS) {
        if let Some(text) = fetch_text(client, source, &format!("{dir}/SKILL.md")).await? {
            if parse_name(&text).as_deref() == Some(skill_id) {
                return Ok((dir, text));
            }
        }
    }
    // A repository that is one skill: the file `SKILL.md` is at the root.
    if let Some(text) = fetch_text(client, source, "SKILL.md").await? {
        return Ok((String::new(), text));
    }
    Err(format!("skills_not_found: {source} {skill_id}"))
}

/// Finds the skill using the same lookup order as installation, within one immutable repository revision.
pub(super) async fn findSkillAtRevision(
	client: &reqwest::Client,
	source: &str,
	skillId: &str,
	revision: &str,
	files: &[RepositoryFile],
) -> Result<(String, String), String> {
	let paths: Vec<String> = files.iter().map(|file| file.path.clone()).collect();
	for parent in SKILL_PARENTS {
		let directory = if parent.is_empty() { skillId.to_string() } else { format!("{parent}/{skillId}") };
		let path = format!("{directory}/SKILL.md");
		if paths.contains(&path) {
			return requiredSkillText(client, source, revision, &path).await.map(|text| (directory, text));
		}
	}
	if let Some(directory) = pick_skill_dir(&paths, skillId) {
		let path = format!("{directory}/SKILL.md");
		return requiredSkillText(client, source, revision, &path).await.map(|text| (directory, text));
	}
	for directory in candidate_dirs(&paths, skillId).into_iter().take(MAX_NAME_LOOKUPS) {
		let path = format!("{directory}/SKILL.md");
		let text = requiredSkillText(client, source, revision, &path).await?;
		if parse_name(&text).as_deref() == Some(skillId) {
			return Ok((directory, text));
		}
	}
	if paths.iter().any(|path| path == "SKILL.md") {
		return requiredSkillText(client, source, revision, "SKILL.md").await.map(|text| (String::new(), text));
	}
	Err(format!("skills_not_found: {source} {skillId}"))
}

/// Downloads a skill file required by the pinned repository tree.
async fn requiredSkillText(
	client: &reqwest::Client, source: &str, revision: &str, path: &str,
) -> Result<String, String> {
	fetchTextAtRevision(client, source, revision, path).await?
		.ok_or_else(|| format!("skills_download_failed: {path} is missing from the selected revision"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rateLimitMessagesShowTheRoundedRetryDelay() {
        assert_eq!(
            readableGitHubErrorAt("skills_github_rate_limit: 161", 100),
            "GitHub’s request limit was reached. Try again in about 2 minutes.",
        );
        assert!(readableGitHubErrorAt("skills_github_rate_limit: 101", 100).ends_with("1 minute."));
        assert!(readableGitHubErrorAt("skills_github_rate_limit: 99", 100).ends_with("retry now."));
        assert!(readableGitHubErrorAt("skills_github_rate_limit", 100).ends_with("in a few minutes."));
    }

    #[tokio::test]
    async fn githubPermissionErrorDoesNotPauseOtherRepositoryRequests() {
        use crate::skills::testSupport::{fake_server, FakeResponse};

        let server = fake_server(|target| match target {
            "/forbidden" => FakeResponse::status(403).with_header("x-ratelimit-remaining", "12"),
            "/available" => FakeResponse::ok("{}"),
            _ => FakeResponse::status(404),
        }).await;
        let client = reqwest::Client::new();
        let forbidden = requestGitHubApi(&client, &format!("{}/forbidden", server.base)).await;
        assert_eq!(forbidden.unwrap_err(), "skills_download_failed: HTTP 403");
        let available = requestGitHubApi(&client, &format!("{}/available", server.base)).await.unwrap();
        assert_eq!(available.status().as_u16(), 200);
        assert_eq!(server.requests(), ["/forbidden", "/available"]);
    }

    #[tokio::test]
    async fn githubComparisonReusesTheRevisionAndItsTreeTogether() {
        let source = "heidrun-test/pinned-comparison";
        let revision = "92d7236fea16714f27be1d047975089264866f666";
        let files = vec![RepositoryFile { path: "skills/example/SKILL.md".into(), size: 10 }];
        let cacheKey = format!("{source}@HEAD");
        file_list_cache().lock().unwrap().insert(cacheKey, FileListEntry {
            fetched_at: now_seconds(),
            revision: Some(revision.into()),
            files: files.clone(),
        });

        let client = reqwest::Client::new();
        let mut repositoryTrees = RepositoryTrees::default();
        assert_eq!(repositoryTrees.headRevision(&client, source).await.unwrap().as_deref(), Some(revision));
        assert_eq!(pinnedRepositoryFiles(&mut repositoryTrees, &client, source, revision).await.unwrap(), files);
    }

    #[test]
    fn githubRateLimitHeadersDistinguishPrimaryAndSecondaryLimits() {
        let mut headers = reqwest::header::HeaderMap::new();
        headers.insert("x-ratelimit-reset", "2000".parse().unwrap());
        headers.insert("x-ratelimit-remaining", "15".parse().unwrap());
        assert_eq!(hasRateLimitHeader(&headers), false);
        assert_eq!(rateLimitRetryAt(&headers, 1000), 1060);
        headers.insert("x-ratelimit-remaining", "0".parse().unwrap());
        assert_eq!(hasRateLimitHeader(&headers), true);
        assert_eq!(rateLimitRetryAt(&headers, 1000), 2000);
        headers.insert("retry-after", "60".parse().unwrap());
        assert_eq!(rateLimitRetryAt(&headers, 1000), 1060);
    }

}
