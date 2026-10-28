import { WorkspaceFolders } from './workspace_folders';
import { FinishedStatus } from '../lib/finished_status';
import { computed, reactive, ref, watch } from "vue";
import { listen } from "@tauri-apps/api/event";
import { homeDir } from "@tauri-apps/api/path";
import * as api from "../lib/api";
import { notify, notifyPhone } from "../lib/notify";
import { settings } from "./settings";
import { agentKind, codexWindows, paneName } from "../lib/format";
import { DetectionFamilies } from "../lib/detection_families";
import { findChoices, findQuestion, type ChoiceMenu } from "../lib/refs";
import { allowCommand } from "./guards";
import { ZenMode } from "./zen_mode";
import { paneFocusHistory } from "./pane_focus_history_state";
import { CompositionBarAtStart } from "./composition_bar_at_start";
import { FileViewEditState } from "./file_view_edit_state";
import { t } from "../i18n/index";
import type {
  AgentInfo,
  AgentStatus,
  CodexUsage,
  ContextUsage,
  PaneInfo,
  QuotaBlock,
  SessionSnapshot,
  WorkspaceInfo,
} from "../lib/types";

/**
 * One work run of an agent: from the moment it starts working to the moment it
 * finishes. Intermediate states (blocked, then working again after an approval)
 * update the same run instead of adding lines.
 */
export interface ActivityEntry {
  id: number;
  paneId: string;
  start: number;
  /** Set when the run is over. */
  end: number | null;
  /** "working" or "blocked" while it runs, "done" once finished, "closed" if the pane went away. */
  status: "working" | "blocked" | "done" | "closed";
  /** The run was already going when the app saw the pane for the first time. */
  startUnknown: boolean;
  /** Names at the time of the event, used if the pane has been closed since. */
  name: string;
  kind: string;
  workspace: string;
  tab: string;
  workspaceId?: string;
  cwd?: string | null;
  /** Time spent waiting for a decision (blocked), not counted as work. */
  blockedMs?: number;
  blockedAt?: number | null;
  /** Consignes sent to the agent and decisions answered during this run. */
  prompts?: number;
  decisions?: number;
}

// Finished runs go to the history (stores/history.ts registers here).
const runEndHandlers: ((r: ActivityEntry) => void)[] = [];
export function onRunEnd(fn: (r: ActivityEntry) => void) {
  runEndHandlers.push(fn);
}
function endRun(r: ActivityEntry, now: number) {
  if (r.blockedAt) {
    r.blockedMs = (r.blockedMs ?? 0) + (now - r.blockedAt);
    r.blockedAt = null;
  }
  for (const fn of runEndHandlers) {
    try {
      fn(r);
    } catch {
      /* the history is best-effort */
    }
  }
}

/** Last consigne sent to each pane: the history's summary of the run. */
export const lastPrompt: Record<string, { text: string; at: number }> = {};
export function rememberPrompt(paneId: string, text: string) {
  lastPrompt[paneId] = { text: text.replace(/\s+/g, " ").trim().slice(0, 200), at: Date.now() };
  const open = state.activity.find((r) => r.paneId === paneId && r.end === null);
  if (open) open.prompts = (open.prompts ?? 0) + 1;
}

export interface OutputWatch {
  id: number;
  paneId: string;
  regex: string;
}

const DISMISSED_KEY = "heidrun.dismissed";

/** The latest Herdr snapshot, before applying local completion acknowledgements. */
let rawSnapshot: SessionSnapshot | null = null;

function loadDismissed(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export const state = reactive({
  snapshot: null as SessionSnapshot | null,
  connected: false,
  error: "",
  selectedWorkspaceId: null as string | null,
  selectedTabId: null as string | null,
  selectedPaneId: null as string | null,
  codex: null as CodexUsage | null,
  paletteOpen: false,
  shortcutsOpen: false,
  /** Status changes of all agents, most recent first. */
  activity: [] as ActivityEntry[],
  /** When each pane entered its current status (local clock). */
  since: {} as Record<string, number>,
  /** Question ending the agent's last answer, while it waits for the next consigne. */
  questions: {} as Record<string, { text: string; at: number }>,
  /** Numbered menu shown by a blocked agent (permission prompt, choice). */
  choices: {} as Record<string, ChoiceMenu>,
  watches: [] as OutputWatch[],
  /** "À traiter" cards closed by the user, until the pane changes state again. */
  dismissed: loadDismissed(),
  /** What is being renamed in place: "ws:<id>", "tab:<id>" or "pane:<id>". */
  renaming: null as string | null,
  starting: false,
  toast: "" as string,
  /** "error" shows the toast in red, with a danger icon. */
  toastKind: "info" as "info" | "error",
});

// ---- Derived views --------------------------------------------------------

/**
 * The list of workspaces, in the order of Herdr: by the number of the workspace. The status of the agents never changes this
 * order: starting, blocking, finishing, or stopping an agent leaves every workspace where it is. Only the developer moves a
 * workspace, by drag and drop or with the keyboard.
 */
export const workspaces = computed(() =>
  [...(state.snapshot?.workspaces ?? [])].sort((a, b) => a.number - b.number),
);

export const selectedWorkspace = computed(() =>
  workspaces.value.find((w) => w.workspace_id === state.selectedWorkspaceId) ?? null,
);

// Herdr lists tabs in display order. `number` is a stable id that does not change
// when a tab is moved, so sorting on it would undo every reordering.
export const tabs = computed(() =>
  (state.snapshot?.tabs ?? []).filter((t) => t.workspace_id === state.selectedWorkspaceId),
);

export const agentsByPane = computed(() => {
  const map = new Map<string, AgentInfo>();
  for (const a of state.snapshot?.agents ?? []) map.set(a.pane_id, a);
  return map;
});

/** Pane enriched with its agent record when there is one. */
export function paneView(p: PaneInfo): AgentInfo {
  const a = agentsByPane.value.get(p.pane_id);
  if (!a) return { ...p };
  return { ...p, ...a, tokens: { ...(p.tokens ?? {}), ...(a.tokens ?? {}) } };
}

export const allPanes = computed(() => (state.snapshot?.panes ?? []).map(paneView));

const hasAgent = (wsId: string) => allPanes.value.some((p) => p.workspace_id === wsId && p.agent);

/**
 * Tells if an agent runs in a workspace.
 *
 * @param workspaceId - The identifier of the workspace.
 * @returns True when a pane of the workspace runs an agent.
 */
export function workspaceHasAgent(workspaceId: string): boolean {
  return hasAgent(workspaceId);
}

/**
 * Gives the classes of the status dot of a workspace: the color of its agents, or a hollow ring when no agent runs.
 *
 * @param workspace - The workspace.
 * @returns The classes to add to the element with the class `dot`.
 */
export function workspaceDotClasses(workspace: WorkspaceInfo): string[] {
  if (hasAgent(workspace.workspace_id) === false) {
    return ["quiet"];
  }
  return [workspace.agent_status === "idle" ? "" : workspace.agent_status];
}

export const workspacePanes = computed(() => allPanes.value.filter((p) => p.workspace_id === state.selectedWorkspaceId));

export const tabLayout = computed(() =>
  (state.snapshot?.layouts ?? []).find((l) => l.tab_id === state.selectedTabId) ?? null,
);

export const tabPanes = computed(() => allPanes.value.filter((p) => p.tab_id === state.selectedTabId));

export const selectedPane = computed(() => allPanes.value.find((p) => p.pane_id === state.selectedPaneId) ?? null);

/**
 * Identifies the exact status acknowledged by a card removal.
 * @param p - The pane and its coding agent information.
 * @returns The terminal, status, and lifecycle sequence key.
 */
export function attentionKey(p: AgentInfo): string {
  return FinishedStatus.key(p);
}

/**
 * Hides the current card and changes an acknowledged Finished completion to Idle in Heidrun Code.
 * @param p - The status represented by the card being removed.
 * @returns Nothing.
 */
export function dismiss(p: AgentInfo) {
	const current = rawSnapshot?.panes.find((pane) => pane.pane_id === p.pane_id);
	const agent = rawSnapshot?.agents.find((pane) => pane.pane_id === p.pane_id);
	if (current !== undefined && attentionKey({
		...current,
		...agent,
	}) !== attentionKey(p)) {
		return;
	}
	delete state.questions[p.pane_id];
	state.dismissed[p.pane_id] = attentionKey(p);
	saveDismissed();
	if (rawSnapshot !== null) {
		state.snapshot = FinishedStatus.apply(rawSnapshot, state.dismissed);
	}
}

function saveDismissed() {
  // Forget panes that no longer exist so the map does not grow forever.
  const live = new Set((state.snapshot?.panes ?? []).map((p) => p.pane_id));
  for (const id of Object.keys(state.dismissed)) if (state.snapshot && !live.has(id)) delete state.dismissed[id];
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(state.dismissed));
  } catch {
    /* ignore */
  }
}

