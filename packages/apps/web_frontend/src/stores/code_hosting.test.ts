import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import type { RefContext } from "../lib/refs";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("../lib/refs", async (importOriginal) => {
  const original = await importOriginal<typeof import("../lib/refs")>();
  return { ...original, refContext: vi.fn() };
});

import { refContext } from "../lib/refs";
import {
  codeHosting,
  codeHostingGroupTitle,
  forgeOfContext,
  itemPrefix,
  loadCodeHosting,
  readCodeHostingForge,
  searchCodeHosting,
  type CodeHostingItem,
} from "./code_hosting";

/** The context of a repository on `forge`, with a remote address. */
function contextOf(forge: "github" | "gitlab" | null, base: string | null = "https://example.com/team/app"): RefContext {
  return { base, origin: "https://example.com", forge, ticketUrl: null, ticketPrefixes: [], enabled: true };
}

/** The calls of `forge_cli`: the tool and the arguments of each call, in order. */
function forgeCalls(): { tool: string; args: string[] }[] {
  return vi.mocked(invoke).mock.calls.map(([, payload]) => {
    const { tool, args } = payload as { tool: string; args: string[] };
    return { tool, args };
  });
}

/** An item with only the three fields that every test needs. */
function itemOf(number: number, title: string, url: string): CodeHostingItem {
  return { number, title, url, author: null, createdAt: null, labels: [], isDraft: false, headBranch: null, baseBranch: null };
}

beforeEach(() => {
  vi.mocked(invoke).mockReset();
  vi.mocked(refContext).mockReset();
  codeHosting.issues = [];
  codeHosting.requests = [];
  codeHosting.forge = null;
  codeHosting.status = "idle";
  codeHosting.error = "";
  codeHosting.search = { issues: "", requests: "" };
  codeHosting.listStatus = { issues: "idle", requests: "idle" };
  codeHosting.listError = { issues: "", requests: "" };
});

describe("loadCodeHosting on GitHub", () => {
  beforeEach(() => {
    vi.mocked(refContext).mockResolvedValue(contextOf("github"));
    vi.mocked(invoke).mockImplementation(async (_command, payload) => {
      const { args } = payload as { args: string[] };
      return JSON.stringify(
        args[0] === "issue"
          ? [
              {
                number: 370,
                title: "Add the Code hosting sidebar section",
                url: "https://github.com/o/r/issues/370",
                author: { login: "jeromeetienne" },
                createdAt: "2026-10-13T09:30:00Z",
                labels: [{ name: "Design", color: "1d76db" }, { name: "Simple Work", color: "2ea043" }],
              },
            ]
          : [
              {
                number: 371,
                title: "Fix a thing",
                url: "https://github.com/o/r/pull/371",
                author: { login: "erictang" },
                createdAt: "2026-10-12T08:00:00Z",
                isDraft: true,
                headRefName: "fix-a-thing-371",
                baseRefName: "dev_jerome",
              },
            ],
      );
    });
  });

  it("reads the open issues and the open pull requests with gh, in the folder of the repository", async () => {
    await loadCodeHosting("/work/heidrun");
    expect(forgeCalls()).toEqual([
      {
        tool: "gh",
        args: ["issue", "list", "--state", "open", "--limit", "100", "--json", "number,title,url,author,createdAt,labels"],
      },
      {
        tool: "gh",
        args: [
          "pr",
          "list",
          "--state",
          "open",
          "--limit",
          "100",
          "--json",
          "number,title,url,author,createdAt,isDraft,headRefName,baseRefName",
        ],
      },
    ]);
    expect(vi.mocked(invoke).mock.calls.map(([command, payload]) => [command, (payload as { cwd: string }).cwd])).toEqual([
      ["forge_cli_cached", "/work/heidrun"],
      ["forge_cli_cached", "/work/heidrun"],
    ]);
  });

  it("uses the cache of the answers by default, and asks GitHub again after a refresh", async () => {
    await loadCodeHosting("/work/heidrun");
    expect(vi.mocked(invoke).mock.calls.map(([, payload]) => (payload as { refresh: boolean }).refresh)).toEqual([false, false]);
    vi.mocked(invoke).mockClear();
    await loadCodeHosting("/work/heidrun", true);
    expect(vi.mocked(invoke).mock.calls.map(([, payload]) => (payload as { refresh: boolean }).refresh)).toEqual([true, true]);
  });

  it("keeps the answers of the lists until a refresh, whatever their age (issue #870)", async () => {
    await loadCodeHosting("/work/heidrun");
    await searchCodeHosting("/work/heidrun", "issues", "label:bug");
    await loadCodeHosting("/work/heidrun", true);
    const kept = vi.mocked(invoke).mock.calls.map(([, payload]) => (payload as { keepUntilRefresh: boolean }).keepUntilRefresh);
    expect(kept).toEqual([true, true, true, true, true]);
  });

  it("names the Code hosting sidebar section as the caller, for the application log (issue #879)", async () => {
    await loadCodeHosting("/work/heidrun");
    const callers = vi.mocked(invoke).mock.calls.map(([, payload]) => (payload as { caller: string }).caller);
    expect(callers).toEqual(["code_hosting_list", "code_hosting_list"]);
  });

  it("keeps the number, the title, the address, the author, the date, the labels, the draft mark, and the branches of each item", async () => {
    await loadCodeHosting("/work/heidrun");
    expect(codeHosting.status).toBe("ready");
    expect(codeHosting.forge).toBe("github");
    expect(codeHosting.webBase).toBe("https://example.com/team/app");
    expect(codeHosting.issues).toEqual([
      {
        number: 370,
        title: "Add the Code hosting sidebar section",
        url: "https://github.com/o/r/issues/370",
        author: "jeromeetienne",
        createdAt: Date.parse("2026-10-13T09:30:00Z"),
        labels: [
          { name: "Design", color: "1d76db" },
          { name: "Simple Work", color: "2ea043" },
        ],
        isDraft: false,
        headBranch: null,
        baseBranch: null,
      },
    ]);
    expect(codeHosting.requests).toEqual([
      {
        number: 371,
        title: "Fix a thing",
        url: "https://github.com/o/r/pull/371",
        author: "erictang",
        createdAt: Date.parse("2026-10-12T08:00:00Z"),
        labels: [],
        isDraft: true,
        headBranch: "fix-a-thing-371",
        baseBranch: "dev_jerome",
      },
    ]);
  });

  it("keeps an item without author, date, or labels, as nothing", async () => {
    vi.mocked(invoke).mockImplementation(async () => JSON.stringify([{ number: 1, title: "Bare", url: "https://x/1", author: null }]));
    await loadCodeHosting("/work/heidrun");
    expect(codeHosting.issues).toEqual([
      { number: 1, title: "Bare", url: "https://x/1", author: null, createdAt: null, labels: [], isDraft: false, headBranch: null, baseBranch: null },
    ]);
  });
});

