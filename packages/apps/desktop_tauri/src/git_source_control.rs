//! The Git actions of the Source control sidebar section: stage, unstage, discard, commit, stash, pull, push,
//! fetch, the list and the checkout of the local branches (the branch picker of the status bar), and the diff that a
//! coding agent reads to write the commit message, and the synchronization with the upstream branch, a merge then a push (the turning-arrows
//! icon of the status bar).
//!
//! Each command accepts only a root that `git_status` gave before (`known_root`), and only paths inside it
//! (`safe_rel`). The paths are literal: no globs, no pathspec magic.

use crate::application_log::record_git_call;
use crate::git::{known_root, safe_rel};
use std::time::{Duration, Instant};
use tokio::process::Command;

/// The time a local Git action may take.
const LOCAL_TIMEOUT: u64 = 20;
/// The time a Git action that talks to the remote repository may take.
const REMOTE_TIMEOUT: u64 = 90;
/// The largest diff given to the coding agent that writes the commit message.
const MAX_DIFF: usize = 60_000;

/// Runs `git -C root args`, with literal paths and no prompt, and gives the standard output, or the standard error
/// output as the error. The application log receives the name of the command, its duration, and its failure.
async fn run(root: &str, args: &[&str], timeout: u64) -> Result<String, String> {
    let started = Instant::now();
    let result = unlogged_run(root, args, timeout).await;
    record_git_call(args, started, result.as_ref().err().map(String::as_str));
    result
}

async fn unlogged_run(root: &str, args: &[&str], timeout: u64) -> Result<String, String> {
    let mut command = Command::new("git");
    command
        .arg("-C")
        .arg(root)
        .args(args)
        .env("GIT_LITERAL_PATHSPECS", "1")
        .env("GIT_TERMINAL_PROMPT", "0")
        .kill_on_drop(true);
    let output = tokio::time::timeout(Duration::from_secs(timeout), command.output())
        .await
        .map_err(|_| format!("git {}: no answer in {timeout} s", args.first().unwrap_or(&"")))?
        .map_err(|error| error.to_string())?;
    if output.status.success() {
        return Ok(String::from_utf8_lossy(&output.stdout).into_owned());
    }
    let error = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let error = if error.is_empty() { String::from_utf8_lossy(&output.stdout).trim().to_string() } else { error };
    Err(if error.is_empty() { format!("git {} failed ({})", args.first().unwrap_or(&""), output.status) } else { error })
}

/// Checks the root and each path, and gives the paths as `&str`.
fn checked_paths<'a>(root: &str, paths: &'a [String]) -> Result<Vec<&'a str>, String> {
    known_root(root)?;
    if paths.is_empty() {
        return Err("no file".into());
    }
    paths.iter().map(|path| safe_rel(path)).collect()
}

/// Runs `git <first> -- <paths>`.
async fn run_on_paths(root: &str, first: &[&str], paths: &[&str]) -> Result<(), String> {
    let mut args: Vec<&str> = first.to_vec();
    args.push("--");
    args.extend(paths);
    run(root, &args, LOCAL_TIMEOUT).await.map(|_| ())
}

/// True when the repository has at least one commit.
async fn has_head(root: &str) -> bool {
    run(root, &["rev-parse", "--verify", "--quiet", "HEAD"], LOCAL_TIMEOUT).await.is_ok()
}

/// Stages the files `paths`: new files, changed files, and deleted files.
#[tauri::command]
pub async fn git_stage(root: String, paths: Vec<String>) -> Result<(), String> {
    let paths = checked_paths(&root, &paths)?;
    run_on_paths(&root, &["add", "--all"], &paths).await
}

/// Unstages the files `paths`. The changes stay in the working folder.
#[tauri::command]
pub async fn git_unstage(root: String, paths: Vec<String>) -> Result<(), String> {
    let paths = checked_paths(&root, &paths)?;
    if has_head(&root).await {
        return run_on_paths(&root, &["restore", "--staged"], &paths).await;
    }
    run_on_paths(&root, &["rm", "--cached", "--quiet", "-r"], &paths).await
}

