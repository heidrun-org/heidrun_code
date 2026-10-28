//! Per-project configuration, stored in `.heidrun/config.json` at the project root
//! (versioned with the code), plus commands detected from the usual project files.
//! The format of the file is validated by the Zod schema of the web frontend
//! (`packages/apps/web_frontend/src/lib/project_config.ts`).

use serde::Serialize;
use serde_json::{json, Value};
use std::path::{Path, PathBuf};

const CONFIG_DIR: &str = ".heidrun";
const CONFIG_FILE: &str = "config.json";

fn config_path(root: &Path) -> PathBuf {
    root.join(CONFIG_DIR).join(CONFIG_FILE)
}

#[derive(Serialize)]
pub struct Detected {
    pub label: String,
    pub command: String,
    pub source: String,
    /// Where the command comes from, for example `from package.json`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// The folder in which the command runs, relative to the project root. Absent for the project root itself.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cwd: Option<String>,
}

#[derive(Serialize)]
pub struct Project {
    pub root: String,
    pub config_path: String,
    pub config: Value,
    pub detected: Vec<Detected>,
}

/// Walks up from `cwd` to the folder holding the folder `.heidrun` or the folder `.git`.
pub(crate) fn find_root(cwd: &Path) -> PathBuf {
    let mut dir = Some(cwd);
    while let Some(d) = dir {
        if d.join(CONFIG_DIR).is_dir() || d.join(".git").exists() {
            return d.to_path_buf();
        }
        dir = d.parent();
    }
    cwd.to_path_buf()
}

/// The package manager whose lock file sits in `dir`, if any.
fn lock_file_manager(dir: &Path) -> Option<&'static str> {
    if dir.join("pnpm-lock.yaml").exists() {
        Some("pnpm")
    } else if dir.join("yarn.lock").exists() {
        Some("yarn")
    } else if dir.join("bun.lockb").exists() || dir.join("bun.lock").exists() {
        Some("bun")
    } else if dir.join("package-lock.json").exists() {
        Some("npm")
    } else {
        None
    }
}

/// The package manager of the package in `folder`: the nearest lock file, from `folder` up to `root`, because a
/// monorepo keeps its one lock file at the root.
fn package_manager_for(folder: &Path, root: &Path) -> &'static str {
    let mut dir = Some(folder);
    while let Some(d) = dir {
        if let Some(manager) = lock_file_manager(d) {
            return manager;
        }
        if d == root {
            break;
        }
        dir = d.parent();
    }
    "npm"
}

/// The commands of the file `package.json` in `folder`: the install command, then one command for each script. They
/// run in `folder`, so `cwd` is the path of `folder` relative to `root`. The label of a script is its key in
/// `package.json`, and the description says which file it comes from.
fn detect_package(folder: &Path, root: &Path) -> Result<Vec<Detected>, String> {
    let mut out = Vec::new();
    let file = folder.join("package.json");
    let text = std::fs::read_to_string(&file).map_err(|e| format!("Cannot read {}: {e}", file.display()))?;
    let pkg = serde_json::from_str::<Value>(&text).map_err(|e| format!("{} is not valid JSON: {e}", file.display()))?;
    let pm = package_manager_for(folder, root);
    let cwd = folder.strip_prefix(root).ok().filter(|relative| !relative.as_os_str().is_empty()).map(|relative| relative.to_string_lossy().replace('\\', "/"));
    let description = Some(match &cwd {
        Some(folder) => format!("from ./{folder}/package.json"),
        None => "from package.json".to_string(),
    });
    out.push(Detected { label: format!("{pm} install"), command: format!("{pm} install"), source: "package.json".into(), description: description.clone(), cwd: cwd.clone() });
    if let Some(scripts) = pkg.get("scripts").and_then(Value::as_object) {
        for name in scripts.keys() {
            let command = if pm == "npm" { format!("npm run {name}") } else { format!("{pm} {name}") };
            out.push(Detected { label: name.clone(), command, source: "package.json".into(), description: description.clone(), cwd: cwd.clone() });
        }
    }
    Ok(out)
}

