// Skills: the folders with a SKILL.md file that Claude Code reads. The disk and the network work are in
// desktop_tauri/src/skills/; this store holds what the windows Installed skill and Find new skills show.
import { reactive } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { openSettings, settings } from "./settings";
import { AGENTS } from "../lib/agents";
import { selectedWorkspace, toast } from "./session";
import { workspaceCwd } from "./project";
import { askConfirm } from "./confirm";
import { hasText, t } from "../i18n/index";
import { clockTime } from "../lib/format";
import { parseSkillFolderAddress, type CodeHost } from "../lib/skill_folder_address";
import { isSameSkillText } from "../lib/skill_difference";

/** Where a skill is installed: the folder of the workspace, or the user. */
export type SkillLevel = "workspace" | "user";

/** Where an installed skill comes from, written by Heidrun Code at the installation. */
export interface SkillOrigin {
  /** The repository, as `owner/repository` on GitHub or `group/project` on GitLab. Empty for a skill installed from a local folder. */
  source: string;
  skill_id: string;
  /** The web address of the GitHub or GitLab folder, for a skill installed from that address. Absent otherwise. */
  folder_url?: string;
  /** The full path of the folder on this computer, for a skill installed from that folder. Absent otherwise. */
  folder_path?: string;
}

/** A skill found on the disk. */
export interface InstalledSkill {
  name: string;
  description: string;
  level: SkillLevel;
  /** `null` for a skill that Heidrun Code did not install. */
  origin: SkillOrigin | null;
  /** The folder with the real files of the skill. */
  path: string;
  /** The ids of the agents whose skills folder has the skill, a real folder or a link. */
  agents: string[];
}

/** A result of the search on skills.sh, or of a skill folder found in a local folder, or at a web address. */
export interface SearchResult {
  /** The repository: `owner/repository` on GitHub, `group/project` on GitLab. Empty for a local folder. */
  source: string;
  skillId: string;
  name: string;
  installs: number;
  /** The web address of the skill folder on GitHub or GitLab. Present only for the result of a web address. */
  folderUrl?: string;
  /** The service of the web address. Present with `folderUrl`; without it, the address is on GitHub. */
  host?: CodeHost;
  /** The full path of the skill folder on this computer. Present only for the result of a local folder. */
  folderPath?: string;
}

/** The three ways to find a skill, in the order of the buttons of the line "Source of the skill". */
export const SKILL_SOURCES = ["skillsSh", "localFolder", "codeHosting"] as const;

/** Where the window Find new skills looks for a skill: skills.sh, a folder on this computer, or GitHub and GitLab. */
export type SkillSource = (typeof SKILL_SOURCES)[number];

/** The place of a result: the three kinds of source, with the web addresses told apart by their service. */
export type ResultOrigin = "skillsSh" | "localFolder" | CodeHost;

/** The read-only view of a SKILL.md file. */
export interface SkillView {
  name: string;
  /** "skills.sh · owner/repository", or "Local". */
  originLabel: string;
  text: string;
  loading: boolean;
  /** The SKILL.md text of the skill with the same name installed at the chosen level. Absent when no such skill is installed. */
  installedText?: string;
}

/**
 * How the SKILL.md file of a result compares with the SKILL.md file of the skill with the same name installed at the chosen
 * level: being read, the same, different, or not known because one of the two files could not be read.
 */
export type SkillComparison = "checking" | "same" | "different" | "unknown";

export const skills = reactive({
  installed: [] as InstalledSkill[],
  /** The source chosen in the window Find new skills. It starts on skills.sh, and it is not saved. */
  source: "skillsSh" as SkillSource,
  /** The text of the search field of the source skills.sh. */
  query: "",
  /** The text of the field of the source Local folder: the full path of the folder. */
  localPath: "",
  /** The text of the field of the source Code hosting: the web address of the folder. */
  address: "",
  /** The result of the field of the chosen source: the rows of the search, or the one row of a folder. */
  results: [] as SearchResult[],
  /** A search was done: an empty list of results then means "nothing found". */
  searched: false,
  searching: false,
  searchError: "",
  /** The key of the skill being installed or deleted ("" for none). */
  busyKey: "",
  view: null as SkillView | null,
  /** The comparison of each result that is installed at its level, by `comparisonKey`. */
  comparisons: {} as Record<string, SkillComparison>,
});

