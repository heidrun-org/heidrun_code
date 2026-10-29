import { describe, expect, it } from "vitest";
import { codeHostingDetailLines } from "./code_hosting_rows";
import type { CodeHostingItem } from "../stores/code_hosting";

const NOW = Date.parse("2026-10-13T12:00:00Z");

/** An item that has every field, to change field by field. */
function itemOf(changes: Partial<CodeHostingItem> = {}): CodeHostingItem {
  return {
    number: 370,
    title: "Add the Code hosting sidebar section",
    url: "https://github.com/o/r/issues/370",
    author: "jeromeetienne",
    createdAt: Date.parse("2026-10-10T12:00:00Z"),
    labels: [],
    isDraft: false,
    headBranch: null,
    baseBranch: null,
    approval: null,
    ...changes,
  };
}

describe("codeHostingDetailLines of an issue", () => {
  it("says who opened it and how long ago, then gives the labels with their colors", () => {
    const labels = [
      { name: "Design", color: "1d76db" },
      { name: "Simple Work", color: null },
    ];
    const lines = codeHostingDetailLines("issues", itemOf({ labels }), NOW);
    expect(lines).toEqual({ opened: "jeromeetienne opened 3 days ago", labels, extra: "" });
  });

  it("says that there is no label when the issue has none", () => {
    const lines = codeHostingDetailLines("issues", itemOf(), NOW);
    expect(lines.labels).toEqual([]);
    expect(lines.extra).toBe("No label");
  });

  it("says only how long ago when the author is not known, and only the author when the date is not known", () => {
    expect(codeHostingDetailLines("issues", itemOf({ author: null }), NOW).opened).toBe("Opened 3 days ago");
    expect(codeHostingDetailLines("issues", itemOf({ createdAt: null }), NOW).opened).toBe("jeromeetienne");
    expect(codeHostingDetailLines("issues", itemOf({ author: null, createdAt: null }), NOW).opened).toBe("");
  });
});

describe("codeHostingDetailLines of a pull request or of a merge request", () => {
  it("shows the branch with the changes, an arrow, then the branch that receives them", () => {
    const item = itemOf({ headBranch: "fix-a-thing-371", baseBranch: "dev_jerome" });
    expect(codeHostingDetailLines("requests", item, NOW).extra).toBe("fix-a-thing-371 → dev_jerome");
  });

  it("adds Draft to the first line of a draft", () => {
    const item = itemOf({ isDraft: true, headBranch: "a", baseBranch: "b" });
    expect(codeHostingDetailLines("requests", item, NOW).opened).toBe("jeromeetienne opened 3 days ago · Draft");
    expect(codeHostingDetailLines("requests", itemOf({ isDraft: true, author: null, createdAt: null }), NOW).opened).toBe("Draft");
  });

  it("shows an empty second line when a branch is not known, and never the labels", () => {
    const lines = codeHostingDetailLines("requests", itemOf({ labels: [{ name: "x", color: null }] }), NOW);
    expect(lines.extra).toBe("");
    expect(lines.labels).toEqual([]);
    expect(codeHostingDetailLines("requests", itemOf({ headBranch: "a" }), NOW).extra).toBe("");
  });
});

describe("codeHostingDetailLines of a pull request with an approval state (issue #570)", () => {
  it("adds the approval state after the date, and after Draft", () => {
    const branches = { headBranch: "feature-one", baseBranch: "main" };
    expect(codeHostingDetailLines("requests", itemOf({ ...branches, approval: "approved" }), NOW).opened).toBe("jeromeetienne opened 3 days ago · Approved");
    const draft = itemOf({ ...branches, isDraft: true, approval: "reviewRequired" });
    expect(codeHostingDetailLines("requests", draft, NOW).opened).toBe("jeromeetienne opened 3 days ago · Draft · Review required");
    expect(codeHostingDetailLines("requests", itemOf({ ...branches, approval: "changesRequested" }), NOW).opened).toBe("jeromeetienne opened 3 days ago · Changes requested");
  });
});
