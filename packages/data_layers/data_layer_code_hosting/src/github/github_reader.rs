//! Reads the issues and the pull requests of one GitHub repository, with the GraphQL interface of GitHub.
//!
//! The items come from the newest change to the oldest change, one page of 100 items at a time. The reader sends the queries
//! through a `GraphqlRunner`, and never runs the command `gh` itself.

use crate::github::graphql_runner::GraphqlRunner;
use crate::model::types::{
    CodeHostingProgress, CodeHostingStage, Issue, IssueState, IssueStateReason, PullRequest, PullRequestState,
};
use serde::Deserialize;
use serde_json::Value;
use crate::OPERATION_PACKAGE;
use data_layer_operation_log::{record, OperationKind, OperationSpec, Summary};
use std::collections::BTreeMap;

/// The GraphQL query for one page of issues.
pub const ISSUES_QUERY: &str = r#"
query($owner: String!, $name: String!, $cursor: String) {
    repository(owner: $owner, name: $name) {
        issues(first: 100, after: $cursor, orderBy: { field: UPDATED_AT, direction: DESC }) {
            totalCount
            pageInfo { hasNextPage endCursor }
            nodes {
                number title body state stateReason createdAt updatedAt closedAt
                author { login }
                assignees(first: 20) { nodes { login } }
                labels(first: 50) { nodes { name color } }
                comments { totalCount }
            }
        }
    }
}
"#;

/// The GraphQL query for one page of pull requests.
pub const PULL_REQUESTS_QUERY: &str = r#"
query($owner: String!, $name: String!, $cursor: String) {
    repository(owner: $owner, name: $name) {
        pullRequests(first: 100, after: $cursor, orderBy: { field: UPDATED_AT, direction: DESC }) {
            totalCount
            pageInfo { hasNextPage endCursor }
            nodes {
                number title body state isDraft baseRefName headRefName
                createdAt updatedAt closedAt mergedAt additions deletions changedFiles
                author { login }
                mergedBy { login }
                mergeCommit { oid }
                labels(first: 50) { nodes { name color } }
                commits { totalCount }
            }
        }
    }
}
"#;

/// Ignores a line of progress. It is the log function when the developer does not ask for the progress.
pub fn ignore_log(_message: &str) {}

/// Ignores a report of progress. It is the progress function when the caller does not show the progress.
pub fn ignore_progress(_progress: &CodeHostingProgress) {}

/// Reads the pages of issues and of pull requests.
pub struct GithubReader<'a> {
    /// The runner that sends a GraphQL query.
    runner: &'a dyn GraphqlRunner,
    /// The function that receives one line of progress for each page and for each stop.
    log: &'a dyn Fn(&str),
    /// The function that receives the reports of progress of the stages.
    progress: &'a dyn Fn(&CodeHostingProgress),
}

impl<'a> GithubReader<'a> {
    /// Creates a reader. `log` receives one line of progress for each page and for each stop. Give `&ignore_log` for no
    /// progress.
    pub fn new(runner: &'a dyn GraphqlRunner, log: &'a dyn Fn(&str)) -> Self {
        GithubReader { runner, log, progress: &ignore_progress }
    }

    /// Gives the reader the function that receives one report of progress at the start of each stage, after each page, and at
    /// the end of each stage.
    pub fn with_progress(mut self, progress: &'a dyn Fn(&CodeHostingProgress)) -> Self {
        self.progress = progress;
        self
    }

    /// Sends one report of progress to the progress function of the reader.
    pub(crate) fn send_progress(
        &self,
        stage: CodeHostingStage,
        done_count: usize,
        total_count: Option<usize>,
        is_finished: bool,
    ) {
        (self.progress)(&CodeHostingProgress { stage, done_count, total_count, is_finished });
    }

    /// Reads the issues of a repository, the newest change first.
    ///
    /// With a date in `since`, the reader returns only the issues that changed at this date or after, and stops asking for
    /// pages at the first older issue. With `None`, the reader returns every issue.
    ///
    /// # Errors
    /// An error when the query fails, or when the answer is not what the query asks for.
    pub fn read_issues(&self, repository: &str, since: Option<&str>) -> Result<Vec<Issue>, String> {
        let spec = OperationSpec::new(OPERATION_PACKAGE, "read_issues", OperationKind::Collection)
            .parameter("repository", repository)
            .parameter("since", since);
        record(spec, || self.read_issues_inside(repository, since), |issues| Summary::count(issues.len()))
    }