/** State of the window Installed skill: not saved, the window starts closed. */
export const installedSkillModal = reactive({
  open: false,
});

/** State of the window Find new skills: not saved, the window starts closed. */
export const findNewSkillsModal = reactive({
  open: false,
});

/** Opens the window Installed skill, which lists the installed skills. */
export function openInstalledSkillModal(): void {
  installedSkillModal.open = true;
}

/** Closes the window Installed skill. */
export function closeInstalledSkillModal(): void {
  installedSkillModal.open = false;
}

/** Opens the window Find new skills, which finds a skill on skills.sh, on this computer, or on GitHub or GitLab. */
export function openFindNewSkillsModal(): void {
  findNewSkillsModal.open = true;
}

/** Closes the window Find new skills. */
export function closeFindNewSkillsModal(): void {
  findNewSkillsModal.open = false;
}

/** The folder of the selected workspace, or `null` when no workspace is selected. */
export function currentCwd(): string | null {
  const workspace = selectedWorkspace.value;
  return workspace === null ? null : workspaceCwd(workspace.workspace_id);
}

/**
 * The text of an error of the backend. The backend writes "code: details"; a code that has a text in the
 * namespace `skillsStore` shows that text, any other error is shown as it is.
 */
export function errorText(error: unknown): string {
  const message = String(error);
  const code = message.split(":")[0].trim();
  const key = `skillsStore.error_${code}`;
  if (hasText(key) === false) {
    return message;
  }
  if (code === "skills_github_rate_limit") {
    // The backend gives the moment when GitHub accepts requests again, in seconds since 1970.
    const reset = Number(message.slice(message.indexOf(":") + 1));
    return message.includes(":") && Number.isFinite(reset) && reset > 0
      ? t(key, { time: clockTime(reset) })
      : t(`${key}_unknown`);
  }
  return t(key, { details: message.slice(message.indexOf(":") + 1).trim() });
}

/** The key of a skill of the search, to find it back in the list of installed skills. */
export function resultKey(result: SearchResult): string {
  return result.folderUrl ?? result.folderPath ?? `${result.source}/${result.skillId}`;
}

/** The place of a result of the search. */
export function resultOrigin(result: SearchResult): ResultOrigin {
  if (result.folderPath !== undefined) {
    return "localFolder";
  }
  if (result.folderUrl === undefined) {
    return "skillsSh";
  }
  return result.host ?? "github";
}

/** The name of a place, as the second line of a result and the title of the file view write it. */
function originName(origin: ResultOrigin): string {
  if (origin === "localFolder") {
    return t("settingsSkills.originLocalFolder");
  }
  return { skillsSh: "skills.sh", github: "GitHub", gitlab: "GitLab" }[origin];
}

/** The key of an installed skill: the level and the folder name. */
export function installedKey(skill: InstalledSkill): string {
  return `${skill.level}:${skill.name}`;
}

/** True when a result of the search is already installed at the chosen level. */
export function isInstalledAtLevel(result: SearchResult): boolean {
  return skills.installed.some((skill) => skill.level === settings.skillsLevel && skill.name === result.skillId);
}

/** True while the installation, the link, or the deletion of the skill with this key runs. */
export function isSkillBusy(key: string): boolean {
  return skills.busyKey === key;
}

/** The ids of the agents that the user switched on, in the order of the table of agents. */
export function ownedAgentIds(): string[] {
  return AGENTS.filter((agent) => settings.ownedAgents.includes(agent.id)).map((agent) => agent.id);
}

/** The names of the agents that the user switched on and that have an installed skill. */
export function agentNames(skill: InstalledSkill): string[] {
  return AGENTS.filter((agent) => settings.ownedAgents.includes(agent.id) && skill.agents.includes(agent.id)).map((agent) => agent.name);
}

/** The agents that the user switched on and whose skills folder lacks the skill. */
export function missingAgents(skill: InstalledSkill): { id: string; name: string }[] {
  return AGENTS.filter((agent) => settings.ownedAgents.includes(agent.id) && skill.agents.includes(agent.id) === false);
}

/** The key of the link of a skill for an agent, to show the busy state of its button. */
export function linkKey(skill: InstalledSkill, agentId: string): string {
  return `${installedKey(skill)}:link:${agentId}`;
}

