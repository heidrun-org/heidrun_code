import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";


vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const ISSUE = { kind: "issue" as const, number: 250, url: null };
const PULL_REQUEST = { kind: "pull_request" as const, number: 249, url: null };

/** The store, as a new run of Heidrun Code sees it: the modules are loaded again, so no synchronization is kept. */
async function startRun() {
  vi.resetModules();
  return import("./chat_references");
}

/** The calls of the Tauri commands of the stored references, by command name, in order. The other stores call `invoke` when they load. */
function commandNames(): string[] {
  return vi.mocked(invoke).mock.calls.map((call) => call[0]).filter((name) => name.startsWith("chat_references_"));
}

/** The synchronization that the Tauri command `chat_references_synchronize` answers. */
const SYNCHRONIZED = { repository: "owner/name", codeHostingError: null };

/** An issue row as the SQLite file stores it. */
function issueRow(parts: Record<string, unknown> = {}) {
  return {
    number: 250,
    title: "Add Chats",
    body: "Goal",
    state: "CLOSED",
    author: "jerome",
    labels: ["Simple Work"],
    labelColors: { "Simple Work": "2ea043" },
    createdAt: "2026-10-11T09:30:00Z",
    ...parts,
  };
}

/** Makes the Tauri commands of GitHub answer: the synchronization, then the rows of the two lists. */
function githubAnswers(rows: { issues?: unknown[]; pullRequests?: unknown[] }) {
  vi.mocked(invoke).mockImplementation(async (command: string) => {
    if (command === "chat_references_synchronize") {
      return SYNCHRONIZED;
    }
    return { issues: rows.issues ?? [], pullRequests: rows.pullRequests ?? [] };
  });
}

beforeEach(() => {
  vi.mocked(invoke).mockReset();
});

