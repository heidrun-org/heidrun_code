//! Git state of a workspace folder, and calls to the forge CLIs (glab / gh).
//!
//! The forge part goes through the user's login shell so `glab` and `gh` are
//! found (Homebrew paths) and use the accounts already connected on the Mac:
//! the app never handles a token.

use coding_agent_cli::login_shell;
use serde::Serialize;
use std::time::Duration;
use tokio::process::Command;

#[derive(Serialize, Default)]
pub struct GitFile {
    pub status: String,
    pub path: String,
}

#[derive(Serialize, Default)]
pub struct GitStatus {
    pub root: String,
    pub branch: Option<String>,
    pub upstream: Option<String>,
    pub ahead: u32,
    pub behind: u32,
    pub changed: u32,
    pub untracked: u32,
    pub files: Vec<GitFile>,
    pub last_sha: Option<String>,
    pub last_subject: Option<String>,
    pub last_time: Option<i64>,
    pub remote: Option<String>,
}

#[derive(Serialize)]
pub struct GitWorktree {
    pub folder: String,
    pub branch: Option<String>,
    pub created_at: Option<i64>,
    pub last_commit_at: Option<i64>,
}

async fn worktree_details(folder: String, branch: Option<String>) -> GitWorktree {
    let created_at = std::fs::metadata(&folder)
        .and_then(|metadata| metadata.created())
        .ok()
        .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|duration| duration.as_secs() as i64);
    let last_commit_at = git(&folder, &["log", "-1", "--format=%ct"])
        .await
        .and_then(|time| time.trim().parse().ok());
    GitWorktree { folder, branch, created_at, last_commit_at }
}

async fn git(cwd: &str, args: &[&str]) -> Option<String> {
    let out = tokio::time::timeout(
        Duration::from_secs(8),
        Command::new("git").arg("-C").arg(cwd).args(args).kill_on_drop(true).output(),
    )
    .await
    .ok()?
    .ok()?;
    out.status.success().then(|| String::from_utf8_lossy(&out.stdout).into_owned())
}

/// Names with quotes or control characters are still C-quoted by git, even with
/// core.quotepath=off: strip the quotes and the simple escapes.
fn unquote(p: &str) -> String {
    if p.len() >= 2 && p.starts_with('"') && p.ends_with('"') {
        p[1..p.len() - 1].replace("\\\"", "\"").replace("\\t", "\t").replace("\\\\", "\\")
    } else {
        p.to_string()
    }
}

/// Roots returned by git_status: the only ones git_diff / git_file accept, so the
/// webview cannot point them at an arbitrary folder.
static ROOTS: std::sync::OnceLock<std::sync::Mutex<std::collections::HashSet<String>>> = std::sync::OnceLock::new();

pub(crate) fn remember_root(root: &str) {
    ROOTS.get_or_init(Default::default).lock().unwrap().insert(root.to_string());
}

pub(crate) fn known_root(root: &str) -> Result<(), String> {
    if ROOTS.get_or_init(Default::default).lock().unwrap().contains(root) {
        Ok(())
    } else {
        Err("dépôt inconnu".into())
    }
}

/// git for diff / show, with paths taken literally (no globs, no pathspec magic).
fn git_literal(root: &str) -> Command {
    let mut c = Command::new("git");
    c.arg("-C").arg(root).env("GIT_LITERAL_PATHSPECS", "1").kill_on_drop(true);
    c
}

