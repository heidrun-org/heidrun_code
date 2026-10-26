// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import DynamicTopicBar from "./DynamicTopicBar.vue";

enableAutoUnmount(afterEach);

/** The nine topics of the tests: with the button "All", the strip holds ten buttons. */
const TOPICS = ["panel", "cache", "sidebar", "tab", "git", "note", "agent", "pane", "chat"];

/** The number of chats of each topic in the tests: "panel" has two chats, the other topics have one chat. */
const CHAT_COUNTS = new Map(TOPICS.map((topic) => [topic, topic === "panel" ? 2 : 1]));

/** The visible width of the strip in the tests, in pixels. */
const VIEW_WIDTH = 400;

/** The full width of the strip in the tests: ten buttons of 80 pixels with a gap of 8 pixels. */
const SCROLL_WIDTH = 872;

/** The properties that jsdom does not compute, and the way to put them back. */
const restores: (() => void)[] = [];

/** Gives a property of an element class a getter for the length of the test, because jsdom has no layout. */
function fakeLayout(target: object, name: string, getter: (element: HTMLElement) => number): void {
  const original = Object.getOwnPropertyDescriptor(target, name);
  Object.defineProperty(target, name, {
    configurable: true,
    get(this: HTMLElement) {
      return getter(this);
    },
  });
  restores.push(() => {
    if (original === undefined) {
      delete (target as Record<string, unknown>)[name];
    } else {
      Object.defineProperty(target, name, original);
    }
  });
}

/** Makes the strip 400 pixels wide, with ten buttons of 80 pixels and a gap of 8 pixels, as a browser would lay it out. */
function layoutTenButtons(): void {
  fakeLayout(Element.prototype, "clientWidth", (element) => (element.classList.contains("topic-strip") ? VIEW_WIDTH : 0));
  fakeLayout(Element.prototype, "scrollWidth", (element) => (element.classList.contains("topic-strip") ? SCROLL_WIDTH : 0));
  fakeLayout(HTMLElement.prototype, "offsetLeft", (element) =>
    element.classList.contains("topic-chip") ? Array.from(element.parentElement?.children ?? []).indexOf(element) * 88 : 0,
  );
  fakeLayout(HTMLElement.prototype, "offsetWidth", (element) => (element.classList.contains("topic-chip") ? 80 : 0));
}

afterEach(() => {
  while (restores.length > 0) {
    restores.pop()?.();
  }
});

/** Mounts the bar, and keeps the calls of `scrollTo` of the strip. */
async function mountBar(selected: string | null = null) {
  const scrollTo = vi.fn();
  const original = Element.prototype.scrollTo;
  Element.prototype.scrollTo = scrollTo as never;
  restores.push(() => {
    Element.prototype.scrollTo = original;
  });
  const wrapper = mount(DynamicTopicBar, { props: { topics: TOPICS, chatCounts: CHAT_COUNTS, selected } });
  await wrapper.vm.$nextTick();
  return { wrapper, scrollTo };
}

/** Moves the strip as the browser does after a smooth scroll, and tells the bar. */
async function scrollStripTo(wrapper: ReturnType<typeof mount>, left: number): Promise<void> {
  const strip = wrapper.get(".topic-strip").element as HTMLElement;
  Object.defineProperty(strip, "scrollLeft", { configurable: true, writable: true, value: left });
  await wrapper.get(".topic-strip").trigger("scroll");
}

