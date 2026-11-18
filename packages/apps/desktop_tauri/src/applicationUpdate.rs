//! Checks the Heidrun Code release and stages a replacement before touching the running application.
#![allow(non_snake_case)]

use std::ffi::CString;
use std::io::Write;
use std::os::unix::ffi::OsStrExt;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use semver::Version;
use serde::Deserialize;
use serde_json::json;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter, Manager};

/// Owns the update shown in the top bar and prevents overlapping operations.
#[derive(Default)]
pub(super) struct ApplicationUpdate {
	busy: AtomicBool,
	isRestarting: AtomicBool,
	isInstalling: AtomicBool,
	available: Mutex<Option<String>>,
	pendingConfirmation: Mutex<Option<(UpdateSource, AvailableUpdate)>>,
}

/// The release source and the only application bundle this run is allowed to replace.
struct UpdateSource {
	endpoint: String,
	bundle: PathBuf,
	isTest: bool,
}

/// The latest release response. The local test server uses the same fields as GitHub.
#[derive(Deserialize)]
struct Release {
	#[serde(rename = "tag_name")]
	tagName: String,
	assets: Vec<ReleaseAsset>,
}

/// The disk image and its published checksum.
#[derive(Deserialize)]
struct ReleaseAsset {
	name: String,
	digest: Option<String>,
	#[serde(rename = "browser_download_url")]
	downloadUrl: String,
}

/// An installable release newer than the running version.
struct AvailableUpdate {
	version: Version,
	downloadUrl: String,
	checksum: String,
}

impl ApplicationUpdate {
	/// Adds update commands only when the running bundle has an eligible source.
	pub(super) fn isEnabled(app: &AppHandle) -> bool {
		Self::_source(app).is_some()
	}

	/// Keeps the Herdr session running when the application is restarting for an update.
	pub(super) fn isRestarting(&self) -> bool {
		self.isRestarting.load(Ordering::Acquire)
	}

	/// Reports whether an accepted installation is still running.
	pub(super) fn isInstalling(&self) -> bool {
		self.isInstalling.load(Ordering::Acquire)
	}

	/// Checks immediately and every 24 hours in installed Heidrun Code.
	pub(super) fn start(app: AppHandle) {
		let Some(source) = Self::_source(&app) else { return };
		Self::_record(
			"startup",
			json!({"version": app.package_info().version.to_string(), "test": source.isTest}),
		);
		if source.isTest == true {
			if std::env::args_os().any(|argument| argument == "--update-test-check-on-startup") {
				Self::check(app, false);
			}
			return;
		}
		tauri::async_runtime::spawn(async move {
			let mut interval = tokio::time::interval(Duration::from_secs(24 * 60 * 60));
			loop {
				interval.tick().await;
				Self::check(app.clone(), false);
			}
		});
	}

	/// Handles a manual or automatic check. Failed checks are recorded in the application log.
	pub(super) fn check(app: AppHandle, isManual: bool) {
		let Some(source) = Self::_source(&app) else { return };
		if app.state::<Self>().busy.swap(true, Ordering::AcqRel) == true {
			return;
		}
		tauri::async_runtime::spawn(async move {
			let started = Instant::now();
			let result = Self::_checkRelease(&source, &app.package_info().version).await;
			let state = app.state::<Self>();
			match result {
				Ok((latest, update)) => {
					Self::_record(
						"check",
						json!({
							"manual": isManual, "duration_ms": started.elapsed().as_millis(),
							"latest": latest.to_string(),
							"available": update.as_ref().map(|update| update.version.to_string()),
						}),
					);
					let available = update.as_ref().map(|update| update.version.to_string());
					let previous = std::mem::replace(&mut *state.available.lock().unwrap(), available.clone());
					if previous != available {
						let _ = app.emit("application-update-available", &available);
					}
					if isManual == true {
						let isInstallable = update.is_some();
						if let Some(update) = update {
							*state.pendingConfirmation.lock().unwrap() = Some((source, update));
						}
						let result = app.emit_to(
							"main",
							"application-update-dialog",
							json!({
								"running": app.package_info().version.to_string(),
								"latest": latest.to_string(),
								"isInstallable": isInstallable,
							}),
						);
						if isInstallable == true && result.is_ok() == true {
							return;
						}
						if let Err(error) = result {
							state.pendingConfirmation.lock().unwrap().take();
							Self::_record("dialog_failed", json!({"error": error.to_string()}));
						}
					}
				}
				Err(error) => Self::_record(
					"check",
					json!({
						"manual": isManual, "duration_ms": started.elapsed().as_millis(), "error": error,
					}),
				),
			}
			state.busy.store(false, Ordering::Release);
		});
	}