describe("loadCodeHosting on GitLab", () => {
  it("reads the open issues and the open merge requests with the API of glab, and keeps the number, the title, and the address", async () => {
    vi.mocked(refContext).mockResolvedValue(contextOf("gitlab"));
    vi.mocked(invoke).mockImplementation(async (_command, payload) => {
      const { args } = payload as { args: string[] };
      return JSON.stringify(
        args[1].startsWith("projects/:fullpath/issues")
          ? [
              {
                iid: 12,
                title: "An issue",
                web_url: "https://gitlab.com/t/a/-/issues/12",
                author: { username: "jerome" },
                created_at: "2026-10-13T09:30:00Z",
                labels: [{ name: "bug", color: "#d73a4a" }, "plain"],
              },
            ]
          : [
              {
                iid: 5,
                title: "A merge request",
                web_url: "https://gitlab.com/t/a/-/merge_requests/5",
                author: { username: "eric" },
                created_at: "2026-10-12T08:00:00Z",
                draft: true,
                source_branch: "fix-5",
                target_branch: "main",
              },
            ],
      );
    });
    await loadCodeHosting("/work/app");
    expect(forgeCalls()).toEqual([
      { tool: "glab", args: ["api", "projects/:fullpath/issues?state=opened&per_page=100&with_labels_details=true"] },
      { tool: "glab", args: ["api", "projects/:fullpath/merge_requests?state=opened&per_page=100"] },
    ]);
    expect(codeHosting.forge).toBe("gitlab");
    expect(codeHosting.issues).toEqual([
      {
        number: 12,
        title: "An issue",
        url: "https://gitlab.com/t/a/-/issues/12",
        author: "jerome",
        createdAt: Date.parse("2026-10-13T09:30:00Z"),
        labels: [
          { name: "bug", color: "d73a4a" },
          { name: "plain", color: null },
        ],
        isDraft: false,
        headBranch: null,
        baseBranch: null,
      },
    ]);
    expect(codeHosting.requests).toEqual([
      {
        number: 5,
        title: "A merge request",
        url: "https://gitlab.com/t/a/-/merge_requests/5",
        author: "eric",
        createdAt: Date.parse("2026-10-12T08:00:00Z"),
        labels: [],
        isDraft: true,
        headBranch: "fix-5",
        baseBranch: "main",
      },
    ]);
  });

  it("treats a host that is not GitHub as GitLab when the context does not name the forge", async () => {
    vi.mocked(refContext).mockResolvedValue(contextOf(null));
    vi.mocked(invoke).mockResolvedValue("[]");
    await loadCodeHosting("/work/app");
    expect(forgeCalls().map((call) => call.tool)).toEqual(["glab", "glab"]);
    expect(codeHosting.forge).toBe("gitlab");
  });
});

