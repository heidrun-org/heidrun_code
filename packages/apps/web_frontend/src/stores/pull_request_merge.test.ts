import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("./session", () => ({ toast }));

import {
  approvalText,
  confirmMergeWindow,
  defaultMethod,
  githubMergeFacts,
  gitlabMergeFacts,
  isPermanentBranch,
  mergeBlockReason,
  openMergeWindow,
  pullRequestMerge,
  squashChoice,
} from "./pull_request_merge";
import { settings } from "./settings";

/** An open pull request of GitHub that can be merged, to change field by field. */
const READY_PULL_REQUEST = {
  state: "OPEN",
  isDraft: false,
  mergeable: "MERGEABLE",
  mergeStateStatus: "CLEAN",
  reviewDecision: "APPROVED",
  latestReviews: [
    { state: "APPROVED", author: { login: "jeromeetienne" } },
    { state: "COMMENTED", author: { login: "someone" } },
  ],
  headRefOid: "abcdef1234567890",
  headRefName: "feature-one",
  baseRefName: "main",
};

/** A repository of GitHub: merge commit and squash allowed, rebase refused, branch deleted after each merge. */
const SANDBOX_REPOSITORY = { allow_merge_commit: true, allow_squash_merge: true, allow_rebase_merge: false, delete_branch_on_merge: true };

/** An open merge request of GitLab that can be merged. */
const READY_MERGE_REQUEST = {
  state: "opened",
  draft: false,
  detailed_merge_status: "mergeable",
  sha: "1234567abcdef",
  source_branch: "feature-one",
  target_branch: "main",
  force_remove_source_branch: null,
};

/** Answers the reads of the merge window like GitHub, and the merge like `forge_merge`. */
function answerLikeGithub(command: string, payload: { tool?: string; args?: string[] }) {
  if (command === "forge_merge") return Promise.resolve("ok");
  if (payload.args?.[0] === "api") return Promise.resolve(JSON.stringify(SANDBOX_REPOSITORY));
  return Promise.resolve(JSON.stringify(READY_PULL_REQUEST));
}

beforeEach(() => {
  invoke.mockReset();
  toast.mockReset();
  settings.mergePermanentBranches = ["main", "master", "dev", "dev_*"];
  settings.mergeLastMethods = {};
  Object.assign(pullRequestMerge, { open: false, loading: false, facts: null, busy: false, error: "", mergeCount: 0 });
});

describe("githubMergeFacts (issue #570)", () => {
  it("reads the approval state, the approvers, the allowed methods, and the deletion of the repository", () => {
    const facts = githubMergeFacts(READY_PULL_REQUEST, SANDBOX_REPOSITORY, 12);
    expect(facts.approval).toBe("approved");
    expect(facts.approvers).toEqual(["jeromeetienne"]);
    expect(facts.methods).toEqual(["merge", "squash"]);
    expect(facts.isDeletedByDefault).toBe(true);
    expect(facts.isDeletedByRepository).toBe(true);
    expect(facts.blockKey).toBeNull();
    expect(facts.headSha).toBe("abcdef1234567890");
  });

  it("offers every method and keeps the branch when the settings of the repository cannot be read", () => {
    const facts = githubMergeFacts(READY_PULL_REQUEST, null, 12);
    expect(facts.methods).toEqual(["merge", "squash", "rebase"]);
    expect(facts.isDeletedByDefault).toBe(false);
  });

  it("gives the reason why GitHub refuses the merge now", () => {
    const blockOf = (changes: object) => githubMergeFacts({ ...READY_PULL_REQUEST, ...changes }, null, 1).blockKey;
    expect(blockOf({ isDraft: true })).toBe("mergeModal.blockDraft");
    expect(blockOf({ mergeable: "CONFLICTING", mergeStateStatus: "DIRTY" })).toBe("mergeModal.blockConflict");
    expect(blockOf({ mergeStateStatus: "BEHIND" })).toBe("mergeModal.blockBehind");
    expect(blockOf({ mergeStateStatus: "BLOCKED", reviewDecision: "REVIEW_REQUIRED" })).toBe("mergeModal.blockApproval");
    expect(blockOf({ mergeStateStatus: "BLOCKED", reviewDecision: "APPROVED" })).toBe("mergeModal.blockRule");
    expect(blockOf({ state: "MERGED" })).toBe("mergeModal.blockNotOpen");
    expect(blockOf({ mergeStateStatus: "UNSTABLE" })).toBeNull();
  });
});

