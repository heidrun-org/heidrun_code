import { beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { MOST_CHATS_PER_CALL } from "../lib/language_model_topics";
import type { Chat } from "./chats";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

/** A conversation as the prompt holds it. */
type Conversation = { conversation: number; title: string; firstMessages: string[] };

/** The prompts that the command `coding_agent_ask` received, in order. */
let prompts: string[] = [];

/**
 * Makes the Tauri command `coding_agent_ask` answer.
 * @param ask - what the coding agent answers to a prompt: its text, or a failure
 */
function installBackend(ask: (prompt: string) => Promise<string>): void {
  prompts = [];
  vi.mocked(invoke).mockImplementation(async (command, args) => {
    if (command === "coding_agent_ask") {
      const prompt = (args as { prompt: string }).prompt;
      prompts.push(prompt);
      return { agent: "codex", text: await ask(prompt) };
    }
    throw new Error(`not mocked: ${String(command)}`);
  });
}

/** The conversations that a prompt holds. */
function conversationsOf(prompt: string): Conversation[] {
  const line = prompt.split("\n").find((candidate) => candidate.startsWith("Conversations: ")) ?? "Conversations: []";
  return JSON.parse(line.slice("Conversations: ".length)) as Conversation[];
}

/** The answer of a coding agent that gives each conversation the topics that `topicsOf` gives for its title. */
function answerWith(topicsOf: (title: string) => string[]): (prompt: string) => Promise<string> {
  return async (prompt) =>
    JSON.stringify(conversationsOf(prompt).map(({ conversation, title }) => ({ conversation, topics: topicsOf(title) })));
}

/** A chat whose last message is at `lastAt`. */
function chatOf(id: string, title: string, lastAt = 100, firstMessages: string[] = []): Chat {
  return {
    id,
    title,
    updated_at: 1,
    meta: {
      first_at: null,
      last_at: lastAt,
      user_messages: 0,
      first_messages: firstMessages,
      folders: ["/private/folder"],
      issues: [260],
      pull_requests: [],
      files_written: ["/private/file.ts"],
    },
  };
}

/** How many times the Tauri command `coding_agent_ask` ran. */
function calls(): number {
  return vi.mocked(invoke).mock.calls.filter(([command]) => command === "coding_agent_ask").length;
}

/** The stores, as a new run of Heidrun Code sees them: the modules are loaded again. */
async function startRun(method: "keyword" | "languageModel") {
  vi.resetModules();
  const { settings } = await import("./settings");
  settings.dynamicTopicExtraction = method;
  const store = await import("./language_model_topics");
  return { settings, ...store };
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(invoke).mockReset();
  prompts = [];
});

