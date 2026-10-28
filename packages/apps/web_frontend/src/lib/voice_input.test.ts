import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { invokeMock } = vi.hoisted(() => ({
	invokeMock: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@tauri-apps/api/core", () => ({
	invoke: (...args: unknown[]) => invokeMock(...args),
}));
/** The functions that the web page gave to `listen`, by event name: the library listens once in the life of the module. */
const handlers: Record<string, ((event: { payload: unknown }) => void) | undefined> = {};
const listenMock = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
	handlers[name] = handler;
	return () => {};
});
vi.mock("@tauri-apps/api/event", () => ({
	listen: (...args: Parameters<typeof listenMock>) => listenMock(...args),
}));

import { LONG_PRESS_MILLISECONDS, VoiceInput } from "./voice_input";
import { CompositionBar as CompositionBarStore } from '../stores/composition_bar';
import { state as sessionState } from "../stores/session";
import { settings } from "../stores/settings";
import type { SessionSnapshot } from "./types";
import { LEVEL_COUNT, voiceInput, type VoiceOptions } from "../stores/voice_input";

/** The options that the desktop application gives: the model `base` is on the disk, and the model `tiny` is not. */
function makeOptions(): VoiceOptions {
	return {
		models: [
			{ id: "tiny", sizeBytes: 77_691_713, isEnglishOnly: false, isDownloaded: false },
			{ id: "base", sizeBytes: 147_951_465, isEnglishOnly: false, isDownloaded: true },
		],
		languages: ["en", "fr"],
		defaultModelId: "base",
	};
}

/** The names of the commands that the web page sent to the desktop application, in order. */
function commandNames(): string[] {
	return invokeMock.mock.calls.map((call) => call[0] as string);
}

/** The number that the fake desktop application gives to each stopped recording. */
const RECORDING_ID = 7;

/**
 * Answers a command as the desktop application does: the stop of the microphone gives the number of the recording, and Whisper
 * gives the text.
 * @param name The name of the command.
 * @param text The text that Whisper gives.
 * @returns The answer of the command.
 */
function answer(name: string, text: string): unknown {
	if (name === "voice_stop_recording") {
		return RECORDING_ID;
	}
	if (name === "voice_transcribe_recording") {
		return text;
	}
	return undefined;
}

/** Lets the time pass for the code that measures the length of a press, without any real waiting. */
function passTime(milliseconds: number): void {
	vi.setSystemTime(Date.now() + milliseconds);
}

const compositionBar = CompositionBarStore.forPane('pane-1');

beforeEach(() => {
	vi.useFakeTimers({ toFake: ["Date"] });
	invokeMock.mockReset();
	listenMock.mockClear();
	settings.voiceInput = true;
	settings.voiceInputModel = "base";
	settings.voiceInputLanguage = "auto";
	voiceInput.options = makeOptions();
	voiceInput.ownerPaneId = null;
	voiceInput.state = "idle";
	voiceInput.isLatched = false;
	voiceInput.levels = [];
	voiceInput.errors = {};
	voiceInput.transcriptions = [];
	voiceInput.download = { modelId: null, receivedBytes: 0, totalBytes: 0, error: null };
	compositionBar.isOpen = false;
	compositionBar.text = "";
	compositionBar.paths = [];
});

afterEach(async () => {
	await VoiceInput.cancel();
	vi.useRealTimers();
});

describe("VoiceInput.loadOptions", () => {
	it("reads the options of the desktop application, and listens once to the progress of the downloads", async () => {
		voiceInput.options = null;
		invokeMock.mockResolvedValue(makeOptions());
		await VoiceInput.loadOptions();
		await VoiceInput.loadOptions();
		expect((voiceInput.options as VoiceOptions | null)?.models.length).toBe(2);
		expect(commandNames()).toEqual(["voice_options", "voice_options"]);
		const progressListens = listenMock.mock.calls.filter((call) => call[0] === "voice-download-progress");
		expect(progressListens.length).toBeLessThanOrEqual(1);
	});

	it("keeps the options when the desktop application gives nothing", async () => {
		invokeMock.mockResolvedValue(null);
		await VoiceInput.loadOptions();
		expect(voiceInput.options?.models.length).toBe(2);
	});
});

