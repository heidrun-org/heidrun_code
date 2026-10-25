//! Sample data and a fake GitHub for the tests of the package. Only the tests compile this file.

use crate::github::graphql_runner::GraphqlRunner;
use crate::model::types::{Issue, IssueState, IssueStateReason, PullRequest, PullRequestState};
use serde_json::{json, Value};
use std::cell::RefCell;
use std::path::PathBuf;

/// A date in October 2026, in the format ISO 8601. `day` goes from 1 to 28.
pub fn date(day: u32) -> String {
    format!("2026-10-{day:02}T10:00:00Z")
}

/// A new empty folder in the temporary folder. Each test gives its own name.
pub fn temp_folder(name: &str) -> PathBuf {
    let folder = std::env::temp_dir().join(format!("data_layer_code_hosting_{name}_{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&folder);
    std::fs::create_dir_all(&folder).unwrap();
    folder
}

/// An issue that follows the JSON schema. It is closed, and its last change is on the day 2.
pub fn issue(number: i64) -> Issue {
    Issue {
        number,
        title: "An issue".into(),
        body: "The text of the issue.".into(),
        state: IssueState::Closed,
        state_reason: Some(IssueStateReason::Completed),
        author: Some("jeromeetienne".into()),
        assignees: vec![],
        labels: vec!["enhancement".into()],
        label_colors: [("enhancement".to_string(), "a2eeef".to_string())].into(),
        created_at: date(1),
        updated_at: date(2),
        closed_at: Some(date(2)),
        comment_count: 1,
    }
}

/// A pull request that follows the JSON schema. It is merged, and its last change is on the day 2.
pub fn pull_request(number: i64) -> PullRequest {
    PullRequest {
        number,
        title: "A pull request".into(),
        body: "Fixes #1.".into(),
        state: PullRequestState::Merged,
        is_draft: false,
        author: Some("jeromeetienne".into()),
        merged_by: Some("jeromeetienne".into()),
        labels: vec![],
        label_colors: Default::default(),
        base_ref_name: "dev_jerome".into(),
        head_ref_name: "a-branch-1".into(),
        merge_commit: Some("5065bbeb7a356b9e76c1e47e0b1c19876642f604".into()),
        created_at: date(1),
        updated_at: date(2),
        closed_at: Some(date(2)),
        merged_at: Some(date(2)),
        additions: 10,
        deletions: 2,
        changed_files: 3,
        commit_count: 4,
    }
}

/// An issue as the GraphQL interface of GitHub answers it. It becomes `issue(number)` with the date of change `updated_at`.
pub fn issue_node(number: i64, updated_at: &str) -> Value {
    json!({
        "number": number,
        "title": "An issue",
        "body": "The text of the issue.",
        "state": "CLOSED",
        "stateReason": "COMPLETED",
        "createdAt": date(1),
        "updatedAt": updated_at,
        "closedAt": date(2),
        "author": { "login": "jeromeetienne" },
        "assignees": { "nodes": [] },
        "labels": { "nodes": [{ "name": "enhancement", "color": "a2eeef" }] },
        "comments": { "totalCount": 1 },
    })
}

/// A pull request as the GraphQL interface of GitHub answers it. It becomes `pull_request(number)` with the date of change
/// `updated_at`.
pub fn pull_request_node(number: i64, updated_at: &str) -> Value {
    json!({
        "number": number,
        "title": "A pull request",
        "body": "Fixes #1.",
        "state": "MERGED",
        "isDraft": false,
        "baseRefName": "dev_jerome",
        "headRefName": "a-branch-1",
        "createdAt": date(1),
        "updatedAt": updated_at,
        "closedAt": date(2),
        "mergedAt": date(2),
        "additions": 10,
        "deletions": 2,
        "changedFiles": 3,
        "author": { "login": "jeromeetienne" },
        "mergedBy": { "login": "jeromeetienne" },
        "mergeCommit": { "oid": "5065bbeb7a356b9e76c1e47e0b1c19876642f604" },
        "labels": { "nodes": [] },
        "commits": { "totalCount": 4 },
    })
}

/// One request that the fake GitHub received.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FakeRequest {
    /// The list that the request asked for: `issues` or `pullRequests`.
    pub connection_name: String,
    /// The text of the query.
    pub query: String,
    /// The owner of the repository.
    pub owner: String,
    /// The name of the repository.
    pub name: String,
    /// The marker of the page, or `None` for the first page.
    pub cursor: Option<String>,
}

/// A fake GitHub. It answers the GraphQL queries from two lists of items, the newest change first, one page at a time, as
/// GitHub does. A test can change the two lists between two synchronizations.
pub struct FakeGithub {
    /// The issues that the fake GitHub holds.
    pub issue_nodes: RefCell<Vec<Value>>,
    /// The pull requests that the fake GitHub holds.
    pub pull_request_nodes: RefCell<Vec<Value>>,
    /// The number of items in one page.
    pub page_size: usize,
    /// The requests that the fake GitHub received, in order.
    pub requests: RefCell<Vec<FakeRequest>>,
}

impl FakeGithub {
    /// Creates a fake GitHub.
    pub fn new(issue_nodes: Vec<Value>, pull_request_nodes: Vec<Value>, page_size: usize) -> Self {
        FakeGithub {
            issue_nodes: RefCell::new(issue_nodes),
            pull_request_nodes: RefCell::new(pull_request_nodes),
            page_size,
            requests: RefCell::new(vec![]),
        }
    }
}

impl GraphqlRunner for FakeGithub {
    fn run(&self, query: &str, variables: &[(&str, Option<&str>)]) -> Result<Value, String> {
        let variable = |key: &str| variables.iter().find(|(name, _)| *name == key).and_then(|(_, value)| *value);
        let connection_name = if query.contains("pullRequests(") { "pullRequests" } else { "issues" };
        let mut sorted_nodes =
            if connection_name == "issues" { self.issue_nodes.borrow().clone() } else { self.pull_request_nodes.borrow().clone() };
        sorted_nodes.sort_by(|node_a, node_b| node_b["updatedAt"].as_str().cmp(&node_a["updatedAt"].as_str()));
        let start = variable("cursor").map(|cursor| cursor.parse::<usize>().unwrap()).unwrap_or(0);
        let end = start + self.page_size;
        self.requests.borrow_mut().push(FakeRequest {
            connection_name: connection_name.to_string(),
            query: query.to_string(),
            owner: variable("owner").unwrap().to_string(),
            name: variable("name").unwrap().to_string(),
            cursor: variable("cursor").map(String::from),
        });
        let page: Vec<Value> = sorted_nodes.iter().skip(start).take(self.page_size).cloned().collect();
        Ok(json!({
            "data": {
                "repository": {
                    connection_name: {
                        "totalCount": sorted_nodes.len(),
                        "pageInfo": { "hasNextPage": end < sorted_nodes.len(), "endCursor": end.to_string() },
                        "nodes": page,
                    }
                }
            }
        }))
    }
}
