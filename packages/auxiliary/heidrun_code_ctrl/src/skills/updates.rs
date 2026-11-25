//! Inspection and replacement of installed skill files from their recorded sources.

use std::collections::BTreeMap;
use std::fs::{self, File, OpenOptions};
use std::path::{Path, PathBuf};

use serde::Serialize;

use super::agentFolders::{skills_dir, workspaceBoundary, AGENTS};
use super::cache::manifestPath;
use super::RepositoryTrees;
use super::install::{stageSource, Install};
use super::types::{is_valid_name, SkillOrigin, ORIGIN_FILE};

/// One installed copy of a skill, with the coding agents that see that copy.
pub struct SkillInstallation {
	/// The name of the folder in the coding agent's skills folder.
	pub name: String,
	/// The coding agents that see the installation.
	pub agents: Vec<String>,
	/// Whether the folder has a Heidrun Code installation record.
	pub isInstalledByHeidrunCode: bool,
	/// The canonical path of the installed files.
	path: PathBuf,
	/// Whether the files are in a real folder at the selected installation level.
	isInScope: bool,
}

/// One result from comparing or updating a skill.
#[derive(Debug, PartialEq, Eq)]
pub enum Outcome {
	/// The source and installation differ.
	Different,
	/// The source and installation match.
	AlreadyCurrent,
	/// A comparison with the latest complete source saved on disk, with the reason for using it.
	Cached { isSame: bool, reason: String },
	/// The source has replaced the installation.
	Updated,
	/// An update was skipped, with the reason.
	Skipped(String),
	/// An inspection or update failed, with the reason.
	Failed(String),
}

/// A row produced by skill listing or updating.
#[derive(Serialize)]
pub struct SkillReport {
	/// The skill folder name.
	pub name: String,
	/// The coding agents that see this installation.
	pub agents: Vec<String>,
	/// Whether Heidrun Code installed this skill.
	#[serde(rename = "installed_by_heidrun_code")]
	pub isInstalledByHeidrunCode: bool,
	/// The result label, when the operation checked this skill.
	pub status: Option<&'static str>,
	/// Whether the comparison used an older source saved to disk.
	#[serde(rename = "stale", skip_serializing_if = "std::ops::Not::not")]
	pub isStale: bool,
	/// A reason for a skipped or failed operation.
	pub reason: Option<String>,
}

impl SkillReport {
	/// Creates a row for the installation and its optional outcome.
	pub fn new(skillInstallation: SkillInstallation, outcome: Option<Outcome>) -> Self {
		let isStale = matches!(outcome, Some(Outcome::Cached { .. }));
		let (status, reason) = match outcome {
			Some(Outcome::Different) => (Some("Different"), None),
			Some(Outcome::AlreadyCurrent) => (Some("Already current"), None),
			Some(Outcome::Cached { isSame, reason }) => {
				let status = if isSame { "Already current" } else { "Different" };
				(Some(status), Some(format!("Stale cache. {}", super::readableGitHubError(&reason))))
			}
			Some(Outcome::Updated) => (Some("Updated"), None),
			Some(Outcome::Skipped(reason)) => (Some("Skipped"), Some(reason)),
			Some(Outcome::Failed(reason)) => (Some("Failed"), Some(super::readableGitHubError(&reason))),
			None => (None, None),
		};
		Self {
			name: skillInstallation.name,
			agents: skillInstallation.agents,
			isInstalledByHeidrunCode: skillInstallation.isInstalledByHeidrunCode,
			status,
			isStale,
			reason,
		}
	}
}

