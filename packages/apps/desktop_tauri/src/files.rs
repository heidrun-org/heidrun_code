//! File explorer: the project's files (respecting .gitignore), their git state,
//! images, and "open in VS Code". Reading goes through git::git_file, with the
//! same protections (known root, relative path, no symlink escape).

use crate::git::{known_root, remember_root, safe_rel};
use base64::Engine;
use serde::Serialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::time::Duration;
use tokio::process::Command;

const MAX_FILES: usize = 50_000;
/// Folders never walked when the project is not a git repository.
const HEAVY: &[&str] = &[".git", "node_modules", "target", "dist", "build", ".venv", "venv", "__pycache__", ".next", ".nuxt", ".dart_tool", "Pods", "vendor"];

#[derive(Serialize)]
pub struct FileList {
    pub root: String,
    pub git: bool,
    /// Relative paths, "/" separated. Ignored folders (shown on request) end with "/".
    pub files: Vec<String>,
    /// The entries of `files` that Git ignores, written as in `files`. Empty when the option to show ignored files is
    /// off (issue #430).
    pub ignored: Vec<String>,
    /// Submodule folders relative to the project root, without a trailing slash.
    pub submodules: Vec<String>,
    /// The symbolic links to a folder of the project, without a trailing slash. Git lists such a link as a file, so
    /// `files` lists it as a folder, with a trailing "/", and its content is read from the disk (issue #923).
    #[serde(rename = "linkedFolders")]
    pub linked_folders: Vec<String>,
    /// path → git status letter (M, A, D, R, ?).
    pub status: HashMap<String, String>,
    pub truncated: bool,
}

async fn run(dir: &Path, args: &[&str]) -> Option<Vec<u8>> {
    let out = tokio::time::timeout(
        Duration::from_secs(15),
        Command::new("git").arg("-C").arg(dir).args(args).kill_on_drop(true).output(),
    )
    .await
    .ok()?
    .ok()?;
    out.status.success().then_some(out.stdout)
}

fn split_z(bytes: &[u8]) -> impl Iterator<Item = String> + '_ {
    bytes.split(|b| *b == 0).filter(|s| !s.is_empty()).map(|s| String::from_utf8_lossy(s).into_owned())
}

/// Not the whole home folder nor anything above it, and never a place for secrets
/// or system files: a project, not the disk.
fn acceptable_root(root: &Path) -> Result<(), String> {
    let home = dirs::home_dir().unwrap_or_default();
    let home = std::fs::canonicalize(&home).unwrap_or(home);
    if root == Path::new("/") || home.starts_with(root) {
        return Err("Folder too large: open a project, not the home folder".into());
    }
    let private = [".ssh", ".aws", ".gnupg", ".config", ".kube", ".docker", "Library", ".claude", ".codex"];
    if private.iter().any(|d| root.starts_with(home.join(d))) {
        return Err("Private folder: not opened in the File explorer".into());
    }
    for sys in ["/etc", "/private", "/System", "/usr", "/bin", "/sbin", "/var", "/Library", "/dev"] {
        if root.starts_with(sys) {
            return Err("System folder: not opened in the File explorer".into());
        }
    }
    Ok(())
}

/// The folders of live panes and the fixed folders of live workspaces.
async fn pane_dirs() -> Vec<PathBuf> {
    let Ok(v) = crate::herdr::request("session.snapshot", serde_json::json!({})).await else { return vec![] };
    snapshot_dirs(&v)
}

fn snapshot_dirs(v: &serde_json::Value) -> Vec<PathBuf> {
    let panes = v.get("snapshot").and_then(|s| s.get("panes")).and_then(|p| p.as_array()).cloned().unwrap_or_default();
    let mut out = Vec::new();
    for workspace in v.pointer("/snapshot/workspaces").and_then(|value| value.as_array()).into_iter().flatten() {
        if let Some(folder) = workspace.get("workspace_folder").and_then(|value| value.as_str()) {
            if let Ok(folder) = std::fs::canonicalize(folder) {
                out.push(folder);
            }
        }
    }
    for p in panes {
        for key in ["foreground_cwd", "cwd"] {
            if let Some(d) = p.get(key).and_then(|x| x.as_str()).filter(|d| !d.is_empty()) {
                if let Ok(c) = std::fs::canonicalize(d) {
                    out.push(c);
                }
            }
        }
    }
    out
}

/// `root` holds the folder of at least one pane.
async fn used_by_a_pane(root: &Path) -> Result<(), String> {
    if pane_dirs().await.iter().any(|d| d.starts_with(root)) {
        Ok(())
    } else {
        Err("This folder is not the folder of any pane: the File explorer refuses it".into())
    }
}

fn walk(base: &Path, dir: &Path, out: &mut Vec<String>, depth: u8) {
    if out.len() >= MAX_FILES || depth > 20 {
        return;
    }
    let Ok(rd) = std::fs::read_dir(dir) else { return };
    let mut entries: Vec<_> = rd.flatten().collect();
    entries.sort_by_key(|e| e.file_name());
    for e in entries {
        let name = e.file_name().to_string_lossy().into_owned();
        let Ok(ft) = e.file_type() else { continue };
        if ft.is_symlink() {
            continue;
        }
        let p = e.path();
        if ft.is_dir() {
            if HEAVY.contains(&name.as_str()) {
                continue;
            }
            walk(base, &p, out, depth + 1);
        } else if let Ok(rel) = p.strip_prefix(base) {
            out.push(rel.to_string_lossy().replace('\\', "/"));
        }
        if out.len() >= MAX_FILES {
            return;
        }
    }
}

/// The entries of `entries` that are not inside another entry that ends with "/".
fn without_entries_inside_listed_folders(entries: Vec<String>) -> Vec<String> {
    let folders: Vec<String> = entries.iter().filter(|entry| entry.ends_with('/')).cloned().collect();
    entries
        .into_iter()
        .filter(|entry| folders.iter().any(|folder| folder != entry && entry.starts_with(folder.as_str())) == false)
        .collect()
}

