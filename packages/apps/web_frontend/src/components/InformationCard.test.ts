import { afterEach, describe, expect, it, vi } from "vitest";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import InformationCard from "./InformationCard.vue";

enableAutoUnmount(afterEach);

function mountCard() {
  return mount(InformationCard, {
    attachTo: document.body,
    props: { label: "Files written" },
    slots: { default: "<span>chats.rs</span>", card: "<button>Inside the card</button>" },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("InformationCard", () => {
  it("shows the part and no card at the start", () => {
    const wrapper = mountCard();
    expect(wrapper.text()).toBe("chats.rs");
    expect(wrapper.find(".popover").exists()).toBe(false);
  });

  it("prepares and opens a terminal card when its hover anchor is mounted", async () => {
    const prepare = vi.fn(async () => {});
    const wrapper = mount(InformationCard, {
      props: { label: "Pull request #12", opensOnMount: true, prepare },
      slots: { card: "<button>Merge</button>" },
    });
    await vi.waitFor(() => expect(wrapper.find(".popover").exists()).toBe(true));
    expect(prepare).toHaveBeenCalledTimes(1);
    await wrapper.trigger("keydown", { key: "Escape" });
    expect(wrapper.emitted("dismiss")).toHaveLength(1);
  });

  it("opens the card on a click on the part", async () => {
    const wrapper = mountCard();
    await wrapper.trigger("click");
    expect(wrapper.find(".popover").exists()).toBe(true);
    expect(wrapper.classes()).toContain("is-open");
  });

  it("does not open the card when the pointer only rests on the part", async () => {
    vi.useFakeTimers();
    const wrapper = mountCard();
    await wrapper.trigger("pointerenter");
    await vi.advanceTimersByTimeAsync(5_000);
    expect(wrapper.find(".popover").exists()).toBe(false);
    vi.useRealTimers();
  });

  it("does not open the card when the part only gets the keyboard focus", async () => {
    const wrapper = mountCard();
    await wrapper.trigger("focusin");
    expect(wrapper.find(".popover").exists()).toBe(false);
  });

  it("keeps the card open when the pointer leaves the part, and closes it on a second click", async () => {
    vi.useFakeTimers();
    const wrapper = mountCard();
    await wrapper.trigger("click");
    await wrapper.trigger("pointerleave");
    await vi.advanceTimersByTimeAsync(5_000);
    expect(wrapper.find(".popover").exists()).toBe(true);
    await wrapper.trigger("click");
    expect(wrapper.find(".popover").exists()).toBe(false);
    expect(wrapper.classes()).not.toContain("is-open");
    vi.useRealTimers();
  });

  it("tells with the event open each time the card opens, and not when it closes", async () => {
    const wrapper = mountCard();
    await wrapper.trigger("click");
    await wrapper.trigger("click");
    expect(wrapper.emitted("open")?.length).toBe(1);
    await wrapper.trigger("click");
    expect(wrapper.emitted("open")?.length).toBe(2);
  });

  it("opens the card on the key Enter and on the key Space when the part has the keyboard focus", async () => {
    const wrapper = mountCard();
    expect(wrapper.attributes("tabindex")).toBe("0");
    await wrapper.trigger("keydown", { key: "Enter" });
    expect(wrapper.find(".popover").exists()).toBe(true);
    await wrapper.trigger("keydown", { key: "Escape" });
    expect(wrapper.find(".popover").exists()).toBe(false);
    await wrapper.trigger("keydown", { key: " " });
    expect(wrapper.find(".popover").exists()).toBe(true);
  });

  it("puts the card inside the part, with the role group and the label", async () => {
    const wrapper = mountCard();
    await wrapper.trigger("click");
    const card = wrapper.get(".popover");
    expect(card.attributes("role")).toBe("group");
    expect(card.attributes("aria-label")).toBe("Files written");
    expect(card.classes()).toEqual(expect.arrayContaining(["bs-popover-start", "position-fixed"]));
    expect(card.get("button").text()).toBe("Inside the card");
  });

  it("closes the card on the key Escape", async () => {
    const wrapper = mountCard();
    await wrapper.trigger("click");
    await wrapper.trigger("keydown", { key: "Escape" });
    expect(wrapper.find(".popover").exists()).toBe(false);
  });

  it("closes the card when the focus leaves, and keeps it when the focus goes to a button of the card", async () => {
    const wrapper = mountCard();
    await wrapper.trigger("click");
    await wrapper.trigger("focusout", { relatedTarget: wrapper.get(".popover button").element });
    expect(wrapper.find(".popover").exists()).toBe(true);
    await wrapper.trigger("focusout", { relatedTarget: document.body });
    expect(wrapper.find(".popover").exists()).toBe(false);
  });

  it("closes the card on a press outside, and keeps it on a press inside", async () => {
    const wrapper = mountCard();
    await wrapper.trigger("click");
    wrapper.get(".popover button").element.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".popover").exists()).toBe(true);
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".popover").exists()).toBe(false);
  });

  it("keeps the card open on a click inside the card", async () => {
    const wrapper = mountCard();
    await wrapper.trigger("click");
    await wrapper.get(".popover button").trigger("click");
    expect(wrapper.find(".popover").exists()).toBe(true);
  });

  it("places the card again when its height changes, so that it stays inside the window", async () => {
    let cardHeight = 100;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const isCard = this.classList.contains("popover");
      return {
        top: 500, left: 700, right: 800, bottom: 520, width: 100, height: isCard ? cardHeight : 20, x: 700, y: 500, toJSON: () => ({}),
      };
    });
    let sizeChanged: () => void = () => {};
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          sizeChanged = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    const wrapper = mountCard();
    await wrapper.trigger("click");
    await wrapper.vm.$nextTick();
    expect(wrapper.get(".popover").attributes("style")).toContain("top: 500px");
    cardHeight = 400;
    sizeChanged();
    await wrapper.vm.$nextTick();
    expect(wrapper.get(".popover").attributes("style")).toContain(`top: ${window.innerHeight - 400 - 8}px`);
    vi.unstubAllGlobals();
  });

  it("places the card again when the window changes its size", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      top: 100, left: 700, right: 800, bottom: 120, width: 100, height: 20, x: 700, y: 100, toJSON: () => ({}),
    });
    const wrapper = mountCard();
    await wrapper.trigger("click");
    await wrapper.vm.$nextTick();
    const before = wrapper.get(".popover").attributes("style");
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth + 200 });
    window.dispatchEvent(new Event("resize"));
    await wrapper.vm.$nextTick();
    expect(wrapper.get(".popover").attributes("style")).not.toBe(before);
    expect(wrapper.get(".popover").attributes("style")).toContain(`right: ${originalWidth + 200 - 700 + 8}px`);
    Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth });
  });

  it("puts the card at the left of the part, as high as the part", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      top: 100, left: 700, right: 800, bottom: 120, width: 100, height: 20, x: 700, y: 100, toJSON: () => ({}),
    });
    const wrapper = mountCard();
    await wrapper.trigger("click");
    await wrapper.vm.$nextTick();
    const style = wrapper.get(".popover").attributes("style") ?? "";
    expect(style).toContain("top: 100px");
    expect(style).toContain(`right: ${window.innerWidth - 700 + 8}px`);
    expect(style).toContain("left: auto");
  });

  it("puts the card at the right of the part, as high as the part, when the placement is end", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const isCard = this.classList.contains("popover");
      return isCard
        ? { top: 0, left: 0, right: 300, bottom: 200, width: 300, height: 200, x: 0, y: 0, toJSON: () => ({}) }
        : { top: 100, left: 40, right: 240, bottom: 160, width: 200, height: 60, x: 40, y: 100, toJSON: () => ({}) };
    });
    const wrapper = mount(InformationCard, {
      attachTo: document.body,
      props: { label: "Issue", placement: "end" },
      slots: { default: "<span>Row</span>", card: "<p>Text</p>" },
    });
    await wrapper.trigger("click");
    await wrapper.vm.$nextTick();
    const card = wrapper.get(".popover");
    expect(card.classes()).toEqual(expect.arrayContaining(["bs-popover-end", "position-fixed"]));
    expect(card.classes()).not.toContain("bs-popover-start");
    expect(card.attributes("style")).toContain("top: 100px");
    expect(card.attributes("style")).toContain("left: 248px");
    expect(card.attributes("style")).toContain("right: auto");
    expect(wrapper.get(".popover-arrow").attributes("style")).toContain("top: 22px");
  });

  it("puts the card below the part, with its arrow under the middle of the part, when the placement is bottom", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const isCard = this.classList.contains("popover");
      return isCard
        ? { top: 0, left: 0, right: 300, bottom: 200, width: 300, height: 200, x: 0, y: 0, toJSON: () => ({}) }
        : { top: 100, left: 40, right: 60, bottom: 120, width: 20, height: 20, x: 40, y: 100, toJSON: () => ({}) };
    });
    const wrapper = mount(InformationCard, {
      attachTo: document.body,
      props: { label: "Help", placement: "bottom" },
      slots: { default: "<span>?</span>", card: "<p>Text</p>" },
    });
    await wrapper.trigger("click");
    await wrapper.vm.$nextTick();
    const card = wrapper.get(".popover");
    expect(card.classes()).toEqual(expect.arrayContaining(["bs-popover-bottom", "position-fixed"]));
    expect(card.classes()).not.toContain("bs-popover-start");
    expect(card.attributes("style")).toContain("top: 128px");
    expect(card.attributes("style")).toContain("left: 40px");
    expect(wrapper.get(".popover-arrow").attributes("style")).toContain("left: 8px");
  });

  it("keeps a card below the part inside the window, at the right edge", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const isCard = this.classList.contains("popover");
      return isCard
        ? { top: 0, left: 0, right: 300, bottom: 200, width: 300, height: 200, x: 0, y: 0, toJSON: () => ({}) }
        : { top: 100, left: window.innerWidth - 30, right: window.innerWidth - 10, bottom: 120, width: 20, height: 20, x: 0, y: 100, toJSON: () => ({}) };
    });
    const wrapper = mount(InformationCard, {
      attachTo: document.body,
      props: { label: "Help", placement: "bottom" },
      slots: { default: "<span>?</span>", card: "<p>Text</p>" },
    });
    await wrapper.trigger("click");
    await wrapper.vm.$nextTick();
    expect(wrapper.get(".popover").attributes("style")).toContain(`left: ${window.innerWidth - 300 - 8}px`);
    expect(wrapper.get(".popover-arrow").attributes("style")).toContain(`left: ${window.innerWidth - 20 - (window.innerWidth - 308) - 8}px`);
  });
});

