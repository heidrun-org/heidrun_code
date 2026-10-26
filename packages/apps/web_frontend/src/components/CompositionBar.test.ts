import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";

const { invokeMock } = vi.hoisted(() => ({
	invokeMock: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@tauri-apps/api/core", () => ({
	invoke: (...args: unknown[]) => invokeMock(...args),
}));
const openDialogMock = vi.fn();
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: (...args: unknown[]) => openDialogMock(...args) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}), emit: vi.fn() }));
vi.mock("@tauri-apps/api/path", () => ({}));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ onDragDropEvent: vi.fn(async () => () => {}) }) }));
const insertTextMock = vi.fn();
vi.mock("../stores/session", async (importOriginal) => {
	const original = await importOriginal<typeof import("../stores/session")>();
	return {
		...original,
		insertText: (...args: unknown[]) => insertTextMock(...args),
	};
});

import CompositionBar from "./CompositionBar.vue";
import { ImageDrop } from "../lib/image_drop";
import { DropTarget } from "../lib/drop_target";
import { LONG_PRESS_MILLISECONDS, VoiceInput } from "../lib/voice_input";
import { CompositionBar as CompositionBarStore } from '../stores/composition_bar';
import { settings } from "../stores/settings";
import { LEVEL_COUNT, voiceInput } from "../stores/voice_input";

const compositionBar = CompositionBarStore.forPane('pane-1');

beforeEach(() => {
	invokeMock.mockReset();
	invokeMock.mockResolvedValue("data:image/png;base64,AAAA");
	openDialogMock.mockReset();
	insertTextMock.mockReset();
	insertTextMock.mockResolvedValue(undefined);
	settings.voiceInput = false;
	ImageDrop.close('pane-1');
});

/** Mounts the composition bar for the pane `pane-1`. */
function mountBar() {
	return mount(CompositionBar, { props: { paneId: 'pane-1' }, attachTo: document.body });
}

/** Finds a button of the bar by its label for the screen readers. */
function findButton(wrapper: ReturnType<typeof mountBar>, label: string) {
	return wrapper.find(`button[aria-label="${label}"]`);
}

/** The line of the plus button, the text input, the button Send, and the push-to-talk button. */
function mainRow(wrapper: ReturnType<typeof mountBar>): HTMLElement {
	return findButton(wrapper, "Add images").element.parentElement as HTMLElement;
}

