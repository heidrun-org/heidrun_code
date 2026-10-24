// Mobile access: the phone's calls arrive here (event "mobile-call" from Rust)
// and are answered with the same data and rules as the desktop UI.
import { reactive } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import * as api from "../lib/api";
import {
  allPanes,
  REFUSAL,
  answerChoice,
  attention,
  contextFor,
  paneFullName,
  quotas,
  rememberPrompt,
  workspaces as sessionWorkspaces,
  state,
  tabLabel,
  toast,
  workspaceLabel,
} from "./session";
import { guardHit } from "./guards";
import { macros, macrosOfProjectConfig, resolveMacroVariables, type Macro } from "./macros";
import { launcherPane, launcherStatus, launcherWillType, launchersOf, loadProject, project, runLauncher, stopLauncher, workspaceCwd } from "./project";
import { paneName, agentKind } from "../lib/format";
import type { AgentInfo } from "../lib/types";
import { settings } from "./settings";
import { t } from "../i18n/index";

export interface MobileError {
  /** What went wrong: `ngrokMissing`, `ngrokCannotStart`, `ngrokNoAddress`, `ngrokStopped`, `ngrokNotSignedIn`, `ngrokAddressInUse`, or `cannotListen`. */
  kind: string;
  /** The words of the system or of the program ngrok about the problem. It can be empty. */
  detail: string;
}

export interface MobileStatus {
  enabled: boolean;
  running: boolean;
  url: string | null;
  qr: string | null;
  /** The pairing link: the address of the tunnel, then `#t=` and the pairing key. Null when `qr` is null. */
  link: string | null;
  error: MobileError | null;
}

export const mobile = reactive({
  open: false,
  status: null as MobileStatus | null,
  busy: false,
  /** Last call from a phone (shown in the settings window). */
  lastSeen: 0,
});

export async function mobileStatus() {
  mobile.status = await invoke<MobileStatus>("mobile_status").catch(() => null);
}
export async function setMobile(on: boolean) {
  mobile.busy = true;
  try {
    mobile.status = await invoke<MobileStatus>(on ? "mobile_enable" : "mobile_disable");
  } catch (e) {
    toast(String(e));
  } finally {
    mobile.busy = false;
  }
}
export async function revokeMobile() {
  mobile.busy = true;
  try {
    mobile.status = await invoke<MobileStatus>("mobile_revoke");
    toast(t("mobileStore.pairingRevoked"));
  } catch (e) {
    toast(String(e));
  } finally {
    mobile.busy = false;
  }
}

/**
 * The button "Stop the old ngrok" of the error `ngrokAddressInUse` (issue 583): kills the program ngrok that an earlier or
 * another Heidrun Code started. The tunnel opens again at the next try.
 *
 * @returns True when a program was killed, false when the other ngrok is not one that Heidrun Code started.
 */
export async function stopLeftoverNgrok(): Promise<boolean> {
  mobile.busy = true;
  try {
    return await invoke<boolean>("mobile_stop_leftover_ngrok");
  } catch (e) {
    toast(String(e));
    return false;
  } finally {
    mobile.busy = false;
  }
}

// ---- What the phone may ask -----------------------------------------------------

function agentView(p: AgentInfo) {
  const ctx = contextFor(p);
  const menu = state.choices[p.pane_id];
  return {
    paneId: p.pane_id,
    /** True when a coding agent runs in the pane. A plain terminal is read-only on the phone. */
    hasCodingAgent: !!p.agent,
    name: paneName(p),
    kind: agentKind(p),
    workspace: workspaceLabel(p.workspace_id),
    tab: tabLabel(p.tab_id),
    status: p.agent_status,
    since: state.since[p.pane_id] ?? null,
    question: state.questions[p.pane_id]?.text ?? null,
    context: ctx ? Math.round(ctx.percent) : null,
    menu: menu ? { question: menu.question ?? null, detail: menu.detail ?? null, options: menu.options.map((o) => ({ n: o.n, label: o.label })) } : null,
  };
}