/** Closes the two windows of the skills and opens the section Agents of the Settings window, where the user switches the coding agents on. */
export function openAgentsSection(): void {
  closeInstalledSkillModal();
  closeFindNewSkillsModal();
  openSettings("agents");
}

/** The text that says where an installed skill comes from. */
export function originLabel(skill: InstalledSkill): string {
  const origin = skill.origin;
  if (origin === null) {
    return t("settingsSkills.originLocal");
  }
  if (origin.folder_path !== undefined) {
    return `${originName("localFolder")} · ${origin.folder_path}`;
  }
  if (origin.folder_url === undefined) {
    return `${originName("skillsSh")} · ${origin.source}`;
  }
  return `${originName(origin.folder_url.startsWith("https://gitlab.com/") ? "gitlab" : "github")} · ${origin.source}`;
}

export async function loadSkills(): Promise<void> {
  try {
    skills.installed = await invoke<InstalledSkill[]>("skills_list", { cwd: currentCwd() });
  } catch (error) {
    toast(errorText(error), "error");
  }
}

/** The result of the web address of one skill folder. It has no installs, because no search gave it. */
function addressResult(text: string): SearchResult | null {
  const folder = parseSkillFolderAddress(text);
  if (folder === null) {
    return null;
  }
  return { source: folder.source, skillId: folder.skillId, name: folder.skillId, installs: 0, folderUrl: folder.url, host: folder.host };
}

/** The result of one skill folder on this computer: its name is the last part of the path. */
function localFolderResult(path: string): SearchResult {
  const name = path.replace(/\/+$/, "").split("/").pop() ?? path;
  return { source: "", skillId: name, name, installs: 0, folderPath: path };
}

/** Clears the rows and the messages of the result, for a field that is empty. */
function clearResults(): void {
  skills.results = [];
  skills.searched = false;
  skills.searching = false;
  skills.searchError = "";
}

/** Searches skills.sh. */
export async function searchSkills(query: string): Promise<void> {
  skills.query = query;
  skills.searchError = "";
  if (query.trim() === "") {
    clearResults();
    return;
  }
  skills.searching = true;
  // An answer that comes after the developer changed the text, or the source, must not replace the newest result.
  const isCurrent = () => skills.source === "skillsSh" && skills.query === query;
  try {
    const results = await invoke<SearchResult[]>("skills_search", { query });
    if (isCurrent()) {
      skills.results = results;
      skills.searched = true;
    }
  } catch (error) {
    if (isCurrent()) {
      skills.results = [];
      skills.searchError = errorText(error);
    }
  } finally {
    if (isCurrent()) {
      skills.searching = false;
    }
  }
}

/**
 * Shows the result of a full path of a folder on this computer: the one row of the folder when it holds a SKILL.md file,
 * otherwise one row for each subfolder that holds one, and the error of the backend when there is none.
 */
export async function findLocalFolder(path: string): Promise<void> {
  skills.localPath = path;
  skills.searchError = "";
  if (path.trim() === "") {
    clearResults();
    return;
  }
  skills.searching = true;
  const isCurrent = () => skills.source === "localFolder" && skills.localPath === path;
  try {
    const folders = await invoke<string[]>("skills_find_local_folders", { path });
    if (isCurrent()) {
      skills.results = folders.map(localFolderResult);
      skills.searched = true;
    }
  } catch (error) {
    if (isCurrent()) {
      skills.results = [];
      skills.searchError = errorText(error);
    }
  } finally {
    if (isCurrent()) {
      skills.searching = false;
    }
  }
}

/** Opens the folder chooser of the system, and shows the result of the folder that the developer chooses. */
export async function chooseLocalFolder(): Promise<void> {
  const chosen = await openDialog({
    directory: true,
    multiple: false,
    title: t("settingsSkills.folderChooseTitle"),
    defaultPath: skills.localPath.trim() === "" ? undefined : skills.localPath.trim(),
  });
  if (typeof chosen === "string") {
    await findLocalFolder(chosen);
  }
}

/**
 * Shows the result of a web address of a folder on GitHub or GitLab: the one row of the folder when it holds a SKILL.md
 * file, otherwise one row for each subfolder that holds one. A text that is not such an address gives its error with no
 * call. For an address, GitHub or GitLab is asked for the list of the files below the folder.
 */