    /// The work of `read_issues`, between the start event and the completion event of its operation.
    fn read_issues_inside(&self, repository: &str, since: Option<&str>) -> Result<Vec<Issue>, String> {
        let nodes = self.read_nodes(repository, ISSUES_QUERY, "issues", CodeHostingStage::ReadIssues, since)?;
        nodes
            .into_iter()
            .map(|node| {
                let node: IssueNode = serde_json::from_value(node)
                    .map_err(|error| format!("An issue of the answer of GitHub is not what the query asks for: {error}"))?;
                Ok(node.into())
            })
            .collect()
    }

    /// Reads the pull requests of a repository, the newest change first.
    ///
    /// With a date in `since`, the reader returns only the pull requests that changed at this date or after, and stops asking
    /// for pages at the first older pull request. With `None`, the reader returns every pull request.
    ///
    /// # Errors
    /// An error when the query fails, or when the answer is not what the query asks for.
    pub fn read_pull_requests(&self, repository: &str, since: Option<&str>) -> Result<Vec<PullRequest>, String> {
        let spec = OperationSpec::new(OPERATION_PACKAGE, "read_pull_requests", OperationKind::Collection)
            .parameter("repository", repository)
            .parameter("since", since);
        record(spec, || self.read_pull_requests_inside(repository, since), |pull_requests| Summary::count(pull_requests.len()))
    }

    /// The work of `read_pull_requests`, between the start event and the completion event of its operation.
    fn read_pull_requests_inside(&self, repository: &str, since: Option<&str>) -> Result<Vec<PullRequest>, String> {
        let nodes =
            self.read_nodes(repository, PULL_REQUESTS_QUERY, "pullRequests", CodeHostingStage::ReadPullRequests, since)?;
        nodes
            .into_iter()
            .map(|node| {
                let node: PullRequestNode = serde_json::from_value(node).map_err(|error| {
                    format!("A pull request of the answer of GitHub is not what the query asks for: {error}")
                })?;
                Ok(node.into())
            })
            .collect()
    }

    /// Reads the pages of one list, the newest change first, until the list ends or an item is older than `since`. After each
    /// page, it sends a report of progress for `stage`. The total is the number of items of the list when the read starts at
    /// the beginning, and is not known when the read starts at a date.
    fn read_nodes(
        &self,
        repository: &str,
        query: &str,
        connection_name: &str,
        stage: CodeHostingStage,
        since: Option<&str>,
    ) -> Result<Vec<Value>, String> {
        let (owner, name) = repository
            .split_once('/')
            .ok_or_else(|| format!("The repository must be written owner/name, and not {repository}."))?;
        let mut nodes = Vec::new();
        let mut cursor: Option<String> = None;
        let mut page_number = 0;
        loop {
            page_number += 1;
            (self.log)(&format!("{connection_name}: asking for page {page_number} of {repository}"));
            let variables = [("owner", Some(owner)), ("name", Some(name)), ("cursor", cursor.as_deref())];
            let response = self.runner.run(query, &variables)?;
            if let Some(errors) = response.get("errors").filter(|errors| !errors.is_null()) {
                return Err(format!("GitHub answered with errors: {errors}"));
            }
            let connection = response
                .pointer(&format!("/data/repository/{connection_name}"))
                .ok_or_else(|| format!("The answer of GitHub has no list named {connection_name}."))?;
            let page_nodes = connection["nodes"]
                .as_array()
                .ok_or_else(|| format!("The list {connection_name} of the answer of GitHub has no items."))?;
            (self.log)(&format!("{connection_name}: page {page_number} read, item count {}", page_nodes.len()));
            for node in page_nodes {
                let updated_at = node["updatedAt"]
                    .as_str()
                    .ok_or_else(|| format!("An item of the list {connection_name} has no date of change."))?;
                if let Some(since) = since {
                    if updated_at < since {
                        (self.log)(&format!(
                            "{connection_name}: stop, the next item changed at {updated_at}, before {since}"
                        ));
                        return Ok(nodes);
                    }
                }
                nodes.push(node.clone());
            }
            let total_count =
                if since.is_none() { connection["totalCount"].as_u64().map(|count| count as usize) } else { None };
            self.send_progress(stage, nodes.len(), total_count, false);
            if connection["pageInfo"]["hasNextPage"] != Value::Bool(true) {
                (self.log)(&format!("{connection_name}: stop, page {page_number} is the last page"));
                return Ok(nodes);
            }
            cursor = connection["pageInfo"]["endCursor"].as_str().map(String::from);
        }
    }
}