describe("the model", () => {
	it("is the model that the developer chose, with its state on the disk", () => {
		expect(VoiceInput.chosenModel()?.id).toBe("base");
		expect(VoiceInput.isModelReady()).toBe(true);
		settings.voiceInputModel = "tiny";
		expect(VoiceInput.isModelReady()).toBe(false);
		settings.voiceInputModel = "no_such_model";
		expect(VoiceInput.chosenModel()).toBeNull();
		expect(VoiceInput.isModelReady()).toBe(false);
	});

	it("is not ready before the options are read", () => {
		voiceInput.options = null;
		expect(VoiceInput.isModelReady()).toBe(false);
	});

	it("gives the progress of the download of the chosen model as a whole percent", () => {
		expect(VoiceInput.downloadPercent()).toBeNull();
		voiceInput.download = { modelId: "base", receivedBytes: 345, totalBytes: 1000, error: null };
		expect(VoiceInput.downloadPercent()).toBe(34);
		voiceInput.download = { modelId: "tiny", receivedBytes: 500, totalBytes: 1000, error: null };
		expect(VoiceInput.downloadPercent()).toBeNull();
	});
});

describe("VoiceInput.downloadModel", () => {
	it("downloads a model, then reads the options again", async () => {
		invokeMock.mockResolvedValue(makeOptions());
		await VoiceInput.downloadModel("tiny");
		expect(invokeMock.mock.calls[0]).toEqual(["voice_download_model", { modelId: "tiny" }]);
		expect(commandNames()).toEqual(["voice_download_model", "voice_options"]);
		expect(voiceInput.download.modelId).toBeNull();
		expect(voiceInput.download.error).toBeNull();
	});

	it("keeps the category of a failure, and frees the download for a new try", async () => {
		invokeMock.mockImplementation(async (name: string) => {
			if (name === "voice_download_model") {
				throw "download_failed";
			}
			return makeOptions();
		});
		await VoiceInput.downloadModel("tiny");
		expect(voiceInput.download.error).toBe("download_failed");
		expect(voiceInput.download.modelId).toBeNull();
	});

	it("clears the last error when a new try begins", async () => {
		voiceInput.download.error = "download_failed";
		invokeMock.mockResolvedValue(makeOptions());
		await VoiceInput.downloadModel("tiny");
		expect(voiceInput.download.error).toBeNull();
	});

	it("starts nothing while another model downloads", async () => {
		voiceInput.download.modelId = "base";
		await VoiceInput.downloadModel("tiny");
		expect(invokeMock).not.toHaveBeenCalled();
	});

	it("shows the progress that the desktop application sends", async () => {
		invokeMock.mockResolvedValue(makeOptions());
		voiceInput.options = null;
		await VoiceInput.loadOptions();
		expect(handlers["voice-download-progress"]).toBeDefined();
		handlers["voice-download-progress"]?.({ payload: { modelId: "tiny", receivedBytes: 10, totalBytes: 40 } });
		expect(voiceInput.download).toMatchObject({ modelId: "tiny", receivedBytes: 10, totalBytes: 40 });
	});
});

describe("VoiceInput.ensureChosenModel", () => {
	it("downloads the chosen model when it is not on the disk", async () => {
		settings.voiceInputModel = "tiny";
		invokeMock.mockResolvedValue(makeOptions());
		await VoiceInput.ensureChosenModel();
		expect(invokeMock.mock.calls[0]).toEqual(["voice_download_model", { modelId: "tiny" }]);
	});

	it("downloads nothing when the model is on the disk", async () => {
		await VoiceInput.ensureChosenModel();
		expect(invokeMock).not.toHaveBeenCalled();
	});

	it("downloads nothing when the option is off", async () => {
		settings.voiceInput = false;
		settings.voiceInputModel = "tiny";
		await VoiceInput.ensureChosenModel();
		expect(invokeMock).not.toHaveBeenCalled();
	});
});