impl SkillInstallation {
	/// Lists the installations at the selected level and workspace path, grouping links to the same files.
	pub fn list(level: &str, workspacePath: Option<&str>) -> Result<Vec<Self>, String> {
		let mut installations = BTreeMap::new();
		let workspaceRoot = workspaceBoundary(level, workspacePath)?;
		for agent in AGENTS {
			let skillsFolder = skills_dir(agent, level, workspacePath)?;
			let entries = match fs::read_dir(&skillsFolder) {
				Ok(entries) => entries,
				Err(error) if error.kind() == std::io::ErrorKind::NotFound => continue,
				Err(error) => return Err(format!("Cannot read {}: {error}", skillsFolder.display())),
			};
			for entry in entries {
				let entry = entry.map_err(|error| error.to_string())?;
				let Some(name) = entry.file_name().into_string().ok().filter(|name| is_valid_name(name)) else {
					continue;
				};
				let Ok(path) = entry.path().canonicalize() else {
					continue;
				};
				if path.join("SKILL.md").is_file() == false {
					continue;
				}
				let isRealFolder = entry.file_type().is_ok_and(|fileType| fileType.is_dir());
				let isWithinLevel = workspaceRoot.as_ref().is_none_or(|root| path != *root && path.starts_with(root));
				let installation = installations.entry((name.clone(), path.clone())).or_insert_with(|| Self {
					name,
					agents: Vec::new(),
					isInstalledByHeidrunCode: path.join(ORIGIN_FILE).symlink_metadata().is_ok(),
					path,
					isInScope: false,
				});
				installation.agents.push(agent.to_string());
				installation.isInScope |= isRealFolder && isWithinLevel;
			}
		}
		Ok(installations.into_values().collect())
	}

	/// Compares this installation against its recorded source, and replaces it when requested.
	pub async fn reconcile(&self, isUpdate: bool, repositoryTrees: &mut RepositoryTrees) -> Outcome {
		if self.isInstalledByHeidrunCode == false {
			return Outcome::Skipped("Heidrun Code installation record is missing.".into());
		}
		if self.isInScope == false {
			return Outcome::Skipped("The installed files are outside the selected installation level.".into());
		}
		let originPath = self.path.join(ORIGIN_FILE);
		if originPath.symlink_metadata().is_ok_and(|metadata| metadata.is_file()) == false {
			return Outcome::Skipped("Heidrun Code installation record is not a regular file.".into());
		}
		let Ok(originRecord) = fs::read(originPath) else {
			return Outcome::Skipped("Heidrun Code installation record could not be read.".into());
		};
		let Ok(skillOrigin) = serde_json::from_slice::<SkillOrigin>(&originRecord) else {
			return Outcome::Skipped("Heidrun Code installation record is invalid.".into());
		};
		if skillOrigin.folder_url.is_none()
			&& skillOrigin.folder_path.is_none()
			&& (super::types::is_valid_source(&skillOrigin.source) == false
				|| is_valid_name(&skillOrigin.skill_id) == false)
		{
			return Outcome::Skipped("Heidrun Code installation record does not identify a usable source.".into());
		}
		match self._reconcile(isUpdate, &skillOrigin, &originRecord, repositoryTrees).await {
			Ok(outcome) => outcome,
			Err(reason) => Outcome::Failed(reason),
		}
	}

	/// Stages the source, compares the files, and commits a complete replacement only if needed.
	async fn _reconcile(
		&self,
		isUpdate: bool,
		skillOrigin: &SkillOrigin,
		originRecord: &[u8],
		repositoryTrees: &mut RepositoryTrees,
	) -> Result<Outcome, String> {
		let parent = self.path.parent().ok_or("The installed skill folder has no parent.")?;
		let _lock = if isUpdate { Some(Self::_lock(parent)?) } else { None };
		if let Some(sourcePath) = &skillOrigin.folder_path {
			if let Ok(sourcePath) = Path::new(sourcePath).canonicalize() {
				if sourcePath != self.path && (self.path.starts_with(&sourcePath) || sourcePath.starts_with(&self.path)) {
					return Err("The recorded source and the installation contain one another.".into());
				}
			}
		}
		let staging = if isUpdate {
			tempfile::Builder::new().prefix(".heidrun-skill-update-").tempdir_in(parent)
		} else {
			tempfile::tempdir()
		}.map_err(|error| error.to_string())?;
		let folderUrl = skillOrigin.folder_url.as_deref().or_else(|| Self::_bundledFolderUrl(skillOrigin));
		let cachePath = manifestPath(
			&skillOrigin.source, &skillOrigin.skill_id, folderUrl, skillOrigin.folder_path.as_deref(),
		);
		let stageResult = stageSource(
			repositoryTrees,
			&skillOrigin.source,
			&skillOrigin.skill_id,
			folderUrl,
			skillOrigin.folder_path.as_deref(),
			staging.path(),
		).await;
		let comparison = Install::compareSource(&self.path, staging.path(), &cachePath, stageResult, isUpdate == false)?;
		if let Some(reason) = comparison.staleReason {
			return Ok(Outcome::Cached { isSame: comparison.isSame, reason });
		}
		if comparison.isSame {
			return Ok(Outcome::AlreadyCurrent);
		}
		if isUpdate == false {
			return Ok(Outcome::Different);
		}
		let currentRecord = fs::read(self.path.join(ORIGIN_FILE)).map_err(|error| error.to_string())?;
		if currentRecord != originRecord || self.path.symlink_metadata().is_ok_and(|metadata| metadata.is_dir()) == false {
			return Err("The installation changed during the update.".into());
		}
		fs::write(staging.path().join(ORIGIN_FILE), originRecord).map_err(|error| error.to_string())?;
		Self::_replace(staging.path(), &self.path)?;
		Ok(Outcome::Updated)
	}