describe("InformationCard placement for a terminal reference", () => {
  it.each([
    { boundaryTop: 0, anchorTop: 350, placement: "top", cardTop: 144 },
    { boundaryTop: 0, anchorTop: 100, placement: "bottom", cardTop: 126 },
    { boundaryTop: 160, anchorTop: 350, placement: "bottom", cardTop: 376 },
    { boundaryTop: 160, boundaryBottom: 530, anchorTop: 350, placement: "top", cardTop: 168 },
  ])("places the card $placement with a centered arrow when the reference is at $anchorTop", async ({
    boundaryTop, boundaryBottom = window.innerHeight, anchorTop, placement, cardTop,
  }) => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains("popover")) {
        return new DOMRect(0, 0, 300, 200);
      }
      if (this.hasAttribute("data-terminal-card-boundary")) {
        return new DOMRect(0, boundaryTop, window.innerWidth, boundaryBottom - boundaryTop);
      }
      return new DOMRect(400, anchorTop, 80, 20);
    });
    const terminal = document.createElement("div");
    terminal.setAttribute("data-terminal-card-boundary", "");
    const wrapper = mount(InformationCard, {
      attachTo: terminal,
      props: { label: "Terminal reference", placement: "above-or-below", opensOnMount: true },
      slots: { card: "<p>Reference details</p>" },
    });
    await vi.waitFor(() => {
      const card = wrapper.get(".popover");
      expect(card.classes()).toContain(`bs-popover-${placement}`);
      expect(card.attributes("style")).toContain(`top: ${cardTop}px`);
      expect(card.attributes("style")).toContain("left: 290px");
      expect(wrapper.get(".popover-arrow").attributes("style")).toContain("left: 142px");
    });
  });
});