describe("VoiceInput.press and VoiceInput.release: a long press", () => {
	it("opens the composition bar, records while the button is held, and writes the text after the release", async () => {
		invokeMock.mockImplementation(async (name: string) => answer(name, "Run the tests again."));
		await VoiceInput.press('pane-1');
		expect(voiceInput.state).toBe("recording");
		expect(voiceInput.isLatched).toBe(false);
		expect(compositionBar.isOpen).toBe(true);
		passTime(LONG_PRESS_MILLISECONDS + 100);
		await VoiceInput.release(false, 'pane-1');
		expect(commandNames()).toEqual(["voice_start_recording", "voice_stop_recording", "voice_transcribe_recording"]);
		expect(invokeMock.mock.calls[0][1]).toEqual({ modelId: "base", language: "auto" });
		expect(invokeMock.mock.calls[1][1]).toBeUndefined();
		expect(invokeMock.mock.calls[2][1]).toEqual({ recordingId: RECORDING_ID, modelId: "base", language: "auto" });
		expect(compositionBar.text).toBe("Run the tests again.");
		expect(voiceInput.state).toBe("idle");
		expect(VoiceInput.errorOf("pane-1")).toBeNull();
	});

	it("gives the model and the language that the developer chose", async () => {
		settings.voiceInputLanguage = "fr";
		invokeMock.mockImplementation(async (name: string) => answer(name, ""));
		await VoiceInput.press('pane-1');
		passTime(LONG_PRESS_MILLISECONDS);
		await VoiceInput.release(false, 'pane-1');
		expect(invokeMock.mock.calls[0][1]).toEqual({ modelId: "base", language: "fr" });
		expect(invokeMock.mock.calls[2][1]).toEqual({ recordingId: RECORDING_ID, modelId: "base", language: "fr" });
	});

	it("ends when the pointer is released anywhere in the window", async () => {
		invokeMock.mockImplementation(async (name: string) => answer(name, "Hello"));
		await VoiceInput.press('pane-1');
		passTime(LONG_PRESS_MILLISECONDS + 100);
		window.dispatchEvent(new Event("pointerup"));
		await vi.waitFor(() => expect(compositionBar.text).toBe("Hello"));
		expect(commandNames()).toEqual(["voice_start_recording", "voice_stop_recording", "voice_transcribe_recording"]);
	});

	it("stops at once when the button is released before the microphone is open", async () => {
		let openMicrophone: () => void = () => {};
		invokeMock.mockImplementation((name: string) => {
			if (name === "voice_start_recording") {
				return new Promise<void>((resolve) => {
					openMicrophone = resolve;
				});
			}
			return Promise.resolve(answer(name, "Quick words"));
		});
		const starting = VoiceInput.press('pane-1');
		expect(voiceInput.state).toBe("starting");
		passTime(LONG_PRESS_MILLISECONDS + 100);
		await VoiceInput.release(false, 'pane-1');
		openMicrophone();
		await starting;
		expect(commandNames()).toEqual(["voice_start_recording", "voice_stop_recording", "voice_transcribe_recording"]);
		expect(compositionBar.text).toBe("Quick words");
		expect(voiceInput.state).toBe("idle");
	});

	it("adds the text after the text that the developer already wrote, with one space", async () => {
		compositionBar.text = "Please";
		invokeMock.mockImplementation(async (name: string) => answer(name, "  run the tests "));
		await VoiceInput.press('pane-1');
		passTime(LONG_PRESS_MILLISECONDS);
		await VoiceInput.release(false, 'pane-1');
		expect(compositionBar.text).toBe("Please run the tests");
	});

	it("writes no error and no text for a recording with no speech", async () => {
		invokeMock.mockResolvedValue("");
		await VoiceInput.press('pane-1');
		passTime(LONG_PRESS_MILLISECONDS);
		await VoiceInput.release(false, 'pane-1');
		expect(compositionBar.text).toBe("");
		expect(VoiceInput.errorOf("pane-1")).toBeNull();
		expect(voiceInput.state).toBe("idle");
	});

	it("keeps the category of the error when the speech cannot change into text", async () => {
		invokeMock.mockImplementation(async (name: string) => {
			if (name === "voice_stop_recording") {
				throw "no_signal";
			}
			return undefined;
		});
		await VoiceInput.press('pane-1');
		passTime(LONG_PRESS_MILLISECONDS);
		await VoiceInput.release(false, 'pane-1');
		expect(VoiceInput.errorOf("pane-1")).toBe("no_signal");
		expect(voiceInput.state).toBe("idle");
	});

	it("drops the text when the composition bar was closed during the change", async () => {
		invokeMock.mockImplementation(async (name: string) => {
			if (name === "voice_transcribe_recording") {
				compositionBar.isOpen = false;
				return "Too late";
			}
			return answer(name, "");
		});
		await VoiceInput.press('pane-1');
		passTime(LONG_PRESS_MILLISECONDS);
		await VoiceInput.release(false, 'pane-1');
		expect(compositionBar.text).toBe("");
	});
});

