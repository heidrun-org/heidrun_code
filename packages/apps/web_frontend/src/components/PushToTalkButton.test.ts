import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";

const { invokeMock } = vi.hoisted(() => ({
	invokeMock: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@tauri-apps/api/core", () => ({
	invoke: (...args: unknown[]) => invokeMock(...args),
}));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));

import PushToTalkButton from "./PushToTalkButton.vue";
import { LONG_PRESS_MILLISECONDS, VoiceInput } from "../lib/voice_input";
import { CompositionBar as CompositionBarStore } from '../stores/composition_bar';
import { settings } from "../stores/settings";
import { state } from '../stores/session';
import { voiceInput } from "../stores/voice_input";

/** Lets the time pass for the code that measures the length of a press, without any real waiting. */
function passTime(milliseconds: number): void {
	vi.setSystemTime(Date.now() + milliseconds);
}

const compositionBar = CompositionBarStore.forPane('pane-1');

beforeEach(() => {
	vi.useFakeTimers({ toFake: ["Date"] });
	invokeMock.mockReset();
	invokeMock.mockImplementation(async (name: string) => {
		if (name === "voice_stop_recording") {
			return 1;
		}
		return name === "voice_transcribe_recording" ? "Hello" : undefined;
	});
	settings.voiceInput = true;
	settings.voiceInputModel = "base";
	settings.voiceInputLanguage = "auto";
	voiceInput.options = {
		models: [
			{ id: "tiny", sizeBytes: 77_691_713, isEnglishOnly: false, isDownloaded: false },
			{ id: "base", sizeBytes: 147_951_465, isEnglishOnly: false, isDownloaded: true },
		],
		languages: ["en"],
		defaultModelId: "base",
	};
	voiceInput.ownerPaneId = null;
	voiceInput.state = "idle";
	voiceInput.isLatched = false;
	voiceInput.levels = [];
	voiceInput.errors = {};
	voiceInput.transcriptions = [];
	state.toast = '';
	compositionBar.isOpen = true;
	compositionBar.text = "";
});

afterEach(async () => {
	await VoiceInput.cancel();
	vi.useRealTimers();
});

