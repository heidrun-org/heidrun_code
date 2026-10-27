import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { invoke } from "@tauri-apps/api/core";
import ChatImagesSection from "./ChatImagesSection.vue";
import chatImagesSectionSource from "./ChatImagesSection.vue?raw";
import { ChatImages } from "../stores/chat_images";
import { state } from "../stores/session";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

enableAutoUnmount(afterEach);

/** A session with one pane, whose status line gave the tokens `tokens`. */
function snapshotWith(tokens: Record<string, string>) {
  return {
    version: "test",
    protocol: 1,
    workspaces: [{ workspace_id: "w1", number: 1, label: "heidrun", focused: true, pane_count: 1, tab_count: 1, active_tab_id: "w1:t1", agent_status: "unknown" }],
    tabs: [],
    panes: [{ pane_id: "p1", workspace_id: "w1", tab_id: "w1:t1", focused: true, tokens }],
    layouts: [],
    agents: [],
  } as never;
}

/** The command chat_images_find answers the images `numbers`, each with its number as data. */
function answerImages(numbers: number[]) {
  vi.mocked(invoke).mockImplementation(async (command, payload) => {
    if (command !== "chat_images_find") {
      return null;
    }
    const after = (payload as { afterNumber: number }).afterNumber;
    return {
      numbers,
      images: numbers.filter((number) => number > after).map((number) => ({ number, media_type: "image/png", data: `D${number}` })),
    };
  });
}

beforeEach(async () => {
  vi.mocked(invoke).mockReset();
  await ChatImages.load(null);
  state.selectedPaneId = "p1";
});

afterEach(() => {
  state.snapshot = null;
  state.selectedPaneId = null;
  document.body.innerHTML = "";
});

describe("ChatImagesSection", () => {
  it("says that the selected pane shows no chat of Claude Code when the pane has no chat session identifier", async () => {
    state.snapshot = snapshotWith({});
    const wrapper = mount(ChatImagesSection);
    await flushPromises();
    expect(wrapper.get("h3").text()).toBe("Images of the chat");
    expect(wrapper.text()).toContain("The selected pane shows no chat of Claude Code.");
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
    expect(invoke).toHaveBeenCalledWith("chat_images_find", { sessionId: "chat-1", afterNumber: 0 });
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
      expect(vi.mocked(invoke).mock.lastCall?.[1]).toEqual({ sessionId: "chat-1", afterNumber: 1 });
      expect(wrapper.findAll("li span").map((span) => span.text())).toEqual(["[Image #1]", "[Image #2]"]);
      answerImages([5]);
      state.snapshot = snapshotWith({ hd_sid: "chat-2", hd_ts: "3" });
      await flushPromises();
      expect(vi.mocked(invoke).mock.lastCall?.[1]).toEqual({ sessionId: "chat-2", afterNumber: 0 });
      expect(wrapper.findAll("li span").map((span) => span.text())).toEqual(["[Image #5]"]);
    } finally {
      vi.useRealTimers();
    }
  });
});
