//! Command line entry points for finding and managing skills.

use std::io::IsTerminal;
use std::path::Path;

use heidrun_code_ctrl::skills::types::is_valid_name;
use heidrun_code_ctrl::skills::updates::{SkillInstallation, SkillReport};
use heidrun_code_ctrl::skills::{install, installed, readableGitHubError, search, RepositoryTrees};
use serde::Serialize;

/// Requested output representation.
#[derive(Clone, Copy, PartialEq, Eq)]
enum SkillFormat {
	Text,
	Markdown,
	Json,
}

/// The options shared by skill commands, plus the options specific to individual commands.
pub(super) struct SkillCommands {
	/// User or workspace installation level.
	level: String,
	/// Folder for a workspace-level operation.
	workspacePath: Option<String>,
	/// The requested output format.
	format: SkillFormat,
	/// Whether all installers are included in a list.
	isAllInstallers: bool,
	/// Whether an update covers every eligible skill.
	isBulkUpdate: bool,
	/// Name of the repository, folder address, or folder path for an installation or search.
	source: Option<(String, String)>,
	/// Coding agent identifiers requested for installation.
	agents: Vec<String>,
}

impl SkillCommands {
	/// Parses the skill arguments after `skills` and performs the requested command.
	pub fn run(arguments: &[String]) -> Result<(String, bool), String> {
		if arguments.iter().any(|argument| argument == "--help" || argument == "-h") {
			let command = arguments.first().map(String::as_str).filter(|argument| matches!(*argument, "--help" | "-h") == false);
			return Self::_help(command).map(|text| (text, false));
		}
		let (skillCommand, arguments) = arguments.split_first().ok_or("Choose a skills command.")?;
		let (options, positionals) = Self::_parse(skillCommand, arguments)?;
		let runtime = tokio::runtime::Builder::new_current_thread()
			.enable_all()
			.build()
			.map_err(|error| error.to_string())?;
		runtime.block_on(options._execute(skillCommand, &positionals)).map_err(|error| readableGitHubError(&error))
	}

	/// Shows help for the skills group or one of its commands without opening a workspace or fetching a source.
	fn _help(command: Option<&str>) -> Result<String, String> {
		let scopeOptions = r#"  -l, --level <user|workspace>     Installation level (default: workspace).
  -w, --workspace-path <path>         Absolute or relative workspace path (default: .).
"#;
		let formatOptions = r#"  -f, --format <text|markdown|json>     Output format (default: markdown). Text uses terminal color.
  -h, --help                          Show this help.
"#;
		let listOptions = r#"  -i, --installer <heidrun_code|all>    Include Heidrun Code installations or every installer.
                                      Default: heidrun_code.
"#;
		let updateOptions = r#"  -a, --all                        Update all skills installed by Heidrun Code at this level.
"#;
		let folderOptions = r#"      --folder-url <url>           GitHub or GitLab folder.
      --local-folder <path>           Folder on this computer.
"#;
		let installOptions = r#"      --repository <owner/repo>   Repository from a skills.sh search result.
      --agent <agent>                 claude, codex, or antigravity. Repeat to select several.
                                  Default: codex.
"#;
		let (usage, details, options) = match command {
			None => {
				let commands = r#"Commands:
  list      List installed skills and show which are Different.
  update    Update one skill or all skills installed by Heidrun Code.
  search    Find skills on skills.sh or in a folder.
  install   Install a skill from a repository or folder.
  delete    Remove an installed skill and its coding agent links.

Run heidrun_code_ctrl skills <command> --help for the options and usage of a command.

Options for all skills commands:
"#;
				let sectionOptions = [
					("Options for list, update, install, and delete", scopeOptions),
					("List options", listOptions),
					("Update options", updateOptions),
					("Search and install options", folderOptions),
					("Install options", installOptions),
				];
				let mut help = format!("Usage: heidrun_code_ctrl skills <command> [options]\n\n{commands}{formatOptions}");
				for (heading, options) in sectionOptions {
					help.push_str(&format!("\n{heading}:\n{options}"));
				}
				return Ok(help);
			}
			Some("list") => (
				"list [options]",
				"List installed skills and show which are Different.",
				format!("{scopeOptions}{listOptions}"),
			),
			Some("update") => (
				"update <skill-name> [options]\n       heidrun_code_ctrl skills update --all [options]",
				"Update skills installed by Heidrun Code from their recorded sources.",
				format!("{scopeOptions}{updateOptions}"),
			),
			Some("search") => (
				"search <query> [options]\n       heidrun_code_ctrl skills search (--folder-url <url> | --local-folder <path>) [options]",
				"Find skills on skills.sh or in a folder.",
				folderOptions.to_string(),
			),
			Some("install") => (
				"install <skill-name> --repository <owner/repo> [options]\n       heidrun_code_ctrl skills install (--folder-url <url> | --local-folder <path>) [options]",
				"Install a skill from a repository or folder.",
				format!("{scopeOptions}{folderOptions}{installOptions}"),
			),
			Some("delete") => (
				"delete <skill-name> [options]",
				"Remove an installed skill and its coding agent links.",
				scopeOptions.to_string(),
			),
			Some(command) => return Err(format!("Unknown skills command {command}. Run heidrun_code_ctrl skills --help.")),
		};
		Ok(format!("Usage: heidrun_code_ctrl skills {usage}\n\n{details}\n\nOptions:\n{options}{formatOptions}"))
	}

