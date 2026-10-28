import { invoke } from "@tauri-apps/api/core";
import { voiceWords, type VoiceWord, type VoiceWordsFile } from "../stores/voice_words";

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	VoiceWords — reads the word replacement list again every second, and adds, changes, and deletes its entries (issue 836)
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** How often the window reads the file of the word replacement list again, in milliseconds. */
const READ_INTERVAL = 1000;

export class VoiceWords {
	/** The number of sections that show the list now. The file is read again every second while it is above zero. */
	private static viewerCount = 0;

	/** The timer of the reads, or null while no section shows the list. */
	private static timer: number | null = null;

	/** The number of reads that started. A read that ends after a newer read started is ignored, so an old list never wins. */
	private static readCount = 0;

	/**
	 * Starts to read the file now, and then every second. A section that shows the list calls this when it opens.
	 * @returns Resolves after the first read ended.
	 */
	static async startReading(): Promise<void> {
		VoiceWords.viewerCount++;
		if (VoiceWords.timer === null) {
			VoiceWords.timer = window.setInterval(() => void VoiceWords.read(), READ_INTERVAL);
		}
		await VoiceWords.read();
	}

	/** Stops to read the file when the last section that shows the list closes. */
	static stopReading(): void {
		VoiceWords.viewerCount = Math.max(0, VoiceWords.viewerCount - 1);
		if (VoiceWords.viewerCount === 0 && VoiceWords.timer !== null) {
			window.clearInterval(VoiceWords.timer);
			VoiceWords.timer = null;
		}
	}

	/**
	 * Reads the file of the word replacement list, and shows what another program changed in it.
	 * @returns Resolves after the list of the window is up to date.
	 */
	static async read(): Promise<void> {
		const readId = ++VoiceWords.readCount;
		let file: VoiceWordsFile;
		try {
			file = await invoke<VoiceWordsFile>("voice_words_read");
		} catch {
			return;
		}
		if (readId !== VoiceWords.readCount || Array.isArray(file?.words) === false) {
			return;
		}
		voiceWords.fileError = file.error;
		voiceWords.isRead = true;
		if (JSON.stringify(file.words) !== JSON.stringify(voiceWords.list)) {
			voiceWords.list = file.words;
		}
	}

	/**
	 * Adds an entry at the end of the list.
	 * @param whisperWrites The text that Whisper writes. It cannot be empty.
	 * @param heidrunWrites The text that Heidrun Code writes instead. It may be empty.
	 * @returns True when the entry was written. False when the desktop application refused it: the reason is in
	 * `voiceWords.changeError`.
	 */
	static async add(whisperWrites: string, heidrunWrites: string): Promise<boolean> {
		return VoiceWords.change(() => invoke<VoiceWord>("voice_words_add", { whisperWrites, heidrunWrites }));
	}

	/**
	 * Changes the texts of an entry. A text that is undefined stays as it is.
	 * @param id The identifier of the entry.
	 * @param changes The new texts.
	 * @returns True when the entry was written. False when the desktop application refused it: the reason is in
	 * `voiceWords.changeError`.
	 */
	static async update(id: string, changes: { whisperWrites?: string; heidrunWrites?: string }): Promise<boolean> {
		return VoiceWords.change(() =>
			invoke<VoiceWord>("voice_words_update", {
				id,
				whisperWrites: changes.whisperWrites ?? null,
				heidrunWrites: changes.heidrunWrites ?? null,
			}),
		);
	}

	/**
	 * Deletes an entry.
	 * @param id The identifier of the entry.
	 * @returns True when the entry was deleted. False when the desktop application refused it: the reason is in
	 * `voiceWords.changeError`.
	 */
	static async remove(id: string): Promise<boolean> {
		return VoiceWords.change(() => invoke<VoiceWord>("voice_words_delete", { id }));
	}

	/**
	 * Runs a change of the file, then reads the file again so that the list of the window is the list of the file.
	 * @param run The call of the desktop application that changes the file.
	 * @returns True when the change was written.
	 */
	private static async change(run: () => Promise<VoiceWord>): Promise<boolean> {
		voiceWords.changeError = null;
		let isWritten = true;
		try {
			await run();
		} catch (error) {
			voiceWords.changeError = String(error);
			isWritten = false;
		}
		await VoiceWords.read();
		return isWritten;
	}
}