describe("InformationCard placement bottom-center (issue #646)", () => {
  /** Opens a card of 300 by 200 pixels below a part of 20 pixels, whose left edge is at `partLeft`. */
  async function openCenteredCard(partLeft: number) {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const isCard = this.classList.contains("popover");
      return isCard
        ? { top: 0, left: 0, right: 300, bottom: 200, width: 300, height: 200, x: 0, y: 0, toJSON: () => ({}) }
        : { top: 100, left: partLeft, right: partLeft + 20, bottom: 120, width: 20, height: 20, x: partLeft, y: 100, toJSON: () => ({}) };
    });
    const wrapper = mount(InformationCard, {
      attachTo: document.body,
      props: { label: "Help", placement: "bottom-center" },
      slots: { default: "<span>?</span>", card: "<p>Text</p>" },
    });
    await wrapper.trigger("click");
    await wrapper.vm.$nextTick();
    return wrapper;
  }

  it("puts the middle of the card under the middle of the part, with the arrow under the middle of the part", async () => {
    const wrapper = await openCenteredCard(400);
    const card = wrapper.get(".popover");
    expect(card.classes()).toEqual(expect.arrayContaining(["bs-popover-bottom", "position-fixed"]));
    expect(card.attributes("style")).toContain("top: 128px");
    expect(card.attributes("style")).toContain("left: 260px");
    expect(wrapper.get(".popover-arrow").attributes("style")).toContain("left: 142px");
  });

  it("keeps the card inside the window at the left edge, and the arrow under the middle of the part", async () => {
    const wrapper = await openCenteredCard(40);
    expect(wrapper.get(".popover").attributes("style")).toContain("left: 8px");
    expect(wrapper.get(".popover-arrow").attributes("style")).toContain("left: 34px");
  });

  it("keeps the card inside the window at the right edge, and the arrow under the middle of the part", async () => {
    const partLeft = window.innerWidth - 30;
    const wrapper = await openCenteredCard(partLeft);
    const cardLeft = window.innerWidth - 300 - 8;
    expect(wrapper.get(".popover").attributes("style")).toContain(`left: ${cardLeft}px`);
    expect(wrapper.get(".popover-arrow").attributes("style")).toContain(`left: ${partLeft + 10 - cardLeft - 8}px`);
  });

  it("keeps the left edge of the card at the left edge of the part when the placement is bottom", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const isCard = this.classList.contains("popover");
      return isCard
        ? { top: 0, left: 0, right: 300, bottom: 200, width: 300, height: 200, x: 0, y: 0, toJSON: () => ({}) }
        : { top: 100, left: 400, right: 420, bottom: 120, width: 20, height: 20, x: 400, y: 100, toJSON: () => ({}) };
    });
    const wrapper = mount(InformationCard, {
      attachTo: document.body,
      props: { label: "Help", placement: "bottom" },
      slots: { default: "<span>?</span>", card: "<p>Text</p>" },
    });
    await wrapper.trigger("click");
    await wrapper.vm.$nextTick();
    expect(wrapper.get(".popover").attributes("style")).toContain("left: 400px");
  });
});

