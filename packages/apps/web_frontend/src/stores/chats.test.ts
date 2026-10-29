import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import {
  availableChatAgents,
  canShowLessChats,
  canShowMoreChats,
  CHAT_LIMITS,
  chats,
  chatSortValue,
  checkChatAgent,
  checkedChatAgents,
  chooseChatSortKey,
  chooseChatSortOrder,
  loadChats,
  nextChatLimit,
  previousChatLimit,
  shownChats,
  showLessChats,
  showMoreChats,
  sortChats,
  type Chat,
} from "./chats";
import { settings } from "./settings";
import { ApplicationLog } from "../lib/application_log";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("../lib/application_log", () => ({ ApplicationLog: { recordLoadTime: vi.fn() } }));

/** One conversation of the test. */
function chat(id: string, title: string): Chat {
  return {
    id,
    title,
    updated_at: 1,
    meta: { first_at: null, last_at: null, user_messages: 0, first_messages: [], folders: [], issues: [], pull_requests: [], files_written: [] },
  };
}

/** What the Tauri command `chats_list` answers. */
function answerOf(claude: Chat[], codex: Chat[] = [], hasMore: { claude?: boolean; codex?: boolean } = {}) {
  return {
    claude: { chats: claude, has_more: hasMore.claude ?? false },
    codex: { chats: codex, has_more: hasMore.codex ?? false },
  };
}

/**
 * The answers of the Tauri command `chats_list`: the answers given once first, then the answer that repeats. The Tauri command
 * `chats_synchronize` answers at once.
 */
const listing = { repeated: undefined as unknown, once: [] as unknown[] };

/** Every call to a Tauri command since the start of the test, in order, by command name. */
function commandNames(): string[] {
  return vi.mocked(invoke).mock.calls.map((call) => call[0]);
}

/** Every later call to `chats_list` answers `answer`. */
function listAlways(answer: unknown) {
  listing.repeated = answer;
}

/** The next call to `chats_list` answers `answer`, then the calls go on with the answer that repeats. */
function listOnce(answer: unknown) {
  listing.once.push(answer);
}

/** Stops the test until the answer of a Tauri command is given by hand. */
function answerByHand<T>() {
  let answer: (value: T) => void = () => {};
  const promise = new Promise<T>((resolve) => {
    answer = resolve;
  });
  return { promise, answer };
}

beforeEach(() => {
  vi.mocked(invoke).mockReset();
  vi.mocked(ApplicationLog.recordLoadTime).mockReset();
  listing.repeated = undefined;
  listing.once = [];
  vi.mocked(invoke).mockImplementation(async (command: string) => {
    if (command === "chats_synchronize") {
      return { root: "/work/app", chat_session_count: 0 };
    }
    return listing.once.length > 0 ? listing.once.shift() : listing.repeated;
  });
  chats.folder = null;
  chats.claude = [];
  chats.codex = [];
  chats.agents = "claude";
  chats.hasMore = { claude: false, codex: false };
  chats.limit = CHAT_LIMITS[0];
  chats.isShowingMore = false;
  chats.isLoading = false;
  chats.error = null;
  settings.chatsSortKey = "last_updated";
  settings.chatsOrder = "descending";
});

