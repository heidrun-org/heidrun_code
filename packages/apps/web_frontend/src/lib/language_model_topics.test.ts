// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { Chat } from "../stores/chats";
import {
  existingTopicsOf,
  languageModelChatOf,
  languageModelPrompt,
  parseLanguageModelAnswer,
} from "./language_model_topics";

/** A chat with a title, first messages, and other data that must never leave the computer. */
function chatWith(title: string, firstMessages: string[]): Chat {
  return {
    id: "secret-identifier",
    title,
    updated_at: 1,
    meta: {
      first_at: 1,
      last_at: 2,
      user_messages: 3,
      first_messages: firstMessages,
      folders: ["/secret/folder"],
      issues: [260],
      pull_requests: [268],
      files_written: ["/secret/folder/file.ts"],
    },
  };
}

describe("languageModelChatOf", () => {
  it("keeps only the title and the first messages of a chat", () => {
    expect(languageModelChatOf(chatWith("Fix the tab bar", ["Please fix it", "Thanks"]))).toEqual({
      title: "Fix the tab bar",
      firstMessages: ["Please fix it", "Thanks"],
    });
  });
});

describe("existingTopicsOf", () => {
  it("gives each topic once, the most used first, then in the alphabetical order", () => {
    const entries = [{ topics: ["tab", "cache"] }, { topics: ["sidebar", "cache"] }, { topics: ["tab", "cache", "zebra"] }];
    expect(existingTopicsOf(entries)).toEqual(["cache", "tab", "sidebar", "zebra"]);
  });

  it("keeps at most 100 topics", () => {
    const topics = Array.from({ length: 150 }, (_, index) => `topic${String(index).padStart(3, "0")}`);
    expect(existingTopicsOf([{ topics }])).toHaveLength(100);
  });

  it("gives nothing for no entry", () => {
    expect(existingTopicsOf([])).toEqual([]);
  });
});

describe("languageModelPrompt", () => {
  it("holds the existing topics and the numbered conversations, and no other data of the chats", () => {
    const chat = languageModelChatOf(chatWith("Fix the tab bar", ["Please fix it"]));
    const prompt = languageModelPrompt(["cache"], [chat, { title: "Second", firstMessages: [] }]);
    expect(prompt).toContain('Existing topics: ["cache"]');
    expect(prompt).toContain(
      'Conversations: [{"conversation":1,"title":"Fix the tab bar","firstMessages":["Please fix it"]},{"conversation":2,"title":"Second","firstMessages":[]}]',
    );
    expect(prompt).not.toContain("secret");
    expect(prompt).not.toContain("260");
  });

  it("asks for one to three topics of one or two words, and tells the model to reuse an existing topic", () => {
    const prompt = languageModelPrompt([], [{ title: "A", firstMessages: [] }]);
    expect(prompt).toContain("one to three topics");
    expect(prompt).toContain("one or two words");
    expect(prompt).toContain("Reuse an existing topic");
    expect(prompt).toContain('"conversation": <number of the conversation>');
  });
});

describe("parseLanguageModelAnswer", () => {
  it("reads the topics of each conversation, in the order of the prompt, in lower case", () => {
    const answer = '[{"conversation": 2, "topics": ["Cache"]}, {"conversation": 1, "topics": ["tab bar", " Sidebar "]}]';
    expect(parseLanguageModelAnswer(answer, 2)).toEqual([["tab bar", "sidebar"], ["cache"]]);
  });

  it("ignores the text around the array", () => {
    const answer = 'Here you are:\n```json\n[{"conversation": 1, "topics": ["cache"]}]\n```';
    expect(parseLanguageModelAnswer(answer, 1)).toEqual([["cache"]]);
  });

  it("drops a topic that is written twice in one conversation", () => {
    expect(parseLanguageModelAnswer('[{"conversation": 1, "topics": ["cache", "Cache"]}]', 1)).toEqual([["cache"]]);
  });

  it.each([
    ["text that is not a JSON array", "I cannot do it"],
    ["an array that is not valid", '[{"conversation": 1,'],
    ["an item that is not an object", "[1]"],
    ["a conversation that is missing", '[{"conversation": 1, "topics": ["cache"]}]'],
    ["a conversation that was not asked", '[{"conversation": 1, "topics": ["a"]}, {"conversation": 3, "topics": ["b"]}]'],
    ["a conversation twice", '[{"conversation": 1, "topics": ["a"]}, {"conversation": 1, "topics": ["b"]}]'],
    ["a conversation that is not an integer", '[{"conversation": 1.5, "topics": ["a"]}, {"conversation": 2, "topics": ["b"]}]'],
    ["a conversation that is a text", '[{"conversation": "1", "topics": ["a"]}, {"conversation": 2, "topics": ["b"]}]'],
    ["a chat without topic", '[{"conversation": 1, "topics": []}, {"conversation": 2, "topics": ["b"]}]'],
    ["a chat with more than three topics", '[{"conversation": 1, "topics": ["a", "b", "c", "d"]}, {"conversation": 2, "topics": ["b"]}]'],
    ["a topic with three words", '[{"conversation": 1, "topics": ["a b c"]}, {"conversation": 2, "topics": ["b"]}]'],
    ["an empty topic", '[{"conversation": 1, "topics": ["  "]}, {"conversation": 2, "topics": ["b"]}]'],
    ["a topic that is not a text", '[{"conversation": 1, "topics": [7]}, {"conversation": 2, "topics": ["b"]}]'],
    ["topics that are not an array", '[{"conversation": 1, "topics": "a"}, {"conversation": 2, "topics": ["b"]}]'],
  ])("gives null for %s", (_name, answer) => {
    expect(parseLanguageModelAnswer(answer, 2)).toBeNull();
  });
});