// Clock for things that expire (finished items), ticking every 30 s.
export const now = ref(Date.now());
window.setInterval(() => {
  now.value = Date.now();
  pruneFinished();
}, 30_000);

const ttlMs = () => (settings.finishedTtl > 0 ? settings.finishedTtl * 60_000 : Infinity);

/** "Terminé" for longer than the chosen delay: hidden. Blocked agents always stay. */
function expired(p: AgentInfo): boolean {
  if (p.agent_status !== "done") return false;
  const since = state.since[p.pane_id];
  return since != null && Date.now() - since >= ttlMs();
}

function pruneFinished() {
	if (rawSnapshot !== null) {
		const agents = new Map(rawSnapshot.agents.map((pane) => [pane.pane_id, pane]));
		for (const pane of rawSnapshot.panes) {
			const view = {
				...pane,
				...agents.get(pane.pane_id),
			};
			if (expired(view) && state.questions[pane.pane_id] === undefined
				&& state.dismissed[pane.pane_id] !== attentionKey(view)) {
				dismiss(view);
			}
		}
	}
  const limit = ttlMs();
  if (limit === Infinity) return;
  const t = Date.now();
  if (state.activity.some((r) => r.end !== null && t - r.end > limit)) {
    state.activity = state.activity.filter((r) => r.end === null || t - r.end <= limit);
  }
}
watch(() => settings.finishedTtl, pruneFinished);

export const attention = computed(() =>
  allPanes.value
    .filter((p) => p.agent && (p.agent_status === "blocked" || p.agent_status === "done" || state.questions[p.pane_id]))
    .filter((p) => state.dismissed[p.pane_id] !== attentionKey(p))
    .filter((p) => state.questions[p.pane_id] || !expired(p))
    .sort((a, b) => {
      // Blocked first, then questions, then finished work.
      const rank = (p: AgentInfo) => (p.agent_status === "blocked" ? 0 : state.questions[p.pane_id] ? 1 : 2);
      return rank(a) - rank(b) || (b.state_change_seq ?? 0) - (a.state_change_seq ?? 0);
    }),
);

/**
 * What the workspace status bar section says about the other workspaces: "blocked" when an agent of another workspace
 * waits for an answer, "done" when an agent of another workspace has finished, and null when no agent calls. An agent of
 * the selected workspace never counts, because the developer sees it.
 */
export const otherWorkspaceStatus = computed<"blocked" | "done" | null>(() => {
  const calling = attention.value.filter((p) => p.workspace_id !== state.selectedWorkspaceId);
  if (calling.some((p) => p.agent_status === "blocked")) {
    return "blocked";
  }
  if (calling.some((p) => p.agent_status === "done")) {
    return "done";
  }
  return null;
});

export function tabLabel(id: string): string {
  const tab = state.snapshot?.tabs.find((x) => x.tab_id === id);
  return tab ? tab.label || t("sessionStore.tabNumber", { number: tab.number }) : "";
}

export function workspaceLabel(id: string): string {
  return workspaces.value.find((w) => w.workspace_id === id)?.label ?? id;
}

/**
 * How to name a pane in a picker: its tab, the agent kind when the tab does not
 * already say it, and the custom name if there is one. "Notes · Claude", "Refacto · Codex".
 */
export function paneTarget(p: AgentInfo): string {
  const tab = tabLabel(p.tab_id);
  const kind = p.agent ? agentKind(p) : "";
  const name = paneName(p);
  const parts = [tab];
  if (kind && tab.toLowerCase() !== kind.toLowerCase()) parts.push(kind);
  if (name && ![tab, kind, p.agent ?? ""].some((x) => x.toLowerCase() === name.toLowerCase())) parts.push(name);
  return parts.filter(Boolean).join(" · ");
}

/** "Workspace · Onglet…", for toasts and titles. */
export function paneFullName(p: AgentInfo): string {
  return `${workspaceLabel(p.workspace_id)} · ${paneTarget(p)}`;
}

/** Agents grouped by workspace, in the order of the list of workspaces: for "send to…" pickers. */
export const agentGroups = computed(() =>
  workspaces.value
    .map((w) => ({
      workspace: w.label,
      items: allPanes.value
        .filter((p) => p.agent && p.workspace_id === w.workspace_id)
        .map((p) => ({ pane: p, label: paneTarget(p) })),
    }))
    .filter((g) => g.items.length),
);

// ---- Context and quotas ---------------------------------------------------

// Last values seen, so gauges never blink out between two reports.
const lastContext = new Map<string, ContextUsage>();

/**
 * Claude account limits, one entry per window. Several Claude sessions report them,
 * each at its own pace, and a session that has not talked to the API yet reports
 * nothing: every window keeps the most recent reading from any session, by the time
 * that reading was taken. Persisted so a restart starts from the last known state.
 */
interface WindowReading {
  percent: number;
  resetsAt?: number;
  at: number;
}
const QUOTA_KEY = "heidrun.claude-windows";
const claudeWindows: Record<"q5h" | "q7d", WindowReading | undefined> = (() => {
  try {
    return { q5h: undefined, q7d: undefined, ...JSON.parse(localStorage.getItem(QUOTA_KEY) ?? "{}") };
  } catch {
    return { q5h: undefined, q7d: undefined };
  }
})();

