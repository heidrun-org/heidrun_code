// The merge of a pull request (GitHub) or of a merge request (GitLab) from Heidrun Code: what the hosting service says
// about the item (its approval state, and whether it can be merged now), the settings of the repository (the allowed merge
// methods, the squash, and the deletion of the source branch), and the merge window, which merges only after a second
// click. Two places open the merge window: the information card of a row of the Code hosting sidebar section, and the
// issue preview window. The rules are in docs/agents_rules/user_interface/sidebars/code_hosting_merge.md.
// - issue #570
import { reactive } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { runForgeCli } from "../lib/forge_cli";
import type { Forge } from "../lib/refs";
import { t } from "../i18n/index";
import { settings } from "./settings";
import { toast } from "./session";

/** A merge method of GitHub. On GitLab, the method is a setting of the project, and only the squash is a choice. */
export type MergeMethod = "merge" | "squash" | "rebase";

/** The approval state of a pull request or of a merge request. */
export type ApprovalState = "approved" | "changesRequested" | "reviewRequired";

/** What the hosting service says about one pull request or merge request, and about the settings of its repository. */
export type MergeFacts = {
  /** The hosting service. */
  forge: Forge;
  /** The number of the pull request, or the internal number (`iid`) of the merge request. */
  number: number;
  /** True while the item is open. */
  isOpen: boolean;
  /** True for a draft. */
  isDraft: boolean;
  /** The branch with the changes, or null. */
  headBranch: string | null;
  /** The branch that receives the changes, or null. */
  baseBranch: string | null;
  /** The last commit of the branch with the changes, or null. The hosting service refuses the merge when it changed. */
  headSha: string | null;
  /** The approval state, or null when the repository asks for no review. */
  approval: ApprovalState | null;
  /** GitLab: the number of approvals that the merge request still needs, or null. */
  approvalsLeft: number | null;
  /** The people who approved the item. */
  approvers: string[];
  /**
   * The translation key of the reason why the hosting service refuses the merge now, or null when it accepts it. The
   * reasons of the merge window (a permanent branch that the repository deletes) are in `mergeBlockKey`.
   */
  blockKey: string | null;
  /** The status that the hosting service gave, shown after the reason "the hosting service refuses the merge now". */
  blockDetail: string | null;
  /** GitHub: the merge methods that the repository allows, in the order of GitHub. GitLab: `["merge"]`. */
  methods: MergeMethod[];
  /** GitLab: the method of the project, `merge`, `rebase_merge`, or `ff`, or null on GitHub. */
  gitlabMethod: string | null;
  /** GitLab: the squash option of the project, `never`, `always`, `default_on`, or `default_off`, or null on GitHub. */
  squashOption: string | null;
  /** Whether the check box "Delete the source branch" starts checked: the setting of the repository or of the item. */
  isDeletedByDefault: boolean;
  /** GitHub: true when the repository deletes the branch by itself after each merge ("Automatically delete head branches"). */
  isDeletedByRepository: boolean;
};

/** What `gh pr view --json` prints for the merge. */
type GithubPullRequest = {
  state?: string;
  isDraft?: boolean;
  mergeable?: string;
  mergeStateStatus?: string;
  reviewDecision?: string;
  latestReviews?: { state?: string; author?: { login?: string } }[];
  headRefOid?: string;
  headRefName?: string;
  baseRefName?: string;
};

/** What `gh api repos/{owner}/{repo}` prints for the merge. A field is missing when the account cannot see it. */
type GithubRepository = {
  allow_merge_commit?: boolean;
  allow_squash_merge?: boolean;
  allow_rebase_merge?: boolean;
  delete_branch_on_merge?: boolean;
};

/** What the API of GitLab gives for one merge request. */
type GitlabMergeRequest = {
  state?: string;
  draft?: boolean;
  detailed_merge_status?: string;
  sha?: string;
  source_branch?: string;
  target_branch?: string;
  force_remove_source_branch?: boolean | null;
};