/// Discards the changes of the files `paths` that are not staged. A file that Git does not know is deleted.
#[tauri::command]
pub async fn git_discard(root: String, paths: Vec<String>) -> Result<(), String> {
    let paths = checked_paths(&root, &paths)?;
    let mut known_paths: Vec<&str> = Vec::new();
    let mut unknown_paths: Vec<&str> = Vec::new();
    for path in paths {
        let listed = run(&root, &["ls-files", "--", path], LOCAL_TIMEOUT).await?;
        if listed.trim().is_empty() {
            unknown_paths.push(path);
        } else {
            known_paths.push(path);
        }
    }
    if known_paths.is_empty() == false {
        run_on_paths(&root, &["restore", "--worktree"], &known_paths).await?;
    }
    if unknown_paths.is_empty() == false {
        run_on_paths(&root, &["clean", "--force"], &unknown_paths).await?;
    }
    Ok(())
}

/// Makes a commit of the staged files with `message`. With `amend`, the commit replaces the last commit.
#[tauri::command]
pub async fn git_commit(root: String, message: String, amend: bool) -> Result<String, String> {
    known_root(&root)?;
    if message.trim().is_empty() {
        return Err("empty commit message".into());
    }
    let mut args = vec!["commit", "--message", message.as_str()];
    if amend {
        args.push("--amend");
    }
    run(&root, &args, LOCAL_TIMEOUT).await
}

/// Puts the changes aside with `git stash push`: the staged files only when `staged_only`, else every change and
/// every new file.
#[tauri::command]
pub async fn git_stash(root: String, staged_only: bool) -> Result<String, String> {
    known_root(&root)?;
    if staged_only {
        return run(&root, &["stash", "push", "--staged", "--message", "Heidrun"], LOCAL_TIMEOUT).await;
    }
    run(&root, &["stash", "push", "--include-untracked", "--message", "Heidrun"], LOCAL_TIMEOUT).await
}

/// Runs `git pull`, `git push`, or `git fetch` (`action`). A push of a branch without an upstream branch sets
/// `origin` as its upstream.
#[tauri::command]
pub async fn git_sync(root: String, action: String) -> Result<String, String> {
    known_root(&root)?;
    match action.as_str() {
        "pull" => run(&root, &["pull", "--no-edit"], REMOTE_TIMEOUT).await,
        "fetch" => run(&root, &["fetch", "--prune"], REMOTE_TIMEOUT).await,
        "push" => {
            let upstream = run(&root, &["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"], LOCAL_TIMEOUT).await;
            if upstream.is_ok() {
                return run(&root, &["push"], REMOTE_TIMEOUT).await;
            }
            let branch = run(&root, &["symbolic-ref", "--short", "HEAD"], LOCAL_TIMEOUT).await?;
            run(&root, &["push", "--set-upstream", "origin", branch.trim()], REMOTE_TIMEOUT).await
        }
        _ => Err(format!("unknown Git action: {action}")),
    }
}

/// One local branch, as the branch picker of the status bar shows it.
#[derive(serde::Serialize, Debug, PartialEq)]
pub struct GitBranch {
    /// The name of the branch.
    pub name: String,
    /// True for the branch that is checked out.
    pub is_current: bool,
    /// The short hash of the last commit of the branch.
    pub last_sha: String,
    /// The subject of the last commit of the branch.
    pub last_subject: String,
    /// The author of the last commit of the branch.
    pub last_author: String,
    /// The time of the last commit of the branch, in seconds since 1970.
    pub last_time: i64,
    /// True when this computer knows a branch of the same name on the remote repository `origin`: the remote-tracking
    /// branch exists. A push makes it exist at once, and a fetch updates it. It is a local and fast answer, and it can
    /// be out of date.
    pub has_remote_tracking: bool,
}