export async function findAddress(text: string): Promise<void> {
  skills.address = text;
  skills.searchError = "";
  if (text.trim() === "") {
    clearResults();
    return;
  }
  if (parseSkillFolderAddress(text) === null) {
    skills.results = [];
    skills.searched = false;
    skills.searching = false;
    skills.searchError = errorText(`skills_invalid_address: ${text.trim()}`);
    return;
  }
  skills.searching = true;
  const isCurrent = () => skills.source === "codeHosting" && skills.address === text;
  try {
    const urls = await invoke<string[]>("skills_find_folders", { url: text });
    if (isCurrent()) {
      skills.results = urls.map(addressResult).filter((result): result is SearchResult => result !== null);
      skills.searched = true;
    }
  } catch (error) {
    if (isCurrent()) {
      skills.results = [];
      skills.searchError = errorText(error);
    }
  } finally {
    if (isCurrent()) {
      skills.searching = false;
    }
  }
}

/** Chooses the source of the window Find new skills, and shows the result of the field of that source. */
export async function setSkillSource(source: SkillSource): Promise<void> {
  skills.source = source;
  if (source === "skillsSh") {
    await searchSkills(skills.query);
  } else if (source === "localFolder") {
    await findLocalFolder(skills.localPath);
  } else {
    await findAddress(skills.address);
  }
}

/** Shows the SKILL.md file of an installed skill. */
export async function inspectInstalled(skill: InstalledSkill): Promise<void> {
  skills.view = { name: skill.name, originLabel: originLabel(skill), text: "", loading: true };
  try {
    const text = await invoke<string>("skills_read", { level: skill.level, cwd: currentCwd(), name: skill.name });
    skills.view = { name: skill.name, originLabel: originLabel(skill), text, loading: false };
  } catch (error) {
    skills.view = null;
    toast(errorText(error), "error");
  }
}

/** The text of the SKILL.md file of a result of the search, of a local folder, or of a web address. */
export async function readResultText(result: SearchResult): Promise<string> {
  const origin = resultOrigin(result);
  if (origin === "localFolder") {
    return await invoke<string>("skills_preview_local_folder", { path: result.folderPath });
  }
  if (origin === "skillsSh") {
    return await invoke<string>("skills_preview", { source: result.source, skillId: result.skillId });
  }
  return await invoke<string>("skills_preview_folder", { url: result.folderUrl });
}

/** The text of the SKILL.md file of the skill with the same name installed at the chosen level. */
async function readInstalledResultText(result: SearchResult): Promise<string> {
  return await invoke<string>("skills_read", { level: settings.skillsLevel, cwd: currentCwd(), name: result.skillId });
}

/** The key of a result in `skills.comparisons`: the chosen level, then the key of the result. */
export function comparisonKey(result: SearchResult): string {
  return `${settings.skillsLevel}:${resultKey(result)}`;
}

/** How the result compares with the installed skill of the same name. `null` when no such skill is installed. */
export function comparisonOf(result: SearchResult): SkillComparison | null {
  return isInstalledAtLevel(result) ? (skills.comparisons[comparisonKey(result)] ?? null) : null;
}

/**
 * Compares the SKILL.md file of a result with the SKILL.md file of the skill with the same name installed at the chosen
 * level, and keeps the answer in `skills.comparisons`. Does nothing for a result that is not installed, or that is being
 * compared. The comparison reads only the two SKILL.md files, not the other files of the skill.
 */
export async function compareWithInstalled(result: SearchResult): Promise<void> {
  if (isInstalledAtLevel(result) === false) {
    return;
  }
  const key = comparisonKey(result);
  if (skills.comparisons[key] === "checking") {
    return;
  }
  skills.comparisons[key] = "checking";
  try {
    const [installedText, resultText] = await Promise.all([readInstalledResultText(result), readResultText(result)]);
    skills.comparisons[key] = isSameSkillText(installedText, resultText) ? "same" : "different";
  } catch {
    skills.comparisons[key] = "unknown";
  }
}

/**
 * Shows the SKILL.md file of a result of the search, of a local folder, or of a web address, before the installation. When
 * a skill with the same name is installed at the chosen level, the view also holds its text, so that the window can show
 * what differs.
 */