/// Parses `git status --porcelain=v2 --branch`.
fn parse_status(text: &str, st: &mut GitStatus) {
    for line in text.lines() {
        if let Some(rest) = line.strip_prefix("# branch.head ") {
            if rest != "(detached)" {
                st.branch = Some(rest.to_string());
            }
        } else if let Some(rest) = line.strip_prefix("# branch.upstream ") {
            st.upstream = Some(rest.to_string());
        } else if let Some(rest) = line.strip_prefix("# branch.ab ") {
            for part in rest.split_whitespace() {
                if let Some(n) = part.strip_prefix('+') {
                    st.ahead = n.parse().unwrap_or(0);
                } else if let Some(n) = part.strip_prefix('-') {
                    st.behind = n.parse().unwrap_or(0);
                }
            }
        } else if let Some(path) = line.strip_prefix("? ") {
            st.untracked += 1;
            if st.files.len() < 500 {
                st.files.push(GitFile { status: "??".into(), path: unquote(path) });
            }
        } else if line.starts_with("1 ") || line.starts_with("2 ") || line.starts_with("u ") {
            st.changed += 1;
            let mut parts = line.split(' ');
            let kind = parts.next().unwrap_or("");
            let xy = parts.next().unwrap_or("").to_string();
            // Fields before the path: 1 → 6 more, 2 → 7 more (+ "orig\tpath"), u → 8 more.
            let skip = match kind { "1" => 6, "2" => 7, _ => 8 };
            let path: String = parts.skip(skip).collect::<Vec<_>>().join(" ");
            let path = unquote(path.split('\t').next().unwrap_or(""));
            if st.files.len() < 500 {
                st.files.push(GitFile { status: xy, path });
            }
        }
    }
}

/// Branch, ahead / behind, modified files and last commit of the repository
/// containing `cwd`; `None` when it is not a Git repository.
#[tauri::command]
pub async fn git_status(cwd: String) -> Option<GitStatus> {
    let root = git(&cwd, &["rev-parse", "--show-toplevel"]).await?.trim().to_string();
    let mut st = GitStatus { root: root.clone(), ..Default::default() };
    remember_root(&root);
    if let Some(text) = git(&root, &["-c", "core.quotepath=off", "status", "--porcelain=v2", "--branch", "--untracked-files=all"]).await {
        parse_status(&text, &mut st);
    }
    if let Some(log) = git(&root, &["log", "-1", "--format=%h%x1f%s%x1f%ct"]).await {
        let mut it = log.trim().split('\u{1f}');
        st.last_sha = it.next().map(str::to_string).filter(|s| !s.is_empty());
        st.last_subject = it.next().map(str::to_string);
        st.last_time = it.next().and_then(|t| t.parse().ok());
    }
    st.remote = git(&root, &["config", "--get", "remote.origin.url"]).await.map(|s| s.trim().to_string());
    Some(st)
}

/// Lists the current worktrees of a known repository and omits folders that no longer exist.
#[tauri::command]
pub async fn git_worktrees(root: String) -> Result<Vec<GitWorktree>, String> {
    known_root(&root)?;
    let output = tokio::time::timeout(
        Duration::from_secs(8),
        Command::new("git")
            .arg("-C")
            .arg(&root)
            .args(["worktree", "list", "--porcelain", "-z"])
            .kill_on_drop(true)
            .output(),
    )
    .await
    .map_err(|_| "Git worktree listing timed out.".to_string())?
    .map_err(|error| format!("Git worktree listing failed: {error}"))?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    let text = String::from_utf8_lossy(&output.stdout);
    let mut found = Vec::new();
    let mut folder: Option<String> = None;
    let mut branch = None;
    for field in text.split('\0') {
        if let Some(path) = field.strip_prefix("worktree ") {
            if let Some(previous) = folder.take() {
                if std::path::Path::new(&previous).is_dir() {
                    found.push(worktree_details(previous, branch.take()).await);
                }
            }
            folder = Some(path.to_string());
            branch = None;
        } else if let Some(name) = field.strip_prefix("branch refs/heads/") {
            branch = Some(name.to_string());
        } else if field == "detached" {
            branch = None;
        }
    }
    if let Some(folder) = folder {
        if std::path::Path::new(&folder).is_dir() {
            found.push(worktree_details(folder, branch).await);
        }
    }
    Ok(found)
}

/// A path inside the repository, as git prints it (relative, no "..").
pub(crate) fn safe_rel(path: &str) -> Result<&str, String> {
    let p = std::path::Path::new(path);
    if path.is_empty() || p.is_absolute() || p.components().any(|c| matches!(c, std::path::Component::ParentDir)) {
        return Err("chemin refusé".into());
    }
    Ok(path)
}

const MAX_TEXT: usize = 1_500_000;

