import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
	invoke: (...args: unknown[]) => invokeMock(...args),
}));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));

import SettingsVoiceInputSection from "./SettingsVoiceInputSection.vue";
import { settings } from "../../stores/settings";
import { voiceInput, type VoiceOptions } from "../../stores/voice_input";

enableAutoUnmount(afterEach);

/** The options of the desktop application: three models, and the model `base` is on the disk. */
function makeOptions(): VoiceOptions {
	return {
		models: [
			{ id: "tiny", sizeBytes: 77_691_713, isEnglishOnly: false, isDownloaded: false },
			{ id: "base", sizeBytes: 147_951_465, isEnglishOnly: false, isDownloaded: true },
			{ id: "base.en", sizeBytes: 147_964_211, isEnglishOnly: true, isDownloaded: false },
			{ id: "large-v3", sizeBytes: 3_095_033_483, isEnglishOnly: false, isDownloaded: false },
		],
		languages: ["en", "fr", "de"],
		defaultModelId: "base",
	};
}

/** Mounts the section and waits for the read of the options. */
async function mountSection() {
	const wrapper = mount(SettingsVoiceInputSection);
	await flushPromises();
	return wrapper;
}

beforeEach(() => {
	localStorage.clear();
	invokeMock.mockReset();
	invokeMock.mockImplementation(async (name: string) => (name === "voice_options" ? makeOptions() : undefined));
	settings.language = "en";
	settings.voiceInput = false;
	settings.voiceInputModel = "base";
	settings.voiceInputLanguage = "auto";
	voiceInput.options = null;
	voiceInput.state = "idle";
	voiceInput.errors = {};
	voiceInput.transcriptions = [];
	voiceInput.download = { modelId: null, receivedBytes: 0, totalBytes: 0, error: null };
});

describe("the section Voice input", () => {
	it("is off at first: the switch is off, and the language and the model cannot change", async () => {
		const wrapper = await mountSection();
		expect((wrapper.get("input[type=checkbox]").element as HTMLInputElement).checked).toBe(false);
		expect(wrapper.get("#voice-input-language").attributes("disabled")).toBeDefined();
		expect(wrapper.get("#voice-input-model").attributes("disabled")).toBeDefined();
	});

	it("opens no microphone and downloads nothing when the option is off", async () => {
		await mountSection();
		const names = invokeMock.mock.calls.map((call) => call[0]);
		expect(names).not.toContain("voice_start_recording");
		expect(names).not.toContain("voice_download_model");
	});

	it("gives a visible label to the language and to the model", async () => {
		const wrapper = await mountSection();
		expect(wrapper.get('label[for="voice-input-language"]').text()).toBe("Language of the speech");
		expect(wrapper.get('label[for="voice-input-model"]').text()).toBe("Whisper model");
	});

	it("lists the automatic choice and the languages, with their names in the language of the window", async () => {
		const wrapper = await mountSection();
		expect(wrapper.findAll("#voice-input-language option").map((option) => option.text())).toEqual(["Detect the language", "English", "French", "German"]);
		settings.language = "fr";
		await flushPromises();
		expect(wrapper.findAll("#voice-input-language option").map((option) => option.text())).toEqual(["Détecter la langue", "Anglais", "Français", "Allemand"]);
	});

	it("lists the models with their size, and says that a model is for English only", async () => {
		const wrapper = await mountSection();
		expect(wrapper.findAll("#voice-input-model option").map((option) => option.text())).toEqual([
			"tiny (78 MB)",
			"base (148 MB)",
			"base.en (148 MB, English only)",
			"large-v3 (3.1 GB)",
		]);
	});

	it("downloads the chosen model when the developer turns the option on and the model is not on the disk", async () => {
		settings.voiceInputModel = "tiny";
		const wrapper = await mountSection();
		await wrapper.get("input[type=checkbox]").setValue(true);
		await flushPromises();
		expect(invokeMock).toHaveBeenCalledWith("voice_download_model", { modelId: "tiny" });
	});

	it("downloads nothing when the developer turns the option on and the model is on the disk", async () => {
		const wrapper = await mountSection();
		await wrapper.get("input[type=checkbox]").setValue(true);
		await flushPromises();
		expect(invokeMock.mock.calls.map((call) => call[0])).not.toContain("voice_download_model");
		expect(wrapper.text()).toContain("The model is on this computer.");
	});

	it("downloads the model that the developer chooses when it is not on the disk", async () => {
		settings.voiceInput = true;
		const wrapper = await mountSection();
		await wrapper.get("#voice-input-model").setValue("large-v3");
		await flushPromises();
		expect(invokeMock).toHaveBeenCalledWith("voice_download_model", { modelId: "large-v3" });
	});

	it("shows the progress of the download with a progress bar", async () => {
		settings.voiceInput = true;
		settings.voiceInputModel = "tiny";
		const wrapper = await mountSection();
		voiceInput.download = { modelId: "tiny", receivedBytes: 25, totalBytes: 100, error: null };
		await flushPromises();
		expect(wrapper.text()).toContain("Downloading the model… 25 %");
		expect(wrapper.get("[role=progressbar]").attributes("aria-valuenow")).toBe("25");
		expect(wrapper.get(".progress-bar").attributes("style")).toContain("width: 25%");
		expect(wrapper.get("#voice-input-model").attributes("disabled")).toBeDefined();
	});

	it("shows the error of a failed download, and a button to try again", async () => {
		settings.voiceInput = true;
		settings.voiceInputModel = "tiny";
		const wrapper = await mountSection();
		voiceInput.download.error = "download_failed";
		await flushPromises();
		expect(wrapper.get("[role=alert]").text()).toContain("The download failed. Check the network.");
		invokeMock.mockClear();
		await wrapper.get("[role=alert] button").trigger("click");
		await flushPromises();
		expect(invokeMock).toHaveBeenCalledWith("voice_download_model", { modelId: "tiny" });
	});

	it("offers a button to download a model that is not on the disk", async () => {
		settings.voiceInput = true;
		settings.voiceInputModel = "tiny";
		const wrapper = await mountSection();
		expect(wrapper.text()).toContain("The model is not on this computer.");
		await wrapper.findAll("button").find((button) => button.text() === "Download the model")?.trigger("click");
		await flushPromises();
		expect(invokeMock).toHaveBeenCalledWith("voice_download_model", { modelId: "tiny" });
	});

	it("throws away a recording that runs when the developer turns the option off", async () => {
		settings.voiceInput = true;
		voiceInput.state = "recording";
		const wrapper = await mountSection();
		await wrapper.get("input[type=checkbox]").setValue(false);
		await flushPromises();
		expect(invokeMock).toHaveBeenCalledWith("voice_cancel_recording");
	});

	it("writes the sizes in French with the units Mo and Go", async () => {
		settings.language = "fr";
		const wrapper = await mountSection();
		const texts = wrapper.findAll("#voice-input-model option").map((option) => option.text());
		expect(texts[0]).toBe("tiny (78 Mo)");
		expect(texts[3]).toBe("large-v3 (3.1 Go)");
	});
});