describe("PushToTalkButton", () => {
	it("has a name for the screen reader and a title that tells to hold the button or to click it", () => {
		const wrapper = mount(PushToTalkButton, { props: { paneId: 'pane-1' } });
		expect(wrapper.attributes("aria-label")).toBe("Push to talk");
		expect(wrapper.attributes("title")).toBe(
			"Hold to speak, and release to write the text. Or click to start, and click again to write the text.",
		);
		expect(wrapper.attributes("aria-pressed")).toBe("false");
		expect(wrapper.find(".bi-mic").exists()).toBe(true);
		wrapper.unmount();
	});

	it("is red only while the microphone is open", () => {
		voiceInput.ownerPaneId = 'pane-1';
		const wrapper = mount(PushToTalkButton, { props: { paneId: 'pane-1' } });
		expect(wrapper.classes()).not.toContain("is-recording");
		voiceInput.state = "recording";
		return wrapper.vm.$nextTick().then(() => {
			expect(wrapper.classes()).toContain("is-recording");
			voiceInput.state = "idle";
			wrapper.unmount();
		});
	});

	it("is a Bootstrap button with no border, and not a small tool button of the header of a pane", () => {
		const wrapper = mount(PushToTalkButton, { props: { paneId: 'pane-1' } });
		expect(wrapper.classes()).toContain("btn");
		expect(wrapper.classes()).toContain("border-0");
		expect(wrapper.classes()).not.toContain("tool");
		wrapper.unmount();
	});

	it("records while the pointer is down for a long press, and writes the text when the pointer is released", async () => {
		const wrapper = mount(PushToTalkButton, { props: { paneId: 'pane-1' }, attachTo: document.body });
		await wrapper.trigger("pointerdown", { button: 0 });
		await vi.waitFor(() => expect(voiceInput.state).toBe("recording"));
		await wrapper.vm.$nextTick();
		expect(wrapper.attributes("aria-pressed")).toBe("true");
		expect(wrapper.find(".bi-mic-fill").exists()).toBe(true);
		expect(wrapper.classes()).toContain("is-recording");
		expect(wrapper.attributes("title")).toBe("Listening… release the button to write the text");
		passTime(LONG_PRESS_MILLISECONDS + 100);
		window.dispatchEvent(new Event("pointerup"));
		await vi.waitFor(() => expect(compositionBar.text).toBe("Hello"));
		expect(invokeMock.mock.calls.map((call) => call[0])).toEqual(["voice_start_recording", "voice_stop_recording", "voice_transcribe_recording"]);
		wrapper.unmount();
	});

	it("keeps recording after a click, shows a stop icon, and writes the text at the next click", async () => {
		const wrapper = mount(PushToTalkButton, { props: { paneId: 'pane-1' }, attachTo: document.body });
		await wrapper.trigger("pointerdown", { button: 0 });
		await vi.waitFor(() => expect(voiceInput.state).toBe("recording"));
		window.dispatchEvent(new Event("pointerup"));
		await vi.waitFor(() => expect(voiceInput.isLatched).toBe(true));
		await wrapper.vm.$nextTick();
		expect(wrapper.attributes("aria-pressed")).toBe("true");
		expect(wrapper.find(".bi-stop-fill").exists()).toBe(true);
		expect(wrapper.classes()).toContain("is-recording");
		expect(wrapper.attributes("title")).toBe("Listening… click the button again to write the text");
		window.dispatchEvent(new Event("blur"));
		expect(voiceInput.state).toBe("recording");
		await wrapper.trigger("pointerdown", { button: 0 });
		await vi.waitFor(() => expect(compositionBar.text).toBe("Hello"));
		expect(invokeMock.mock.calls.map((call) => call[0])).toEqual(["voice_start_recording", "voice_stop_recording", "voice_transcribe_recording"]);
		expect(voiceInput.isLatched).toBe(false);
		wrapper.unmount();
	});

	it('updates the owning button from the first click and shares one recorder between two panes', async () => {
		const first = mount(PushToTalkButton, {
			props: {
				paneId: 'pane-1',
			},
		});
		const second = mount(PushToTalkButton, {
			props: {
				paneId: 'pane-2',
			},
		});
		try {
			await first.trigger('pointerdown', {
				button: 0,
			});
			window.dispatchEvent(new Event('pointerup'));
			await vi.waitFor(() => expect(first.find('.bi-stop-fill').exists()).toBe(true));
			expect(first.classes()).toContain('is-recording');
			expect(second.classes()).not.toContain('is-recording');
			await second.trigger('pointerdown', {
				button: 0,
			});
			expect(invokeMock.mock.calls.filter((call) => call[0] === 'voice_start_recording')).toHaveLength(1);
			expect(voiceInput.ownerPaneId).toBe('pane-1');
			expect(state.toast).toBe(
				'You cannot record: another composition bar is recording.',
			);
			expect(voiceInput.state).toBe('recording');
			expect(voiceInput.isLatched).toBe(true);
			await first.trigger('pointerdown', {
				button: 0,
			});
			await vi.waitFor(() => expect(voiceInput.state).toBe('idle'));
			await second.trigger('pointerdown', {
				button: 0,
			});
			window.dispatchEvent(new Event('pointerup'));
			await vi.waitFor(() => expect(second.find('.bi-stop-fill').exists()).toBe(true));
			expect(first.classes()).not.toContain('is-recording');
			expect(second.classes()).toContain('is-recording');
			expect(voiceInput.ownerPaneId).toBe('pane-2');
		} finally {
			first.unmount();
			second.unmount();
		}
	});

	it.each(['starting', 'recording'] as const)(
		'explains a blocked keyboard press while another pane is %s without changing the operation',
		async (phase) => {
			voiceInput.ownerPaneId = 'pane-1';
			voiceInput.state = phase;
			voiceInput.levels = [0.5];
			const second = mount(PushToTalkButton, {
				props: {
					paneId: 'pane-2',
				},
			});
			try {
				await second.trigger('keydown', {
					key: ' ',
				});
				await second.trigger('keyup', {
					key: ' ',
				});
				expect(state.toast).toBe(
					'You cannot record: another composition bar is recording.',
				);
				expect(voiceInput.state).toBe(phase);
				expect(voiceInput.ownerPaneId).toBe('pane-1');
				expect(voiceInput.isLatched).toBe(false);
				expect(voiceInput.levels).toEqual([0.5]);
				expect(voiceInput.errors).toEqual({});
				expect(invokeMock).not.toHaveBeenCalled();
			} finally {
				voiceInput.state = 'idle';
				second.unmount();
			}
		},
	);

	it('records in another pane while the first recording changes into text, and keeps the text in the first bar', async () => {
		let finishTranscription: (text: string) => void = () => {};
		invokeMock.mockImplementation(async (name: string) => {
			if (name === 'voice_stop_recording') {
				return 1;
			}
			if (name === 'voice_transcribe_recording') {
				return new Promise<string>((resolve) => {
					finishTranscription = resolve;
				});
			}
		});
		const secondBar = CompositionBarStore.forPane('pane-2');
		secondBar.isOpen = true;
		secondBar.text = 'Second draft';
		const second = mount(PushToTalkButton, {
			props: {
				paneId: 'pane-2',
			},
		});
		try {
			await VoiceInput.press('pane-1');
			const transcribing = VoiceInput.stopAndWrite();
			await vi.waitFor(() => expect(VoiceInput.paneState('pane-1')).toBe('transcribing'));
			await second.trigger('pointerdown', {
				button: 0,
			});
			await vi.waitFor(() => expect(voiceInput.state).toBe('recording'));
			expect(voiceInput.ownerPaneId).toBe('pane-2');
			expect(state.toast).toBe('');
			finishTranscription('Original words');
			await transcribing;
			expect(compositionBar.text).toBe('Original words');
			expect(secondBar.text).toBe('Second draft');
			expect(VoiceInput.paneState('pane-1')).toBe('idle');
		} finally {
			finishTranscription('');
			second.unmount();
		}
	});

	it("ignores a click of another mouse button", async () => {
		const wrapper = mount(PushToTalkButton, { props: { paneId: 'pane-1' } });
		await wrapper.trigger("pointerdown", { button: 2 });
		expect(invokeMock).not.toHaveBeenCalled();
		wrapper.unmount();
	});

	it("is held with the key Space and released with the same key, and the repeat of the key starts nothing", async () => {
		const wrapper = mount(PushToTalkButton, { props: { paneId: 'pane-1' }, attachTo: document.body });
		await wrapper.trigger("keydown", { key: " " });
		await wrapper.trigger("keydown", { key: " ", repeat: true });
		await vi.waitFor(() => expect(voiceInput.state).toBe("recording"));
		passTime(LONG_PRESS_MILLISECONDS + 100);
		await wrapper.trigger("keyup", { key: " " });
		await vi.waitFor(() => expect(compositionBar.text).toBe("Hello"));
		expect(invokeMock.mock.calls.filter((call) => call[0] === "voice_start_recording").length).toBe(1);
		wrapper.unmount();
	});

	it("is disabled, with a title that says where to download the model, when the model is not on the disk", async () => {
		settings.voiceInputModel = "tiny";
		const wrapper = mount(PushToTalkButton, { props: { paneId: 'pane-1' } });
		expect(wrapper.attributes("disabled")).toBeDefined();
		expect(wrapper.attributes("title")).toBe("The Whisper model is not on this computer. Open Settings, Voice input, to download it.");
		wrapper.unmount();
	});

	it("shows an orange spinner and is disabled while the recording waits for Whisper", async () => {
		voiceInput.transcriptions = [{ id: 1, paneId: "pane-1", recordingId: 1, state: "waiting", recordingSeconds: 2 }];
		const wrapper = mount(PushToTalkButton, { props: { paneId: 'pane-1' } });
		expect(wrapper.find(".spinner-border").exists()).toBe(true);
		expect(wrapper.classes()).toContain("is-waiting");
		expect(wrapper.classes()).not.toContain("is-transcribing");
		expect(wrapper.attributes("disabled")).toBeDefined();
		expect(wrapper.attributes("title")).toBe("Waiting for Whisper, which changes the speech of another composition bar into text…");
		wrapper.unmount();
	});

	it("shows a spinner and is disabled while the speech changes into text", async () => {
		voiceInput.transcriptions = [{ id: 1, paneId: "pane-1", recordingId: 1, state: "transcribing", recordingSeconds: 2 }];
		const wrapper = mount(PushToTalkButton, { props: { paneId: 'pane-1' } });
		expect(wrapper.find(".spinner-border").exists()).toBe(true);
		expect(wrapper.classes()).toContain("is-transcribing");
		expect(wrapper.classes()).not.toContain("is-recording");
		expect(wrapper.attributes("disabled")).toBeDefined();
		expect(wrapper.attributes("title")).toBe("Changing the speech into text…");
		wrapper.unmount();
	});

	it("reads the options of the desktop application when it appears and nothing was read", async () => {
		voiceInput.options = null;
		invokeMock.mockResolvedValue(null);
		const wrapper = mount(PushToTalkButton, { props: { paneId: 'pane-1' } });
		await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledWith("voice_options"));
		wrapper.unmount();
	});
});