	/// Resolves the two bundled skills whose old installation records have no folder address.
	fn _bundledFolderUrl(skillOrigin: &SkillOrigin) -> Option<&'static str> {
		if skillOrigin.source != "heidrun-org/heidrun" || skillOrigin.folder_path.is_some() {
			return None;
		}
		match skillOrigin.skill_id.as_str() {
			"heidrun-code-ctrl" => Some(concat!(
				"https://github.com/heidrun-org/heidrun_code/tree/main/",
				"packages/auxiliary/heidrun_code_ctrl/skills/heidrun-code-ctrl",
			)),
			"heidrun-data" => Some(concat!(
				"https://github.com/heidrun-org/heidrun_data/tree/main/",
				"packages/apps/heidrun_data/skills/heidrun-data",
			)),
			_ => None,
		}
	}

	/// Locks the skills folder for file replacement. The file stays in place for later updates to lock.
	fn _lock(parent: &Path) -> Result<File, String> {
		let lock = OpenOptions::new()
			.read(true)
			.write(true)
			.create(true)
			.truncate(false)
			.open(parent.join(".heidrun-skill-update.lock"))
			.map_err(|error| error.to_string())?;
		lock.try_lock().map_err(|error| format!("Cannot lock the skills folder for update: {error}"))?;
		Ok(lock)
	}

	/// Exchanges the two folders without interrupting access to the installed skill.
	#[cfg(any(target_os = "macos", target_os = "linux"))]
	fn _replace(stagedPath: &Path, installedPath: &Path) -> Result<(), String> {
		use rustix::fs::{renameat_with, RenameFlags, CWD};

		renameat_with(CWD, stagedPath, CWD, installedPath, RenameFlags::EXCHANGE)
			.map_err(|error| format!("Cannot replace the installed skill: {error}"))
	}

	/// Moves the old folder aside on platforms without directory exchange, and restores it on failure.
	#[cfg(not(any(target_os = "macos", target_os = "linux")))]
	fn _replace(stagedPath: &Path, installedPath: &Path) -> Result<(), String> {
		let backup = tempfile::Builder::new().prefix(".heidrun-skill-backup-")
			.tempdir_in(installedPath.parent().ok_or("The installed skill folder has no parent.")?)
			.map_err(|error| error.to_string())?;
		let backupPath = backup.path().join("skill");
		fs::rename(installedPath, &backupPath).map_err(|error| error.to_string())?;
		if let Err(error) = fs::rename(stagedPath, installedPath) {
			if let Err(restoreError) = fs::rename(&backupPath, installedPath) {
				let preserved = backup.keep();
				return Err(format!(
					"Cannot replace the installed skill: {error}. Cannot restore the installation: {restoreError}. \
					The original files are in {}.",
					preserved.join("skill").display(),
				));
			}
			return Err(format!("Cannot replace the installed skill: {error}"));
		}
		Ok(())
	}
}