describe("gitlabMergeFacts (issue #570)", () => {
  it("reads the approvals, the method and the squash of the project, and the deletion of the merge request", () => {
    const approvals = { approved: false, approvals_left: 1, approved_by: [{ user: { username: "olivier" } }] };
    const project = { merge_method: "ff", squash_option: "default_on", remove_source_branch_after_merge: true };
    const facts = gitlabMergeFacts(READY_MERGE_REQUEST, approvals, project, 7);
    expect(facts.approval).toBe("reviewRequired");
    expect(facts.approvalsLeft).toBe(1);
    expect(facts.approvers).toEqual(["olivier"]);
    expect(facts.gitlabMethod).toBe("ff");
    expect(squashChoice(facts)).toEqual({ isChecked: true, isForced: false });
    expect(facts.isDeletedByDefault).toBe(true);
    expect(approvalText(facts)).toBe("Review required · 1 approval left");
  });

  it("takes the deletion of the merge request before the one of the project", () => {
    const project = { remove_source_branch_after_merge: true };
    expect(gitlabMergeFacts({ ...READY_MERGE_REQUEST, force_remove_source_branch: false }, null, project, 7).isDeletedByDefault).toBe(false);
    expect(gitlabMergeFacts({ ...READY_MERGE_REQUEST, force_remove_source_branch: true }, null, null, 7).isDeletedByDefault).toBe(true);
  });

  it("locks the squash when the project always or never squashes", () => {
    const factsOf = (squash_option: string) => gitlabMergeFacts(READY_MERGE_REQUEST, null, { squash_option }, 7);
    expect(squashChoice(factsOf("always"))).toEqual({ isChecked: true, isForced: true });
    expect(squashChoice(factsOf("never"))).toEqual({ isChecked: false, isForced: true });
    expect(squashChoice(factsOf("default_off"))).toEqual({ isChecked: false, isForced: false });
  });

  it("gives the reason of each detailed merge status that refuses the merge, and the status of an unknown one", () => {
    const factsOf = (detailed_merge_status: string) => gitlabMergeFacts({ ...READY_MERGE_REQUEST, detailed_merge_status }, null, null, 7);
    expect(factsOf("draft_status").blockKey).toBe("mergeModal.blockDraft");
    expect(factsOf("conflict").blockKey).toBe("mergeModal.blockConflict");
    expect(factsOf("not_approved").blockKey).toBe("mergeModal.blockApproval");
    expect(factsOf("ci_still_running").blockKey).toBe("mergeModal.blockChecksRunning");
    expect(factsOf("checking").blockKey).toBeNull();
    const unknown = factsOf("jira_association_missing");
    expect(mergeBlockReason(unknown)).toBe("The hosting service refuses the merge now (jira_association_missing).");
  });
});

describe("the permanent branches (issue #570)", () => {
  it("matches a name, and a name that ends with *", () => {
    expect(isPermanentBranch("dev_eric")).toBe(true);
    expect(isPermanentBranch("main")).toBe(true);
    expect(isPermanentBranch("feature-one")).toBe(false);
    expect(isPermanentBranch(null)).toBe(false);
  });

  it("refuses the merge of a permanent branch that the repository of GitHub deletes by itself", () => {
    const facts = githubMergeFacts({ ...READY_PULL_REQUEST, headRefName: "dev_eric" }, SANDBOX_REPOSITORY, 12);
    expect(mergeBlockReason(facts)).toContain("dev_eric is a permanent branch");
    expect(mergeBlockReason(githubMergeFacts({ ...READY_PULL_REQUEST, headRefName: "dev_eric" }, null, 12))).toBeNull();
  });
});