interface AntigravityQuota {
  at: number;
  buckets: { id: string; percent: number; resetsAt?: number }[];
}
const ANTIGRAVITY_QUOTA_KEY = "heidrun.antigravity-quota";
let antigravityQuota: AntigravityQuota | null = (() => {
  try {
    return JSON.parse(localStorage.getItem(ANTIGRAVITY_QUOTA_KEY) ?? "null");
  } catch {
    return null;
  }
})();

const num = (v?: string) => (v != null && v !== "" && !Number.isNaN(Number(v)) ? Number(v) : undefined);

// Session id seen with each pane's last reading: a new one (/clear, /resume) drops it.
const lastSession = new Map<string, string>();

export function contextFor(p: AgentInfo): ContextUsage | null {
  const sid = p.tokens?.hd_sid ?? p.tokens?.hd_agy_sid;
  if (sid && lastSession.get(p.pane_id) !== sid) {
    lastSession.set(p.pane_id, sid);
    lastContext.delete(p.pane_id);
  }
  const fresh = readContext(p);
  if (fresh) {
    lastContext.set(p.pane_id, fresh);
    return fresh;
  }
  // Same agent still in the pane: keep showing its last reading.
  return p.agent ? lastContext.get(p.pane_id) ?? null : null;
}

function readContext(p: AgentInfo): ContextUsage | null {
  const t = p.tokens ?? {};
  const antigravity = num(t.hd_agy_ctx);
  if (antigravity != null) {
    const size = num(t.hd_agy_ctx_size);
    return { percent: antigravity, size, used: size ? Math.round((antigravity / 100) * size) : undefined };
  }
  const claude = num(t.hd_ctx);
  if (claude != null) {
    const size = num(t.hd_ctx_size);
    return { percent: claude, size, used: size ? Math.round((claude / 100) * size) : undefined };
  }
  const sid = p.agent_session?.value;
  const codex = sid ? state.codex?.sessions?.[sid] : undefined;
  if (codex?.context_used != null && codex.context_window) {
    return {
      percent: Math.min(100, (codex.context_used / codex.context_window) * 100),
      used: codex.context_used,
      size: codex.context_window,
    };
  }
  return null;
}

export const quotas = computed<QuotaBlock[]>(() => {
  const blocks: QuotaBlock[] = [];

  // Claude: the status line script reports the account limits as tokens on its pane.
  let changed = false;
  for (const p of allPanes.value) {
    const t = p.tokens;
    if (!t) continue;
    for (const key of ["q5h", "q7d"] as const) {
      const percent = num(t[`hd_${key}`]);
      if (percent == null) continue;
      const prev = claudeWindows[key];
      // Per-window timestamp from the current script. Older copies only had hd_ts,
      // which also moves when the window is missing: trust it only to seed a value.
      const own = num(t[`hd_${key}_ts`]);
      const at = own ?? (prev ? 0 : num(t.hd_ts) ?? 0);
      if (!prev || at > prev.at) {
        claudeWindows[key] = { percent, resetsAt: num(t[`hd_${key}_reset`]), at };
        changed = true;
      }
    }
  }
  if (changed) {
    try {
      localStorage.setItem(QUOTA_KEY, JSON.stringify(claudeWindows));
    } catch {
      /* ignore */
    }
  }
  if (claudeWindows.q5h || claudeWindows.q7d) {
    const now = Date.now() / 1000;
    // Once a window's reset time has passed it is back to 0 %, until the next report.
    const value = (w: WindowReading) => (w.resetsAt && w.resetsAt < now ? 0 : w.percent);
    const windows: QuotaBlock["windows"] = [];
    if (claudeWindows.q5h) windows.push({ id: "session", name: t("sessionStore.window.session"), percent: value(claudeWindows.q5h), resetsAt: claudeWindows.q5h.resetsAt });
    if (claudeWindows.q7d) windows.push({ id: "week", name: t("sessionStore.window.week"), percent: value(claudeWindows.q7d), resetsAt: claudeWindows.q7d.resetsAt });
    const cost = allPanes.value.reduce((sum, p) => sum + (num(p.tokens?.hd_cost) ?? 0), 0);
    const updatedAt = Math.max(claudeWindows.q5h?.at ?? 0, claudeWindows.q7d?.at ?? 0) || undefined;
    blocks.push({ provider: "claude", label: "Claude", windows, cost: cost || undefined, updatedAt });
  }

  // Antigravity sends all account buckets together. Keep the newest complete snapshot across its panes.
  let newestAntigravityAt = antigravityQuota?.at ?? 0;
  for (const p of allPanes.value) {
    const t = p.tokens;
    const at = num(t?.hd_agy_ts) ?? 0;
    const count = Math.min(20, Math.max(0, Math.floor(num(t?.hd_agy_count) ?? 0)));
    if (!t || at < newestAntigravityAt || count === 0) continue;
    const buckets = [];
    for (let index = 0; index < count; index += 1) {
      const id = t[`hd_agy_${index}_id`];
      const remaining = num(t[`hd_agy_${index}_remaining`]);
      if (!id || remaining == null) continue;
      const reset = t[`hd_agy_${index}_reset`];
      const resetsAt = reset ? Date.parse(reset) / 1000 : undefined;
      buckets.push({ id, percent: Math.max(0, Math.min(100, (1 - remaining) * 100)), resetsAt: Number.isFinite(resetsAt) ? resetsAt : undefined });
    }
    if (buckets.length) {
      buckets.sort((left, right) => {
        const priority = (id: string) => id === "gemini-weekly" ? 0 : id === "3p-weekly" ? 1 : 2;
        return priority(left.id) - priority(right.id) || left.id.localeCompare(right.id);
      });
      newestAntigravityAt = at;
      antigravityQuota = { at, buckets };
      try {
        localStorage.setItem(ANTIGRAVITY_QUOTA_KEY, JSON.stringify(antigravityQuota));
      } catch {
        /* ignore */
      }
    }
  }
  if (antigravityQuota?.buckets.length) {
    const windows = antigravityQuota.buckets.map((bucket) => ({
      id: `antigravity:${bucket.id}`,
      name: antigravityBucketName(bucket.id),
      percent: bucket.resetsAt != null && bucket.resetsAt < Date.now() / 1000 ? 0 : bucket.percent,
      resetsAt: bucket.resetsAt,
      period: "week" as const,
      windowMinutes: 10080,
    }));
    blocks.push({ provider: "antigravity", label: "Antigravity", windows, updatedAt: antigravityQuota.at });
  }

  const c = state.codex;
  if (c?.primary || c?.secondary) {
    const windows = codexWindows(c, Date.now() / 1000);
    blocks.push({ provider: "codex", label: c.plan ? `Codex · ${c.plan}` : "Codex", windows, updatedAt: c.updated_at ?? undefined });
  }
  return blocks;
});

function antigravityBucketName(id: string): string {
  if (id === "gemini-weekly") return t("sessionStore.antigravity.geminiWeekly");
  if (id === "3p-weekly") return t("sessionStore.antigravity.thirdPartyWeekly");
  return `${id.replace(/[-_]/g, " ")} · ${t("sessionStore.window.week")}`;
}

// ---- Snapshot refresh -----------------------------------------------------

let refreshTimer: number | undefined;
let inflight = false;
let again = false;
let lastPaneKey = "";
let pendingWorkspaceFocusId: string | null = null;
const workspaceFocusRequests = new Map<string, string>();

