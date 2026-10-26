import type { AgentInfo, AgentStatus, CodexUsage, LimitWindow, PaneInfo, QuotaBlock } from "./types";
import { locale, t } from "../i18n/index";
import { settings } from "../stores/settings";
import { FileViewLabel } from "./file_view_label";
import { DiffPaneLabel } from "./diff_pane_label";

/** The text of an agent status, in the language in use. */
export function statusLabel(status: AgentStatus): string {
  return t(`format.status.${status}`);
}

/**
 * The name a pane has without a name set by a person. An idle shell has the terminal title `user@host:folder`, which
 * repeats the user, the host and the folder, so it is named after its folder. When a command runs, the terminal title
 * names that command, and the pane keeps it.
 */
export function paneDynamicName(p: PaneInfo | AgentInfo): string {
  const name = (p as AgentInfo).name;
  if (name || p.display_agent || p.agent) {
    return name || p.display_agent || p.agent || "";
  }
  const folder = p.foreground_cwd || p.cwd || "";
  const title = p.terminal_title_stripped ?? "";
  const isIdleShellTitle = title === "" || title.endsWith(`:${folder}`) || title.endsWith(`:${shortPath(folder)}`);
  if (folder !== "" && isIdleShellTitle) {
    const folderName = folder.split("/").filter((part) => part !== "").pop();
    if (folderName !== undefined) {
      return folderName;
    }
  }
  return title || "shell";
}

export function paneName(p: PaneInfo | AgentInfo): string {
  return FileViewLabel.fileName(p.label) ?? DiffPaneLabel.fileName(p.label) ?? (p.label || paneDynamicName(p));
}

export function isAgent(p: PaneInfo): boolean {
  return !!p.agent;
}

export function shortPath(path?: string | null): string {
  if (!path) return "";
  return path.replace(/^\/Users\/[^/]+/, "~").replace(/^\/home\/[^/]+/, "~");
}

/** The hour and minute options of the browser date functions, following the time format of the settings. */
export function timeOptions(): Intl.DateTimeFormatOptions {
  const options: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
  if (settings.timeFormat !== "auto") {
    options.hour12 = settings.timeFormat === "12h";
  }
  return options;
}

export function clockTime(epochSeconds?: number | null): string {
  if (!epochSeconds) return "";
  const d = new Date(epochSeconds * 1000);
  const now = new Date();
  const time = d.toLocaleTimeString(locale.value, timeOptions());
  if (d.toDateString() === now.toDateString()) return time;
  const day = d.toLocaleDateString(locale.value, { weekday: "short" });
  return `${day} ${time}`;
}

export function ago(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return t("format.justNow");
  const m = Math.round(s / 60);
  if (m < 60) return t("format.minutesAgo", { minutes: m });
  return t("format.hoursAgo", { hours: Math.round(m / 60) });
}

export function compactTokens(n?: number | null): string {
  if (n == null) return "";
  return n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);
}

/** Colour level of a gauge: calm, watch, critical. */
export function gaugeLevel(percent: number): "ok" | "warn" | "crit" {
  if (percent > 80) return "crit";
  if (percent >= 60) return "warn";
  return "ok";
}

/** The kind of coding agent, whatever the pane is called. */
export function agentKind(p: Pick<PaneInfo, "agent" | "display_agent">): string {
  const a = (p.agent ?? "").toLowerCase();
  if (a.includes("claude")) return "Claude";
  if (a.includes("codex")) return "Codex";
  if (a.includes("agy") || a.includes("antigravity")) return "Antigravity";
  return p.display_agent || p.agent || "Terminal";
}

/** 45 s → "< 1 min", 7 min, 1 h 05 */
export function duration(ms: number): string {
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "< 1 min";
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
}

const WEEK_WINDOW_MINUTES = 10080;

/**
 * The quota windows of Codex, named by their length and not by their position: since Sept 2026 some plans
 * report only the weekly window, and Codex then puts it in `primary`.
 * A window without a length keeps the old meaning of its position (`primary` is the session, `secondary` is the week).
 * A window whose reset time has passed is back to 0 %, until Codex reports again.
 */
export function codexWindows(codex: Pick<CodexUsage, "primary" | "secondary">, nowSeconds: number): QuotaBlock["windows"] {
  const windows: QuotaBlock["windows"] = [];
  const add = (window: LimitWindow | null | undefined, fallbackId: "session" | "week") => {
    if (window == null) return;
    const minutes = window.window_minutes ?? null;
    const id = minutes === null ? fallbackId : minutes >= WEEK_WINDOW_MINUTES ? "week" : "session";
    if (windows.some((w) => w.id === id)) return;
    const resetsAt = window.resets_at ?? undefined;
    const percent = resetsAt !== undefined && resetsAt < nowSeconds ? 0 : window.used_percent;
    windows.push({ id, name: t(id === "week" ? "sessionStore.window.week" : "sessionStore.window.session"), percent, resetsAt });
  };
  add(codex.primary, "session");
  add(codex.secondary, "week");
  return windows.sort((a, b) => (a.id === b.id ? 0 : a.id === "session" ? -1 : 1));
}