	/// Parses options for the selected command and collects positional arguments.
	fn _parse(skillCommand: &str, arguments: &[String]) -> Result<(Self, Vec<String>), String> {
		let mut options = Self {
			level: "workspace".into(),
			workspacePath: None,
			format: SkillFormat::Markdown,
			isAllInstallers: false,
			isBulkUpdate: false,
			source: None,
			agents: Vec::new(),
		};
		let mut positionals = Vec::new();
		let mut remaining = arguments.iter();
		while let Some(argument) = remaining.next() {
			if argument.starts_with('-') == false {
				positionals.push(argument.clone());
				continue;
			}
			let (option, inline) = argument.split_once('=').map_or((argument.as_str(), None), |(option, value)| {
				(option, Some(value))
			});
			let mut valueFn = || {
				inline.or_else(|| remaining.next().map(String::as_str).filter(|value| value.starts_with('-') == false))
					.filter(|value| value.is_empty() == false)
					.ok_or_else(|| format!("{option} needs a value."))
			};
			match option {
				"--level" | "-l" if skillCommand != "search" => {
					options.level = match valueFn()? {
						level @ ("workspace" | "user") => level.into(),
						_ => return Err("Use --level workspace or --level user.".into()),
					};
				}
				"--workspace-path" | "-w" if skillCommand != "search" => {
					options.workspacePath = Some(valueFn()?.into());
				}
				"--format" | "-f" => {
					options.format = match valueFn()? {
						"text" => SkillFormat::Text,
						"markdown" => SkillFormat::Markdown,
						"json" => SkillFormat::Json,
						_ => return Err("Use --format text, markdown, or json.".into()),
					};
				}
				"--installer" | "-i" if skillCommand == "list" => {
					options.isAllInstallers = match valueFn()? {
						"all" => true,
						"heidrun_code" => false,
						_ => return Err("Use --installer all or --installer heidrun_code.".into()),
					};
				}
				"--all" | "-a" if skillCommand == "update" && inline.is_none() => options.isBulkUpdate = true,
				"--repository" | "--folder-url" | "--local-folder" if matches!(skillCommand, "install" | "search") => {
					if options.source.is_some() {
						return Err("Choose one skill source.".into());
					}
					if skillCommand == "search" && option == "--repository" {
						return Err("To search a repository, pass its folder address with --folder-url.".into());
					}
					options.source = Some((option.into(), valueFn()?.into()));
				}
				"--agent" if skillCommand == "install" => options.agents.push(valueFn()?.into()),
				_ => return Err(format!("skills {skillCommand} does not accept {option}.")),
			}
		}
		Ok((options, positionals))
	}

