import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enableAutoUnmount, mount } from "@vue/test-utils";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

import MergeModal from "./MergeModal.vue";
import { githubMergeFacts, gitlabMergeFacts, pullRequestMerge } from "../stores/pull_request_merge";
import { settings } from "../stores/settings";

enableAutoUnmount(afterEach);

const PULL_REQUEST = {
  state: "OPEN",
  mergeStateStatus: "CLEAN",
  reviewDecision: "APPROVED",
  latestReviews: [{ state: "APPROVED", author: { login: "jeromeetienne" } }],
  headRefOid: "abcdef1234567890",
  headRefName: "feature-one",
  baseRefName: "main",
};

const MERGE_REQUEST = { state: "opened", detailed_merge_status: "mergeable", sha: "1234567abc", source_branch: "feature-one", target_branch: "main" };

/** Opens the window on facts that are already read. */
function showWindow(facts: ReturnType<typeof githubMergeFacts>, name: string) {
  Object.assign(pullRequestMerge, { open: true, loading: false, facts, name, busy: false, error: "", isBranchDeleted: false, isSquashed: false, method: facts.methods[0] });
  return mount(MergeModal);
}

beforeEach(() => {
  settings.mergePermanentBranches = ["main", "master", "dev", "dev_*"];
});

describe("MergeModal on GitHub (issue #570)", () => {
  it("shows the branches, the approval, the approvers, and only the methods that the repository allows", () => {
    const wrapper = showWindow(githubMergeFacts(PULL_REQUEST, { allow_merge_commit: false, allow_squash_merge: true, allow_rebase_merge: true }, 12), "#12");
    expect(wrapper.get("h2").text()).toBe("Merge the pull request #12?");
    expect(wrapper.text()).toContain("feature-one → main");
    expect(wrapper.get("[data-merge-approval]").text()).toBe("Approved");
    expect(wrapper.text()).toContain("Approved by jeromeetienne");
    expect(wrapper.findAll("option").map((option) => option.text())).toEqual(["Squash and merge", "Rebase and merge"]);
    expect(wrapper.get("[data-merge-confirm]").attributes("disabled")).toBeUndefined();
  });

  it("disables the button Merge with the reason in its title and under the branches", () => {
    const wrapper = showWindow(githubMergeFacts({ ...PULL_REQUEST, mergeable: "CONFLICTING" }, null, 12), "#12");
    const button = wrapper.get("[data-merge-confirm]");
    expect(button.attributes("disabled")).toBeDefined();
    expect(button.attributes("title")).toBe("It is in conflict with the target branch.");
    expect(wrapper.get("[data-merge-block]").text()).toBe("It is in conflict with the target branch.");
  });

  it("disables and leaves off the deletion of a permanent branch", () => {
    const wrapper = showWindow(githubMergeFacts({ ...PULL_REQUEST, headRefName: "dev_eric" }, null, 12), "#12");
    const deletion = wrapper.get("[data-merge-delete]");
    expect(deletion.attributes("disabled")).toBeDefined();
    expect((deletion.element as HTMLInputElement).checked).toBe(false);
    expect(wrapper.get("[data-merge-permanent]").text()).toBe("dev_eric is a permanent branch: it is never deleted.");
  });

  it("shows the failure of the merge", () => {
    const wrapper = showWindow(githubMergeFacts(PULL_REQUEST, null, 12), "#12");
    pullRequestMerge.error = "GraphQL: Head branch was modified";
    return wrapper.vm.$nextTick().then(() => {
      expect(wrapper.get("[data-merge-error]").text()).toBe("GraphQL: Head branch was modified");
    });
  });
});

describe("MergeModal on GitLab (issue #570)", () => {
  it("shows the method of the project as text and the squash, with no list of methods", () => {
    const wrapper = showWindow(gitlabMergeFacts(MERGE_REQUEST, null, { merge_method: "rebase_merge", squash_option: "default_off" }, 7), "!7");
    expect(wrapper.get("h2").text()).toBe("Merge the merge request !7?");
    expect(wrapper.find("select").exists()).toBe(false);
    expect(wrapper.get("[data-merge-gitlab-method]").text()).toBe("Merge method of the project: merge commit with a rebased branch");
    expect(wrapper.get("[data-merge-squash]").attributes("disabled")).toBeUndefined();
  });

  it("locks the squash when the project always squashes", () => {
    const wrapper = showWindow(gitlabMergeFacts(MERGE_REQUEST, null, { squash_option: "always" }, 7), "!7");
    expect(wrapper.get("[data-merge-squash]").attributes("disabled")).toBeDefined();
    expect(wrapper.text()).toContain("The project always squashes the commits.");
  });
});
