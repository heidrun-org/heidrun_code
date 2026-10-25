//! The searches of the window Find new skills: on skills.sh, in a folder on this computer, and in a folder on GitHub or GitLab.

use serde::Deserialize;
use super::folder_address::{CodeHost, FolderAddress, parse_folder_address};
use super::github::{http_client, list_folder_files};
use super::gitlab::{GITLAB_BASE, list_gitlab_folder_files};
use super::local_folder::find_local_skills;
use super::repository_paths::{SkillFolders, find_skill_folders};
use super::types::{SearchResult, is_valid_name, is_valid_source};

pub(super) const SEARCH_URL: &str = "https://skills.sh/api/search";

/// How many files of a GitLab folder are read to find its skills. GitLab gives them 100 at a time, at most 10 pages.
const MAX_LISTED_FILES: usize = 1_000;

#[derive(Deserialize)]
pub(super) struct SearchResponse {
    pub(super) skills: Vec<SearchResult>,
}

/// Searches skills.sh. An empty query gives an empty list.
#[tauri::command]
pub async fn skills_search(query: String) -> Result<Vec<SearchResult>, String> {
    let query = query.trim();
    if query.is_empty() {
        return Ok(Vec::new());
    }
    let response = http_client()?
        .get(SEARCH_URL)
        .query(&[("q", query), ("limit", "20")])
        .send()
        .await
        .map_err(|e| format!("skills_search_failed: {e}"))?;
    if !response.status().is_success() {
        return Err(format!("skills_search_failed: HTTP {}", response.status().as_u16()));
    }
    let parsed: SearchResponse = response.json().await.map_err(|e| format!("skills_search_failed: {e}"))?;
    Ok(parsed.skills.into_iter().filter(|s| is_valid_source(&s.source) && is_valid_name(&s.skill_id)).collect())
}

/// Finds the skill folders at a full path on this computer: the folder itself when it holds a file `SKILL.md`, otherwise
/// each direct subfolder that holds one. Gives the full path of each skill folder, sorted. Nothing uses the network.
#[tauri::command]
pub fn skills_find_local_folders(path: String) -> Result<Vec<String>, String> {
    find_local_skills(&path).map(|folders| folders.iter().map(|folder| folder.display().to_string()).collect())
}

/// Finds the skill folders at a GitHub or GitLab web address: the address itself when its folder holds a file `SKILL.md`,
/// otherwise the address of each direct subfolder that holds one, sorted. One call to GitHub, or a few pages of calls to
/// GitLab, lists the files below the folder.
#[tauri::command]
pub async fn skills_find_folders(url: String) -> Result<Vec<String>, String> {
    let address = parse_folder_address(&url)?;
    let client = http_client()?;
    find_folders(&client, GITLAB_BASE, &address).await
}

