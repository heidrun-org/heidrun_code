import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import type { Chat } from "./chats";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

/** The place of the repository in every test. */
const CONTEXT = { folder: "/work/app", root: "/work/app", forge: "github" as const };

/** A chat of the test. */
function chat(id: string, parts: { title?: string; lastAt?: number; issues?: number[]; messages?: string[]; files?: string[] } = {}): Chat {
  return {
    id,
    title: parts.title ?? "",
    updated_at: 1,
    meta: {
      first_at: null,
      last_at: parts.lastAt ?? 100,
      user_messages: 0,
      first_messages: parts.messages ?? [],
      folders: [],
      issues: parts.issues ?? [],
      pull_requests: [],
      files_written: parts.files ?? [],
    },
  };
}

/** The calls of the Tauri command `chat_references_find`, which reads the stored title of an issue. */
function forgeCalls() {
  return vi.mocked(invoke).mock.calls.filter(([command]) => command === "chat_references_find");
}

/** The numbers of the issues that the calls of `chat_references_find` asked for, in the order of the calls. */
function askedIssueNumbers() {
  return forgeCalls().map((call) => String((call[1] as { issues: number[] }).issues[0]));
}

/**
 * Makes the Tauri commands of the stored issues answer: `chat_references_synchronize` gives the repository, and
 * `chat_references_find` gives the title of each issue from `titles`, and no row for another issue.
 */
function forgeAnswers(titles: Record<number, string>) {
  vi.mocked(invoke).mockImplementation(async (command, args) => {
    if (command === "chat_references_synchronize") {
      return { repository: "owner/name", codeHostingError: null };
    }
    if (command !== "chat_references_find") {
      return undefined;
    }
    const numbers = (args as { issues: number[] }).issues;
    const issues = numbers
      .filter((number) => titles[number] !== undefined)
      .map((number) => ({
        number,
        title: titles[number],
        body: "",
        state: "OPEN",
        author: "me",
        labels: [],
        labelColors: {},
        createdAt: "2026-10-11T10:00:00Z",
      }));
    return { issues, pullRequests: [] };
  });
}

/** The store, as a new run of Heidrun Code sees it: the modules are loaded again, and `localStorage` keeps what was saved. */
async function startRun() {
  vi.resetModules();
  return import("./dynamic_topics");
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(invoke).mockReset();
});