fn as_text(bytes: Vec<u8>) -> Result<String, String> {
    if bytes.len() > MAX_TEXT {
        return Err(format!("fichier trop gros pour l’aperçu ({} Ko)", bytes.len() / 1024));
    }
    if bytes.iter().take(8000).any(|b| *b == 0) {
        return Err("fichier binaire".into());
    }
    Ok(String::from_utf8_lossy(&bytes).into_owned())
}

/// Unified diff of one file against HEAD (staged and unstaged changes together).
/// A file that is not in HEAD (new, untracked) is shown as entirely added.
#[tauri::command]
pub async fn git_diff(root: String, path: String) -> Result<String, String> {
    known_root(&root)?;
    let rel = safe_rel(&path)?;
    let spec = format!("HEAD:{rel}");
    let in_head = git_literal(&root).args(["cat-file", "-e", &spec]).output().await.map(|o| o.status.success()).unwrap_or(false);
    let mut cmd = git_literal(&root);
    cmd.args(["-c", "core.quotepath=off", "diff", "--no-color", "--no-ext-diff", "-U3"]);
    if in_head {
        cmd.args(["HEAD", "--", rel]);
    } else {
        cmd.args(["--no-index", "--", "/dev/null", rel]);
    }
    let out = tokio::time::timeout(Duration::from_secs(8), cmd.output())
        .await
        .map_err(|_| "git diff : pas de réponse".to_string())?
        .map_err(|e| e.to_string())?;
    // `--no-index` exits with 1 when the files differ; anything else is an error.
    let code = out.status.code().unwrap_or(-1);
    if code != 0 && !(code == 1 && !in_head) {
        let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
        return Err(if err.is_empty() { format!("git diff a échoué ({code})") } else { err });
    }
    as_text(out.stdout)
}

/// Content of a file: the working copy, or `rev` ("HEAD") from git.
#[tauri::command]
pub async fn git_file(root: String, path: String, rev: Option<String>) -> Result<String, String> {
    known_root(&root)?;
    let rel = safe_rel(&path)?;
    match rev.as_deref() {
        None => {
            let base = std::fs::canonicalize(&root).map_err(|e| e.to_string())?;
            let full = base.join(rel);
            // No symlinks: one could point anywhere on the disk (~/.ssh…).
            let meta = std::fs::symlink_metadata(&full).map_err(|_| "fichier supprimé ou introuvable".to_string())?;
            if meta.file_type().is_symlink() {
                return Err("lien symbolique : contenu non affiché".into());
            }
            let real = std::fs::canonicalize(&full).map_err(|e| e.to_string())?;
            if !real.starts_with(&base) {
                return Err("chemin hors du dépôt".into());
            }
            if meta.len() as usize > MAX_TEXT {
                return Err(format!("fichier trop gros pour l’aperçu ({} Ko)", meta.len() / 1024));
            }
            as_text(std::fs::read(real).map_err(|e| e.to_string())?)
        }
        Some("HEAD") => {
            let spec = format!("HEAD:{rel}");
            let size = git_literal(&root).args(["cat-file", "-s", &spec]).output().await.map_err(|e| e.to_string())?;
            if !size.status.success() {
                return Err("absent de HEAD (nouveau fichier)".into());
            }
            let n: usize = String::from_utf8_lossy(&size.stdout).trim().parse().unwrap_or(0);
            if n > MAX_TEXT {
                return Err(format!("fichier trop gros pour l’aperçu ({} Ko)", n / 1024));
            }
            let out = tokio::time::timeout(Duration::from_secs(8), git_literal(&root).args(["show", &spec]).output())
                .await
                .map_err(|_| "git show : pas de réponse".to_string())?
                .map_err(|e| e.to_string())?;
            as_text(out.stdout)
        }
        Some(_) => Err("révision non prise en charge".into()),
    }
}