export function scheduleRefresh(delay = 60) {
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(refresh, delay);
}

let refreshHoldCount = 0;

/**
 * Stops the refresh of the snapshot until the returned function runs. A refresh that comes in the meantime is dropped. When
 * the last hold ends, the snapshot is read once. A move of a pane holds the refresh, so that the window never shows the state
 * between two calls to Herdr.
 *
 * @returns The function that ends this hold and, when it is the last hold, reads the snapshot. Calling it a second time does
 * nothing. It resolves after the snapshot is applied.
 */
export function holdRefresh(): () => Promise<void> {
  refreshHoldCount += 1;
  let isReleased = false;
  return async () => {
    if (isReleased) {
      return;
    }
    isReleased = true;
    refreshHoldCount -= 1;
    if (refreshHoldCount === 0) {
      await refresh();
    }
  };
}

export async function refresh() {
  if (refreshHoldCount > 0) {
    return;
  }
  if (inflight) {
    again = true;
    return;
  }
  inflight = true;
  try {
    do {
      again = false;
      const snap = await api.snapshot();
      applySnapshot(snap);
      state.connected = true;
      state.error = "";
    } while (again);
  } catch (e) {
    state.connected = false;
    state.error = String(e);
  } finally {
    inflight = false;
  }
}

/** Removes a finished run from the Activité list. */
export function dismissRun(id: number) {
  state.activity = state.activity.filter((r) => r.id !== id || r.end === null);
}

/** Removes every finished run; running ones stay. */
export function clearFinishedRuns() {
  state.activity = state.activity.filter((r) => r.end === null);
}

let runSeq = 0;
const ACTIVE = new Set<AgentStatus>(["working", "blocked"]);

/**
 * Turns status changes into work runs. Only real work is recorded: an agent going
 * idle after being "done" (Herdr does that once the result has been seen) or
 * passing through "unknown" is not activity.
 */
function trackRun(
  paneId: string,
  before: AgentStatus | undefined,
  after: AgentStatus,
  now: number,
  names: Pick<ActivityEntry, "name" | "kind" | "workspace" | "tab" | "workspaceId" | "cwd">,
) {
  const open = state.activity.find((r) => r.paneId === paneId && r.end === null);
  if (ACTIVE.has(after)) {
    if (open) {
      // Waiting for a decision is not work: blocked time is counted apart.
      if (after === "blocked" && open.status !== "blocked") open.blockedAt = now;
      if (open.status === "blocked" && after !== "blocked") open.decisions = (open.decisions ?? 0) + 1;
      if (after === "working" && open.blockedAt) {
        open.blockedMs = (open.blockedMs ?? 0) + (now - open.blockedAt);
        open.blockedAt = null;
      }
      open.status = after as "working" | "blocked";
      Object.assign(open, names);
      return;
    }
    state.activity.unshift({
      id: ++runSeq,
      paneId,
      start: now,
      end: null,
      status: after as "working" | "blocked",
      startUnknown: before === undefined,
      blockedMs: 0,
      blockedAt: after === "blocked" ? now : null,
      // The consigne that started it was sent just before (counted then, no run was open).
      prompts: lastPrompt[paneId] && now - lastPrompt[paneId].at < 120_000 ? 1 : 0,
      decisions: 0,
      ...names,
    });
    // Only finished runs are trimmed: a long run must not vanish before it ends.
    const finished = state.activity.filter((r) => r.end !== null);
    if (state.activity.length > 40 && finished.length) {
      const drop = new Set(finished.slice(-(state.activity.length - 40)).map((r) => r.id));
      state.activity = state.activity.filter((r) => !drop.has(r.id));
    }
  } else if (open && (after === "done" || after === "idle")) {
    if (open.status === "blocked") open.decisions = (open.decisions ?? 0) + 1;
    open.end = now;
    open.status = "done";
    Object.assign(open, names);
    endRun(open, now);
  }
}

/** Reads the menu of a blocked agent, retrying while it is still being drawn. */
async function readChoices(paneId: string, delays = [500, 900, 1600]) {
  if (DetectionFamilies.isEnabled(settings, "questionsAndChoices") === false) {
    return;
  }
  for (const delay of delays) {
    await new Promise((r) => window.setTimeout(r, delay));
    const before = state.snapshot?.panes.find((p) => p.pane_id === paneId);
    if (!before || before.agent_status !== "blocked") return;
    try {
      const menu = findChoices(await api.read(paneId, 60));
      // Still blocked once the read is back (it may have moved on meanwhile).
      const pane = state.snapshot?.panes.find((p) => p.pane_id === paneId);
      if (!pane || pane.agent_status !== "blocked") return;
      if (menu) {
        state.choices[paneId] = menu;
        return;
      }
    } catch {
      /* read in progress: next attempt */
    }
  }
}

const sameMenu = (a: ChoiceMenu, b: ChoiceMenu) =>
  a.question === b.question && a.options.length === b.options.length && a.options.every((o, i) => o.label === b.options[i].label);

const answering = new Set<string>();

/**
 * Picks option `n` of a blocked agent's menu with its number key (Claude Code
 * and Codex accept it). Only when the very same menu is still there a moment
 * later does it fall back to the arrows and Enter: never on a new dialog.
 * An approval of a dangerous command goes through the guards first.
 */
/** Any option that is not a refusal approves something ("Always allow", "Continue", "Run"…). */
export const REFUSAL = /^(no|non|deny|refuse|refuser|reject|rejeter|cancel|annuler|abort|stop)\b/i;

export async function answerChoice(paneId: string, n: number, checked = false, expected?: ChoiceMenu): Promise<boolean> {
  const menu = state.choices[paneId];
  if (!menu || answering.has(paneId)) return false;
  // Checked (on the phone) against this very menu: a new one is not answered blindly.
  if (expected && menu !== expected) return false;
  const option = menu.options.find((o) => o.n === n);
  const approves = !!option && !REFUSAL.test(option.label);
  // `checked`: the guards were already applied (and confirmed) on the phone.
  if (approves && menu.detail && !checked) {
    const { cwd, where } = whereOf(paneId);
    if (!(await allowCommand(menu.detail, cwd, where))) return false;
  }
  answering.add(paneId);
  delete state.choices[paneId];
  try {
    await guard(() => api.sendKeys(paneId, [String(n)]));
    await new Promise((r) => window.setTimeout(r, 700));
    let pane = state.snapshot?.panes.find((p) => p.pane_id === paneId);
    if (pane?.agent_status !== "blocked") return true;
    let again: ChoiceMenu | null = null;
    try {
      again = findChoices(await api.read(paneId, 60));
    } catch {
      return true;
    }
    if (again && sameMenu(again, menu)) {
      const from = again.options.findIndex((o) => o.selected);
      const steps = n - 1 - (from === -1 ? 0 : from);
      const keys = [...Array(Math.abs(steps)).fill(steps > 0 ? "down" : "up"), "enter"];
      await guard(() => api.sendKeys(paneId, keys));
      await new Promise((r) => window.setTimeout(r, 500));
    }
    // Next dialog (or the same one): show what is on screen now.
    pane = state.snapshot?.panes.find((p) => p.pane_id === paneId);
    if (pane?.agent_status === "blocked") readChoices(paneId, [300, 800]);
    return true;
  } finally {
    answering.delete(paneId);
  }
}