describe("DynamicTopicBar", () => {
  it("shows the button All first, then the topics in the given order", async () => {
    const { wrapper } = await mountBar();
    expect(wrapper.findAll(".topic-chip").map((chip) => chip.text())).toEqual(["All", ...TOPICS]);
    expect(wrapper.get('[role="group"]').attributes("aria-label")).toBe("Filter the chats by dynamic topic");
  });

  it("presses the button All when no topic is selected, and the button of the selected topic otherwise", async () => {
    const withoutTopic = await mountBar(null);
    expect(withoutTopic.wrapper.findAll(".topic-chip")[0].attributes("aria-pressed")).toBe("true");
    expect(withoutTopic.wrapper.findAll(".topic-chip")[0].classes()).toContain("is-selected");
    const withTopic = await mountBar("cache");
    const pressed = withTopic.wrapper.findAll(".topic-chip").map((chip) => chip.attributes("aria-pressed"));
    expect(pressed[0]).toBe("false");
    expect(pressed[2]).toBe("true");
    expect(withTopic.wrapper.findAll(".topic-chip")[2].classes()).toContain("is-selected");
  });

  it("tells which button was clicked: the topic, or null for the button All", async () => {
    const { wrapper } = await mountBar("cache");
    await wrapper.findAll(".topic-chip")[3].trigger("click");
    await wrapper.findAll(".topic-chip")[0].trigger("click");
    expect(wrapper.emitted("select")).toEqual([["sidebar"], [null]]);
  });

  it("gives a title to each button, with the number of chats of the topic, and no number on the button itself", async () => {
    const { wrapper } = await mountBar();
    expect(wrapper.findAll(".topic-chip")[0].attributes("title")).toBe("Show all the chats");
    expect(wrapper.findAll(".topic-chip")[1].attributes("title")).toBe("Show only the chats about “panel” (2 chats)");
    expect(wrapper.findAll(".topic-chip")[2].attributes("title")).toBe("Show only the chats about “cache” (1 chat)");
    expect(wrapper.findAll(".topic-chip")[1].text()).toBe("panel");
  });

  it("shows no arrow when every button fits in the strip", async () => {
    const { wrapper } = await mountBar();
    expect(wrapper.find(".topic-arrow").exists()).toBe(false);
  });

  it("shows only the arrow at the end at first, when buttons are hidden after the strip", async () => {
    layoutTenButtons();
    const { wrapper } = await mountBar();
    expect(wrapper.find(".topic-arrow.is-previous").exists()).toBe(false);
    const next = wrapper.get(".topic-arrow.is-next");
    expect(next.attributes("title")).toBe("Show the next topics");
    expect(next.attributes("aria-label")).toBe("Show the next topics");
  });

  it("moves the strip by three buttons after a click on the arrow at the end, without a scroll bar and without a scroll by hand", async () => {
    layoutTenButtons();
    const { wrapper, scrollTo } = await mountBar();
    await wrapper.get(".topic-arrow.is-next").trigger("click");
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ left: 252, behavior: "smooth" });
  });

  it("shows the arrow at the start once the strip moved, and hides the arrow at the end at the end of the strip", async () => {
    layoutTenButtons();
    const { wrapper, scrollTo } = await mountBar();
    await scrollStripTo(wrapper, 252);
    expect(wrapper.find(".topic-arrow.is-previous").exists()).toBe(true);
    expect(wrapper.find(".topic-arrow.is-next").exists()).toBe(true);
    await scrollStripTo(wrapper, SCROLL_WIDTH - VIEW_WIDTH);
    expect(wrapper.find(".topic-arrow.is-next").exists()).toBe(false);
    await wrapper.get(".topic-arrow.is-previous").trigger("click");
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 220, behavior: "smooth" });
  });

  it("moves the strip to a selected topic that is hidden, when the selection changes from outside the bar", async () => {
    layoutTenButtons();
    const { wrapper, scrollTo } = await mountBar();
    await wrapper.setProps({ selected: "chat" });
    await wrapper.vm.$nextTick();
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ left: SCROLL_WIDTH - VIEW_WIDTH, behavior: "smooth" });
  });

  it("does not move the strip to a selected topic that is already visible, nor when no topic is selected", async () => {
    layoutTenButtons();
    const { wrapper, scrollTo } = await mountBar();
    await wrapper.setProps({ selected: "cache" });
    await wrapper.vm.$nextTick();
    await wrapper.setProps({ selected: null });
    await wrapper.vm.$nextTick();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("hides the arrow at the start when the strip is back at its start", async () => {
    layoutTenButtons();
    const { wrapper } = await mountBar();
    await scrollStripTo(wrapper, 252);
    await scrollStripTo(wrapper, 0);
    expect(wrapper.find(".topic-arrow.is-previous").exists()).toBe(false);
  });
});