/** What the API of GitLab gives for the approvals of a merge request. */
type GitlabApprovals = {
  approved?: boolean;
  approvals_left?: number;
  approved_by?: { user?: { username?: string } }[];
};

/** What the API of GitLab gives for a project. */
type GitlabProject = {
  merge_method?: string;
  squash_option?: string;
  remove_source_branch_after_merge?: boolean;
};

/** The fields of `gh pr view` that the merge reads. */
const GITHUB_MERGE_FIELDS =
  "state,isDraft,mergeable,mergeStateStatus,reviewDecision,latestReviews,headRefOid,headRefName,baseRefName";

/** The approval state of each review decision of GitHub. An empty decision means that the repository asks for no review. */
const GITHUB_APPROVAL: Record<string, ApprovalState> = {
  APPROVED: "approved",
  CHANGES_REQUESTED: "changesRequested",
  REVIEW_REQUIRED: "reviewRequired",
};

/** The reason of each detailed merge status of GitLab that refuses the merge. The other statuses accept it, or are unknown. */
const GITLAB_BLOCK_KEYS: Record<string, string> = {
  not_open: "mergeModal.blockNotOpen",
  draft_status: "mergeModal.blockDraft",
  conflict: "mergeModal.blockConflict",
  not_approved: "mergeModal.blockApproval",
  requested_changes: "mergeModal.blockApproval",
  ci_must_pass: "mergeModal.blockChecks",
  ci_still_running: "mergeModal.blockChecksRunning",
  discussions_not_resolved: "mergeModal.blockDiscussions",
  need_rebase: "mergeModal.blockBehind",
};

/** The detailed merge statuses of GitLab that accept the merge, or that GitLab is still computing. */
const GITLAB_OPEN_STATUSES = new Set(["mergeable", "checking", "unchecked", "preparing", "approvals_syncing", ""]);

/**
 * The reason why GitHub refuses the merge of a pull request now.
 * @param pullRequest - what `gh pr view` printed
 * @returns the translation key of the reason, or null when GitHub accepts the merge
 */
export function githubBlockKey(pullRequest: GithubPullRequest): string | null {
  if (pullRequest.state !== undefined && pullRequest.state !== "OPEN") {
    return "mergeModal.blockNotOpen";
  }
  if (pullRequest.isDraft === true || pullRequest.mergeStateStatus === "DRAFT") {
    return "mergeModal.blockDraft";
  }
  if (pullRequest.mergeable === "CONFLICTING" || pullRequest.mergeStateStatus === "DIRTY") {
    return "mergeModal.blockConflict";
  }
  if (pullRequest.mergeStateStatus === "BEHIND") {
    return "mergeModal.blockBehind";
  }
  if (pullRequest.mergeStateStatus === "BLOCKED") {
    const decision = pullRequest.reviewDecision ?? "";
    return decision === "REVIEW_REQUIRED" || decision === "CHANGES_REQUESTED" ? "mergeModal.blockApproval" : "mergeModal.blockRule";
  }
  return null;
}

/**
 * The merge facts of a pull request of GitHub.
 * @param pullRequest - what `gh pr view` printed
 * @param repository - what `gh api repos/{owner}/{repo}` printed, or null when it could not be read
 * @param number - the number of the pull request
 * @returns the merge facts
 */
