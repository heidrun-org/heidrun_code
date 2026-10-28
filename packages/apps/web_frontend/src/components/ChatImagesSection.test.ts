import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { invoke } from "@tauri-apps/api/core";
import ChatImagesSection from "./ChatImagesSection.vue";
import chatImagesSectionSource from "./ChatImagesSection.vue?raw";
import { ChatImages } from "../stores/chat_images";
import { ChatImagesFollower } from "../stores/chat_images_follower";
import { state } from "../stores/session";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

enableAutoUnmount(afterEach);

/** A session with one pane, whose status line gave the tokens `tokens`, and with the other fields `pane` of the pane. */
function snapshotWith(tokens: Record<string, string>, pane: Record<string, unknown> = {}) {
  return {
    version: "test",
    protocol: 1,
    workspaces: [{ workspace_id: "w1", number: 1, label: "heidrun", focused: true, pane_count: 1, tab_count: 1, active_tab_id: "w1:t1", agent_status: "unknown" }],
    tabs: [],
    panes: [{ pane_id: "p1", workspace_id: "w1", tab_id: "w1:t1", focused: true, tokens, ...pane }],
    layouts: [],
    agents: [],
  } as never;
}

/** The command chat_images_find answers the images `numbers` of a chat of Claude Code, each with its number as key and as data. */
function answerImages(numbers: number[]) {
  answerCodexImages(numbers.map((number) => [number, null]));
}

/**
 * The command chat_images_find answers the images `[number, message]`, in this order: the key of each image is its place
 * in the list, from 1, and its data is `D<key>`.
 */
function answerCodexImages(images: [number, number | null][]) {
  vi.mocked(invoke).mockImplementation(async (command, payload) => {
    if (command === "chat_images_find_codex_chat") {
      const { terminalTitle, folder } = payload as { terminalTitle: string; folder: string };
      return terminalTitle.startsWith("Fix the images") && folder === "/work/heidrun" ? CODEX_CHAT : null;
    }
    if (command !== "chat_images_find") {
      return null;
    }
    const after = (payload as { afterKey: number }).afterKey;
    const all = images.map(([number, message], index) => ({
      key: message === null ? number : index + 1,
      number,
      message,
      media_type: "image/png",
      data: `D${message === null ? number : index + 1}`,
    }));
    return { keys: all.map((image) => image.key), images: all.filter((image) => image.key > after) };
  });
}

/** The chat that the fake desktop application finds for the title "Fix the images" in the folder /work/heidrun. */
const CODEX_CHAT = "01a17e05-bc59-7e70-8f26-aa9c8f220604";

/** The pane fields of a Codex pane whose terminal shows the title of its chat. */
const CODEX_PANE = {
  agent: "codex",
  agent_status: "idle",
  terminal_title: "Fix the images | heidrun",
  terminal_title_stripped: "Fix the images | heidrun",
  foreground_cwd: "/work/heidrun",
};

beforeEach(async () => {
  vi.mocked(invoke).mockReset();
  await ChatImages.load(null);
  state.selectedPaneId = "p1";
});

afterEach(() => {
  ChatImagesFollower.stop();
  state.snapshot = null;
  state.selectedPaneId = null;
  document.body.innerHTML = "";
});