export async function inspectResult(result: SearchResult): Promise<void> {
  const origin = resultOrigin(result);
  const label = `${originName(origin)} · ${result.folderPath ?? result.source}`;
  skills.view = { name: result.name, originLabel: label, text: "", loading: true };
  try {
    const text = await readResultText(result);
    let installedText: string | undefined;
    if (isInstalledAtLevel(result)) {
      installedText = await readInstalledResultText(result).catch(() => undefined);
    }
    skills.view = { name: result.name, originLabel: label, text, loading: false, installedText };
  } catch (error) {
    skills.view = null;
    toast(errorText(error), "error");
  }
}

export function closeSkillView(): void {
  skills.view = null;
}

/**
 * Installs a result of the search, a local folder, or the skill folder of a web address, at the chosen level. A result that
 * is already installed at this level (its SKILL.md file differs, or the button would not be there) replaces the installed
 * skill: after the confirmation of the developer, the installed skill goes to the Trash, then the result is installed.
 */
export async function installSkill(result: SearchResult): Promise<void> {
  const level = settings.skillsLevel;
  const cwd = currentCwd();
  const agents = ownedAgentIds();
  if (agents.length === 0) {
    toast(t("skillsStore.error_skills_no_agent"), "error");
    return;
  }
  if (level === "workspace" && cwd === null) {
    toast(t("skillsStore.error_skills_no_workspace_folder"), "error");
    return;
  }
  const isReplacement = isInstalledAtLevel(result);
  if (isReplacement) {
    const confirmed = await askConfirm(t("skillsStore.confirmReplace", { name: result.name }), t("skillsStore.confirmReplaceButton"));
    if (confirmed === false) {
      return;
    }
  }
  skills.busyKey = resultKey(result);
  let isInstalledSkillInTrash = false;
  try {
    if (isReplacement) {
      await invoke("skills_delete", { level, cwd, name: result.skillId });
      isInstalledSkillInTrash = true;
    }
    const origin = resultOrigin(result);
    if (origin === "localFolder") {
      await invoke<InstalledSkill>("skills_install_local_folder", { level, cwd, path: result.folderPath, agents });
    } else if (origin === "skillsSh") {
      await invoke<InstalledSkill>("skills_install", { level, cwd, source: result.source, skillId: result.skillId, agents });
    } else {
      await invoke<InstalledSkill>("skills_install_folder", { level, cwd, url: result.folderUrl, agents });
    }
    await loadSkills();
    if (isReplacement) {
      await compareWithInstalled(result);
    }
    toast(t(isReplacement ? "skillsStore.replaced" : "skillsStore.installed", { name: result.name }));
  } catch (error) {
    const hint = isInstalledSkillInTrash ? ` ${t("skillsStore.replaceFailedHint")}` : "";
    toast(`${errorText(error)}${hint}`, "error");
    if (isInstalledSkillInTrash) {
      await loadSkills();
    }
  } finally {
    skills.busyKey = "";
  }
}

/** Moves an installed skill to the Trash, after the confirmation of the user. */
export async function deleteSkill(skill: InstalledSkill): Promise<void> {
  const confirmed = await askConfirm(t("skillsStore.confirmDelete", { name: skill.name }), t("skillsStore.confirmDeleteButton"));
  if (confirmed === false) {
    return;
  }
  skills.busyKey = installedKey(skill);
  try {
    await invoke("skills_delete", { level: skill.level, cwd: currentCwd(), name: skill.name });
    await loadSkills();
    toast(t("skillsStore.deleted", { name: skill.name }));
  } catch (error) {
    toast(errorText(error), "error");
  } finally {
    skills.busyKey = "";
  }
}

/** Adds the link of an installed skill for an agent that the user switched on after the installation. */
export async function linkSkillForAgent(skill: InstalledSkill, agentId: string): Promise<void> {
  skills.busyKey = linkKey(skill, agentId);
  try {
    await invoke("skills_link_agent", { level: skill.level, cwd: currentCwd(), name: skill.name, agent: agentId });
    await loadSkills();
    const agentName = AGENTS.find((agent) => agent.id === agentId)?.name ?? agentId;
    toast(t("skillsStore.linked", { name: skill.name, agent: agentName }));
  } catch (error) {
    toast(errorText(error), "error");
  } finally {
    skills.busyKey = "";
  }
}
