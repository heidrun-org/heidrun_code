//! The lookup of a skill folder on GitLab: the text of its `SKILL.md` file and the list of its files, from the REST API of
//! gitlab.com. Only public projects are read, with no sign-in. GitLab answers 404 for a private project, as for a project or
//! a folder that does not exist.

use serde::Deserialize;
use super::folderAddress::FolderAddress;
use super::github::folder_not_found;
use super::repositoryPaths::encode_path;
use super::types::RepositoryFile;

/// The web address of gitlab.com. The tests give the address of a fake server instead.
pub(super) const GITLAB_BASE: &str = "https://gitlab.com";

/// How many entries GitLab gives in one page of a list. 100 is the largest page.
const PAGE_SIZE: usize = 100;

/// How many pages of a list are read at most, so that a server that never ends a list cannot keep the window busy.
const MAX_PAGES: usize = 10;

/// An entry of the list of a GitLab folder.
#[derive(Deserialize)]
struct TreeEntry {
    /// The path of the entry from the root of the repository.
    path: String,
    /// "blob" for a file, "tree" for a folder.
    #[serde(rename = "type")]
    kind: String,
}

/// The files below a skill folder on GitLab, and where the folder is.
#[derive(Debug, PartialEq)]
pub(super) struct GitlabFolder {
    /// The branch, as GitLab knows it. It can hold slashes.
    pub(super) branch: String,
    /// The path of the skill folder in the repository.
    pub(super) path: String,
    /// The files below the folder, each with its path inside the folder. GitLab gives no size in a list.
    pub(super) files: Vec<RepositoryFile>,
}

/// A text for a part of a URL: every byte that is not a letter, a digit, or one of `-_.~` becomes `%XX`, the slash too.
fn encode_component(text: &str) -> String {
    encode_path(text).replace('/', "%2F")
}

/// The address of a project in the API.
fn project_url(base: &str, source: &str) -> String {
    format!("{base}/api/v4/projects/{}", encode_component(source))
}

/// The address of the content of a file in the API. `file_path` is the path from the root of the repository.
pub(super) fn gitlab_file_url(base: &str, source: &str, file_path: &str, branch: &str) -> String {
    format!("{}/repository/files/{}/raw?ref={}", project_url(base, source), encode_component(file_path), encode_component(branch))
}

/// True for the answers with which GitLab says that it has no such public project, branch, or folder.
fn is_missing(status: u16) -> bool {
    status == 404 || status == 401
}

/// Downloads the `SKILL.md` text of the folder of an address. The address does not say where the branch ends, so the
/// shortest branch is tried first, then each longer one, until GitLab has the file. The error is
/// `skills_folder_not_found: <folder>` when no branch has it, which is also what GitLab says for a private project.
pub(super) async fn fetch_gitlab_folder_text(client: &reqwest::Client, base: &str, address: &FolderAddress) -> Result<String, String> {
    for branch_length in address.branch_lengths() {
        let (branch, path) = address.split(branch_length);
        let url = gitlab_file_url(base, &address.source, &format!("{path}/SKILL.md"), &branch);
        let response = client.get(&url).send().await.map_err(|e| format!("skills_download_failed: {e}"))?;
        let status = response.status().as_u16();
        if is_missing(status) {
            continue;
        }
        if response.status().is_success() == false {
            return Err(format!("skills_download_failed: HTTP {status}"));
        }
        return response.text().await.map_err(|e| format!("skills_download_failed: {e}"));
    }
    Err(folder_not_found(address))
}

/// All the files below the folder of an address, with the branch that GitLab knows. The shortest branch is tried first,
/// then each longer one, until GitLab knows the folder. More than `max_files` files is the error `skills_too_many_files`.
pub(super) async fn list_gitlab_folder_files(
    client: &reqwest::Client,
    base: &str,
    address: &FolderAddress,
    max_files: usize,
) -> Result<GitlabFolder, String> {
    for branch_length in address.branch_lengths() {
        let (branch, path) = address.split(branch_length);
        if let Some(files) = fetch_gitlab_folder_files(client, base, &address.source, &branch, &path, max_files).await? {
            return Ok(GitlabFolder { branch, path, files });
        }
    }
    Err(folder_not_found(address))
}