/**
 * Reads the end of the agent's output after it finished. A question there
 * (« Veux-tu que je … ? ») is a decision to make, like a blocking prompt: it
 * shows in « À traiter » and gets its own notification.
 */
async function checkQuestion(
	paneId: string,
	name: string,
	ws: string,
	notifyQuestion: boolean,
	notifyDone = false,
	pushToPhone = false,
	expectedKey?: string,
) {
  // Let the agent finish drawing its answer.
  await new Promise((r) => window.setTimeout(r, 700));
  let question: string | null = null;
  const isReadingQuestions = DetectionFamilies.isEnabled(settings, "questionsAndChoices");
  for (let attempt = 0; isReadingQuestions && attempt < 3 && question === null; attempt++) {
    try {
      question = findQuestion(await api.read(paneId, 120));
      break;
    } catch {
      // "read in progress": another read of this terminal, try again shortly.
      await new Promise((r) => window.setTimeout(r, 400));
    }
  }
  const pane = state.snapshot?.panes.find((p) => p.pane_id === paneId);
  if (!pane || pane.agent_status === "working" || pane.agent_status === "blocked") return;
	const view = paneView(pane);
	if (expectedKey !== undefined && attentionKey(view) !== expectedKey) {
		return;
	}
	if (state.dismissed[paneId] === attentionKey(view)) {
		return;
	}
  if (question) {
    state.questions[paneId] = { text: question, at: Date.now() };
    // Shown again even if an earlier "terminé" card was closed.
    delete state.dismissed[paneId];
    if (pushToPhone) void notifyPhone();
    if (notifyQuestion) notify("question", t("sessionStore.notify.question", { name }), `${ws ? `${ws} · ` : ""}${question}`);
  } else {
    delete state.questions[paneId];
    if (pushToPhone) void notifyPhone();
    if (notifyDone) notify("done", t("sessionStore.notify.done", { name }), ws);
  }
}

// The detection of the questions and of the numbered choices follows its switch at once: turning it off removes the questions
// and the menus already read, and turning it on reads the menus of the blocked agents again.
watch(
  () => DetectionFamilies.isEnabled(settings, "questionsAndChoices"),
  (isEnabled) => {
    if (isEnabled === false) {
      for (const paneId of Object.keys(state.questions)) {
        delete state.questions[paneId];
      }
      for (const paneId of Object.keys(state.choices)) {
        delete state.choices[paneId];
      }
      return;
    }
    for (const pane of state.snapshot?.panes ?? []) {
      if (pane.agent_status === "blocked") {
        void readChoices(pane.pane_id, [0]);
      }
    }
  },
);

function applySnapshot(snap: SessionSnapshot) {
  const previousAgents = new Map((rawSnapshot?.agents ?? []).map((pane) => [pane.pane_id, pane]));
	const previous = new Map((rawSnapshot?.panes ?? []).map((pane) => [pane.pane_id, {
		...pane,
		...previousAgents.get(pane.pane_id),
	}]));
  const agents = new Map(snap.agents.map((a) => [a.pane_id, a]));
  const now = Date.now();
	let isDismissalChanged = false;

  for (const pane of snap.panes) {
    const earlier = previous.get(pane.pane_id);
		const before = earlier?.agent_status;
    const after = pane.agent_status;
		const view = {
			...pane,
			...agents.get(pane.pane_id),
		};
		const isNewCompletion = after === 'done' && earlier?.agent_status === 'done'
			&& attentionKey(earlier) !== attentionKey(view);
		if (before === after && isNewCompletion === false) {
			continue;
		}
		if (state.dismissed[pane.pane_id] !== undefined
			&& state.dismissed[pane.pane_id] !== attentionKey(view)) {
			delete state.dismissed[pane.pane_id];
			isDismissalChanged = true;
		}
    state.since[pane.pane_id] = now;
    if (!pane.agent) continue;
    const ws = snap.workspaces.find((w) => w.workspace_id === pane.workspace_id)?.label ?? "";
    const tab = snap.tabs.find((x) => x.tab_id === pane.tab_id);
    trackRun(pane.pane_id, before, after, now, {
      name: paneName(view),
      kind: agentKind(view),
      workspace: ws,
      tab: tab ? tab.label || t("sessionStore.tabNumber", { number: tab.number }) : "",
      workspaceId: pane.workspace_id,
      cwd: pane.foreground_cwd || pane.cwd || null,
    });
		if (after === 'working' || after === 'blocked' || isNewCompletion) {
			delete state.questions[pane.pane_id];
		}
    if (after !== "blocked") delete state.choices[pane.pane_id];
    else readChoices(pane.pane_id);
    if (before === undefined || isNewCompletion) {
      // A new completion may arrive without a snapshot of the intervening work.
			if (after === 'done') {
				checkQuestion(pane.pane_id, paneName(view), ws, false, false, false, attentionKey(view));
			}
      continue;
    }
    if (after === "blocked") {
      void notifyPhone();
      if (!document.hasFocus() || state.selectedPaneId !== pane.pane_id) {
        notify("blocked", t("sessionStore.notify.blocked", { name: paneName(view) }), ws);
      }
    } else if ((after === "done" || after === "idle") && (before === "working" || before === "blocked")) {
      // Finished: look at how the answer ends before notifying ("a terminé" or the question).
      const away = !document.hasFocus() || state.selectedPaneId !== pane.pane_id;
			checkQuestion(
				pane.pane_id, paneName(view), ws, away, after === 'done' && away, true, attentionKey(view),
			);
    }
  }

  const alive = new Set(snap.panes.map((p) => p.pane_id));
  for (const r of state.activity) {
    if (r.end === null && !alive.has(r.paneId)) {
      r.end = now;
      r.status = "closed";
      endRun(r, now);
    }
  }
	if (state.snapshot === null) {
		CompositionBarAtStart.openForRunningCodingAgents(snap.panes);
		for (const workspace of snap.workspaces) {
			const request = workspace.tokens?.heidrun_focus_request;
			if (request !== undefined) {
				workspaceFocusRequests.set(workspace.workspace_id, request);
			}
		}
	}
	rawSnapshot = snap;
  state.snapshot = FinishedStatus.apply(snap, state.dismissed);
	if (isDismissalChanged) {
		saveDismissed();
	}
  fixSelection(snap);
	pruneFinished();
	if (pendingWorkspaceFocusId !== null
		&& snap.workspaces.some((workspace) => workspace.workspace_id === pendingWorkspaceFocusId)) {
		selectWorkspace(pendingWorkspaceFocusId);
		pendingWorkspaceFocusId = null;
	} else if (again === false) {
		pendingWorkspaceFocusId = null;
	}

  const ids = snap.panes.filter((p) => p.agent).map((p) => p.pane_id).sort();
  const key = ids.join(",");
  // Re-sent every time: Rust ignores identical sets while their subscription is alive.
  api.watchPanes(ids).catch(() => {});
  if (key !== lastPaneKey) {
    lastPaneKey = key;
    refreshCodex();
  }
}