describe("prepareLanguageModelTopics", () => {
  it("makes no call while the method is Keyword", async () => {
    installBackend(answerWith(() => ["cache"]));
    const { prepareLanguageModelTopics, languageModelEntries } = await startRun("keyword");
    await prepareLanguageModelTopics([chatOf("a", "Fix the cache")]);
    expect(calls()).toBe(0);
    expect(Object.keys(languageModelEntries)).toEqual([]);
  });

  it("makes no call while the option Dynamic topics is off, even when the method is Language model", async () => {
    installBackend(answerWith(() => ["cache"]));
    const { settings, prepareLanguageModelTopics, languageModelEntries } = await startRun("languageModel");
    settings.dynamicTopics = false;
    await prepareLanguageModelTopics([chatOf("a", "Fix the cache")]);
    expect(calls()).toBe(0);
    expect(Object.keys(languageModelEntries)).toEqual([]);
  });

  it("makes the call when the option Dynamic topics is switched on again", async () => {
    installBackend(answerWith(() => ["cache"]));
    const { settings, prepareLanguageModelTopics, languageModelTopicsOf } = await startRun("languageModel");
    const list = [chatOf("a", "Fix the cache")];
    settings.dynamicTopics = false;
    await prepareLanguageModelTopics(list);
    settings.dynamicTopics = true;
    await prepareLanguageModelTopics(list);
    expect(calls()).toBe(1);
    expect(languageModelTopicsOf(list).get("a")).toEqual(["cache"]);
  });

  it("makes no second call when the developer switches the option Dynamic topics off during the first call", async () => {
    const { settings, prepareLanguageModelTopics } = await startRun("languageModel");
    installBackend(async (prompt) => {
      settings.dynamicTopics = false;
      return answerWith(() => ["cache"])(prompt);
    });
    const list = Array.from({ length: MOST_CHATS_PER_CALL + 1 }, (_value, index) => chatOf(`chat-${index}`, `Chat ${index}`));
    await prepareLanguageModelTopics(list);
    expect(calls()).toBe(1);
  });

  it("makes one single call for all the chats, and keeps the topics of each chat", async () => {
    installBackend(answerWith((title) => (title === "Fix the cache" ? ["cache"] : ["tab bar", "layout"])));
    const { prepareLanguageModelTopics, languageModelTopicsOf, languageModelStatus } = await startRun("languageModel");
    const list = [chatOf("a", "Fix the cache"), chatOf("b", "Move the tab bar")];
    await prepareLanguageModelTopics(list);
    expect(calls()).toBe(1);
    expect(languageModelTopicsOf(list)).toEqual(
      new Map([
        ["a", ["cache"]],
        ["b", ["tab bar", "layout"]],
      ]),
    );
    expect(languageModelStatus.error).toBeNull();
    expect(languageModelStatus.isRunning).toBe(false);
  });

  it("sends the title and the first messages of each chat, numbered from 1, and nothing else of the chat", async () => {
    installBackend(answerWith(() => ["cache"]));
    const { prepareLanguageModelTopics } = await startRun("languageModel");
    await prepareLanguageModelTopics([chatOf("secret-a", "Fix the cache", 100, ["Please fix"]), chatOf("secret-b", "Second")]);
    expect(conversationsOf(prompts[0])).toEqual([
      { conversation: 1, title: "Fix the cache", firstMessages: ["Please fix"] },
      { conversation: 2, title: "Second", firstMessages: [] },
    ]);
    for (const secret of ["secret-a", "secret-b", "/private", "260"]) {
      expect(prompts[0]).not.toContain(secret);
    }
  });

  it("saves the topics, so the next run of Heidrun Code makes no call for the same chats", async () => {
    installBackend(answerWith(() => ["cache"]));
    const first = await startRun("languageModel");
    await first.prepareLanguageModelTopics([chatOf("a", "Fix the cache")]);
    expect(calls()).toBe(1);
    const second = await startRun("languageModel");
    const list = [chatOf("a", "Fix the cache")];
    await second.prepareLanguageModelTopics(list);
    expect(calls()).toBe(1);
    expect(second.languageModelTopicsOf(list).get("a")).toEqual(["cache"]);
  });

  it("makes no call for a chat whose last message did not change, and asks again when it changed", async () => {
    installBackend(answerWith(() => ["cache"]));
    const { prepareLanguageModelTopics } = await startRun("languageModel");
    await prepareLanguageModelTopics([chatOf("a", "Fix the cache", 100)]);
    await prepareLanguageModelTopics([chatOf("a", "Fix the cache", 100)]);
    expect(calls()).toBe(1);
    await prepareLanguageModelTopics([chatOf("a", "Fix the cache", 200)]);
    expect(calls()).toBe(2);
  });

  it("asks only about the chats that have no fresh topics, and gives the existing topics in the prompt", async () => {
    installBackend(answerWith((title) => (title === "Old" ? ["cache"] : ["sidebar"])));
    const { prepareLanguageModelTopics } = await startRun("languageModel");
    await prepareLanguageModelTopics([chatOf("a", "Old")]);
    await prepareLanguageModelTopics([chatOf("a", "Old"), chatOf("b", "New")]);
    expect(calls()).toBe(2);
    expect(prompts[1]).toContain('Existing topics: ["cache"]');
    expect(conversationsOf(prompts[1]).map((conversation) => conversation.title)).toEqual(["New"]);
  });

  it("keeps the old topics of a chat while the topics of its new last message are on the way", async () => {
    let release: (text: string) => void = () => {};
    installBackend(answerWith(() => ["cache"]));
    const { prepareLanguageModelTopics, languageModelTopicsOf } = await startRun("languageModel");
    await prepareLanguageModelTopics([chatOf("a", "Fix the cache", 100)]);
    vi.mocked(invoke).mockImplementation(async () => ({
      agent: "codex",
      text: await new Promise<string>((resolve) => {
        release = resolve;
      }),
    }));
    const changed = [chatOf("a", "Fix the cache", 200)];
    const pending = prepareLanguageModelTopics(changed);
    expect(languageModelTopicsOf(changed).get("a")).toEqual(["cache"]);
    release('[{"conversation": 1, "topics": ["sidebar"]}]');
    await pending;
    expect(languageModelTopicsOf(changed).get("a")).toEqual(["sidebar"]);
  });

  it("sends a long list in several calls of 20 chats at most, one after the other", async () => {
    installBackend(answerWith(() => ["cache"]));
    const { prepareLanguageModelTopics, languageModelEntries } = await startRun("languageModel");
    const list = Array.from({ length: 45 }, (_, index) => chatOf(`chat${index}`, `Title ${index}`));
    await prepareLanguageModelTopics(list);
    expect(prompts.map((prompt) => conversationsOf(prompt).length)).toEqual([20, 20, 5]);
    expect(Object.keys(languageModelEntries)).toHaveLength(45);
  });

  it("saves nothing, says that the answer is wrong, and does not ask again for the same chats", async () => {
    installBackend(async () => "I cannot do it");
    const { prepareLanguageModelTopics, languageModelEntries, languageModelStatus } = await startRun("languageModel");
    const list = [chatOf("a", "Fix the cache")];
    await prepareLanguageModelTopics(list);
    expect(languageModelStatus.error).toBe("wrongAnswer");
    expect(Object.keys(languageModelEntries)).toEqual([]);
    expect(localStorage.getItem("heidrun.languageModelTopicsCache")).toBeNull();
    await prepareLanguageModelTopics(list);
    expect(calls()).toBe(1);
  });

  it("does not use an answer that misses a conversation", async () => {
    installBackend(async () => '[{"conversation": 1, "topics": ["cache"]}]');
    const { prepareLanguageModelTopics, languageModelEntries, languageModelStatus } = await startRun("languageModel");
    await prepareLanguageModelTopics([chatOf("a", "One"), chatOf("b", "Two")]);
    expect(languageModelStatus.error).toBe("wrongAnswer");
    expect(Object.keys(languageModelEntries)).toEqual([]);
  });

  it("says that no coding agent is installed, and keeps the topics that the chats already have", async () => {
    installBackend(answerWith(() => ["cache"]));
    const { prepareLanguageModelTopics, languageModelTopicsOf, languageModelStatus } = await startRun("languageModel");
    await prepareLanguageModelTopics([chatOf("a", "Fix the cache", 100)]);
    installBackend(async () => {
      throw "no_coding_agent";
    });
    const changed = [chatOf("a", "Fix the cache", 200)];
    await prepareLanguageModelTopics(changed);
    expect(languageModelStatus.error).toBe("noCodingAgent");
    expect(languageModelTopicsOf(changed).get("a")).toEqual(["cache"]);
  });

  it("says that the call failed, and asks again for the same chats only when the developer chooses the method again", async () => {
    installBackend(async () => {
      throw new Error("codex : not signed in");
    });
    const { prepareLanguageModelTopics, languageModelStatus, settings } = await startRun("languageModel");
    const list = [chatOf("a", "Fix the cache")];
    await prepareLanguageModelTopics(list);
    expect(languageModelStatus.error).toBe("failed");
    await prepareLanguageModelTopics(list);
    expect(calls()).toBe(1);
    settings.dynamicTopicExtraction = "keyword";
    await nextTick();
    settings.dynamicTopicExtraction = "languageModel";
    await nextTick();
    expect(languageModelStatus.error).toBeNull();
    installBackend(answerWith(() => ["cache"]));
    await prepareLanguageModelTopics(list);
    expect(calls()).toBe(2);
    expect(languageModelStatus.error).toBeNull();
  });

  it("runs one call at a time, and asks again for the chats that came during the call", async () => {
    const releases: (() => void)[] = [];
    installBackend(async (prompt) => {
      await new Promise<void>((resolve) => releases.push(resolve));
      return answerWith(() => ["cache"])(prompt);
    });
    const { prepareLanguageModelTopics, languageModelEntries } = await startRun("languageModel");
    const first = prepareLanguageModelTopics([chatOf("a", "One")]);
    await Promise.resolve();
    await prepareLanguageModelTopics([chatOf("a", "One"), chatOf("b", "Two")]);
    expect(calls()).toBe(1);
    releases[0]();
    await vi.waitFor(() => expect(releases).toHaveLength(2));
    releases[1]();
    await first;
    expect(Object.keys(languageModelEntries).sort()).toEqual(["a", "b"]);
    expect(conversationsOf(prompts[1]).map((conversation) => conversation.title)).toEqual(["Two"]);
  });
});

