import { reactive } from "vue";

/** One Whisper model, as the desktop application describes it. */
export type VoiceModel = {
	/** The identifier of the model, for example `base`. */
	id: string;
	/** The size of the model file, in bytes. */
	sizeBytes: number;
	/** The model understands only English. */
	isEnglishOnly: boolean;
	/** The model file is on the disk, complete. */
	isDownloaded: boolean;
};

/** What the desktop application offers for the voice input. */
export type VoiceOptions = {
	/** The 12 models, in the order of the list. */
	models: VoiceModel[];
	/** The two-letter codes of the languages, without the automatic choice. */
	languages: string[];
	/** The identifier of the model that Heidrun Code proposes first. */
	defaultModelId: string;
};

/** How many levels the level bars show. With one level every 50 milliseconds, the bars show the last two seconds. */
export const LEVEL_COUNT = 40;

/** The state of the single shared voice input recorder (issues 662 and 712). */
export const voiceInput = reactive<{
	/** The pane whose composition bar owns the current or most recent recording, or null before the first recording. */
	ownerPaneId: string | null;
	/** The options of the desktop application, or null before the first read. */
	options: VoiceOptions | null;
	/**
	 * What the push-to-talk button does now: "idle" waits, "starting" opens the microphone, "recording" listens while the
	 * developer holds the button, and "transcribing" changes the speech into text.
	 */
	state: "idle" | "starting" | "recording" | "transcribing";
	/** A click started the recording: it goes on until the next press of the button, even if the pointer is elsewhere. */
	isLatched: boolean;
	/** The moment at which the last recording started, in milliseconds since 1970. The composition bar shows the time since then. */
	startedAt: number;
	/** The level of the voice (from 0 to 1) at each of the last moments of the recording, the newest last. */
	levels: number[];
	/** The category of the last error of a recording, or null. The push-to-talk button shows a text for it. */
	error: string | null;
	/** The download of a model: the model that downloads, how far it went, and the category of its last error. */
	download: {
		/** The identifier of the model that downloads now, or null. */
		modelId: string | null;
		/** The bytes written so far. */
		receivedBytes: number;
		/** The size of the file. */
		totalBytes: number;
		/** The category of the last error of a download, or null. */
		error: string | null;
	};
}>({
	ownerPaneId: null,
	options: null,
	state: "idle",
	isLatched: false,
	startedAt: 0,
	levels: [],
	error: null,
	download: {
		modelId: null,
		receivedBytes: 0,
		totalBytes: 0,
		error: null,
	},
});
