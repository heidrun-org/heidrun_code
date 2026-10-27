// @vitest-environment node
import { describe, expect, it } from "vitest";
import { relatedTopicOrder, topicTimelineLayout, verticalLineLength } from "./topic_timeline";

/**
 * Six chats where "cache" and "sidebar" go together, and "git" and "worktree" go together. "panel" has the most chats and
 * shares two chats with "sidebar".
 */
function sixChats(): Map<string, string[]> {
  return new Map([
    ["a", ["panel", "sidebar"]],
    ["b", ["panel", "sidebar", "cache"]],
    ["c", ["panel", "git"]],
    ["d", ["git", "worktree"]],
    ["e", ["git", "worktree"]],
    ["f", ["panel", "cache"]],
  ]);
}

describe("relatedTopicOrder", () => {
  it("starts with the topic of the most chats, then adds the topic that shares the most chats with the last one", () => {
    expect(relatedTopicOrder(sixChats())).toEqual(["panel", "cache", "sidebar", "git", "worktree"]);
  });

  it("gives the same order for the same chats, whatever the order of the chats", () => {
    const reversed = new Map([...sixChats()].reverse());
    expect(relatedTopicOrder(reversed)).toEqual(relatedTopicOrder(sixChats()));
  });

  it("makes the vertical lines shorter than the order by number of chats", () => {
    const byChatCount = ["panel", "git", "cache", "sidebar", "worktree"];
    const related = relatedTopicOrder(sixChats());
    expect(verticalLineLength(related, sixChats())).toBeLessThan(verticalLineLength(byChatCount, sixChats()));
  });

  it("gives no topic for no chat", () => {
    expect(relatedTopicOrder(new Map())).toEqual([]);
  });
});

describe("verticalLineLength", () => {
  it("adds, for each chat, the distance between its highest and its lowest row", () => {
    const topics = new Map([
      ["a", ["x", "z"]],
      ["b", ["y"]],
    ]);
    expect(verticalLineLength(["x", "y", "z"], topics)).toBe(2);
    expect(verticalLineLength(["x", "z", "y"], topics)).toBe(1);
  });
});

describe("topicTimelineLayout", () => {
  const chats = [
    { id: "a", lastAt: 1_000 },
    { id: "b", lastAt: 3_000 },
    { id: "c", lastAt: 2_000 },
    { id: "none", lastAt: 9_000 },
  ];
  const topics = new Map([
    ["a", ["panel", "sidebar"]],
    ["b", ["panel"]],
    ["c", ["git"]],
    ["none", []],
  ]);

  it("gives one row for each topic, with the number of chats of each topic", () => {
    const layout = topicTimelineLayout(chats, topics);
    expect(layout.topics).toEqual(["panel", "sidebar", "git"]);
    expect(layout.chatCounts).toEqual([2, 1, 1]);
  });

  it("places each dot at the date of the last message of its chat, from the oldest chat to the newest chat", () => {
    const layout = topicTimelineLayout(chats, topics);
    expect(layout.dots).toEqual([
      { chatId: "a", row: 0, x: 0 },
      { chatId: "a", row: 1, x: 0 },
      { chatId: "b", row: 0, x: 1 },
      { chatId: "c", row: 2, x: 0.5 },
    ]);
    expect(layout.firstAt).toBe(1_000);
    expect(layout.lastAt).toBe(3_000);
  });

  it("gives a chat without a topic no dot, and does not count its date", () => {
    const layout = topicTimelineLayout(chats, topics);
    expect(layout.dots.some((dot) => dot.chatId === "none")).toBe(false);
    expect(layout.lastAt).toBe(3_000);
  });

  it("joins the dots of a chat that has several topics with one vertical line", () => {
    expect(topicTimelineLayout(chats, topics).lines).toEqual([{ chatId: "a", topRow: 0, bottomRow: 1, x: 0 }]);
  });

  it("puts every dot in the middle when all the chats have the same date", () => {
    const layout = topicTimelineLayout([{ id: "a", lastAt: 5 }], new Map([["a", ["panel"]]]));
    expect(layout.dots).toEqual([{ chatId: "a", row: 0, x: 0.5 }]);
  });

  it("gives an empty picture when no chat has a topic", () => {
    expect(topicTimelineLayout(chats, new Map())).toEqual({
      topics: [],
      chatCounts: [],
      dots: [],
      lines: [],
      firstAt: null,
      lastAt: null,
    });
  });
});