describe("loadChats", () => {
  it("reads the stored conversations, then synchronizes, then reads again, and keeps the conversations of each coding agent", async () => {
    listAlways(answerOf([chat("a", "First")], [chat("b", "Second")]));
    await loadChats("/work/app");
    expect(commandNames()).toEqual(["chats_list", "chats_synchronize", "chats_list"]);
    expect(invoke).toHaveBeenCalledWith("chats_synchronize", { folder: "/work/app" });
    expect(invoke).toHaveBeenCalledWith("chats_list", { folder: "/work/app", limit: 5, sortKey: "last_updated", order: "descending" });
    expect(chats.folder).toBe("/work/app");
    expect(chats.claude).toEqual([chat("a", "First")]);
    expect(chats.codex).toEqual([chat("b", "Second")]);
    expect(chats.isLoading).toBe(false);
    expect(chats.error).toBeNull();
  });

  it("asks for nothing and shows nothing when no workspace is selected", async () => {
    chats.claude = [chat("a", "First")];
    chats.folder = "/work/app";
    await loadChats(null);
    expect(invoke).not.toHaveBeenCalled();
    expect(chats.claude).toEqual([]);
    expect(chats.isLoading).toBe(false);
  });

  it("empties the lists at once when the folder changes, so that no conversation of another workspace shows", async () => {
    listAlways(answerOf([chat("a", "First")]));
    await loadChats("/work/app");
    const second = answerByHand<unknown>();
    listAlways(answerOf([chat("c", "Third")]));
    listOnce(second.promise);
    const loading = loadChats("/work/website");
    expect(chats.claude).toEqual([]);
    expect(chats.isLoading).toBe(true);
    second.answer(answerOf([chat("c", "Third")]));
    await loading;
    expect(chats.claude).toEqual([chat("c", "Third")]);
  });

  it("keeps the lists on the screen while it synchronizes and reads the same folder again, and reads only once after the synchronization", async () => {
    listAlways(answerOf([chat("a", "First")]));
    await loadChats("/work/app");
    vi.mocked(invoke).mockClear();
    const again = answerByHand<unknown>();
    listOnce(again.promise);
    const loading = loadChats("/work/app");
    expect(chats.claude).toEqual([chat("a", "First")]);
    expect(chats.isLoading).toBe(false);
    again.answer(answerOf([chat("a", "First"), chat("d", "Fourth")]));
    await loading;
    expect(chats.claude.length).toBe(2);
    expect(commandNames()).toEqual(["chats_synchronize", "chats_list"]);
  });

  it("shows the stored conversations when the synchronization fails, and keeps the reason", async () => {
    listAlways(answerOf([chat("a", "First")]));
    vi.mocked(invoke).mockImplementation(async (command: string) => {
      if (command === "chats_synchronize") {
        throw new Error("the SQLite file is locked");
      }
      return answerOf([chat("a", "First")]);
    });
    await loadChats("/work/app");
    expect(chats.claude).toEqual([chat("a", "First")]);
    expect(chats.error).toBe("the SQLite file is locked");
    expect(chats.isLoading).toBe(false);
    expect(ApplicationLog.recordLoadTime).toHaveBeenCalledWith("past_chats", expect.any(Number), "the SQLite file is locked");
  });

  it("writes the load time in the application log once for each load, and not for a folder that is no longer the current one", async () => {
    listAlways(answerOf([chat("a", "First")]));
    await loadChats("/work/app");
    expect(ApplicationLog.recordLoadTime).toHaveBeenCalledTimes(1);
    expect(ApplicationLog.recordLoadTime).toHaveBeenCalledWith("past_chats", expect.any(Number), null);
    const slow = answerByHand<unknown>();
    listOnce(slow.promise);
    const dropped = loadChats("/work/website");
    await loadChats("/work/app");
    slow.answer(answerOf([chat("c", "Third")]));
    await dropped;
    expect(ApplicationLog.recordLoadTime).toHaveBeenCalledTimes(2);
  });

  it("starts one synchronization when two refreshes of the same folder overlap", async () => {
    listAlways(answerOf([chat("a", "First")]));
    await loadChats("/work/app");
    vi.mocked(invoke).mockClear();
    await Promise.all([loadChats("/work/app"), loadChats("/work/app")]);
    expect(commandNames().filter((name) => name === "chats_synchronize")).toHaveLength(1);
  });

  it("drops the answer for a folder that is no longer the current one", async () => {
    const slow = answerByHand<unknown>();
    listOnce(slow.promise);
    const loadingOld = loadChats("/work/app");
    listAlways(answerOf([chat("c", "New workspace")]));
    await loadChats("/work/website");
    slow.answer(answerOf([chat("a", "Old workspace")]));
    await loadingOld;
    expect(chats.folder).toBe("/work/website");
    expect(chats.claude).toEqual([chat("c", "New workspace")]);
  });

  it("keeps the reason when the command fails", async () => {
    vi.mocked(invoke).mockRejectedValue("boom");
    await loadChats("/work/app");
    expect(chats.error).toBe("boom");
    expect(chats.isLoading).toBe(false);
  });
});

