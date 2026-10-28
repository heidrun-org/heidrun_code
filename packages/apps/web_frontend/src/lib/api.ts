import { invoke } from "@tauri-apps/api/core";
import type { RequiredProgramsStatus } from "./missing_programs";
import type { CodexUsage, PaneInfo, SessionSnapshot, TabInfo, WorkspaceInfo } from "./types";

export function request<T = any>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  return invoke<T>("herdr_request", { method, params });
}

export function cli(args: string[]): Promise<string> {
  return invoke<string>("herdr_cli", { args });
}

export async function snapshot(): Promise<SessionSnapshot> {
  const r = await request<{ snapshot: SessionSnapshot }>("session.snapshot");
  return r.snapshot;
}

export function watchPanes(paneIds: string[]): Promise<void> {
  return invoke("herdr_watch_panes", { paneIds });
}

export function paths(): Promise<{ socket: string; socket_exists: boolean; bin: string; bin_exists: boolean }> {
  return invoke("herdr_paths");
}

export function startServer(): Promise<string> {
  return invoke("herdr_server_start");
}

/** Tells which programs of other makers are installed: Herdr, which is required, and ngrok, for the mobile access only. */
export function requiredProgramsStatus(): Promise<RequiredProgramsStatus> {
  return invoke("required_programs_status");
}

/** Shows the main window, which is created hidden so that the user never sees it empty before the splash image. */
export function showMainWindow(): Promise<void> {
  return invoke("show_main_window");
}

/** True when Heidrun Code was started with the command line option `--no-splash-screen`. */
export function isSplashScreenDisabled(): Promise<boolean> {
  return invoke<boolean>("is_splash_screen_disabled");
}

export function codexUsage(sessionIds: string[]): Promise<CodexUsage> {
  return invoke("codex_usage", { sessionIds });
}

// ---- Layout ---------------------------------------------------------------

export async function newTab(workspaceId: string, cwd?: string | null, label?: string): Promise<PaneInfo> {
  const r = await request<{ root_pane: PaneInfo }>("tab.create", {
    workspace_id: workspaceId,
    cwd: cwd ?? null,
    label: label ?? null,
    focus: false,
  });
  return r.root_pane;
}

export async function split(paneId: string, direction: "right" | "down", cwd?: string | null): Promise<PaneInfo> {
  const r = await request<{ pane: PaneInfo }>("pane.split", {
    target_pane_id: paneId,
    direction,
    cwd: cwd ?? null,
    focus: false,
  });
  return r.pane;
}

/** What Herdr answers to the call `pane.move`. */
type PaneMoveAnswer = { move_result: { changed: boolean; reason?: string | null } };

/**
 * Moves a pane into a new tab of its workspace. The terminal of the pane keeps running. Herdr closes the tab that the pane
 * leaves when it has no other pane.
 * @param paneId - the pane to move
 * @param workspaceId - the workspace that gets the new tab
 * @returns the answer of Herdr; `move_result.changed` is false when Herdr did not move the pane
 */
export function movePaneToNewTab(paneId: string, workspaceId: string): Promise<PaneMoveAnswer> {
  return request<PaneMoveAnswer>("pane.move", {
    pane_id: paneId,
    destination: { type: "new_tab", workspace_id: workspaceId },
    focus: false,
  });
}

/**
 * Moves a pane into a tab, as the second half of a split of a pane of that tab. The terminal of the pane keeps running.
 * @param paneId - the pane to move
 * @param tabId - the tab that receives the pane
 * @param destinationPaneId - the pane that gets a neighbor
 * @param direction - `right`: side by side. `down`: one above the other. The moved pane is the second one.
 * @returns the answer of Herdr; `move_result.changed` is false when Herdr did not move the pane
 */
export function movePaneNextToPane(
  paneId: string,
  tabId: string,
  destinationPaneId: string,
  direction: "right" | "down",
): Promise<PaneMoveAnswer> {
  return request<PaneMoveAnswer>("pane.move", {
    pane_id: paneId,
    destination: { type: "tab", tab_id: tabId, split: direction, target_pane_id: destinationPaneId, ratio: 0.5 },
    focus: false,
  });
}

