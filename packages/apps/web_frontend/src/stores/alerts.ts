// Notifications beyond "blocked" / "finished": an agent left blocked, a context
// nearly full, a quota running out, and an evening summary.
import { watch } from "vue";
import { isQuiet, notify } from "../lib/notify";
import { settings } from "./settings";
import { allPanes, attentionKey, contextFor, paneFullName, quotas, state } from "./session";
import { monthSpend } from "./history";
import { timeOptions } from "../lib/format";
import { locale, t } from "../i18n/index";

const remindedBlocked = new Set<string>(); // attentionKey of the episode
const contextWarned = new Set<string>(); // pane:session
// Persisted: the last quota reading comes back at launch and must not alert again.
const QUOTA_KEY = "heidrun.quota-warned";
const quotaWarned = new Set<string>(
  (() => {
    try {
      return JSON.parse(localStorage.getItem(QUOTA_KEY) ?? "[]") as string[];
    } catch {
      return [];
    }
  })(),
); // window:reset:level

function checkBlocked(now: number) {
  if (isQuiet()) return; // checked again after the quiet hours, nothing is lost
  const limit = settings.notifBlockedMin * 60_000;
  if (!limit) return;
  for (const p of allPanes.value) {
    if (!p.agent || p.agent_status !== "blocked") continue;
    const since = state.since[p.pane_id];
    const key = `${p.pane_id}:${attentionKey(p)}`;
    if (!since || now - since < limit || remindedBlocked.has(key)) continue;
    remindedBlocked.add(key);
    notify(
      "stillBlocked",
      t("alertsStore.stillBlocked.title", { name: paneFullName(p) }),
      t("alertsStore.stillBlocked.body", { minutes: Math.round((now - since) / 60_000) }),
    );
  }
}

function checkContext() {
  if (!settings.notifContext || isQuiet()) return;
  for (const p of allPanes.value) {
    if (!p.agent) continue;
    const ctx = contextFor(p);
    if (!ctx) continue;
    const key = `${p.pane_id}:${p.tokens?.hd_sid ?? ""}`;
    if (ctx.percent >= 80 && !contextWarned.has(key)) {
      contextWarned.add(key);
      notify(
        "context",
        t("alertsStore.context.title", { name: paneFullName(p), percent: Math.round(ctx.percent) }),
        t("alertsStore.context.body"),
      );
    } else if (ctx.percent < 60) {
      contextWarned.delete(key); // after a /compact, warn again next time
    }
  }
}

function checkQuota() {
  if (!settings.notifQuota || isQuiet()) return;
  for (const q of quotas.value) {
    if (q.provider !== "claude") continue;
    for (const w of q.windows) {
      const level = w.percent >= 95 ? 95 : w.percent >= 80 ? 80 : 0;
      if (!level) continue;
      const key = `${w.id}:${w.resetsAt ?? ""}:${level}`;
      if (quotaWarned.has(key)) continue;
      quotaWarned.add(key);
      try {
        localStorage.setItem(QUOTA_KEY, JSON.stringify([...quotaWarned].slice(-50)));
      } catch {
        /* ignore */
      }
      const resetTime = w.resetsAt
        ? new Date(w.resetsAt * 1000).toLocaleTimeString(locale.value, timeOptions())
        : "";
      notify(
        "quota",
        t("alertsStore.quota.title", { name: w.name, percent: Math.round(w.percent) }),
        w.resetsAt ? t("alertsStore.quota.body", { time: resetTime }) : "",
      );
    }
  }
}

// ---- Monthly budget per workspace ---------------------------------------------

const BUDGET_KEY = "heidrun.budget-warned";
const budgetWarned = new Set<string>(
  (() => {
    try {
      return JSON.parse(localStorage.getItem(BUDGET_KEY) ?? "[]") as string[];
    } catch {
      return [];
    }
  })(),
); // month:workspace:level

function checkBudget() {
  if (isQuiet()) return;
  const d = new Date();
  const month = `${d.getFullYear()}-${d.getMonth() + 1}`;
  for (const [ws, budget] of Object.entries(settings.budgets ?? {})) {
    if (!budget || budget <= 0) continue;
    const spent = monthSpend.value.get(ws) ?? 0;
    const level = spent >= budget ? 100 : spent >= budget * 0.8 ? 80 : 0;
    if (!level) continue;
    const key = `${month}:${ws}:${level}`;
    if (budgetWarned.has(key)) continue;
    budgetWarned.add(key);
    try {
      localStorage.setItem(BUDGET_KEY, JSON.stringify([...budgetWarned].slice(-100)));
    } catch {
      /* ignore */
    }
    notify(
      "budget",
      level === 100 ? t("alertsStore.budget.exceeded", { workspace: ws }) : t("alertsStore.budget.nearly", { workspace: ws }),
      t("alertsStore.budget.body", { spent: spent.toFixed(2), budget: budget.toFixed(0) }),
    );
  }
}

// ---- Evening summary: finished work of the day, by workspace -----------------

const DAY_KEY = "heidrun.day";
interface Day {
  date: string;
  done: Record<string, number>; // workspace label → finished runs
  counted: string[]; // "pane:start" of the runs already counted (ids restart at each launch)
  sent: boolean;
}
// Local date: a run finished at 1 a.m. belongs to the new day in France too.
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
function rollDay() {
  if (day.date !== today()) {
    day = { date: today(), done: {}, counted: [], sent: false };
    saveDay();
  }
}

function loadDay(): Day {
  try {
    const d = JSON.parse(localStorage.getItem(DAY_KEY) ?? "null") as Day | null;
    if (d && d.date === today()) return d;
  } catch {
    /* ignore */
  }
  return { date: today(), done: {}, counted: [], sent: false };
}
let day = loadDay();
function saveDay() {
  try {
    localStorage.setItem(DAY_KEY, JSON.stringify(day));
  } catch {
    /* ignore */
  }
}

function countFinished() {
  rollDay();
  let changed = false;
  for (const r of state.activity) {
    const key = `${r.paneId}:${r.start}`;
    if (r.end === null || r.status !== "done" || day.counted.includes(key)) continue;
    day.counted.push(key);
    day.done[r.workspace || "?"] = (day.done[r.workspace || "?"] ?? 0) + 1;
    changed = true;
  }
  if (changed) saveDay();
}

function checkEvening(d: Date) {
  rollDay();
  const m = /^(\d{1,2}):(\d{2})$/.exec(settings.notifEvening.trim());
  if (!m || day.sent || isQuiet(d)) return;
  if (d.getHours() * 60 + d.getMinutes() < Number(m[1]) * 60 + Number(m[2])) return;
  day.sent = true;
  saveDay();
  const parts = Object.entries(day.done).sort((a, b) => b[1] - a[1]);
  const total = parts.reduce((n, [, c]) => n + c, 0);
  notify(
    "evening",
    total ? t("alertsStore.evening.title", { count: total }) : t("alertsStore.evening.none"),
    parts.map(([w, c]) => `${w} : ${c}`).join(" · "),
  );
}

let started = false;
export function startAlerts() {
  if (started) return;
  started = true;
  watch(() => state.activity.map((r) => `${r.id}:${r.end ?? ""}`).join(","), countFinished);
  window.setInterval(() => {
    const now = new Date();
    checkBlocked(now.getTime());
    checkContext();
    checkQuota();
    checkBudget();
    checkEvening(now);
  }, 30_000);
}