function snapshot() {
  // Every pane, with or without a coding agent: the phone shows the plain terminals too.
  const agents = allPanes.value;
  const claude = quotas.value.find((q) => q.provider === "claude");
  return {
    now: Date.now(),
    /** The setting of the Settings window: may the phone type in a plain terminal? Off: the phone only reads it. */
    terminalTypingAllowed: settings.mobileTerminalTyping,
    attention: attention.value.map((p) => p.pane_id),
    workspaces: sessionWorkspaces.value
      .map((w) => ({ id: w.workspace_id, label: w.label, agents: agents.filter((p) => p.workspace_id === w.workspace_id).map(agentView) }))
      .filter((w) => w.agents.length),
    quotas: claude ? claude.windows.map((w) => ({ name: w.name, percent: Math.round(w.percent) })) : [],
  };
}

/** The project file of a workspace, read once when the phone asks for it and the desktop has not read it yet. */
async function workspaceProject(workspaceId: string) {
  if (!project.byWorkspace[workspaceId] && workspaceCwd(workspaceId)) await loadProject(workspaceId);
  return project.byWorkspace[workspaceId];
}

/**
 * The macros that the menu of macros of the desktop shows for a pane: the personal macros, then the macros of the project of its workspace.
 * The text of each macro has its variables replaced for the pane, and the phone writes it into the field for a prompt, like the keyboard.
 */
async function macroList(pane: AgentInfo) {
  const p = await workspaceProject(pane.workspace_id);
  const entries: [Macro, "personal" | "project"][] = [
    ...macros.personal.map((m): [Macro, "personal"] => [m, "personal"]),
    ...macrosOfProjectConfig(p?.config).map((m): [Macro, "project"] => [m, "project"]),
  ];
  const list = [];
  for (const [m, source] of entries) {
    list.push({ id: m.id, label: m.label, description: m.description, source, text: await resolveMacroVariables(m.text, pane.pane_id) });
  }
  return { macros: list };
}

/** The launchers of the project of each workspace, with their status. A workspace whose project has no launcher is left out. */
async function launcherList() {
  const list = [];
  for (const w of sessionWorkspaces.value) {
    const p = await workspaceProject(w.workspace_id);
    const error = project.errors[w.workspace_id] ?? null;
    const launchers = p === undefined ? [] : launchersOf(w.workspace_id);
    if (!error && launchers.length === 0) continue;
    list.push({
      id: w.workspace_id,
      label: w.label,
      error,
      launchers: launchers.map((a) => ({
        id: a.id,
        label: a.label,
        description: a.description ?? null,
        command: a.command,
        status: launcherStatus(w.workspace_id, a),
      })),
    });
  }
  return { workspaces: list };
}

async function launch(params: Params) {
  const workspaceId = String(params.workspaceId ?? "");
  const p = await workspaceProject(workspaceId);
  const launcher = launchersOf(workspaceId).find((a) => a.id === params.launcherId);
  if (!p || !launcher) return { error: t("mobileStore.error.launcherNotFound") };
  if (params.action === "stop") {
    await stopLauncher(workspaceId, launcher);
    return { ok: true };
  }
  if (params.action !== "run") return { error: t("mobileStore.error.unknownAction") };
  // The same guards as a click on the desktop, but the phone asks the confirmation, not a window of the desktop.
  if (launcherWillType(workspaceId, launcher, true)) {
    const existing = launcherPane(workspaceId, launcher);
    const cwd = existing
      ? existing.foreground_cwd || existing.cwd || null
      : launcher.cwd ? `${p.root.replace(/\/$/, '')}/${launcher.cwd}` : p.root;
    const hit = await guardHit(launcher.command, cwd);
    if (hit?.level === "block") return { error: t("mobileStore.error.blockedByProject", { reason: hit.why }) };
    if (hit && (params.confirmed !== true || params.command !== launcher.command)) return { confirm: { command: launcher.command, why: hit.why } };
  }
  await runLauncher(workspaceId, launcher, true, true);
  toast(t("mobileStore.launcherStarted", { name: `${workspaceLabel(workspaceId)} · ${launcher.label}` }));
  return { ok: true };
}

/** A command typed on the phone in a plain terminal: the whole text passes the guards, then it runs like a launcher does. */
async function typeInTerminal(pane: AgentInfo, text: string, cwd: string | null, params: Params) {
  // The desktop decides, not the phone: a phone that ignores the setting still cannot type.
  if (!settings.mobileTerminalTyping) return { error: t("mobileStore.error.terminalTypingOff") };
  const hit = await guardHit(text, cwd);
  if (hit?.level === "block") return { error: t("mobileStore.error.blockedByProject", { reason: hit.why }) };
  if (hit && (params.confirmed !== true || params.command !== text)) return { confirm: { command: text, why: hit.why } };
  await api.run(pane.pane_id, text);
  toast(t("mobileStore.promptReceived", { name: paneFullName(pane) }));
  return { ok: true };
}