/// The files below `path` on `branch`, page after page, or `None` when GitLab does not know this branch with this folder.
async fn fetch_gitlab_folder_files(
    client: &reqwest::Client,
    base: &str,
    source: &str,
    branch: &str,
    path: &str,
    max_files: usize,
) -> Result<Option<Vec<RepositoryFile>>, String> {
    let folder_prefix = format!("{path}/");
    let mut files = Vec::new();
    for page in 1..=MAX_PAGES {
        let url = format!(
            "{}/repository/tree?ref={}&path={}&recursive=true&per_page={PAGE_SIZE}&page={page}",
            project_url(base, source),
            encode_component(branch),
            encode_component(path),
        );
        let response = client.get(&url).send().await.map_err(|e| format!("skills_download_failed: {e}"))?;
        let status = response.status().as_u16();
        if is_missing(status) {
            return Ok(None);
        }
        if response.status().is_success() == false {
            return Err(format!("skills_download_failed: HTTP {status}"));
        }
        let has_next_page = response.headers().get("x-next-page").and_then(|value| value.to_str().ok()).is_some_and(|value| value.trim().is_empty() == false);
        let entries: Vec<TreeEntry> = response.json().await.map_err(|e| format!("skills_download_failed: {e}"))?;
        for entry in entries.into_iter().filter(|entry| entry.kind == "blob") {
            if let Some(relative) = entry.path.strip_prefix(&folder_prefix) {
                files.push(RepositoryFile { path: relative.to_string(), size: 0 });
            }
        }
        if files.len() > max_files {
            return Err("skills_too_many_files".into());
        }
        if has_next_page == false {
            return Ok(Some(files));
        }
    }
    Err("skills_too_many_files".into())
}

/// The immutable GitLab commit returned for a repository reference.
#[derive(Deserialize)]
struct GitLabRevision {
	/// The full commit identifier.
	id: String,
}

