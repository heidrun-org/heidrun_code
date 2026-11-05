import { afterEach, describe, expect, it, vi } from "vitest";
import { enableAutoUnmount, mount } from "@vue/test-utils";

const openMergeWindow = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("../stores/pull_request_merge", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../stores/pull_request_merge")>()),
  openMergeWindow,
}));

import PullRequestMergeBar from "./PullRequestMergeBar.vue";
import { githubMergeFacts, gitlabMergeFacts } from "../stores/pull_request_merge";

enableAutoUnmount(afterEach);

const PULL_REQUEST = { state: "OPEN", mergeStateStatus: "CLEAN", reviewDecision: "APPROVED", latestReviews: [{ state: "APPROVED", author: { login: "jeromeetienne" } }], headRefName: "feature-one", baseRefName: "main" };

function mountBar(facts: ReturnType<typeof githubMergeFacts> | null, name = "#12") {
  return mount(PullRequestMergeBar, { props: { facts, folder: "/work/sandbox", forge: facts?.forge ?? "github", name, webBase: "https://github.com/o/r" } });
}

describe("PullRequestMergeBar (issue #570)", () => {
  it("shows the approval pill and the approvers, and opens the merge window", async () => {
    const wrapper = mountBar(githubMergeFacts(PULL_REQUEST, null, 12));
    expect(wrapper.get("[data-merge-approval]").text()).toBe("Approved");
    expect(wrapper.text()).toContain("Approved by jeromeetienne");
    await wrapper.get("[data-merge-button]").trigger("click");
    expect(openMergeWindow).toHaveBeenCalledWith("/work/sandbox", "github", 12, "#12", "https://github.com/o/r");
  });

  it("disables the button with the reason in its title", () => {
    const wrapper = mountBar(githubMergeFacts({ ...PULL_REQUEST, isDraft: true }, null, 12));
    const button = wrapper.get("[data-merge-button]");
    expect(button.attributes("disabled")).toBeDefined();
    expect(button.attributes("title")).toBe("It is a draft: mark it as ready first.");
  });

  it("shows the approvals that a merge request of GitLab still needs", () => {
    const facts = gitlabMergeFacts({ state: "opened", detailed_merge_status: "not_approved" }, { approved: false, approvals_left: 2, approved_by: [] }, null, 7);
    const wrapper = mountBar(facts, "!7");
    expect(wrapper.get("[data-merge-approval]").text()).toBe("Review required · 2 approvals left");
    expect(wrapper.get("[data-merge-button]").attributes("title")).toBe("A required approval is missing.");
  });

  it("shows nothing for an item that is not open, or when the hosting service did not answer", () => {
    expect(mountBar(githubMergeFacts({ ...PULL_REQUEST, state: "MERGED" }, null, 12)).find("[data-merge-bar]").exists()).toBe(false);
    expect(mountBar(null).find("[data-merge-bar]").exists()).toBe(false);
  });
});
