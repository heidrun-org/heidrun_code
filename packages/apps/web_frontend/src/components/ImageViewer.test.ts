import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";

const { invokeMock } = vi.hoisted(() => ({
	invokeMock: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@tauri-apps/api/core", () => ({
	invoke: (...args: unknown[]) => invokeMock(...args),
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));

import ImageViewer from "./ImageViewer.vue";
import { ImageDrop } from "../lib/image_drop";
import { CompositionBar as CompositionBarStore } from '../stores/composition_bar';

const compositionBar = CompositionBarStore.forPane('pane-1');

beforeEach(() => {
	invokeMock.mockReset();
	invokeMock.mockImplementation(async (_command: string, args: { path: string }) => `data:big-${args.path}`);
	ImageDrop.close('pane-1');
});

/** Mounts the big view on the image at `path`, after the drop of three images. */
function mountViewerOn(path: string) {
	ImageDrop.handleDrop('pane-1', ["/shots/a.png", "/shots/b.png", "/shots/c.png"]);
	ImageDrop.openViewer('pane-1', path);
	return mount(ImageViewer, { props: { paneId: 'pane-1' }, attachTo: document.body });
}

/** Presses a key on the window, as the keyboard does. */
function pressKey(key: string) {
	window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
}

describe("ImageViewer", () => {
	it("shows the large picture of the clicked image, with its name and its position", async () => {
		const wrapper = mountViewerOn("/shots/b.png");
		await vi.waitFor(() => expect(wrapper.find("img").attributes("src")).toBe("data:big-/shots/b.png"));
		expect(invokeMock).toHaveBeenCalledWith("image_preview", { path: "/shots/b.png", longestSide: 1600 });
		const caption = wrapper.get('figcaption.badge.image-viewer-caption');
		expect(caption.get('.name').text()).toBe('b.png');
		expect(caption.get('.position').text()).toBe('2 of 3');
		wrapper.unmount();
	});

	it("shows the small picture while the large picture is made", async () => {
		compositionBar.thumbnails["/shots/a.png"] = "data:small-a";
		invokeMock.mockImplementation(() => new Promise(() => {}));
		const wrapper = mountViewerOn("/shots/a.png");
		await nextTick();
		expect(wrapper.find("img").attributes("src")).toBe("data:small-a");
		wrapper.unmount();
	});

	it("goes to the next image with the right arrow key and the previous image with the left arrow key", async () => {
		const wrapper = mountViewerOn("/shots/a.png");
		pressKey("ArrowRight");
		expect(compositionBar.viewerIndex).toBe(1);
		pressKey("ArrowLeft");
		pressKey("ArrowLeft");
		expect(compositionBar.viewerIndex).toBe(2);
		wrapper.unmount();
	});

	it("goes to the next image and the previous image with its two buttons", async () => {
		const wrapper = mountViewerOn("/shots/a.png");
		await wrapper.find("button.next").trigger("click");
		expect(compositionBar.viewerIndex).toBe(1);
		await wrapper.find("button.previous").trigger("click");
		expect(compositionBar.viewerIndex).toBe(0);
		wrapper.unmount();
	});

	it("closes with the key Escape, the close button, and a click beside the picture", async () => {
		const first = mountViewerOn("/shots/a.png");
		pressKey("Escape");
		expect(compositionBar.viewerIndex).toBeNull();
		first.unmount();
		const second = mountViewerOn("/shots/a.png");
		await second.find("button.close").trigger("click");
		expect(compositionBar.viewerIndex).toBeNull();
		second.unmount();
		const third = mountViewerOn("/shots/a.png");
		await third.find(".overlay").trigger("mousedown");
		expect(compositionBar.viewerIndex).toBeNull();
		third.unmount();
	});

	it("shows no arrow when there is one image", () => {
		ImageDrop.handleDrop('pane-1', ["/shots/only.png"]);
		ImageDrop.openViewer('pane-1', "/shots/only.png");
		const wrapper = mount(ImageViewer, { props: { paneId: 'pane-1' }, attachTo: document.body });
		expect(wrapper.find("button.next").exists()).toBe(false);
		expect(wrapper.find("button.previous").exists()).toBe(false);
		wrapper.unmount();
	});

	it("says that the image cannot be shown when its picture fails", async () => {
		invokeMock.mockRejectedValue("conversion_failed");
		const wrapper = mountViewerOn("/shots/a.png");
		await vi.waitFor(() => expect(wrapper.text()).toContain("This image cannot be shown"));
		wrapper.unmount();
	});

	it("stops listening to the keys when it is closed", () => {
		const wrapper = mountViewerOn("/shots/a.png");
		wrapper.unmount();
		pressKey("ArrowRight");
		expect(compositionBar.viewerIndex).toBe(0);
	});
});