describe("the number of chats", () => {
  it("starts with 5 chats, then asks for 10, 20, and 50, then adds 50 for each click", () => {
    expect(CHAT_LIMITS[0]).toBe(5);
    expect([5, 10, 20, 50, 100, 150].map(nextChatLimit)).toEqual([10, 20, 50, 100, 150, 200]);
  });

  it("asks for the next number of chats after a click on Show more, and keeps the lists on the screen meanwhile", async () => {
    listAlways(answerOf([chat("a", "First")], [], { claude: true }));
    await loadChats("/work/app");
    expect(canShowMoreChats.value).toBe(true);
    vi.mocked(invoke).mockClear();
    const more = answerByHand<unknown>();
    listOnce(more.promise);
    const showing = showMoreChats();
    expect(chats.isShowingMore).toBe(true);
    expect(chats.claude).toEqual([chat("a", "First")]);
    more.answer(answerOf([chat("a", "First"), chat("b", "Second")]));
    await showing;
    expect(invoke).toHaveBeenLastCalledWith("chats_list", { folder: "/work/app", limit: 10, sortKey: "last_updated", order: "descending" });
    expect(chats.claude.length).toBe(2);
    expect(chats.isShowingMore).toBe(false);
    expect(canShowMoreChats.value).toBe(false);
    expect(commandNames()).toEqual(["chats_list"]);
  });

  it("keeps the raised number of chats when it reads the same folder again, and goes back to 5 for another folder", async () => {
    listAlways(answerOf([chat("a", "First")], [], { claude: true }));
    await loadChats("/work/app");
    await showMoreChats();
    await loadChats("/work/app");
    expect(invoke).toHaveBeenLastCalledWith("chats_list", { folder: "/work/app", limit: 10, sortKey: "last_updated", order: "descending" });
    await loadChats("/work/website");
    expect(invoke).toHaveBeenLastCalledWith("chats_list", { folder: "/work/website", limit: 5, sortKey: "last_updated", order: "descending" });
  });

  it("offers Show more only for the checked coding agents that have more chats", async () => {
    listAlways(answerOf([chat("a", "First")], [chat("b", "Second")], { codex: true }));
    await loadChats("/work/app");
    chats.agents = "claude";
    expect(canShowMoreChats.value).toBe(false);
    chats.agents = "codex";
    expect(canShowMoreChats.value).toBe(true);
    chats.agents = "none";
    expect(canShowMoreChats.value).toBe(false);
  });

  it("goes back one step for each click on Show less, and never below 5", () => {
    expect([200, 150, 100, 50, 20, 10, 5].map(previousChatLimit)).toEqual([150, 100, 50, 20, 10, 5, 5]);
  });

  it("cuts the lists to the lower number of chats at once, and tells that the coding agent has more chats", async () => {
    const claude = ["a", "b", "c", "d", "e", "f", "g"].map((id) => chat(id, id));
    listAlways(answerOf(claude));
    await loadChats("/work/app");
    chats.limit = 10;
    expect(canShowLessChats.value).toBe(true);
    expect(canShowMoreChats.value).toBe(false);
    vi.mocked(invoke).mockClear();
    showLessChats();
    expect(invoke).not.toHaveBeenCalled();
    expect(chats.limit).toBe(5);
    expect(chats.claude.map((item) => item.id)).toEqual(["a", "b", "c", "d", "e"]);
    expect(canShowMoreChats.value).toBe(true);
    expect(canShowLessChats.value).toBe(false);
    showLessChats();
    expect(chats.limit).toBe(5);
  });

  it("does not offer Show less when the list shows no more chats than the lower number allows", async () => {
    listAlways(answerOf([chat("a", "First"), chat("b", "Second")]));
    await loadChats("/work/app");
    chats.limit = 20;
    expect(canShowLessChats.value).toBe(false);
  });

  it("drops an answer that was asked before a click on Show less, so the chats that were cut do not come back", async () => {
    const claude = ["a", "b", "c", "d", "e", "f", "g"].map((id) => chat(id, id));
    listAlways(answerOf(claude));
    await loadChats("/work/app");
    chats.limit = 10;
    const slow = answerByHand<unknown>();
    listOnce(slow.promise);
    const reading = loadChats("/work/app");
    await vi.waitFor(() => expect(invoke).toHaveBeenCalledWith("chats_list", expect.objectContaining({ limit: 10 })));
    showLessChats();
    slow.answer(answerOf(claude));
    await reading;
    expect(chats.claude.length).toBe(5);
  });

  it("does not ask twice when Show more is clicked twice at once", async () => {
    listAlways(answerOf([chat("a", "First")], [], { claude: true }));
    await loadChats("/work/app");
    vi.mocked(invoke).mockClear();
    await Promise.all([showMoreChats(), showMoreChats()]);
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});

describe("the coding agents of the selector", () => {
  it("offers only the coding agents that have a conversation", () => {
    expect(availableChatAgents.value).toEqual([]);
    chats.codex = [chat("b", "Second")];
    expect(availableChatAgents.value).toEqual(["codex"]);
    chats.claude = [chat("a", "First")];
    expect(availableChatAgents.value).toEqual(["claude", "codex"]);
  });

  it("shows the chats of the coding agent that the developer checked", () => {
    chats.claude = [chat("a", "First")];
    chats.codex = [chat("b", "Second")];
    chats.agents = "codex";
    expect(checkedChatAgents.value).toEqual(["codex"]);
    expect(shownChats.value).toEqual([{ ...chat("b", "Second"), agent: "codex" }]);
  });

  it("shows no chat when no coding agent is checked", () => {
    chats.claude = [chat("a", "First")];
    chats.codex = [chat("b", "Second")];
    chats.agents = "none";
    expect(checkedChatAgents.value).toEqual([]);
    expect(shownChats.value).toEqual([]);
  });

  it("mixes the chats of Claude and of Codex in the order of the settings when both are checked, each with its coding agent", () => {
    chats.claude = [{ ...chat("a", "First"), updated_at: 30 }, { ...chat("c", "Third"), updated_at: 10 }];
    chats.codex = [{ ...chat("b", "Second"), updated_at: 20 }];
    chats.agents = "both";
    expect(checkedChatAgents.value).toEqual(["claude", "codex"]);
    expect(shownChats.value.map((shown) => [shown.id, shown.agent])).toEqual([
      ["a", "claude"],
      ["b", "codex"],
      ["c", "claude"],
    ]);
    settings.chatsOrder = "ascending";
    expect(shownChats.value.map((shown) => shown.id)).toEqual(["c", "b", "a"]);
  });

  it("keeps at most the limit of chats when both are checked, and can show more when chats are left out", () => {
    chats.limit = 2;
    chats.claude = [{ ...chat("a", "First"), updated_at: 30 }, { ...chat("c", "Third"), updated_at: 10 }];
    chats.codex = [{ ...chat("b", "Second"), updated_at: 20 }];
    chats.agents = "both";
    expect(shownChats.value.map((shown) => shown.id)).toEqual(["a", "b"]);
    expect(canShowMoreChats.value).toBe(true);
    chats.limit = 5;
    expect(canShowMoreChats.value).toBe(false);
    chats.hasMore.codex = true;
    expect(canShowMoreChats.value).toBe(true);
  });

  it("shows no conversation when there is none", () => {
    expect(shownChats.value).toEqual([]);
  });
});

describe("the coding agents that the developer checked", () => {
  afterEach(() => {
    localStorage.removeItem("heidrun.settings");
    vi.resetModules();
  });

  it("are saved in the settings each time the developer checks or unchecks one", () => {
    checkChatAgent("codex", true);
    expect(chats.agents).toBe("both");
    expect(settings.chatsAgent).toBe("both");
    checkChatAgent("claude", false);
    expect(chats.agents).toBe("codex");
    checkChatAgent("codex", false);
    expect(chats.agents).toBe("none");
    expect(settings.chatsAgent).toBe("none");
    checkChatAgent("claude", true);
    expect(chats.agents).toBe("claude");
  });

  it("are the checked coding agents of the next start, and both when the saved value is not valid", async () => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ chatsAgent: "none" }));
    vi.resetModules();
    expect((await import("./chats")).chats.agents).toBe("none");
    localStorage.setItem("heidrun.settings", JSON.stringify({ chatsAgent: "unknown" }));
    vi.resetModules();
    expect((await import("./chats")).chats.agents).toBe("both");
  });
});