describe("searchCodeHosting on GitHub", () => {
  beforeEach(async () => {
    vi.mocked(refContext).mockResolvedValue(contextOf("github"));
    vi.mocked(invoke).mockResolvedValue("[]");
    await loadCodeHosting("/work/heidrun");
    vi.mocked(invoke).mockClear();
  });

  it("gives the search to gh as it is, after --limit and before --json, and reads only the list that it is for", async () => {
    await searchCodeHosting("/work/heidrun", "issues", "  author:@me -label:bug  ");
    expect(codeHosting.search.issues).toBe("author:@me -label:bug");
    expect(codeHosting.search.requests).toBe("");
    expect(forgeCalls().map((call) => call.args.slice(0, 8))).toEqual([
      ["issue", "list", "--state", "open", "--limit", "100", "--search", "author:@me -label:bug"],
    ]);
    expect(forgeCalls()[0].args[8]).toBe("--json");
  });

  it("gives the search of the list of pull requests to gh pr list, and reads no issue", async () => {
    await searchCodeHosting("/work/heidrun", "requests", "review-requested:@me");
    expect(codeHosting.search.requests).toBe("review-requested:@me");
    expect(codeHosting.search.issues).toBe("");
    expect(forgeCalls().map((call) => call.args.slice(0, 8))).toEqual([
      ["pr", "list", "--state", "open", "--limit", "100", "--search", "review-requested:@me"],
    ]);
  });

  it("does not change the other list: its items, its search, and its status stay", async () => {
    vi.mocked(invoke).mockImplementation(async (_command, payload) => {
      const { args } = payload as { args: string[] };
      return JSON.stringify(
        args[0] === "issue"
          ? [{ number: 1, title: "an issue", url: "https://x/1" }]
          : [{ number: 2, title: "a pull request", url: "https://x/2" }],
      );
    });
    await loadCodeHosting("/work/heidrun");
    await searchCodeHosting("/work/heidrun", "issues", "label:bug");
    expect(codeHosting.requests.map((item) => item.number)).toEqual([2]);
    expect(codeHosting.search.requests).toBe("");
    expect(codeHosting.listStatus).toEqual({ issues: "ready", requests: "ready" });
  });

  it("reads all the items when the search names a state, so that the search decides", async () => {
    await searchCodeHosting("/work/heidrun", "issues", "is:closed");
    expect(forgeCalls().map((call) => call.args.slice(2, 4))).toEqual([["--state", "all"]]);
  });

  it("shows all the open items of the list again for an empty search", async () => {
    await searchCodeHosting("/work/heidrun", "issues", "label:bug");
    vi.mocked(invoke).mockClear();
    await searchCodeHosting("/work/heidrun", "issues", "   ");
    expect(codeHosting.search.issues).toBe("");
    expect(forgeCalls()[0].args).toEqual([
      "issue",
      "list",
      "--state",
      "open",
      "--limit",
      "100",
      "--json",
      "number,title,url,author,createdAt,labels",
    ]);
  });

  it("keeps the search of each list when the lists load again, for a refresh or for another repository", async () => {
    await searchCodeHosting("/work/heidrun", "issues", "label:bug");
    await searchCodeHosting("/work/heidrun", "requests", "review-requested:@me");
    vi.mocked(invoke).mockClear();
    await loadCodeHosting("/work/other", true);
    expect(forgeCalls().map((call) => call.args.slice(0, 8))).toEqual([
      ["issue", "list", "--state", "open", "--limit", "100", "--search", "label:bug"],
      ["pr", "list", "--state", "open", "--limit", "100", "--search", "review-requested:@me"],
    ]);
  });

  it("keeps the items that gh answers for the search", async () => {
    vi.mocked(invoke).mockResolvedValue(
      JSON.stringify([{ number: 7, title: "Found", url: "https://github.com/o/r/issues/7", author: { login: "eric" } }]),
    );
    await searchCodeHosting("/work/heidrun", "issues", "author:eric");
    expect(codeHosting.listStatus.issues).toBe("ready");
    expect(codeHosting.issues.map((item) => item.number)).toEqual([7]);
  });

  it("loads the two lists, each one with its own search, when the hosting service is not known yet", async () => {
    codeHosting.forge = null;
    vi.mocked(invoke).mockClear();
    await searchCodeHosting("/work/heidrun", "issues", "label:bug");
    expect(forgeCalls().map((call) => call.args.slice(0, 2))).toEqual([
      ["issue", "list"],
      ["pr", "list"],
    ]);
    expect(forgeCalls()[0].args).toContain("label:bug");
    expect(forgeCalls()[1].args).not.toContain("--search");
  });

  it("shows the failure in the list that failed only, and keeps the other list", async () => {
    vi.mocked(invoke).mockRejectedValue("gh: rate limit\nwait");
    await searchCodeHosting("/work/heidrun", "issues", "label:bug");
    expect(codeHosting.listStatus).toEqual({ issues: "failed", requests: "ready" });
    expect(codeHosting.listError.issues).toBe("gh: rate limit");
    expect(codeHosting.listError.requests).toBe("");
    expect(codeHosting.status).toBe("ready");
  });

  it("shows the local time of the reset when the GitHub rate limit is exceeded", async () => {
    const reset = new Date(2026, 9, 25, 14, 7).getTime() / 1000;
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 25, 13, 58));
    vi.mocked(invoke).mockImplementation(async (command) => {
      if (command === "forge_rate_limit_reset") {
        return reset;
      }
      throw "GraphQL: API rate limit already exceeded for user ID 252962.";
    });
    await searchCodeHosting("/work/heidrun", "issues", "data");
    vi.useRealTimers();
    expect(codeHosting.listError.issues).toBe("GitHub rate limit exceeded. Resets at 02:07 PM.");
    expect(vi.mocked(invoke).mock.calls).toContainEqual(["forge_rate_limit_reset", { cwd: "/work/heidrun" }]);
  });

  it("keeps the failure of gh when the rate limit is not exceeded or its reset cannot be read", async () => {
    vi.mocked(invoke).mockImplementation(async (command) => {
      if (command === "forge_rate_limit_reset") {
        return null;
      }
      throw "GraphQL: API rate limit already exceeded for user ID 252962.";
    });
    await searchCodeHosting("/work/heidrun", "issues", "data");
    expect(codeHosting.listError.issues).toBe("GraphQL: API rate limit already exceeded for user ID 252962.");
    vi.mocked(invoke).mockClear();
    vi.mocked(invoke).mockRejectedValue("gh: not logged in");
    await searchCodeHosting("/work/heidrun", "issues", "data");
    expect(codeHosting.listError.issues).toBe("gh: not logged in");
    expect(vi.mocked(invoke).mock.calls.map(([command]) => command)).not.toContain("forge_rate_limit_reset");
  });

  it("ignores the answer of an older search of a list that ends after a newer search of the same list", async () => {
    let answerOlder: (text: string) => void = () => {};
    vi.mocked(invoke).mockImplementationOnce(() => new Promise((resolve) => (answerOlder = resolve)));
    const older = searchCodeHosting("/work/heidrun", "issues", "label:old");
    await vi.waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
    vi.mocked(invoke).mockImplementation(async () => JSON.stringify([{ number: 9, title: "newer", url: "https://x/9" }]));
    await searchCodeHosting("/work/heidrun", "issues", "label:new");
    answerOlder(JSON.stringify([{ number: 1, title: "older", url: "https://x/1" }]));
    await older;
    expect(codeHosting.issues.map((item) => item.title)).toEqual(["newer"]);
  });
});

