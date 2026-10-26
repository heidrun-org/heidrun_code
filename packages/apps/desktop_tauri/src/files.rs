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
        return Err("Dossier trop large : ouvre un projet, pas le dossier personnel".into());
    }
    let private = [".ssh", ".aws", ".gnupg", ".config", ".kube", ".docker", "Library", ".claude", ".codex"];
    if private.iter().any(|d| root.starts_with(home.join(d))) {
        return Err("Dossier privé : non ouvert dans l’explorateur".into());
    }
    for sys in ["/etc", "/private", "/System", "/usr", "/bin", "/sbin", "/var", "/Library", "/dev"] {
        if root.starts_with(sys) {
            return Err("Dossier système : non ouvert dans l’explorateur".into());
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
        Err("Ce dossier n’est le dossier d’aucun panneau : explorateur refusé".into())
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

/// Lists each initialized submodule with its own ignore rules. Gitlinks are folders, never files.
async fn git_project_files(root: &Path, show_ignored: bool) -> (Vec<String>, Vec<String>, Vec<String>) {
    let mut files = Vec::new();
    let mut ignored = Vec::new();
    let mut submodules = Vec::new();
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
        for path in listed {
            if links.contains(&path) {
                continue;
            }
            files.push(format!("{prefix}{path}"));
            if files.len() > MAX_FILES {
                return (files, ignored, submodules);
            }
        }
        ignored.extend(ignored_entries.into_iter().map(|path| format!("{prefix}{path}")));
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
    (files, ignored, submodules)
}

/// Files of the project containing `cwd`: the git repository (tracked and new files,
/// .gitignore respected), or the folder itself when it is not a repository.
#[tauri::command]
pub async fn files_list(cwd: String, ignored: Option<bool>) -> Result<FileList, String> {
    let dir = std::fs::canonicalize(&cwd).map_err(|_| "dossier introuvable".to_string())?;
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
        return Ok(FileList { root, git: false, files, ignored: Vec::new(), submodules: Vec::new(), status: HashMap::new(), truncated });
    };
    let rootp = std::fs::canonicalize(&root).unwrap_or_else(|_| PathBuf::from(&root));
    acceptable_root(&rootp)?;
    used_by_a_pane(&rootp).await?;
    let (mut files, ignored_entries, submodules) = git_project_files(&rootp, ignored.unwrap_or(false)).await;
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
    Ok(FileList { root, git: true, files, ignored: ignored_entries, submodules, status, truncated })
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
/// the files of such a folder (issue #430). The folder must be inside a known root, must not be a symbolic link, and
/// must not be inside `.git`.
#[tauri::command(async)]
pub fn folder_children(root: String, path: String) -> Result<Vec<String>, String> {
    not_in_git_dir(&path)?;
    let real = full_path(&root, &path)?;
    if real.is_dir() == false {
        return Err("not a folder".into());
    }
    children_of(&real)
}

fn full_path(root: &str, path: &str) -> Result<PathBuf, String> {
    known_root(root)?;
    let rel = safe_rel(path)?;
    let base = std::fs::canonicalize(root).map_err(|e| e.to_string())?;
    let full = base.join(rel);
    let meta = std::fs::symlink_metadata(&full).map_err(|_| "fichier introuvable".to_string())?;
    if meta.file_type().is_symlink() {
        return Err("lien symbolique : non ouvert".into());
    }
    let real = std::fs::canonicalize(&full).map_err(|e| e.to_string())?;
    if !real.starts_with(&base) {
        return Err("chemin hors du projet".into());
    }
    Ok(real)
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
        _ => return Err("format d’image non pris en charge".into()),
    };
    let meta = std::fs::metadata(&real).map_err(|e| e.to_string())?;
    if meta.len() > 8 * 1024 * 1024 {
        return Err(format!("image trop grosse pour l’aperçu ({} Mo)", meta.len() / 1024 / 1024));
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
    let dir = std::fs::canonicalize(&cwd).map_err(|_| "dossier introuvable".to_string())?;
    let p = Path::new(&path);
    let candidate = if p.is_absolute() { p.to_path_buf() } else { dir.join(p) };
    let real = std::fs::canonicalize(&candidate).map_err(|_| format!("{path} introuvable depuis {}", dir.display()))?;
    if !real.is_file() {
        return Err(format!("{path} n’est pas un fichier"));
    }
    let top = run(&dir, &["rev-parse", "--show-toplevel"]).await.map(|b| String::from_utf8_lossy(&b).trim().to_string()).filter(|t| !t.is_empty());
    let root = PathBuf::from(top.unwrap_or_else(|| dir.display().to_string()));
    let root = std::fs::canonicalize(&root).unwrap_or(root);
    acceptable_root(&root)?;
    used_by_a_pane(&root).await?;
    let rel = real.strip_prefix(&root).map_err(|_| "fichier hors du projet".to_string())?;
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
    std::process::Command::new("open").arg(&real).status().map_err(|e| e.to_string()).and_then(|s| if s.success() { Ok(()) } else { Err("ouverture impossible".into()) })
}

/// Absolute path of a project file (for "Voir dans le Finder" / "Copier le chemin").
#[tauri::command]
pub fn file_full_path(root: String, path: String) -> Result<String, String> {
    full_path(&root, &path).map(|p| p.display().to_string())
}

/// Never inside .git (hooks, config): creating a file there is not what the explorer is for.
fn not_in_git_dir(path: &str) -> Result<(), String> {
    if Path::new(path).components().any(|c| c.as_os_str() == ".git") {
        return Err("fichier interne de git : non modifiable ici".into());
    }
    Ok(())
}

// ---- Create --------------------------------------------------------------------------

/// The parent folder of `path`, inside the project (created paths do not exist yet).
fn new_target(root: &str, path: &str) -> Result<PathBuf, String> {
    known_root(root)?;
    let rel = safe_rel(path)?;
    not_in_git_dir(rel)?;
    let base = std::fs::canonicalize(root).map_err(|e| e.to_string())?;
    let target = base.join(rel);
    let name = target.file_name().ok_or("nom invalide")?.to_string_lossy().into_owned();
    if name.is_empty() || name == "." || name.contains('\0') {
        return Err("nom invalide".into());
    }
    let parent = std::fs::canonicalize(target.parent().ok_or("dossier introuvable")?).map_err(|_| "le dossier n’existe pas".to_string())?;
    if !parent.starts_with(&base) {
        return Err("chemin hors du projet".into());
    }
    // The real folder too: a symlink "x -> .git/hooks" must not lead into .git.
    not_in_git_dir(&parent.strip_prefix(&base).map_err(|e| e.to_string())?.to_string_lossy())?;
    Ok(parent.join(name))
}

fn taken(p: &Path) -> Result<(), String> {
    if std::fs::symlink_metadata(p).is_ok() {
        return Err("un fichier ou dossier porte déjà ce nom".into());
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
    fn creates_a_file_and_a_folder_and_refuses_escapes_and_overwrites() {
        let dir = std::env::temp_dir().join(format!("hd-files-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(dir.join("src")).unwrap();
        std::fs::write(dir.join("src/a.txt"), "un\n").unwrap();
        let root = std::fs::canonicalize(&dir).unwrap().display().to_string();
        remember_root(&root);
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
}

#[cfg(test)]
mod helper_tests {
    use super::*;

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
        let (files, ignored, submodules) = git_project_files(&parent, false).await;
        assert_eq!(submodules, vec!["modules/example"]);
        assert!(files.contains(&"modules/example/src/a.ts".to_string()));
        assert!(!files.contains(&"modules/example".to_string()));
        assert!(!files.contains(&"modules/example/.env".to_string()));
        assert!(ignored.is_empty());
        let root = parent.display().to_string();
        remember_root(&root);
        assert_eq!(std::fs::read_to_string(full_path(&root, "modules/example/src/a.ts").unwrap()).unwrap(), "x");
        let (shown, ignored, _) = git_project_files(&parent, true).await;
        assert!(shown.contains(&"modules/example/.env".to_string()));
        assert!(ignored.contains(&"modules/example/.heidrun/".to_string()));
        assert_eq!(folder_children(root, "modules/example/.heidrun/nested".into()).unwrap(), vec!["hidden.txt"]);
        assert!(shown.iter().all(|path| !Path::new(path).components().any(|part| part.as_os_str() == ".git")));
        std::fs::write(module.join("src/new.txt"), "new").unwrap();
        let (refreshed, _, _) = git_project_files(&parent, false).await;
        assert!(refreshed.contains(&"modules/example/src/new.txt".to_string()));
        // An uninitialized submodule must not list the parent repository as its own contents.
        std::fs::remove_dir_all(&module).unwrap();
        std::fs::create_dir(&module).unwrap();
        let (uninitialized, _, submodules) = git_project_files(&parent, false).await;
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

    #[test]
    fn splits_a_zero_separated_list_and_skips_empty_items() {
        let items: Vec<String> = split_z(b"a\0b c\0\0d\0").collect();
        assert_eq!(items, vec!["a", "b c", "d"]);
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