describe("the sort of the chats of every coding agent", () => {
  it("gives the number of each sort key, as the Tauri command chats_list computes it", () => {
    const sample: Chat = {
      ...chat("a", "First"),
      updated_at: 50,
      meta: {
        ...chat("a", "First").meta,
        user_messages: 3,
        issues: [1, 2],
        pull_requests: [7],
        files_written: ["/work/app/a.ts", "/work/app/.claude/worktrees/fix-1/a.ts", "/work/app/b.ts"],
      },
    };
    expect(chatSortValue(sample, "created_on", "/work/app")).toBe(50);
    expect(chatSortValue({ ...sample, meta: { ...sample.meta, first_at: 40 } }, "created_on", "/work/app")).toBe(40);
    expect(chatSortValue(sample, "last_updated", "/work/app")).toBe(50);
    expect(chatSortValue(sample, "messages", "/work/app")).toBe(3);
    expect(chatSortValue(sample, "issues", "/work/app")).toBe(2);
    expect(chatSortValue(sample, "pull_requests", "/work/app")).toBe(1);
    expect(chatSortValue(sample, "files_written", "/work/app")).toBe(2);
  });

  it("puts the chat with the most recent activity first when two chats have the same value, then sorts by identifier", () => {
    const list = [
      { ...chat("b", "Second"), updated_at: 10 },
      { ...chat("a", "First"), updated_at: 10 },
      { ...chat("c", "Third"), updated_at: 20 },
    ];
    expect(sortChats(list, "messages", "ascending", null).map((sorted) => sorted.id)).toEqual(["c", "a", "b"]);
  });
});