/// The files that Git lists for the repository `root`: the tracked files and the new files, sorted. When `show_ignored`
/// is true, the entries that Git ignores are added, and are also returned alone as the second list. An ignored folder is
/// one entry that ends with "/", not its thousands of files. Git never lists the folder `.git` (issue #430). Git lists
/// a folder and an entry inside it when the ignore rule names the entry, for example `.heidrun/` and
/// `.heidrun/config.json`, so every entry inside an ignored folder is dropped: the folder shows once (issue #441).
async fn git_listed_files(root: &Path, show_ignored: bool) -> (Vec<String>, Vec<String>) {
    let listed = run(root, &["-c", "core.quotepath=off", "ls-files", "-z", "--cached", "--others", "--exclude-standard"]).await.unwrap_or_default();
    let mut files: Vec<String> = split_z(&listed).collect();
    files.sort();
    files.dedup();
    let mut ignored_entries: Vec<String> = Vec::new();
    if show_ignored {
        let ign = run(root, &["-c", "core.quotepath=off", "ls-files", "-z", "--others", "--ignored", "--exclude-standard", "--directory"]).await.unwrap_or_default();
        ignored_entries = without_entries_inside_listed_folders(split_z(&ign).collect());
        files.extend(ignored_entries.iter().cloned());
    }
    (files, ignored_entries)
}

/// True when `path` is a symbolic link to a folder inside the project `root`, and the folder is neither the root itself
/// nor inside `.git` (issue #923).
fn is_linked_folder(root: &Path, path: &Path) -> bool {
    let Ok(meta) = std::fs::symlink_metadata(path) else { return false };
    if meta.file_type().is_symlink() == false {
        return false;
    }
    let Ok(real) = std::fs::canonicalize(path) else { return false };
    let Ok(relative) = real.strip_prefix(root) else { return false };
    real.is_dir() && relative.as_os_str().is_empty() == false && not_in_git_dir(&relative.to_string_lossy()).is_ok()
}

/// The files of the project, by repository and submodule.
struct ProjectFiles {
    /// The paths of `FileList::files`.
    files: Vec<String>,
    /// The paths of `FileList::ignored`.
    ignored: Vec<String>,
    /// The paths of `FileList::submodules`.
    submodules: Vec<String>,
    /// The paths of `FileList::linked_folders`.
    linked_folders: Vec<String>,
}

/// Lists each initialized submodule with its own ignore rules. Gitlinks are folders, never files. A symbolic link to a
/// folder of the project is a folder, with a trailing "/", never a file (issue #923).
async fn git_project_files(root: &Path, show_ignored: bool) -> ProjectFiles {
    let mut files = Vec::new();
    let mut ignored = Vec::new();
    let mut submodules = Vec::new();
    let mut linked_folders = Vec::new();
    let mut pending = vec![(root.to_path_buf(), String::new())];
    while let Some((repository, prefix)) = pending.pop() {
        let (listed, ignored_entries) = git_listed_files(&repository, show_ignored).await;
        let index = run(&repository, &["ls-files", "--stage", "-z"]).await.unwrap_or_default();
        let links: std::collections::HashSet<String> = split_z(&index)
            .filter_map(|entry| {
                let (metadata, path) = entry.split_once('\t')?;
                metadata.starts_with("160000 ").then(|| path.to_string())
            })
            .collect();
        let mut linked_here = std::collections::HashSet::new();
        for path in listed {
            if links.contains(&path) {
                continue;
            }
            if path.ends_with('/') == false && is_linked_folder(root, &repository.join(&path)) {
                files.push(format!("{prefix}{path}/"));
                linked_folders.push(format!("{prefix}{path}"));
                linked_here.insert(path);
            } else {
                files.push(format!("{prefix}{path}"));
            }
            if files.len() > MAX_FILES {
                return ProjectFiles { files, ignored, submodules, linked_folders };
            }
        }
        ignored.extend(ignored_entries.into_iter().map(|path| {
            let slash = if linked_here.contains(&path) { "/" } else { "" };
            format!("{prefix}{path}{slash}")
        }));
        for path in links {
            // Refuse paths through symbolic links, outside the root, or inside Git's internal data.
            if safe_rel(&path).is_err() || not_in_git_dir(&path).is_err() {
                continue;
            }
            let folder = repository.join(&path);
            let Ok(real) = std::fs::canonicalize(&folder) else { continue };
            if real != folder || !real.starts_with(root) || !real.is_dir() {
                continue;
            }
            let relative = format!("{prefix}{path}");
            submodules.push(relative.clone());
            // Without this check Git in an uninitialized submodule falls back to the parent repository.
            if folder.join(".git").exists() {
                pending.push((real, format!("{relative}/")));
            }
        }
    }
    files.sort();
    files.dedup();
    submodules.sort();
    linked_folders.sort();
    ProjectFiles { files, ignored, submodules, linked_folders }
}

/// Files of the project containing `cwd`: the git repository (tracked and new files,
/// .gitignore respected), or the folder itself when it is not a repository.
#[tauri::command]
pub async fn files_list(cwd: String, ignored: Option<bool>) -> Result<FileList, String> {
    let dir = std::fs::canonicalize(&cwd).map_err(|_| "folder not found".to_string())?;
    let top = run(&dir, &["rev-parse", "--show-toplevel"]).await.map(|b| String::from_utf8_lossy(&b).trim().to_string());
    let Some(root) = top.filter(|t| !t.is_empty()) else {
        acceptable_root(&dir)?;
        used_by_a_pane(&dir).await?;
        let walk_dir = dir.clone();
        let files = tokio::task::spawn_blocking(move || {
            let mut files = Vec::new();
            walk(&walk_dir, &walk_dir, &mut files, 0);
            files
        })
        .await
        .map_err(|e| e.to_string())?;
        let root = dir.display().to_string();
        remember_root(&root);
        let truncated = files.len() >= MAX_FILES;
        return Ok(FileList { root, git: false, files, ignored: Vec::new(), submodules: Vec::new(), linked_folders: Vec::new(), status: HashMap::new(), truncated });
    };
    let rootp = std::fs::canonicalize(&root).unwrap_or_else(|_| PathBuf::from(&root));
    acceptable_root(&rootp)?;
    used_by_a_pane(&rootp).await?;
    let ProjectFiles { mut files, ignored: ignored_entries, submodules, linked_folders } = git_project_files(&rootp, ignored.unwrap_or(false)).await;
    let truncated = files.len() > MAX_FILES;
    files.truncate(MAX_FILES);
    let mut status = HashMap::new();
    let st = run(&rootp, &["-c", "core.quotepath=off", "status", "--porcelain=v1", "-z", "--untracked-files=all"]).await.unwrap_or_default();
    let mut it = split_z(&st);
    while let Some(entry) = it.next() {
        if entry.len() < 4 {
            continue;
        }
        let (code, path) = entry.split_at(3);
        let code = code.trim();
        let letter = if code == "??" { "?" } else if code.contains('D') { "D" } else if code.contains('A') { "A" } else if code.contains('R') { "R" } else { "M" };
        // A rename is followed by its old path: skip it.
        if code.contains('R') || code.contains('C') {
            it.next();
        }
        status.insert(path.to_string(), letter.to_string());
        // A deleted file is still worth showing in the tree.
        if letter == "D" && !submodules.iter().any(|folder| folder == path) && !files.iter().any(|f| f == path) {
            files.push(path.to_string());
        }
    }
    remember_root(&root);
    Ok(FileList { root, git: true, files, ignored: ignored_entries, submodules, linked_folders, status, truncated })
}