/**
 * Exchanges the places of two panes of one tab.
 * @param paneId - the first pane
 * @param destinationPaneId - the second pane
 * @returns the answer of Herdr; `swap.changed` is false when Herdr did not swap the panes
 */
export function swapPanes(paneId: string, destinationPaneId: string): Promise<{ swap: { changed: boolean; reason?: string | null } }> {
  return request("pane.swap", { source_pane_id: paneId, target_pane_id: destinationPaneId });
}

/**
 * Sets the share that the first group of a split takes. Herdr keeps the value between 0.1 and 0.9.
 * @param tabId - the tab that holds the split
 * @param path - the way from the root of the layout to the split: `false` goes to the first group, `true` to the second
 * @param ratio - the new share of the first group, from 0 to 1
 */
export function setSplitRatio(tabId: string, path: boolean[], ratio: number) {
  return request("layout.set_split_ratio", { tab_id: tabId, path, ratio });
}

/** Creates a workspace, with one tab that holds one pane. Herdr answers with the three of them. */
export function newWorkspace(cwd: string | null, label: string | null) {
  return request<{ workspace: WorkspaceInfo; tab: TabInfo; root_pane: PaneInfo }>("workspace.create", {
    cwd,
    label,
    focus: false,
  });
}

export function closeWorkspace(workspaceId: string) {
  return request("workspace.close", { workspace_id: workspaceId });
}

export function closePane(paneId: string) {
  return request("pane.close", { pane_id: paneId });
}

export function renameWorkspace(workspaceId: string, label: string) {
  return request("workspace.rename", { workspace_id: workspaceId, label });
}

export function renameTab(tabId: string, label: string) {
  return request("tab.rename", { tab_id: tabId, label });
}

/** `null` clears the custom label and goes back to the automatic name. */
export function renamePane(paneId: string, label: string | null) {
  return request("pane.rename", { pane_id: paneId, label });
}

export function moveWorkspace(workspaceId: string, insertIndex: number) {
  return request("workspace.move", { workspace_id: workspaceId, insert_index: insertIndex });
}

export function moveTab(tabId: string, insertIndex: number) {
  return request("tab.move", { tab_id: tabId, insert_index: insertIndex });
}

export function closeTab(tabId: string) {
  return request("tab.close", { tab_id: tabId });
}

// ---- Input ----------------------------------------------------------------

export function prompt(target: string, text: string) {
  return request("agent.prompt", { target, text });
}

export function sendKeys(paneId: string, keys: string[]) {
  return request("pane.send_keys", { pane_id: paneId, keys });
}

/** Writes `text` into the pane, then presses `keys`, in one call. */
export function sendInput(paneId: string, text: string, keys: string[]) {
  return request("pane.send_input", { pane_id: paneId, text, keys });
}

/** `pane run` submits text + Enter atomically and honours bracketed paste. */
export function run(paneId: string, command: string) {
  return cli(["pane", "run", paneId, command]);
}

/** The end of the output of a pane. With `format` "ansi", the text keeps the colors and the styles, as escape codes. */
export async function read(paneId: string, lines = 80, format: "text" | "ansi" = "text"): Promise<string> {
  const r = await request<{ read: { text: string } }>("pane.read", {
    pane_id: paneId,
    source: "recent_unwrapped",
    lines,
    ...(format === "ansi" ? { format } : {}),
  });
  return r.read.text;
}

/** What is on screen right now (no scrollback). */
export async function readVisible(paneId: string): Promise<string> {
  const r = await request<{ read: { text: string } }>("pane.read", { pane_id: paneId, source: "visible" });
  return r.read.text;
}

/** Resolves when a line of the pane matches the regex. */
export async function waitForOutput(paneId: string, regex: string, timeoutMs = 3_600_000): Promise<string | null> {
  const r = await request<{ matched_line?: string | null }>("pane.wait_for_output", {
    pane_id: paneId,
    source: "recent",
    match: { type: "regex", value: regex },
    timeout_ms: timeoutMs,
  });
  return r.matched_line ?? null;
}