/**
 * Finds the pane to select when the selected tab does not exist any more, because the developer closed it. It is the
 * pane that had the focus most recently in the pane focus history, among the panes of the selected workspace. The panes
 * of the closed tab are not in the snapshot, so the search skips all their entries.
 * @param snap - the snapshot that Herdr just sent
 * @returns the pane to select, or `null` when the selected tab still exists or the history has no such pane
 */
function findPaneAfterTabClose(snap: SessionSnapshot): PaneInfo | null {
  const closedTabId = state.selectedTabId;
  if (closedTabId === null || snap.tabs.some((tab) => tab.tab_id === closedTabId)) {
    return null;
  }
  const workspacePanes = new Map(
    snap.panes
      .filter((pane) => pane.workspace_id === state.selectedWorkspaceId)
      .map((pane) => [pane.pane_id, pane] as const),
  );
  const paneId = paneFocusHistory.findMostRecentPaneId((candidateId) => workspacePanes.has(candidateId));
  if (paneId === null) {
    return null;
  }
  return workspacePanes.get(paneId) ?? null;
}

function fixSelection(snap: SessionSnapshot) {
  ZenMode.exitIfPaneIsMissing(snap.panes.map((pane) => pane.pane_id));
  const ws = snap.workspaces;
  if (!ws.some((w) => w.workspace_id === state.selectedWorkspaceId)) {
    const savedId = settings.selectedWorkspaceId;
    const isSavedWorkspaceToRestore = state.selectedWorkspaceId === null && ws.some((w) => w.workspace_id === savedId);
    if (isSavedWorkspaceToRestore) {
      state.selectedWorkspaceId = savedId;
      state.selectedTabId = last.tab[savedId] ?? null;
      state.selectedPaneId = state.selectedTabId ? last.pane[state.selectedTabId] ?? null : null;
    } else {
      state.selectedWorkspaceId = snap.focused_workspace_id ?? ws[0]?.workspace_id ?? null;
    }
  }
  const wsInfo = ws.find((w) => w.workspace_id === state.selectedWorkspaceId);
  const wsTabs = snap.tabs.filter((t) => t.workspace_id === state.selectedWorkspaceId);
  if (!wsTabs.some((t) => t.tab_id === state.selectedTabId)) {
    const paneAfterTabClose = findPaneAfterTabClose(snap);
    if (paneAfterTabClose !== null) {
      state.selectedTabId = paneAfterTabClose.tab_id;
      state.selectedPaneId = paneAfterTabClose.pane_id;
    } else {
      state.selectedTabId = wsInfo?.active_tab_id ?? wsTabs[0]?.tab_id ?? null;
    }
  }
  const panes = snap.panes.filter((p) => p.tab_id === state.selectedTabId);
  if (!panes.some((p) => p.pane_id === state.selectedPaneId)) {
    const layout = snap.layouts.find((l) => l.tab_id === state.selectedTabId);
    state.selectedPaneId = layout?.focused_pane_id ?? panes[0]?.pane_id ?? null;
  }
  ZenMode.selectPaneForTab(state.selectedTabId, state.selectedPaneId);
}

// ---- Codex usage polling --------------------------------------------------

export async function refreshCodex() {
  try {
    const ids = (state.snapshot?.panes ?? [])
      .filter((p) => p.agent === "codex" || p.agent_session?.agent === "codex")
      .map((p) => p.agent_session?.value ?? "")
      .filter(Boolean);
    const next = await api.codexUsage(ids);
    const prev = state.codex;
    if (prev && !next.primary && !next.secondary) {
      next.primary = prev.primary;
      next.secondary = prev.secondary;
      next.plan = prev.plan;
      next.updated_at = prev.updated_at;
    }
    state.codex = next;
  } catch {
    /* ignore */
  }
}

// ---- Selection ------------------------------------------------------------

// Last tab used in each workspace and last pane used in each tab: coming back to a
// workspace opens where you left it. Kept across restarts.
const LAST_KEY = "heidrun.last-selection";
const last: { tab: Record<string, string>; pane: Record<string, string> } = (() => {
  try {
    return { tab: {}, pane: {}, ...JSON.parse(localStorage.getItem(LAST_KEY) ?? "{}") };
  } catch {
    return { tab: {}, pane: {} };
  }
})();
watch(
  () => [state.selectedWorkspaceId, state.selectedTabId, state.selectedPaneId] as const,
  ([ws, tab, pane]) => {
    if (ws && tab) last.tab[ws] = tab;
    if (tab && pane) last.pane[tab] = pane;
    try {
      localStorage.setItem(LAST_KEY, JSON.stringify(last));
    } catch {
      /* ignore */
    }
  },
);

// The selected workspace is saved at each change, so the next start selects it again (issue #355).
watch(
  () => state.selectedWorkspaceId,
  (id) => {
    if (id !== null) {
      settings.selectedWorkspaceId = id;
    }
  },
);

export function selectWorkspace(id: string) {
  state.selectedWorkspaceId = id;
  state.selectedTabId = last.tab[id] ?? null;
  state.selectedPaneId = state.selectedTabId ? last.pane[state.selectedTabId] ?? null : null;
  // Gone since (closed tab or pane): fixSelection falls back to Herdr's active one.
  if (state.snapshot) fixSelection(state.snapshot);
}

export function selectTab(id: string) {
  state.selectedTabId = id;
  state.selectedPaneId = last.pane[id] ?? null;
  if (state.snapshot) fixSelection(state.snapshot);
}

/** Next / previous tab of the current workspace, wrapping around. */
export function cycleTab(delta: number) {
  const list = tabs.value;
  if (!list.length) return;
  const i = list.findIndex((t) => t.tab_id === state.selectedTabId);
  selectTab(list[(i + delta + list.length) % list.length].tab_id);
}

/** Next / previous workspace, wrapping around. */
export function cycleWorkspace(delta: number) {
  const list = workspaces.value;
  if (!list.length) return;
  const i = list.findIndex((w) => w.workspace_id === state.selectedWorkspaceId);
  selectWorkspace(list[(i + delta + list.length) % list.length].workspace_id);
}

/** ⌘1 … ⌘9: workspace by position in the list of workspaces. */
export function selectWorkspaceAt(index: number) {
  const w = workspaces.value[index];
  if (w) selectWorkspace(w.workspace_id);
}

export function selectPane(p: PaneInfo) {
	const view = allPanes.value.find((pane) => pane.pane_id === p.pane_id);
	if (view?.agent_status === 'done') {
		dismiss(view);
	}
  state.selectedWorkspaceId = p.workspace_id;
  state.selectedTabId = p.tab_id;
  state.selectedPaneId = p.pane_id;
  ZenMode.focusPane(p.pane_id, p.tab_id);
}

// ---- Actions --------------------------------------------------------------

export function toast(message: string, kind: "info" | "error" = "info") {
  state.toast = message;
  state.toastKind = kind;
  window.setTimeout(() => {
    if (state.toast === message) state.toast = "";
  }, 4000);
}

async function guard<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    const r = await fn();
    scheduleRefresh();
    return r;
  } catch (e) {
    toast(humanError(String(e)));
    return undefined;
  }
}