	/// Returns the newest known installable version for a newly mounted top bar.
	pub(super) fn availableVersion(&self) -> Option<String> {
		self.available.lock().unwrap().clone()
	}

	/// Accepts or dismisses the release shown by the last manual check.
	pub(super) async fn confirm(app: AppHandle, version: &str, isConfirmed: bool) -> Result<(), String> {
		let state = app.state::<Self>();
		let pending = {
			let mut pending = state.pendingConfirmation.lock().unwrap();
			if pending
				.as_ref()
				.is_some_and(|(_, update)| update.version.to_string() == version)
			{
				pending.take()
			} else {
				None
			}
		};
		let Some((source, update)) = pending else {
			return Err("Check for updates again.".into());
		};
		Self::_record("confirmation", json!({"version": version, "accepted": isConfirmed}));
		if isConfirmed == false {
			state.busy.store(false, Ordering::Release);
			return Ok(());
		}
		state.isInstalling.store(true, Ordering::Release);
		let result = Self::_install(&app, source, update).await;
		if let Err(error) = &result {
			Self::_record("install_failed", json!({"error": error}));
			state.isInstalling.store(false, Ordering::Release);
			state.busy.store(false, Ordering::Release);
		}
		result
	}

	/// Prepares the replacement off the main thread and swaps it before requesting a restart.
	async fn _install(app: &AppHandle, source: UpdateSource, update: AvailableUpdate) -> Result<(), String> {
		let (folder, replacement) = Self::_prepare(&source, &update, app.config().identifier.clone()).await?;
		let (sendResult, receiveResult) = tokio::sync::oneshot::channel();
		let handle = app.clone();
		app.run_on_main_thread(move || {
			let result = (|| {
				if super::UNSAVED.load(Ordering::Acquire) == true {
					return Err(if super::is_system_language_french() {
						"Enregistrez les fichiers ouverts avant de réessayer."
					} else {
						"Save open files before retrying the update."
					}
					.into());
				}
				Self::_record("replace", json!({"version": update.version.to_string()}));
				Self::_exchange(&source.bundle, &replacement)?;
				drop(folder);
				Self::_record("restart", json!({"version": update.version.to_string()}));
				handle.state::<Self>().isRestarting.store(true, Ordering::Release);
				handle.request_restart();
				Ok(())
			})();
			let _ = sendResult.send(result);
		})
		.map_err(|error| format!("Install update: {error}"))?;
		receiveResult
			.await
			.map_err(|error| format!("Install update: {error}"))?
	}

	/// Resolves the isolated test folder and loopback port, including after LaunchServices restarts the bundle.
	pub(super) fn testLocation(executable: &Path) -> Option<(PathBuf, u16)> {
		let port = std::env::args_os()
			.find_map(|argument| {
				argument
					.to_str()?
					.strip_prefix("--update-test-port=")?
					.parse::<u16>()
					.ok()
			})
			.filter(|port| *port != 0)?;
		let bundle = executable.parent()?.parent()?.parent()?.canonicalize().ok()?;
		let applications = bundle.parent()?;
		let root = applications.parent()?;
		if applications.file_name()?.to_str()? != "Applications"
			|| root.parent()? != Path::new("/private/tmp")
			|| root.file_name()?.to_str()?.starts_with("heidrun-update-test-") == false
			|| bundle.file_name()?.to_str()? != "Heidrun Code Development.app"
		{
			return None;
		}
		Some((root.to_owned(), port))
	}