export function githubMergeFacts(pullRequest: GithubPullRequest, repository: GithubRepository | null, number: number): MergeFacts {
  const allowed: [MergeMethod, boolean | undefined][] = [
    ["merge", repository?.allow_merge_commit],
    ["squash", repository?.allow_squash_merge],
    ["rebase", repository?.allow_rebase_merge],
  ];
  // A field that the account cannot see is missing: the method is then offered, and GitHub refuses it if needed.
  const methods = allowed.filter(([, isAllowed]) => isAllowed !== false).map(([method]) => method);
  const approvers = (pullRequest.latestReviews ?? [])
    .filter((review) => review.state === "APPROVED")
    .map((review) => review.author?.login ?? "")
    .filter((login) => login !== "");
  return {
    forge: "github",
    number,
    isOpen: pullRequest.state === undefined || pullRequest.state === "OPEN",
    isDraft: pullRequest.isDraft === true,
    headBranch: pullRequest.headRefName ?? null,
    baseBranch: pullRequest.baseRefName ?? null,
    headSha: pullRequest.headRefOid ?? null,
    approval: GITHUB_APPROVAL[pullRequest.reviewDecision ?? ""] ?? null,
    approvalsLeft: null,
    approvers,
    blockKey: githubBlockKey(pullRequest),
    blockDetail: null,
    methods,
    gitlabMethod: null,
    squashOption: null,
    isDeletedByDefault: repository?.delete_branch_on_merge === true,
    isDeletedByRepository: repository?.delete_branch_on_merge === true,
  };
}

/**
 * The merge facts of a merge request of GitLab.
 * @param mergeRequest - what the API gave for the merge request
 * @param approvals - what the API gave for its approvals, or null when they could not be read
 * @param project - what the API gave for the project, or null when it could not be read
 * @param number - the internal number of the merge request
 * @returns the merge facts
 */
export function gitlabMergeFacts(
  mergeRequest: GitlabMergeRequest,
  approvals: GitlabApprovals | null,
  project: GitlabProject | null,
  number: number,
): MergeFacts {
  const status = mergeRequest.detailed_merge_status ?? "";
  const isOpen = mergeRequest.state === undefined || mergeRequest.state === "opened";
  let blockKey: string | null = isOpen ? GITLAB_BLOCK_KEYS[status] ?? null : "mergeModal.blockNotOpen";
  let blockDetail: string | null = null;
  if (blockKey === null && isOpen && GITLAB_OPEN_STATUSES.has(status) === false) {
    blockKey = "mergeModal.blockOther";
    blockDetail = status;
  }
  let approval: ApprovalState | null = null;
  if (status === "requested_changes") {
    approval = "changesRequested";
  } else if (approvals !== null && (approvals.approvals_left ?? 0) > 0) {
    approval = "reviewRequired";
  } else if (approvals?.approved === true && (approvals.approved_by ?? []).length > 0) {
    approval = "approved";
  }
  const squashOption = project?.squash_option ?? "default_off";
  const forced = mergeRequest.force_remove_source_branch;
  return {
    forge: "gitlab",
    number,
    isOpen,
    isDraft: mergeRequest.draft === true,
    headBranch: mergeRequest.source_branch ?? null,
    baseBranch: mergeRequest.target_branch ?? null,
    headSha: mergeRequest.sha ?? null,
    approval,
    approvalsLeft: approvals?.approvals_left ?? null,
    approvers: (approvals?.approved_by ?? []).map((entry) => entry.user?.username ?? "").filter((name) => name !== ""),
    blockKey,
    blockDetail,
    methods: ["merge"],
    gitlabMethod: project?.merge_method ?? "merge",
    squashOption,
    isDeletedByDefault: typeof forced === "boolean" ? forced : project?.remove_source_branch_after_merge === true,
    isDeletedByRepository: false,
  };
}

/**
 * Reads the merge facts of a pull request or of a merge request through the cache of the answers.
 * @param folder - the folder of the repository, where `gh` or `glab` runs
 * @param forge - the hosting service
 * @param number - the number of the item
 * @param isRefresh - true to ask the hosting service again, as the merge window does when it opens
 * @returns the merge facts
 */