describe("ChatImagesSection", () => {
  it("says that the selected pane shows no chat of Claude Code or Codex when the pane has no chat session identifier", async () => {
    state.snapshot = snapshotWith({});
    const wrapper = mount(ChatImagesSection);
    await flushPromises();
    expect(wrapper.get("h3").text()).toBe("Images of the chat");
    expect(wrapper.text()).toContain("The selected pane shows no chat of Claude Code or Codex.");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("sits at the bottom of the column of the Clipboard sidebar section, below the notes", async () => {
    state.snapshot = snapshotWith({});
    const wrapper = mount(ChatImagesSection);
    expect(wrapper.get("section").classes()).toContain("chat-images");
    expect(chatImagesSectionSource).toMatch(/\.chat-images \{ margin-top: auto; \}/);
  });

  it("says that the chat has no image", async () => {
    state.snapshot = snapshotWith({ hd_sid: "chat-1" });
    answerImages([]);
    const wrapper = mount(ChatImagesSection);
    await flushPromises();
    expect(wrapper.text()).toContain("The chat of the selected pane has no image.");
  });

  it("shows each image with the text [Image #N] of the chat, in the order of the numbers", async () => {
    state.snapshot = snapshotWith({ hd_sid: "chat-1" });
    answerImages([1, 2, 6, 7]);
    const wrapper = mount(ChatImagesSection);
    await flushPromises();
    expect(invoke).toHaveBeenCalledWith("chat_images_find", { sessionId: "chat-1", afterKey: 0 });
    expect(wrapper.findAll("li span").map((span) => span.text())).toEqual(["[Image #1]", "[Image #2]", "[Image #6]", "[Image #7]"]);
    expect(wrapper.findAll("li img").map((image) => image.attributes("src"))).toEqual([
      "data:image/png;base64,D1",
      "data:image/png;base64,D2",
      "data:image/png;base64,D6",
      "data:image/png;base64,D7",
    ]);
  });

  it("opens the big view on a click, moves with the arrow keys, and closes with Escape", async () => {
    state.snapshot = snapshotWith({ hd_sid: "chat-1" });
    answerImages([1, 2]);
    const wrapper = mount(ChatImagesSection, { attachTo: document.body });
    await flushPromises();
    await wrapper.findAll("li button")[1].trigger("click");
    const caption = () => document.body.querySelector(".overlay figcaption .mono")?.textContent;
    expect(caption()).toBe("[Image #2]");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    await flushPromises();
    expect(caption()).toBe("[Image #1]");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await flushPromises();
    expect(document.body.querySelector(".overlay")).toBe(null);
  });

  it("reads the new images after the status line of Claude Code reports a change, and the images of another chat at once", async () => {
    vi.useFakeTimers();
    try {
      state.snapshot = snapshotWith({ hd_sid: "chat-1", hd_ts: "1" });
      answerImages([1]);
      const wrapper = mount(ChatImagesSection);
      await flushPromises();
      answerImages([1, 2]);
      state.snapshot = snapshotWith({ hd_sid: "chat-1", hd_ts: "2" });
      await flushPromises();
      await vi.advanceTimersByTimeAsync(2000);
      expect(vi.mocked(invoke).mock.lastCall?.[1]).toEqual({ sessionId: "chat-1", afterKey: 1 });
      expect(wrapper.findAll("li span").map((span) => span.text())).toEqual(["[Image #1]", "[Image #2]"]);
      answerImages([5]);
      state.snapshot = snapshotWith({ hd_sid: "chat-2", hd_ts: "3" });
      await flushPromises();
      expect(vi.mocked(invoke).mock.lastCall?.[1]).toEqual({ sessionId: "chat-2", afterKey: 0 });
      expect(wrapper.findAll("li span").map((span) => span.text())).toEqual(["[Image #5]"]);
    } finally {
      vi.useRealTimers();
    }
  });
  it("shows the images of a Codex chat with their message, because Codex starts the numbers again in each message", async () => {
    state.snapshot = snapshotWith({}, CODEX_PANE);
    answerCodexImages([[1, 1], [1, 2], [2, 2]]);
    const wrapper = mount(ChatImagesSection);
    await flushPromises();
    expect(invoke).toHaveBeenCalledWith("chat_images_find_codex_chat", { terminalTitle: "Fix the images | heidrun", folder: "/work/heidrun" });
    expect(invoke).toHaveBeenCalledWith("chat_images_find", { sessionId: CODEX_CHAT, afterKey: 0 });
    expect(wrapper.findAll("li button").map((button) => button.findAll("span").map((span) => span.text()))).toEqual([
      ["[Image #1]", "Message 1"],
      ["[Image #1]", "Message 2"],
      ["[Image #2]", "Message 2"],
    ]);
    expect(wrapper.findAll("li img").map((image) => image.attributes("alt"))).toEqual([
      "Message 1 · [Image #1]",
      "Message 2 · [Image #1]",
      "Message 2 · [Image #2]",
    ]);
    expect(wrapper.findAll("li img").map((image) => image.attributes("src"))).toEqual([
      "data:image/png;base64,D1",
      "data:image/png;base64,D2",
      "data:image/png;base64,D3",
    ]);
  });

  it("says that the Codex chat has no title yet when no chat matches the title of the terminal, and asks for no image", async () => {
    answerCodexImages([]);
    state.snapshot = snapshotWith({}, { ...CODEX_PANE, terminal_title: "heidrun", terminal_title_stripped: "heidrun" });
    const wrapper = mount(ChatImagesSection);
    await flushPromises();
    expect(wrapper.text()).toContain("This chat has no title yet: send a first message.");
    expect(vi.mocked(invoke).mock.calls.map((call) => call[0])).toEqual(["chat_images_find_codex_chat"]);
  });

  it("finds the Codex chat once Codex gives the chat a title", async () => {
    answerCodexImages([[1, 1]]);
    state.snapshot = snapshotWith({}, { ...CODEX_PANE, terminal_title: "heidrun", terminal_title_stripped: "heidrun" });
    const wrapper = mount(ChatImagesSection);
    await flushPromises();
    state.snapshot = snapshotWith({}, CODEX_PANE);
    await flushPromises();
    expect(wrapper.findAll("li img").map((image) => image.attributes("alt"))).toEqual(["Message 1 · [Image #1]"]);
  });

  it("reads the chat of Claude Code in a pane that ran Codex before, and does not look for a Codex chat", async () => {
    state.snapshot = snapshotWith({ hd_sid: "chat-1" }, { ...CODEX_PANE, agent: "claude" });
    answerImages([1]);
    mount(ChatImagesSection);
    await flushPromises();
    expect(invoke).toHaveBeenCalledWith("chat_images_find", { sessionId: "chat-1", afterKey: 0 });
    expect(vi.mocked(invoke).mock.calls.map((call) => call[0])).not.toContain("chat_images_find_codex_chat");
  });

  it("reads the new images of a Codex chat after the state of Codex changes", async () => {
    vi.useFakeTimers();
    try {
      state.snapshot = snapshotWith({}, CODEX_PANE);
      answerCodexImages([[1, 1]]);
      const wrapper = mount(ChatImagesSection);
      await flushPromises();
      answerCodexImages([[1, 1], [1, 2]]);
      state.snapshot = snapshotWith({}, { ...CODEX_PANE, agent_status: "working" });
      await flushPromises();
      await vi.advanceTimersByTimeAsync(2000);
      expect(vi.mocked(invoke).mock.lastCall?.[1]).toEqual({ sessionId: CODEX_CHAT, afterKey: 1 });
      expect(wrapper.findAll("li img").map((image) => image.attributes("alt"))).toEqual(["Message 1 · [Image #1]", "Message 2 · [Image #1]"]);
    } finally {
      vi.useRealTimers();
    }
  });
});
