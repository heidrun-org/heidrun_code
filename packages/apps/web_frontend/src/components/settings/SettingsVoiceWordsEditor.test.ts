import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
	invoke: (...args: unknown[]) => invokeMock(...args),
}));

import SettingsVoiceWordsEditor from "./SettingsVoiceWordsEditor.vue";
import { settings } from "../../stores/settings";
import { voiceWords, type VoiceWord } from "../../stores/voice_words";

enableAutoUnmount(afterEach);

/** The fake file of the desktop application: the entries, and the reason why the file is not valid. */
const fakeFile: { words: VoiceWord[]; error: string | null; refusal: string | null } = { words: [], error: null, refusal: null };

/** An entry of the list. */
function makeWord(id: string, whisperWrites: string, heidrunWrites: string): VoiceWord {
	return { id, whisper_writes: whisperWrites, heidrun_writes: heidrunWrites };
}

/** The commands that change the file, with their arguments. */
function changeCalls(): unknown[][] {
	return invokeMock.mock.calls.filter((call) => call[0] !== "voice_words_read");
}

/** Mounts the editor and waits for the first read of the file. */
async function mountEditor() {
	const wrapper = mount(SettingsVoiceWordsEditor);
	await flushPromises();
	return wrapper;
}

beforeEach(() => {
	invokeMock.mockReset();
	fakeFile.words = [];
	fakeFile.error = null;
	fakeFile.refusal = null;
	invokeMock.mockImplementation(async (name: string, args: Record<string, string | null>) => {
		if (name === "voice_words_read") {
			return { words: fakeFile.words, error: fakeFile.error };
		}
		if (fakeFile.refusal !== null) {
			throw fakeFile.refusal;
		}
		if (name === "voice_words_add") {
			fakeFile.words = [...fakeFile.words, makeWord(`id-${fakeFile.words.length}`, args.whisperWrites ?? "", args.heidrunWrites ?? "")];
		} else if (name === "voice_words_update") {
			fakeFile.words = fakeFile.words.map((word) =>
				word.id === args.id
					? { ...word, whisper_writes: args.whisperWrites ?? word.whisper_writes, heidrun_writes: args.heidrunWrites ?? word.heidrun_writes }
					: word,
			);
		} else if (name === "voice_words_delete") {
			fakeFile.words = fakeFile.words.filter((word) => word.id !== args.id);
		}
		return undefined;
	});
	settings.language = "en";
	voiceWords.list = [];
	voiceWords.isRead = false;
	voiceWords.fileError = null;
	voiceWords.changeError = null;
});