	/// Runs the parsed command and returns the selected output representation.
	async fn _execute(&self, skillCommand: &str, positionals: &[String]) -> Result<(String, bool), String> {
		if matches!(skillCommand, "list" | "update") {
			return self._listOrUpdate(skillCommand, positionals).await;
		}
		let output = self._executeOther(skillCommand, positionals).await?;
		Ok((output, false))
	}

	/// Runs a command that can report an error before producing any output.
	async fn _executeOther(&self, skillCommand: &str, positionals: &[String]) -> Result<String, String> {
		match skillCommand {
			"search" => self._search(positionals).await,
			"install" => self._install(positionals).await,
			"delete" => {
				let [name] = positionals else {
					return Err("Supply one skill name to delete.".into());
				};
				installed::skillsDeleteUnambiguous(&self.level, self._workspacePath()?.as_deref(), name)?;
				if self.format == SkillFormat::Json {
					return self._json(&serde_json::json!({ "deleted": name }));
				}
				Ok(format!("Deleted {name}.\n"))
			}
			_ => Err(format!("Unknown skills command {skillCommand}. Run heidrun_code_ctrl --help.")),
		}
	}

	/// Resolves the workspace path when the selected level uses one.
	fn _workspacePath(&self) -> Result<Option<String>, String> {
		if self.level == "user" {
			if self.workspacePath.is_some() {
				return Err("--workspace-path applies only at the workspace installation level.".into());
			}
			return Ok(None);
		}
		let workspacePath = self.workspacePath.as_deref().unwrap_or(".");
		let path = Path::new(workspacePath).canonicalize()
			.map_err(|error| format!("Cannot open workspace folder {workspacePath}: {error}"))?;
		if path.is_dir() == false {
			return Err(format!("The workspace path {} is not a folder.", path.display()));
		}
		Ok(Some(path.into_os_string().into_string().map_err(|_| "The workspace path cannot be read as text.")?))
	}

	/// Lists or updates skills and reports the result for each selected installation.
	async fn _listOrUpdate(&self, skillCommand: &str, positionals: &[String]) -> Result<(String, bool), String> {
		let isUpdate = skillCommand == "update";
		let name = match (isUpdate, self.isBulkUpdate, positionals) {
			(false, _, []) | (true, true, []) => None,
			(true, false, [name]) if is_valid_name(name) => Some(name),
			(true, _, _) => return Err("Supply one valid skill name or --all.".into()),
			_ => return Err("skills list takes no positional arguments.".into()),
		};
		let workspacePath = self._workspacePath()?;
		let mut reports = Vec::new();
		let mut repositoryTrees = RepositoryTrees::new(isUpdate);
		let installations = SkillInstallation::list(&self.level, workspacePath.as_deref())?;
		for installation in installations {
			if name.is_some_and(|name| *name != installation.name) {
				continue;
			}
			if installation.isInstalledByHeidrunCode == false && isUpdate == false && self.isAllInstallers == false {
				continue;
			}
			let outcome = if isUpdate || installation.isInstalledByHeidrunCode {
				Some(installation.reconcile(isUpdate, &mut repositoryTrees).await)
			} else {
				None
			};
			reports.push(SkillReport::new(installation, outcome));
		}
		if let Some(name) = name.filter(|_| reports.is_empty()) {
			return Err(format!("Skill {name} is not installed at the {} level.", self.level));
		}
		let hasFailed = isUpdate && reports.iter().any(|report| report.status == Some("Failed"));
		Ok((self._reports(&reports)?, hasFailed))
	}

	/// Searches skills.sh with a query or finds skills at a folder address or local folder.
	async fn _search(&self, positionals: &[String]) -> Result<String, String> {
		match (&self.source, positionals) {
			(None, [query]) => {
				let results = search::skills_search(query.clone()).await?;
				if self.format == SkillFormat::Json {
					return self._json(&results);
				}
				let lines = results.into_iter().map(|result| {
					format!("{} ({}, {})", result.name, result.source, result.skill_id)
				});
				Ok(self._lines(lines))
			}
			(Some((option, value)), []) => {
				let results = if option == "--folder-url" {
					search::skills_find_folders(value.clone()).await?
				} else {
					search::skills_find_local_folders(Self::_absolute(value)?)?
				};
				if self.format == SkillFormat::Json {
					return self._json(&results);
				}
				Ok(self._lines(results.into_iter()))
			}
			_ => Err("Supply one search query, --folder-url, or --local-folder.".into()),
		}
	}