/// Read-only calls the app makes, and nothing else: `glab api <path>` (GET only, a path of a project, or the
/// user who is signed in) and `gh pr list` / `gh issue list` / `gh run list`. `gh issue list` and `gh pr list`
/// also accept `--search <text>` (issue #374). Anything that could change the forge or run
/// code (`gh alias set --shell`, `glab mr merge`, `api -X DELETE`…) is refused.
pub(crate) fn allowed(tool: &str, args: &[String]) -> bool {
    let a: Vec<&str> = args.iter().map(String::as_str).collect();
    match tool {
        "glab" => {
            a.first() == Some(&"api")
                && a.len() == 2
                && (a[1].starts_with("projects/") || a[1] == "user")
        }
        "gh" => {
            let is_list = matches!(a.get(..2), Some(["pr", "list"]) | Some(["issue", "list"]));
            let read_only = is_list
                || matches!(a.get(..2), Some(["run", "list"]) | Some(["issue", "view"]) | Some(["pr", "view"]));
            let mut index = 2;
            while index < a.len() {
                let x = a[index];
                if is_list && matches!(x, "--search" | "-S") {
                    // The next argument is the text of a search. It may start with "-" ("-label:bug"), and `gh`
                    // reads it as the value of the flag, never as another flag.
                    if index + 1 >= a.len() {
                        return false;
                    }
                    index += 2;
                    continue;
                }
                if x.starts_with('-') && !matches!(x, "--json" | "--limit" | "--branch" | "--state" | "--repo") {
                    return false;
                }
                index += 1;
            }
            read_only
        }
        _ => false,
    }
}

/// Runs `glab` / `gh` in the repository through the login shell (Homebrew PATH,
/// accounts already connected). `exec "$0" "$@"` passes arguments as is.
pub(crate) async fn run_forge(cwd: &str, tool: &str, args: &[String], timeout: u64) -> Result<String, String> {
    let mut cmd = Command::new(login_shell());
    cmd.arg("-lc").arg("exec \"$0\" \"$@\"").arg(tool).args(args).current_dir(cwd).kill_on_drop(true);
    cmd.env("NO_COLOR", "1").env("NO_PROMPT", "1").env("GLAB_NO_PROMPT", "1").env("GH_PROMPT_DISABLED", "1");
    let out = tokio::time::timeout(Duration::from_secs(timeout), cmd.output())
        .await
        .map_err(|_| format!("{tool} : pas de réponse en {timeout} s"))?
        .map_err(|e| format!("{tool} : {e}"))?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).into_owned())
    } else {
        let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
        Err(if err.is_empty() { format!("{tool} a échoué ({})", out.status) } else { err })
    }
}

/// The time when the exceeded GitHub rate limit resets, in seconds since 1970, or `None` when no limit is exceeded. It
/// reads `gh api rate_limit`, which GitHub does not count in the rate limit (issue #869).
#[tauri::command]
pub async fn forge_rate_limit_reset(cwd: String) -> Result<Option<u64>, String> {
    let args = ["api", "rate_limit"].map(String::from);
    let output = run_forge(&cwd, "gh", &args, 20).await?;
    rate_limit_reset_of(&output)
}

/// The latest reset time of the GitHub resources that have no request left, in the answer of `gh api rate_limit`.
pub(crate) fn rate_limit_reset_of(output: &str) -> Result<Option<u64>, String> {
    let answer: serde_json::Value = serde_json::from_str(output).map_err(|e| e.to_string())?;
    let Some(resources) = answer.get("resources").and_then(|r| r.as_object()) else {
        return Err("gh api rate_limit : pas de ressources".into());
    };
    Ok(resources
        .values()
        .filter(|resource| resource.get("remaining").and_then(|r| r.as_u64()) == Some(0))
        .filter_map(|resource| resource.get("reset").and_then(|r| r.as_u64()))
        .max())
}