describe("VoiceInput.press and VoiceInput.release: a click", () => {
	it("keeps the recording after a short press, until the next press", async () => {
		invokeMock.mockImplementation(async (name: string) => answer(name, "Keep going"));
		await VoiceInput.press('pane-1');
		passTime(LONG_PRESS_MILLISECONDS - 100);
		await VoiceInput.release(false, 'pane-1');
		expect(voiceInput.state).toBe("recording");
		expect(voiceInput.isLatched).toBe(true);
		expect(commandNames()).toEqual(["voice_start_recording"]);
		await VoiceInput.press('pane-1');
		expect(commandNames()).toEqual(["voice_start_recording", "voice_stop_recording", "voice_transcribe_recording"]);
		expect(compositionBar.text).toBe("Keep going");
		expect(voiceInput.state).toBe("idle");
		expect(voiceInput.isLatched).toBe(false);
	});

	it("keeps the recording when the pointer is released at once anywhere in the window", async () => {
		invokeMock.mockResolvedValue("");
		await VoiceInput.press('pane-1');
		window.dispatchEvent(new Event("pointerup"));
		await vi.waitFor(() => expect(voiceInput.isLatched).toBe(true));
		expect(voiceInput.state).toBe("recording");
	});

	it("ignores the release of the pointer and the loss of the keyboard while the recording is kept", async () => {
		invokeMock.mockResolvedValue("");
		await VoiceInput.press('pane-1');
		await VoiceInput.release(false, 'pane-1');
		window.dispatchEvent(new Event("pointerup"));
		window.dispatchEvent(new Event("pointercancel"));
		window.dispatchEvent(new Event("blur"));
		await Promise.resolve();
		expect(voiceInput.state).toBe("recording");
		expect(commandNames()).toEqual(["voice_start_recording"]);
	});

	it("stops a short press at once when the window loses the keyboard", async () => {
		invokeMock.mockImplementation(async (name: string) => answer(name, "Hello"));
		await VoiceInput.press('pane-1');
		window.dispatchEvent(new Event("blur"));
		await vi.waitFor(() => expect(compositionBar.text).toBe("Hello"));
		expect(voiceInput.isLatched).toBe(false);
	});

	it("keeps the recording when a short press ends before the microphone is open", async () => {
		let openMicrophone: () => void = () => {};
		invokeMock.mockImplementation((name: string) => {
			if (name === "voice_start_recording") {
				return new Promise<void>((resolve) => {
					openMicrophone = resolve;
				});
			}
			return Promise.resolve(answer(name, "Later words"));
		});
		const starting = VoiceInput.press('pane-1');
		await VoiceInput.release(false, 'pane-1');
		openMicrophone();
		await starting;
		expect(voiceInput.state).toBe("recording");
		expect(voiceInput.isLatched).toBe(true);
		expect(commandNames()).toEqual(["voice_start_recording"]);
		await VoiceInput.press('pane-1');
		expect(compositionBar.text).toBe("Later words");
	});

	it.each(["waiting", "transcribing"] as const)(
		"does nothing with a press while the recording of the same pane is %s",
		async (transcriptionState) => {
			voiceInput.transcriptions = [
				{ id: 1, paneId: "pane-1", recordingId: RECORDING_ID, state: transcriptionState, recordingSeconds: 3 },
			];
			await VoiceInput.press('pane-1');
			expect(invokeMock).not.toHaveBeenCalled();
			expect(VoiceInput.paneState('pane-1')).toBe(transcriptionState);
		},
	);
});

describe("VoiceInput.press and VoiceInput.release: when nothing can record", () => {
	it("keeps the category of the error when macOS refuses the microphone, and records nothing", async () => {
		invokeMock.mockRejectedValue("microphone_denied");
		await VoiceInput.press('pane-1');
		expect(VoiceInput.errorOf("pane-1")).toBe("microphone_denied");
		expect(voiceInput.state).toBe("idle");
		expect(voiceInput.isLatched).toBe(false);
		await VoiceInput.release(false, 'pane-1');
		expect(commandNames()).toEqual(["voice_start_recording"]);
	});

	it("does not open the microphone when the option is off", async () => {
		settings.voiceInput = false;
		await VoiceInput.press('pane-1');
		expect(invokeMock).not.toHaveBeenCalled();
		expect(voiceInput.state).toBe("idle");
		expect(compositionBar.isOpen).toBe(false);
	});

	it("does not open the microphone when the model is not on the disk", async () => {
		settings.voiceInputModel = "tiny";
		await VoiceInput.press('pane-1');
		expect(invokeMock).not.toHaveBeenCalled();
		expect(VoiceInput.errorOf("pane-1")).toBe("model_missing");
		expect(compositionBar.isOpen).toBe(false);
	});

	it("starts one recording at a time", async () => {
		invokeMock.mockResolvedValue("");
		await VoiceInput.press('pane-1');
		await VoiceInput.press('pane-1');
		expect(commandNames()).toEqual(["voice_start_recording"]);
	});

	it("ignores a release when nothing records", async () => {
		await VoiceInput.release(false, 'pane-1');
		expect(invokeMock).not.toHaveBeenCalled();
	});
});

