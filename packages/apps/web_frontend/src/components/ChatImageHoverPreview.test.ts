import { afterEach, describe, expect, it } from "vitest";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { nextTick } from "vue";
import ChatImageHoverPreview from "./ChatImageHoverPreview.vue";
import { ChatImageHover } from "../stores/chat_image_hover";

// Tests of the image shown above the pointer over a text [Image #N] of a terminal (issue #924).

enableAutoUnmount(afterEach);
afterEach(() => ChatImageHover.hide());

const IMAGE = { key: 0, number: 1, message: 2, source: "data:image/png;base64,AAAA" };

describe("ChatImageHoverPreview", () => {
  it("shows nothing while the pointer is over no text [Image #N]", () => {
    mount(ChatImageHoverPreview, { attachTo: document.body });
    expect(document.body.querySelector(".chat-image-hover")).toBeNull();
  });

  it("shows the image and its name above the pointer, and hides it", async () => {
    mount(ChatImageHoverPreview, { attachTo: document.body });
    ChatImageHover.show(IMAGE, 500, 600);
    await nextTick();
    const figure = document.body.querySelector<HTMLElement>(".chat-image-hover");
    expect(figure?.querySelector("img")?.getAttribute("src")).toBe(IMAGE.source);
    expect(figure?.querySelector("figcaption")?.textContent).toBe("Message 2 · [Image #1]");
    expect(figure?.style.transform).toContain("-100%");
    ChatImageHover.hide();
    await nextTick();
    expect(document.body.querySelector(".chat-image-hover")).toBeNull();
  });

  it("shows the image below the pointer near the top of the window", async () => {
    mount(ChatImageHoverPreview, { attachTo: document.body });
    ChatImageHover.show(IMAGE, 500, 40);
    await nextTick();
    expect(document.body.querySelector<HTMLElement>(".chat-image-hover")?.style.transform).toContain("20px");
  });
});