/// A person in a GraphQL answer.
#[derive(Deserialize)]
struct LoginNode {
    login: String,
}

/// A label in a GraphQL answer.
#[derive(Deserialize)]
struct LabelNode {
    name: String,
    color: Option<String>,
}

/// The colors of the labels of a GraphQL answer, by the name of the label. A label without a color has no entry.
fn label_colors_of(labels: &[LabelNode]) -> BTreeMap<String, String> {
    labels
        .iter()
        .filter_map(|label| label.color.as_ref().map(|color| (label.name.clone(), color.clone())))
        .collect()
}

/// A commit in a GraphQL answer.
#[derive(Deserialize)]
struct CommitNode {
    oid: String,
}

/// A list of items in a GraphQL answer.
#[derive(Deserialize)]
struct Nodes<T> {
    nodes: Vec<T>,
}

/// The number of items of a list, in a GraphQL answer.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct TotalCount {
    total_count: i64,
}

/// One issue in a GraphQL answer.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct IssueNode {
    number: i64,
    title: String,
    body: String,
    state: IssueState,
    state_reason: Option<IssueStateReason>,
    created_at: String,
    updated_at: String,
    closed_at: Option<String>,
    author: Option<LoginNode>,
    assignees: Nodes<LoginNode>,
    labels: Nodes<LabelNode>,
    comments: TotalCount,
}

impl From<IssueNode> for Issue {
    fn from(node: IssueNode) -> Issue {
        Issue {
            number: node.number,
            title: node.title,
            body: node.body,
            state: node.state,
            state_reason: node.state_reason,
            author: node.author.map(|author| author.login),
            assignees: node.assignees.nodes.into_iter().map(|assignee| assignee.login).collect(),
            label_colors: label_colors_of(&node.labels.nodes),
            labels: node.labels.nodes.into_iter().map(|label| label.name).collect(),
            created_at: node.created_at,
            updated_at: node.updated_at,
            closed_at: node.closed_at,
            comment_count: node.comments.total_count,
        }
    }
}

/// One pull request in a GraphQL answer.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PullRequestNode {
    number: i64,
    title: String,
    body: String,
    state: PullRequestState,
    is_draft: bool,
    base_ref_name: String,
    head_ref_name: String,
    created_at: String,
    updated_at: String,
    closed_at: Option<String>,
    merged_at: Option<String>,
    additions: i64,
    deletions: i64,
    changed_files: i64,
    author: Option<LoginNode>,
    merged_by: Option<LoginNode>,
    merge_commit: Option<CommitNode>,
    labels: Nodes<LabelNode>,
    commits: TotalCount,
}