describe("the level of the voice", () => {
	/** Sends one level, as the desktop application does. */
	function sendLevel(level: number): void {
		handlers["voice-input-level"]?.({ payload: level });
	}

	it("listens once to the event of the level, and keeps the levels of the recording", async () => {
		invokeMock.mockResolvedValue("");
		await VoiceInput.press('pane-1');
		await VoiceInput.release(false, 'pane-1');
		sendLevel(0.2);
		sendLevel(0.7);
		expect(voiceInput.levels).toEqual([0.2, 0.7]);
		await VoiceInput.press('pane-1');
		await VoiceInput.press('pane-1');
		await VoiceInput.release(false, 'pane-1');
		const levelListens = listenMock.mock.calls.filter((call) => call[0] === "voice-input-level");
		expect(levelListens.length).toBeLessThanOrEqual(1);
	});

	it("keeps only the last levels", async () => {
		invokeMock.mockResolvedValue("");
		await VoiceInput.press('pane-1');
		for (let level = 0; level < LEVEL_COUNT + 10; level += 1) {
			sendLevel(level / 100);
		}
		expect(voiceInput.levels.length).toBe(LEVEL_COUNT);
		expect(voiceInput.levels[LEVEL_COUNT - 1]).toBe((LEVEL_COUNT + 9) / 100);
	});

	it("ignores a level that arrives when nothing records", async () => {
		invokeMock.mockResolvedValue("");
		await VoiceInput.press('pane-1');
		await VoiceInput.release(false, 'pane-1');
		await VoiceInput.press('pane-1');
		sendLevel(0.5);
		expect(voiceInput.levels).toEqual([]);
	});

	it("starts a new recording with no level from the old recording", async () => {
		invokeMock.mockResolvedValue("");
		await VoiceInput.press('pane-1');
		sendLevel(0.5);
		passTime(LONG_PRESS_MILLISECONDS);
		await VoiceInput.release(false, 'pane-1');
		await VoiceInput.press('pane-1');
		expect(voiceInput.levels).toEqual([]);
	});
});

describe("VoiceInput.settle", () => {
	it("returns at once when nothing records", async () => {
		expect(await VoiceInput.settle('pane-1')).toBe(true);
		expect(invokeMock).not.toHaveBeenCalled();
	});

	it("stops a recording of a long press, writes its text, and returns true", async () => {
		invokeMock.mockImplementation(async (name: string) => answer(name, "Spoken words"));
		await VoiceInput.press('pane-1');
		passTime(LONG_PRESS_MILLISECONDS + 100);
		expect(await VoiceInput.settle('pane-1')).toBe(true);
		expect(commandNames()).toEqual(["voice_start_recording", "voice_stop_recording", "voice_transcribe_recording"]);
		expect(compositionBar.text).toBe("Spoken words");
		expect(voiceInput.state).toBe("idle");
		expect(voiceInput.isLatched).toBe(false);
	});

	it("stops a recording that a click keeps, writes its text, and returns true", async () => {
		invokeMock.mockImplementation(async (name: string) => answer(name, "Kept words"));
		await VoiceInput.press('pane-1');
		await VoiceInput.release(false, 'pane-1');
		expect(voiceInput.isLatched).toBe(true);
		expect(await VoiceInput.settle('pane-1')).toBe(true);
		expect(compositionBar.text).toBe("Kept words");
		expect(voiceInput.state).toBe("idle");
		expect(voiceInput.isLatched).toBe(false);
	});

	it("waits for the microphone to open, then stops, and returns true", async () => {
		let openMicrophone: () => void = () => {};
		invokeMock.mockImplementation((name: string) => {
			if (name === "voice_start_recording") {
				return new Promise<void>((resolve) => {
					openMicrophone = resolve;
				});
			}
			return Promise.resolve(answer(name, "Late words"));
		});
		const starting = VoiceInput.press('pane-1');
		expect(voiceInput.state).toBe("starting");
		const settling = VoiceInput.settle('pane-1');
		await vi.waitFor(() => expect(commandNames()).toContain("voice_start_recording"));
		openMicrophone();
		expect(await settling).toBe(true);
		await starting;
		expect(commandNames()).toEqual(["voice_start_recording", "voice_stop_recording", "voice_transcribe_recording"]);
		expect(compositionBar.text).toBe("Late words");
		expect(voiceInput.state).toBe("idle");
	});

	it("waits for the speech that already changes into text, and returns true", async () => {
		let giveText: (text: string) => void = () => {};
		invokeMock.mockImplementation((name: string) => {
			if (name === "voice_transcribe_recording") {
				return new Promise<string>((resolve) => {
					giveText = resolve;
				});
			}
			return Promise.resolve(answer(name, ""));
		});
		await VoiceInput.press('pane-1');
		passTime(LONG_PRESS_MILLISECONDS + 100);
		const releasing = VoiceInput.release(false, 'pane-1');
		expect(VoiceInput.paneState('pane-1')).toBe("waiting");
		await vi.waitFor(() => expect(VoiceInput.paneState('pane-1')).toBe("transcribing"));
		let isSettled = false;
		const settling = VoiceInput.settle('pane-1').then((result) => {
			isSettled = result;
		});
		await Promise.resolve();
		expect(isSettled).toBe(false);
		giveText("Waited words");
		await settling;
		await releasing;
		expect(isSettled).toBe(true);
		expect(compositionBar.text).toBe("Waited words");
		expect(commandNames().filter((name) => name === "voice_transcribe_recording").length).toBe(1);
	});

	it("returns false and keeps the category when the speech cannot change into text", async () => {
		invokeMock.mockImplementation(async (name: string) => {
			if (name === "voice_stop_recording") {
				throw "no_signal";
			}
			return undefined;
		});
		await VoiceInput.press('pane-1');
		passTime(LONG_PRESS_MILLISECONDS + 100);
		expect(await VoiceInput.settle('pane-1')).toBe(false);
		expect(VoiceInput.errorOf("pane-1")).toBe("no_signal");
		expect(voiceInput.state).toBe("idle");
	});

	it("returns false and keeps the category when the microphone cannot open", async () => {
		invokeMock.mockImplementation((name: string) =>
			name === "voice_start_recording" ? Promise.reject("microphone_denied") : Promise.resolve(undefined),
		);
		const starting = VoiceInput.press('pane-1');
		expect(await VoiceInput.settle('pane-1')).toBe(false);
		await starting;
		expect(VoiceInput.errorOf("pane-1")).toBe("microphone_denied");
		expect(voiceInput.state).toBe("idle");
	});

	it("forgets the error of an earlier recording when a new recording ends well", async () => {
		invokeMock.mockImplementation(async (name: string) => answer(name, "Fine"));
		await VoiceInput.press('pane-1');
		voiceInput.errors["pane-1"] = "no_signal";
		passTime(LONG_PRESS_MILLISECONDS + 100);
		expect(await VoiceInput.settle('pane-1')).toBe(true);
		expect(VoiceInput.errorOf("pane-1")).toBeNull();
	});
});