/// The work of `skills_find_folders`. `gitlab_base` is `https://gitlab.com`, or a fake server in the tests.
async fn find_folders(client: &reqwest::Client, gitlab_base: &str, address: &FolderAddress) -> Result<Vec<String>, String> {
    let listed = match address.host {
        CodeHost::GitHub => list_folder_files(client, address).await,
        CodeHost::GitLab => list_gitlab_folder_files(client, gitlab_base, address, MAX_LISTED_FILES).await.map(|folder| folder.files),
    };
    let files = listed.map_err(|error| {
        if error == "skills_too_many_files" {
            format!("skills_folder_too_large: {}/{}", address.source, address.reference_and_path())
        } else {
            error
        }
    })?;
    match find_skill_folders(&files) {
        SkillFolders::Itself => Ok(vec![address.url()]),
        SkillFolders::Subfolders(names) if names.is_empty() => {
            Err(format!("skills_folder_no_skill: {}/{}", address.source, address.reference_and_path()))
        }
        SkillFolders::Subfolders(names) => Ok(names.iter().map(|name| address.child(name).url()).collect()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::skills::test_support::*;

    #[test]
    fn reads_the_answer_of_the_search() {
        let json = r#"{"query":"pdf","skills":[{"id":"anthropics/skills/pdf","source":"anthropics/skills","skillId":"pdf","name":"pdf","installs":208236}],"count":1}"#;
        let parsed: SearchResponse = serde_json::from_str(json).unwrap();
        assert_eq!(parsed.skills, [SearchResult { source: "anthropics/skills".into(), skill_id: "pdf".into(), name: "pdf".into(), installs: 208236 }]);
    }

    #[test]
    fn finds_the_skills_of_a_local_folder_as_full_paths() {
        let parent = temp_folder("search-local");
        let pdf = write_skill_folder(&parent, "pdf", "# pdf");
        let docx = write_skill_folder(&parent, "docx", "# docx");
        let found = skills_find_local_folders(parent.display().to_string()).unwrap();
        assert_eq!(found, [docx.display().to_string(), pdf.display().to_string()]);
        let _ = std::fs::remove_dir_all(&parent);
    }

    fn entry(path: &str, kind: &str) -> String {
        format!(r#"{{"id":"x","name":"x","type":"{kind}","path":"{path}","mode":"100644"}}"#)
    }

    /// A fake GitLab that answers the list of the folder `skills` of the project `acme/skills` with `entries`.
    async fn fake_gitlab(entries: Vec<String>) -> FakeServer {
        let body = format!("[{}]", entries.join(","));
        fake_server(move |request| {
            if request == "/api/v4/projects/acme%2Fskills/repository/tree?ref=main&path=skills&recursive=true&per_page=100&page=1" {
                return FakeResponse::ok(&body).with_header("x-next-page", "");
            }
            FakeResponse::status(404)
        })
        .await
    }

    async fn find_on_gitlab(server: &FakeServer, text: &str) -> Result<Vec<String>, String> {
        find_folders(&reqwest::Client::new(), &server.base, &parse_folder_address(text).unwrap()).await
    }

    #[tokio::test]
    async fn finds_every_skill_below_a_gitlab_folder() {
        let server = fake_gitlab(vec![
            entry("skills/pdf/SKILL.md", "blob"),
            entry("skills/pdf/scripts/a.py", "blob"),
            entry("skills/docx/SKILL.md", "blob"),
            entry("skills/notes/readme.md", "blob"),
        ])
        .await;
        let found = find_on_gitlab(&server, "https://gitlab.com/acme/skills/-/tree/main/skills").await.unwrap();
        assert_eq!(
            found,
            ["https://gitlab.com/acme/skills/-/tree/main/skills/docx", "https://gitlab.com/acme/skills/-/tree/main/skills/pdf"]
        );
    }

    #[tokio::test]
    async fn gives_the_one_address_of_a_gitlab_folder_that_is_a_skill() {
        let server = fake_gitlab(vec![entry("skills/SKILL.md", "blob"), entry("skills/pdf/SKILL.md", "blob")]).await;
        let found = find_on_gitlab(&server, "https://gitlab.com/acme/skills/-/tree/main/skills").await.unwrap();
        assert_eq!(found, ["https://gitlab.com/acme/skills/-/tree/main/skills"]);
    }

    #[tokio::test]
    async fn says_that_a_gitlab_folder_has_no_skill() {
        let server = fake_gitlab(vec![entry("skills/notes/readme.md", "blob")]).await;
        let none = find_on_gitlab(&server, "https://gitlab.com/acme/skills/-/tree/main/skills").await;
        assert_eq!(none.unwrap_err(), "skills_folder_no_skill: acme/skills/main/skills");
        let missing = find_on_gitlab(&server, "https://gitlab.com/acme/skills/-/tree/main/other").await;
        assert_eq!(missing.unwrap_err(), "skills_folder_not_found: acme/skills/main/other");
    }

    #[tokio::test]
    async fn says_that_a_gitlab_folder_is_too_large_to_read() {
        let server = fake_server(|_| FakeResponse::ok("[]").with_header("x-next-page", "2")).await;
        let large = find_on_gitlab(&server, "https://gitlab.com/acme/skills/-/tree/main/skills").await;
        assert_eq!(large.unwrap_err(), "skills_folder_too_large: acme/skills/main/skills");
    }

    #[tokio::test]
    async fn refuses_a_bad_address_without_asking_the_network() {
        assert_eq!(skills_find_folders("skills".into()).await.unwrap_err(), "skills_invalid_address: skills");
    }
}
