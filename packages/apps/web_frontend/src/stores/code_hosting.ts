// The Code hosting sidebar section: the open issues, and the open pull requests (GitHub) or merge requests (GitLab), of
// the repository of the selected workspace. They are read with `gh` or `glab` through the Tauri command
// `forge_cli_cached`, which keeps each answer on the disk until a refresh: only a refresh asks the hosting service again,
// because each call takes points of the GitHub rate limit.
// Each list has its own search, its own status, and its own failure: `gh` takes a search as it is, and for GitLab it is
// translated into filters.
// - issue #370
// - issue #374
// - issue #378
// - issue #607
// - issue #869
// - issue #870
// - issue #890
// - issue #910
import { reactive } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { runForgeCli, runForgeCliWithSource } from "../lib/forge_cli";
import { t } from "../i18n/index";
import { clockTime } from "../lib/format";
import {
  githubSearchArguments,
  githubState,
  translateForGitlab,
  usesCurrentUser,
  type GitlabTranslation,
} from "../lib/code_hosting_search";
import { refContext, type Forge, type RefContext } from "../lib/refs";
import type { ChatReferenceLabel } from "./chat_references";

/**
 * The most items that one list reads from GitHub or GitLab. A list that reaches it may hold more items. The sidebar
 * section shows about 30 rows, and a smaller list takes fewer points of the GitHub rate limit (issue #910).
 */
export const CODE_HOSTING_LIMIT = 30;

/** The two lists of the Code hosting sidebar section: the issues, and the pull requests or merge requests. */
export type CodeHostingGroup = "issues" | "requests";

/** One row of a list: one issue, one pull request, or one merge request. */
export type CodeHostingItem = {
  /** The number of the item on GitHub or GitLab. */
  number: number;
  /** The title of the item. */
  title: string;
  /** The address of the web page of the item. */
  url: string;
  /** The login of the person who opened the item, or null. */
  author: string | null;
  /** The date of the creation, in milliseconds since 1970, or null. */
  createdAt: number | null;
  /** The labels of an issue, with their colors. A pull request or a merge request has none here. */
  labels: ChatReferenceLabel[];
  /** True for a draft pull request or a draft merge request. */
  isDraft: boolean;
  /** The branch that holds the changes of a pull request or of a merge request, or null for an issue. */
  headBranch: string | null;
  /** The branch that receives the changes of a pull request or of a merge request, or null for an issue. */
  baseBranch: string | null;
};

/**
 * What the sidebar section shows: "idle" before the first load, "loading" while the remote address is read, "ready"
 * when the two lists can show, "noRemote" for a repository without a remote address, and "failed" when the remote
 * address cannot be read.
 */
export type CodeHostingStatus = "idle" | "loading" | "ready" | "noRemote" | "failed";

/** What one list shows: "idle" before its first load, then "loading", "ready", or "failed". */
export type CodeHostingListStatus = "idle" | "loading" | "ready" | "failed";

/** The state of the Code hosting sidebar section. */
export const codeHosting = reactive({
  /** The open issues. */
  issues: [] as CodeHostingItem[],
  /** The open pull requests (GitHub) or merge requests (GitLab). */
  requests: [] as CodeHostingItem[],
  /** The hosting service of the repository, or null when it is not known yet. */
  forge: null as Forge | null,
  /** The address of the repository on its hosting service, or null when it is not known yet. */
  webBase: null as string | null,
  /** The search of each list, in the search language of GitHub. Empty: no search. */
  search: { issues: "", requests: "" } as Record<CodeHostingGroup, string>,
  /** What the sidebar section shows. */
  status: "idle" as CodeHostingStatus,
  /** What each list shows. */
  listStatus: { issues: "idle", requests: "idle" } as Record<CodeHostingGroup, CodeHostingListStatus>,
  /** The first line of the failure of `gh` or `glab` for the remote address, or an empty text. */
  error: "",
  /** The first line of the failure of `gh` or `glab` for each list, or an empty text. */
  listError: { issues: "", requests: "" } as Record<CodeHostingGroup, string>,
  /**
   * For each list, the message that says that the refresh failed and that the list is the kept answer, with its time,
   * or an empty text.
   */
  listNotice: { issues: "", requests: "" } as Record<CodeHostingGroup, string>,
  /** The lists that are folded. */
  folded: { issues: false, requests: false } as Record<CodeHostingGroup, boolean>,
});

/** The two lists, from the top. */
export const CODE_HOSTING_GROUPS: CodeHostingGroup[] = ["issues", "requests"];