describe("VoiceInput.cancel", () => {
	it("throws away a recording that runs", async () => {
		invokeMock.mockResolvedValue(undefined);
		await VoiceInput.press('pane-1');
		await VoiceInput.cancel();
		expect(commandNames()).toEqual(["voice_start_recording", "voice_cancel_recording"]);
		expect(voiceInput.state).toBe("idle");
	});

	it("does nothing when nothing records", async () => {
		await VoiceInput.cancel();
		expect(invokeMock).not.toHaveBeenCalled();
	});
});


describe('voice input cancellation (issue 736)', () => {
	it.each(['late words', 'failure'])('ignores a cancelled transcription result: %s', async (result) => {
		let finishFn: (text: string) => void = () => {};
		let failFn: (error: string) => void = () => {};
		invokeMock.mockImplementation((name: string) => {
			if (name === 'voice_transcribe_recording') {
				return new Promise<string>((resolve, reject) => {
					finishFn = resolve;
					failFn = reject;
				});
			}
			return Promise.resolve(answer(name, ''));
		});
		await VoiceInput.press('pane-1');
		compositionBar.text = 'Keep the draft';
		compositionBar.paths = ['/shots/a.png'];
		const transcribing = VoiceInput.stopAndWrite();
		await vi.waitFor(() => expect(commandNames()).toContain('voice_transcribe_recording'));
		const settling = VoiceInput.settle('pane-1');
		await VoiceInput.cancel('pane-1');
		expect(await settling).toBe(false);
		await VoiceInput.press('pane-2');
		if (result === 'failure') {
			failFn('transcription_failed');
		} else {
			finishFn(result);
		}
		await transcribing;
		expect(voiceInput.state).toBe('recording');
		expect(voiceInput.ownerPaneId).toBe('pane-2');
		expect(VoiceInput.errorOf("pane-1")).toBeNull();
		expect(compositionBar.text).toBe('Keep the draft');
		expect(compositionBar.paths).toEqual(['/shots/a.png']);
		expect(compositionBar.isOpen).toBe(true);
	});

	it('waits for a pending microphone start before discarding it and starting another recording', async () => {
		let openFn: () => void = () => {};
		invokeMock.mockImplementationOnce(() => new Promise<void>((resolve) => {
			openFn = resolve;
		}));
		const starting = VoiceInput.press('pane-1');
		await vi.waitFor(() => expect(commandNames()).toContain('voice_start_recording'));
		const cancelling = VoiceInput.cancel('pane-1');
		const restarting = VoiceInput.press('pane-1');
		expect(commandNames()).toEqual(['voice_start_recording']);
		openFn();
		await starting;
		await cancelling;
		await restarting;
		expect(commandNames()).toEqual(['voice_start_recording', 'voice_cancel_recording', 'voice_start_recording']);
		expect(voiceInput.state).toBe('recording');
	});

	it('does not cancel the operation owned by another pane', async () => {
		await VoiceInput.press('pane-1');
		await VoiceInput.cancel('pane-2');
		expect(voiceInput.state).toBe('recording');
		expect(commandNames()).toEqual(['voice_start_recording']);
	});
});