/// The names inside the folder `dir`, one level only: a folder ends with "/", a file does not. A symbolic link is
/// skipped, as in the walk of a folder that is not a repository, and the folder `.git` is never listed, because it holds
/// only the internal data of Git (issue #430).
fn children_of(dir: &Path) -> Result<Vec<String>, String> {
    let mut names = Vec::new();
    for entry in std::fs::read_dir(dir).map_err(|e| e.to_string())?.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        let Ok(file_type) = entry.file_type() else { continue };
        if file_type.is_symlink() || name == ".git" {
            continue;
        }
        names.push(if file_type.is_dir() { format!("{name}/") } else { name });
        if names.len() >= MAX_FILES {
            break;
        }
    }
    names.sort();
    Ok(names)
}

/// The first level of one folder of the project: the folders (with a trailing "/") and the files directly inside it. The
/// sidebar section File explorer asks it when the developer unfolds a folder that Git ignores, because Git does not list
/// the files of such a folder (issue #430), and when the developer unfolds a symbolic link to a folder (issue #923). The
/// folder must be inside a known root and must not be inside `.git`. A symbolic link is accepted only when its real
/// folder is inside the project and not inside `.git`.
#[tauri::command(async)]
pub fn folder_children(root: String, path: String) -> Result<Vec<String>, String> {
    not_in_git_dir(&path)?;
    let real = folder_path(&root, &path)?;
    if real.is_dir() == false {
        return Err("not a folder".into());
    }
    children_of(&real)
}

/// The real path of a folder of the project. Unlike `full_path`, the folder may be a symbolic link, but its real folder
/// must be inside the project, must not be the root itself, and must not be inside `.git` (issue #923).
fn folder_path(root: &str, path: &str) -> Result<PathBuf, String> {
    known_root(root)?;
    let rel = safe_rel(path)?;
    let base = std::fs::canonicalize(root).map_err(|e| e.to_string())?;
    let real = std::fs::canonicalize(base.join(rel)).map_err(|_| "folder not found".to_string())?;
    let relative = real.strip_prefix(&base).map_err(|_| "path outside the project".to_string())?;
    if relative.as_os_str().is_empty() {
        return Err("the root of the project: not listed again".into());
    }
    not_in_git_dir(&relative.to_string_lossy())?;
    Ok(real)
}

pub(crate) fn full_path(root: &str, path: &str) -> Result<PathBuf, String> {
    known_root(root)?;
    let rel = safe_rel(path)?;
    let base = std::fs::canonicalize(root).map_err(|e| e.to_string())?;
    let full = base.join(rel);
    let meta = std::fs::symlink_metadata(&full).map_err(|_| "file not found".to_string())?;
    if meta.file_type().is_symlink() {
        return Err("symbolic link: not opened".into());
    }
    let real = std::fs::canonicalize(&full).map_err(|e| e.to_string())?;
    if !real.starts_with(&base) {
        return Err("path outside the project".into());
    }
    Ok(real)
}

/// The real path of a file of the project to watch: its real folder, which must be inside the project, and its name.
/// The file itself may be missing, because a coding agent can delete it and write it again (issue #931).
pub(crate) fn watch_path(root: &str, path: &str) -> Result<PathBuf, String> {
    known_root(root)?;
    let rel = safe_rel(path)?;
    let base = std::fs::canonicalize(root).map_err(|e| e.to_string())?;
    let full = base.join(rel);
    let parent = full.parent().ok_or("folder not found")?;
    let parent = std::fs::canonicalize(parent).map_err(|_| "the folder of the file no longer exists".to_string())?;
    if !parent.starts_with(&base) {
        return Err("path outside the project".into());
    }
    Ok(parent.join(full.file_name().ok_or("invalid name")?))
}

/// An image of the project as a data URL (8 MB max). Off the main thread.
#[tauri::command(async)]
pub fn file_image(root: String, path: String) -> Result<String, String> {
    let real = full_path(&root, &path)?;
    let ext = real.extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default();
    let mime = match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "ico" => "image/x-icon",
        "bmp" => "image/bmp",
        _ => return Err("image format not supported".into()),
    };
    let meta = std::fs::metadata(&real).map_err(|e| e.to_string())?;
    if meta.len() > 8 * 1024 * 1024 {
        return Err(format!("image too large for the preview ({} MB)", meta.len() / 1024 / 1024));
    }
    let bytes = std::fs::read(&real).map_err(|e| e.to_string())?;
    Ok(format!("data:{mime};base64,{}", base64::engine::general_purpose::STANDARD.encode(bytes)))
}

#[derive(Serialize)]
pub struct Resolved {
    pub root: String,
    pub path: String,
}

/// "src/app.ts" cited in a terminal, relative to the pane's folder: the project and
/// the path inside it, if the file exists there.
#[tauri::command]
pub async fn files_resolve(cwd: String, path: String) -> Result<Resolved, String> {
    let dir = std::fs::canonicalize(&cwd).map_err(|_| "folder not found".to_string())?;
    let p = Path::new(&path);
    let candidate = if p.is_absolute() { p.to_path_buf() } else { dir.join(p) };
    let real = std::fs::canonicalize(&candidate).map_err(|_| format!("{path} not found from {}", dir.display()))?;
    if !real.is_file() {
        return Err(format!("{path} is not a file"));
    }
    let top = run(&dir, &["rev-parse", "--show-toplevel"]).await.map(|b| String::from_utf8_lossy(&b).trim().to_string()).filter(|t| !t.is_empty());
    let root = PathBuf::from(top.unwrap_or_else(|| dir.display().to_string()));
    let root = std::fs::canonicalize(&root).unwrap_or(root);
    acceptable_root(&root)?;
    used_by_a_pane(&root).await?;
    let rel = real.strip_prefix(&root).map_err(|_| "file outside the project".to_string())?;
    let root_s = root.display().to_string();
    remember_root(&root_s);
    Ok(Resolved { root: root_s, path: rel.to_string_lossy().replace('\\', "/") })
}