describe("searchCodeHosting on GitLab", () => {
  /** Answers `glab api user` with a login, and every other call with an empty list, then loads the two lists. */
  async function answerGitlab() {
    vi.mocked(refContext).mockResolvedValue(contextOf("gitlab"));
    vi.mocked(invoke).mockImplementation(async (_command, payload) => {
      const { args } = payload as { args: string[] };
      return args[1] === "user" ? JSON.stringify({ username: "jerome" }) : "[]";
    });
    await loadCodeHosting("/work/app");
    vi.mocked(invoke).mockClear();
  }

  it("translates the search into the filters of GitLab, for the list of issues only", async () => {
    await answerGitlab();
    await searchCodeHosting("/work/app", "issues", "label:bug -author:eric");
    expect(forgeCalls()).toEqual([
      {
        tool: "glab",
        args: [
          "api",
          "projects/:fullpath/issues?state=opened&not%5Bauthor_username%5D=eric&labels=bug&per_page=100&with_labels_details=true",
        ],
      },
    ]);
    expect(codeHosting.listStatus.issues).toBe("ready");
  });

  it("translates the search into the filters of GitLab, for the list of merge requests only", async () => {
    await answerGitlab();
    await searchCodeHosting("/work/app", "requests", "label:bug");
    expect(forgeCalls()).toEqual([
      { tool: "glab", args: ["api", "projects/:fullpath/merge_requests?state=opened&labels=bug&per_page=100"] },
    ]);
  });

  it("reads the login with glab api user for @me, and does not read it when the search has no @me", async () => {
    await answerGitlab();
    await searchCodeHosting("/work/app", "issues", "author:@me");
    expect(forgeCalls()[0]).toEqual({ tool: "glab", args: ["api", "user"] });
    expect(forgeCalls()[1].args[1]).toBe("projects/:fullpath/issues?state=opened&author_username=jerome&per_page=100&with_labels_details=true");
    vi.mocked(invoke).mockClear();
    await searchCodeHosting("/work/app", "issues", "label:bug");
    expect(forgeCalls().map((call) => call.args[1])).not.toContain("user");
  });

  it("says that GitLab cannot do a word, names it, and shows no item in this list only", async () => {
    await answerGitlab();
    await searchCodeHosting("/work/app", "issues", "label:bug mentions:eric");
    expect(codeHosting.listStatus).toEqual({ issues: "failed", requests: "ready" });
    expect(codeHosting.listError.issues).toBe("GitLab cannot do this search: mentions:eric");
    expect(codeHosting.listError.requests).toBe("");
    expect(forgeCalls()).toEqual([]);
    expect(codeHosting.issues).toEqual([]);
  });

  it("says that GitLab cannot do a word before it asks glab for the login, even when the search has @me", async () => {
    await answerGitlab();
    await searchCodeHosting("/work/app", "requests", "author:@me mentions:eric");
    expect(codeHosting.listError.requests).toBe("GitLab cannot do this search: mentions:eric");
    expect(forgeCalls()).toEqual([]);
  });

  it("calls GitLab for no list that the search leaves empty, such as the issues for review-requested", async () => {
    await answerGitlab();
    await searchCodeHosting("/work/app", "issues", "review-requested:eric");
    expect(forgeCalls()).toEqual([]);
    expect(codeHosting.listStatus.issues).toBe("ready");
    expect(codeHosting.issues).toEqual([]);
    await searchCodeHosting("/work/app", "requests", "review-requested:eric");
    expect(forgeCalls()).toEqual([
      { tool: "glab", args: ["api", "projects/:fullpath/merge_requests?state=opened&reviewer_username=eric&per_page=100"] },
    ]);
  });

  it("shows the failure of glab api user as the first line of the failure of the list", async () => {
    await answerGitlab();
    vi.mocked(invoke).mockRejectedValue(new Error("glab: not signed in\nmore"));
    await searchCodeHosting("/work/app", "issues", "author:@me");
    expect(codeHosting.listStatus.issues).toBe("failed");
    expect(codeHosting.listError.issues).toBe("Error: glab: not signed in");
  });
});