/// Merges a MR / PR, after the user confirmed it in the app. `sha` is the head
/// commit the user saw: if someone pushed since, the forge refuses the merge.
#[tauri::command]
pub async fn forge_merge(
    root: String,
    forge: String,
    number: u64,
    sha: Option<String>,
    method: String,
    delete_branch: bool,
    branch: Option<String>,
) -> Result<String, String> {
    known_root(&root)?;
    // A branch name as git allows it, nothing that could be read as a path trick.
    let branch = branch.filter(|b| !b.is_empty() && !b.contains("..") && b.chars().all(|c| c.is_ascii_alphanumeric() || "/._-".contains(c)));
    let sha = sha.filter(|s| s.len() >= 7 && s.chars().all(|c| c.is_ascii_hexdigit()));
    let mut args: Vec<String> = Vec::new();
    let tool = match forge.as_str() {
        "gitlab" => {
            args.extend(["mr", "merge", &number.to_string(), "--yes"].map(String::from));
            match method.as_str() {
                "squash" => args.push("--squash".into()),
                "rebase" => args.push("--rebase".into()),
                _ => {}
            }
            if delete_branch {
                args.push("--remove-source-branch".into());
            }
            if let Some(s) = &sha {
                args.extend(["--sha".to_string(), s.clone()]);
            }
            "glab"
        }
        "github" => {
            args.extend(["pr", "merge", &number.to_string()].map(String::from));
            args.push(match method.as_str() {
                "squash" => "--squash".into(),
                "rebase" => "--rebase".into(),
                _ => "--merge".into(),
            });
            // No --delete-branch: gh would also delete the local branch and switch
            // the working copy, under the feet of the agent working in it. The remote
            // branch is deleted through the API below instead.
            if let Some(s) = &sha {
                args.extend(["--match-head-commit".to_string(), s.clone()]);
            }
            "gh"
        }
        _ => return Err("hébergeur inconnu".into()),
    };
    let out = run_forge(&root, tool, &args, 60).await?;
    if forge == "github" && delete_branch {
        if let Some(b) = branch {
            let path = format!("repos/{{owner}}/{{repo}}/git/refs/heads/{b}");
            let del = ["api", "-X", "DELETE", &path].map(String::from);
            if let Err(e) = run_forge(&root, "gh", &del, 20).await {
                return Ok(format!("fusionnée, mais la branche distante n’a pas été supprimée : {e}"));
            }
        }
    }
    Ok(if out.trim().is_empty() { "ok".into() } else { out })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn gives_the_reset_of_the_exceeded_rate_limit() {
        let exceeded = r#"{"resources":{"core":{"limit":5000,"remaining":0,"reset":1792933288},
"graphql":{"limit":5000,"remaining":0,"reset":1792933644},"search":{"limit":30,"remaining":30,"reset":1792933999}}}"#;
        assert_eq!(rate_limit_reset_of(exceeded), Ok(Some(1792933644)));
        let fine = r#"{"resources":{"graphql":{"limit":5000,"remaining":3859,"reset":1792933644}}}"#;
        assert_eq!(rate_limit_reset_of(fine), Ok(None));
        assert!(rate_limit_reset_of("{}").is_err());
        assert!(rate_limit_reset_of("not json").is_err());
    }

    #[test]
    fn parses_porcelain_v2() {
        let text = "# branch.oid abc\n# branch.head feat/x\n# branch.upstream origin/feat/x\n# branch.ab +2 -1\n\
1 .M N... 100644 100644 100644 aaa bbb src/main.rs\n\
2 R. N... 100644 100644 100644 aaa bbb R100 new name.rs\told.rs\n\
? notes.txt\n";
        let mut st = GitStatus::default();
        parse_status(text, &mut st);
        assert_eq!(st.branch.as_deref(), Some("feat/x"));
        assert_eq!(st.upstream.as_deref(), Some("origin/feat/x"));
        assert_eq!((st.ahead, st.behind), (2, 1));
        assert_eq!(st.changed, 2);
        assert_eq!(st.untracked, 1);
        assert_eq!(st.files[0].path, "src/main.rs");
        assert_eq!(st.files[1].path, "new name.rs");
        assert_eq!(st.files[2].status, "??");
    }

    #[test]
    fn only_read_only_forge_calls() {
        let v = |x: &[&str]| x.iter().map(|s| s.to_string()).collect::<Vec<_>>();
        assert!(allowed("glab", &v(&["api", "projects/:fullpath/merge_requests?state=opened"])));
        assert!(!allowed("glab", &v(&["api", "-X", "DELETE", "projects/:fullpath"])));
        assert!(!allowed("glab", &v(&["mr", "merge", "1"])));
        assert!(allowed("gh", &v(&["pr", "list", "--limit", "20", "--json", "number,title"])));
        assert!(allowed("gh", &v(&["issue", "list", "--state", "open", "--limit", "100", "--json", "number,title,url"])));
        assert!(!allowed("gh", &v(&["issue", "list", "--web"])));
        assert!(allowed("gh", &v(&["issue", "list", "--search", "author:@me label:bug", "--state", "open", "--json", "number"])));
        assert!(allowed("gh", &v(&["issue", "list", "--search", "-label:bug", "--limit", "100"])));
        assert!(allowed("gh", &v(&["pr", "list", "-S", "review-requested:@me", "--json", "number"])));
        assert!(!allowed("gh", &v(&["issue", "list", "--search"])));
        assert!(!allowed("gh", &v(&["issue", "list", "--search", "x", "--web"])));
        assert!(!allowed("gh", &v(&["issue", "list", "--search", "x", "--search"])));
        assert!(!allowed("gh", &v(&["issue", "view", "12", "--search", "x"])));
        assert!(!allowed("gh", &v(&["run", "list", "--search", "x"])));
        assert!(allowed("glab", &v(&["api", "user"])));
        assert!(!allowed("glab", &v(&["api", "users"])));
        assert!(!allowed("glab", &v(&["api", "user/keys"])));
        assert!(!allowed("glab", &v(&["api", "user", "-X", "DELETE"])));
        assert!(allowed("glab", &v(&["api", "projects/:fullpath/issues?state=opened&per_page=100&with_labels_details=true"])));
        assert!(allowed("gh", &v(&["run", "list", "--branch", "x", "--limit", "1", "--json", "status"])));
        assert!(!allowed("gh", &v(&["alias", "set", "--shell", "x", "rm -rf ~"])));
        assert!(!allowed("gh", &v(&["pr", "merge", "1"])));
        assert!(allowed("gh", &v(&["issue", "view", "12", "--json", "title,body", "--repo", "o/r"])));
        assert!(!allowed("gh", &v(&["issue", "close", "12"])));
        assert!(!allowed("gh", &v(&["issue", "view", "12", "--web"])));
        assert!(!allowed("gh", &v(&["api", "-X", "DELETE", "repos/x"])));
        assert!(!allowed("sh", &v(&["-c", "id"])));
    }
}