/**
 * The hosting service of a repository, from its remote address. A host that is not GitHub is read as GitLab, as
 * everywhere else.
 * @param context - the context of the folder of the repository
 * @returns the hosting service, or null when the repository has no remote address
 */
export function forgeOfContext(context: RefContext): Forge | null {
  if (context.base === null) {
    return null;
  }
  return context.forge ?? "gitlab";
}

/**
 * Reads the hosting service of the repository of a folder, for the icon of the Code hosting sidebar section. It reads
 * the remote address only: no call to `gh` or `glab`, and no network call.
 * @param folder - the root folder of the Git repository of the selected workspace, or null when there is none
 * @returns the hosting service, or null when it is not known
 */
export async function readCodeHostingForge(folder: string | null): Promise<Forge | null> {
  if (folder === null) {
    return null;
  }
  try {
    return forgeOfContext(await refContext(folder));
  } catch {
    return null;
  }
}

/** The number of the last load: an older load that ends later does not replace the lists. */
let lastLoad = 0;

/** The number of the last load of each list: an older load of a list that ends later does not replace its items. */
const lastListLoad: Record<CodeHostingGroup, number> = { issues: 0, requests: 0 };

/** The failure of a search that GitLab cannot do. Its message is shown as it is, and says the word. */
class CodeHostingSearchError extends Error {}

/** A kept answer that replaced a failure of `gh` or `glab` during a refresh. */
type KeptAfterFailure = {
  /** The failure of the call. */
  failure: string;
  /** When the hosting service gave the kept answer, in milliseconds since 1970. */
  keptAt: number;
};

/** What `gh issue list` and `gh pr list` print for one item. */
type GithubItem = {
  number: number;
  title: string;
  url: string;
  author?: { login?: string } | null;
  createdAt?: string;
  labels?: { name: string; color?: string }[];
  isDraft?: boolean;
  headRefName?: string;
  baseRefName?: string;
};

/** What the API of GitLab gives for one issue or one merge request. */
type GitlabItem = {
  iid: number;
  title: string;
  web_url: string;
  author?: { username?: string } | null;
  created_at?: string;
  labels?: (string | { name: string; color?: string })[];
  draft?: boolean;
  source_branch?: string;
  target_branch?: string;
};

/** The fields that `gh issue list` prints for each issue. */
const GITHUB_ISSUE_FIELDS = "number,title,url,author,createdAt,labels";

/** The fields that `gh pr list` prints for each pull request. */
const GITHUB_PULL_REQUEST_FIELDS = "number,title,url,author,createdAt,isDraft,headRefName,baseRefName";

/**
 * The time of a date in the text that a hosting service gives.
 * @param text - the date, or nothing
 * @returns the time in milliseconds since 1970, or null
 */
function timeOf(text: string | undefined): number | null {
  return text === undefined ? null : Date.parse(text) || null;
}

/**
 * The row of an item that `gh` printed.
 * @param item - the item
 * @returns the row
 */
function itemOfGithub(item: GithubItem): CodeHostingItem {
  return {
    number: item.number,
    title: item.title,
    url: item.url,
    author: item.author?.login ?? null,
    createdAt: timeOf(item.createdAt),
    labels: (item.labels ?? []).map((label) => ({ name: label.name, color: label.color ?? null })),
    isDraft: item.isDraft === true,
    headBranch: item.headRefName ?? null,
    baseBranch: item.baseRefName ?? null,
  };
}

/**
 * The label that the API of GitLab gave. With the parameter `with_labels_details`, a label is an object with its color
 * as `#rrggbb`. Without it, a label is its name.
 * @param label - the name of the label, or the label with its details
 * @returns the label, with the color as six hexadecimal digits without `#`
 */