fn detect(root: &Path) -> Vec<Detected> {
    let mut out = Vec::new();

    // package.json scripts
    if let Ok(found) = detect_package(root, root) {
        out.extend(found);
    }

    // Makefile targets (plain `name:` rules, skipping variables and special targets)
    for file in ["Makefile", "makefile", "GNUmakefile"] {
        let Ok(text) = std::fs::read_to_string(root.join(file)) else { continue };
        let mut seen = std::collections::HashSet::new();
        for line in text.lines() {
            if line.starts_with(['\t', ' ', '.', '#']) {
                continue;
            }
            let Some((name, rest)) = line.split_once(':') else { continue };
            let name = name.trim();
            if rest.starts_with('=') || name.is_empty() || name.contains(['$', '%', ' ', '=']) {
                continue;
            }
            if seen.insert(name.to_string()) {
                out.push(Detected { label: format!("make {name}"), command: format!("make {name}"), source: file.into(), description: None, cwd: None });
            }
        }
        break;
    }

    // Procfile processes
    if let Ok(text) = std::fs::read_to_string(root.join("Procfile")) {
        for line in text.lines() {
            if let Some((name, cmd)) = line.split_once(':') {
                let (name, cmd) = (name.trim(), cmd.trim());
                if !name.is_empty() && !cmd.is_empty() && !name.starts_with('#') {
                    out.push(Detected { label: name.into(), command: cmd.into(), source: "Procfile".into(), description: None, cwd: None });
                }
            }
        }
    }

    // Flutter / Dart, Rust, Symfony: a few obvious entry points.
    if root.join("pubspec.yaml").exists() {
        for c in ["flutter pub get", "flutter run", "flutter test"] {
            out.push(Detected { label: c.into(), command: c.into(), source: "pubspec.yaml".into(), description: None, cwd: None });
        }
    }
    if root.join("Cargo.toml").exists() {
        for c in ["cargo run", "cargo test"] {
            out.push(Detected { label: c.into(), command: c.into(), source: "Cargo.toml".into(), description: None, cwd: None });
        }
    }
    if root.join("bin/console").exists() {
        out.push(Detected { label: "symfony serve".into(), command: "symfony serve".into(), source: "bin/console".into(), description: None, cwd: None });
    }
    out
}

/// The commands of one file `package.json` that sits inside the project at `root`, at any depth.
fn package_scripts(root: &Path, package_json: &Path) -> Result<Vec<Detected>, String> {
    if package_json.file_name().and_then(|name| name.to_str()) != Some("package.json") {
        return Err(format!("{} is not a file package.json.", package_json.display()));
    }
    let root = root.canonicalize().map_err(|e| format!("Cannot read {}: {e}", root.display()))?;
    let package_json = package_json.canonicalize().map_err(|e| format!("Cannot read {}: {e}", package_json.display()))?;
    let Some(folder) = package_json.parent().filter(|folder| folder.starts_with(&root)) else {
        return Err(format!("{} is outside the project.", package_json.display()));
    };
    detect_package(folder, &root)
}

#[tauri::command]
pub fn project_package_scripts(root: String, package_json: String) -> Result<Vec<Detected>, String> {
    package_scripts(Path::new(&root), Path::new(&package_json))
}

#[tauri::command]
pub fn project_load(cwd: String) -> Result<Project, String> {
    let root = find_root(Path::new(&cwd));
    let path = config_path(&root);
    let config = match std::fs::read_to_string(&path) {
        Ok(text) => serde_json::from_str(&text).map_err(|e| format!("{CONFIG_DIR}/{CONFIG_FILE} invalide : {e}"))?,
        Err(_) => json!({ "version": 1, "launchers": [] }),
    };
    Ok(Project {
        root: root.display().to_string(),
        config_path: path.display().to_string(),
        detected: detect(&root),
        config,
    })
}

#[tauri::command]
pub fn project_save(root: String, config: Value) -> Result<(), String> {
    let path = config_path(Path::new(&root));
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| format!("création de {} impossible : {e}", dir.display()))?;
    }
    let mut text = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    text.push('\n');
    std::fs::write(&path, text).map_err(|e| format!("écriture de {} impossible : {e}", path.display()))
}

/// The text of the file `.heidrun/config.json` of the project that holds `cwd`, or an empty text when the project has none.
/// The window reads it about every second and loads the project again when the text changes, so a change made by another
/// program, such as the command line `heidrun_code_ctrl`, shows in the window.
#[tauri::command]
pub fn project_config_text(cwd: String) -> String {
    std::fs::read_to_string(config_path(&find_root(Path::new(&cwd)))).unwrap_or_default()
}

#[derive(Serialize)]
pub struct RepoRefs {
    pub root: String,
    /// `remote.origin.url` (or the first remote), as git stores it.
    pub remote: Option<String>,
    /// The `references` section of `.heidrun/config.json`, if any.
    pub references: Value,
}