describe("languageModelTopicsOf", () => {
  it("gives the topics of the chats that have an entry, and nothing for the other chats", async () => {
    installBackend(answerWith(() => ["cache"]));
    const { prepareLanguageModelTopics, languageModelTopicsOf } = await startRun("languageModel");
    await prepareLanguageModelTopics([chatOf("a", "One")]);
    expect(languageModelTopicsOf([chatOf("a", "One"), chatOf("b", "Two")])).toEqual(new Map([["a", ["cache"]]]));
  });

  it("drops a corrupted cache, and a cache of another version", async () => {
    localStorage.setItem("heidrun.languageModelTopicsCache", JSON.stringify({ version: 2, entries: { a: { lastAt: 1, topics: ["x"] } } }));
    const { languageModelEntries } = await startRun("languageModel");
    expect(Object.keys(languageModelEntries)).toEqual([]);
    localStorage.setItem(
      "heidrun.languageModelTopicsCache",
      JSON.stringify({ version: 1, entries: { a: { lastAt: 1, topics: ["x"] }, b: { lastAt: "1", topics: ["x"] }, c: { lastAt: 1, topics: [] } } }),
    );
    const second = await startRun("languageModel");
    expect(Object.keys(second.languageModelEntries)).toEqual(["a"]);
  });
});