describe("prepareKeywordTopics", () => {
  it("makes an entry at once from the title, the first messages, and the folders of the files", async () => {
    const store = await startRun();
    await store.prepareKeywordTopics(
      [chat("a", { title: "Sidebar cache", messages: ["tune the cache"], files: ["/work/app/src/stores/a.ts"] })],
      CONTEXT,
    );
    expect(store.keywordEntries.a).toEqual({
      lastAt: 100,
      isComplete: true,
      terms: { sidebar: 3, cache: 4, tune: 1, src: 1, store: 1 },
    });
  });

  it("reads the stored title of each issue with the Tauri command chat_references_find, and makes the entry again with the titles", async () => {
    forgeAnswers({ 260: "Add dynamic topics" });
    const store = await startRun();
    await store.prepareKeywordTopics([chat("a", { title: "Sidebar", issues: [260] })], CONTEXT);
    expect(forgeCalls()).toHaveLength(1);
    expect(invoke).toHaveBeenCalledWith("chat_references_find", {
      repository: "owner/name",
      issues: [260],
      pullRequests: [],
    });
    expect(store.keywordEntries.a).toEqual({
      lastAt: 100,
      isComplete: true,
      terms: { sidebar: 3, dynamic: 2, topic: 2 },
    });
  });

  it("shows the topics from the first three parts while the titles are not read, and with the titles after", async () => {
    forgeAnswers({ 260: "Zebra" });
    const store = await startRun();
    const chats = [chat("a", { title: "Sidebar", issues: [260] }), chat("b", { title: "Cache" })];
    const reading = store.prepareKeywordTopics(chats, CONTEXT);
    expect(store.keywordEntries.a.isComplete).toBe(false);
    expect(store.keywordTopicsOf(chats).get("a")).toEqual(["sidebar"]);
    await reading;
    expect(store.keywordTopicsOf(chats).get("a")).toEqual(["sidebar", "zebra"]);
  });

  it("does not read anything again for a chat whose last message did not change", async () => {
    forgeAnswers({ 260: "Add dynamic topics" });
    const store = await startRun();
    const chats = [chat("a", { title: "Sidebar", issues: [260] })];
    await store.prepareKeywordTopics(chats, CONTEXT);
    const entry = store.keywordEntries.a;
    await store.prepareKeywordTopics(chats, CONTEXT);
    expect(forgeCalls()).toHaveLength(1);
    expect(store.keywordEntries.a).toBe(entry);
  });

  it("makes the entry again for a chat whose last message changed", async () => {
    const store = await startRun();
    await store.prepareKeywordTopics([chat("a", { title: "Sidebar", lastAt: 100 })], CONTEXT);
    await store.prepareKeywordTopics([chat("a", { title: "Sidebar cache", lastAt: 200 })], CONTEXT);
    expect(store.keywordEntries.a).toEqual({ lastAt: 200, isComplete: true, terms: { sidebar: 3, cache: 3 } });
  });

  it("uses the date of the file when the scan found no date of a last message", async () => {
    const store = await startRun();
    const undated = chat("a", { title: "Sidebar" });
    undated.meta.last_at = null;
    undated.updated_at = 555;
    await store.prepareKeywordTopics([undated], CONTEXT);
    expect(store.keywordEntries.a.lastAt).toBe(555);
  });

  it("reads the title of an issue once when two chats mention it", async () => {
    forgeAnswers({ 260: "Add dynamic topics" });
    const store = await startRun();
    await store.prepareKeywordTopics(
      [chat("a", { title: "Sidebar", issues: [260] }), chat("b", { title: "Cache", issues: [260] })],
      CONTEXT,
    );
    expect(forgeCalls()).toHaveLength(1);
    expect(store.keywordEntries.a.isComplete).toBe(true);
    expect(store.keywordEntries.b.isComplete).toBe(true);
  });

  it("reads at most the three highest issue numbers of a chat", async () => {
    forgeAnswers({ 3: "Three", 4: "Four", 5: "Five" });
    const store = await startRun();
    await store.prepareKeywordTopics([chat("a", { issues: [1, 2, 3, 4, 5] })], CONTEXT);
    expect(askedIssueNumbers().sort()).toEqual(["3", "4", "5"]);
  });

  it("makes no entry and reads nothing on the forge while the option Dynamic topics is off", async () => {
    forgeAnswers({ 260: "Add dynamic topics" });
    const store = await startRun();
    const { settings } = await import("./settings");
    settings.dynamicTopics = false;
    await store.prepareKeywordTopics([chat("a", { title: "Sidebar", issues: [260] })], CONTEXT);
    expect(Object.keys(store.keywordEntries)).toEqual([]);
    expect(forgeCalls()).toHaveLength(0);
    expect(localStorage.getItem("heidrun.dynamicTopicsCache")).toBeNull();
  });

  it("makes the entry again when the option Dynamic topics is switched on", async () => {
    forgeAnswers({ 260: "Add dynamic topics" });
    const store = await startRun();
    const { settings } = await import("./settings");
    settings.dynamicTopics = false;
    const chats = [chat("a", { title: "Sidebar", issues: [260] })];
    await store.prepareKeywordTopics(chats, CONTEXT);
    settings.dynamicTopics = true;
    await store.prepareKeywordTopics(chats, CONTEXT);
    expect(store.keywordEntries.a.isComplete).toBe(true);
    expect(forgeCalls()).toHaveLength(1);
  });

  it("does not read the forge when the repository has no forge, and keeps the entry incomplete", async () => {
    const store = await startRun();
    await store.prepareKeywordTopics([chat("a", { title: "Sidebar", issues: [260] })], { ...CONTEXT, forge: null });
    expect(forgeCalls()).toHaveLength(0);
    expect(store.keywordEntries.a).toEqual({ lastAt: 100, isComplete: false, terms: { sidebar: 3 } });
  });

  it("reads the titles when the forge becomes known after the first call", async () => {
    forgeAnswers({ 260: "Zebra" });
    const store = await startRun();
    const chats = [chat("a", { title: "Sidebar", issues: [260] })];
    await store.prepareKeywordTopics(chats, { ...CONTEXT, forge: null });
    await store.prepareKeywordTopics(chats, CONTEXT);
    expect(store.keywordEntries.a.isComplete).toBe(true);
  });

  it("keeps the entry incomplete when the forge fails, and does not ask again in the same run, but asks again in the next run", async () => {
    forgeAnswers({});
    const chats = [chat("a", { title: "Sidebar", issues: [260] })];
    let store = await startRun();
    await store.prepareKeywordTopics(chats, CONTEXT);
    await store.prepareKeywordTopics(chats, CONTEXT);
    expect(forgeCalls()).toHaveLength(1);
    expect(store.keywordEntries.a).toEqual({ lastAt: 100, isComplete: false, terms: { sidebar: 3 } });
    forgeAnswers({ 260: "Zebra" });
    store = await startRun();
    await store.prepareKeywordTopics(chats, CONTEXT);
    expect(store.keywordEntries.a.isComplete).toBe(true);
  });

  it("drops the answer for a chat that changed while its titles were read", async () => {
    forgeAnswers({ 260: "Zebra" });
    const store = await startRun();
    const reading = store.prepareKeywordTopics([chat("a", { title: "Sidebar", issues: [260], lastAt: 100 })], CONTEXT);
    await store.prepareKeywordTopics([chat("a", { title: "Newer", lastAt: 200 })], CONTEXT);
    await reading;
    expect(store.keywordEntries.a).toEqual({ lastAt: 200, isComplete: true, terms: { newer: 3 } });
  });
});