/// Lists the local branches, the most recently committed first.
#[tauri::command]
pub async fn git_branches(root: String) -> Result<Vec<GitBranch>, String> {
    known_root(&root)?;
    let separator = "\u{1f}";
    let format = format!(
        "--format=%(HEAD){separator}%(refname:short){separator}%(objectname:short){separator}%(authorname){separator}%(committerdate:unix){separator}%(contents:subject)"
    );
    let text = run(&root, &["for-each-ref", "--sort=-committerdate", &format, "refs/heads"], LOCAL_TIMEOUT).await?;
    let tracked = run(&root, &["for-each-ref", "--format=%(refname:short)", "refs/remotes/origin"], LOCAL_TIMEOUT)
        .await
        .unwrap_or_default();
    let tracked_names: std::collections::HashSet<&str> =
        tracked.lines().filter_map(|name| name.strip_prefix("origin/")).collect();
    let mut branches: Vec<GitBranch> = text.lines().filter_map(|line| parse_branch(line, separator)).collect();
    for branch in branches.iter_mut() {
        branch.has_remote_tracking = tracked_names.contains(branch.name.as_str());
    }
    Ok(branches)
}

/// Lists the branches that the remote repository `origin` has, by asking the remote repository (`git ls-remote`). It
/// needs the network, so the caller keeps the answer for a day.
#[tauri::command]
pub async fn git_remote_branches(root: String) -> Result<Vec<String>, String> {
    known_root(&root)?;
    let text = run(&root, &["ls-remote", "--heads", "origin"], REMOTE_TIMEOUT).await?;
    Ok(text.lines().filter_map(|line| line.split('\t').nth(1)).filter_map(|reference| reference.strip_prefix("refs/heads/")).map(str::to_string).collect())
}

/// Parses one line of `git for-each-ref` that `git_branches` asked for.
fn parse_branch(line: &str, separator: &str) -> Option<GitBranch> {
    let mut fields = line.splitn(6, separator);
    let head = fields.next()?;
    let name = fields.next()?.to_string();
    let last_sha = fields.next()?.to_string();
    let last_author = fields.next()?.to_string();
    let last_time = fields.next()?.parse().unwrap_or(0);
    let last_subject = fields.next().unwrap_or("").to_string();
    Some(GitBranch { name, is_current: head == "*", last_sha, last_subject, last_author, last_time, has_remote_tracking: false })
}

/// Checks out the local branch `branch`. Git refuses when a change of the working folder would be lost, and its
/// message is the error.
#[tauri::command]
pub async fn git_checkout(root: String, branch: String) -> Result<String, String> {
    known_root(&root)?;
    let reference = format!("refs/heads/{branch}");
    run(&root, &["rev-parse", "--verify", "--quiet", &reference], LOCAL_TIMEOUT)
        .await
        .map_err(|_| format!("unknown branch: {branch}"))?;
    run(&root, &["switch", "--quiet", &branch], LOCAL_TIMEOUT).await
}

/// What a synchronization with the upstream branch did.
#[derive(serde::Serialize, Debug, PartialEq)]
pub struct SynchronizeResult {
    /// `merged` when new commits came in, `up_to_date` when there was nothing to merge, `conflict` when Git stopped on
    /// conflicts and left the merge to finish by hand.
    pub outcome: String,
    /// The upstream branch that was merged, for example `origin/main`.
    pub upstream: String,
    /// The files in conflict. Empty unless the outcome is `conflict`.
    pub conflicts: Vec<String>,
    /// The number of commits sent to the upstream branch after the merge. Zero when there was nothing to send, and when
    /// the merge stopped on conflicts.
    pub pushed: u32,
    /// The message of Git when the commits could not be sent, for example because the remote repository refused them.
    /// The merge is done in this case.
    pub push_error: Option<String>,
}

