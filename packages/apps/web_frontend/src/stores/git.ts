import { WorkspaceFolders } from './workspace_folders';
// Git state per workspace, and merge requests / pull requests from GitLab or GitHub.
import { computed, reactive, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { allPanes, state as session, workspaces } from "./session";
import { refContext, type Forge } from "../lib/refs";
import { runForgeCli, type ForgeTool } from "../lib/forge_cli";
import { t } from "../i18n/index";

export interface GitStatus {
  root: string;
  branch: string | null;
  upstream: string | null;
  ahead: number;
  behind: number;
  changed: number;
  untracked: number;
  files: { status: string; path: string }[];
  last_sha: string | null;
  last_subject: string | null;
  last_time: number | null;
  remote: string | null;
}

export type Level = "ok" | "warn" | "crit" | "pending" | "muted";

export interface Request {
  ref: string; // "!12" or "#12"
  title: string;
  url: string;
  author: string;
  branch: string;
  draft: boolean;
  state: string; // human label
  level: Level;
  /** Review: approved, changes requested, waiting… */
  review: { label: string; level: Level } | null;
  /** "open", or "merged" / "closed" for the recent ones. */
  status: "open" | "merged" | "closed";
  /** When it was merged / closed / last updated (ms). */
  at: number | null;
  number: number;
  /** Head commit when it was read: the merge is refused if it moved since. */
  sha: string | null;
  target: string;
  squash: boolean;
  removeBranch: boolean;
}

export interface ForgeInfo {
  forge: Forge;
  base: string | null;
  requests: Request[];
  /** Merged or closed in the last days. */
  recent: Request[];
  ci: { label: string; level: Level; url: string | null } | null;
  error: string | null;
  at: number;
}

export const git = reactive({
  /** By workspace id. */
  status: {} as Record<string, GitStatus | null>,
  forge: {} as Record<string, ForgeInfo | undefined>,
  /** Git branch by folder, for the header of each shell pane. */
  branchByFolder: {} as Record<string, string | null>,
  loading: false,
  /** Large Git window: open, and the file shown. */
  modal: { open: false, path: null as string | null },
});

// ---- Merge, after confirmation ------------------------------------------------

export const merging = reactive({
  open: false,
  req: null as Request | null,
  wsId: "",
  forge: "gitlab" as Forge,
  method: "merge" as "merge" | "squash" | "rebase",
  removeBranch: false,
  busy: false,
  error: "",
  result: "",
});

export function askMerge(wsId: string, req: Request) {
  const f = git.forge[wsId];
  Object.assign(merging, {
    open: true,
    req,
    wsId,
    forge: f?.forge ?? "gitlab",
    method: req.squash ? "squash" : "merge",
    removeBranch: req.removeBranch,
    busy: false,
    error: "",
  });
}

export async function confirmMerge(): Promise<boolean> {
  const r = merging.req;
  const root = git.status[merging.wsId]?.root;
  if (!r || !root) return false;
  merging.busy = true;
  merging.error = "";
  try {
    merging.result = await invoke<string>("forge_merge", {
      root,
      forge: merging.forge,
      number: r.number,
      sha: r.sha,
      method: merging.method,
      deleteBranch: merging.removeBranch,
      branch: r.branch,
    });
    merging.open = false;
    await refreshGit(merging.wsId);
    return true;
  } catch (e) {
    merging.error = String(e).split("\n").slice(0, 4).join("\n");
    return false;
  } finally {
    merging.busy = false;
  }
}

export function openGitModal(path: string | null = null) {
  git.modal.path = path;
  git.modal.open = true;
}

/** The fixed workspace folder saved by the desktop application. */
export const workspaceCwd = WorkspaceFolders.get;

/** Reads the Git status of a workspace again. A failure leaves the status empty. */
export async function loadStatus(wsId: string) {
  const cwd = workspaceCwd(wsId);
  if (!cwd) {
    git.status[wsId] = null;
    return;
  }
  try {
    git.status[wsId] = await invoke<GitStatus | null>("git_status", { cwd });
  } catch {
    git.status[wsId] = null;
  }
}

/** Reads the Git branch of a folder, for the header of a shell pane. */
async function loadBranch(folder: string) {
  try {
    const status = await invoke<GitStatus | null>("git_status", { cwd: folder });
    git.branchByFolder[folder] = status?.branch ?? null;
  } catch {
    git.branchByFolder[folder] = null;
  }
}

/** Reads the Git branch of every folder where a shell pane is. */
function loadShellBranches() {
  const folders = new Set<string>();
  for (const pane of allPanes.value) {
    const folder = pane.foreground_cwd || pane.cwd;
    if (pane.agent === null || pane.agent === undefined) {
      if (folder) {
        folders.add(folder);
      }
    }
  }
  for (const folder of folders) {
    loadBranch(folder);
  }
}

/**
 * The reader of `gh` or `glab` of one loading, through the cache of the answers, which keeps each answer for ten
 * minutes (issue #870).
 * @param isRefresh - true to ask the hosting service again, whatever the age of the kept answer
 * @returns the reader
 */
function forgeReader(isRefresh: boolean): (cwd: string, tool: ForgeTool, args: string[]) => Promise<string> {
  return (cwd, tool, args) => runForgeCli("source_control", cwd, tool, args, { isRefresh });
}

// GitLab "detailed_merge_status" → what it means for you (translation key of the label, level).
const GL_STATUS: Record<string, [string, Level]> = {
  mergeable: ["gitStore.state.mergeable", "ok"],
  ci_still_running: ["gitStore.ci.running", "pending"],
  ci_must_pass: ["gitStore.state.ciMustPass", "warn"],
  not_approved: ["gitStore.state.notApproved", "warn"],
  approvals_syncing: ["gitStore.state.approvalsSyncing", "pending"],
  conflict: ["gitStore.state.conflict", "crit"],
  need_rebase: ["gitStore.state.needRebase", "warn"],
  draft_status: ["gitStore.state.draft", "muted"],
  discussions_not_resolved: ["gitStore.state.discussionsNotResolved", "warn"],
  blocked_status: ["gitStore.state.blocked", "crit"],
  checking: ["gitStore.state.checking", "pending"],
  unchecked: ["gitStore.state.unchecked", "muted"],
  not_open: ["gitStore.state.closed", "muted"],
  requested_changes: ["gitStore.review.changesRequested", "crit"],
  jira_association_missing: ["gitStore.state.ticketMissing", "warn"],
  external_status_checks: ["gitStore.state.externalChecks", "pending"],
};

// Pipeline status → translation key of the label, level.
const PIPE: Record<string, [string, Level]> = {
  success: ["gitStore.ci.success", "ok"],
  passed: ["gitStore.ci.success", "ok"],
  failed: ["gitStore.ci.failed", "crit"],
  failure: ["gitStore.ci.failed", "crit"],
  running: ["gitStore.ci.running", "pending"],
  in_progress: ["gitStore.ci.running", "pending"],
  pending: ["gitStore.ci.waiting", "pending"],
  queued: ["gitStore.ci.waiting", "pending"],
  created: ["gitStore.ci.waiting", "pending"],
  canceled: ["gitStore.ci.canceled", "muted"],
  cancelled: ["gitStore.ci.canceled", "muted"],
  skipped: ["gitStore.ci.skipped", "muted"],
  manual: ["gitStore.ci.manual", "warn"],
};

type GlMr = {
  iid: number;
  title: string;
  web_url: string;
  author?: { username?: string };
  source_branch: string;
  draft?: boolean;
  detailed_merge_status?: string;
  has_conflicts?: boolean;
  state?: string;
  sha?: string;
  target_branch?: string;
  squash?: boolean;
  force_remove_source_branch?: boolean;
  should_remove_source_branch?: boolean | null;
  merged_at?: string | null;
  closed_at?: string | null;
  updated_at?: string | null;
};

const time = (s?: string | null) => (s ? Date.parse(s) || null : null);

function glRequest(m: GlMr, status: Request["status"]): Request {
  const [stateKey, level] =
    status === "merged"
      ? (["gitStore.state.merged", "ok"] as [string, Level])
      : status === "closed"
        ? (["gitStore.state.closed", "muted"] as [string, Level])
        : m.has_conflicts
          ? GL_STATUS.conflict
          : GL_STATUS[m.detailed_merge_status ?? ""] ?? [null, "muted" as Level];
  // An unknown GitLab status is shown as it is.
  const state = stateKey !== null ? t(stateKey) : m.detailed_merge_status ?? t("gitStore.state.open");
  return {
    ref: `!${m.iid}`,
    title: m.title,
    url: m.web_url,
    author: m.author?.username ?? "",
    branch: m.source_branch,
    draft: !!m.draft,
    state,
    level,
    review: m.detailed_merge_status === "requested_changes" ? { label: t("gitStore.review.changesRequested"), level: "crit" } : null,
    status,
    at: time(m.merged_at) ?? time(m.closed_at) ?? time(m.updated_at),
    number: m.iid,
    sha: m.sha ?? null,
    target: m.target_branch ?? "",
    squash: !!m.squash,
    removeBranch: !!(m.force_remove_source_branch || m.should_remove_source_branch),
  };
}

async function loadGitlab(
  cwd: string,
  branch: string | null,
  isRefresh: boolean,
): Promise<Pick<ForgeInfo, "requests" | "recent" | "ci">> {
  const cli = forgeReader(isRefresh);
  const list = JSON.parse(
    await cli(cwd, "glab", ["api", "projects/:fullpath/merge_requests?state=opened&per_page=20&order_by=updated_at"]),
  ) as GlMr[];
  const requests = list.map((m) => glRequest(m, "open"));
  // Approvals: one small call per open MR (at most 15, four at a time).
  const queue = requests.slice(0, 15);
  const worker = async () => {
    for (let r = queue.shift(); r; r = queue.shift()) await approvals(r);
  };
  const approvals = async (r: Request) => {
      if (r.review) return;
      try {
        const a = JSON.parse(await cli(cwd, "glab", ["api", `projects/:fullpath/merge_requests/${r.ref.slice(1)}/approvals`])) as {
          approved?: boolean;
          approvals_left?: number;
          approved_by?: { user?: { username?: string } }[];
        };
        const by = a.approved_by ?? [];
        const who = by.map((x) => x.user?.username).filter(Boolean).join(", ");
        // "approved" is also true when the project has no approval rule: only count real approvals.
        if (by.length && !a.approvals_left) r.review = { label: t("gitStore.review.approvedBy", { who }), level: "ok" };
        else if (by.length) r.review = { label: t("gitStore.review.approvals", { count: by.length, left: a.approvals_left ?? 0 }), level: "pending" };
        else if (!r.draft) r.review = { label: t("gitStore.review.waiting"), level: "warn" };
      } catch {
        /* approvals not available on this plan / project */
      }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  let recent: Request[] = [];
  try {
    // The start of the day, and not the current time, so that the arguments, and the key of the cache, stay the same
    // for a day.
    const since = new Date(Math.floor((Date.now() - 7 * 86_400_000) / 86_400_000) * 86_400_000).toISOString();
    const done = JSON.parse(
      await cli(cwd, "glab", ["api", `projects/:fullpath/merge_requests?state=all&updated_after=${encodeURIComponent(since)}&per_page=30&order_by=updated_at`]),
    ) as GlMr[];
    const week = Date.now() - 7 * 86_400_000;
    recent = done
      .filter((m) => (m.state === "merged" || m.state === "closed") && (time(m.merged_at) ?? time(m.closed_at) ?? 0) >= week)
      .map((m) => glRequest(m, m.state === "merged" ? "merged" : "closed"))
      .slice(0, 12);
  } catch {
    /* ignore */
  }
  let ci: ForgeInfo["ci"] = null;
  if (branch) {
    try {
      const p = JSON.parse(
        await cli(cwd, "glab", ["api", `projects/:fullpath/pipelines?ref=${encodeURIComponent(branch)}&per_page=1`]),
      ) as { status: string; web_url: string }[];
      if (p[0]) {
        const known = PIPE[p[0].status];
        ci = known ? { label: t(known[0]), level: known[1], url: p[0].web_url } : { label: p[0].status, level: "muted", url: p[0].web_url };
      }
    } catch {
      /* no CI on this project */
    }
  }
  return { requests, recent, ci };
}

type GhPr = {
  number: number;
  title: string;
  url: string;
  author?: { login?: string };
  headRefName: string;
  isDraft: boolean;
  reviewDecision?: string;
  mergeable?: string;
  statusCheckRollup?: { conclusion?: string; status?: string; state?: string }[];
  state?: string;
  mergedAt?: string | null;
  headRefOid?: string;
  baseRefName?: string;
  closedAt?: string | null;
  updatedAt?: string | null;
};

// GitHub review decision → translation key of the label, level.
const GH_REVIEW: Record<string, { labelKey: string; level: Level }> = {
  APPROVED: { labelKey: "gitStore.review.approved", level: "ok" },
  CHANGES_REQUESTED: { labelKey: "gitStore.review.changesRequested", level: "crit" },
  REVIEW_REQUIRED: { labelKey: "gitStore.review.waiting", level: "warn" },
};

function ghRequest(p: GhPr, status: Request["status"]): Request {
  const checks = p.statusCheckRollup ?? [];
  const failed = checks.some((c) => ["FAILURE", "ERROR", "TIMED_OUT"].includes((c.conclusion || c.state || "").toUpperCase()));
  const running = checks.some((c) => ["IN_PROGRESS", "QUEUED", "PENDING"].includes((c.status || c.state || "").toUpperCase()));
  let stateKey = "gitStore.state.open";
  let level: Level = "muted";
  if (status === "merged") [stateKey, level] = ["gitStore.state.merged", "ok"];
  else if (status === "closed") [stateKey, level] = ["gitStore.state.closed", "muted"];
  else if (p.isDraft) [stateKey, level] = ["gitStore.state.draft", "muted"];
  else if (p.mergeable === "CONFLICTING") [stateKey, level] = ["gitStore.state.conflict", "crit"];
  else if (failed) [stateKey, level] = ["gitStore.ci.failed", "crit"];
  else if (running) [stateKey, level] = ["gitStore.ci.running", "pending"];
  else if (p.mergeable === "MERGEABLE") [stateKey, level] = ["gitStore.state.mergeable", "ok"];
  const state = t(stateKey);
  const reviewDecision = status === "open" ? GH_REVIEW[p.reviewDecision ?? ""] : undefined;
  return {
    ref: `#${p.number}`,
    title: p.title,
    url: p.url,
    author: p.author?.login ?? "",
    branch: p.headRefName,
    draft: p.isDraft,
    state,
    level,
    review: reviewDecision ? { label: t(reviewDecision.labelKey), level: reviewDecision.level } : null,
    status,
    at: time(p.mergedAt) ?? time(p.closedAt) ?? time(p.updatedAt),
    number: p.number,
    sha: p.headRefOid ?? null,
    target: p.baseRefName ?? "",
    squash: false,
    removeBranch: false,
  };
}

const GH_FIELDS =
  "number,title,url,author,headRefName,baseRefName,headRefOid,isDraft,reviewDecision,mergeable,statusCheckRollup,state,mergedAt,closedAt,updatedAt";

async function loadGithub(
  cwd: string,
  branch: string | null,
  isRefresh: boolean,
): Promise<Pick<ForgeInfo, "requests" | "recent" | "ci">> {
  const cli = forgeReader(isRefresh);
  const list = JSON.parse(await cli(cwd, "gh", ["pr", "list", "--limit", "20", "--json", GH_FIELDS])) as GhPr[];
  const requests = list.map((p) => ghRequest(p, "open"));
  let recent: Request[] = [];
  try {
    const week = Date.now() - 7 * 86_400_000;
    const merged = JSON.parse(await cli(cwd, "gh", ["pr", "list", "--state", "merged", "--limit", "10", "--json", GH_FIELDS])) as GhPr[];
    const closed = JSON.parse(await cli(cwd, "gh", ["pr", "list", "--state", "closed", "--limit", "10", "--json", GH_FIELDS])) as GhPr[];
    const seen = new Set<number>();
    recent = [...merged.map((p) => ghRequest(p, "merged")), ...closed.filter((p) => !p.mergedAt).map((p) => ghRequest(p, "closed"))]
      .filter((r) => !seen.has(Number(r.ref.slice(1))) && seen.add(Number(r.ref.slice(1))) && (r.at ?? 0) >= week)
      .sort((a, b) => (b.at ?? 0) - (a.at ?? 0))
      .slice(0, 12);
  } catch {
    /* ignore */
  }
  let ci: ForgeInfo["ci"] = null;
  if (branch) {
    try {
      const runs = JSON.parse(
        await cli(cwd, "gh", ["run", "list", "--branch", branch, "--limit", "1", "--json", "status,conclusion,url"]),
      ) as { status: string; conclusion: string; url: string }[];
      if (runs[0]) {
        const key = runs[0].status === "completed" ? runs[0].conclusion : runs[0].status;
        const known = PIPE[key];
        ci = known ? { label: t(known[0]), level: known[1], url: runs[0].url } : { label: key, level: "muted", url: runs[0].url };
      }
    } catch {
      /* no Actions */
    }
  }
  return { requests, recent, ci };
}

function explain(e: unknown, tool: string): string {
  const s = String(e);
  if (/\b404\b/.test(s)) return t("gitStore.error.projectNotFound");
  if (/\b(401|403)\b|auth login|not logged|unauthorized|token/i.test(s)) return t("gitStore.error.notLoggedIn", { tool });
  if (/command not found|No such file or directory/i.test(s)) return t("gitStore.error.notInstalled", { tool });
  return s.split("\n")[0].slice(0, 200);
}

// Requests can come back out of order: only the latest one per workspace is kept.
const forgeSeq: Record<string, number> = {};

async function loadForge(wsId: string, isRefresh: boolean) {
  const seq = (forgeSeq[wsId] = (forgeSeq[wsId] ?? 0) + 1);
  const st = git.status[wsId];
  const cwd = st?.root;
  if (!cwd || !st?.remote) {
    git.forge[wsId] = undefined;
    return;
  }
  const ctx = await refContext(cwd);
  const forge: Forge = ctx.forge ?? "gitlab";
  const tool = forge === "github" ? "gh" : "glab";
  try {
    const r = forge === "github" ? await loadGithub(cwd, st.branch, isRefresh) : await loadGitlab(cwd, st.branch, isRefresh);
    if (seq === forgeSeq[wsId]) git.forge[wsId] = { forge, base: ctx.base, ...r, error: null, at: Date.now() };
  } catch (e) {
    if (seq === forgeSeq[wsId]) git.forge[wsId] = { forge, base: ctx.base, requests: [], recent: [], ci: null, error: explain(e, tool), at: Date.now() };
  }
}

/**
 * Refresh now (button, or after a Git action), status and forge of the selected workspace.
 * @param wsId - the workspace
 * @param isRefresh - true to ask the hosting service again; false to use an answer of the cache that is at most ten
 * minutes old, when the selected workspace changes
 * @returns nothing
 */
export async function refreshGit(wsId = session.selectedWorkspaceId, isRefresh = true) {
  if (!wsId) return;
  git.loading = true;
  try {
    await loadStatus(wsId);
    await loadForge(wsId, isRefresh);
  } finally {
    git.loading = false;
  }
}

export const currentGit = computed(() => (session.selectedWorkspaceId ? git.status[session.selectedWorkspaceId] ?? null : null));
export const currentForge = computed(() => (session.selectedWorkspaceId ? git.forge[session.selectedWorkspaceId] : undefined));

let started = false;
/**
 * Local status: selected workspace every 10 s, all of them every 60 s (cheap).
 * Forge: selected workspace every 90 s, and when it changes, through the cache: GitHub or GitLab is asked at most every
 * ten minutes, and at once after a click on "Refresh" or a Git action.
 */
export function startGit() {
  if (started) return;
  started = true;
  let tick = 0;
  window.setInterval(() => {
    tick++;
    const sel = session.selectedWorkspaceId;
    if (sel) loadStatus(sel);
    loadShellBranches();
    if (tick % 6 === 0) for (const w of workspaces.value) if (w.workspace_id !== sel) loadStatus(w.workspace_id);
    if (sel && tick % 9 === 0) loadForge(sel, false);
  }, 10_000);
  watch(
    () => [session.selectedWorkspaceId, session.selectedWorkspaceId === null
      ? null : workspaceCwd(session.selectedWorkspaceId)] as const,
    ([id]) => id && refreshGit(id, false),
    { immediate: true },
  );
  watch(
    () => allPanes.value.map((pane) => pane.foreground_cwd || pane.cwd || "").join("\n"),
    () => loadShellBranches(),
    { immediate: true },
  );
  // First pass for the sidebar badges, once panes are known.
  window.setTimeout(() => workspaces.value.forEach((w) => loadStatus(w.workspace_id)), 1500);
}