describe("CompositionBar", () => {
	it("carries the identifier of its pane, so that a drop of files on it finds the pane", () => {
		const wrapper = mountBar();
		const originalElementFromPoint = document.elementFromPoint;
		document.elementFromPoint = () => wrapper.find("textarea.text").element;
		expect(wrapper.attributes("data-composition-bar-pane-id")).toBe("pane-1");
		expect(DropTarget.paneIdAt({ x: 5, y: 5 }, 1)).toBe("pane-1");
		document.elementFromPoint = originalElementFromPoint;
		wrapper.unmount();
	});

	it("shows that a drop goes to this composition bar only while its pane is the one under the drag", async () => {
		const wrapper = mountBar();
		expect(wrapper.find(".drop-feedback").exists()).toBe(false);
		DropTarget.state.hoveredPaneId = "pane-2";
		await wrapper.vm.$nextTick();
		expect(wrapper.find(".drop-feedback").exists()).toBe(false);
		DropTarget.state.hoveredPaneId = "pane-1";
		await wrapper.vm.$nextTick();
		expect(wrapper.find(".drop-feedback").exists()).toBe(true);
		expect(wrapper.find(".drop-feedback").text()).toBe("");
		DropTarget.clearHover();
		await wrapper.vm.$nextTick();
		expect(wrapper.find(".drop-feedback").exists()).toBe(false);
		wrapper.unmount();
	});

	it("shows one picture for each image, with no text that counts them", async () => {
		ImageDrop.handleDrop('pane-1', ["/shots/a.png", "/shots/b.png"]);
		const wrapper = mountBar();
		await vi.waitFor(() => expect(wrapper.findAll("img").length).toBe(2));
		expect(wrapper.findAll("figure").length).toBe(2);
		expect(wrapper.text()).not.toContain("images");
		expect(wrapper.find("img").attributes("alt")).toBe("Preview of a.png");
		wrapper.unmount();
	});

	it("has a plus button and a text input, with a label on the input", () => {
		ImageDrop.handleDrop('pane-1', ["/shots/a.png"]);
		const wrapper = mountBar();
		expect(findButton(wrapper, "Add images").exists()).toBe(true);
		expect(wrapper.find("textarea.text").attributes("aria-label")).toBe("Text to send with the images");
		wrapper.unmount();
	});

	it("puts the pictures alone on a line above, and the plus button on the line of the text input", () => {
		ImageDrop.handleDrop('pane-1', ["/shots/a.png", "/shots/b.png"]);
		const wrapper = mountBar();
		const children = [...wrapper.get(".thumbs").element.children];
		expect(children.length).toBe(2);
		expect(children.every((child) => child.tagName === "FIGURE")).toBe(true);
		expect(mainRow(wrapper).contains(wrapper.get("textarea.text").element)).toBe(true);
		expect(mainRow(wrapper).children[0]).toBe(findButton(wrapper, "Add images").element);
		wrapper.unmount();
	});

	it("has one line only when there is no image, and the plus button stays first on its line", async () => {
		ImageDrop.handleDrop('pane-1', ["/shots/a.png"]);
		const wrapper = mountBar();
		expect(wrapper.find(".thumbs").exists()).toBe(true);
		const rowWithImage = mainRow(wrapper);
		await wrapper.find("button.remove").trigger("click");
		expect(wrapper.find(".thumbs").exists()).toBe(false);
		expect(mainRow(wrapper)).toBe(rowWithImage);
		expect(mainRow(wrapper).children[0]).toBe(findButton(wrapper, "Add images").element);
		wrapper.unmount();
	});

	it("draws the buttons of the main line with no border, so that only the icon shows", () => {
		settings.voiceInput = true;
		ImageDrop.handleDrop('pane-1', ["/shots/a.png"]);
		const wrapper = mountBar();
		const buttons = [...mainRow(wrapper).querySelectorAll(":scope > button")];
		expect(buttons.length).toBe(3);
		expect(buttons.every((button) => button.classList.contains("border-0"))).toBe(true);
		expect(mainRow(wrapper).classList.contains("gap-1")).toBe(true);
		wrapper.unmount();
	});

	it("has the icon button Send, with a label and a title that names the key, and no button Close", () => {
		ImageDrop.handleDrop('pane-1', ["/shots/a.png"]);
		const wrapper = mountBar();
		const sendButton = findButton(wrapper, "Send");
		expect(sendButton.text()).toBe("");
		expect(sendButton.attributes("title")).toContain("Enter");
		expect(sendButton.find(".bi-send").exists()).toBe(true);
		const children = [...mainRow(wrapper).children];
		expect(children[children.length - 1]).toBe(sendButton.element);
		expect(findButton(wrapper, "Close").exists()).toBe(false);
		expect(wrapper.find(".bi-trash").exists()).toBe(false);
		wrapper.unmount();
	});

	it("opens the file picker with the plus button and adds the chosen images", async () => {
		ImageDrop.handleDrop('pane-1', ["/shots/a.png"]);
		openDialogMock.mockResolvedValue(["/shots/b.png"]);
		const wrapper = mountBar();
		await findButton(wrapper, "Add images").trigger("click");
		await vi.waitFor(() => expect(compositionBar.paths).toEqual(["/shots/a.png", "/shots/b.png"]));
		wrapper.unmount();
	});

	it("opens the big view on the picture that is clicked", async () => {
		ImageDrop.handleDrop('pane-1', ["/shots/a.png", "/shots/b.png"]);
		const wrapper = mountBar();
		await wrapper.findAll("button.open")[1].trigger("click");
		expect(compositionBar.viewerIndex).toBe(1);
		wrapper.unmount();
	});

	it("removes one image with its small button, and stays open when the last image goes", async () => {
		ImageDrop.handleDrop('pane-1', ["/shots/a.png", "/shots/b.png"]);
		const wrapper = mountBar();
		await wrapper.find("button.remove").trigger("click");
		expect(compositionBar.paths).toEqual(["/shots/b.png"]);
		await wrapper.find("button.remove").trigger("click");
		expect(compositionBar.paths).toEqual([]);
		expect(compositionBar.isOpen).toBe(true);
		wrapper.unmount();
	});

	it("closes and empties everything with the key Escape", async () => {
		ImageDrop.handleDrop('pane-1', ["/shots/a.png"]);
		compositionBar.text = "hello";
		const wrapper = mountBar();
		await wrapper.find("textarea.text").trigger("keydown", { key: "Escape" });
		expect(compositionBar.paths).toEqual([]);
		expect(compositionBar.text).toBe("");
		expect(compositionBar.isOpen).toBe(false);
		wrapper.unmount();
	});

	it("gives the keyboard to the text input, so that the developer types, then presses Enter", async () => {
		ImageDrop.handleDrop('pane-1', ["/shots/a.png"]);
		const wrapper = mountBar();
		await vi.waitFor(() => expect(document.activeElement).toBe(wrapper.find("textarea.text").element));
		wrapper.unmount();
	});

	it("pastes the images with the button Send, stays open, and says that it sent, with no text written", async () => {
		const writer = vi.fn().mockResolvedValue(undefined);
		ImageDrop.register('pane-1', writer);
		ImageDrop.handleDrop('pane-1', ["/shots/a.png"]);
		const wrapper = mountBar();
		await findButton(wrapper, "Send").trigger("click");
		await vi.waitFor(() => expect(wrapper.emitted("sent")).toHaveLength(1));
		expect(invokeMock).toHaveBeenCalledWith("clipboard_set_image", { path: "/shots/a.png" });
		expect(writer).toHaveBeenCalledWith("\x16");
		expect(insertTextMock).not.toHaveBeenCalled();
		expect(compositionBar.paths).toEqual([]);
		expect(compositionBar.isOpen).toBe(true);
		ImageDrop.unregister('pane-1');
		wrapper.unmount();
	});

	it("stays open after a send, with an empty text input, and sends a second message", async () => {
		ImageDrop.register('pane-1', vi.fn().mockResolvedValue(undefined));
		compositionBar.isOpen = true;
		const wrapper = mountBar();
		await wrapper.find("textarea.text").setValue("first");
		await wrapper.find("textarea.text").trigger("keydown", { key: "Enter" });
		await vi.waitFor(() => expect(wrapper.emitted("sent")).toHaveLength(1));
		expect(compositionBar.isOpen).toBe(true);
		expect(compositionBar.text).toBe("");
		expect(wrapper.find("textarea.text").exists()).toBe(true);
		await wrapper.find("textarea.text").setValue("second");
		await wrapper.find("textarea.text").trigger("keydown", { key: "Enter" });
		await vi.waitFor(() => expect(wrapper.emitted("sent")).toHaveLength(2));
		expect(insertTextMock).toHaveBeenNthCalledWith(1, 'pane-1', "first", true);
		expect(insertTextMock).toHaveBeenNthCalledWith(2, 'pane-1', "second", true);
		expect(compositionBar.isOpen).toBe(true);
		ImageDrop.unregister('pane-1');
		wrapper.unmount();
	});

	it("sends with the key Enter in the text input, and writes the text with Enter after the images", async () => {
		vi.useFakeTimers();
		const writer = vi.fn().mockResolvedValue(undefined);
		ImageDrop.register('pane-1', writer);
		ImageDrop.handleDrop('pane-1', ["/shots/a.png"]);
		const wrapper = mountBar();
		await wrapper.find("textarea.text").setValue("  what is wrong here?  ");
		await wrapper.find("textarea.text").trigger("keydown", { key: "Enter" });
		await vi.advanceTimersByTimeAsync(600);
		expect(writer).toHaveBeenCalledWith("\x16");
		expect(insertTextMock).toHaveBeenCalledWith('pane-1', "what is wrong here?", true);
		expect(wrapper.emitted("sent")).toHaveLength(1);
		expect(compositionBar.text).toBe("");
		expect(compositionBar.isOpen).toBe(true);
		vi.useRealTimers();
		ImageDrop.unregister('pane-1');
		wrapper.unmount();
	});

	it("does not send with Shift+Enter, so that the text can have several lines", async () => {
		ImageDrop.handleDrop('pane-1', ["/shots/a.png"]);
		const wrapper = mountBar();
		await wrapper.find("textarea.text").setValue("first line\nsecond line");
		await wrapper.find("textarea.text").trigger("keydown", { key: "Enter", shiftKey: true });
		expect(wrapper.emitted("sent")).toBeUndefined();
		expect(compositionBar.isOpen).toBe(true);
		expect(compositionBar.text).toBe("first line\nsecond line");
		wrapper.unmount();
	});

	it("sends a text of several lines whole, with its line breaks", async () => {
		vi.useFakeTimers();
		const writer = vi.fn().mockResolvedValue(undefined);
		ImageDrop.register('pane-1', writer);
		ImageDrop.handleDrop('pane-1', ["/shots/a.png"]);
		const wrapper = mountBar();
		await wrapper.find("textarea.text").setValue("first line\n\nsecond line");
		await wrapper.find("textarea.text").trigger("keydown", { key: "Enter" });
		await vi.advanceTimersByTimeAsync(600);
		expect(insertTextMock).toHaveBeenCalledWith('pane-1', "first line\n\nsecond line", true);
		vi.useRealTimers();
		ImageDrop.unregister('pane-1');
		wrapper.unmount();
	});

	it("keeps the images that were not pasted, and the text, when a paste fails", async () => {
		const writer = vi.fn().mockResolvedValue(undefined);
		ImageDrop.register('pane-1', writer);
		ImageDrop.handleDrop('pane-1', ["/shots/a.png"]);
		compositionBar.text = "keep me";
		const wrapper = mountBar();
		invokeMock.mockReset();
		invokeMock.mockRejectedValue("boom");
		await findButton(wrapper, "Send").trigger("click");
		await vi.waitFor(() => expect(invokeMock).toHaveBeenCalled());
		expect(wrapper.emitted("sent")).toBeUndefined();
		expect(insertTextMock).not.toHaveBeenCalled();
		expect(compositionBar.paths).toEqual(["/shots/a.png"]);
		expect(compositionBar.text).toBe("keep me");
		expect(compositionBar.isOpen).toBe(true);
		ImageDrop.unregister('pane-1');
		wrapper.unmount();
	});
});