/// Does what "Synchronize Changes" of Visual Studio Code does: fetches the upstream branch of the current branch, merges
/// it into the current branch, then pushes the commits that the upstream branch does not have. When the merge stops on
/// conflicts, Git keeps the merge open, as `git merge` does in a terminal, nothing is pushed, and the files in conflict
/// are in the answer. Any other failure before the push, for example no upstream branch, or a change of the working
/// folder that the merge would overwrite, is the error, with the message of Git. A failure of the push is in `push_error`.
#[tauri::command]
pub async fn git_synchronize(root: String) -> Result<SynchronizeResult, String> {
    known_root(&root)?;
    let upstream = run(&root, &["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"], LOCAL_TIMEOUT)
        .await
        .map_err(|_| "no upstream branch".to_string())?
        .trim()
        .to_string();
    run(&root, &["fetch", "--prune"], REMOTE_TIMEOUT).await?;
    let before = run(&root, &["rev-parse", "HEAD"], LOCAL_TIMEOUT).await?;
    match run(&root, &["merge", "--no-edit", "@{upstream}"], LOCAL_TIMEOUT).await {
        Ok(_) => {
            let after = run(&root, &["rev-parse", "HEAD"], LOCAL_TIMEOUT).await?;
            let outcome = if after == before { "up_to_date" } else { "merged" };
            let (pushed, push_error) = push_new_commits(&root, &upstream).await;
            Ok(SynchronizeResult { outcome: outcome.into(), upstream, conflicts: Vec::new(), pushed, push_error })
        }
        Err(message) => {
            let listed = run(&root, &["diff", "--name-only", "--diff-filter=U"], LOCAL_TIMEOUT).await.unwrap_or_default();
            let conflicts: Vec<String> = listed.lines().map(str::to_string).collect();
            if conflicts.is_empty() {
                return Err(message);
            }
            Ok(SynchronizeResult { outcome: "conflict".into(), upstream, conflicts, pushed: 0, push_error: None })
        }
    }
}

/// Pushes the commits of the current branch that `upstream` (for example `origin/main`) does not have, to the branch of
/// that name on its remote repository. Gives the number of commits sent, and the message of Git when the push failed.
async fn push_new_commits(root: &str, upstream: &str) -> (u32, Option<String>) {
    let counted = run(root, &["rev-list", "--count", "@{upstream}..HEAD"], LOCAL_TIMEOUT).await;
    let ahead: u32 = counted.ok().and_then(|text| text.trim().parse().ok()).unwrap_or(0);
    if ahead == 0 {
        return (0, None);
    }
    let Some((remote, branch)) = upstream.split_once('/') else {
        return (0, Some(format!("unknown upstream branch: {upstream}")));
    };
    let target = format!("HEAD:refs/heads/{branch}");
    match run(root, &["push", remote, &target], REMOTE_TIMEOUT).await {
        Ok(_) => (ahead, None),
        Err(message) => (0, Some(message)),
    }
}

/// The diff of the staged files, or of every change when nothing is staged, cut to `MAX_DIFF` bytes. A coding
/// agent reads it to write the commit message.
#[tauri::command]
pub async fn git_commit_diff(root: String) -> Result<String, String> {
    known_root(&root)?;
    let staged = run(&root, &["-c", "core.quotepath=off", "diff", "--cached", "--no-color", "--no-ext-diff"], LOCAL_TIMEOUT).await?;
    let diff = if staged.trim().is_empty() {
        let target = if has_head(&root).await { "HEAD" } else { "--cached" };
        run(&root, &["-c", "core.quotepath=off", "diff", "--no-color", "--no-ext-diff", target], LOCAL_TIMEOUT).await?
    } else {
        staged
    };
    Ok(cut(diff, MAX_DIFF))
}