function humanError(e: string): string {
  if (e.includes("agent_blocked")) return t("sessionStore.error.agentBlocked");
  if (e.includes("herdr_unreachable")) return t("sessionStore.error.herdrUnreachable");
  return e;
}

export function newTerminal() {
  const ws = selectedWorkspace.value;
  if (!ws) return;
  return guard(async () => {
    const cwd = WorkspaceFolders.require(ws.workspace_id);
    const pane = await api.newTab(ws.workspace_id, cwd);
    await refresh();
    if (pane) selectPane(pane);
  });
}

/**
 * Splits a pane and starts a terminal in the new pane, then selects the new pane. Without a pane to split, creates a new tab
 * with a terminal.
 * @param direction - where the new pane goes: to the right of the pane, or below it
 * @param paneId - the pane to split, the selected pane when it is not given
 * @returns the new pane, or undefined when no pane was split
 */
export async function splitPane(direction: "right" | "down" = "right", paneId?: string): Promise<PaneInfo | undefined> {
  const p = paneId ? allPanes.value.find((x) => x.pane_id === paneId) : selectedPane.value;
  if (!p) {
    await newTerminal();
    return undefined;
  }
  return guard(async () => {
    const pane = await api.split(p.pane_id, direction, WorkspaceFolders.require(p.workspace_id));
    await refresh();
    if (pane) selectPane(pane);
    return pane;
  });
}

/**
 * Creates a workspace for a folder, then selects it with its first tab and its first pane, so that the developer sees that
 * the workspace exists. A failure shows a toast.
 * @param cwd - the path of the folder of the workspace, absolute or starting with `~`
 * @param label - the name of the workspace
 * @returns the first pane of the new workspace, or undefined when the workspace was not created
 */
export async function newWorkspace(cwd: string | null, label: string | null): Promise<PaneInfo | undefined> {
  // The raw socket API wants absolute paths.
  if (cwd?.startsWith("~")) {
    const home = (await homeDir()).replace(/\/$/, "");
    cwd = home + cwd.slice(1);
  }
  return guard(async () => {
    const created = await api.newWorkspace(cwd, label);
    await refresh();
    if (created.root_pane) {
      selectPane(created.root_pane);
    }
    return created.root_pane;
  });
}

/**
 * Creates a workspace for a folder, then selects it with its first tab and its first pane.
 * @param cwd - the absolute path of the folder of the workspace
 * @param label - the name of the workspace
 * @returns a promise that ends when the workspace is selected, or when the failure is shown
 */
export async function openFolderAsWorkspace(cwd: string, label: string): Promise<void> {
  await newWorkspace(cwd, label);
}

/** Closes a pane. A file view pane with unsaved changes asks first (issue #899). */
export async function closePane(paneId: string) {
  if ((await FileViewEditState.confirmDiscard([paneId])) === false) {
    return undefined;
  }
  ZenMode.exitForPane(paneId);
  return guard(() => api.closePane(paneId));
}

/** One split to move: the tab that holds it, the way from the root of the layout to it, and its new share. */
export type SplitRatioChange = { tabId: string; path: boolean[]; ratio: number };

let splitRatioPending: SplitRatioChange[] | null = null;
let isSplitRatioRunning = false;

/**
 * Sets the share of one or several splits while the user drags a line between panes.
 * Only one request runs at a time. A call that comes while a request runs replaces the call that waits, so the
 * panes follow the pointer without a queue of old positions.
 */
export function setSplitRatios(changes: SplitRatioChange[]) {
  splitRatioPending = changes;
  if (isSplitRatioRunning) {
    return;
  }
  void flushSplitRatios();
}

async function flushSplitRatios() {
  isSplitRatioRunning = true;
  try {
    while (splitRatioPending !== null) {
      const changes = splitRatioPending;
      splitRatioPending = null;
      for (const change of changes) {
        await api.setSplitRatio(change.tabId, change.path, change.ratio);
      }
      await refresh();
    }
  } catch (e) {
    splitRatioPending = null;
    toast(humanError(String(e)));
    scheduleRefresh();
  } finally {
    isSplitRatioRunning = false;
  }
}

/** Closes a workspace. A file view pane of the workspace with unsaved changes asks first (issue #899). */
export async function closeWorkspace(workspaceId: string) {
  const paneIds = allPanes.value.filter((pane) => pane.workspace_id === workspaceId).map((pane) => pane.pane_id);
  if ((await FileViewEditState.confirmDiscard(paneIds)) === false) {
    return undefined;
  }
  return guard(() => api.closeWorkspace(workspaceId));
}

export function startRename(kind: "ws" | "tab" | "pane", id: string) {
  if (kind === "ws") selectWorkspace(id);
  if (kind === "tab") selectTab(id);
  state.renaming = `${kind}:${id}`;
}

export async function finishRename(kind: "ws" | "tab" | "pane", id: string, label: string | null) {
  state.renaming = null;
  if (label === null && kind !== "pane") return;
  if (kind === "ws") await guard(() => api.renameWorkspace(id, label!));
  else if (kind === "tab") await guard(() => api.renameTab(id, label!));
  else await guard(() => api.renamePane(id, label ? label : null));
}

export function moveWorkspace(workspaceId: string, insertIndex: number) {
  return guard(() => api.moveWorkspace(workspaceId, insertIndex));
}

export function moveTab(tabId: string, insertIndex: number) {
  return guard(() => api.moveTab(tabId, insertIndex));
}

/** Keyboard reordering: moves the selected workspace up (-1) or down (+1). */
export function shiftWorkspace(delta: -1 | 1) {
  // Moves past the neighbor shown in the list of workspaces. The status of the agents never changes the order of the list.
  const list = workspaces.value;
  const i = list.findIndex((w) => w.workspace_id === state.selectedWorkspaceId);
  const neighbor = list[i + delta];
  if (i === -1 || !neighbor) return;
  return moveWorkspace(list[i].workspace_id, delta > 0 ? i + delta + 1 : i + delta);
}

/** Keyboard reordering: moves the selected tab left (-1) or right (+1). */
export function shiftTab(delta: -1 | 1) {
  const list = tabs.value;
  const i = list.findIndex((t) => t.tab_id === state.selectedTabId);
  const target = i + delta;
  if (i === -1 || target < 0 || target >= list.length) return;
  return moveTab(list[i].tab_id, delta > 0 ? target + 1 : target);
}

/** Tells if a tab is the only tab of its workspace. A workspace always has at least one tab. */
function isLastTabOfItsWorkspace(tabId: string): boolean {
  const allTabs = state.snapshot?.tabs ?? [];
  const tab = allTabs.find((candidate) => candidate.tab_id === tabId);
  if (tab === undefined) {
    return false;
  }
  return allTabs.filter((candidate) => candidate.workspace_id === tab.workspace_id).length <= 1;
}

export async function closeTab(tabId: string) {
  if (isLastTabOfItsWorkspace(tabId)) {
    toast(t("sessionStore.error.lastTab"), "error");
    return undefined;
  }
  // A file view pane of the tab with unsaved changes asks first (issue #899).
  const paneIds = allPanes.value.filter((pane) => pane.tab_id === tabId).map((pane) => pane.pane_id);
  if ((await FileViewEditState.confirmDiscard(paneIds)) === false) {
    return undefined;
  }
  return guard(() => api.closeTab(tabId));
}

