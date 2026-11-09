// In-app preview of an issue / MR / PR (description and comments, rendered).
import { reactive } from "vue";
import { runForgeCli } from "../lib/forge_cli";
import { refContext, type Forge, type RefTarget } from "../lib/refs";
import { loadMergeFacts, type MergeFacts } from "./pull_request_merge";
import { t } from "../i18n/index";

export interface IssueComment {
  author: string;
  at: number | null;
  body: string;
}

export interface IssueData {
  ref: string;
  title: string;
  state: string;
  stateLevel: "ok" | "muted" | "merged" | "crit";
  author: string;
  at: number | null;
  labels: string[];
  url: string;
  /** Web page of the project, for relative links in the body. */
  project: string;
  forge: "GitLab" | "GitHub";
  body: string;
  branches: string | null;
  comments: IssueComment[];
}

export const issueView = reactive({
  open: false,
  loading: false,
  error: "",
  url: null as string | null,
  data: null as IssueData | null,
  /**
   * What the merge bar of a pull request or of a merge request of the repository of the workspace needs, or null for an
   * issue, for an item of another repository, or when the hosting service did not answer (issue #570).
   */
  merge: null as { folder: string; forge: Forge; number: number; webBase: string; facts: MergeFacts } | null,
});

// Through the cache of the answers, which keeps each answer for ten minutes (issue #870).
const cli = (cwd: string, tool: "glab" | "gh", args: string[]) => runForgeCli("issue_preview", cwd, tool, args);
const time = (s?: string | null) => (s ? Date.parse(s) || null : null);

// Forge state → translation key of the label, level.
const STATE: Record<string, [string, IssueData["stateLevel"]]> = {
  opened: ["issuesStore.state.open", "ok"],
  open: ["issuesStore.state.open", "ok"],
  closed: ["issuesStore.state.closed", "muted"],
  merged: ["issuesStore.state.merged", "merged"],
  locked: ["issuesStore.state.locked", "muted"],
};

/** The shown label and the level of a forge state (an unknown state is shown as it is). */
export function stateOf(raw: string): [string, IssueData["stateLevel"]] {
  const known = STATE[raw];
  return known ? [t(known[0]), known[1]] : [raw, "muted"];
}

async function gitlab(cwd: string, type: "issue" | "mr", n: number, project?: string): Promise<IssueData> {
  const base = project ? `projects/${encodeURIComponent(project)}` : "projects/:fullpath";
  const kind = type === "mr" ? "merge_requests" : "issues";
  const it = JSON.parse(await cli(cwd, "glab", ["api", `${base}/${kind}/${n}`])) as {
    title: string;
    description?: string | null;
    state: string;
    author?: { username?: string };
    created_at?: string;
    labels?: string[];
    web_url: string;
    source_branch?: string;
    target_branch?: string;
  };
  let notes: { body: string; author?: { username?: string }; created_at?: string; system?: boolean }[] = [];
  try {
    notes = JSON.parse(await cli(cwd, "glab", ["api", `${base}/${kind}/${n}/notes?sort=asc&order_by=created_at&per_page=100`]));
    if (notes.length === 100) notes.push({ body: t("issuesStore.moreComments"), system: false });
  } catch {
    /* comments are optional */
  }
  const [state, stateLevel] = stateOf(it.state);
  return {
    ref: `${project ?? ""}${type === "mr" ? "!" : "#"}${n}`,
    title: it.title,
    state,
    stateLevel,
    author: it.author?.username ?? "",
    at: time(it.created_at),
    labels: it.labels ?? [],
    url: it.web_url,
    project: it.web_url.replace(/\/-\/(issues|merge_requests)\/\d+.*$/, ""),
    forge: "GitLab",
    body: it.description ?? "",
    branches: it.source_branch ? `${it.source_branch} → ${it.target_branch ?? ""}` : null,
    // System notes ("changed the description", "added label") are noise here.
    comments: notes.filter((c) => !c.system).map((c) => ({ author: c.author?.username ?? "", at: time(c.created_at), body: c.body })),
  };
}

async function github(cwd: string, type: "issue" | "mr", n: number, project?: string): Promise<IssueData> {
  const fields = type === "mr" ? "title,body,state,author,labels,comments,url,createdAt,headRefName,baseRefName" : "title,body,state,author,labels,comments,url,createdAt";
  const args = [type === "mr" ? "pr" : "issue", "view", String(n), "--json", fields];
  if (project) args.push("--repo", project);
  let it: {
    title: string;
    body?: string;
    state: string;
    author?: { login?: string };
    labels?: { name: string }[];
    comments?: { author?: { login?: string }; body: string; createdAt?: string }[];
    url: string;
    createdAt?: string;
    headRefName?: string;
    baseRefName?: string;
  };
  try {
    it = JSON.parse(await cli(cwd, "gh", args));
  } catch (e) {
    // "#12" on GitHub may be a pull request: try that, but only when the issue really isn't found
    // (an auth or network error would just fail twice).
    if (type !== "issue" || !/could not resolve|not found|pull request/i.test(String(e))) throw e;
    return github(cwd, "mr", n, project);
  }
  const [state, stateLevel] = stateOf(it.state.toLowerCase());
  return {
    ref: `${project ?? ""}#${n}`,
    title: it.title,
    state,
    stateLevel,
    author: it.author?.login ?? "",
    at: time(it.createdAt),
    labels: (it.labels ?? []).map((l) => l.name),
    url: it.url,
    project: it.url.replace(/\/(issues|pull)\/\d+.*$/, ""),
    forge: "GitHub",
    body: it.body ?? "",
    branches: it.headRefName ? `${it.headRefName} → ${it.baseRefName ?? ""}` : null,
    comments: (it.comments ?? []).map((c) => ({ author: c.author?.login ?? "", at: time(c.createdAt), body: c.body })),
  };
}

let seq = 0;
/**
 * Opens the preview window and loads the issue / MR. The repository and the forge are the ones the text names (`target.project`,
 * `target.forge`), else the ones of the repo of `cwd`.
 */
export async function openIssue(cwd: string | null | undefined, target: RefTarget, url: string | null) {
  Object.assign(issueView, { open: true, loading: true, error: "", url, data: null, merge: null });
  const my = ++seq;
  try {
    if (!cwd) throw new Error(t("issuesStore.unknownFolder"));
    const ctx = await refContext(cwd);
    const forge: Forge = target.forge ?? ctx.forge ?? "gitlab";
    // The merge runs in the repository of the workspace: an item of another repository shows no merge bar.
    const isMergeable = target.type === "mr" && target.project === undefined && ctx.base !== null;
    const [data, facts] = await Promise.all([
      forge === "github" ? github(cwd, target.type, target.number, target.project) : gitlab(cwd, target.type, target.number, target.project),
      isMergeable ? loadMergeFacts(cwd, forge, target.number).catch(() => null) : Promise.resolve(null),
    ]);
    if (my === seq) {
      issueView.data = data;
      issueView.merge = facts === null ? null : { folder: cwd, forge, number: target.number, webBase: ctx.base ?? "", facts };
    }
  } catch (e) {
    if (my === seq) issueView.error = String(e).split("\n")[0].slice(0, 300);
  } finally {
    if (my === seq) issueView.loading = false;
  }
}