/// Resolves a GitLab folder and lists its files against the same immutable commit.
pub(super) async fn pinnedGitLabFolder(
	client: &reqwest::Client, base: &str, address: &FolderAddress, maxFiles: usize,
) -> Result<GitlabFolder, String> {
	for branchLength in address.branch_lengths() {
		let (reference, path) = address.split(branchLength);
		let url = format!("{}/repository/commits/{}", project_url(base, &address.source), encode_component(&reference));
		let response = client.get(&url).send().await.map_err(|error| format!("skills_download_failed: {error}"))?;
		let status = response.status().as_u16();
		if is_missing(status) {
			continue;
		}
		if status != 200 {
			return Err(format!("skills_download_failed: HTTP {status}"));
		}
		let revision: GitLabRevision = response.json().await.map_err(|error| format!("skills_download_failed: {error}"))?;
		let branch = revision.id;
		if let Some(files) = fetch_gitlab_folder_files(client, base, &address.source, &branch, &path, maxFiles).await? {
			if files.iter().any(|file| file.path == "SKILL.md") {
				return Ok(GitlabFolder { branch, path, files });
			}
		}
	}
	Err(folder_not_found(address))
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::super::folderAddress::parse_folder_address;
    use crate::skills::testSupport::*;

    #[tokio::test]
    async fn pinnedFolderUsesTheResolvedRevisionForEveryPage() {
        let server = fake_server(|target| {
            if target.ends_with("/repository/commits/main") {
                return FakeResponse::ok(r#"{"id":"immutable-revision"}"#);
            }
            if target.contains("ref=immutable-revision") && target.ends_with("&page=1") {
                return FakeResponse::ok(r#"[{"path":"pdf/SKILL.md","type":"blob"}]"#).with_header("x-next-page", "2");
            }
            if target.contains("ref=immutable-revision") && target.ends_with("&page=2") {
                return FakeResponse::ok(r#"[{"path":"pdf/extra.txt","type":"blob"}]"#);
            }
            FakeResponse::status(404)
        }).await;
        let client = reqwest::Client::new();
        let folder = pinnedGitLabFolder(&client, &server.base, &address("https://gitlab.com/acme/tools/-/tree/main/pdf"), 10)
            .await.unwrap();
        assert_eq!(folder.branch, "immutable-revision");
        assert_eq!(folder.files.iter().map(|file| file.path.as_str()).collect::<Vec<_>>(), ["SKILL.md", "extra.txt"]);
        assert_eq!(server.requests().len(), 3);
    }

    fn address(text: &str) -> FolderAddress {
        parse_folder_address(text).unwrap()
    }

    fn client() -> reqwest::Client {
        reqwest::Client::new()
    }

    #[test]
    fn writes_the_address_of_a_file_in_the_api() {
        assert_eq!(
            gitlab_file_url("https://gitlab.com", "acme/team/tools", "skills/my skill/SKILL.md", "feature/x"),
            "https://gitlab.com/api/v4/projects/acme%2Fteam%2Ftools/repository/files/skills%2Fmy%20skill%2FSKILL.md/raw?ref=feature%2Fx"
        );
    }

    #[tokio::test]
    async fn reads_the_skill_text_of_a_folder() {
        let server = fake_server(|request| match request {
            "/api/v4/projects/acme%2Fskills/repository/files/skills%2Fpdf%2FSKILL.md/raw?ref=main" => FakeResponse::ok("---\nname: pdf\n---\n# pdf"),
            _ => FakeResponse::status(404),
        })
        .await;
        let text = fetch_gitlab_folder_text(&client(), &server.base, &address("https://gitlab.com/acme/skills/-/tree/main/skills/pdf")).await.unwrap();
        assert_eq!(text, "---\nname: pdf\n---\n# pdf");
    }

    #[tokio::test]
    async fn tries_a_longer_branch_when_the_shortest_one_is_not_known() {
        let server = fake_server(|request| match request {
            "/api/v4/projects/acme%2Fskills/repository/files/doc-skills%2Fpdf%2FSKILL.md/raw?ref=feature" => FakeResponse::status(404),
            "/api/v4/projects/acme%2Fskills/repository/files/pdf%2FSKILL.md/raw?ref=feature%2Fdoc-skills" => FakeResponse::ok("# pdf"),
            _ => FakeResponse::status(404),
        })
        .await;
        let text = fetch_gitlab_folder_text(&client(), &server.base, &address("https://gitlab.com/acme/skills/-/tree/feature/doc-skills/pdf")).await.unwrap();
        assert_eq!(text, "# pdf");
        assert_eq!(server.requests().len(), 2);
    }

    #[tokio::test]
    async fn says_that_the_folder_was_not_found_for_a_missing_or_private_project() {
        let server = fake_server(|_| FakeResponse::status(404)).await;
        let missing = fetch_gitlab_folder_text(&client(), &server.base, &address("https://gitlab.com/acme/skills/-/tree/main/skills/pdf")).await;
        assert_eq!(missing.unwrap_err(), "skills_folder_not_found: acme/skills/main/skills/pdf");
        let files = list_gitlab_folder_files(&client(), &server.base, &address("https://gitlab.com/acme/skills/-/tree/main/skills/pdf"), 200).await;
        assert_eq!(files.unwrap_err(), "skills_folder_not_found: acme/skills/main/skills/pdf");
    }

    #[tokio::test]
    async fn gives_another_status_as_a_failed_download() {
        let server = fake_server(|_| FakeResponse::status(500)).await;
        let failed = fetch_gitlab_folder_text(&client(), &server.base, &address("https://gitlab.com/acme/skills/-/tree/main/skills/pdf")).await;
        assert_eq!(failed.unwrap_err(), "skills_download_failed: HTTP 500");
    }

    fn entry(path: &str, kind: &str) -> String {
        format!(r#"{{"id":"x","name":"x","type":"{kind}","path":"{path}","mode":"100644"}}"#)
    }

    #[tokio::test]
    async fn lists_the_files_below_the_folder_over_several_pages() {
        let server = fake_server(|request| {
            let base = "/api/v4/projects/acme%2Fskills/repository/tree?ref=main&path=skills%2Fpdf&recursive=true&per_page=100";
            if request == format!("{base}&page=1") {
                let body = format!("[{},{},{}]", entry("skills/pdf/SKILL.md", "blob"), entry("skills/pdf/scripts", "tree"), entry("skills/pdf/scripts/a.py", "blob"));
                return FakeResponse::ok(&body).with_header("x-next-page", "2");
            }
            if request == format!("{base}&page=2") {
                return FakeResponse::ok(&format!("[{}]", entry("skills/pdf/forms/b.md", "blob"))).with_header("x-next-page", "");
            }
            FakeResponse::status(404)
        })
        .await;
        let folder = list_gitlab_folder_files(&client(), &server.base, &address("https://gitlab.com/acme/skills/-/tree/main/skills/pdf"), 200).await.unwrap();
        assert_eq!(folder.branch, "main");
        assert_eq!(folder.path, "skills/pdf");
        let paths: Vec<&str> = folder.files.iter().map(|file| file.path.as_str()).collect();
        assert_eq!(paths, ["SKILL.md", "scripts/a.py", "forms/b.md"]);
    }

    #[tokio::test]
    async fn refuses_a_folder_with_more_files_than_the_limit() {
        let body = format!("[{},{},{}]", entry("skills/pdf/a", "blob"), entry("skills/pdf/b", "blob"), entry("skills/pdf/c", "blob"));
        let server = fake_server(move |_| FakeResponse::ok(&body)).await;
        let too_many = list_gitlab_folder_files(&client(), &server.base, &address("https://gitlab.com/acme/skills/-/tree/main/skills/pdf"), 2).await;
        assert_eq!(too_many.unwrap_err(), "skills_too_many_files");
    }
}