/// What the terminal needs to turn `#12`, `!34`, `PR #5`… into links:
/// the repository's remote and the project's reference settings.
#[tauri::command]
pub async fn project_refs(cwd: String) -> Result<RepoRefs, String> {
    let root = find_root(Path::new(&cwd));
    let references = std::fs::read_to_string(config_path(&root))
        .ok()
        .and_then(|t| serde_json::from_str::<Value>(&t).ok())
        .and_then(|v| v.get("references").cloned())
        .unwrap_or(Value::Null);
    let git = |args: &[&str]| {
        let root = root.clone();
        let args: Vec<String> = args.iter().map(|s| s.to_string()).collect();
        async move {
            let out = tokio::process::Command::new("git")
                .arg("-C")
                .arg(&root)
                .args(&args)
                .output()
                .await
                .ok()?;
            let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
            (out.status.success() && !s.is_empty()).then_some(s)
        }
    };
    let mut remote = git(&["config", "--get", "remote.origin.url"]).await;
    if remote.is_none() {
        if let Some(first) = git(&["remote"]).await.and_then(|r| r.lines().next().map(str::to_string)) {
            remote = git(&["config", "--get", &format!("remote.{first}.url")]).await;
        }
    }
    Ok(RepoRefs { root: root.display().to_string(), remote, references })
}

#[cfg(test)]
mod project_tests {
    use super::*;