/// Opens the file in VS Code (or the default app when VS Code is not installed).
#[tauri::command(async)]
pub fn file_open_external(root: String, path: String) -> Result<(), String> {
    let real = full_path(&root, &path)?;
    let vscode = std::process::Command::new("open").arg("-a").arg("Visual Studio Code").arg(&real).status();
    if matches!(vscode, Ok(s) if s.success()) {
        return Ok(());
    }
    std::process::Command::new("open").arg(&real).status().map_err(|e| e.to_string()).and_then(|s| if s.success() { Ok(()) } else { Err("cannot open the file".into()) })
}

/// Absolute path of a project file (for "Copy absolute path").
#[tauri::command]
pub fn file_full_path(root: String, path: String) -> Result<String, String> {
    full_path(&root, &path).map(|p| p.display().to_string())
}

// ---- Editing -------------------------------------------------------------------------

const MAX_EDIT: u64 = 5 * 1024 * 1024;

/// Content fingerprint: a same-size write within the same second is still seen
/// (timestamps alone miss it on some file systems).
fn fingerprint(bytes: &[u8]) -> String {
    use std::hash::{Hash, Hasher};
    let mut h = std::collections::hash_map::DefaultHasher::new();
    bytes.hash(&mut h);
    format!("{:016x}-{}", h.finish(), bytes.len())
}

#[derive(Serialize, Debug)]
pub struct FileText {
    pub text: String,
    /// Fingerprint when read: a save checks the file is still the same.
    pub hash: String,
}

#[derive(Serialize, Debug)]
pub struct FileStamp {
    /// None: the file is gone (deleted on the disk).
    pub hash: Option<String>,
}

/// Never inside .git (hooks, config): editing those is not what a file view pane is for.
pub(crate) fn not_in_git_dir(path: &str) -> Result<(), String> {
    if Path::new(path).components().any(|c| c.as_os_str() == ".git") {
        return Err("internal file of Git: it cannot be changed here".into());
    }
    Ok(())
}

/// A text file to edit, with its fingerprint.
#[tauri::command(async)]
pub fn file_read(root: String, path: String) -> Result<FileText, String> {
    let real = full_path(&root, &path)?;
    let meta = std::fs::metadata(&real).map_err(|e| e.to_string())?;
    if meta.len() > MAX_EDIT {
        return Err(format!("file too large to edit ({} KB)", meta.len() / 1024));
    }
    let bytes = std::fs::read(&real).map_err(|e| e.to_string())?;
    if bytes.iter().take(8000).any(|b| *b == 0) {
        return Err("binary file: it cannot be edited".into());
    }
    let hash = fingerprint(&bytes);
    let text = String::from_utf8(bytes).map_err(|_| "file not in UTF-8: it cannot be edited here".to_string())?;
    Ok(FileText { text, hash })
}

/// Fingerprint of a file now, to see whether someone (an agent) changed it.
#[tauri::command(async)]
pub fn file_stat(root: String, path: String) -> Result<FileStamp, String> {
    known_root(&root)?;
    let rel = safe_rel(&path)?;
    let base = std::fs::canonicalize(&root).map_err(|e| e.to_string())?;
    if std::fs::symlink_metadata(base.join(rel)).is_err() {
        return Ok(FileStamp { hash: None });
    }
    let real = full_path(&root, &path)?;
    let bytes = std::fs::read(&real).map_err(|e| e.to_string())?;
    Ok(FileStamp { hash: Some(fingerprint(&bytes)) })
}

static TMP_SEQ: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

/// Saves a file of the project. Refused when the file on the disk is not the one
/// the editor started from (`expected`: its fingerprint, or None when it was gone),
/// never in .git, never through a symlink, never a read-only file. Written next to
/// it then renamed (a crash never leaves half a file), permissions kept; a file
/// with several hard links is written in place so they stay linked.
#[tauri::command(async)]
pub fn file_write(root: String, path: String, content: String, expected: Option<String>) -> Result<FileStamp, String> {
    not_in_git_dir(&path)?;
    known_root(&root)?;
    let rel = safe_rel(&path)?;
    if content.len() as u64 > MAX_EDIT {
        return Err("content too large".into());
    }
    let base = std::fs::canonicalize(&root).map_err(|e| e.to_string())?;
    let target = base.join(rel);
    let exists = std::fs::symlink_metadata(&target).is_ok();
    let real = if exists {
        full_path(&root, &path)?
    } else {
        // Deleted meanwhile, and the user chose to write it back: its folder must
        // still be inside the project.
        let parent = target.parent().ok_or("folder not found")?;
        let parent = std::fs::canonicalize(parent).map_err(|_| "the folder of the file no longer exists".to_string())?;
        if !parent.starts_with(&base) {
            return Err("path outside the project".into());
        }
        parent.join(target.file_name().ok_or("invalid name")?)
    };
    let current = if exists { Some(fingerprint(&std::fs::read(&real).map_err(|e| e.to_string())?)) } else { None };
    if current != expected {
        return Err("changed_on_disk".into());
    }
    let bytes = content.as_bytes();
    if exists {
        let meta = std::fs::metadata(&real).map_err(|e| e.to_string())?;
        if !meta.is_file() {
            return Err("not a file".into());
        }
        if meta.permissions().readonly() {
            return Err("read-only file: not changed".into());
        }
        #[cfg(unix)]
        {
            use std::os::unix::fs::MetadataExt;
            if meta.nlink() > 1 {
                std::fs::write(&real, bytes).map_err(|e| format!("cannot write the file: {e}"))?;
                return Ok(FileStamp { hash: Some(fingerprint(bytes)) });
            }
        }
        let dir = real.parent().ok_or("folder not found")?;
        let name = real.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
        let n = TMP_SEQ.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        let tmp = dir.join(format!(".{name}.heidrun-{}-{n}", std::process::id()));
        {
            use std::io::Write;
            let mut f = std::fs::OpenOptions::new().write(true).create_new(true).open(&tmp).map_err(|e| format!("cannot write the file: {e}"))?;
            f.write_all(bytes).map_err(|e| format!("cannot write the file: {e}"))?;
            f.sync_all().ok();
        }
        let _ = std::fs::set_permissions(&tmp, meta.permissions());
        if let Err(e) = std::fs::rename(&tmp, &real) {
            let _ = std::fs::remove_file(&tmp);
            return Err(format!("cannot save the file: {e}"));
        }
    } else {
        use std::io::Write;
        let mut f = std::fs::OpenOptions::new().write(true).create_new(true).open(&real).map_err(|e| format!("cannot write the file: {e}"))?;
        f.write_all(bytes).map_err(|e| format!("cannot write the file: {e}"))?;
    }
    Ok(FileStamp { hash: Some(fingerprint(bytes)) })
}