describe("the merge window (issue #570)", () => {
  it("selects the last method of the developer in the repository, when the repository still allows it", () => {
    const facts = githubMergeFacts(READY_PULL_REQUEST, SANDBOX_REPOSITORY, 12);
    expect(defaultMethod(facts, "https://github.com/o/r")).toBe("merge");
    settings.mergeLastMethods = { "https://github.com/o/r": "squash" };
    expect(defaultMethod(facts, "https://github.com/o/r")).toBe("squash");
    settings.mergeLastMethods = { "https://github.com/o/r": "rebase" };
    expect(defaultMethod(facts, "https://github.com/o/r")).toBe("merge");
  });

  it("reads the hosting service again when it opens, and starts with the defaults of the repository", async () => {
    invoke.mockImplementation(answerLikeGithub);
    await openMergeWindow("/work/sandbox", "github", 12, "#12", "https://github.com/o/r");
    expect(invoke).toHaveBeenCalledWith("forge_cli_cached", expect.objectContaining({ args: ["pr", "view", "12", "--json", expect.any(String)], refresh: true }));
    expect(pullRequestMerge.facts?.methods).toEqual(["merge", "squash"]);
    expect(pullRequestMerge.isBranchDeleted).toBe(true);
    expect(pullRequestMerge.loading).toBe(false);
  });

  it("never checks the deletion of a permanent branch", async () => {
    invoke.mockImplementation((_command: string, payload: { args?: string[] }) =>
      payload.args?.[0] === "api"
        ? Promise.resolve(JSON.stringify({ allow_merge_commit: true }))
        : Promise.resolve(JSON.stringify({ ...READY_PULL_REQUEST, headRefName: "dev_eric" })),
    );
    await openMergeWindow("/work/sandbox", "github", 12, "#12", "https://github.com/o/r");
    expect(pullRequestMerge.isBranchDeleted).toBe(false);
  });

  it("merges with the choices of the window, remembers the method, and closes", async () => {
    invoke.mockImplementation(answerLikeGithub);
    await openMergeWindow("/work/sandbox", "github", 12, "#12", "https://github.com/o/r");
    pullRequestMerge.method = "squash";
    expect(await confirmMergeWindow()).toBe(true);
    expect(invoke).toHaveBeenLastCalledWith("forge_merge", {
      root: "/work/sandbox",
      forge: "github",
      number: 12,
      sha: "abcdef1234567890",
      method: "squash",
      deleteBranch: true,
      branch: "feature-one",
      permanentBranches: ["main", "master", "dev", "dev_*"],
    });
    expect(settings.mergeLastMethods["https://github.com/o/r"]).toBe("squash");
    expect(pullRequestMerge.open).toBe(false);
    expect(pullRequestMerge.mergeCount).toBe(1);
    expect(toast).toHaveBeenCalledWith("#12 merged into main");
  });

  it("sends the squash of GitLab as the method", async () => {
    invoke.mockImplementation((command: string) => (command === "forge_merge" ? Promise.resolve("ok") : Promise.resolve(JSON.stringify(READY_MERGE_REQUEST))));
    await openMergeWindow("/work/sandbox", "gitlab", 7, "!7", "https://gitlab.com/g/app");
    pullRequestMerge.isSquashed = true;
    await confirmMergeWindow();
    expect(invoke).toHaveBeenLastCalledWith("forge_merge", expect.objectContaining({ forge: "gitlab", number: 7, method: "squash", deleteBranch: false }));
  });

  it("stays open with the first line of the failure", async () => {
    invoke.mockImplementation((command: string, payload: { tool?: string; args?: string[] }) =>
      command === "forge_merge" ? Promise.reject("GraphQL: Head branch was modified\nmore") : answerLikeGithub(command, payload),
    );
    await openMergeWindow("/work/sandbox", "github", 12, "#12", "https://github.com/o/r");
    expect(await confirmMergeWindow()).toBe(false);
    expect(pullRequestMerge.open).toBe(true);
    expect(pullRequestMerge.error).toBe("GraphQL: Head branch was modified");
    expect(pullRequestMerge.mergeCount).toBe(0);
  });

  it("merges nothing when the hosting service refuses the merge now", async () => {
    invoke.mockImplementation((_command: string, payload: { args?: string[] }) =>
      payload.args?.[0] === "api" ? Promise.resolve("{}") : Promise.resolve(JSON.stringify({ ...READY_PULL_REQUEST, isDraft: true })),
    );
    await openMergeWindow("/work/sandbox", "github", 12, "#12", "https://github.com/o/r");
    expect(await confirmMergeWindow()).toBe(false);
    expect(invoke).not.toHaveBeenCalledWith("forge_merge", expect.anything());
  });
});