impl From<PullRequestNode> for PullRequest {
    fn from(node: PullRequestNode) -> PullRequest {
        PullRequest {
            number: node.number,
            title: node.title,
            body: node.body,
            state: node.state,
            is_draft: node.is_draft,
            author: node.author.map(|author| author.login),
            merged_by: node.merged_by.map(|merger| merger.login),
            label_colors: label_colors_of(&node.labels.nodes),
            labels: node.labels.nodes.into_iter().map(|label| label.name).collect(),
            base_ref_name: node.base_ref_name,
            head_ref_name: node.head_ref_name,
            merge_commit: node.merge_commit.map(|commit| commit.oid),
            created_at: node.created_at,
            updated_at: node.updated_at,
            closed_at: node.closed_at,
            merged_at: node.merged_at,
            additions: node.additions,
            deletions: node.deletions,
            changed_files: node.changed_files,
            commit_count: node.commits.total_count,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_samples::{date, issue, issue_node, pull_request, pull_request_node, FakeGithub, FakeRequest};
    use serde_json::json;
    use std::cell::RefCell;

    const REPOSITORY: &str = "heidrun-org/heidrun";

    /// The numbers of the issues, in order.
    fn issue_numbers(issues: &[Issue]) -> Vec<i64> {
        issues.iter().map(|issue| issue.number).collect()
    }

    #[test]
    fn turns_an_issue_node_into_the_stored_shape() {
        let mut node = issue_node(12, &date(2));
        node["assignees"] = json!({ "nodes": [{ "login": "jeromeetienne" }, { "login": "eric" }] });
        node["labels"] = json!({ "nodes": [{ "name": "idea", "color": "fbca04" }, { "name": "Simple Work", "color": null }] });
        node["comments"] = json!({ "totalCount": 3 });
        let fake_github = FakeGithub::new(vec![node], vec![], 100);
        let issues = GithubReader::new(&fake_github, &ignore_log).read_issues(REPOSITORY, None).unwrap();
        let mut expected = issue(12);
        expected.assignees = vec!["jeromeetienne".into(), "eric".into()];
        expected.labels = vec!["idea".into(), "Simple Work".into()];
        expected.label_colors = [("idea".to_string(), "fbca04".to_string())].into();
        expected.comment_count = 3;
        assert_eq!(issues, [expected]);
    }

    #[test]
    fn keeps_none_for_the_author_the_reason_and_the_close_date_of_an_open_issue() {
        let mut node = issue_node(1, &date(2));
        node["state"] = json!("OPEN");
        node["stateReason"] = Value::Null;
        node["closedAt"] = Value::Null;
        node["author"] = Value::Null;
        let fake_github = FakeGithub::new(vec![node], vec![], 100);
        let issues = GithubReader::new(&fake_github, &ignore_log).read_issues(REPOSITORY, None).unwrap();
        assert_eq!(issues[0].author, None);
        assert_eq!(issues[0].state_reason, None);
        assert_eq!(issues[0].closed_at, None);
        assert_eq!(issues[0].state, IssueState::Open);
    }

    #[test]
    fn turns_a_pull_request_node_into_the_stored_shape() {
        let mut node = pull_request_node(30, &date(2));
        node["commits"] = json!({ "totalCount": 237 });
        let fake_github = FakeGithub::new(vec![], vec![node], 100);
        let pull_requests =
            GithubReader::new(&fake_github, &ignore_log).read_pull_requests(REPOSITORY, None).unwrap();
        let mut expected = pull_request(30);
        expected.commit_count = 237;
        assert_eq!(pull_requests, [expected]);
    }

    #[test]
    fn keeps_none_for_the_merger_and_the_merge_commit_of_a_pull_request_that_is_not_merged() {
        let mut node = pull_request_node(1, &date(2));
        node["state"] = json!("OPEN");
        for field in ["mergedBy", "mergeCommit", "mergedAt", "closedAt"] {
            node[field] = Value::Null;
        }
        let fake_github = FakeGithub::new(vec![], vec![node], 100);
        let pull_requests =
            GithubReader::new(&fake_github, &ignore_log).read_pull_requests(REPOSITORY, None).unwrap();
        assert_eq!(pull_requests[0].merged_by, None);
        assert_eq!(pull_requests[0].merge_commit, None);
        assert_eq!(pull_requests[0].merged_at, None);
    }

    #[test]
    fn sends_the_owner_and_the_name_of_the_repository_and_asks_for_the_issues_with_the_issues_query() {
        let fake_github = FakeGithub::new(vec![], vec![], 100);
        GithubReader::new(&fake_github, &ignore_log).read_issues(REPOSITORY, None).unwrap();
        assert_eq!(
            *fake_github.requests.borrow(),
            [FakeRequest {
                connection_name: "issues".into(),
                query: ISSUES_QUERY.into(),
                owner: "heidrun-org".into(),
                name: "heidrun".into(),
                cursor: None,
            }]
        );
    }

    #[test]
    fn refuses_a_repository_that_is_not_written_owner_slash_name() {
        let fake_github = FakeGithub::new(vec![], vec![], 100);
        let error = GithubReader::new(&fake_github, &ignore_log).read_issues("heidrun", None).unwrap_err();
        assert!(error.contains("owner/name"));
    }

    #[test]
    fn reads_every_page_and_returns_the_items_from_the_newest_change_to_the_oldest_change() {
        let nodes: Vec<Value> = (1..=5).map(|day| issue_node(day, &date(day as u32))).collect();
        let fake_github = FakeGithub::new(nodes, vec![], 2);
        let issues = GithubReader::new(&fake_github, &ignore_log).read_issues(REPOSITORY, None).unwrap();
        assert_eq!(issue_numbers(&issues), [5, 4, 3, 2, 1]);
        let cursors: Vec<Option<String>> =
            fake_github.requests.borrow().iter().map(|request| request.cursor.clone()).collect();
        assert_eq!(cursors, [None, Some("2".to_string()), Some("4".to_string())]);
    }

    #[test]
    fn stops_at_the_first_item_older_than_the_date_and_does_not_ask_for_the_next_page() {
        let nodes: Vec<Value> = (1..=6).map(|day| pull_request_node(day, &date(day as u32))).collect();
        let fake_github = FakeGithub::new(vec![], nodes, 2);
        let pull_requests = GithubReader::new(&fake_github, &ignore_log)
            .read_pull_requests(REPOSITORY, Some(&date(5)))
            .unwrap();
        let numbers: Vec<i64> = pull_requests.iter().map(|pull_request| pull_request.number).collect();
        assert_eq!(numbers, [6, 5]);
        assert_eq!(fake_github.requests.borrow().len(), 2);
    }

    #[test]
    fn returns_the_items_that_have_exactly_the_date() {
        let nodes = vec![issue_node(1, &date(4)), issue_node(2, &date(4)), issue_node(3, &date(3))];
        let fake_github = FakeGithub::new(nodes, vec![], 100);
        let issues = GithubReader::new(&fake_github, &ignore_log).read_issues(REPOSITORY, Some(&date(4))).unwrap();
        assert_eq!(issues.len(), 2);
    }

    #[test]
    fn returns_an_empty_list_when_the_repository_has_no_issue() {
        let fake_github = FakeGithub::new(vec![], vec![], 100);
        assert_eq!(GithubReader::new(&fake_github, &ignore_log).read_issues(REPOSITORY, None), Ok(vec![]));
    }

    #[test]
    fn gives_an_error_when_the_answer_of_github_holds_errors() {
        struct ErrorRunner;
        impl GraphqlRunner for ErrorRunner {
            fn run(&self, _query: &str, _variables: &[(&str, Option<&str>)]) -> Result<Value, String> {
                Ok(json!({ "errors": [{ "message": "Could not resolve to a Repository" }] }))
            }
        }
        let error = GithubReader::new(&ErrorRunner, &ignore_log).read_issues(REPOSITORY, None).unwrap_err();
        assert!(error.contains("Could not resolve"));
    }

    #[test]
    fn gives_an_error_when_an_item_is_not_what_the_query_asks_for() {
        let mut node = issue_node(1, &date(2));
        node["state"] = json!("SIDEWAYS");
        let fake_github = FakeGithub::new(vec![node], vec![], 100);
        let error = GithubReader::new(&fake_github, &ignore_log).read_issues(REPOSITORY, None).unwrap_err();
        assert!(error.contains("not what the query asks for"));
    }

    #[test]
    fn sends_one_line_of_progress_for_each_page_and_one_line_for_the_stop() {
        let lines = RefCell::new(Vec::<String>::new());
        let log = |message: &str| lines.borrow_mut().push(message.to_string());
        let nodes: Vec<Value> = (1..=3).map(|day| issue_node(day, &date(day as u32))).collect();
        let fake_github = FakeGithub::new(nodes, vec![], 2);
        GithubReader::new(&fake_github, &log).read_issues(REPOSITORY, Some(&date(2))).unwrap();
        assert_eq!(
            *lines.borrow(),
            [
                format!("issues: asking for page 1 of {REPOSITORY}"),
                "issues: page 1 read, item count 2".to_string(),
                format!("issues: asking for page 2 of {REPOSITORY}"),
                "issues: page 2 read, item count 1".to_string(),
                format!("issues: stop, the next item changed at {}, before {}", date(1), date(2)),
            ]
        );
    }

    #[test]
    fn sends_a_line_of_progress_when_the_last_page_is_read() {
        let lines = RefCell::new(Vec::<String>::new());
        let log = |message: &str| lines.borrow_mut().push(message.to_string());
        let fake_github = FakeGithub::new(vec![], vec![pull_request_node(1, &date(2))], 100);
        GithubReader::new(&fake_github, &log).read_pull_requests(REPOSITORY, None).unwrap();
        assert_eq!(lines.borrow().last().unwrap(), "pullRequests: stop, page 1 is the last page");
    }
}