export async function loadMergeFacts(folder: string, forge: Forge, number: number, isRefresh = false): Promise<MergeFacts> {
  const options = { isRefresh };
  if (forge === "github") {
    const [pullRequest, repository] = await Promise.all([
      runForgeCli("merge", folder, "gh", ["pr", "view", String(number), "--json", GITHUB_MERGE_FIELDS], options),
      runForgeCli("merge", folder, "gh", ["api", "repos/{owner}/{repo}"]).catch(() => null),
    ]);
    return githubMergeFacts(JSON.parse(pullRequest), repository === null ? null : JSON.parse(repository), number);
  }
  const path = `projects/:fullpath/merge_requests/${number}`;
  const [mergeRequest, approvals, project] = await Promise.all([
    runForgeCli("merge", folder, "glab", ["api", path], options),
    runForgeCli("merge", folder, "glab", ["api", `${path}/approvals`], options).catch(() => null),
    runForgeCli("merge", folder, "glab", ["api", "projects/:fullpath"]).catch(() => null),
  ]);
  return gitlabMergeFacts(
    JSON.parse(mergeRequest),
    approvals === null ? null : JSON.parse(approvals),
    project === null ? null : JSON.parse(project),
    number,
  );
}

/**
 * True when a branch is a permanent branch of the setting `mergePermanentBranches`, whose deletion is never offered.
 * @param branch - the name of the branch, or null
 * @returns true for a permanent branch
 */
export function isPermanentBranch(branch: string | null): boolean {
  if (branch === null) {
    return false;
  }
  return settings.mergePermanentBranches
    .map((name) => name.trim())
    .filter((name) => name !== "")
    .some((name) => (name.endsWith("*") ? branch.startsWith(name.slice(0, -1)) : branch === name));
}

/**
 * The reason why the button "Merge" is disabled: the reason of the hosting service, or a permanent branch that the
 * repository of GitHub would delete by itself after the merge.
 * @param facts - the merge facts
 * @returns the text of the reason, or null when the merge is possible
 */
export function mergeBlockReason(facts: MergeFacts): string | null {
  if (facts.blockKey !== null) {
    return t(facts.blockKey, { status: facts.blockDetail ?? "" });
  }
  if (facts.isDeletedByRepository && isPermanentBranch(facts.headBranch)) {
    return t("mergeModal.blockDeletedByRepository", { branch: facts.headBranch ?? "" });
  }
  return null;
}

/**
 * The text of the approval state, for example "Approved", or "Review required · 1 approval left".
 * @param facts - the merge facts
 * @returns the text, or an empty text when the repository asks for no review
 */
export function approvalText(facts: MergeFacts): string {
  if (facts.approval === null) {
    return "";
  }
  const text = t(APPROVAL_KEYS[facts.approval]);
  if (facts.approvalsLeft !== null && facts.approvalsLeft > 0) {
    return `${text} · ${t("mergeModal.approvalsLeft", { count: facts.approvalsLeft })}`;
  }
  return text;
}

/** The translation key of each approval state. */
export const APPROVAL_KEYS: Record<ApprovalState, string> = {
  approved: "mergeModal.approved",
  changesRequested: "mergeModal.changesRequested",
  reviewRequired: "mergeModal.reviewRequired",
};

/** The merge window: it opens on a pull request or a merge request, and merges only after the click on its button "Merge". */
export const pullRequestMerge = reactive({
  open: false,
  /** True while the window reads the hosting service again. */
  loading: false,
  /** The folder of the repository. */
  folder: "",
  /** The address of the repository on its hosting service, the key of the last method of the developer. */
  webBase: "",
  /** The number with its mark, for example "#12" or "!7". */
  name: "",
  /** The facts that the window shows, or null while it reads them. */
  facts: null as MergeFacts | null,
  /** GitHub: the chosen method. */
  method: "merge" as MergeMethod,
  /** GitLab: whether the commits are squashed. */
  isSquashed: false,
  /** Whether the source branch is deleted after the merge. */
  isBranchDeleted: false,
  /** True while the merge runs. */
  busy: false,
  /** The first line of the failure of the merge, or an empty text. */
  error: "",
  /** Grows after each merge, so that the lists and the windows read the hosting service again. */
  mergeCount: 0,
});