// ---- Search and create ---------------------------------------------------------------

#[derive(Serialize, Debug)]
pub struct GrepHit {
    pub path: String,
    pub line: u32,
    pub text: String,
}

#[derive(Serialize, Debug)]
pub struct GrepResult {
    pub hits: Vec<GrepHit>,
    pub truncated: bool,
}

const MAX_HITS: usize = 2000;

/// `path\0line\0text` (git grep -z) or `path\0line:text` (grep --null) lines → hits.
/// The NUL after the path keeps names containing ':' intact.
fn parse_grep(out: &str, strip: Option<&str>) -> GrepResult {
    let mut hits = Vec::new();
    let mut truncated = false;
    for l in out.split('\n') {
        let Some((p, rest)) = l.split_once('\0') else { continue };
        let Some((n, t)) = rest.split_once('\0').or_else(|| rest.split_once(':')) else { continue };
        let Ok(line) = n.parse::<u32>() else { continue };
        if hits.len() >= MAX_HITS {
            truncated = true;
            break;
        }
        let path = strip.and_then(|s| p.strip_prefix(s)).unwrap_or(p).trim_start_matches("./").to_string();
        let text: String = t.trim_end_matches('\r').chars().take(300).collect();
        hits.push(GrepHit { path, line, text });
    }
    GrepResult { hits, truncated }
}

/// Text (or regular expression) in the project's files: git grep (fast, .gitignore
/// respected, untracked files included), or grep -r outside git. Binary files skipped.
#[tauri::command]
pub async fn files_grep(root: String, query: String, regex: Option<bool>, case: Option<bool>) -> Result<GrepResult, String> {
    known_root(&root)?;
    if query.trim().is_empty() {
        return Ok(GrepResult { hits: vec![], truncated: false });
    }
    if query.len() > 500 {
        return Err("search text too long".into());
    }
    let regex = regex.unwrap_or(false);
    let case = case.unwrap_or(false);
    let is_git = run(Path::new(&root), &["rev-parse", "--is-inside-work-tree"]).await.is_some();
    let mut cmd = if is_git {
        let mut c = Command::new("git");
        c.arg("-C").arg(&root).args(["-c", "core.quotepath=off", "grep", "-z", "-n", "-I", "--no-color", "--untracked", "--max-count", "200"]);
        c
    } else {
        let mut c = Command::new("grep");
        // --null (GNU and BSD grep): NUL after the name. -s: unreadable files skipped.
        c.current_dir(&root).args(["-rnIs", "--null", "--color=never", "-m", "200"]);
        for d in HEAVY {
            c.arg(format!("--exclude-dir={d}"));
        }
        c
    };
    cmd.arg(if regex { "-E" } else { "-F" });
    if !case {
        cmd.arg("-i");
    }
    // "-e": a query starting with "-" is a pattern, not an option.
    cmd.arg("-e").arg(&query);
    if !is_git {
        cmd.arg(".");
    }
    cmd.kill_on_drop(true);
    let out = tokio::time::timeout(Duration::from_secs(15), cmd.output())
        .await
        .map_err(|_| "search too long (more than 15 seconds): make the search text more precise".to_string())?
        .map_err(|e| e.to_string())?;
    // Exit 1: nothing found. 2: bad pattern (or, for grep -r, an unreadable file:
    // the hits found are still good).
    let partial = !is_git && out.status.code() == Some(2) && !out.stdout.is_empty();
    if !partial && !out.status.success() && out.status.code() != Some(1) {
        let err = String::from_utf8_lossy(&out.stderr);
        return Err(format!("search failed: {}", err.lines().next().unwrap_or("invalid expression")));
    }
    Ok(parse_grep(&String::from_utf8_lossy(&out.stdout), None))
}

/// The parent folder of `path`, inside the project (created paths do not exist yet).
fn new_target(root: &str, path: &str) -> Result<PathBuf, String> {
    known_root(root)?;
    let rel = safe_rel(path)?;
    not_in_git_dir(rel)?;
    let base = std::fs::canonicalize(root).map_err(|e| e.to_string())?;
    let target = base.join(rel);
    let name = target.file_name().ok_or("invalid name")?.to_string_lossy().into_owned();
    if name.is_empty() || name == "." || name.contains('\0') {
        return Err("invalid name".into());
    }
    let parent = std::fs::canonicalize(target.parent().ok_or("folder not found")?).map_err(|_| "the folder does not exist".to_string())?;
    if !parent.starts_with(&base) {
        return Err("path outside the project".into());
    }
    // The real folder too: a symlink "x -> .git/hooks" must not lead into .git.
    not_in_git_dir(&parent.strip_prefix(&base).map_err(|e| e.to_string())?.to_string_lossy())?;
    Ok(parent.join(name))
}

fn taken(p: &Path) -> Result<(), String> {
    if std::fs::symlink_metadata(p).is_ok() {
        return Err("a file or a folder with this name exists already".into());
    }
    Ok(())
}

/// New empty file, or folder.
#[tauri::command(async)]
pub fn file_create(root: String, path: String, dir: bool) -> Result<(), String> {
    let target = new_target(&root, &path)?;
    taken(&target)?;
    if dir {
        std::fs::create_dir(&target).map_err(|e| e.to_string())
    } else {
        std::fs::OpenOptions::new().write(true).create_new(true).open(&target).map(|_| ()).map_err(|e| e.to_string())
    }
}

