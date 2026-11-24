import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enableAutoUnmount, mount } from "@vue/test-utils";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn(() => Promise.resolve()) }));

import IssueModal from "./IssueModal.vue";
import { issueView } from "../stores/issues";
import { githubMergeFacts, gitlabMergeFacts, type MergeFacts } from "../stores/pull_request_merge";

enableAutoUnmount(afterEach);

/** Pull request 1043 of the issue: open, on a base branch that asks for no review, and nobody reviewed it. */
const PULL_REQUEST = { state: "OPEN", mergeStateStatus: "CLEAN", reviewDecision: "", latestReviews: [], headRefName: "reorder-launchers-1042", baseRefName: "dev" };

function show(facts: MergeFacts | null, state = "open") {
  Object.assign(issueView, {
    open: true,
    loading: false,
    error: "",
    url: "https://github.com/o/r/pull/1043",
    data: {
      ref: "#1043",
      title: "Launchers: reorder the launchers",
      state,
      stateLevel: state === "open" ? "ok" : "merged",
      author: "edefiez",
      at: null,
      labels: [],
      url: "https://github.com/o/r/pull/1043",
      project: "https://github.com/o/r",
      forge: "GitHub",
      body: "",
      branches: "reorder-launchers-1042 → dev",
      comments: [],
    },
    merge: facts === null ? null : { folder: "/work/sandbox", forge: facts.forge, number: facts.number, webBase: "https://github.com/o/r", facts },
  });
  return mount(IssueModal);
}

beforeEach(() => {
  Object.assign(issueView, { open: false, data: null, merge: null });
});

describe("IssueModal, the approval state in the header (issue #1044)", () => {
  it("shows Not approved next to the state when the repository asks for no review and nobody approved", () => {
    const wrapper = show(githubMergeFacts(PULL_REQUEST, null, 1043));
    const chip = wrapper.get("[data-issue-approval]");
    expect(chip.text()).toBe("Not approved");
    expect(chip.classes()).toContain("muted");
    expect(wrapper.find("[data-merge-approval]").exists()).toBe(false);
  });

  it("shows Approved in green, with the approvers in the title and in the merge bar", () => {
    const approved = { ...PULL_REQUEST, latestReviews: [{ state: "APPROVED", author: { login: "jeromeetienne" } }] };
    const wrapper = show(githubMergeFacts(approved, null, 1043));
    const chip = wrapper.get("[data-issue-approval]");
    expect(chip.text()).toBe("Approved");
    expect(chip.classes()).toContain("ok");
    expect(chip.attributes("title")).toBe("Approved by jeromeetienne");
    expect(wrapper.get("[data-merge-bar]").text()).toContain("Approved by jeromeetienne");
  });

  it("shows the approvals that a merge request of GitLab still needs, in orange", () => {
    const facts = gitlabMergeFacts({ state: "opened", detailed_merge_status: "not_approved" }, { approved: false, approvals_left: 1, approved_by: [] }, null, 7);
    const chip = show(facts).get("[data-issue-approval]");
    expect(chip.text()).toBe("Review required · 1 approval left");
    expect(chip.classes()).toContain("warn");
  });

  it("shows no approval chip for a merged item, for an issue, or when the approvals are unknown", () => {
    expect(show(githubMergeFacts({ ...PULL_REQUEST, state: "MERGED" }, null, 1043), "merged").find("[data-issue-approval]").exists()).toBe(false);
    expect(show(null).find("[data-issue-approval]").exists()).toBe(false);
    const unknown = gitlabMergeFacts({ state: "opened", detailed_merge_status: "mergeable" }, null, null, 7);
    expect(show(unknown).find("[data-issue-approval]").exists()).toBe(false);
  });
});