	/// Installs the selected source for the requested coding agents at the chosen level.
	async fn _install(&self, positionals: &[String]) -> Result<String, String> {
		let (option, source) = self.source.as_ref().ok_or("Supply --repository, --folder-url, or --local-folder.")?;
		let level = self.level.clone();
		let workspacePath = self._workspacePath()?;
		let agents = if self.agents.is_empty() { vec!["codex".into()] } else { self.agents.clone() };
		let skill = match (option.as_str(), positionals) {
			("--repository", [name]) => {
				install::skills_install(level, workspacePath, source.clone(), name.clone(), agents).await?
			}
			("--folder-url", []) => install::skills_install_folder(level, workspacePath, source.clone(), agents).await?,
			("--local-folder", []) => {
				install::skills_install_local_folder(level, workspacePath, Self::_absolute(source)?, agents)?
			}
			_ => return Err("Supply a skill name with --repository, or supply a skill folder.".into()),
		};
		if self.format == SkillFormat::Json {
			return self._json(&skill);
		}
		Ok(format!("Installed {} at the {} level.\n", skill.name, skill.level))
	}

	/// Renders the result rows in the requested format, with color on an interactive terminal in text format.
	fn _reports(&self, reports: &[SkillReport]) -> Result<String, String> {
		if self.format == SkillFormat::Json {
			return self._json(reports);
		}
		if reports.is_empty() {
			return Ok("No matching skills.\n".into());
		}
		let isMarkdown = self.format == SkillFormat::Markdown;
		let isColor = isMarkdown == false && std::io::stdout().is_terminal() && std::env::var_os("NO_COLOR").is_none();
		let mut output = if isMarkdown {
			"| Skill | Coding agents | Installed by Heidrun Code | Result |\n| --- | --- | --- | --- |\n".to_string()
		} else {
			"Skill\tCoding agents\tInstalled by Heidrun Code\tResult\n".to_string()
		};
		for report in reports {
			let installer = if report.isInstalledByHeidrunCode { "Yes" } else { "No" };
			let status = report.status.unwrap_or("");
			let reason = report.reason.as_deref().unwrap_or("");
			let reason = reason.replace(char::is_control, " ");
			let reason = if reason.is_empty() { reason } else { format!(" ({reason})") };
			let agents = report.agents.join(", ");
			if isMarkdown {
				output.push_str(&format!("| {} | {agents} | {installer} | {status}{} |\n", report.name, reason.replace('|', "\\|")));
			} else {
				let color = match status {
					"Different" | "Skipped" => "33",
					"Updated" | "Already current" => "32",
					"Failed" => "31",
					_ => "0",
				};
				let status = if isColor { format!("\x1b[{color}m{status}\x1b[0m") } else { status.into() };
				output.push_str(&format!("{}\t{agents}\t{installer}\t{status}{reason}\n", report.name));
			}
		}
		Ok(output)
	}

	/// Makes a local source path absolute and returns it as text.
	fn _absolute(path: &str) -> Result<String, String> {
		std::path::absolute(path).map_err(|error| error.to_string())?.into_os_string().into_string()
			.map_err(|_| "The folder path cannot be read as text.".into())
	}

	/// Serializes the value as JSON with a final newline.
	fn _json(&self, value: &(impl Serialize + ?Sized)) -> Result<String, String> {
		serde_json::to_string_pretty(value).map(|text| format!("{text}\n")).map_err(|error| error.to_string())
	}

	/// Renders search results as Markdown list items or plain text lines.
	fn _lines(&self, lines: impl Iterator<Item = String>) -> String {
		let prefix = if self.format == SkillFormat::Markdown { "- " } else { "" };
		lines.map(|line| format!("{prefix}{line}\n")).collect()
	}
}