const anyPane = (id: unknown) => allPanes.value.find((p) => p.pane_id === id) ?? null;

type Params = Record<string, unknown>;

/** Answers one call of the phone. Exported for the tests. */
export async function handleMobileCall(method: string, params: Params): Promise<unknown> {
  mobile.lastSeen = Date.now();
  if (method === "state") return snapshot();
  if (method === "launchers") return launcherList();
  if (method === "launch") return launch(params);
  const pane = anyPane(params.paneId);
  if (!pane) return { error: t("mobileStore.error.agentNotFound") };
  // A plain terminal: the phone may read its output, or type a command in it (the phone asks its own confirmation to unlock the typing). Nothing else.
  if (!pane.agent && method !== "read" && method !== "prompt") return { error: t("mobileStore.error.terminalReadOnly") };
  const cwd = pane.foreground_cwd || pane.cwd || null;

  if (method === "macros") return macroList(pane);

  if (method === "read") {
    const lines = Math.min(200, Math.max(10, Number(params.lines) || 60));
    // The phone asks for the colors of the terminal with `ansi: true`. A page that does not ask gets plain text.
    return { text: await api.read(pane.pane_id, lines, params.ansi === true ? "ansi" : "text") };
  }

  if (method === "answer") {
    const menu = state.choices[pane.pane_id];
    const n = Number(params.n);
    const option = menu?.options.find((o) => o.n === n);
    if (!menu || !option) return { error: t("mobileStore.error.menuGone") };
    // Anything but a refusal approves ("Always allow", "Continue"…): checked by the guards.
    const approves = !REFUSAL.test(option.label);
    if (approves && menu.detail) {
      const hit = await guardHit(menu.detail, cwd);
      if (hit?.level === "block") return { error: t("mobileStore.error.blockedByProject", { reason: hit.why }) };
      // The phone confirms a precise command: the one on screen now, not another one.
      if (hit && (params.confirmed !== true || params.command !== menu.detail)) return { confirm: { command: menu.detail, why: hit.why } };
    }
    // The menu checked above, and no other (it may have changed during the checks).
    if (!(await answerChoice(pane.pane_id, n, true, menu))) return { error: t("mobileStore.error.menuChanged") };
    return { ok: true };
  }

  if (method === "prompt") {
    const text = String(params.text ?? "").trim();
    if (!text) return { error: t("mobileStore.error.emptyPrompt") };
    if (!pane.agent) return typeInTerminal(pane, text, cwd, params);
    // A menu on screen would take the text as its answer ("2" picks option 2): never.
    if (pane.agent_status === "blocked" || state.choices[pane.pane_id]) return { error: t("mobileStore.error.agentBlocked") };
    const shell = /^\s*!\s*(\S[\s\S]*)$/.exec(text);
    if (shell) {
      const hit = await guardHit(shell[1], cwd);
      if (hit?.level === "block") return { error: t("mobileStore.error.blockedByProject", { reason: hit.why }) };
      if (hit && (params.confirmed !== true || params.command !== shell[1])) return { confirm: { command: shell[1], why: hit.why } };
    }
    await api.prompt(pane.pane_id, text);
    rememberPrompt(pane.pane_id, text);
    toast(t("mobileStore.promptReceived", { name: paneFullName(pane) }));
    return { ok: true };
  }

  if (method === "keys") {
    // Only keys that stop or refuse: approving goes through the menu (and the guards).
    const action = String(params.action ?? "");
    if (action === "deny" || action === "interrupt") {
      await api.sendKeys(pane.pane_id, ["esc"]);
      return { ok: true };
    }
    return { error: t("mobileStore.error.unknownAction") };
  }
  return { error: t("mobileStore.error.unknownMethod") };
}

let started = false;
export function startMobile() {
  if (started) return;
  started = true;
  listen<{ id: number; method: string; params: Params }>("mobile-call", async (e) => {
    const { id, method, params } = e.payload;
    let result: unknown;
    try {
      result = await handleMobileCall(method, params ?? {});
    } catch (err) {
      result = { error: String(err).slice(0, 300) };
    }
    invoke("mobile_reply", { id, result }).catch(() => {});
  });
  mobileStatus();
}