/**
 * The method that the merge window selects on GitHub: the last method of the developer in this repository when the
 * repository still allows it, else the first allowed method.
 * @param facts - the merge facts
 * @param webBase - the address of the repository
 * @returns the method
 */
export function defaultMethod(facts: MergeFacts, webBase: string): MergeMethod {
  const last = settings.mergeLastMethods[webBase];
  if (last !== undefined && facts.methods.includes(last)) {
    return last;
  }
  return facts.methods[0] ?? "merge";
}

/**
 * GitLab: whether the squash check box starts checked, and whether the developer can change it.
 * @param facts - the merge facts
 * @returns the start value, and true when the project forces the value
 */
export function squashChoice(facts: MergeFacts): { isChecked: boolean; isForced: boolean } {
  const option = facts.squashOption ?? "default_off";
  return { isChecked: option === "always" || option === "default_on", isForced: option === "always" || option === "never" };
}

/**
 * Opens the merge window, then reads the hosting service again, so that the window shows the state of now.
 * @param folder - the folder of the repository
 * @param forge - the hosting service
 * @param number - the number of the item
 * @param name - the number with its mark, for example "#12" or "!7"
 * @param webBase - the address of the repository on its hosting service
 */
export async function openMergeWindow(folder: string, forge: Forge, number: number, name: string, webBase: string): Promise<void> {
  Object.assign(pullRequestMerge, { open: true, loading: true, folder, webBase, name, facts: null, busy: false, error: "" });
  try {
    const facts = await loadMergeFacts(folder, forge, number, true);
    if (pullRequestMerge.open === false || pullRequestMerge.name !== name) {
      return;
    }
    Object.assign(pullRequestMerge, {
      facts,
      method: defaultMethod(facts, webBase),
      isSquashed: squashChoice(facts).isChecked,
      isBranchDeleted: facts.isDeletedByDefault && isPermanentBranch(facts.headBranch) === false,
    });
  } catch (reason) {
    pullRequestMerge.error = String(reason).split("\n")[0];
  } finally {
    pullRequestMerge.loading = false;
  }
}

/** Closes the merge window, unless a merge runs. */
export function closeMergeWindow(): void {
  if (pullRequestMerge.busy === false) {
    pullRequestMerge.open = false;
  }
}

/**
 * Merges the item of the merge window with the choices of the window. The window stays open with the first line of the
 * failure when the merge fails.
 * @returns true when the item is merged
 */
export async function confirmMergeWindow(): Promise<boolean> {
  const facts = pullRequestMerge.facts;
  if (facts === null || mergeBlockReason(facts) !== null || pullRequestMerge.busy) {
    return false;
  }
  pullRequestMerge.busy = true;
  pullRequestMerge.error = "";
  const method = facts.forge === "github" ? pullRequestMerge.method : pullRequestMerge.isSquashed ? "squash" : "merge";
  try {
    const answer = await invoke<string>("forge_merge", {
      root: pullRequestMerge.folder,
      forge: facts.forge,
      number: facts.number,
      sha: facts.headSha,
      method,
      deleteBranch: pullRequestMerge.isBranchDeleted && isPermanentBranch(facts.headBranch) === false,
      branch: facts.headBranch,
      permanentBranches: settings.mergePermanentBranches,
    });
    if (facts.forge === "github") {
      settings.mergeLastMethods = { ...settings.mergeLastMethods, [pullRequestMerge.webBase]: pullRequestMerge.method };
    }
    pullRequestMerge.open = false;
    pullRequestMerge.mergeCount += 1;
    const target = facts.baseBranch ?? "";
    toast(answer === "ok" || answer.trim() === "" ? t("mergeModal.merged", { name: pullRequestMerge.name, target }) : answer);
    return true;
  } catch (reason) {
    pullRequestMerge.error = String(reason).split("\n")[0];
    return false;
  } finally {
    pullRequestMerge.busy = false;
  }
}
