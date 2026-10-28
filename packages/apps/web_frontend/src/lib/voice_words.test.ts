import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { invokeMock } = vi.hoisted(() => ({
	invokeMock: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@tauri-apps/api/core", () => ({
	invoke: (...args: unknown[]) => invokeMock(...args),
}));

import { VoiceWords } from "./voice_words";
import { voiceWords, type VoiceWord } from "../stores/voice_words";

/** An entry of the list. */
function makeWord(id: string, whisperWrites: string, heidrunWrites: string): VoiceWord {
	return { id, whisper_writes: whisperWrites, heidrun_writes: heidrunWrites };
}

/** The names of the commands that the web page sent to the desktop application, in order. */
function commandNames(): string[] {
	return invokeMock.mock.calls.map((call) => call[0] as string);
}

beforeEach(() => {
	vi.useFakeTimers();
	invokeMock.mockReset();
	voiceWords.list = [];
	voiceWords.isRead = false;
	voiceWords.fileError = null;
	voiceWords.changeError = null;
});

afterEach(() => {
	VoiceWords.stopReading();
	vi.useRealTimers();
});

describe("VoiceWords.read", () => {
	it("shows the entries of the file, with the spaces at the ends of the texts", async () => {
		invokeMock.mockResolvedValue({ words: [makeWord("a", " at sign ", "@")], error: null });
		await VoiceWords.read();
		expect(voiceWords.list).toEqual([makeWord("a", " at sign ", "@")]);
		expect(voiceWords.isRead).toBe(true);
		expect(voiceWords.fileError).toBeNull();
	});

	it("shows why the file cannot be used, and no entry", async () => {
		invokeMock.mockResolvedValue({ words: [], error: "The file is not a list." });
		await VoiceWords.read();
		expect(voiceWords.list).toEqual([]);
		expect(voiceWords.fileError).toBe("The file is not a list.");
	});

	it("keeps the same list object when the file did not change, so nothing is drawn again", async () => {
		invokeMock.mockResolvedValue({ words: [makeWord("a", "one", "1")], error: null });
		await VoiceWords.read();
		const first = voiceWords.list;
		invokeMock.mockResolvedValue({ words: [makeWord("a", "one", "1")], error: null });
		await VoiceWords.read();
		expect(voiceWords.list).toBe(first);
	});

	it("ignores an answer that is not the answer of the desktop application", async () => {
		invokeMock.mockResolvedValue([]);
		await VoiceWords.read();
		expect(voiceWords.isRead).toBe(false);
	});

	it("ignores a failed read and keeps the list", async () => {
		voiceWords.list = [makeWord("a", "one", "1")];
		invokeMock.mockRejectedValue("boom");
		await VoiceWords.read();
		expect(voiceWords.list).toEqual([makeWord("a", "one", "1")]);
	});

	it("ignores an old read that ends after a newer read started", async () => {
		let finishOld: (file: unknown) => void = () => {};
		invokeMock.mockImplementationOnce(() => new Promise((resolve) => (finishOld = resolve)));
		const oldRead = VoiceWords.read();
		invokeMock.mockResolvedValueOnce({ words: [makeWord("b", "new", "2")], error: null });
		await VoiceWords.read();
		finishOld({ words: [makeWord("a", "old", "1")], error: null });
		await oldRead;
		expect(voiceWords.list).toEqual([makeWord("b", "new", "2")]);
	});
});

describe("VoiceWords.startReading and VoiceWords.stopReading", () => {
	it("reads at once, then every second, and stops when the last section closes", async () => {
		invokeMock.mockResolvedValue({ words: [], error: null });
		await VoiceWords.startReading();
		await VoiceWords.startReading();
		expect(commandNames()).toEqual(["voice_words_read", "voice_words_read"]);
		await vi.advanceTimersByTimeAsync(1000);
		expect(commandNames().length).toBe(3);
		VoiceWords.stopReading();
		await vi.advanceTimersByTimeAsync(1000);
		expect(commandNames().length).toBe(4);
		VoiceWords.stopReading();
		await vi.advanceTimersByTimeAsync(5000);
		expect(commandNames().length).toBe(4);
	});

	it("shows a change that another program made in the file within one second", async () => {
		invokeMock.mockResolvedValue({ words: [], error: null });
		await VoiceWords.startReading();
		invokeMock.mockResolvedValue({ words: [makeWord("c", "from the command line", "x")], error: null });
		await vi.advanceTimersByTimeAsync(1000);
		expect(voiceWords.list.map((word) => word.id)).toEqual(["c"]);
	});
});

describe("VoiceWords.add, VoiceWords.update, and VoiceWords.remove", () => {
	it("sends the texts as they are, then reads the file again", async () => {
		invokeMock.mockImplementation(async (name: string) => (name === "voice_words_read" ? { words: [makeWord("a", " at sign ", "@")], error: null } : undefined));
		expect(await VoiceWords.add(" at sign ", "@")).toBe(true);
		expect(invokeMock.mock.calls[0]).toEqual(["voice_words_add", { whisperWrites: " at sign ", heidrunWrites: "@" }]);
		expect(commandNames()).toEqual(["voice_words_add", "voice_words_read"]);
		expect(voiceWords.list).toEqual([makeWord("a", " at sign ", "@")]);
	});

	it("sends only the text that changes, and null for the other", async () => {
		invokeMock.mockResolvedValue({ words: [], error: null });
		expect(await VoiceWords.update("a", { heidrunWrites: "" })).toBe(true);
		expect(invokeMock.mock.calls[0]).toEqual(["voice_words_update", { id: "a", whisperWrites: null, heidrunWrites: "" }]);
		await VoiceWords.update("a", { whisperWrites: "new" });
		expect(invokeMock.mock.calls[2]).toEqual(["voice_words_update", { id: "a", whisperWrites: "new", heidrunWrites: null }]);
	});

	it("deletes an entry by its id", async () => {
		invokeMock.mockResolvedValue({ words: [], error: null });
		expect(await VoiceWords.remove("a")).toBe(true);
		expect(invokeMock.mock.calls[0]).toEqual(["voice_words_delete", { id: "a" }]);
	});

	it("keeps the reason of a refused change, returns false, and still reads the file again", async () => {
		invokeMock.mockImplementation(async (name: string) => {
			if (name === "voice_words_read") {
				return { words: [makeWord("a", "one", "1")], error: null };
			}
			throw "The entry a already has the text that Whisper writes.";
		});
		expect(await VoiceWords.add("one", "x")).toBe(false);
		expect(voiceWords.changeError).toBe("The entry a already has the text that Whisper writes.");
		expect(commandNames()).toEqual(["voice_words_add", "voice_words_read"]);
		invokeMock.mockResolvedValue({ words: [], error: null });
		await VoiceWords.remove("a");
		expect(voiceWords.changeError).toBeNull();
	});
});