function labelOfGitlab(label: string | { name: string; color?: string }): ChatReferenceLabel {
  if (typeof label === "string") {
    return { name: label, color: null };
  }
  return { name: label.name, color: label.color === undefined ? null : label.color.replace(/^#/, "") };
}

/**
 * The row of an item that the API of GitLab gave.
 * @param item - the item
 * @returns the row
 */
function itemOfGitlab(item: GitlabItem): CodeHostingItem {
  return {
    number: item.iid,
    title: item.title,
    url: item.web_url,
    author: item.author?.username ?? null,
    createdAt: timeOf(item.created_at),
    labels: (item.labels ?? []).map(labelOfGitlab),
    isDraft: item.draft === true,
    headBranch: item.source_branch ?? null,
    baseBranch: item.target_branch ?? null,
  };
}

/**
 * Runs `gh` or `glab` in a folder of the repository, through the cache of the answers. The kept answer is used whatever
 * its age, until a refresh. When a refresh fails and the kept answer replaces the failure, the failure and the time of
 * the kept answer go into `keptFailures`.
 * @param folder - the folder of the repository
 * @param tool - the command line tool of the hosting service
 * @param args - the arguments of the tool
 * @param isRefresh - true to ask the hosting service again even when an answer is kept
 * @param keptFailures - receives each kept answer that replaced a failure
 * @returns what the tool printed, or the kept answer
 */
async function runForge(
  folder: string,
  tool: "gh" | "glab",
  args: string[],
  isRefresh: boolean,
  keptFailures: KeptAfterFailure[],
): Promise<string> {
  const options = { isRefresh, isKeptUntilRefresh: true };
  if (isRefresh === false) {
    return runForgeCli("code_hosting_list", folder, tool, args, options);
  }
  const answer = await runForgeCliWithSource("code_hosting_list", folder, tool, args, options);
  if (answer.failure !== null && answer.keptAt !== null) {
    keptFailures.push({ failure: answer.failure, keptAt: answer.keptAt });
  }
  return answer.output;
}

/**
 * Reads the open issues or the open pull requests of a repository on GitHub. A search goes to `gh` as it is.
 * @param folder - the folder of the repository
 * @param group - the list to read
 * @param isRefresh - true to ask GitHub again even when a fresh answer is kept
 * @param search - the search of this list, or an empty text for no search
 * @param keptFailures - receives each kept answer that replaced a failure
 * @returns the items of the list
 */
async function readGithubList(
  folder: string,
  group: CodeHostingGroup,
  isRefresh: boolean,
  search: string,
  keptFailures: KeptAfterFailure[],
): Promise<CodeHostingItem[]> {
  const common = [
    "--state",
    githubState(search),
    "--limit",
    String(CODE_HOSTING_LIMIT),
    ...githubSearchArguments(search),
    "--json",
  ];
  const args =
    group === "issues"
      ? ["issue", "list", ...common, GITHUB_ISSUE_FIELDS]
      : ["pr", "list", ...common, GITHUB_PULL_REQUEST_FIELDS];
  return (JSON.parse(await runForge(folder, "gh", args, isRefresh, keptFailures)) as GithubItem[]).map(itemOfGithub);
}

/**
 * Reads the login of the person who is signed in to `glab`.
 * @param folder - the folder of the repository
 * @param isRefresh - true to ask GitLab again even when a fresh answer is kept
 * @param keptFailures - receives each kept answer that replaced a failure
 * @returns the login
 */
async function readGitlabLogin(folder: string, isRefresh: boolean, keptFailures: KeptAfterFailure[]): Promise<string> {
  const answer = await runForge(folder, "glab", ["api", "user"], isRefresh, keptFailures);
  const user = JSON.parse(answer) as { username?: string };
  if (user.username === undefined) {
    throw new Error("glab api user: no username");
  }
  return user.username;
}

/**
 * Reads one list of a repository on GitLab.
 * @param folder - the folder of the repository
 * @param isRefresh - true to ask GitLab again even when a fresh answer is kept
 * @param path - the part of the address after the project: "issues" or "merge_requests"
 * @param translation - the filters of the search for this list
 * @param keptFailures - receives each kept answer that replaced a failure
 * @returns the items, none when the search leaves nothing in this list
 */
async function readGitlabList(
  folder: string,
  isRefresh: boolean,
  path: "issues" | "merge_requests",
  translation: GitlabTranslation,
  keptFailures: KeptAfterFailure[],
): Promise<CodeHostingItem[]> {
  if (translation.kind !== "filters") {
    return [];
  }
  const parameters = [...translation.parameters, `per_page=${CODE_HOSTING_LIMIT}`];
  if (path === "issues") {
    parameters.push("with_labels_details=true");
  }
  const address = `projects/:fullpath/${path}?${parameters.join("&")}`;
  const answer = await runForge(folder, "glab", ["api", address], isRefresh, keptFailures);
  return (JSON.parse(answer) as GitlabItem[]).map(itemOfGitlab);
}

/**
 * Reads the open issues or the open merge requests of a repository on GitLab. GitLab has no search language, so the
 * search is translated into filters. A word that GitLab cannot do stops the reading, with a message that names it.
 * @param folder - the folder of the repository
 * @param group - the list to read
 * @param isRefresh - true to ask GitLab again even when a fresh answer is kept
 * @param search - the search of this list, or an empty text for no search
 * @param keptFailures - receives each kept answer that replaced a failure
 * @returns the items of the list
 */
async function readGitlabGroup(
  folder: string,
  group: CodeHostingGroup,
  isRefresh: boolean,
  search: string,
  keptFailures: KeptAfterFailure[],
): Promise<CodeHostingItem[]> {
  // A first translation with a made-up login finds a word that GitLab cannot do before `glab` is asked for the login.
  const firstTranslation = translateForGitlab(group, search, "login");
  if (firstTranslation.kind === "cannot") {
    throw new CodeHostingSearchError(t("codeHostingPanel.gitlabCannot", { word: firstTranslation.word }));
  }
  const login = usesCurrentUser(search) ? await readGitlabLogin(folder, isRefresh, keptFailures) : null;
  const translation = translateForGitlab(group, search, login);
  const path = group === "issues" ? "issues" : "merge_requests";
  return readGitlabList(folder, isRefresh, path, translation, keptFailures);
}

/**
 * The message of a failure of `gh` that says the GitHub rate limit is exceeded, with the local time of the reset. The
 * secondary rate limit of GitHub leaves points in `gh api rate_limit`, so its reset time is unknown, and the message
 * then says to try again in a few minutes (issue #910).
 * @param folder - the folder of the repository
 * @param message - the first line of the failure
 * @returns the message, or null when the failure is not a rate limit
 */
async function githubRateLimitMessage(folder: string, message: string): Promise<string | null> {
  if (/rate limit/i.test(message) === false) {
    return null;
  }
  try {
    const reset = await invoke<number | null>("forge_rate_limit_reset", { cwd: folder });
    if (reset !== null) {
      return t("codeHostingPanel.rateLimit", { time: clockTime(reset) });
    }
  } catch {
    // The reset time cannot be read: the message without a time follows.
  }
  return t("codeHostingPanel.rateLimitUnknown");
}

/**
 * The age of a kept answer, with one unit: "less than a minute", "5 minutes", "26 hours", "3 days". Hours are used up
 * to 48 hours, so that an answer from yesterday does not read as "1 day" (issue #910).
 * @param keptAt - the time of the kept answer, in milliseconds since 1970
 * @param now - the present time, in milliseconds since 1970
 * @returns the text
 */
export function keptAgeText(keptAt: number, now: number): string {
  const minutes = Math.floor(Math.max(0, now - keptAt) / 60_000);
  if (minutes < 1) {
    return t("codeHostingPanel.keptAge.lessThanMinute");
  }
  if (minutes < 60) {
    return t("codeHostingPanel.keptAge.minutes", { count: minutes });
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    return t("codeHostingPanel.keptAge.hours", { count: hours });
  }
  return t("codeHostingPanel.keptAge.days", { count: Math.floor(hours / 24) });
}

/**
 * The message that says that a refresh failed and that the list shows the kept answer, with the age and the time of
 * the oldest kept answer and the first line of the first failure.
 * @param folder - the folder of the repository
 * @param forge - the hosting service of the repository
 * @param keptFailures - the kept answers that replaced a failure, at least one
 * @returns the message
 */
async function keptAfterFailureNotice(folder: string, forge: Forge, keptFailures: KeptAfterFailure[]): Promise<string> {
  const message = keptFailures[0].failure.split("\n")[0].slice(0, 300);
  const rateLimitMessage = forge === "github" ? await githubRateLimitMessage(folder, message) : null;
  const keptAt = Math.min(...keptFailures.map((kept) => kept.keptAt));
  return t("codeHostingPanel.keptAfterFailure", {
    age: keptAgeText(keptAt, Date.now()),
    time: clockTime(keptAt / 1000),
    error: rateLimitMessage ?? message,
  });
}

/**
 * Loads one list of the repository of a folder, filtered by the search of this list `codeHosting.search`. The other
 * list does not change. The hosting service of the repository must be known: `loadCodeHosting` reads it.
 * @param folder - the root folder of the Git repository of the selected workspace
 * @param group - the list to load
 * @param isRefresh - true to ask the hosting service again, and not to use the cache
 * @returns nothing
 */
async function loadCodeHostingList(folder: string, group: CodeHostingGroup, isRefresh = false): Promise<void> {
  const thisLoad = ++lastListLoad[group];
  codeHosting[group] = [];
  codeHosting.listError[group] = "";
  codeHosting.listNotice[group] = "";
  const forge = codeHosting.forge;
  if (forge === null) {
    codeHosting.listStatus[group] = "idle";
    return;
  }
  codeHosting.listStatus[group] = "loading";
  try {
    const search = codeHosting.search[group];
    const keptFailures: KeptAfterFailure[] = [];
    const items =
      forge === "github"
        ? await readGithubList(folder, group, isRefresh, search, keptFailures)
        : await readGitlabGroup(folder, group, isRefresh, search, keptFailures);
    const notice = keptFailures.length === 0 ? "" : await keptAfterFailureNotice(folder, forge, keptFailures);
    if (thisLoad !== lastListLoad[group]) {
      return;
    }
    codeHosting[group] = items;
    codeHosting.listNotice[group] = notice;
    codeHosting.listStatus[group] = "ready";
  } catch (failure) {
    if (thisLoad !== lastListLoad[group]) {
      return;
    }
    const message =
      failure instanceof CodeHostingSearchError ? failure.message : String(failure).split("\n")[0].slice(0, 300);
    const rateLimitMessage = forge === "github" ? await githubRateLimitMessage(folder, message) : null;
    if (thisLoad !== lastListLoad[group]) {
      return;
    }
    codeHosting.listError[group] = rateLimitMessage ?? message;
    codeHosting.listStatus[group] = "failed";
  }
}

/**
 * Loads the two lists of the repository of a folder, each one filtered by its own search. The lists stay empty and the
 * status is "noRemote" when the repository has no remote address.
 * @param folder - the root folder of the Git repository of the selected workspace, or null when there is none
 * @param isRefresh - true after a click on "Refresh": the hosting service is asked again, and the cache is not used
 * @returns nothing
 */
export async function loadCodeHosting(folder: string | null, isRefresh = false): Promise<void> {
  const thisLoad = ++lastLoad;
  for (const group of CODE_HOSTING_GROUPS) {
    lastListLoad[group] += 1;
    codeHosting[group] = [];
    codeHosting.listStatus[group] = "idle";
    codeHosting.listError[group] = "";
    codeHosting.listNotice[group] = "";
  }
  codeHosting.error = "";
  if (folder === null) {
    codeHosting.status = "idle";
    return;
  }
  codeHosting.status = "loading";
  try {
    const context = await refContext(folder);
    if (thisLoad !== lastLoad) {
      return;
    }
    const forge = forgeOfContext(context);
    if (forge === null || context.base === null) {
      codeHosting.forge = null;
      codeHosting.webBase = null;
      codeHosting.status = "noRemote";
      return;
    }
    codeHosting.forge = forge;
    codeHosting.webBase = context.base;
    codeHosting.status = "ready";
    await Promise.all(CODE_HOSTING_GROUPS.map((group) => loadCodeHostingList(folder, group, isRefresh)));
  } catch (failure) {
    if (thisLoad !== lastLoad) {
      return;
    }
    codeHosting.error = String(failure).split("\n")[0].slice(0, 300);
    codeHosting.status = "failed";
  }
}

/**
 * Runs a search in one list: this list shows the items that match it, and the other list does not change. An empty
 * search shows all the open items.
 * @param folder - the root folder of the Git repository of the selected workspace, or null when there is none
 * @param group - the list that the search is for
 * @param text - the search, in the search language of GitHub
 * @returns nothing
 */
export async function searchCodeHosting(folder: string | null, group: CodeHostingGroup, text: string): Promise<void> {
  codeHosting.search[group] = text.trim();
  if (folder === null) {
    return;
  }
  if (codeHosting.forge === null) {
    await loadCodeHosting(folder);
    return;
  }
  await loadCodeHostingList(folder, group);
}

/**
 * The title of a list: "Issues", then "Pull requests" on GitHub or "Merge requests" on GitLab.
 * @param group - the list
 * @param forge - the hosting service of the repository
 * @returns the title
 */
export function codeHostingGroupTitle(group: CodeHostingGroup, forge: Forge | null): string {
  if (group === "issues") {
    return t("codeHostingPanel.group.issues");
  }
  return t(forge === "gitlab" ? "codeHostingPanel.group.mergeRequests" : "codeHostingPanel.group.pullRequests");
}

/**
 * The text before the number of an item: "#" for an issue and for a pull request, "!" for a merge request.
 * @param group - the list of the item
 * @param forge - the hosting service of the repository
 * @returns the prefix
 */
export function itemPrefix(group: CodeHostingGroup, forge: Forge | null): string {
  return group === "requests" && forge === "gitlab" ? "!" : "#";
}
