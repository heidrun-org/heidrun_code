// @vitest-environment node
import { describe, expect, it } from "vitest";
import { singularOf, topicWordsOf } from "./dynamic_topic_words";

describe("singularOf", () => {
  it.each([
    ["topics", "topic"],
    ["branches", "branch"],
    ["fixes", "fix"],
    ["queries", "query"],
    ["status", "status"],
    ["process", "process"],
    ["analysis", "analysis"],
    ["sidebar", "sidebar"],
  ])("gives %s as %s", (word, expected) => {
    expect(singularOf(word)).toBe(expected);
  });
});

describe("topicWordsOf", () => {
  it("gives the words in lower case, in the order of the text, with the repeats", () => {
    expect(topicWordsOf("Cache the Sidebar, then cache again")).toEqual(["cache", "sidebar", "cache"]);
  });

  it("gives the words in the singular", () => {
    expect(topicWordsOf("The topics of the branches")).toEqual(["topic", "branch"]);
  });

  it("drops the stop words of English and of French", () => {
    expect(topicWordsOf("please make the list of the chats with the dossiers dans la barre")).toEqual([
      "list",
      "chat",
      "dossier",
      "barre",
    ]);
  });

  it("drops a stop word that shows up only after the plural mark is removed", () => {
    expect(topicWordsOf("wills")).toEqual([]);
  });

  it("drops the numbers, the words of one or two letters, and the addresses", () => {
    expect(topicWordsOf("fix 260 in a UI https://github.com/heidrun-org/heidrun/issues/260 sidebar")).toEqual(["sidebar"]);
  });

  it("removes the accents, so that the same word has one form", () => {
    expect(topicWordsOf("Créer la conversation, creer")).toEqual(["creer", "conversation", "creer"]);
  });

  it("splits a name in camel case, a name with underscores, and a path", () => {
    expect(topicWordsOf("ChatsPanel web_frontend/src/stores")).toEqual(["chat", "panel", "web", "frontend", "src", "store"]);
  });

  it("gives no word for an empty text", () => {
    expect(topicWordsOf("")).toEqual([]);
  });
});