#[cfg(test)]
mod path_tests {
    use super::*;

    #[test]
    fn removes_the_quotes_git_adds_around_odd_names() {
        assert_eq!(unquote("\"a b\""), "a b");
        assert_eq!(unquote("\"say \\\"hi\\\"\""), "say \"hi\"");
        assert_eq!(unquote("\"tab\\there\""), "tab\there");
        assert_eq!(unquote("plain.txt"), "plain.txt");
        assert_eq!(unquote("\""), "\"");
    }

    #[test]
    fn accepts_only_relative_paths_inside_the_repository() {
        assert_eq!(safe_rel("src/main.rs").unwrap(), "src/main.rs");
        assert!(safe_rel("").is_err());
        assert!(safe_rel("/etc/passwd").is_err());
        assert!(safe_rel("../x").is_err());
        assert!(safe_rel("a/../../x").is_err());
    }

    #[test]
    fn refuses_a_forge_tool_that_is_not_known() {
        assert!(!allowed("curl", &["x".to_string()]));
        assert!(!allowed("gh", &[]));
    }

    #[test]
    fn refuses_a_forge_flag_that_is_not_read_only() {
        let v = |x: &[&str]| x.iter().map(|s| s.to_string()).collect::<Vec<_>>();
        assert!(!allowed("gh", &v(&["pr", "list", "--web"])));
        assert!(!allowed("gh", &v(&["pr", "merge", "1"])));
        assert!(allowed("gh", &v(&["issue", "view", "5", "--repo", "a/b"])));
        assert!(!allowed("glab", &v(&["api", "projects/1", "extra"])));
        assert!(!allowed("glab", &v(&["api", "users"])));
    }
}