describe("loadCodeHosting when nothing can be read", () => {
  it("is idle and empty for no folder, and calls nothing", async () => {
    await loadCodeHosting(null);
    expect(codeHosting.status).toBe("idle");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("says noRemote for a repository without a remote address, and calls nothing", async () => {
    vi.mocked(refContext).mockResolvedValue(contextOf(null, null));
    await loadCodeHosting("/work/local");
    expect(codeHosting.status).toBe("noRemote");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("says failed with the first line of the failure, in each list, and empty lists, when gh does not answer", async () => {
    vi.mocked(refContext).mockResolvedValue(contextOf("github"));
    vi.mocked(invoke).mockRejectedValue("gh: not logged in\nrun gh auth login");
    await loadCodeHosting("/work/heidrun");
    expect(codeHosting.status).toBe("ready");
    expect(codeHosting.listStatus).toEqual({ issues: "failed", requests: "failed" });
    expect(codeHosting.listError).toEqual({ issues: "gh: not logged in", requests: "gh: not logged in" });
    expect(codeHosting.issues).toEqual([]);
    expect(codeHosting.requests).toEqual([]);
  });

  it("says failed with the first line of the failure when the remote address cannot be read", async () => {
    vi.mocked(refContext).mockRejectedValue("git: not a repository\nmore");
    await loadCodeHosting("/work/heidrun");
    expect(codeHosting.status).toBe("failed");
    expect(codeHosting.error).toBe("git: not a repository");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("empties the lists of the earlier repository while the next one loads", async () => {
    codeHosting.issues = [itemOf(1, "old", "https://x/1")];
    vi.mocked(refContext).mockReturnValue(new Promise(() => {}));
    void loadCodeHosting("/work/other");
    expect(codeHosting.status).toBe("loading");
    expect(codeHosting.issues).toEqual([]);
  });

  it("ignores the answer of an older load that ends after a newer load", async () => {
    vi.mocked(refContext).mockResolvedValue(contextOf("github"));
    let answerOlder: (text: string) => void = () => {};
    vi.mocked(invoke).mockImplementationOnce(() => new Promise((resolve) => (answerOlder = resolve)));
    vi.mocked(invoke).mockImplementationOnce(async () => "[]");
    const older = loadCodeHosting("/work/older");
    await vi.waitFor(() => expect(invoke).toHaveBeenCalledTimes(2));
    vi.mocked(invoke).mockImplementation(async (_command, payload) =>
      JSON.stringify(
        (payload as { args: string[] }).args[0] === "issue"
          ? [{ number: 9, title: "newer", url: "https://x/9" }]
          : [],
      ),
    );
    await loadCodeHosting("/work/newer");
    answerOlder(JSON.stringify([{ number: 1, title: "older", url: "https://x/1" }]));
    await older;
    expect(codeHosting.issues.map((item) => item.title)).toEqual(["newer"]);
  });
});

describe("forgeOfContext", () => {
  it("is github for a remote address on GitHub, and gitlab for any other host", () => {
    expect(forgeOfContext(contextOf("github"))).toBe("github");
    expect(forgeOfContext(contextOf("gitlab"))).toBe("gitlab");
    expect(forgeOfContext(contextOf(null))).toBe("gitlab");
  });

  it("is null for a repository without a remote address", () => {
    expect(forgeOfContext(contextOf("github", null))).toBeNull();
    expect(forgeOfContext(contextOf(null, null))).toBeNull();
  });
});

describe("readCodeHostingForge", () => {
  it("reads the hosting service from the remote address, with no call to gh or glab", async () => {
    vi.mocked(refContext).mockResolvedValue(contextOf("github"));
    expect(await readCodeHostingForge("/work/heidrun")).toBe("github");
    vi.mocked(refContext).mockResolvedValue(contextOf(null));
    expect(await readCodeHostingForge("/work/app")).toBe("gitlab");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("is null for no folder, for a repository without a remote address, and when the remote address cannot be read", async () => {
    expect(await readCodeHostingForge(null)).toBeNull();
    expect(refContext).not.toHaveBeenCalled();
    vi.mocked(refContext).mockResolvedValue(contextOf(null, null));
    expect(await readCodeHostingForge("/work/app")).toBeNull();
    vi.mocked(refContext).mockRejectedValue(new Error("no remote"));
    expect(await readCodeHostingForge("/work/app")).toBeNull();
  });
});

describe("itemPrefix", () => {
  it("is ! for a merge request of GitLab, and # for every other item", () => {
    expect(itemPrefix("requests", "gitlab")).toBe("!");
    expect(itemPrefix("requests", "github")).toBe("#");
    expect(itemPrefix("issues", "gitlab")).toBe("#");
    expect(itemPrefix("issues", "github")).toBe("#");
  });
});

describe("codeHostingGroupTitle", () => {
  it("is Issues for the first list, then Pull requests on GitHub and Merge requests on GitLab", () => {
    expect(codeHostingGroupTitle("issues", "github")).toBe("Issues");
    expect(codeHostingGroupTitle("issues", "gitlab")).toBe("Issues");
    expect(codeHostingGroupTitle("requests", "github")).toBe("Pull requests");
    expect(codeHostingGroupTitle("requests", "gitlab")).toBe("Merge requests");
    expect(codeHostingGroupTitle("requests", null)).toBe("Pull requests");
  });
});
