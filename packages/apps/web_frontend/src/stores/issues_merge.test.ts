import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("../lib/refs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/refs")>()),
  refContext: vi.fn(async () => ({ base: "https://github.com/o/r", origin: "https://github.com", forge: "github", ticketUrl: null, ticketPrefixes: [], enabled: true })),
}));

import { issueView, openIssue } from "./issues";

const PULL_REQUEST = {
  title: "Sandbox: feature-one",
  body: "",
  state: "OPEN",
  url: "https://github.com/o/r/pull/12",
  mergeStateStatus: "CLEAN",
  reviewDecision: "APPROVED",
  headRefName: "feature-one",
  baseRefName: "main",
};

beforeEach(() => {
  invoke.mockReset();
  invoke.mockImplementation((_command: string, payload: { args: string[] }) =>
    Promise.resolve(JSON.stringify(payload.args[0] === "api" ? { allow_squash_merge: true } : PULL_REQUEST)),
  );
});

describe("openIssue, the merge bar of the issue preview window (issue #570)", () => {
  it("reads the merge facts of a pull request of the repository of the workspace", async () => {
    await openIssue("/work/sandbox", { type: "mr", number: 12 }, null);
    expect(issueView.data?.ref).toBe("#12");
    expect(issueView.merge?.folder).toBe("/work/sandbox");
    expect(issueView.merge?.webBase).toBe("https://github.com/o/r");
    expect(issueView.merge?.facts.approval).toBe("approved");
  });

  it("shows no merge bar for an issue, or for a pull request of another repository", async () => {
    await openIssue("/work/sandbox", { type: "issue", number: 12 }, null);
    expect(issueView.merge).toBeNull();
    await openIssue("/work/sandbox", { type: "mr", number: 12, project: "other/repo" }, null);
    expect(issueView.merge).toBeNull();
  });
});