/// Cuts `text` to at most `max` bytes, on a character boundary.
fn cut(mut text: String, max: usize) -> String {
    if text.len() <= max {
        return text;
    }
    let mut end = max;
    while text.is_char_boundary(end) == false {
        end -= 1;
    }
    text.truncate(end);
    text
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::remember_root;
    use std::path::PathBuf;

    /// A temporary Git repository with one commit of the file `kept.txt`.
    struct Repository {
        folder: PathBuf,
    }

    impl Repository {
        fn new(name: &str) -> Self {
            let folder = std::env::temp_dir().join(format!("heidrun_source_control_{name}_{}", std::process::id()));
            let _ = std::fs::remove_dir_all(&folder);
            std::fs::create_dir_all(&folder).unwrap();
            let repository = Repository { folder };
            repository.git(&["init", "--quiet", "--initial-branch=main"]);
            repository.git(&["config", "user.email", "test@example.com"]);
            repository.git(&["config", "user.name", "Test"]);
            repository.write("kept.txt", "first\n");
            repository.git(&["add", "kept.txt"]);
            repository.git(&["commit", "--quiet", "--message", "first"]);
            remember_root(&repository.root());
            repository
        }

        fn root(&self) -> String {
            self.folder.to_string_lossy().into_owned()
        }

        fn write(&self, path: &str, text: &str) {
            std::fs::write(self.folder.join(path), text).unwrap();
        }

        fn read(&self, path: &str) -> Option<String> {
            std::fs::read_to_string(self.folder.join(path)).ok()
        }

        fn git(&self, args: &[&str]) -> String {
            let output = std::process::Command::new("git").arg("-C").arg(&self.folder).args(args).output().unwrap();
            String::from_utf8_lossy(&output.stdout).into_owned()
        }

        fn status(&self) -> String {
            self.git(&["status", "--porcelain"])
        }
    }

    impl Drop for Repository {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.folder);
        }
    }

    #[tokio::test]
    async fn stages_then_unstages_a_changed_file() {
        let repository = Repository::new("stage");
        repository.write("kept.txt", "second\n");
        git_stage(repository.root(), vec!["kept.txt".into()]).await.unwrap();
        assert_eq!(repository.status(), "M  kept.txt\n");
        git_unstage(repository.root(), vec!["kept.txt".into()]).await.unwrap();
        assert_eq!(repository.status(), " M kept.txt\n");
    }

    #[tokio::test]
    async fn discards_a_changed_file_and_deletes_a_new_file() {
        let repository = Repository::new("discard");
        repository.write("kept.txt", "second\n");
        repository.write("new.txt", "new\n");
        git_discard(repository.root(), vec!["kept.txt".into(), "new.txt".into()]).await.unwrap();
        assert_eq!(repository.read("kept.txt").as_deref(), Some("first\n"));
        assert_eq!(repository.read("new.txt"), None);
        assert_eq!(repository.status(), "");
    }

    #[tokio::test]
    async fn commits_the_staged_files_and_amends_the_last_commit() {
        let repository = Repository::new("commit");
        repository.write("kept.txt", "second\n");
        git_stage(repository.root(), vec!["kept.txt".into()]).await.unwrap();
        git_commit(repository.root(), "Change the kept file".into(), false).await.unwrap();
        assert_eq!(repository.git(&["log", "-1", "--format=%s"]), "Change the kept file\n");
        git_commit(repository.root(), "Change the kept file again".into(), true).await.unwrap();
        assert_eq!(repository.git(&["log", "--format=%s"]), "Change the kept file again\nfirst\n");
    }

    #[tokio::test]
    async fn refuses_an_empty_commit_message() {
        let repository = Repository::new("empty_message");
        assert!(git_commit(repository.root(), "  ".into(), false).await.is_err());
    }

    #[tokio::test]
    async fn gives_the_staged_diff_or_every_change_when_nothing_is_staged() {
        let repository = Repository::new("diff");
        repository.write("kept.txt", "second\n");
        let every_change = git_commit_diff(repository.root()).await.unwrap();
        assert!(every_change.contains("+second"));
        repository.write("other.txt", "other\n");
        git_stage(repository.root(), vec!["other.txt".into()]).await.unwrap();
        let staged = git_commit_diff(repository.root()).await.unwrap();
        assert!(staged.contains("+other"));
        assert!(staged.contains("+second") == false);
    }

    #[tokio::test]
    async fn lists_the_local_branches_and_checks_one_out() {
        let repository = Repository::new("branches");
        repository.git(&["branch", "other"]);
        let branches = git_branches(repository.root()).await.unwrap();
        let names: Vec<&str> = branches.iter().map(|branch| branch.name.as_str()).collect();
        assert_eq!(names.len(), 2);
        assert!(names.contains(&"main") && names.contains(&"other"));
        let main = branches.iter().find(|branch| branch.name == "main").unwrap();
        assert!(main.is_current);
        assert_eq!(main.last_subject, "first");
        assert_eq!(main.last_author, "Test");
        git_checkout(repository.root(), "other".into()).await.unwrap();
        assert_eq!(repository.git(&["branch", "--show-current"]), "other\n");
    }

    #[tokio::test]
    async fn tells_which_local_branches_have_a_remote_tracking_branch() {
        let repository = Repository::new("remote_tracking");
        repository.git(&["branch", "pushed"]);
        repository.git(&["branch", "only_local"]);
        repository.git(&["update-ref", "refs/remotes/origin/pushed", "HEAD"]);
        let branches = git_branches(repository.root()).await.unwrap();
        let has_remote = |name: &str| branches.iter().find(|branch| branch.name == name).unwrap().has_remote_tracking;
        assert!(has_remote("pushed"));
        assert!(has_remote("only_local") == false);
        assert!(has_remote("main") == false);
    }

    #[tokio::test]
    async fn lists_the_branches_of_the_remote_repository() {
        let repository = Repository::new("remote_branches");
        let remote = std::env::temp_dir().join(format!("heidrun_source_control_remote_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&remote);
        std::process::Command::new("git").args(["init", "--quiet", "--bare"]).arg(&remote).output().unwrap();
        repository.git(&["remote", "add", "origin", &remote.to_string_lossy()]);
        repository.git(&["branch", "other"]);
        repository.git(&["push", "--quiet", "origin", "main", "other"]);
        repository.git(&["branch", "only_local"]);
        let mut names = git_remote_branches(repository.root()).await.unwrap();
        names.sort();
        assert_eq!(names, vec!["main".to_string(), "other".to_string()]);
        let _ = std::fs::remove_dir_all(&remote);
    }

    /// A repository `origin` (bare), and a clone of it in `repository.folder` named `second`, with one commit in common.
    struct Remote {
        bare: PathBuf,
    }

    impl Remote {
        fn new(repository: &Repository) -> Self {
            let bare = std::env::temp_dir().join(format!("heidrun_merge_remote_{}", repository.folder.file_name().unwrap().to_string_lossy()));
            let _ = std::fs::remove_dir_all(&bare);
            std::process::Command::new("git").args(["init", "--quiet", "--bare", "--initial-branch=main"]).arg(&bare).output().unwrap();
            repository.git(&["remote", "add", "origin", &bare.to_string_lossy()]);
            repository.git(&["push", "--quiet", "--set-upstream", "origin", "main"]);
            Remote { bare }
        }

        /// The commit that the branch `main` of the remote repository points to.
        fn head_of_main(&self) -> String {
            let output = std::process::Command::new("git").arg("-C").arg(&self.bare).args(["rev-parse", "main"]).output().unwrap();
            String::from_utf8_lossy(&output.stdout).trim().to_string()
        }

        /// Makes a commit of `text` in the file `path` from a second clone, and pushes it.
        fn push_from_another_clone(&self, path: &str, text: &str) {
            let clone = self.bare.with_extension("clone");
            let _ = std::fs::remove_dir_all(&clone);
            std::process::Command::new("git").args(["clone", "--quiet"]).arg(&self.bare).arg(&clone).output().unwrap();
            let git = |args: &[&str]| {
                std::process::Command::new("git").arg("-C").arg(&clone).args(args).output().unwrap();
            };
            git(&["config", "user.email", "other@example.com"]);
            git(&["config", "user.name", "Other"]);
            std::fs::write(clone.join(path), text).unwrap();
            git(&["add", path]);
            git(&["commit", "--quiet", "--message", "from the remote"]);
            git(&["push", "--quiet", "origin", "main"]);
            let _ = std::fs::remove_dir_all(&clone);
        }
    }

    impl Drop for Remote {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.bare);
        }
    }

    #[tokio::test]
    async fn synchronizes_by_fetching_then_merging_the_upstream_branch() {
        let repository = Repository::new("merge_upstream");
        let remote = Remote::new(&repository);
        remote.push_from_another_clone("new.txt", "new\n");
        let result = git_synchronize(repository.root()).await.unwrap();
        assert_eq!(result.outcome, "merged");
        assert_eq!(result.upstream, "origin/main");
        assert_eq!(repository.read("new.txt").as_deref(), Some("new\n"));
        assert_eq!(result.pushed, 0);
        assert_eq!(result.push_error, None);
    }

    #[tokio::test]
    async fn pushes_the_commits_that_the_upstream_branch_does_not_have() {
        let repository = Repository::new("synchronize_push");
        let remote = Remote::new(&repository);
        repository.write("kept.txt", "local\n");
        repository.git(&["commit", "--quiet", "--all", "--message", "local"]);
        repository.write("second.txt", "second\n");
        repository.git(&["add", "second.txt"]);
        repository.git(&["commit", "--quiet", "--message", "second"]);
        let result = git_synchronize(repository.root()).await.unwrap();
        assert_eq!(result.outcome, "up_to_date");
        assert_eq!(result.pushed, 2);
        assert_eq!(result.push_error, None);
        assert_eq!(remote.head_of_main(), repository.git(&["rev-parse", "HEAD"]).trim());
    }

    #[tokio::test]
    async fn merges_then_pushes_the_merge_and_the_local_commits() {
        let repository = Repository::new("synchronize_merge_push");
        let remote = Remote::new(&repository);
        remote.push_from_another_clone("new.txt", "new\n");
        repository.write("local.txt", "local\n");
        repository.git(&["add", "local.txt"]);
        repository.git(&["commit", "--quiet", "--message", "local"]);
        let result = git_synchronize(repository.root()).await.unwrap();
        assert_eq!(result.outcome, "merged");
        assert_eq!(result.pushed, 2);
        assert_eq!(remote.head_of_main(), repository.git(&["rev-parse", "HEAD"]).trim());
    }

    #[tokio::test]
    async fn pushes_nothing_when_the_merge_stops_on_conflicts() {
        let repository = Repository::new("synchronize_conflict_no_push");
        let remote = Remote::new(&repository);
        let remote_head_before = remote.head_of_main();
        remote.push_from_another_clone("kept.txt", "remote\n");
        let remote_head_after_other = remote.head_of_main();
        repository.write("kept.txt", "local\n");
        repository.git(&["commit", "--quiet", "--all", "--message", "local"]);
        let result = git_synchronize(repository.root()).await.unwrap();
        assert_eq!(result.outcome, "conflict");
        assert_eq!(result.pushed, 0);
        assert_ne!(remote_head_before, remote_head_after_other);
        assert_eq!(remote.head_of_main(), remote_head_after_other);
    }

    #[tokio::test]
    async fn keeps_the_merge_and_tells_why_the_push_failed() {
        let repository = Repository::new("synchronize_push_refused");
        let remote = Remote::new(&repository);
        let hooks = remote.bare.join("hooks");
        std::fs::create_dir_all(&hooks).unwrap();
        let hook = hooks.join("pre-receive");
        std::fs::write(&hook, "#!/bin/sh\necho refused by the test >&2\nexit 1\n").unwrap();
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&hook, std::fs::Permissions::from_mode(0o755)).unwrap();
        repository.write("kept.txt", "local\n");
        repository.git(&["commit", "--quiet", "--all", "--message", "local"]);
        let result = git_synchronize(repository.root()).await.unwrap();
        assert_eq!(result.outcome, "up_to_date");
        assert_eq!(result.pushed, 0);
        assert!(result.push_error.unwrap().contains("refused by the test"));
    }

    #[tokio::test]
    async fn says_up_to_date_when_there_is_nothing_to_merge() {
        let repository = Repository::new("merge_up_to_date");
        let _remote = Remote::new(&repository);
        let result = git_synchronize(repository.root()).await.unwrap();
        assert_eq!(result.outcome, "up_to_date");
        assert!(result.conflicts.is_empty());
    }

    #[tokio::test]
    async fn lists_the_files_in_conflict_and_keeps_the_merge_open() {
        let repository = Repository::new("merge_conflict");
        let remote = Remote::new(&repository);
        remote.push_from_another_clone("kept.txt", "remote\n");
        repository.write("kept.txt", "local\n");
        repository.git(&["commit", "--quiet", "--all", "--message", "local"]);
        let result = git_synchronize(repository.root()).await.unwrap();
        assert_eq!(result.outcome, "conflict");
        assert_eq!(result.conflicts, vec!["kept.txt".to_string()]);
        assert!(repository.status().starts_with("UU kept.txt"));
    }

    #[tokio::test]
    async fn refuses_to_merge_without_an_upstream_branch() {
        let repository = Repository::new("merge_no_upstream");
        let answer = git_synchronize(repository.root()).await;
        assert_eq!(answer, Err("no upstream branch".to_string()));
    }

    #[tokio::test]
    async fn refuses_to_merge_over_a_change_that_would_be_overwritten() {
        let repository = Repository::new("merge_dirty");
        let remote = Remote::new(&repository);
        remote.push_from_another_clone("kept.txt", "remote\n");
        repository.write("kept.txt", "local\n");
        let answer = git_synchronize(repository.root()).await;
        assert!(answer.is_err());
        assert_eq!(repository.read("kept.txt").as_deref(), Some("local\n"));
    }

    #[tokio::test]
    async fn refuses_to_check_out_an_unknown_branch_and_a_branch_that_looks_like_an_option() {
        let repository = Repository::new("checkout_refused");
        assert!(git_checkout(repository.root(), "missing".into()).await.is_err());
        assert!(git_checkout(repository.root(), "--detach".into()).await.is_err());
        assert_eq!(repository.git(&["branch", "--show-current"]), "main\n");
    }

    #[tokio::test]
    async fn keeps_the_branch_when_a_change_would_be_lost() {
        let repository = Repository::new("checkout_conflict");
        repository.git(&["switch", "--quiet", "--create", "other"]);
        repository.write("kept.txt", "other\n");
        repository.git(&["commit", "--quiet", "--all", "--message", "other"]);
        repository.git(&["switch", "--quiet", "main"]);
        repository.write("kept.txt", "local\n");
        let answer = git_checkout(repository.root(), "other".into()).await;
        assert!(answer.is_err());
        assert_eq!(repository.git(&["branch", "--show-current"]), "main\n");
        assert_eq!(repository.read("kept.txt").as_deref(), Some("local\n"));
    }

    #[tokio::test]
    async fn refuses_a_root_that_git_status_did_not_give() {
        let answer = git_stage("/tmp/not_a_known_root".into(), vec!["file.txt".into()]).await;
        assert!(answer.is_err());
    }

    #[tokio::test]
    async fn refuses_a_path_outside_the_repository() {
        let repository = Repository::new("outside");
        assert!(git_stage(repository.root(), vec!["../outside.txt".into()]).await.is_err());
        assert!(git_discard(repository.root(), vec!["/etc/hosts".into()]).await.is_err());
    }

    #[test]
    fn cuts_a_text_on_a_character_boundary() {
        assert_eq!(cut("abcé".into(), 4), "abc");
        assert_eq!(cut("abc".into(), 10), "abc");
    }
}
