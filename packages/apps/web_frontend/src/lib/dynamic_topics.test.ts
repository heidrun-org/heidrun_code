// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { Chat } from "../stores/chats";
import {
  type DynamicTopicDocument,
  dynamicTopicReferences,
  dynamicTopicSourceInformation,
  dynamicTopicTerms,
  keywordTopics,
  MOST_TOPICS,
} from "./dynamic_topics";

/** A chat of the test, with the parts of its dynamic topic source information that the test gives. */
function chat(parts: {
  title?: string;
  messages?: string[];
  files?: string[];
  issues?: number[];
  pullRequests?: number[];
}): Chat {
  return {
    id: "c1",
    title: parts.title ?? "",
    updated_at: 1,
    meta: {
      first_at: null,
      last_at: null,
      user_messages: 0,
      first_messages: parts.messages ?? [],
      folders: [],
      issues: parts.issues ?? [],
      pull_requests: parts.pullRequests ?? [],
      files_written: parts.files ?? [],
    },
  };
}

describe("dynamicTopicSourceInformation", () => {
  it("gives the title, the first messages, the folders of the files below the root, and the given titles of the references", () => {
    const information = dynamicTopicSourceInformation(
      chat({
        title: "Add topics",
        messages: ["start with keywords"],
        files: ["/work/app/packages/apps/web_frontend/src/lib/a.ts", "/work/app/packages/apps/web_frontend/src/lib/b.ts"],
      }),
      "/work/app",
      ["Add dynamic topics"],
    );
    expect(information).toEqual({
      title: "Add topics",
      firstMessages: ["start with keywords"],
      fileFolders: ["packages/apps/web_frontend/src/lib", "packages/apps/web_frontend/src/lib"],
      referenceTitles: ["Add dynamic topics"],
    });
  });

  it("leaves out a file at the root of the repository, and a file that is not below the root", () => {
    const information = dynamicTopicSourceInformation(
      chat({ files: ["/work/app/README.md", "/elsewhere/notes/a.md"] }),
      "/work/app",
      [],
    );
    expect(information.fileFolders).toEqual([]);
  });

  it("counts a file written in a worktree and the same file at the root once, with the folders of the file at the root", () => {
    const information = dynamicTopicSourceInformation(
      chat({ files: ["/work/app/.claude/worktrees/fix-1/src/a.ts", "/work/app/src/a.ts"] }),
      "/work/app",
      [],
    );
    expect(information.fileFolders).toEqual(["src"]);
  });

  it("gives no folder when the root of the repository is not known", () => {
    expect(dynamicTopicSourceInformation(chat({ files: ["/work/app/src/a.ts"] }), null, []).fileFolders).toEqual([]);
  });
});

describe("dynamicTopicReferences", () => {
  it("keeps the three highest issue numbers, then the three highest pull request numbers", () => {
    const references = dynamicTopicReferences(chat({ issues: [1, 2, 3, 4, 5], pullRequests: [10, 11, 12, 13] }).meta);
    expect(references).toEqual([
      { kind: "issue", number: 3 },
      { kind: "issue", number: 4 },
      { kind: "issue", number: 5 },
      { kind: "pull_request", number: 11 },
      { kind: "pull_request", number: 12 },
      { kind: "pull_request", number: 13 },
    ]);
  });

  it("gives nothing for a chat that mentions no issue and no pull request", () => {
    expect(dynamicTopicReferences(chat({}).meta)).toEqual([]);
  });
});

describe("dynamicTopicTerms", () => {
  it("weighs a word by the part that holds it: the title 3, the titles of the references 2, the messages and the folders 1", () => {
    const terms = dynamicTopicTerms({
      title: "sidebar",
      firstMessages: ["message"],
      fileFolders: ["folder"],
      referenceTitles: ["reference"],
    });
    expect(terms).toEqual({ sidebar: 3, reference: 2, message: 1, folder: 1 });
  });

  it("adds the weights of a word that is in several parts", () => {
    const terms = dynamicTopicTerms({
      title: "cache",
      firstMessages: ["cache cache"],
      fileFolders: ["cache"],
      referenceTitles: [],
    });
    expect(terms).toEqual({ cache: 6 });
  });

  it("keeps a word that is the name of a method of every object", () => {
    const terms = dynamicTopicTerms({ title: "constructor constructor", firstMessages: [], fileFolders: [], referenceTitles: [] });
    expect(terms).toEqual({ constructor: 6 });
  });
});

describe("keywordTopics", () => {
  it("gives the words that are in one chat and in no other chat before the words that every chat holds", () => {
    const topics = keywordTopics([
      { id: "a", terms: { sidebar: 3, common: 3 } },
      { id: "b", terms: { cache: 3, common: 3 } },
    ]);
    expect(topics.get("a")).toEqual(["sidebar"]);
    expect(topics.get("b")).toEqual(["cache"]);
  });

  it("gives no word that every chat holds, however often the chat repeats it", () => {
    const topics = keywordTopics([
      { id: "a", terms: { src: 40 } },
      { id: "b", terms: { src: 1 } },
    ]);
    expect(topics.get("a")).toEqual([]);
  });

  it("ranks the words of one chat by their weight, and by the alphabet when the weights are the same", () => {
    const topics = keywordTopics([
      { id: "a", terms: { zebra: 3, apple: 3, mango: 1 } },
      { id: "b", terms: { other: 1 } },
    ]);
    expect(topics.get("a")).toEqual(["apple", "zebra", "mango"]);
  });

  it(`gives at most ${MOST_TOPICS} words for a chat`, () => {
    const topics = keywordTopics([
      { id: "a", terms: { one: 5, two: 4, three: 3, four: 2, five: 1 } },
      { id: "b", terms: { other: 1 } },
    ]);
    expect(topics.get("a")).toEqual(["one", "two", "three"]);
  });

  it("gives the most weighted words of a list of one chat, because no other chat makes a word rare", () => {
    const topics = keywordTopics([{ id: "a", terms: { sidebar: 3, panel: 1 } }]);
    expect(topics.get("a")).toEqual(["sidebar", "panel"]);
  });

  it("gives no word for a chat without terms, and no entry for no chat", () => {
    expect(keywordTopics([{ id: "a", terms: {} }]).get("a")).toEqual([]);
    expect(keywordTopics([]).size).toBe(0);
  });

  it("gives the same words in the same order for the same chats", () => {
    const documents: DynamicTopicDocument[] = [
      { id: "a", terms: { x: 2, y: 2, z: 2 } },
      { id: "b", terms: { y: 1 } },
      { id: "c", terms: { w: 1 } },
    ];
    expect(keywordTopics(documents)).toEqual(keywordTopics([...documents]));
  });
});