describe("the sort of the chats", () => {
  it("asks the Tauri command chats_list for the saved sort key and the saved order", async () => {
    settings.chatsSortKey = "messages";
    settings.chatsOrder = "ascending";
    listAlways(answerOf([chat("a", "First")]));
    await loadChats("/work/app");
    expect(invoke).toHaveBeenCalledWith("chats_list", { folder: "/work/app", limit: 5, sortKey: "messages", order: "ascending" });
  });

  it("starts with the sort key last_updated and the order descending, which is the order before the dropdown menu existed", () => {
    expect(settings.chatsSortKey).toBe("last_updated");
    expect(settings.chatsOrder).toBe("descending");
  });

  it("saves the sort key, and reads the chats again in the new order with the same number of chats", async () => {
    listAlways(answerOf([chat("a", "First")], [], { claude: true }));
    await loadChats("/work/app");
    await showMoreChats();
    listAlways(answerOf([chat("b", "Second")]));
    await chooseChatSortKey("issues");
    expect(settings.chatsSortKey).toBe("issues");
    expect(invoke).toHaveBeenLastCalledWith("chats_list", { folder: "/work/app", limit: 10, sortKey: "issues", order: "descending" });
    expect(chats.claude).toEqual([chat("b", "Second")]);
  });

  it("saves the order, and reads the stored chats again from the other end without a synchronization", async () => {
    listAlways(answerOf([chat("a", "First")]));
    await loadChats("/work/app");
    vi.mocked(invoke).mockClear();
    listAlways(answerOf([chat("z", "Last")]));
    await chooseChatSortOrder("ascending");
    expect(commandNames()).toEqual(["chats_list"]);
    expect(settings.chatsOrder).toBe("ascending");
    expect(invoke).toHaveBeenLastCalledWith("chats_list", { folder: "/work/app", limit: 5, sortKey: "last_updated", order: "ascending" });
    expect(chats.claude).toEqual([chat("z", "Last")]);
  });

  it("keeps the list on the screen while the new order waits for its answer", async () => {
    listAlways(answerOf([chat("a", "First")]));
    await loadChats("/work/app");
    const waiting = answerByHand<unknown>();
    listOnce(waiting.promise);
    const sorting = chooseChatSortOrder("ascending");
    expect(chats.claude).toEqual([chat("a", "First")]);
    waiting.answer(answerOf([chat("b", "Second")]));
    await sorting;
    expect(chats.claude).toEqual([chat("b", "Second")]);
  });

  it("drops the answer of an earlier sort when the developer chose another sort meanwhile", async () => {
    listAlways(answerOf([chat("a", "First")]));
    await loadChats("/work/app");
    const slow = answerByHand<unknown>();
    listOnce(slow.promise);
    const first = chooseChatSortKey("messages");
    listOnce(answerOf([chat("c", "Third")]));
    await chooseChatSortKey("issues");
    expect(chats.claude).toEqual([chat("c", "Third")]);
    slow.answer(answerOf([chat("b", "Second")]));
    await first;
    expect(chats.claude).toEqual([chat("c", "Third")]);
  });

  it("keeps the sort key and the order when the developer selects another workspace", async () => {
    listAlways(answerOf([chat("a", "First")]));
    await loadChats("/work/app");
    await chooseChatSortKey("files_written");
    await loadChats("/work/website");
    expect(invoke).toHaveBeenLastCalledWith("chats_list", { folder: "/work/website", limit: 5, sortKey: "files_written", order: "descending" });
  });
});
