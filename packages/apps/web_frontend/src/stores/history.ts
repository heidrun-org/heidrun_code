// Agents' work history, kept on this Mac (~/.config/heidrun_code/history.jsonl):
// every finished run with its workspace, agent, branch, active time and cost.
import { computed, reactive, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { allPanes, lastPrompt, onRunEnd, state, type ActivityEntry } from "./session";
import { paneSpend } from "./spend";
import type { GitStatus } from "./git";
import { t } from "../i18n/index";

export interface HistoryRun {
  id: string;
  start: number;
  end: number;
  /** Working time, without the waits for a decision. */
  activeMs: number;
  blockedMs: number;
  /** Already running when the app saw it: the real start is earlier. */
  startUnknown: boolean;
  ws: string;
  wsId?: string;
  tab: string;
  agent: string;
  kind: string;
  paneId: string;
  branch?: string | null;
  cost?: number;
  summary: string;
  closed: boolean;
  prompts?: number;
  decisions?: number;
  /** 2: cost measured per session (older lines may hold an inflated cost). */
  v?: number;
  /** Still running (shown live, not stored yet). */
  live?: boolean;
}

export const history = reactive({
  open: false,
  loaded: false,
  runs: [] as HistoryRun[],
  /** Finished, waiting the few seconds before being written (cost, branch). */
  pending: [] as HistoryRun[],
});

export async function loadHistory() {
  try {
    // Re-read from the file: what is shown is what is stored.
    const list = await invoke<HistoryRun[]>("history_read", { since: 0 });
    history.runs = list
      .filter((r) => r && typeof r.end === "number")
      // Recorded before the cost fix: the time is right, the cost is not.
      .map((r) => (r.v === 2 ? r : { ...r, cost: undefined }))
      .sort((a, b) => b.end - a.end);
  } catch {
    /* no history yet */
  }
  history.loaded = true;
}

// Cost reports arrive with the status line, a little after the run ends.
const COST_DELAY = 15_000;

onRunEnd((r: ActivityEntry) => {
  if (r.end == null) return;
  const end = r.end;
  const blockedMs = r.blockedMs ?? 0;
  const activeMs = Math.max(0, end - r.start - blockedMs);
  if (activeMs < 1000) return;
  const pane = allPanes.value.find((p) => p.pane_id === r.paneId);
  // Captured while the run was open: a closed pane has no folder any more.
  const cwd = r.cwd || pane?.foreground_cwd || pane?.cwd || null;
  // The consigne that started this run (sent just before it), not an older one.
  const lp = lastPrompt[r.paneId];
  const summary = (lp && lp.at >= r.start - 120_000 && lp.at <= end ? lp.text : "") || pane?.terminal_title_stripped || "";
  const base = {
    id: `${r.paneId}-${r.start}`,
    start: r.start,
    end,
    activeMs,
    blockedMs,
    startUnknown: r.startUnknown,
    ws: r.workspace,
    wsId: r.workspaceId,
    tab: r.tab,
    agent: r.name,
    kind: r.kind,
    paneId: r.paneId,
    summary,
    closed: r.status === "closed",
    prompts: r.prompts ?? 0,
    decisions: r.decisions ?? 0,
  };
  // Shown right away: no gap between "en cours" and the recorded line.
  history.pending.unshift({ ...base, cost: paneSpend(r.paneId, r.start, end) || undefined, v: 2 });
  window.setTimeout(async () => {
    const branch = cwd ? (await invoke<GitStatus | null>("git_status", { cwd }).catch(() => null))?.branch ?? null : null;
    // Up to the next run of the same pane, so that cost is never counted twice.
    const next = state.activity.filter((x) => x.paneId === r.paneId && x.start > end).map((x) => x.start);
    const to = Math.min(end + COST_DELAY, ...next);
    const cost = paneSpend(r.paneId, r.start, to);
    const run: HistoryRun = { ...base, branch, cost: cost || undefined, v: 2 };
    await invoke("history_append", { entry: run }).catch(() => {});
    history.pending = history.pending.filter((x) => x.id !== run.id);
    if (history.loaded && !history.runs.some((x) => x.id === run.id)) {
      // Recorded 15 s late, possibly out of order: keep most recent first.
      const i = history.runs.findIndex((x) => x.end < run.end);
      history.runs.splice(i === -1 ? history.runs.length : i, 0, run);
    }
  }, COST_DELAY);
});

function startOfDay(t = Date.now()) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Moves every 15 s: runs in progress grow, and "today" changes at midnight. */
const tick = ref(Date.now());
setInterval(() => (tick.value = Date.now()), 15_000);

/** Runs still going (working or waiting for a decision), counted up to now. */
export const liveRuns = computed<HistoryRun[]>(() => {
  const now = tick.value;
  return state.activity
    .filter((r) => r.end === null)
    .map((r) => {
      const blocked = (r.blockedMs ?? 0) + (r.blockedAt ? now - r.blockedAt : 0);
      return {
        id: `${r.paneId}-${r.start}`,
        start: r.start,
        end: now,
        activeMs: Math.max(0, now - r.start - blocked),
        blockedMs: blocked,
        startUnknown: r.startUnknown,
        ws: r.workspace,
        wsId: r.workspaceId,
        tab: r.tab,
        agent: r.name,
        kind: r.kind,
        paneId: r.paneId,
        summary: lastPrompt[r.paneId] && lastPrompt[r.paneId].at >= r.start - 120_000 ? lastPrompt[r.paneId].text : "",
        cost: paneSpend(r.paneId, r.start, now) || undefined,
        closed: false,
        live: true,
        prompts: r.prompts ?? 0,
        decisions: (r.decisions ?? 0),
      };
    });
});

/** Finished and running, most recent first: what the window and the summary show. */
export const allRuns = computed(() => {
  const seen = new Set<string>();
  const out: HistoryRun[] = [];
  for (const r of [...liveRuns.value, ...history.pending, ...history.runs]) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out;
});

/** Today, for the one-line summary of the Agents information window. */
export const todaySummary = computed(() => {
  const from = startOfDay(tick.value);
  const byWs = new Map<string, number>();
  let total = 0;
  let cost = 0;
  for (const r of allRuns.value) {
    if (r.end < from) continue;
    total += r.activeMs;
    cost += r.cost ?? 0;
    byWs.set(r.ws, (byWs.get(r.ws) ?? 0) + r.activeMs);
  }
  return { total, cost, top: [...byWs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3) };
});

export function hm(ms: number): string {
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
}

const csvCell = (v: string | number) => {
  let s = String(v);
  // "- fix tests", "=1+1": Excel would read a formula.
  if (typeof v === "string" && /^[=+\-@]/.test(s)) s = `'${s}`;
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Semicolons: what Excel expects with a French locale. */
export function toCsv(runs: HistoryRun[]): string {
  const d2 = (n: number) => String(n).padStart(2, "0");
  const date = (at: number) => {
    const d = new Date(at);
    return `${d.getFullYear()}-${d2(d.getMonth() + 1)}-${d2(d.getDate())}`;
  };
  const time = (at: number) => {
    const d = new Date(at);
    return `${d2(d.getHours())}:${d2(d.getMinutes())}`;
  };
  const head = [
    "date",
    "start",
    "end",
    "activeMinutes",
    "blockedMinutes",
    "workspace",
    "tab",
    "agent",
    "type",
    "branch",
    "cost",
    "prompts",
    "decisions",
    "summary",
  ].map((column) => t(`historyStore.csv.${column}`));
  const rows = runs.map((r) => [
    date(r.start),
    (r.startUnknown ? "≤ " : "") + time(r.start),
    time(r.end),
    (r.activeMs / 60_000).toFixed(1).replace(".", ","),
    (r.blockedMs / 60_000).toFixed(1).replace(".", ","),
    r.ws,
    r.tab,
    r.agent,
    r.kind,
    r.branch ?? "",
    r.cost != null ? r.cost.toFixed(2).replace(".", ",") : "",
    r.prompts ?? "",
    r.decisions ?? "",
    r.summary,
  ]);
  return [head, ...rows].map((l) => l.map(csvCell).join(";")).join("\n") + "\n";
}

/** Local midnight `days` days before today (DST-safe). */
export function daysAgo(days: number): number {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export interface Kpis {
  cost: number;
  agentMs: number;
  runs: number;
  projects: number;
  prompts: number;
  decisions: number;
  blockedMs: number;
}

export function kpis(list: HistoryRun[]): Kpis {
  const k: Kpis = { cost: 0, agentMs: 0, runs: list.length, projects: new Set(list.map((r) => r.ws)).size, prompts: 0, decisions: 0, blockedMs: 0 };
  for (const r of list) {
    k.cost += r.cost ?? 0;
    k.agentMs += r.activeMs;
    k.prompts += r.prompts ?? 0;
    k.decisions += r.decisions ?? 0;
    k.blockedMs += r.blockedMs;
  }
  return k;
}

// ---- Features, rework, hours, budgets -------------------------------------------

/** "#54" from a branch like "54-fix-login", "feature/54-x", "fix/GL-54", or the consigne. */
export function issueRef(r: Pick<HistoryRun, "branch" | "summary">): string | null {
  const b = r.branch ?? "";
  const m = /(?:^|[/_-])(\d{1,6})(?=[-_/]|$)/.exec(b);
  if (m && !/^\d{4}-\d{2}/.test(b)) return `#${m[1]}`;
  const s = /(?:^|[\s(])([#!]\d{1,6})\b/.exec(r.summary ?? "");
  return s ? s[1] : null;
}

export interface FeatureRow {
  key: string;
  ws: string;
  branch: string;
  ref: string | null;
  ms: number;
  cost: number;
  n: number;
}

/** Time and cost by branch (≈ by feature, issue or MR), within each workspace. */
export function byFeature(list: HistoryRun[]): FeatureRow[] {
  const m = new Map<string, FeatureRow>();
  for (const r of list) {
    const branch = r.branch || t("historyStore.noBranch");
    const key = `${r.ws}\u0000${branch}`;
    const row = m.get(key) ?? { key, ws: r.ws, branch, ref: null, ms: 0, cost: 0, n: 0 };
    row.ms += r.activeMs;
    row.cost += r.cost ?? 0;
    row.n++;
    row.ref ??= issueRef(r);
    m.set(key, row);
  }
  return [...m.values()].sort((a, b) => b.cost - a.cost || b.ms - a.ms);
}

// A consigne that sends the agent back to fix what it just did.
const REWORK =
  /\b(corrig|répar|repar|fix|bug|erreur|error|ne marche|marche pas|fonctionne pas|régression|regression|revert|annule|toujours pas|pas bon|c'?est faux|oubli|mauvais|plante|crash|cass)/i;

/** Runs followed, within the hour and on the same pane, by a consigne asking for a fix. */
export function rework(list: HistoryRun[]): { reworked: number; total: number } {
  const sorted = [...list].sort((a, b) => a.start - b.start);
  let reworked = 0;
  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i];
    const next = sorted.find((x, j) => j > i && x.paneId === r.paneId && x.start >= r.end - 1000);
    if (next && next.start - r.end < 3_600_000 && REWORK.test(next.summary ?? "")) reworked++;
  }
  return { reworked, total: sorted.length };
}

/** Agent time and waiting time by hour of the day (0–23), in ms. */
export function byHour(list: HistoryRun[]): { active: number[]; blocked: number[] } {
  const active = Array.from({ length: 24 }, () => 0);
  const blocked = Array.from({ length: 24 }, () => 0);
  for (const r of list) {
    const span = r.end - r.start;
    if (span <= 0) continue;
    const aRatio = Math.min(1, r.activeMs / span);
    const bRatio = Math.min(1 - aRatio, r.blockedMs / span);
    let t = r.start;
    while (t < r.end) {
      const d = new Date(t);
      const next = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + 1).getTime();
      const slice = Math.min(next, r.end) - t;
      active[d.getHours()] += slice * aRatio;
      blocked[d.getHours()] += slice * bRatio;
      t = next;
    }
  }
  return { active, blocked };
}

/** First day of the current month, local time. */
export function monthStart(t = Date.now()): number {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

/** Spent this calendar month, by workspace label. */
export const monthSpend = computed(() => {
  const from = monthStart(tick.value);
  const m = new Map<string, number>();
  for (const r of allRuns.value) if (r.end >= from && r.cost) m.set(r.ws, (m.get(r.ws) ?? 0) + r.cost);
  return m;
});

export { startOfDay, tick };