describe("the saved cache", () => {
  it("is read again in the next run, so a chat that did not change costs nothing", async () => {
    forgeAnswers({ 260: "Add dynamic topics" });
    const chats = [chat("a", { title: "Sidebar", issues: [260] })];
    let store = await startRun();
    await store.prepareKeywordTopics(chats, CONTEXT);
    vi.mocked(invoke).mockClear();
    store = await startRun();
    expect(store.keywordEntries.a.isComplete).toBe(true);
    await store.prepareKeywordTopics(chats, CONTEXT);
    expect(forgeCalls()).toHaveLength(0);
  });

  it("drops a saved cache of another version, a saved value that is not a cache, and a corrupted entry", async () => {
    localStorage.setItem("heidrun.dynamicTopicsCache", JSON.stringify({ version: 99, keyword: { a: { lastAt: 1, isComplete: true, terms: {} } } }));
    expect(Object.keys((await startRun()).keywordEntries)).toEqual([]);
    localStorage.setItem("heidrun.dynamicTopicsCache", "not json");
    expect(Object.keys((await startRun()).keywordEntries)).toEqual([]);
    localStorage.setItem(
      "heidrun.dynamicTopicsCache",
      JSON.stringify({
        version: 1,
        keyword: {
          good: { lastAt: 1, isComplete: true, terms: { cache: 2 } },
          badTerms: { lastAt: 1, isComplete: true, terms: { cache: "two" } },
          badDate: { lastAt: "yesterday", isComplete: true, terms: {} },
          notAnObject: 5,
        },
      }),
    );
    expect(Object.keys((await startRun()).keywordEntries)).toEqual(["good"]);
  });

  it("keeps the 200 chats with the newest last message", async () => {
    const store = await startRun();
    const many = Array.from({ length: 205 }, (_unused, index) => chat(`c${index}`, { title: "Sidebar", lastAt: index + 1 }));
    await store.prepareKeywordTopics(many, CONTEXT);
    const saved = JSON.parse(localStorage.getItem("heidrun.dynamicTopicsCache") ?? "{}") as { keyword: Record<string, unknown> };
    expect(Object.keys(saved.keyword)).toHaveLength(200);
    expect(saved.keyword.c0).toBeUndefined();
    expect(saved.keyword.c204).toBeDefined();
  });
});

describe("keywordTopicsOf", () => {
  it("ranks the words of each chat against the other chats that it is given", async () => {
    const store = await startRun();
    const chats = [chat("a", { title: "Sidebar cache" }), chat("b", { title: "Sidebar tabs" })];
    await store.prepareKeywordTopics(chats, CONTEXT);
    expect(store.keywordTopicsOf(chats).get("a")).toEqual(["cache"]);
    expect(store.keywordTopicsOf(chats).get("b")).toEqual(["tab"]);
    expect(store.keywordTopicsOf([chats[0]]).get("a")).toEqual(["cache", "sidebar"]);
  });

  it("gives nothing for a chat that has no entry yet", async () => {
    const store = await startRun();
    expect(store.keywordTopicsOf([chat("a", { title: "Sidebar" })]).size).toBe(0);
  });
});
