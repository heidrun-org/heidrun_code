import { WorkspaceFolders } from './workspace_folders';
import { CompositionBar } from './composition_bar';
import { settings } from './settings';
import { CODING_AGENTS } from '../lib/coding_agents';
import { computed, reactive, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import * as api from "../lib/api";
import { allPanes, refresh, selectPane, selectTab, state as session, toast, workspaceLabel } from "./session";
import { allowCommand, forgetProjectGuards } from "./guards";
import { t } from "../i18n/index";
import { parseProjectConfig, type Launcher, type ProjectConfig, type ProjectGuard, type LauncherAgent } from "../lib/project_config";
import { withBuiltInGuard, withProjectGuard, withoutProjectGuard } from "../lib/guards_edit";
import { launcherNameFromCommand } from "../lib/launcher_name";
import { UserLaunchers, userLaunchers } from "./user_launchers";
import { prepareAgentCommand, reportPreparedCodexChat, type PreparedAgentCommand } from "./coding_agent_start";

export type { Launcher };

/**
 * The level of a custom launcher: "user" shows in every workspace, and "workspace" shows only in the workspace where the
 * developer created it (issue #853).
 */
export type LauncherLevel = "user" | "workspace";

export interface Detected {
  label: string;
  command: string;
  source: string;
  /** Where the command comes from, for example `from package.json`. */
  description?: string;
  /** The folder in which the command runs, relative to the project root. Absent for the project root itself. */
  cwd?: string;
}

interface Project {
  root: string;
  config_path: string;
  config: ProjectConfig;
  detected: Detected[];
}

export type LauncherStatus = "idle" | "running" | "finished";

const CONFIG_PATH = ".heidrun/config.json";

export const project = reactive({
  byWorkspace: {} as Record<string, Project | undefined>,
  errors: {} as Record<string, string | undefined>,
  /** `${workspaceId}:${launcherId}` → pane running the launcher. */
  panes: {} as Record<string, string>,
  /** pane id → is a command in the foreground. */
  busy: {} as Record<string, boolean>,
  /** Panes being restarted (ctrl+C then the command again). */
});

/** The fixed workspace folder saved by the desktop application. */
export const workspaceCwd = WorkspaceFolders.get;

export async function loadProject(workspaceId: string) {
  const cwd = workspaceCwd(workspaceId);
  if (!cwd) return;
  try {
    const p = await invoke<Project>("project_load", { cwd });
    p.config = parseProjectConfig(p.config);
    project.byWorkspace[workspaceId] = p;
    project.errors[workspaceId] = undefined;
  } catch (e) {
    project.errors[workspaceId] = t("projectStore.invalidConfig", { path: CONFIG_PATH, reason: String(e instanceof Error ? e.message : e) });
  }
}

export async function saveProject(workspaceId: string): Promise<boolean> {
  const p = project.byWorkspace[workspaceId];
  if (!p) return false;
  let config: ProjectConfig;
  try {
    config = parseProjectConfig(p.config);
  } catch (e) {
    toast(t("projectStore.invalidConfig", { path: CONFIG_PATH, reason: String(e instanceof Error ? e.message : e) }));
    return false;
  }
  try {
    await invoke("project_save", { root: p.root, config });
    return true;
  } catch (e) {
    toast(String(e));
    return false;
  }
}

export const currentProject = computed(() =>
  session.selectedWorkspaceId ? project.byWorkspace[session.selectedWorkspaceId] : undefined,
);

/** Identifies a launcher by its command and its folder: the same command in two folders makes two launchers. */
export function launcherKey(launcher: { command: string; cwd?: string }): string {
  return `${launcher.cwd ?? ""}\n${launcher.command}`;
}

/**
 * The launchers that a workspace shows: the launchers of the user level first, then the launchers of the workspace level,
 * each group in the order of saving.
 */
export function launchersOf(workspaceId: string): Launcher[] {
  return [...userLaunchers.list, ...(project.byWorkspace[workspaceId]?.config.launchers ?? [])];
}

/** The level of a launcher: "user" when the file of the user level has a launcher with this identifier, else "workspace". */
export function launcherLevel(launcher: Launcher): LauncherLevel {
  return userLaunchers.list.some((userLauncher) => userLauncher.id === launcher.id) ? "user" : "workspace";
}

/** The detected commands that are not yet launchers of the current project, at either level. */
export function withoutImportedLaunchers(detected: Detected[]): Detected[] {
  const p = currentProject.value;
  if (!p || !session.selectedWorkspaceId) return [];
  const taken = new Set(launchersOf(session.selectedWorkspaceId).map(launcherKey));
  return detected.filter((d) => !taken.has(launcherKey(d)));
}

export const suggestions = computed(() => withoutImportedLaunchers(currentProject.value?.detected ?? []));

function slug(label: string): string {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "launcher";
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

/** An identifier that no launcher of the workspace has, at either level. */
function freshLauncherId(workspaceId: string, name: string): string {
  const taken = new Set(launchersOf(workspaceId).map((launcher) => launcher.id));
  let id = slug(name);
  while (taken.has(id)) {
    id = slug(name);
  }
  return id;
}

/**
 * Adds a custom launcher. Without a name, the name is the first 20 characters of the command. With `agent`, the launcher is of
 * the kind Coding agent: its command is the command line that starts the coding agent, and `cwd` is its folder.
 * `description` is optional text on several lines. `level` is "workspace" (the key `launchers` of the file
 * `.heidrun/config.json` of the project) or "user" (the file `launchers.json` of the folder of the data of Heidrun Code).
 */
export async function addLauncher(workspaceId: string, label: string, command: string, agent?: LauncherAgent, cwd?: string, description?: string, level: LauncherLevel = "workspace") {
  const p = project.byWorkspace[workspaceId];
  if (!p || !command.trim()) return;
  const name = label.trim() || launcherNameFromCommand(command);
  const launcher: Launcher = { id: freshLauncherId(workspaceId, name), label: name, command: command.trim() };
  if (agent !== undefined) {
    launcher.agent = agent;
  }
  if (description !== undefined && description.trim() !== "") {
    launcher.description = description.trim();
  }
  if (cwd !== undefined && cwd.trim() !== "") {
    launcher.cwd = cwd.trim();
  }
  if (level === "user") {
    await UserLaunchers.change((list) => [...list, launcher]);
    return;
  }
  p.config.launchers.push(launcher);
  await saveProject(workspaceId);
}

export async function removeLauncher(workspaceId: string, id: string) {
  const p = project.byWorkspace[workspaceId];
  if (!p) return;
  delete project.panes[`${workspaceId}:${id}`];
  if (userLaunchers.list.some((launcher) => launcher.id === id)) {
    await UserLaunchers.change((list) => list.filter((launcher) => launcher.id !== id));
    return;
  }
  p.config.launchers = p.config.launchers.filter((a) => a.id !== id);
  await saveProject(workspaceId);
}

/**
 * Replaces the values of the custom launcher `id`. A field that `values` does not have is removed from the launcher. With
 * `level`, the launcher moves to the end of the launchers of this level; without it, the launcher keeps its level and its
 * place. The launcher is written at its new level first, so a failure never loses it.
 */
export async function updateLauncher(workspaceId: string, id: string, values: Omit<Launcher, "id">, level?: LauncherLevel) {
  const p = project.byWorkspace[workspaceId];
  if (p === undefined) return;
  const isUser = userLaunchers.list.some((launcher) => launcher.id === id);
  const index = p.config.launchers.findIndex((x) => x.id === id);
  if (isUser === false && index === -1) return;
  const launcher: Launcher = { id, ...values };
  const oldLevel: LauncherLevel = isUser ? "user" : "workspace";
  const newLevel = level ?? oldLevel;
  if (newLevel === oldLevel) {
    if (isUser) {
      await UserLaunchers.change((list) => list.map((x) => (x.id === id ? launcher : x)));
    } else {
      p.config.launchers[index] = launcher;
      await saveProject(workspaceId);
    }
    return;
  }
  if (newLevel === "user") {
    if ((await UserLaunchers.change((list) => [...list, launcher])) === false) return;
    p.config.launchers = p.config.launchers.filter((x) => x.id !== id);
    await saveProject(workspaceId);
    return;
  }
  const oldWorkspaceLaunchers = p.config.launchers;
  p.config.launchers = [...oldWorkspaceLaunchers, launcher];
  if ((await saveProject(workspaceId)) === false) {
    p.config.launchers = oldWorkspaceLaunchers;
    return;
  }
  await UserLaunchers.change((list) => list.filter((x) => x.id !== id));
}

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Guards
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Replaces the key `guards` of the project, writes the file `.heidrun/config.json`, and makes the next command read the
 * new guards. When the file cannot be written, the key `guards` of the project goes back to its old value.
 */
async function changeGuards(workspaceId: string, change: (guards: ProjectConfig["guards"]) => ProjectConfig["guards"]): Promise<boolean> {
  const p = project.byWorkspace[workspaceId];
  if (p === undefined) {
    return false;
  }
  const oldGuards = p.config.guards;
  const newGuards = change(oldGuards);
  if (newGuards === undefined) {
    delete p.config.guards;
  } else {
    p.config.guards = newGuards;
  }
  const isSaved = await saveProject(workspaceId);
  if (isSaved === false) {
    if (oldGuards === undefined) {
      delete p.config.guards;
    } else {
      p.config.guards = oldGuards;
    }
    return false;
  }
  forgetProjectGuards();
  return true;
}

/** Turns the built-in guard `key` on or off for the project. Returns false when the file could not be written. */
export function setBuiltInGuardEnabled(workspaceId: string, key: string, isEnabled: boolean): Promise<boolean> {
  return changeGuards(workspaceId, (guards) => withBuiltInGuard(guards, key, isEnabled));
}

/**
 * Saves a guard of the project. `originalName` is the name of the guard that the guard window edited, or null for a new guard.
 * The old lists `block` and `confirm` of the file become guards of the key `projectGuards`. Returns false when the file could
 * not be written.
 */
export function saveProjectGuard(workspaceId: string, guard: ProjectGuard, originalName: string | null): Promise<boolean> {
  return changeGuards(workspaceId, (guards) => withProjectGuard(guards, guard, originalName));
}

/** Removes the guard of the project that has this name. Returns false when the file could not be written. */
export function removeProjectGuard(workspaceId: string, name: string): Promise<boolean> {
  return changeGuards(workspaceId, (guards) => withoutProjectGuard(guards, name));
}

/** Does the desktop application say that the folder `folder` is not in `root`? An unknown answer is not a missing folder. */
async function isFolderMissing(root: string, folder: string): Promise<boolean> {
  try {
    return (await invoke<boolean>("launcher_folder_exists", { root, folder })) === false;
  } catch {
    return false;
  }
}

export function launcherPane(workspaceId: string, launcher: Launcher) {
  const paneId = project.panes[`${workspaceId}:${launcher.id}`];
  return paneId ? allPanes.value.find((p) => p.pane_id === paneId) ?? null : null;
}

export function launcherStatus(workspaceId: string, launcher: Launcher): LauncherStatus {
  const pane = launcherPane(workspaceId, launcher);
  if (!pane) return "idle";
  return project.busy[pane.pane_id] ? "running" : "finished";
}

/** Will a run type the command of the launcher? No when its tab is open and the run only brings the tab to the front, or when its command still runs. */
export function launcherWillType(workspaceId: string, launcher: Launcher, rerun = false): boolean {
  const existing = launcherPane(workspaceId, launcher);
  return !existing || (rerun && !project.busy[existing.pane_id]);
}

/**
 * Runs a launcher in its own tab, named after it. If its tab is still open the
 * click just brings it to the front; "rerun" types the command again in it.
 * "checked": the caller already passed the command through the guards (the phone asks its own confirmation).
 */
export async function runLauncher(workspaceId: string, launcher: Launcher, rerun = false, checked = false) {
	const executable = launcher.command.trimStart().split(/\s/, 1)[0];
	const isCodingAgent = launcher.agent !== undefined
		|| CODING_AGENTS.some((codingAgent) => codingAgent.executable === executable);
	const isCompositionBarShown = settings.isCompositionBarShownOnAgentStart && isCodingAgent;
  const p = project.byWorkspace[workspaceId];
  if (!p) return;
  const existing = launcherPane(workspaceId, launcher);
  const cwd = existing
    ? existing.foreground_cwd || existing.cwd || null
    : launcher.cwd ? `${p.root.replace(/\/$/, "")}/${launcher.cwd}` : p.root;
  if (existing === null && launcher.cwd && launcherLevel(launcher) === "user" && (await isFolderMissing(p.root, launcher.cwd))) {
    toast(t("projectStore.launcherFolderMissing", { launcher: launcher.label, folder: launcher.cwd, workspace: workspaceLabel(workspaceId) }));
    return;
  }
  // A click that will type the command: through the guards first.
  const willType = launcherWillType(workspaceId, launcher, rerun);
  if (willType && !checked && !(await allowCommand(launcher.command, cwd, `${workspaceLabel(workspaceId)} · ${launcher.label}`))) return;
  if (existing) {
    selectTab(existing.tab_id);
    selectPane(existing);
    if (rerun && !project.busy[existing.pane_id]) {
      const prepared = await launcherStartCommand(launcher, cwd, isCodingAgent);
      const isTyped = await api.run(existing.pane_id, prepared.command).then(() => true, (e) => {
        toast(String(e));
        return false;
      });
      if (isTyped) {
        await reportPreparedCodexChat(existing.pane_id, prepared);
      }
      project.busy[existing.pane_id] = true;
    }
    return;
  }
  try {
    const pane = await api.newTab(workspaceId, cwd, launcher.label);
		CompositionBar.forPane(pane.pane_id).isOpen = isCompositionBarShown;
    project.panes[`${workspaceId}:${launcher.id}`] = pane.pane_id;
    // Let the shell print its prompt before typing into it.
    await new Promise((r) => setTimeout(r, 350));
    const prepared = await launcherStartCommand(launcher, cwd, isCodingAgent);
    await api.run(pane.pane_id, prepared.command);
    await reportPreparedCodexChat(pane.pane_id, prepared);
    project.busy[pane.pane_id] = true;
    await refresh();
    const fresh = allPanes.value.find((x) => x.pane_id === pane.pane_id);
    if (fresh) selectPane(fresh);
  } catch (e) {
    toast(String(e));
  }
}

/**
 * The command line of a launcher that starts a coding agent: the observer mod for Claude Code, or the prepared chat for
 * Codex, named after the launcher. See `prepareAgentCommand`.
 * @param launcher - The launcher.
 * @param cwd - The folder of its pane.
 * @param isCodingAgent - False for a launcher that starts no coding agent: its command stays as it is.
 * @returns The command line to type, and the identifier of the prepared Codex chat, or null.
 */
async function launcherStartCommand(launcher: Launcher, cwd: string | null, isCodingAgent: boolean): Promise<PreparedAgentCommand> {
  if (isCodingAgent === false) {
    return { command: launcher.command, codexChatId: null };
  }
  return prepareAgentCommand(launcher.command, {
    cwd,
    name: launcher.label,
    model: launcher.agent?.model ?? null,
  });
}

export async function stopLauncher(workspaceId: string, launcher: Launcher) {
  const pane = launcherPane(workspaceId, launcher);
  if (pane) await api.sendKeys(pane.pane_id, ["ctrl+c"]).catch(() => {});
}

/** Is a process other than the shell running in the pane? (null: unknown) */
async function paneBusy(paneId: string): Promise<boolean | null> {
  try {
    const r = await api.request<{ process_info: { shell_pid?: number | null; foreground_processes?: { pid: number }[] } }>(
      "pane.process_info",
      { pane_id: paneId },
    );
    const info = r.process_info;
    return (info.foreground_processes ?? []).some((proc) => proc.pid !== info.shell_pid);
  } catch {
    return null;
  }
}

// ---- Status polling -------------------------------------------------------
// A command is "running" while some process other than the shell owns the terminal.

async function pollBusy() {
  const live = new Set(allPanes.value.map((p) => p.pane_id));
  for (const [key, paneId] of Object.entries(project.panes)) {
    if (!live.has(paneId)) {
      delete project.panes[key];
      delete project.busy[paneId];
      continue;
    }
    try {
      const busy = await paneBusy(paneId);
      if (busy !== null) project.busy[paneId] = busy; // else: keep the last known state
    } catch {
      /* keep the last known state */
    }
  }
}

/** The text of the file .heidrun/config.json of each workspace, as the last read gave it. */
const lastConfigTexts: Record<string, string | undefined> = {};

/** How often the window reads the file .heidrun/config.json of the workspace in view again, in milliseconds. */
const CONFIG_READ_INTERVAL = 1000;

/**
 * Loads the project of the workspace in view again when another program, such as the command line heidrun_code_ctrl, changed its
 * file .heidrun/config.json. The first read of a workspace only records the text.
 */
export async function reloadProjectWhenFileChanged(): Promise<void> {
  const workspaceId = session.selectedWorkspaceId;
  if (workspaceId === null || workspaceId === undefined || project.byWorkspace[workspaceId] === undefined) {
    return;
  }
  const cwd = workspaceCwd(workspaceId);
  if (cwd === null) {
    return;
  }
  let text: string;
  try {
    text = await invoke<string>("project_config_text", { cwd });
  } catch {
    return;
  }
  const before = lastConfigTexts[workspaceId];
  lastConfigTexts[workspaceId] = text;
  if (before !== undefined && before !== text) {
    await loadProject(workspaceId);
  }
}

let started = false;
export function startProjects() {
  if (started) return;
  started = true;
  UserLaunchers.startReading();
  window.setInterval(pollBusy, 2500);
  window.setInterval(() => void reloadProjectWhenFileChanged(), CONFIG_READ_INTERVAL);
  // Load the project file of the workspace in view (launchers, badge, palette).
  watch(
    () => [session.selectedWorkspaceId, session.selectedWorkspaceId === null
      ? null : workspaceCwd(session.selectedWorkspaceId)] as const,
    ([id, ready]) => {
      if (id && ready && !project.byWorkspace[id]) loadProject(id);
    },
    { immediate: true },
  );
}