describe("the queue of the transcriptions (issue 868)", () => {
	/** The functions that give the text of each recording, by number of recording. */
	let giveTextFns: Record<number, (text: string) => void> = {};
	/** The number of the last recording that the fake desktop application stopped. */
	let lastRecordingId = 0;

	beforeEach(() => {
		giveTextFns = {};
		lastRecordingId = 0;
		invokeMock.mockImplementation((name: string, args?: { recordingId: number }) => {
			if (name === "voice_stop_recording") {
				lastRecordingId += 1;
				return Promise.resolve(lastRecordingId);
			}
			if (name === "voice_transcribe_recording" && args !== undefined) {
				return new Promise<string>((resolve) => {
					giveTextFns[args.recordingId] = resolve;
				});
			}
			return Promise.resolve(undefined);
		});
		CompositionBarStore.forPane("pane-2").text = "";
	});

	afterEach(() => {
		for (const giveTextFn of Object.values(giveTextFns)) {
			giveTextFn("");
		}
	});

	/**
	 * Records in a pane with a click, then stops with the next click.
	 * @param paneId The identifier of the pane.
	 * @returns Resolves when the stop has been sent, before the text arrives.
	 */
	async function recordAndStop(paneId: string): Promise<void> {
		await VoiceInput.press(paneId);
		await VoiceInput.release(false, paneId);
		void VoiceInput.press(paneId);
		await vi.waitFor(() => expect(VoiceInput.transcriptionOf(paneId)?.recordingId).not.toBeNull());
	}

	it("records in a second composition bar while Whisper changes the first recording into text", async () => {
		await recordAndStop("pane-1");
		await vi.waitFor(() => expect(VoiceInput.paneState("pane-1")).toBe("transcribing"));
		await VoiceInput.press("pane-2");
		expect(VoiceInput.paneState("pane-2")).toBe("recording");
		expect(voiceInput.ownerPaneId).toBe("pane-2");
	});

	it("keeps the second recording waiting until the first transcription ends, and writes each text in its own bar", async () => {
		await recordAndStop("pane-1");
		await recordAndStop("pane-2");
		expect(VoiceInput.paneState("pane-1")).toBe("transcribing");
		expect(VoiceInput.paneState("pane-2")).toBe("waiting");
		expect(commandNames().filter((name) => name === "voice_transcribe_recording")).toHaveLength(1);
		giveTextFns[1]("First words");
		await vi.waitFor(() => expect(VoiceInput.paneState("pane-2")).toBe("transcribing"));
		expect(compositionBar.text).toBe("First words");
		expect(VoiceInput.paneState("pane-1")).toBe("idle");
		giveTextFns[2]("Second words");
		await vi.waitFor(() => expect(VoiceInput.paneState("pane-2")).toBe("idle"));
		expect(CompositionBarStore.forPane("pane-2").text).toBe("Second words");
		const transcribeCalls = invokeMock.mock.calls.filter((call) => call[0] === "voice_transcribe_recording");
		expect(transcribeCalls.map((call) => (call[1] as { recordingId: number }).recordingId)).toEqual([1, 2]);
	});

	it("keeps the length of each stopped recording for its composition bar", async () => {
		await VoiceInput.press("pane-1");
		await VoiceInput.release(false, "pane-1");
		passTime(7_400);
		void VoiceInput.press("pane-1");
		expect(VoiceInput.transcriptionOf("pane-1")?.recordingSeconds).toBe(7);
	});

	it("takes a waiting transcription out of the queue when it is cancelled, and throws its recording away", async () => {
		await recordAndStop("pane-1");
		await recordAndStop("pane-2");
		await VoiceInput.cancel("pane-2");
		expect(VoiceInput.paneState("pane-2")).toBe("idle");
		expect(invokeMock).toHaveBeenCalledWith("voice_discard_recording", { recordingId: 2 });
		giveTextFns[1]("First words");
		await vi.waitFor(() => expect(VoiceInput.paneState("pane-1")).toBe("idle"));
		expect(commandNames().filter((name) => name === "voice_transcribe_recording")).toHaveLength(1);
		expect(CompositionBarStore.forPane("pane-2").text).toBe("");
	});

	it("starts the next transcription when the transcription that runs is cancelled, and drops its late text", async () => {
		await recordAndStop("pane-1");
		await recordAndStop("pane-2");
		await VoiceInput.cancel("pane-1");
		expect(VoiceInput.paneState("pane-1")).toBe("idle");
		giveTextFns[1]("Late words");
		await vi.waitFor(() => expect(VoiceInput.paneState("pane-2")).toBe("transcribing"));
		expect(compositionBar.text).toBe("");
		giveTextFns[2]("Second words");
		await vi.waitFor(() => expect(CompositionBarStore.forPane("pane-2").text).toBe("Second words"));
	});

	it("lets a send of the second composition bar wait for its own text, after the first transcription", async () => {
		await recordAndStop("pane-1");
		await recordAndStop("pane-2");
		let isSettled = false;
		const settling = VoiceInput.settle("pane-2").then((result) => {
			isSettled = result;
		});
		giveTextFns[1]("First words");
		await vi.waitFor(() => expect(VoiceInput.paneState("pane-2")).toBe("transcribing"));
		expect(isSettled).toBe(false);
		giveTextFns[2]("Second words");
		await settling;
		expect(isSettled).toBe(true);
		expect(CompositionBarStore.forPane("pane-2").text).toBe("Second words");
	});

	it("keeps the error of a failed transcription in its own pane only", async () => {
		invokeMock.mockImplementation(async (name: string) => {
			if (name === "voice_transcribe_recording") {
				throw "model_load_failed";
			}
			return answer(name, "");
		});
		await VoiceInput.press("pane-1");
		passTime(LONG_PRESS_MILLISECONDS);
		await VoiceInput.release(false, "pane-1");
		expect(VoiceInput.errorOf("pane-1")).toBe("model_load_failed");
		expect(VoiceInput.errorOf("pane-2")).toBeNull();
	});
});