describe("CompositionBar voice input (issue 662)", () => {
	beforeEach(() => {
		settings.voiceInput = false;
		settings.voiceInputModel = "base";
		voiceInput.options = {
			models: [{ id: "base", sizeBytes: 147_951_465, isEnglishOnly: false, isDownloaded: true }],
			languages: ["en"],
			defaultModelId: "base",
		};
		voiceInput.ownerPaneId = 'pane-1';
		voiceInput.state = "idle";
		voiceInput.isLatched = false;
		voiceInput.levels = [];
		voiceInput.errors = {};
		voiceInput.transcriptions = [];
		compositionBar.text = "";
		vi.useFakeTimers({ toFake: ["Date"] });
	});

	afterEach(async () => {
		await VoiceInput.cancel();
		vi.useRealTimers();
	});

	it("shows no push-to-talk button when the voice input is off", () => {
		ImageDrop.handleDrop('pane-1', ["/shots/a.png"]);
		const wrapper = mountBar();
		expect(wrapper.find(".push-to-talk").exists()).toBe(false);
		wrapper.unmount();
	});

	it("shows the push-to-talk button after the button Send, at the right end, when the voice input is on", () => {
		settings.voiceInput = true;
		ImageDrop.handleDrop('pane-1', ["/shots/a.png"]);
		const wrapper = mountBar();
		const children = [...mainRow(wrapper).children];
		expect(children.map((child) => child.tagName)).toEqual(["BUTTON", "DIV", "BUTTON", "BUTTON"]);
		expect(children[0]).toBe(findButton(wrapper, "Add images").element);
		expect(children[1].contains(wrapper.get("textarea.text").element)).toBe(true);
		expect(children[2]).toBe(findButton(wrapper, "Send").element);
		expect(children[3].classList.contains("push-to-talk")).toBe(true);
		wrapper.unmount();
	});

	it("writes the spoken text in the text input", async () => {
		voiceInput.ownerPaneId = null;
		settings.voiceInput = true;
		ImageDrop.handleDrop('pane-1', ["/shots/a.png"]);
		const wrapper = mountBar();
		invokeMock.mockImplementation(async (name: string) => {
			if (name === "voice_stop_recording") {
				return 1;
			}
			return name === "voice_transcribe_recording" ? "Run the tests again." : undefined;
		});
		await wrapper.get(".push-to-talk").trigger("pointerdown", { button: 0 });
		await vi.waitFor(() => expect(voiceInput.state).toBe("recording"));
		expect(wrapper.get(".push-to-talk").classes()).toContain("is-recording");
		expect(wrapper.find(".voice-level").exists()).toBe(true);
		vi.setSystemTime(Date.now() + LONG_PRESS_MILLISECONDS + 100);
		window.dispatchEvent(new Event("pointerup"));
		await vi.waitFor(() => expect((wrapper.get("textarea.text").element as HTMLTextAreaElement).value).toBe("Run the tests again."));
		expect(insertTextMock).not.toHaveBeenCalled();
		expect(compositionBar.isOpen).toBe(true);
		wrapper.unmount();
	});

	it("keeps the level bars during transcription and hides them when idle", async () => {
		settings.voiceInput = true;
		ImageDrop.handleDrop('pane-1', ["/shots/a.png"]);
		const wrapper = mountBar();
		const placeholder = () => wrapper.get("textarea.text").attributes("placeholder");
		expect(wrapper.find(".voice-level").exists()).toBe(false);
		voiceInput.state = "recording";
		voiceInput.levels = [0, 0.5, 1];
		await wrapper.vm.$nextTick();
		expect(wrapper.find(".voice-level").exists()).toBe(true);
		expect(wrapper.findAll(".voice-level .bar").length).toBe(LEVEL_COUNT);
		expect(placeholder()).toBe("Listening…");
		const field = wrapper.get("textarea.text").element.parentElement as HTMLElement;
		expect([...field.children].map((child) => child.tagName)).toEqual(["TEXTAREA", "DIV"]);
		expect(field.querySelector(".voice-level")).not.toBeNull();
		expect(wrapper.get(".voice-level").classes()).not.toContain("is-transcribing");
		voiceInput.state = "idle";
		voiceInput.transcriptions = [{ id: 1, paneId: "pane-1", recordingId: 1, state: "waiting", recordingSeconds: 3 }];
		await wrapper.vm.$nextTick();
		expect(wrapper.get(".voice-level").classes()).toContain("is-waiting");
		expect(wrapper.get(".voice-level").classes()).not.toContain("is-transcribing");
		expect(wrapper.findAll(".voice-level .bar").every((bar) => (bar.element as HTMLElement).style.height === "4px")).toBe(true);
		expect(placeholder()).toBe("Waiting for Whisper…");
		voiceInput.transcriptions[0].state = "transcribing";
		await wrapper.vm.$nextTick();
		expect(wrapper.find(".voice-level").exists()).toBe(true);
		expect(wrapper.get(".voice-level").classes()).toContain("is-transcribing");
		expect(wrapper.get(".voice-level").classes()).not.toContain("is-waiting");
		expect(wrapper.findAll(".voice-level .bar").every((bar) => (bar.element as HTMLElement).style.height === "4px")).toBe(true);
		expect(findButton(wrapper, 'Cancel voice input').exists()).toBe(true);
		expect(placeholder()).toBe("Changing the speech into text…");
		voiceInput.transcriptions = [];
		await wrapper.vm.$nextTick();
		expect(placeholder()).toBe("Type a question, or press Enter to paste the images");
		wrapper.unmount();
	});

	it("shows the time since the recording started, as minutes and seconds", async () => {
		settings.voiceInput = true;
		ImageDrop.handleDrop('pane-1', ["/shots/a.png"]);
		const wrapper = mountBar();
		expect(wrapper.find(".elapsed").exists()).toBe(false);
		voiceInput.startedAt = Date.now() - 67_000;
		voiceInput.state = "recording";
		await wrapper.vm.$nextTick();
		expect(wrapper.get(".elapsed").text()).toBe("1:07");
		voiceInput.startedAt = Date.now() - 7_000;
		voiceInput.state = "idle";
		await wrapper.vm.$nextTick();
		voiceInput.state = "recording";
		await wrapper.vm.$nextTick();
		expect(wrapper.get(".elapsed").text()).toBe("0:07");
		voiceInput.state = "idle";
		voiceInput.transcriptions = [{ id: 1, paneId: "pane-1", recordingId: 1, state: "waiting", recordingSeconds: 75 }];
		await wrapper.vm.$nextTick();
		expect(wrapper.get(".elapsed").text()).toBe("1:15");
		voiceInput.transcriptions = [];
		wrapper.unmount();
	});

	it("marks the field while it listens, so that the text keeps clear of the level bars", async () => {
		settings.voiceInput = true;
		const wrapper = mountBar();
		expect(wrapper.get(".field").classes()).not.toContain("is-listening");
		voiceInput.state = "recording";
		await wrapper.vm.$nextTick();
		expect(wrapper.get(".field").classes()).toContain("is-listening");
		voiceInput.state = "idle";
		await wrapper.vm.$nextTick();
		expect(wrapper.get(".field").classes()).not.toContain("is-listening");
		wrapper.unmount();
	});

	describe("with a recording that runs", () => {
		/** The commands that the web page sent to the desktop application, in order. */
		function commandNames(): string[] {
			return invokeMock.mock.calls.map((call) => call[0] as string);
		}

		/** Starts a recording with a click on the push-to-talk button, then lets it be kept by the click. */
		async function startKeptRecording(wrapper: ReturnType<typeof mountBar>) {
			await wrapper.get(".push-to-talk").trigger("pointerdown", { button: 0 });
			await vi.waitFor(() => expect(voiceInput.state).toBe("recording"));
			window.dispatchEvent(new Event("pointerup"));
			await vi.waitFor(() => expect(voiceInput.isLatched).toBe(true));
		}

		it("stops the recording, writes the speech, and sends the images and the whole text with the button Send", async () => {
			settings.voiceInput = true;
			const writer = vi.fn().mockResolvedValue(undefined);
			ImageDrop.register('pane-1', writer);
			ImageDrop.handleDrop('pane-1', ["/shots/a.png"]);
			compositionBar.text = "Please";
			invokeMock.mockImplementation(async (name: string) => {
				if (name === "voice_stop_recording") {
					return 1;
				}
				if (name === "voice_transcribe_recording") {
					return "run the tests";
				}
				return name === "voice_start_recording" ? undefined : "data:image/png;base64,AAAA";
			});
			const wrapper = mountBar();
			await startKeptRecording(wrapper);
			await findButton(wrapper, "Send").trigger("click");
			await vi.waitFor(() => expect(wrapper.emitted("sent")).toHaveLength(1), { timeout: 3000 });
			const names = commandNames();
			expect(names.indexOf("voice_stop_recording")).toBeGreaterThan(names.indexOf("voice_start_recording"));
			expect(names.indexOf("voice_transcribe_recording")).toBeGreaterThan(names.indexOf("voice_stop_recording"));
			expect(names.indexOf("clipboard_set_image")).toBeGreaterThan(names.indexOf("voice_transcribe_recording"));
			expect(insertTextMock).toHaveBeenCalledWith('pane-1', "Please run the tests", true);
			expect(voiceInput.state).toBe("idle");
			ImageDrop.unregister('pane-1');
			wrapper.unmount();
		});

		it("does the same with the key Enter in the text input", async () => {
			settings.voiceInput = true;
			const writer = vi.fn().mockResolvedValue(undefined);
			ImageDrop.register('pane-1', writer);
			ImageDrop.handleDrop('pane-1', ["/shots/a.png"]);
			invokeMock.mockImplementation(async (name: string) => {
				if (name === "voice_stop_recording") {
					return 1;
				}
				if (name === "voice_transcribe_recording") {
					return "spoken";
				}
				return name === "voice_start_recording" ? undefined : "data:image/png;base64,AAAA";
			});
			const wrapper = mountBar();
			await startKeptRecording(wrapper);
			await wrapper.find("textarea.text").trigger("keydown", { key: "Enter" });
			await vi.waitFor(() => expect(wrapper.emitted("sent")).toHaveLength(1), { timeout: 3000 });
			expect(insertTextMock).toHaveBeenCalledWith('pane-1', "spoken", true);
			ImageDrop.unregister('pane-1');
			wrapper.unmount();
		});

		it("sends nothing and stays open when the speech cannot change into text, so that the error shows", async () => {
			settings.voiceInput = true;
			const writer = vi.fn().mockResolvedValue(undefined);
			ImageDrop.register('pane-1', writer);
			ImageDrop.handleDrop('pane-1', ["/shots/a.png"]);
			invokeMock.mockImplementation(async (name: string) => {
				if (name === "voice_stop_recording") {
					throw "no_signal";
				}
				return name === "voice_start_recording" ? undefined : "data:image/png;base64,AAAA";
			});
			const wrapper = mountBar();
			await startKeptRecording(wrapper);
			await findButton(wrapper, "Send").trigger("click");
			await vi.waitFor(() => expect(VoiceInput.errorOf("pane-1")).toBe("no_signal"));
			expect(wrapper.emitted("sent")).toBeUndefined();
			expect(writer).not.toHaveBeenCalled();
			expect(insertTextMock).not.toHaveBeenCalled();
			expect(compositionBar.isOpen).toBe(true);
			expect(compositionBar.paths).toEqual(["/shots/a.png"]);
			await vi.waitFor(() => expect(findButton(wrapper, "Send").attributes("disabled")).toBeUndefined());
			ImageDrop.unregister('pane-1');
			wrapper.unmount();
		});

		it("throws away the recording with the key Escape, and sends nothing", async () => {
			settings.voiceInput = true;
			ImageDrop.handleDrop('pane-1', ["/shots/a.png"]);
			invokeMock.mockImplementation(async (name: string) => (name === "voice_start_recording" ? undefined : "data:image/png;base64,AAAA"));
			const wrapper = mountBar();
			await startKeptRecording(wrapper);
			await wrapper.find("textarea.text").trigger("keydown", { key: "Escape" });
			await vi.waitFor(() => expect(commandNames()).toContain("voice_cancel_recording"));
			expect(commandNames()).not.toContain("voice_stop_recording");
			expect(voiceInput.state).toBe("idle");
			expect(compositionBar.isOpen).toBe(false);
			expect(insertTextMock).not.toHaveBeenCalled();
			wrapper.unmount();
		});
	});

	it("shows no level bars when the voice input is off", async () => {
		ImageDrop.handleDrop('pane-1', ["/shots/a.png"]);
		const wrapper = mountBar();
		voiceInput.state = "recording";
		await wrapper.vm.$nextTick();
		expect(wrapper.find(".voice-level").exists()).toBe(false);
		voiceInput.state = "idle";
		wrapper.unmount();
	});

	it("shows a text under the text input when macOS refuses the microphone", async () => {
		settings.voiceInput = true;
		ImageDrop.handleDrop('pane-1', ["/shots/a.png"]);
		const wrapper = mountBar();
		voiceInput.errors["pane-1"] = "microphone_denied";
		await wrapper.vm.$nextTick();
		expect(wrapper.get("[role=alert]").text()).toContain("System Settings, Privacy & Security, Microphone");
		wrapper.unmount();
	});

	it("shows the general text for an error without a text of its own, and no text without an error", async () => {
		settings.voiceInput = true;
		ImageDrop.handleDrop('pane-1', ["/shots/a.png"]);
		const wrapper = mountBar();
		expect(wrapper.find("[role=alert]").exists()).toBe(false);
		voiceInput.errors["pane-1"] = "transcription_failed";
		await wrapper.vm.$nextTick();
		expect(wrapper.get("[role=alert]").text()).toBe("The voice input failed. Press the button again.");
		wrapper.unmount();
		expect(VoiceInput.errorOf("pane-1")).toBeNull();
	});

	it("shows the error of its own pane only", async () => {
		settings.voiceInput = true;
		const wrapper = mountBar();
		voiceInput.errors["pane-2"] = "microphone_denied";
		await wrapper.vm.$nextTick();
		expect(wrapper.find("[role=alert]").exists()).toBe(false);
		wrapper.unmount();
	});
});