describe("the word replacement list in the section Voice input", () => {
	it("says that the list is empty, in plain text, when the file has no entry", async () => {
		const wrapper = await mountEditor();
		expect(wrapper.get('[data-field="no-word"]').text()).toBe("No word in the list.");
		expect(wrapper.find("input").exists()).toBe(false);
		expect(wrapper.get('[data-option="voiceWords"]').text()).toContain("Word replacement list");
	});

	it("shows each entry with its two texts in two inputs, with the spaces at the ends of the texts", async () => {
		fakeFile.words = [makeWord("a", " at sign ", "@"), makeWord("b", "jerome", "Jérôme")];
		const wrapper = await mountEditor();
		const rows = wrapper.findAll('[data-field="word"]');
		expect(rows.length).toBe(2);
		expect((rows[0].get('[data-field="whisper-writes"]').element as HTMLInputElement).value).toBe(" at sign ");
		expect((rows[0].get('[data-field="heidrun-writes"]').element as HTMLInputElement).value).toBe("@");
		expect((rows[1].get('[data-field="heidrun-writes"]').element as HTMLInputElement).value).toBe("Jérôme");
		expect(wrapper.find('[data-field="no-word"]').exists()).toBe(false);
	});

	it("names the two texts with a visible heading and a label for the screen reader", async () => {
		fakeFile.words = [makeWord("a", "one", "1")];
		const wrapper = await mountEditor();
		expect(wrapper.get('[data-field="headings"]').text()).toContain("Whisper writes");
		expect(wrapper.get('[data-field="headings"]').text()).toContain("Heidrun Code writes instead");
		expect(wrapper.get('[data-field="whisper-writes"]').attributes("aria-label")).toBe("Whisper writes");
		expect(wrapper.get('[data-field="heidrun-writes"]').attributes("aria-label")).toBe("Heidrun Code writes instead");
	});

	it("adds an entry: the button opens a row, and the button of the row writes it", async () => {
		const wrapper = await mountEditor();
		await wrapper.get('[data-field="toggle-draft"]').trigger("click");
		expect(wrapper.get('[data-field="toggle-draft"]').text()).toBe("Cancel");
		expect(wrapper.get('[data-field="add-word"]').attributes("disabled")).toBeDefined();
		await wrapper.get('[data-field="draft-whisper-writes"]').setValue(" at sign ");
		await wrapper.get('[data-field="draft-heidrun-writes"]').setValue("@");
		expect(wrapper.get('[data-field="add-word"]').attributes("disabled")).toBeUndefined();
		await wrapper.get('[data-field="add-word"]').trigger("click");
		await flushPromises();
		expect(changeCalls()).toEqual([["voice_words_add", { whisperWrites: " at sign ", heidrunWrites: "@" }]]);
		expect(wrapper.find('[data-field="draft"]').exists()).toBe(false);
		expect(wrapper.findAll('[data-field="word"]').length).toBe(1);
		expect(wrapper.get('[data-field="toggle-draft"]').text()).toBe("Add a word");
	});

	it("adds an entry with the key Enter, and an empty text that Heidrun Code writes is allowed", async () => {
		const wrapper = await mountEditor();
		await wrapper.get('[data-field="toggle-draft"]').trigger("click");
		await wrapper.get('[data-field="draft-whisper-writes"]').setValue(" um");
		await wrapper.get('[data-field="draft-heidrun-writes"]').trigger("keydown", { key: "Enter" });
		await flushPromises();
		expect(changeCalls()).toEqual([["voice_words_add", { whisperWrites: " um", heidrunWrites: "" }]]);
	});

	it("does not add an entry whose text that Whisper writes is empty or only spaces", async () => {
		const wrapper = await mountEditor();
		await wrapper.get('[data-field="toggle-draft"]').trigger("click");
		await wrapper.get('[data-field="draft-whisper-writes"]').setValue("   ");
		await wrapper.get('[data-field="draft-whisper-writes"]').trigger("keydown", { key: "Enter" });
		await flushPromises();
		expect(changeCalls()).toEqual([]);
		expect(wrapper.get('[data-field="change-error"]').text()).toContain("The text that Whisper writes cannot be empty.");
	});

	it("cancels a new entry with the same button, and writes nothing", async () => {
		const wrapper = await mountEditor();
		await wrapper.get('[data-field="toggle-draft"]').trigger("click");
		await wrapper.get('[data-field="draft-whisper-writes"]').setValue("abc");
		await wrapper.get('[data-field="toggle-draft"]').trigger("click");
		expect(wrapper.find('[data-field="draft"]').exists()).toBe(false);
		expect(changeCalls()).toEqual([]);
	});

	it("keeps the new row open and shows the reason when the desktop application refuses the entry", async () => {
		const wrapper = await mountEditor();
		await wrapper.get('[data-field="toggle-draft"]').trigger("click");
		await wrapper.get('[data-field="draft-whisper-writes"]').setValue("one");
		fakeFile.refusal = "The entry a already has the text that Whisper writes.";
		await wrapper.get('[data-field="add-word"]').trigger("click");
		await flushPromises();
		expect(wrapper.find('[data-field="draft"]').exists()).toBe(true);
		expect(wrapper.get('[data-field="change-error"]').text()).toContain("The entry a already has the text that Whisper writes.");
	});

	it("edits the text that Heidrun Code writes when the developer leaves the input", async () => {
		fakeFile.words = [makeWord("a", "jerome", "Jerome")];
		const wrapper = await mountEditor();
		await wrapper.get('[data-field="heidrun-writes"]').setValue("Jérôme");
		await wrapper.get('[data-field="heidrun-writes"]').trigger("change");
		await flushPromises();
		expect(changeCalls()).toEqual([["voice_words_update", { id: "a", whisperWrites: null, heidrunWrites: "Jérôme" }]]);
		expect(fakeFile.words[0].heidrun_writes).toBe("Jérôme");
	});

	it("edits the text that Whisper writes, and writes nothing when the text did not change", async () => {
		fakeFile.words = [makeWord("a", "jerome", "Jérôme")];
		const wrapper = await mountEditor();
		await wrapper.get('[data-field="whisper-writes"]').trigger("change");
		expect(changeCalls()).toEqual([]);
		await wrapper.get('[data-field="whisper-writes"]').setValue("geromme");
		await wrapper.get('[data-field="whisper-writes"]').trigger("change");
		await flushPromises();
		expect(changeCalls()).toEqual([["voice_words_update", { id: "a", whisperWrites: "geromme", heidrunWrites: null }]]);
	});

	it("puts the old text back when the developer empties the text that Whisper writes", async () => {
		fakeFile.words = [makeWord("a", "jerome", "Jérôme")];
		const wrapper = await mountEditor();
		await wrapper.get('[data-field="whisper-writes"]').setValue("  ");
		await wrapper.get('[data-field="whisper-writes"]').trigger("change");
		await flushPromises();
		expect(changeCalls()).toEqual([]);
		expect((wrapper.get('[data-field="whisper-writes"]').element as HTMLInputElement).value).toBe("jerome");
		expect(wrapper.get('[data-field="change-error"]').text()).toContain("The text that Whisper writes cannot be empty.");
	});

	it("puts the old text back when the desktop application refuses the edit", async () => {
		fakeFile.words = [makeWord("a", "jerome", "Jérôme")];
		const wrapper = await mountEditor();
		fakeFile.refusal = "Refused.";
		await wrapper.get('[data-field="whisper-writes"]').setValue("other");
		await wrapper.get('[data-field="whisper-writes"]').trigger("change");
		await flushPromises();
		expect((wrapper.get('[data-field="whisper-writes"]').element as HTMLInputElement).value).toBe("jerome");
		expect(wrapper.get('[data-field="change-error"]').text()).toContain("Refused.");
	});

	it("deletes an entry with its button, named after the text that Whisper writes", async () => {
		fakeFile.words = [makeWord("a", "jerome", "Jérôme"), makeWord("b", "other", "x")];
		const wrapper = await mountEditor();
		const button = wrapper.findAll('[data-field="delete-word"]')[0];
		expect(button.attributes("aria-label")).toBe("Delete the word jerome");
		await button.trigger("click");
		await flushPromises();
		expect(changeCalls()).toEqual([["voice_words_delete", { id: "a" }]]);
		expect(wrapper.findAll('[data-field="word"]').length).toBe(1);
	});

	it("shows a change made by the command line within about one second", async () => {
		vi.useFakeTimers();
		try {
			const wrapper = mount(SettingsVoiceWordsEditor);
			await vi.advanceTimersByTimeAsync(0);
			expect(wrapper.findAll('[data-field="word"]').length).toBe(0);
			fakeFile.words = [makeWord("c", "from the command line", "x")];
			await vi.advanceTimersByTimeAsync(1000);
			expect(wrapper.findAll('[data-field="word"]').length).toBe(1);
			wrapper.unmount();
			const callCount = invokeMock.mock.calls.length;
			await vi.advanceTimersByTimeAsync(3000);
			expect(invokeMock.mock.calls.length).toBe(callCount);
		} finally {
			vi.useRealTimers();
		}
	});

	it("shows why the file cannot be used, changes nothing, and disables the inputs and the buttons", async () => {
		fakeFile.error = "The file /data/voice_words.json is not a list of entries.";
		const wrapper = await mountEditor();
		expect(wrapper.get('[data-field="file-error"]').text()).toContain("is not a list of entries");
		expect(wrapper.get('[data-field="toggle-draft"]').attributes("disabled")).toBeDefined();
		expect(wrapper.find('[data-field="no-word"]').exists()).toBe(false);
	});

	it("writes the texts in French", async () => {
		settings.language = "fr";
		fakeFile.words = [makeWord("a", "one", "1")];
		const wrapper = await mountEditor();
		expect(wrapper.get('[data-field="headings"]').text()).toContain("Whisper écrit");
		expect(wrapper.get('[data-field="headings"]').text()).toContain("Heidrun Code écrit à la place");
		expect(wrapper.get('[data-field="toggle-draft"]').text()).toBe("Ajouter un mot");
	});

	it("gives a Bootstrap form-control to every input and a name to every input and button", async () => {
		fakeFile.words = [makeWord("a", "one", "1")];
		const wrapper = await mountEditor();
		await wrapper.get('[data-field="toggle-draft"]').trigger("click");
		for (const input of wrapper.findAll("input")) {
			expect(input.classes()).toContain("form-control");
			expect(input.attributes("aria-label")).toBeTruthy();
		}
		for (const button of wrapper.findAll("button")) {
			expect(button.text() !== "" || button.attributes("aria-label") !== undefined).toBe(true);
		}
	});
});