    fn scratch(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("hd-project-{}-{name}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn finds_the_root_from_a_sub_folder() {
        let dir = scratch("root");
        std::fs::create_dir_all(dir.join(".git")).unwrap();
        std::fs::create_dir_all(dir.join("a/b")).unwrap();
        assert_eq!(find_root(&dir.join("a/b")), dir);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn finds_the_root_from_the_configuration_folder() {
        let dir = scratch("conf");
        std::fs::create_dir_all(dir.join(".heidrun")).unwrap();
        std::fs::create_dir_all(dir.join("deep/er")).unwrap();
        assert_eq!(find_root(&dir.join("deep/er")), dir);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn picks_the_package_manager_from_the_lock_file() {
        let dir = scratch("pm");
        assert_eq!(package_manager_for(&dir, &dir), "npm");
        std::fs::write(dir.join("yarn.lock"), "").unwrap();
        assert_eq!(package_manager_for(&dir, &dir), "yarn");
        std::fs::remove_file(dir.join("yarn.lock")).unwrap();
        std::fs::write(dir.join("bun.lockb"), "").unwrap();
        assert_eq!(package_manager_for(&dir, &dir), "bun");
        std::fs::write(dir.join("pnpm-lock.yaml"), "").unwrap();
        std::fs::write(dir.join("yarn.lock"), "").unwrap();
        assert_eq!(package_manager_for(&dir, &dir), "pnpm");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn detects_package_scripts_with_the_right_prefix() {
        let dir = scratch("scripts");
        std::fs::write(dir.join("package.json"), r#"{"scripts":{"build":"x","test":"y"}}"#).unwrap();
        let commands: Vec<String> = detect(&dir).into_iter().map(|d| d.command).collect();
        assert!(commands.contains(&"npm install".to_string()));
        assert!(commands.contains(&"npm run build".to_string()));
        std::fs::write(dir.join("pnpm-lock.yaml"), "").unwrap();
        let commands: Vec<String> = detect(&dir).into_iter().map(|d| d.command).collect();
        assert!(commands.contains(&"pnpm test".to_string()));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn detects_makefile_targets_and_skips_variables() {
        let dir = scratch("make");
        std::fs::write(dir.join("Makefile"), "CC := gcc\n.PHONY: all\nall: build\n\techo\nbuild:\n%.o: %.c\nbuild:\n# note\n").unwrap();
        let commands: Vec<String> = detect(&dir).into_iter().map(|d| d.command).collect();
        assert_eq!(commands, vec!["make all", "make build"]);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn detects_procfile_processes() {
        let dir = scratch("proc");
        std::fs::write(dir.join("Procfile"), "web: node server.js\n# comment: x\nworker:\n\n").unwrap();
        let found = detect(&dir);
        assert_eq!(found.len(), 1);
        assert_eq!((found[0].label.as_str(), found[0].command.as_str()), ("web", "node server.js"));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn detects_the_usual_project_files() {
        let dir = scratch("kinds");
        std::fs::write(dir.join("Cargo.toml"), "").unwrap();
        std::fs::write(dir.join("pubspec.yaml"), "").unwrap();
        std::fs::create_dir_all(dir.join("bin")).unwrap();
        std::fs::write(dir.join("bin/console"), "").unwrap();
        let commands: Vec<String> = detect(&dir).into_iter().map(|d| d.command).collect();
        for expected in ["cargo test", "flutter run", "symfony serve"] {
            assert!(commands.contains(&expected.to_string()), "missing {expected}");
        }
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn detects_nothing_in_an_empty_folder() {
        let dir = scratch("empty");
        assert!(detect(&dir).is_empty());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn names_a_package_script_by_its_key_and_says_which_file_it_comes_from() {
        let dir = scratch("package-description");
        std::fs::write(dir.join("package.json"), r#"{ "scripts": { "dev": "tauri dev" } }"#).unwrap();
        let detected = detect(&dir);
        let dev = detected.iter().find(|d| d.command == "npm run dev").unwrap();
        assert_eq!(dev.label, "dev");
        assert_eq!(dev.description.as_deref(), Some("from package.json"));
        let install = detected.iter().find(|d| d.command == "npm install").unwrap();
        assert_eq!((install.label.as_str(), install.description.as_deref()), ("npm install", Some("from package.json")));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn ignores_a_broken_package_file() {
        let dir = scratch("broken");
        std::fs::write(dir.join("package.json"), "{ not json").unwrap();
        assert!(detect(&dir).is_empty());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn detects_the_scripts_of_a_package_file_in_a_sub_folder_with_its_folder() {
        let dir = scratch("sub-package");
        std::fs::create_dir_all(dir.join("packages/web")).unwrap();
        std::fs::write(dir.join("package.json"), r#"{ "scripts": { "build": "root" } }"#).unwrap();
        std::fs::write(dir.join("packages/web/package.json"), r#"{ "scripts": { "dev": "vite" } }"#).unwrap();
        let found = package_scripts(&dir, &dir.join("packages/web/package.json")).unwrap();
        let commands: Vec<&str> = found.iter().map(|d| d.command.as_str()).collect();
        assert_eq!(commands, vec!["npm install", "npm run dev"]);
        assert!(found.iter().all(|d| d.cwd.as_deref() == Some("packages/web")));
        assert_eq!(found[1].label, "dev");
        assert!(found.iter().all(|d| d.description.as_deref() == Some("from ./packages/web/package.json")));
        let root_found = package_scripts(&dir, &dir.join("package.json")).unwrap();
        assert!(root_found.iter().all(|d| d.cwd.is_none()));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn uses_the_lock_file_of_the_root_for_a_package_in_a_sub_folder() {
        let dir = scratch("sub-package-manager");
        std::fs::create_dir_all(dir.join("packages/web")).unwrap();
        std::fs::write(dir.join("pnpm-lock.yaml"), "").unwrap();
        std::fs::write(dir.join("packages/web/package.json"), r#"{ "scripts": { "dev": "vite" } }"#).unwrap();
        let found = package_scripts(&dir, &dir.join("packages/web/package.json")).unwrap();
        assert_eq!(found[1].command, "pnpm dev");
        std::fs::write(dir.join("packages/web/yarn.lock"), "").unwrap();
        let found = package_scripts(&dir, &dir.join("packages/web/package.json")).unwrap();
        assert_eq!(found[1].command, "yarn dev");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn refuses_a_package_file_outside_the_project() {
        let dir = scratch("package-inside");
        let outside = scratch("package-outside");
        std::fs::write(outside.join("package.json"), r#"{ "scripts": { "dev": "vite" } }"#).unwrap();
        let error = package_scripts(&dir, &outside.join("package.json")).map(|_| ()).unwrap_err();
        assert!(error.contains("outside the project"));
        let _ = std::fs::remove_dir_all(&dir);
        let _ = std::fs::remove_dir_all(&outside);
    }

    #[test]
    fn refuses_a_file_that_is_not_named_package_json() {
        let dir = scratch("package-name");
        std::fs::write(dir.join("composer.json"), "{}").unwrap();
        let error = package_scripts(&dir, &dir.join("composer.json")).map(|_| ()).unwrap_err();
        assert!(error.contains("not a file package.json"));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn reports_a_broken_package_file_that_the_person_picked() {
        let dir = scratch("package-broken-picked");
        std::fs::write(dir.join("package.json"), "{ not json").unwrap();
        let error = package_scripts(&dir, &dir.join("package.json")).map(|_| ()).unwrap_err();
        assert!(error.contains("not valid JSON"));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn loads_a_default_configuration_when_the_file_is_missing() {
        let dir = scratch("load-default");
        std::fs::create_dir_all(dir.join(".git")).unwrap();
        let project = project_load(dir.display().to_string()).unwrap();
        assert_eq!(project.config, json!({ "version": 1, "launchers": [] }));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn saves_then_loads_the_configuration() {
        let dir = scratch("roundtrip");
        std::fs::create_dir_all(dir.join(".git")).unwrap();
        let config = json!({ "version": 1, "launchers": [{ "id": "a", "label": "A", "command": "ls" }] });
        project_save(dir.display().to_string(), config.clone()).unwrap();
        let text = std::fs::read_to_string(dir.join(".heidrun/config.json")).unwrap();
        assert!(text.ends_with('\n'));
        assert_eq!(project_load(dir.display().to_string()).unwrap().config, config);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn reports_an_invalid_configuration_file() {
        let dir = scratch("invalid");
        std::fs::create_dir_all(dir.join(".heidrun")).unwrap();
        std::fs::write(dir.join(".heidrun/config.json"), "{ nope").unwrap();
        let error = project_load(dir.display().to_string()).map(|_| ()).unwrap_err();
        assert!(error.contains("config.json"));
        let _ = std::fs::remove_dir_all(&dir);
    }
}