/** The window the ring of a quota shows: the week when there is one, else the first window. */
export function quotaRingWindow(windows: QuotaBlock["windows"]): QuotaBlock["windows"][number] | undefined {
  return windows.find((w) => w.period === "week" || w.id === "week") ?? windows[0];
}

/** Length of each quota window, in seconds. */
const WINDOW_SECONDS = { session: 300 * 60, week: 10080 * 60 };

/** Below this share of the window elapsed, the pace is too uncertain to show. */
const MIN_ELAPSED_PERCENT = 5;

/** How fast a quota window is being used, compared with the speed that lasts exactly until its reset. */
export type QuotaPace = {
  /** Share of the window already elapsed, counting working time only, from 0 to 100. */
  elapsedPercent: number;
  /** Usage divided by elapsed time, in percent: 100 uses the whole quota exactly at the reset. */
  pacePercent: number;
  /** Colour level: calm below 90, watch from 90 to 100, critical above 100. */
  level: "ok" | "warn" | "crit";
  /** Usage reached at the reset if the pace stays the same, not capped. */
  projectedPercent: number;
  /** Epoch seconds when the quota runs out, only when it runs out before the reset. */
  runsOutAt?: number;
  /** How much less to use, in percent, to last until the reset, only when the pace is over 100. */
  reducePercent?: number;
  /** Usage so far, in percent of the quota per hour. */
  currentPerHour: number;
  /** Usage speed that lasts exactly until the reset, in percent of the quota per hour. */
  allowedPerHour: number;
};

/** Every day of the week, numbered like `Date.getDay()`: 0 is Sunday. */
export const ALL_DAYS: readonly number[] = [0, 1, 2, 3, 4, 5, 6];

/** Start of the next local calendar day after `epochSeconds`, in epoch seconds. */
function nextMidnight(epochSeconds: number): number {
  const d = new Date(epochSeconds * 1000);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime() / 1000;
}

/** Seconds between `fromSeconds` and `toSeconds` that fall on one of the working days, in local time. */
export function workingSeconds(fromSeconds: number, toSeconds: number, workingDays: readonly number[]): number {
  let total = 0;
  let cursor = fromSeconds;
  while (cursor < toSeconds) {
    const end = Math.min(toSeconds, nextMidnight(cursor));
    if (workingDays.includes(new Date(cursor * 1000).getDay())) {
      total += end - cursor;
    }
    cursor = end;
  }
  return total;
}

/**
 * The moment when `neededSeconds` of working time have passed since `fromSeconds`,
 * or null when that moment is after `limitSeconds`.
 */
export function advanceWorking(
  fromSeconds: number,
  neededSeconds: number,
  workingDays: readonly number[],
  limitSeconds: number,
): number | null {
  let remaining = neededSeconds;
  let cursor = fromSeconds;
  while (cursor < limitSeconds) {
    const end = Math.min(limitSeconds, nextMidnight(cursor));
    if (workingDays.includes(new Date(cursor * 1000).getDay())) {
      if (end - cursor >= remaining) {
        return cursor + remaining;
      }
      remaining -= end - cursor;
    }
    cursor = end;
  }
  return null;
}

/**
 * The pace of a quota window at a given time, or null when it cannot be known:
 * the reset time is missing or past, or the window just started.
 * The weekly window counts only the time on `workingDays`; the 5-hour window counts all the time.
 */
export function quotaPace(
  window: QuotaBlock["windows"][number],
  nowSeconds: number,
  workingDays: readonly number[] = ALL_DAYS,
): QuotaPace | null {
  if (window.resetsAt === undefined || window.resetsAt <= nowSeconds) return null;
  const period = window.period ?? (window.id === "week" ? "week" : "session");
  const lengthSeconds = window.windowMinutes == null ? WINDOW_SECONDS[period] : window.windowMinutes * 60;
  const start = window.resetsAt - lengthSeconds;
  const days = period === "week" && workingDays.length > 0 ? workingDays : ALL_DAYS;
  const total = workingSeconds(start, window.resetsAt, days);
  const elapsed = workingSeconds(start, nowSeconds, days);
  if (total === 0) return null;
  const elapsedPercent = (elapsed / total) * 100;
  if (elapsedPercent < MIN_ELAPSED_PERCENT) return null;
  const pacePercent = (window.percent / elapsedPercent) * 100;
  const level = pacePercent > 100 ? "crit" : pacePercent >= 90 ? "warn" : "ok";
  const hoursLeft = (total - elapsed) / 3600;
  const pace: QuotaPace = {
    elapsedPercent,
    pacePercent,
    level,
    projectedPercent: pacePercent,
    currentPerHour: window.percent / (elapsed / 3600),
    allowedPerHour: hoursLeft > 0 ? Math.max(0, 100 - window.percent) / hoursLeft : 0,
  };
  if (pacePercent > 100) {
    const needed = ((100 - window.percent) / window.percent) * elapsed;
    pace.runsOutAt = advanceWorking(nowSeconds, needed, days, window.resetsAt) ?? undefined;
    pace.reducePercent = (1 - 100 / pacePercent) * 100;
  }
  return pace;
}

/** A speed in percent per hour, with one decimal below 10 and none above. */
export function perHour(value: number): string {
  return value < 10 ? value.toFixed(1) : String(Math.round(value));
}