describe('composition bar cancellation (issue 736)', () => {
	it.each([
		{ phase: 'recording', command: 'voice_cancel_recording' },
		{ phase: 'waiting', command: 'voice_discard_recording' },
		{ phase: 'transcribing', command: null },
	] as const)('cancels $phase and preserves the draft and images', async ({ phase, command }) => {
		settings.voiceInput = true;
		if (phase === 'recording') {
			voiceInput.ownerPaneId = 'pane-1';
			voiceInput.state = 'recording';
		} else {
			voiceInput.ownerPaneId = null;
			voiceInput.state = 'idle';
			voiceInput.transcriptions = [{ id: 1, paneId: 'pane-1', recordingId: 4, state: phase, recordingSeconds: 2 }];
		}
		ImageDrop.handleDrop('pane-1', ['/shots/a.png']);
		compositionBar.text = 'Keep this draft';
		const wrapper = mountBar();
		const cancelButton = findButton(wrapper, 'Cancel voice input');
		expect(cancelButton.attributes('title')).toBe('Cancel voice input');
		expect(cancelButton.find('.bi-x-lg').exists()).toBe(true);
		expect(cancelButton.element.nextElementSibling).toBe(wrapper.get('.voice-level').element);
		await cancelButton.trigger('pointerdown');
		window.dispatchEvent(new Event('pointerup'));
		await cancelButton.trigger('click');
		await vi.waitFor(() => expect(VoiceInput.paneState('pane-1')).toBe('idle'));
		if (command === 'voice_cancel_recording') {
			await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledWith('voice_cancel_recording'));
		} else if (command === 'voice_discard_recording') {
			await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledWith('voice_discard_recording', { recordingId: 4 }));
		}
		const voiceCommands = invokeMock.mock.calls.map((call) => call[0] as string).filter((name) => name.startsWith('voice_'));
		expect(voiceCommands).toEqual(command === null ? [] : [command]);
		expect(compositionBar.text).toBe('Keep this draft');
		expect(compositionBar.paths).toEqual(['/shots/a.png']);
		expect(compositionBar.isOpen).toBe(true);
		expect(voiceInput.transcriptions).toEqual([]);
		await wrapper.vm.$nextTick();
		expect(wrapper.find('.voice-level').exists()).toBe(false);
		expect(insertTextMock).not.toHaveBeenCalled();
		wrapper.unmount();
	});

	it('cancels Send while transcription is pending and ignores its late text', async () => {
		settings.voiceInput = true;
		voiceInput.options = {
			models: [{
				id: 'base',
				sizeBytes: 147_951_465,
				isEnglishOnly: false,
				isDownloaded: true,
			}],
			languages: ['en'],
			defaultModelId: 'base',
		};
		voiceInput.state = 'idle';
		let finishFn: (text: string) => void = () => {};
		invokeMock.mockImplementation((name: string) => {
			if (name === 'voice_stop_recording') {
				return Promise.resolve(1);
			}
			if (name === 'voice_transcribe_recording') {
				return new Promise<string>((resolve) => {
					finishFn = resolve;
				});
			}
			return Promise.resolve('data:image/png;base64,AAAA');
		});
		ImageDrop.register('pane-1', vi.fn().mockResolvedValue(undefined));
		ImageDrop.handleDrop('pane-1', ['/shots/a.png']);
		compositionBar.text = 'Keep this draft';
		const wrapper = mountBar();
		await VoiceInput.press('pane-1');
		await findButton(wrapper, 'Send').trigger('click');
		await vi.waitFor(() => expect(VoiceInput.paneState('pane-1')).toBe('transcribing'));
		await findButton(wrapper, 'Cancel voice input').trigger('click');
		await vi.waitFor(() => expect(findButton(wrapper, 'Send').attributes('disabled')).toBeUndefined());
		finishFn('Discard these words');
		await Promise.resolve();
		await wrapper.vm.$nextTick();
		expect(wrapper.emitted('sent')).toBeUndefined();
		expect(insertTextMock).not.toHaveBeenCalled();
		expect(compositionBar.text).toBe('Keep this draft');
		expect(compositionBar.paths).toEqual(['/shots/a.png']);
		ImageDrop.unregister('pane-1');
		wrapper.unmount();
	});

	it('does not show the cancel button in another pane', () => {
		settings.voiceInput = true;
		voiceInput.transcriptions = [{ id: 1, paneId: 'pane-2', recordingId: 1, state: 'transcribing', recordingSeconds: 2 }];
		const wrapper = mountBar();
		expect(findButton(wrapper, 'Cancel voice input').exists()).toBe(false);
		voiceInput.transcriptions = [];
		wrapper.unmount();
	});
});
