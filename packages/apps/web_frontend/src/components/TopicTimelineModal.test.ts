// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import TopicTimelineModal from "./TopicTimelineModal.vue";
import type { Chat } from "../stores/chats";

enableAutoUnmount(afterEach);

/** A chat whose last message is at `lastAt`. */
function chatOf(id: string, title: string, lastAt: number): Chat {
  return {
    id,
    title,
    updated_at: lastAt,
    meta: {
      first_at: null,
      last_at: lastAt,
      user_messages: 0,
      first_messages: [],
      folders: [],
      issues: [],
      pull_requests: [],
      files_written: [],
    },
  } as Chat;
}

const CHATS = [chatOf("a", "Fix the sidebar", 1_000), chatOf("b", "Cache the panel", 2_000), chatOf("c", "Git worktree", 3_000)];

const TOPICS = new Map([
  ["a", ["panel", "sidebar"]],
  ["b", ["panel", "cache"]],
  ["c", ["git"]],
]);

function mountTimeline(topics = TOPICS) {
  return mount(TopicTimelineModal, { props: { chats: CHATS, topics }, attachTo: document.body });
}

describe("TopicTimelineModal", () => {
  it("shows one row for each topic, in the order related topics together, with the number of chats", () => {
    const wrapper = mountTimeline();
    const rows = wrapper.findAll(".timeline-topic").map((row) => row.text().replace(/\s+/g, " "));
    expect(rows).toEqual(["panel 2", "cache 1", "sidebar 1", "git 1"]);
  });

  it("draws one dot for each topic of each chat, and one vertical line for each chat with several topics", () => {
    const wrapper = mountTimeline();
    expect(wrapper.findAll("circle.chat-dot")).toHaveLength(5);
    expect(wrapper.findAll("line.chat-line")).toHaveLength(2);
  });

  it("keeps only the chats of a clicked topic, and shows every chat again at a second click", async () => {
    const wrapper = mountTimeline();
    const git = wrapper.findAll(".timeline-topic")[3];
    await git.trigger("click");
    expect(git.attributes("aria-pressed")).toBe("true");
    expect(wrapper.findAll("circle.chat-dot.is-dimmed")).toHaveLength(4);
    await git.trigger("click");
    expect(wrapper.findAll("circle.chat-dot.is-dimmed")).toHaveLength(0);
  });

  it("opens the chat of a clicked dot", async () => {
    const wrapper = mountTimeline(new Map([["c", ["git"]]]));
    await wrapper.find("circle.chat-dot").trigger("click");
    expect(wrapper.emitted("open")).toEqual([[CHATS[2]]]);
  });

  it("closes with the key Escape and with the close button", async () => {
    const wrapper = mountTimeline();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await wrapper.find(".dialog-header button").trigger("click");
    expect(wrapper.emitted("close")).toHaveLength(2);
  });

  it("says that no chat has a topic when the list has none", () => {
    const wrapper = mountTimeline(new Map());
    expect(wrapper.text()).toContain("No chat of the list has a dynamic topic yet.");
    expect(wrapper.find("svg[role='img']").exists()).toBe(false);
  });
});
