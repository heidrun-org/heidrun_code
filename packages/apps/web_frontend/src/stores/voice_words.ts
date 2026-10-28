import { reactive } from "vue";

/** One entry of the word replacement list of the voice input. The spaces at the ends of both texts are part of the texts. */
export type VoiceWord = {
	/** The identifier of the entry. It is the same for ever. */
	id: string;
	/** The text that Whisper writes. It is never empty. */
	whisper_writes: string;
	/** The text that Heidrun Code writes instead. It may be empty: the entry then removes the text that Whisper writes. */
	heidrun_writes: string;
};

/** What the desktop application reads from the file of the word replacement list. */
export type VoiceWordsFile = {
	/** The entries of the file, in its order. Empty when the file does not exist or is not valid. */
	words: VoiceWord[];
	/** Why the file cannot be read, or null. */
	error: string | null;
};

/** The word replacement list (issue 836). The file `voice_words.json` is the truth: the desktop application and the command line `heidrun_code_ctrl` change it. */
export const voiceWords = reactive<{
	/** The entries of the file, as last read. */
	list: VoiceWord[];
	/** True after the first read of the file ended. */
	isRead: boolean;
	/** Why the file cannot be read, or null. While it is set, the window changes nothing. */
	fileError: string | null;
	/** Why the last change was refused or failed, or null. */
	changeError: string | null;
}>({
	list: [],
	isRead: false,
	fileError: null,
	changeError: null,
});