describe("a press while another tab records (issue 762)", () => {
	beforeEach(() => {
		invokeMock.mockImplementation(async (name: string) => answer(name, ""));
		sessionState.snapshot = {
			workspaces: [
				{ workspace_id: "w1", label: "Heidrun" },
				{ workspace_id: "w2", label: "Website" },
			],
			tabs: [
				{ tab_id: "t1", workspace_id: "w1", label: "Tab A" },
				{ tab_id: "t2", workspace_id: "w1", label: "Tab B" },
				{ tab_id: "t3", workspace_id: "w2", label: "Tab C" },
			],
			panes: [
				{ pane_id: "pane-1", tab_id: "t1", workspace_id: "w1" },
				{ pane_id: "pane-2", tab_id: "t2", workspace_id: "w1" },
				{ pane_id: "pane-3", tab_id: "t3", workspace_id: "w2" },
			],
			agents: [],
			layouts: [],
		} as unknown as SessionSnapshot;
		sessionState.selectedWorkspaceId = "w1";
		sessionState.toast = "";
	});

	afterEach(() => {
		sessionState.snapshot = null;
		sessionState.toast = "";
	});

	it("starts nothing, keeps the recording, and names the tab that records and its workspace", async () => {
		await VoiceInput.press("pane-1");
		await VoiceInput.release(false, "pane-1");
		await VoiceInput.press("pane-2");
		expect(sessionState.toast).toBe("You cannot record: the tab “Tab A” of the workspace “Heidrun” is recording.");
		expect(voiceInput.ownerPaneId).toBe("pane-1");
		expect(voiceInput.state).toBe("recording");
		expect(voiceInput.isLatched).toBe(true);
		expect(commandNames()).toEqual(["voice_start_recording"]);
	});

	it("names the workspace that records also when it is not the selected workspace", async () => {
		await VoiceInput.press("pane-3");
		await VoiceInput.press("pane-1");
		expect(sessionState.toast).toBe("You cannot record: the tab “Tab C” of the workspace “Website” is recording.");
	});

	it("tells which tab and which workspace record, only while the microphone records", async () => {
		expect(VoiceInput.isRecordingInTab("t1")).toBe(false);
		await VoiceInput.press("pane-1");
		await VoiceInput.release(false, "pane-1");
		expect(VoiceInput.isRecordingInTab("t1")).toBe(true);
		expect(VoiceInput.isRecordingInTab("t2")).toBe(false);
		expect(VoiceInput.isRecordingInWorkspace("w1")).toBe(true);
		expect(VoiceInput.isRecordingInWorkspace("w2")).toBe(false);
		await VoiceInput.press("pane-1");
		expect(VoiceInput.isRecordingInTab("t1")).toBe(false);
		expect(VoiceInput.isRecordingInWorkspace("w1")).toBe(false);
	});

	it("shows no recording when the option is off", async () => {
		await VoiceInput.press("pane-1");
		settings.voiceInput = false;
		expect(VoiceInput.isRecordingInTab("t1")).toBe(false);
	});
});