/// The paths, among `paths`, that are folders of the project today (not symlinks). The sidebar section File explorer asks it
/// to drop the new empty folders that the developer removed outside Heidrun Code, because Git does not list empty folders.
#[tauri::command(async)]
pub fn dirs_existing(root: String, paths: Vec<String>) -> Result<Vec<String>, String> {
    known_root(&root)?;
    let base = std::fs::canonicalize(&root).map_err(|e| e.to_string())?;
    Ok(paths
        .into_iter()
        .filter(|path| {
            safe_rel(path).is_ok()
                && std::fs::symlink_metadata(base.join(path)).map(|meta| meta.file_type().is_dir()).unwrap_or(false)
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn refuses_home_and_root() {
        let _home_lock = crate::HOME_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let home = dirs::home_dir().unwrap();
        assert!(acceptable_root(&home).is_err());
        assert!(acceptable_root(Path::new("/")).is_err());
        assert!(acceptable_root(&home.join("Projects/x")).is_ok());
        assert!(acceptable_root(&home.join(".ssh")).is_err());
        assert!(acceptable_root(Path::new("/etc/x")).is_err());
        assert!(not_in_git_dir(".git/config").is_err());
        assert!(not_in_git_dir("a/.git/hooks/x").is_err());
        assert!(not_in_git_dir("src/.gitignore").is_ok());
    }

    #[test]
    fn gives_the_real_path_to_watch_even_for_a_missing_file() {
        let dir = std::env::temp_dir().join(format!("hd-files-watch-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(dir.join("src")).unwrap();
        std::fs::write(dir.join("src/a.txt"), "un\n").unwrap();
        let real = std::fs::canonicalize(&dir).unwrap();
        let root = real.display().to_string();
        remember_root(&root);
        assert_eq!(watch_path(&root, "src/a.txt").unwrap(), real.join("src/a.txt"));
        assert_eq!(watch_path(&root, "src/gone.txt").unwrap(), real.join("src/gone.txt"));
        assert!(watch_path(&root, "missing/a.txt").is_err());
        assert!(watch_path(&root, "../a.txt").is_err());
        assert!(watch_path("/not/a/known/root", "a.txt").is_err());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn writes_atomically_and_detects_changes() {
        let dir = std::env::temp_dir().join(format!("hd-files-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(dir.join("src")).unwrap();
        std::fs::write(dir.join("src/a.txt"), "un\n").unwrap();
        let root = std::fs::canonicalize(&dir).unwrap().display().to_string();
        remember_root(&root);
        let t = file_read(root.clone(), "src/a.txt".into()).unwrap();
        assert_eq!(t.text, "un\n");
        let st = file_write(root.clone(), "src/a.txt".into(), "deux\n".into(), Some(t.hash.clone())).unwrap();
        assert_eq!(std::fs::read_to_string(dir.join("src/a.txt")).unwrap(), "deux\n");
        // Same size, right away: still seen through the fingerprint.
        std::fs::write(dir.join("src/a.txt"), "DEUX\n").unwrap();
        assert_eq!(file_write(root.clone(), "src/a.txt".into(), "moi\n".into(), st.hash.clone()).unwrap_err(), "changed_on_disk");
        // Deleted meanwhile: written back only when the editor knew it was gone.
        std::fs::remove_file(dir.join("src/a.txt")).unwrap();
        assert_eq!(file_stat(root.clone(), "src/a.txt".into()).unwrap().hash, None);
        assert!(file_write(root.clone(), "src/a.txt".into(), "x\n".into(), st.hash.clone()).is_err());
        file_write(root.clone(), "src/a.txt".into(), "x\n".into(), None).unwrap();
        assert_eq!(std::fs::read_to_string(dir.join("src/a.txt")).unwrap(), "x\n");
        assert!(file_write(root.clone(), "../x".into(), "".into(), None).is_err());
        assert!(file_write(root.clone(), ".git/config".into(), "".into(), None).is_err());
        assert_eq!(std::fs::read_dir(dir.join("src")).unwrap().count(), 1, "no temp file left");

        // Create, refuse escapes and overwrites.
        file_create(root.clone(), "src/b.txt".into(), false).unwrap();
        file_create(root.clone(), "src/sub".into(), true).unwrap();
        assert!(file_create(root.clone(), "src/b.txt".into(), false).is_err());
        assert!(file_create(root.clone(), "../evil".into(), false).is_err());
        assert!(file_create(root.clone(), "nope/x.txt".into(), false).is_err());
        assert!(file_create(root.clone(), ".git/x".into(), false).is_err());
        // A symlink to .git does not open a way in.
        std::fs::create_dir_all(dir.join(".git/hooks")).unwrap();
        std::os::unix::fs::symlink(dir.join(".git/hooks"), dir.join("hk")).unwrap();
        assert!(file_create(root.clone(), "hk/pre-commit".into(), false).is_err());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn parses_grep_output() {
        let r = parse_grep("src/a.ts\012\0const x = 1;\n./b.md\03:a:b:c\nd:1:e.txt\05\0x\nbad line\n", None);
        assert_eq!(r.hits.len(), 3);
        assert_eq!((r.hits[0].path.as_str(), r.hits[0].line, r.hits[0].text.as_str()), ("src/a.ts", 12, "const x = 1;"));
        assert_eq!((r.hits[1].path.as_str(), r.hits[1].text.as_str()), ("b.md", "a:b:c"));
        assert_eq!((r.hits[2].path.as_str(), r.hits[2].line), ("d:1:e.txt", 5));
    }
}

#[cfg(test)]
mod helper_tests {
    use super::*;

    #[test]
    fn fingerprint_changes_with_the_content_and_the_length() {
        assert_eq!(fingerprint(b"abc"), fingerprint(b"abc"));
        assert_ne!(fingerprint(b"abc"), fingerprint(b"abd"));
        assert!(fingerprint(b"abc").ends_with("-3"));
        assert!(fingerprint(b"").ends_with("-0"));
    }

    #[test]
    fn keeps_only_the_paths_that_are_folders_today() {
        let dir = std::env::temp_dir().join(format!("hd-dirs-existing-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(dir.join("kept/inner")).unwrap();
        std::fs::write(dir.join("file.txt"), "x").unwrap();
        let root = std::fs::canonicalize(&dir).unwrap().display().to_string();
        remember_root(&root);
        let paths = vec!["kept".to_string(), "kept/inner".to_string(), "gone".to_string(), "file.txt".to_string(), "../out".to_string()];
        assert_eq!(dirs_existing(root.clone(), paths).unwrap(), vec!["kept", "kept/inner"]);
        assert!(dirs_existing("/not/a/known/root".into(), vec![]).is_err());
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// A repository in a temporary folder: `.heidrun` holds only an ignored file, `.env` is an ignored file, and `src` holds
    /// a tracked file.
    fn repository_with_ignored_files(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(dir.join(".heidrun")).unwrap();
        std::fs::create_dir_all(dir.join("src")).unwrap();
        std::fs::write(dir.join(".gitignore"), ".heidrun/\n.env\n").unwrap();
        std::fs::write(dir.join(".heidrun/config.json"), "{}").unwrap();
        std::fs::write(dir.join(".env"), "SECRET=1").unwrap();
        std::fs::write(dir.join("src/a.ts"), "x").unwrap();
        for args in [vec!["init", "-q"], vec!["add", ".gitignore", "src"]] {
            let status = std::process::Command::new("git").arg("-C").arg(&dir).args(args).status().unwrap();
            assert!(status.success());
        }
        std::fs::canonicalize(&dir).unwrap()
    }

    #[tokio::test]
    async fn lists_a_file_and_a_folder_that_git_ignores_only_when_the_option_is_on_and_never_the_folder_git() {
        let dir = repository_with_ignored_files("hd-git-listed-files");
        let (hidden, hidden_ignored) = git_listed_files(&dir, false).await;
        assert_eq!(hidden, vec![".gitignore", "src/a.ts"]);
        assert!(hidden_ignored.is_empty());
        let (shown, shown_ignored) = git_listed_files(&dir, true).await;
        assert_eq!(shown, vec![".gitignore", "src/a.ts", ".env", ".heidrun/"]);
        assert_eq!(shown_ignored, vec![".env", ".heidrun/"]);
        for list in [&hidden, &shown] {
            assert!(list.iter().all(|entry| entry.trim_end_matches('/') != ".git" && entry.starts_with(".git/") == false));
        }
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[tokio::test]
    async fn submodules_list_nested_files_respect_ignores_refresh_and_open_files() {
        let source = repository_with_ignored_files("hd-submodule-source");
        let parent = repository_with_ignored_files("hd-submodule-parent");
        let commit = std::process::Command::new("git").arg("-C").arg(&source)
            .args(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "fixture"])
            .status().unwrap();
        assert!(commit.success());
        let added = std::process::Command::new("git").arg("-C").arg(&parent)
            .args(["-c", "protocol.file.allow=always", "submodule", "add", "-q"])
            .arg(&source).arg("modules/example").status().unwrap();
        assert!(added.success());
        let module = parent.join("modules/example");
        std::fs::write(module.join(".env"), "ignored").unwrap();
        std::fs::create_dir_all(module.join(".heidrun/nested")).unwrap();
        std::fs::write(module.join(".heidrun/nested/hidden.txt"), "hidden").unwrap();
        let ProjectFiles { files, ignored, submodules, .. } = git_project_files(&parent, false).await;
        assert_eq!(submodules, vec!["modules/example"]);
        assert!(files.contains(&"modules/example/src/a.ts".to_string()));
        assert!(!files.contains(&"modules/example".to_string()));
        assert!(!files.contains(&"modules/example/.env".to_string()));
        assert!(ignored.is_empty());
        let root = parent.display().to_string();
        remember_root(&root);
        assert_eq!(file_read(root.clone(), "modules/example/src/a.ts".into()).unwrap().text, "x");
        let ProjectFiles { files: shown, ignored, .. } = git_project_files(&parent, true).await;
        assert!(shown.contains(&"modules/example/.env".to_string()));
        assert!(ignored.contains(&"modules/example/.heidrun/".to_string()));
        assert_eq!(folder_children(root, "modules/example/.heidrun/nested".into()).unwrap(), vec!["hidden.txt"]);
        assert!(shown.iter().all(|path| !Path::new(path).components().any(|part| part.as_os_str() == ".git")));
        std::fs::write(module.join("src/new.txt"), "new").unwrap();
        let refreshed = git_project_files(&parent, false).await.files;
        assert!(refreshed.contains(&"modules/example/src/new.txt".to_string()));
        // An uninitialized submodule must not list the parent repository as its own contents.
        std::fs::remove_dir_all(&module).unwrap();
        std::fs::create_dir(&module).unwrap();
        let ProjectFiles { files: uninitialized, submodules, .. } = git_project_files(&parent, false).await;
        assert_eq!(submodules, vec!["modules/example"]);
        assert!(uninitialized.iter().all(|path| !path.starts_with("modules/example/")));
        let _ = std::fs::remove_dir_all(parent);
        let _ = std::fs::remove_dir_all(source);
    }

    /// Issue #441: Git lists `.heidrun/` and `.heidrun/config.json` when the ignore rule names the file, and `.claude/` and
    /// `.claude/worktrees/` when the rule is in `.git/info/exclude`. The folder must show once.
    #[tokio::test]
    async fn lists_a_folder_that_git_ignores_once_when_the_ignore_rule_names_something_inside_it() {
        let dir = std::env::temp_dir().join(format!("hd-git-listed-nested-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(dir.join(".heidrun")).unwrap();
        std::fs::create_dir_all(dir.join(".claude/worktrees/one")).unwrap();
        std::fs::create_dir_all(dir.join("node_modules/package")).unwrap();
        std::fs::write(dir.join(".gitignore"), ".heidrun/config.json\nnode_modules\n").unwrap();
        std::fs::write(dir.join(".heidrun/config.json"), "{}").unwrap();
        std::fs::write(dir.join(".claude/worktrees/one/file.txt"), "x").unwrap();
        std::fs::write(dir.join("node_modules/package/index.js"), "x").unwrap();
        std::fs::write(dir.join("a.txt"), "x").unwrap();
        for args in [vec!["init", "-q"], vec!["add", ".gitignore", "a.txt"]] {
            let status = std::process::Command::new("git").arg("-C").arg(&dir).args(args).status().unwrap();
            assert!(status.success());
        }
        std::fs::write(dir.join(".git/info/exclude"), ".claude/worktrees/\n").unwrap();
        let dir = std::fs::canonicalize(&dir).unwrap();
        let (shown, shown_ignored) = git_listed_files(&dir, true).await;
        assert_eq!(shown_ignored, vec![".claude/", ".heidrun/", "node_modules/"]);
        assert_eq!(shown, vec![".gitignore", "a.txt", ".claude/", ".heidrun/", "node_modules/"]);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn drops_every_entry_inside_a_listed_folder_and_keeps_the_other_entries() {
        let entries = [".claude/", ".claude/worktrees/", ".claude-other", ".heidrun/", ".heidrun/config.json", ".env"];
        let kept = without_entries_inside_listed_folders(entries.iter().map(|entry| entry.to_string()).collect());
        assert_eq!(kept, vec![".claude/", ".claude-other", ".heidrun/", ".env"]);
    }

    #[test]
    fn lists_one_level_of_a_folder_with_a_trailing_slash_for_each_folder() {
        let dir = std::env::temp_dir().join(format!("hd-folder-children-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(dir.join(".heidrun/nested/deeper")).unwrap();
        std::fs::write(dir.join(".heidrun/config.json"), "{}").unwrap();
        std::fs::write(dir.join(".heidrun/nested/inner.txt"), "x").unwrap();
        let root = std::fs::canonicalize(&dir).unwrap().display().to_string();
        remember_root(&root);
        assert_eq!(folder_children(root.clone(), ".heidrun".into()).unwrap(), vec!["config.json", "nested/"]);
        assert_eq!(folder_children(root.clone(), ".heidrun/nested".into()).unwrap(), vec!["deeper/", "inner.txt"]);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn never_lists_the_folder_git_or_a_symbolic_link_inside_a_folder() {
        let dir = std::env::temp_dir().join(format!("hd-folder-children-git-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(dir.join("ignored/.git/hooks")).unwrap();
        std::fs::write(dir.join("ignored/kept.txt"), "x").unwrap();
        std::os::unix::fs::symlink(dir.join("ignored/kept.txt"), dir.join("ignored/link.txt")).unwrap();
        let root = std::fs::canonicalize(&dir).unwrap().display().to_string();
        remember_root(&root);
        assert_eq!(folder_children(root.clone(), "ignored".into()).unwrap(), vec!["kept.txt"]);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn refuses_to_list_a_file_a_path_outside_the_project_a_path_inside_git_and_an_unknown_root() {
        let dir = std::env::temp_dir().join(format!("hd-folder-children-refuse-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(dir.join(".git/hooks")).unwrap();
        std::fs::write(dir.join("file.txt"), "x").unwrap();
        std::os::unix::fs::symlink(&dir, dir.join("loop")).unwrap();
        let root = std::fs::canonicalize(&dir).unwrap().display().to_string();
        remember_root(&root);
        assert!(folder_children(root.clone(), "file.txt".into()).is_err());
        assert!(folder_children(root.clone(), "../".into()).is_err());
        assert!(folder_children(root.clone(), ".git/hooks".into()).is_err());
        assert!(folder_children(root.clone(), "loop".into()).is_err());
        assert!(folder_children("/not/a/known/root".into(), "src".into()).is_err());
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// Issue #923: Git lists a symbolic link as a file, even when its target is a folder.
    #[tokio::test]
    async fn lists_a_symbolic_link_to_a_folder_of_the_project_as_a_folder_that_unfolds_and_refuses_the_other_links() {
        let dir = std::env::temp_dir().join(format!("hd-linked-folder-{}", std::process::id()));
        let outside = std::env::temp_dir().join(format!("hd-linked-folder-outside-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let _ = std::fs::remove_dir_all(&outside);
        std::fs::create_dir_all(dir.join("packages/skills/feature-status")).unwrap();
        std::fs::create_dir_all(dir.join("testbed/.agents/skills")).unwrap();
        std::fs::create_dir_all(&outside).unwrap();
        std::fs::write(dir.join("packages/skills/feature-status/SKILL.md"), "x").unwrap();
        std::fs::write(dir.join("packages/a.txt"), "a").unwrap();
        let skills = dir.join("testbed/.agents/skills");
        std::os::unix::fs::symlink("../../../packages/skills/feature-status", skills.join("feature-status")).unwrap();
        std::os::unix::fs::symlink("../../../packages/a.txt", skills.join("file-link.txt")).unwrap();
        std::os::unix::fs::symlink(&outside, skills.join("outside")).unwrap();
        std::os::unix::fs::symlink("../../../.git", skills.join("git-link")).unwrap();
        std::os::unix::fs::symlink("../../..", skills.join("root-link")).unwrap();
        for args in [vec!["init", "-q"], vec!["add", "."]] {
            let status = std::process::Command::new("git").arg("-C").arg(&dir).args(args).status().unwrap();
            assert!(status.success());
        }
        let dir = std::fs::canonicalize(&dir).unwrap();
        let ProjectFiles { files, linked_folders, .. } = git_project_files(&dir, false).await;
        assert_eq!(linked_folders, vec!["testbed/.agents/skills/feature-status"]);
        assert!(files.contains(&"testbed/.agents/skills/feature-status/".to_string()));
        assert!(files.contains(&"testbed/.agents/skills/file-link.txt".to_string()));
        for link in ["outside", "git-link", "root-link"] {
            assert!(files.contains(&format!("testbed/.agents/skills/{link}")));
        }
        let root = dir.display().to_string();
        remember_root(&root);
        assert_eq!(folder_children(root.clone(), "testbed/.agents/skills/feature-status".into()).unwrap(), vec!["SKILL.md"]);
        assert!(folder_children(root.clone(), "testbed/.agents/skills/outside".into()).is_err());
        assert!(folder_children(root.clone(), "testbed/.agents/skills/git-link".into()).is_err());
        assert!(folder_children(root.clone(), "testbed/.agents/skills/root-link".into()).is_err());
        let _ = std::fs::remove_dir_all(&dir);
        let _ = std::fs::remove_dir_all(&outside);
    }

    #[test]
    fn splits_a_zero_separated_list_and_skips_empty_items() {
        let items: Vec<String> = split_z(b"a\0b c\0\0d\0").collect();
        assert_eq!(items, vec!["a", "b c", "d"]);
    }

    #[test]
    fn parses_grep_output_with_a_stripped_prefix() {
        let r = parse_grep("/root/a.txt\x001\x00hello\n", Some("/root/"));
        assert_eq!(r.hits[0].path, "a.txt");
    }

    #[test]
    fn cuts_a_very_long_match_line() {
        let long = "x".repeat(500);
        let r = parse_grep(&format!("a.txt\x001\x00{long}\n"), None);
        assert_eq!(r.hits[0].text.chars().count(), 300);
    }

    #[test]
    fn stops_after_the_maximum_number_of_hits() {
        let out: String = (0..MAX_HITS + 5).map(|i| format!("a.txt\x00{}\x00x\n", i + 1)).collect();
        let r = parse_grep(&out, None);
        assert_eq!(r.hits.len(), MAX_HITS);
        assert!(r.truncated);
    }

    #[test]
    fn refuses_a_path_inside_the_git_folder() {
        assert!(not_in_git_dir("x/.git").is_err());
        assert!(not_in_git_dir("x/.github/y").is_ok());
    }
}

#[cfg(test)]
mod workspace_folder_tests {
    use super::*;

    #[test]
    fn fixed_workspace_folder_stays_accessible_when_every_pane_has_changed_folder() {
        let root = std::fs::canonicalize(env!("CARGO_MANIFEST_DIR")).unwrap();
        let other = std::fs::canonicalize(std::env::temp_dir()).unwrap();
        let snapshot = serde_json::json!({"snapshot": {
            "workspaces": [{"workspace_folder": root}],
            "panes": [{"cwd": other, "foreground_cwd": other}]
        }});
        assert!(snapshot_dirs(&snapshot).contains(&root));
        assert!(snapshot_dirs(&snapshot).contains(&other));
        assert!(acceptable_root(&root).is_ok());
        assert!(acceptable_root(&dirs::home_dir().unwrap()).is_err());
        assert!(acceptable_root(&dirs::home_dir().unwrap().join(".ssh")).is_err());
    }
}