describe("InformationCard width", () => {
  it("gives the card the width of the property width, and the usual width without it", async () => {
    const narrow = mount(InformationCard, {
      attachTo: document.body,
      props: { label: "Context window", width: "16rem" },
      slots: { default: "<span>ring</span>", card: "<span>Inside the card</span>" },
    });
    await narrow.trigger("click");
    expect(narrow.get(".popover").attributes("style")).toContain("width: 16rem");

    const usual = mountCard();
    await usual.trigger("click");
    expect(usual.get(".popover").attributes("style") ?? "").not.toContain("width: 16rem");
  });
});

describe("InformationCard with a preparation", () => {
  /** A card whose function `prepare` ends when the test calls `finish`. */
  function mountPreparedCard(onOpen: () => void = () => {}) {
    const control = { finish: () => {}, fail: () => {}, prepare: vi.fn() };
    control.prepare.mockImplementation(
      () =>
        new Promise<void>((resolve, reject) => {
          control.finish = resolve;
          control.fail = () => reject(new Error("The forge does not answer."));
        }),
    );
    const wrapper = mount(InformationCard, {
      attachTo: document.body,
      props: { label: "Details of #370", busyLabel: "Reading the details of #370", prepare: control.prepare, onOpen },
      slots: { default: "<span>row</span>", card: "<button>Inside the card</button>" },
    });
    return { wrapper, control };
  }

  const busy = "[data-information-card-busy]";

  it("does not open the card at the click, and opens it when the preparation is done", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const onOpen = vi.fn();
    const { wrapper, control } = mountPreparedCard(onOpen);
    await wrapper.trigger("click");
    expect(control.prepare).toHaveBeenCalledTimes(1);
    expect(wrapper.find(".popover").exists()).toBe(false);
    expect(onOpen).not.toHaveBeenCalled();
    control.finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(wrapper.find(".popover").exists()).toBe(true);
    expect(wrapper.classes()).toContain("is-open");
    expect(onOpen).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("shows no spinning wheel when the preparation takes less than 0.3 second", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { wrapper, control } = mountPreparedCard();
    await wrapper.trigger("click");
    await vi.advanceTimersByTimeAsync(299);
    expect(wrapper.find(busy).exists()).toBe(false);
    control.finish();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(wrapper.find(busy).exists()).toBe(false);
    expect(wrapper.find(".popover").exists()).toBe(true);
    vi.useRealTimers();
  });

  it("shows a spinning wheel after 0.3 second, and hides it when the card opens", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { wrapper, control } = mountPreparedCard();
    await wrapper.trigger("click");
    await vi.advanceTimersByTimeAsync(300);
    const wheel = wrapper.get(busy);
    expect(wheel.attributes("role")).toBe("status");
    expect(wheel.attributes("aria-label")).toBe("Reading the details of #370");
    expect(wrapper.attributes("aria-busy")).toBe("true");
    expect(wrapper.find(".popover").exists()).toBe(false);
    control.finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(wrapper.find(busy).exists()).toBe(false);
    expect(wrapper.attributes("aria-busy")).toBeUndefined();
    expect(wrapper.find(".popover").exists()).toBe(true);
    vi.useRealTimers();
  });

  it("cancels the opening at a second click on the part, and never opens the card", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { wrapper, control } = mountPreparedCard();
    await wrapper.trigger("click");
    await vi.advanceTimersByTimeAsync(300);
    expect(wrapper.find(busy).exists()).toBe(true);
    await wrapper.trigger("click");
    expect(wrapper.find(busy).exists()).toBe(false);
    control.finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(wrapper.find(".popover").exists()).toBe(false);
    expect(control.prepare).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("cancels the opening on the key Escape and on a press outside", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const first = mountPreparedCard();
    await first.wrapper.trigger("click");
    await first.wrapper.trigger("keydown", { key: "Escape" });
    first.control.finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(first.wrapper.find(".popover").exists()).toBe(false);
    const second = mountPreparedCard();
    await second.wrapper.trigger("click");
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    second.control.finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(second.wrapper.find(".popover").exists()).toBe(false);
    vi.useRealTimers();
  });

  it("opens the card with what it has when the preparation fails", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { wrapper, control } = mountPreparedCard();
    await wrapper.trigger("click");
    control.fail();
    await vi.advanceTimersByTimeAsync(0);
    expect(wrapper.find(".popover").exists()).toBe(true);
    vi.useRealTimers();
  });

  it("can open the card again after a cancelled opening", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { wrapper, control } = mountPreparedCard();
    await wrapper.trigger("click");
    await wrapper.trigger("click");
    await wrapper.trigger("click");
    expect(control.prepare).toHaveBeenCalledTimes(2);
    control.finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(wrapper.find(".popover").exists()).toBe(true);
    vi.useRealTimers();
  });
});