	/// Selects the fixed GitHub release endpoint or an explicitly requested loopback test endpoint.
	fn _source(app: &AppHandle) -> Option<UpdateSource> {
		let executable = tauri::process::current_binary(&app.env()).ok()?;
		let bundle = executable.parent()?.parent()?.parent()?.canonicalize().ok()?;
		let isTest = crate::application_profile::is_development();
		let endpoint = if isTest == true {
			let (_, port) = Self::testLocation(&executable)?;
			format!("http://127.0.0.1:{port}/latest")
		} else {
			if bundle != Path::new("/Applications/Heidrun Code.app") {
				return None;
			}
			"https://api.github.com/repos/heidrun-org/heidrun_code/releases/latest".into()
		};
		Some(UpdateSource {
			endpoint,
			bundle,
			isTest,
		})
	}

	/// Reads and validates the latest release for this Mac.
	async fn _checkRelease(
		source: &UpdateSource,
		current: &Version,
	) -> Result<(Version, Option<AvailableUpdate>), String> {
		let response = Self::_client(source)?
			.get(&source.endpoint)
			.timeout(Duration::from_secs(20))
			.send()
			.await
			.map_err(|error| format!("Check release: {}", error.without_url()))?
			.error_for_status()
			.map_err(|error| format!("Check release: {}", error.without_url()))?;
		let release: Release = response
			.json()
			.await
			.map_err(|error| format!("Read release: {error}"))?;
		let version = Version::parse(release.tagName.strip_prefix('v').unwrap_or(&release.tagName))
			.map_err(|error| format!("Read release version: {error}"))?;
		if version <= *current {
			return Ok((version, None));
		}
		let name = format!("Heidrun_Code_{}.dmg", std::env::consts::ARCH);
		let asset = release
			.assets
			.into_iter()
			.find(|asset| asset.name == name)
			.ok_or_else(|| format!("Release {version} does not contain {name}"))?;
		let expectedUrl = if source.isTest == true {
			source.endpoint.replace("/latest", "/update.dmg")
		} else {
			format!("https://github.com/heidrun-org/heidrun_code/releases/download/v{version}/{name}")
		};
		if asset.downloadUrl != expectedUrl {
			return Err("Unexpected disk image address".into());
		}
		let checksum = asset
			.digest
			.as_deref()
			.and_then(|digest| digest.strip_prefix("sha256:"))
			.filter(|digest| digest.len() == 64 && digest.bytes().all(|byte| byte.is_ascii_hexdigit()))
			.ok_or("The release has no valid disk image checksum")?
			.to_ascii_lowercase();
		Ok((
			version.clone(),
			Some(AvailableUpdate {
				version,
				downloadUrl: asset.downloadUrl,
				checksum,
			}),
		))
	}

	/// Creates a client with a bounded request time and the transport allowed for the release source.
	fn _client(source: &UpdateSource) -> Result<reqwest::Client, String> {
		let mut builder = reqwest::Client::builder()
			.user_agent("Heidrun Code update")
			.connect_timeout(Duration::from_secs(10))
			.https_only(source.isTest == false);
		if source.isTest == true {
			builder = builder.no_proxy().redirect(reqwest::redirect::Policy::none());
		}
		builder.build().map_err(|error| error.to_string())
	}

