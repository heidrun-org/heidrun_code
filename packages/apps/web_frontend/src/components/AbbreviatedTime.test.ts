import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import Fs from "node:fs";
import Path from "node:path";
import AbbreviatedTime from "./AbbreviatedTime.vue";
import Icon from "./Icon.vue";
import { fullDateText } from "../lib/chat_dates";
import { settings } from "../stores/settings";

enableAutoUnmount(afterEach);

const NOW = new Date(2026, 9, 15, 10, 30).getTime();

beforeEach(() => {
  settings.language = "en";
  settings.timeFormat = "24h";
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("AbbreviatedTime", () => {
  it("shows the abbreviated time, then a circled question mark", () => {
    const wrapper = mount(AbbreviatedTime, { props: { milliseconds: NOW - 5_000 } });
    expect(wrapper.text()).toBe("just now");
    const mark = wrapper.get("[data-exact-time]");
    expect(mark.find("small").exists()).toBe(true);
    expect(mark.findComponent(Icon).props("name")).toBe("question-circle");
    expect(wrapper.html().indexOf("just now")).toBeLessThan(wrapper.html().indexOf("data-exact-time"));
  });

  it("gives the exact time as the title of the circled question mark, with the day of the week", () => {
    const milliseconds = NOW - 3 * 60_000;
    const wrapper = mount(AbbreviatedTime, { props: { milliseconds } });
    expect(wrapper.text()).toBe("3 min ago");
    const mark = wrapper.get("[data-exact-time]");
    expect(mark.attributes("title")).toBe(fullDateText(milliseconds));
    expect(mark.attributes("title")).toBe("Thu, Oct 15, 2026, 10:27");
    expect(mark.attributes("aria-label")).toBe(mark.attributes("title"));
  });

  it("puts the circled question mark after the time inside a phrase that ends with the time", () => {
    const wrapper = mount(AbbreviatedTime, { props: { milliseconds: NOW - 3 * 60_000, phraseKey: "mobileModal.lastSeen" } });
    expect(wrapper.text()).toBe("Last connection of a device: 3 min ago");
    expect(wrapper.html().indexOf("3 min ago")).toBeLessThan(wrapper.html().indexOf("data-exact-time"));
  });
});

describe("abbreviated times in the whole application", () => {
  /** The files of the folder `src` that end with `.vue`, as paths relative to the folder `src`. */
  const vueFiles = Fs.readdirSync(Path.resolve(import.meta.dirname, ".."), { recursive: true, encoding: "utf8" }).filter(
    (file) => file.endsWith(".vue") === true,
  );

  it("calls the function `ago` in no component but AbbreviatedTime, so that every abbreviated time has the circled question mark", () => {
    expect(vueFiles.length).toBeGreaterThan(20);
    const offenders = vueFiles.filter((file) => {
      if (file === Path.join("components", "AbbreviatedTime.vue")) {
        return false;
      }
      const text = Fs.readFileSync(Path.resolve(import.meta.dirname, "..", file), "utf8");
      return /\bago\(/.test(text) === true;
    });
    expect(offenders).toEqual([]);
  });
});