/** Where a pane is, for the confirmation window: "Workspace · Onglet". */
function whereOf(paneId: string | undefined): { cwd: string | null; where: string } {
  const p = paneId ? allPanes.value.find((x) => x.pane_id === paneId) : undefined;
  return p ? { cwd: p.foreground_cwd || p.cwd || null, where: paneFullName(p) } : { cwd: null, where: "" };
}

export async function sendPrompt(paneId: string, text: string) {
  // "! command": Claude's shell mode runs it as is, so it goes through the guards.
  const shell = /^\s*!\s*(\S[\s\S]*)$/.exec(text);
  if (shell) {
    const { cwd, where } = whereOf(paneId);
    if (!(await allowCommand(shell[1], cwd, where))) return undefined;
  }
  rememberPrompt(paneId, text);
  return guard(() => api.prompt(paneId, text));
}

const BRACKETED_PASTE_START = "\x1b[200~";
const BRACKETED_PASTE_END = "\x1b[201~";

/**
 * Writes `text` into the terminal of a pane. With `submit`, Enter is pressed after the text.
 * A text of several lines goes as a bracketed paste, so a line break does not press Enter.
 */
export async function insertText(paneId: string, text: string, submit: boolean) {
  const shell = /^\s*!\s*(\S[\s\S]*)$/.exec(text);
  if (submit && shell) {
    const { cwd, where } = whereOf(paneId);
    if (!(await allowCommand(shell[1], cwd, where))) return undefined;
  }
  if (submit) {
    rememberPrompt(paneId, text);
  }
  const body = text.includes("\n") ? `${BRACKETED_PASTE_START}${text}${BRACKETED_PASTE_END}` : text;
  return guard(() => api.sendInput(paneId, body, submit ? ["Enter"] : []));
}

export function sendKeys(paneId: string, keys: string[]) {
  return guard(() => api.sendKeys(paneId, keys));
}

export async function runInPane(paneId: string, command: string) {
  const { cwd, where } = whereOf(paneId);
  if (!(await allowCommand(command, cwd, where))) return undefined;
  rememberCommand(command);
  return guard(() => api.run(paneId, command));
}

export async function runInNewPane(command: string, watch?: string) {
  const base = selectedPane.value;
  const ws = selectedWorkspace.value;
  if (!ws) return;
  const cwd = WorkspaceFolders.get(ws.workspace_id);
  if (cwd === null) {
    toast(t('workspaceFolderRecovery.required'));
    return;
  }
  if ((await allowCommand(command, cwd, ws.label)) === false) {
    return;
  }
  rememberCommand(command);
  const pane = await guard(async () =>
    base ? api.split(base.pane_id, "right", cwd) : api.newTab(ws.workspace_id, cwd),
  );
  if (!pane) return;
  // Give the new shell a moment to print its prompt before typing into it.
  await new Promise((r) => setTimeout(r, 350));
  await guard(() => api.run(pane.pane_id, command));
  await refresh();
  selectPane(pane);
  if (watch) addWatch(pane.pane_id, watch);
}

let watchSeq = 1;
export function addWatch(paneId: string, regex: string) {
  const w: OutputWatch = { id: watchSeq++, paneId, regex };
  state.watches.push(w);
  api
    .waitForOutput(paneId, regex)
    .then((line) => {
      const pane = allPanes.value.find((p) => p.pane_id === paneId);
      notify("patternFound", t("sessionStore.notify.patternFound", { name: pane ? paneName(pane) : paneId }), line ?? regex);
    })
    .catch(() => {})
    .finally(() => {
      state.watches = state.watches.filter((x) => x.id !== w.id);
    });
}

/** Sends the end of a terminal to an agent and asks it to fix the failure. */
export async function askAgentToFix(sourcePaneId: string, agentPaneId: string) {
  const text = await guard(() => api.read(sourcePaneId, 80));
  if (text == null) return;
  const source = allPanes.value.find((p) => p.pane_id === sourcePaneId);
  const message =
    `La commande dans le terminal « ${source ? paneName(source) : sourcePaneId} » a échoué. ` +
    `Voici la fin de sa sortie. Trouve la cause et corrige-la.\n\n\`\`\`\n${text.trim()}\n\`\`\``;
  await sendPrompt(agentPaneId, message);
  const agent = allPanes.value.find((p) => p.pane_id === agentPaneId);
  if (agent) toast(t("sessionStore.outputSent", { name: paneName(agent) }));
}

// ---- Recent commands (local convenience only) ----------------------------

const RECENT_KEY = "heidrun.recent";

export function recentCommands(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function rememberCommand(cmd: string) {
  try {
    const list = [cmd, ...recentCommands().filter((c) => c !== cmd)].slice(0, 12);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

// ---- Boot -----------------------------------------------------------------

/** Starts the Herdr server in the background (no terminal needed), then connects. */
export async function startHerdr() {
  state.starting = true;
  try {
    await api.startServer();
    await refresh();
  } catch (e) {
    state.error = String(e);
  } finally {
    state.starting = false;
  }
}

/** The fields used from a workspace event published by Herdr. */
type WorkspaceEvent = {
	/** Herdr's wire event name, such as workspace_focused. */
	event?: string;
	/** The workspace identifier or updated workspace carried by the event. */
	data?: {
		/** The target of a direct focus event. */
		workspace_id?: string;
		/** The workspace after a metadata change. */
		workspace?: WorkspaceInfo;
	};
};

export async function start() {
	await listen<WorkspaceEvent>('herdr://event', async (event) => {
		const workspace = event.payload.data?.workspace;
		const request = workspace?.tokens?.heidrun_focus_request;
		let workspaceId = event.payload.event === 'workspace_focused'
			? event.payload.data?.workspace_id : undefined;
		if (event.payload.event === 'workspace_metadata_updated'
			&& workspace !== undefined && request !== undefined
			&& workspaceFocusRequests.get(workspace.workspace_id) !== request) {
			workspaceFocusRequests.set(workspace.workspace_id, request);
			workspaceId = workspace.workspace_id;
		}
		if (typeof workspaceId === 'string') {
			pendingWorkspaceFocusId = workspaceId;
			await refresh();
			return;
		}
		scheduleRefresh();
	});
  await listen("herdr://connected", () => refresh());
  await listen("herdr://resync", () => scheduleRefresh(150));
  await listen<string>("herdr://disconnected", (e) => {
    state.connected = false;
    state.error = e.payload;
  });
  await refresh();
  if (!state.connected && settings.autoStartHerdr && state.error.includes("herdr_unreachable")) {
    await startHerdr();
  }
  // No timer reads the snapshot of Herdr: it gives the page a new list of workspaces each time, so everything that
  // watches this list runs again. A lost event is covered by the refresh after "herdr://connected" and "herdr://resync".
  // Codex writes its usage outside Heidrun Code and no event announces it, so the usage of Codex keeps a timer.
  window.setInterval(refreshCodex, 10_000);
}