	/// Downloads and verifies the image, then extracts an eligible bundle on the same volume as the running copy.
	async fn _prepare(
		source: &UpdateSource,
		update: &AvailableUpdate,
		identifier: String,
	) -> Result<(tempfile::TempDir, PathBuf), String> {
		let parent = source
			.bundle
			.parent()
			.ok_or("The Applications folder could not be found")?;
		let folder = tempfile::Builder::new()
			.prefix(".heidrun-update-")
			.tempdir_in(parent)
			.map_err(|error| format!("Create staging folder in {}: {error}", parent.display()))?;
		let image = folder.path().join("update.dmg");
		Self::_record("download", json!({"version": update.version.to_string()}));
		let mut response = Self::_client(source)?
			.get(&update.downloadUrl)
			.timeout(Duration::from_secs(300))
			.send()
			.await
			.map_err(|error| format!("Download: {}", error.without_url()))?
			.error_for_status()
			.map_err(|error| format!("Download: {}", error.without_url()))?;
		let mut hasher = Sha256::new();
		let mut imageFile = std::fs::File::create(&image).map_err(|error| format!("Create disk image: {error}"))?;
		let mut bytes = 0;
		while let Some(chunk) = response
			.chunk()
			.await
			.map_err(|error| format!("Download: {}", error.without_url()))?
		{
			bytes += chunk.len();
			if bytes > 512 * 1024 * 1024 {
				return Err("The disk image exceeded the 512 MiB download limit".into());
			}
			hasher.update(&chunk);
			imageFile
				.write_all(&chunk)
				.map_err(|error| format!("Write disk image: {error}"))?;
		}
		drop(imageFile);
		if format!("{:x}", hasher.finalize()) != update.checksum {
			return Err("The disk image checksum does not match the release".into());
		}
		Self::_record("download_verified", json!({"bytes": bytes}));
		let bundleName = source.bundle.file_name().unwrap().to_owned();
		let version = update.version.clone();
		tauri::async_runtime::spawn_blocking(move || {
			let mount = folder.path().join("mount");
			std::fs::create_dir(&mount).map_err(|error| format!("Create mount folder: {error}"))?;
			Self::_record("mount", json!({}));
			Self::_command(
				Command::new("/usr/bin/hdiutil")
					.args(["attach", "-nobrowse", "-readonly", "-mountpoint"])
					.arg(&mount)
					.arg(&image),
				"Mount disk image",
			)?;
			let replacement = folder.path().join(&bundleName);
			let copy = Self::_verifyAndCopy(&mount.join(bundleName), &replacement, &identifier, &version);
			let detach = Self::_command(
				Command::new("/usr/bin/hdiutil").arg("detach").arg(&mount),
				"Detach disk image",
			);
			if let Err(error) = detach {
				let retained = folder.keep();
				return Err(format!("{error}. Staging folder retained at {}", retained.display()));
			}
			copy?;
			Ok((folder, replacement))
		})
		.await
		.map_err(|error| format!("Prepare update: {error}"))?
	}

	/// Confirms the bundle identifier, version and executable before copying the mounted application.
	fn _verifyAndCopy(bundle: &Path, destination: &Path, identifier: &str, version: &Version) -> Result<(), String> {
		let plist = bundle.join("Contents/Info.plist");
		let read = |key| {
			Self::_command(
				Command::new("/usr/bin/plutil")
					.args(["-extract", key, "raw", "-o", "-"])
					.arg(&plist),
				"Read updated application information",
			)
		};
		if read("CFBundleIdentifier")?.trim() != identifier
			|| read("CFBundleShortVersionString")?.trim() != version.to_string()
		{
			return Err("The disk image contains an unexpected application identifier or version".into());
		}
		let executable = read("CFBundleExecutable")?;
		let executable = Path::new(executable.trim());
		if executable.components().count() != 1 || bundle.join("Contents/MacOS").join(executable).is_file() == false {
			return Err("The disk image does not contain the application executable".into());
		}
		Self::_record("stage", json!({"version": version.to_string()}));
		Self::_command(
			Command::new("/usr/bin/ditto").arg(bundle).arg(destination),
			"Copy application",
		)?;
		Ok(())
	}

	/// Atomically swaps the live and staged bundles. A failed swap leaves the live bundle in place.
	fn _exchange(current: &Path, replacement: &Path) -> Result<(), String> {
		let current = CString::new(current.as_os_str().as_bytes()).map_err(|error| error.to_string())?;
		let replacement = CString::new(replacement.as_os_str().as_bytes()).map_err(|error| error.to_string())?;
		// Both paths are NUL-terminated and stay alive during the system call.
		if unsafe { libc::renamex_np(current.as_ptr(), replacement.as_ptr(), libc::RENAME_SWAP) } != 0 {
			return Err(format!("Replace the application: {}", std::io::Error::last_os_error()));
		}
		Ok(())
	}

	/// Runs a macOS command and keeps its error output with the name of the failed step.
	fn _command(command: &mut Command, step: &str) -> Result<String, String> {
		let output = command.output().map_err(|error| format!("{step}: {error}"))?;
		if output.status.success() == false {
			return Err(format!(
				"{step}: {}: {}",
				output.status,
				String::from_utf8_lossy(&output.stderr).trim()
			));
		}
		Ok(String::from_utf8_lossy(&output.stdout).into_owned())
	}

	/// Writes update progress to the application log without exposing download redirect addresses.
	fn _record(step: &str, mut fields: serde_json::Value) {
		fields["step"] = json!(step);
		crate::application_log::write("application_update", fields);
	}
}
