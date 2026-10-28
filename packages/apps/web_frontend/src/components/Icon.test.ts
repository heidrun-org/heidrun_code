import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import Icon from "./Icon.vue";

describe("Icon", () => {
  it("renders the Bootstrap Icons class of the name", () => {
    const wrapper = mount(Icon, { props: { name: "moon-stars" } });
    expect(wrapper.classes()).toEqual(["bi", "bi-moon-stars"]);
  });

  it("draws the goat of Heidrun Code as a vector image that takes the color and the size of the text", () => {
    const wrapper = mount(Icon, { props: { name: "heidrun-goat-only" } });
    expect(wrapper.element.tagName.toLowerCase()).toBe("svg");
    expect(wrapper.classes()).toEqual(["bi", "bi-heidrun-goat-only"]);
    expect(wrapper.attributes("fill")).toBe("currentColor");
    expect(wrapper.attributes("width")).toBe("1em");
    expect(wrapper.attributes("height")).toBe("1em");
    expect(wrapper.attributes("viewBox")).toBe("0 0 16 16");
    expect(wrapper.attributes("aria-hidden")).toBe("true");
    expect(wrapper.findAll("path")).toHaveLength(4);
  });

  it("is hidden from screen readers", () => {
    expect(mount(Icon, { props: { name: "x" } }).attributes("aria-hidden")).toBe("true");
  });
});
