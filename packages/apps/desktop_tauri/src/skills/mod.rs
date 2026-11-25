//! Desktop commands for the shared skill management operations.

pub(crate) mod bundled;

use heidrun_code_ctrl::skills::{agentFolders, install, installed, search};
use heidrun_code_ctrl::skills::types::{InstalledSkill, SearchResult};

#[tauri::command]
pub fn skills_list(cwd: Option<String>) -> Vec<InstalledSkill> {
	installed::skills_list(cwd)
}

#[tauri::command]
pub fn skills_read(level: String, cwd: Option<String>, name: String) -> Result<String, String> {
	installed::skills_read(level, cwd, name)
}

#[tauri::command]
pub fn skills_delete(level: String, cwd: Option<String>, name: String) -> Result<(), String> {
	installed::skills_delete(level, cwd, name)
}

#[tauri::command]
pub async fn skills_search(query: String) -> Result<Vec<SearchResult>, String> {
	search::skills_search(query).await
}

#[tauri::command]
pub fn skills_find_local_folders(path: String) -> Result<Vec<String>, String> {
	search::skills_find_local_folders(path)
}

#[tauri::command]
pub async fn skills_find_folders(url: String) -> Result<Vec<String>, String> {
	search::skills_find_folders(url).await
}

#[tauri::command]
pub async fn skills_preview(source: String, skill_id: String) -> Result<String, String> {
	install::skills_preview(source, skill_id).await
}

#[tauri::command]
#[allow(non_snake_case)]
pub async fn skillsCompare(
	level: String,
	cwd: Option<String>,
	skillId: String,
	source: String,
	folderUrl: Option<String>,
	folderPath: Option<String>,
) -> Result<install::SkillComparison, String> {
	install::skillsCompare(level, cwd, skillId, source, folderUrl, folderPath).await
}

#[tauri::command]
pub async fn skills_install(
	level: String,
	cwd: Option<String>,
	source: String,
	skill_id: String,
	agents: Vec<String>,
) -> Result<InstalledSkill, String> {
	install::skills_install(level, cwd, source, skill_id, agents).await
}

#[tauri::command]
pub async fn skills_preview_folder(url: String) -> Result<String, String> {
	install::skills_preview_folder(url).await
}

#[tauri::command]
pub async fn skills_install_folder(level: String, cwd: Option<String>, url: String, agents: Vec<String>) -> Result<InstalledSkill, String> {
	install::skills_install_folder(level, cwd, url, agents).await
}

#[tauri::command]
pub fn skills_preview_local_folder(path: String) -> Result<String, String> {
	install::skills_preview_local_folder(path)
}

#[tauri::command]
pub fn skills_install_local_folder(level: String, cwd: Option<String>, path: String, agents: Vec<String>) -> Result<InstalledSkill, String> {
	install::skills_install_local_folder(level, cwd, path, agents)
}

#[tauri::command]
pub fn skills_link_agent(level: String, cwd: Option<String>, name: String, agent: String) -> Result<(), String> {
	agentFolders::skills_link_agent(level, cwd, name, agent)
}

#[cfg(test)]
mod testSupport;
