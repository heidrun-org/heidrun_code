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

/** A recording that stopped and waits for Whisper, or that Whisper changes into text now (issue 868). */
export type VoiceTranscription = {
	/** The number that the web page gives to this transcription. */
	id: number;
	/** The pane whose composition bar started the recording: the text goes there. */
	paneId: string;
	/** The number that the desktop application gave to the stopped recording, or null while the microphone stops. */
	recordingId: number | null;
	/** "waiting" waits for Whisper, which works for another composition bar. "transcribing" changes the speech into text now. */
	state: "waiting" | "transcribing";
	/** The length of the recording, in whole seconds, which the composition bar shows. */
	recordingSeconds: number;
};

/** The state of the single shared voice input recorder and of the transcriptions (issues 662, 712, and 868). */
export const voiceInput = reactive<{
	/** The pane whose composition bar owns the microphone, or null when the microphone is free. */
	ownerPaneId: string | null;
	/** The options of the desktop application, or null before the first read. */
	options: VoiceOptions | null;
	/**
	 * What the microphone does now: "idle" waits, "starting" opens the microphone, and "recording" listens while the developer
	 * holds the button, or until the next click.
	 */
	state: "idle" | "starting" | "recording";
	/** The recordings that wait for Whisper or that Whisper changes into text now, in the order of the recordings. */
	transcriptions: VoiceTranscription[];
	/** A click started the recording: it goes on until the next press of the button, even if the pointer is elsewhere. */
	isLatched: boolean;
	/** The moment at which the last recording started, in milliseconds since 1970. The composition bar shows the time since then. */
	startedAt: number;
	/** The level of the voice (from 0 to 1) at each of the last moments of the recording, the newest last. */
	levels: number[];
	/** The category of the last error of the voice input of each pane, by pane identifier. The composition bar shows a text for it. */
	errors: Record<string, string>;
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
	transcriptions: [],
	isLatched: false,
	startedAt: 0,
	levels: [],
	errors: {},
	download: {
		modelId: null,
		receivedBytes: 0,
		totalBytes: 0,
		error: null,
	},
});