describe("loadChatReferenceDetails", () => {
  it("synchronizes the repository of GitHub, reads the stored issue, and gives its details without running gh", async () => {
    githubAnswers({ issues: [issueRow()] });
    const { loadChatReferenceDetails } = await startRun();
    const details = await loadChatReferenceDetails("/work/app", "github", ISSUE);
    expect(commandNames()).toEqual(["chat_references_synchronize", "chat_references_find"]);
    expect(invoke).toHaveBeenCalledWith("chat_references_synchronize", { folder: "/work/app" });
    expect(invoke).toHaveBeenCalledWith("chat_references_find", { repository: "owner/name", issues: [250], pullRequests: [] });
    expect(details).toEqual({
      title: "Add Chats",
      rawState: "closed",
      body: "Goal",
      labels: [{ name: "Simple Work", color: "2ea043" }],
      author: "jerome",
      authorAvatarUrl: "https://github.com/jerome.png?size=48",
      createdAt: Date.parse("2026-10-11T09:30:00Z"),
      headBranch: null,
      baseBranch: null,
    });
  });

  it("reads a stored pull request of GitHub with its two branches", async () => {
    githubAnswers({
      pullRequests: [issueRow({ number: 249, title: "Move", state: "MERGED", headRefName: "move-it", baseRefName: "dev_jerome" })],
    });
    const { loadChatReferenceDetails } = await startRun();
    const details = await loadChatReferenceDetails("/work/app", "github", PULL_REQUEST);
    expect(invoke).toHaveBeenCalledWith("chat_references_find", { repository: "owner/name", issues: [], pullRequests: [249] });
    expect(details).toMatchObject({ title: "Move", rawState: "merged", headBranch: "move-it", baseBranch: "dev_jerome" });
  });

  it("synchronizes a folder once for ten minutes, and again after the ten minutes", async () => {
    githubAnswers({ issues: [issueRow()] });
    const { loadChatReferenceDetails } = await startRun();
    await loadChatReferenceDetails("/work/app", "github", ISSUE);
    await loadChatReferenceDetails("/work/app", "github", ISSUE);
    expect(commandNames().filter((name) => name === "chat_references_synchronize")).toHaveLength(1);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 11 * 60 * 1000);
    await loadChatReferenceDetails("/work/app", "github", ISSUE);
    vi.useRealTimers();
    expect(commandNames().filter((name) => name === "chat_references_synchronize")).toHaveLength(2);
  });

  it("starts the synchronization in the background when the store prepares the folder", async () => {
    githubAnswers({ issues: [issueRow()] });
    const { prepareChatReferences, loadChatReferenceDetails } = await startRun();
    prepareChatReferences("/work/app");
    await loadChatReferenceDetails("/work/app", "github", ISSUE);
    expect(commandNames().filter((name) => name === "chat_references_synchronize")).toHaveLength(1);
  });

  it("gives the stored rows when GitHub could not be read, because the synchronization still answers", async () => {
    vi.mocked(invoke).mockImplementation(async (command: string) =>
      command === "chat_references_synchronize"
        ? { repository: "owner/name", codeHostingError: "no network" }
        : { issues: [issueRow()], pullRequests: [] },
    );
    const { loadChatReferenceDetails } = await startRun();
    expect(await loadChatReferenceDetails("/work/app", "github", ISSUE)).toMatchObject({ title: "Add Chats" });
  });

  it("gives null for a number that the SQLite file does not hold, and synchronizes again only when the first synchronization is old", async () => {
    githubAnswers({});
    const { loadChatReferenceDetails } = await startRun();
    expect(await loadChatReferenceDetails("/work/app", "github", ISSUE)).toBeNull();
    expect(commandNames().filter((name) => name === "chat_references_synchronize")).toHaveLength(1);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 2 * 60 * 1000);
    expect(await loadChatReferenceDetails("/work/app", "github", ISSUE)).toBeNull();
    vi.useRealTimers();
    expect(commandNames().filter((name) => name === "chat_references_synchronize")).toHaveLength(2);
  });

  it("gives no picture for an author of GitHub that is not a person, for example a bot such as app/dependabot", async () => {
    githubAnswers({ pullRequests: [issueRow({ number: 249, author: "app/dependabot", headRefName: "bump", baseRefName: "main" })] });
    const { loadChatReferenceDetails } = await startRun();
    expect(await loadChatReferenceDetails("/work/app", "github", PULL_REQUEST)).toMatchObject({
      author: "app/dependabot",
      authorAvatarUrl: null,
    });
  });

  it("gives null, and tries the synchronization again at the next call, when the synchronization fails", async () => {
    vi.mocked(invoke).mockRejectedValue("not a Git repository");
    const { loadChatReferenceDetails } = await startRun();
    expect(await loadChatReferenceDetails("/work/app", "github", ISSUE)).toBeNull();
    expect(await loadChatReferenceDetails("/work/app", "github", ISSUE)).toBeNull();
    expect(commandNames().filter((name) => name === "chat_references_synchronize")).toHaveLength(2);
  });

  it("reads an issue and a merge request of GitLab, and says open for the state opened", async () => {
    const { loadChatReferenceDetails } = await startRun();
    vi.mocked(invoke).mockResolvedValue(
      JSON.stringify({
        title: "Fix",
        state: "opened",
        description: "Text",
        labels: ["bug"],
        author: { username: "jerome" },
        created_at: "2026-10-11T09:30:00Z",
        source_branch: "fix-it",
        target_branch: "main",
      }),
    );
    const issue = await loadChatReferenceDetails("/work/app", "gitlab", ISSUE);
    expect(invoke).toHaveBeenLastCalledWith("forge_cli_cached", {
      cwd: "/work/app",
      tool: "glab",
      args: ["api", "projects/:fullpath/issues/250"],
      refresh: false,
      keepUntilRefresh: false,
      caller: "reference_card",
    });
    expect(issue).toMatchObject({ rawState: "open", body: "Text", labels: [{ name: "bug", color: null }], author: "jerome" });
    await loadChatReferenceDetails("/work/app", "gitlab", PULL_REQUEST);
    expect(vi.mocked(invoke).mock.lastCall?.[1]).toMatchObject({ args: ["api", "projects/:fullpath/merge_requests/249"] });
  });

  it("gives the picture of the author of a GitLab item as the address that GitLab sends, and null for an address that is not a web address", async () => {
    const { loadChatReferenceDetails } = await startRun();
    vi.mocked(invoke).mockResolvedValue(
      JSON.stringify({ title: "Fix", state: "opened", author: { username: "jerome", avatar_url: "https://gitlab.com/uploads/-/system/user/avatar/1/a.png" } }),
    );
    expect(await loadChatReferenceDetails("/work/app", "gitlab", ISSUE)).toMatchObject({
      authorAvatarUrl: "https://gitlab.com/uploads/-/system/user/avatar/1/a.png",
    });
    vi.mocked(invoke).mockResolvedValue(
      JSON.stringify({ title: "Fix", state: "opened", author: { username: "jerome", avatar_url: "javascript:alert(1)" } }),
    );
    expect(await loadChatReferenceDetails("/work/app", "gitlab", ISSUE)).toMatchObject({ authorAvatarUrl: null });
  });


  it("gives null for GitLab when the command does not answer, or answers with something that is not JSON", async () => {
    const { loadChatReferenceDetails } = await startRun();
    vi.mocked(invoke).mockRejectedValueOnce("glab: not logged in");
    expect(await loadChatReferenceDetails("/work/app", "gitlab", ISSUE)).toBeNull();
    vi.mocked(invoke).mockResolvedValueOnce("not json");
    expect(await loadChatReferenceDetails("/work/app", "gitlab", ISSUE)).toBeNull();
  });
});
