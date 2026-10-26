import { invoke } from "@tauri-apps/api/core";
import { watch } from "vue";
import { listen } from "@tauri-apps/api/event";
import { t } from '../i18n/index';
import { CompositionBar } from '../stores/composition_bar';
import { allPanes, tabLabel, toast, workspaceLabel } from '../stores/session';
import { settings } from "../stores/settings";
import {
	LEVEL_COUNT,
	voiceInput,
	type VoiceModel,
	type VoiceOptions,
	type VoiceTranscription,
} from "../stores/voice_input";

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	VoiceInput — the push-to-talk button (long press, or click to start and click to stop), the queue of the transcriptions,
//	and the Whisper model (issues 662 and 868)
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The name of the event with which the desktop application tells how far a download went. */
const DOWNLOAD_PROGRESS_EVENT = "voice-download-progress";

/** The name of the event with which the desktop application tells the level of the voice, 20 times a second. */
const LEVEL_EVENT = "voice-input-level";

/** A press that lasts less than this, in milliseconds, is a click: the recording goes on until the next press. */
export const LONG_PRESS_MILLISECONDS = 300;

/** What the voice input does now for one pane: the two states of the microphone, then the two states of the transcription. */
export type VoicePaneState = "idle" | "starting" | "recording" | "waiting" | "transcribing";

/** The payload of the event of the progress of a download. */
type DownloadProgressPayload = {
	/** The model that downloads. */
	modelId: string;
	/** The bytes written so far. */
	receivedBytes: number;
	/** The size of the file. */
	totalBytes: number;
};

export class VoiceInput {
	/** Changes whenever a recording starts or is cancelled, so late results cannot affect another recording. */
	private static operationId = 0;

	/** The microphone command that must finish before a cancellation can discard its recorder. */
	private static starting: Promise<void> | null = null;

	/** The cancellation that must finish before another recording can open the microphone. */
	private static cancelling: Promise<void> | null = null;

	/** The stop of the microphone that must finish before another recording can open the microphone. */
	private static stopping: Promise<number> | null = null;

	/** The number of the last transcription that entered the queue. */
	private static lastTranscriptionId = 0;

	/** True while a loop sends the recordings of the queue to Whisper, one by one. */
	private static isRunningQueue = false;

	/** How many times the voice input of each pane was cancelled, so that a send that waits for the text knows it. */
	private static cancelCounts: Record<string, number> = {};

	/** True after the web page began to listen to the events of the progress of a download. */
	private static isListening = false;

	/** True after the web page began to listen to the events of the level of the voice. */
	private static isListeningToLevels = false;

	/** The moment of the last press of the button, in milliseconds. */
	private static pressedAt = 0;

	/** What the developer did with the button before the microphone was open: nothing, a short press, or a long press. */
	private static pendingRelease: "none" | "keep" | "stop" = "none";

	/**
	 * Returns the pane whose composition bar owns the microphone.
	 * @returns The identifier of the pane, or null when the microphone is free.
	 */
	static ownerPaneId(): string | null {
		return voiceInput.ownerPaneId;
	}

	/**
	 * Tells what the voice input does now for one pane.
	 * @param paneId The identifier of the pane.
	 * @returns "starting" or "recording" while the microphone records for the pane, "waiting" or "transcribing" while its
	 * recording is in the queue of Whisper, else "idle".
	 */
	static paneState(paneId: string): VoicePaneState {
		if (voiceInput.ownerPaneId === paneId && voiceInput.state !== "idle") {
			return voiceInput.state;
		}
		return VoiceInput.transcriptionOf(paneId)?.state ?? "idle";
	}

	/**
	 * Gives the recording of one pane that waits for Whisper or that Whisper changes into text now.
	 * @param paneId The identifier of the pane.
	 * @returns The transcription, or null when the pane has none.
	 */
	static transcriptionOf(paneId: string): VoiceTranscription | null {
		return voiceInput.transcriptions.find((transcription) => transcription.paneId === paneId) ?? null;
	}

	/**
	 * Gives the category of the last error of the voice input of one pane.
	 * @param paneId The identifier of the pane.
	 * @returns The category, or null when the last recording of the pane ended well.
	 */
	static errorOf(paneId: string): string | null {
		return voiceInput.errors[paneId] ?? null;
	}

	/**
	 * Forgets the last error of the voice input of one pane.
	 * @param paneId The identifier of the pane.
	 */
	static clearError(paneId: string): void {
		delete voiceInput.errors[paneId];
	}

	/**
	 * Tells whether the microphone records for a pane of a tab, so that the tab button shows the recording icon.
	 * @param tabId The identifier of the tab.
	 * @returns True while the microphone records for a pane of the tab.
	 */
	static isRecordingInTab(tabId: string): boolean {
		return VoiceInput.recordingPane()?.tab_id === tabId;
	}

	/**
	 * Tells whether the microphone records for a pane of a workspace, so that the workspace button shows the recording icon.
	 * @param workspaceId The identifier of the workspace.
	 * @returns True while the microphone records for a pane of the workspace.
	 */
	static isRecordingInWorkspace(workspaceId: string): boolean {
		return VoiceInput.recordingPane()?.workspace_id === workspaceId;
	}

	/**
	 * Reads the options of the desktop application, and listens to the progress of the downloads. It reads a list of files
	 * and opens no microphone.
	 */
	static async loadOptions(): Promise<void> {
		if (VoiceInput.isListening === false) {
			VoiceInput.isListening = true;
			await listen<DownloadProgressPayload>(DOWNLOAD_PROGRESS_EVENT, (event) => {
				voiceInput.download.modelId = event.payload.modelId;
				voiceInput.download.receivedBytes = event.payload.receivedBytes;
				voiceInput.download.totalBytes = event.payload.totalBytes;
			});
		}
		const options = await invoke<VoiceOptions | null>("voice_options");
		if (options !== null && options !== undefined) {
			voiceInput.options = options;
		}
	}

	/**
	 * The model that the developer chose, with its state on the disk.
	 * @returns The model, or null before the options are read.
	 */
	static chosenModel(): VoiceModel | null {
		const models = voiceInput.options?.models ?? [];
		return models.find((model) => model.id === settings.voiceInputModel) ?? null;
	}

	/**
	 * The chosen model is on the disk, so a recording can change into text.
	 * @returns True when the push-to-talk button can work.
	 */
	static isModelReady(): boolean {
		return VoiceInput.chosenModel()?.isDownloaded === true;
	}

	/**
	 * The progress of the download of the chosen model.
	 * @returns A whole number from 0 to 100, or null when the chosen model does not download.
	 */
	static downloadPercent(): number | null {
		const download = voiceInput.download;
		if (download.modelId === null || download.modelId !== settings.voiceInputModel || download.totalBytes === 0) {
			return null;
		}
		return Math.min(100, Math.floor((download.receivedBytes / download.totalBytes) * 100));
	}

	/**
	 * Downloads a model. The progress is in `voiceInput.download`. A failure keeps its category in `voiceInput.download.error`.
	 * @param modelId The identifier of the model.
	 */
	static async downloadModel(modelId: string): Promise<void> {
		if (voiceInput.download.modelId !== null) {
			return;
		}
		voiceInput.download.modelId = modelId;
		voiceInput.download.receivedBytes = 0;
		voiceInput.download.totalBytes = 0;
		voiceInput.download.error = null;
		try {
			await invoke("voice_download_model", { modelId });
		} catch (error) {
			voiceInput.download.error = String(error);
		}
		voiceInput.download.modelId = null;
		try {
			await VoiceInput.loadOptions();
		} catch {
			// The state of the files stays as it was.
		}
	}

	/** Downloads the chosen model when it is not on the disk and does not download now. */
	static async ensureChosenModel(): Promise<void> {
		if (settings.voiceInput === false || voiceInput.options === null) {
			return;
		}
		const model = VoiceInput.chosenModel();
		if (model === null || model.isDownloaded === true || voiceInput.download.modelId !== null) {
			return;
		}
		await VoiceInput.downloadModel(model.id);
	}

	/**
	 * The developer presses the push-to-talk button in a pane's composition bar. The microphone records for that pane.
	 * With a recording that a click started, this press stops it and writes the text. Nothing happens when the option is off,
	 * when the model is not on the disk, or while the recording of the same pane waits for Whisper or changes into text. A press
	 * in another pane while the microphone records shows a notification that names the tab that records, and the recording goes
	 * on (issue 762).
	 * @param paneId The identifier of the pane whose push-to-talk button was pressed.
	 * @returns Resolves when the press has started or stopped a recording.
	 */
	static async press(paneId: string): Promise<void> {
		if (VoiceInput.transcriptionOf(paneId) !== null) {
			return;
		}
		if (voiceInput.state !== "idle" && voiceInput.ownerPaneId !== paneId) {
			toast(VoiceInput.recordingElsewhereText());
			return;
		}
		if (voiceInput.state === "recording" && voiceInput.isLatched === true) {
			await VoiceInput.stopAndWrite();
			return;
		}
		await VoiceInput.startRecording(paneId);
	}

	/**
	 * The developer releases the push-to-talk button. After a long press, this is the end of the push to talk: the recording stops
	 * and the text is written. After a short press, which is a click, the recording goes on until the next press.
	 * @param isForced True when the window lost the keyboard: the recording then stops, whatever the length of the press.
	 * @param paneId The identifier of the pane whose button was released, or undefined for a window release event.
	 * @returns Resolves when the release has been handled.
	 */
	static async release(isForced = false, paneId?: string): Promise<void> {
		if (paneId !== undefined && voiceInput.ownerPaneId !== paneId) {
			return;
		}
		const isShort = isForced === false && Date.now() - VoiceInput.pressedAt < LONG_PRESS_MILLISECONDS;
		if (voiceInput.state === "starting") {
			VoiceInput.pendingRelease = isShort ? "keep" : "stop";
			return;
		}
		if (voiceInput.state !== "recording" || voiceInput.isLatched === true) {
			return;
		}
		if (isShort) {
			VoiceInput.keepRecording();
			return;
		}
		await VoiceInput.stopAndWrite();
	}

	/**
	 * Stops the recording, frees the microphone at once, and puts the recording at the end of the queue of Whisper. Whisper changes
	 * the recordings of the queue into text one by one, in their order, and each text goes at the end of the text of the composition
	 * bar that started its recording. A recording with no speech adds nothing and shows no error.
	 * @returns Resolves after the text has been written or an error has been saved, or earlier when the recording waits for the
	 * transcription of another composition bar.
	 */
	static async stopAndWrite(): Promise<void> {
		const paneId = voiceInput.ownerPaneId;
		if (voiceInput.state !== "recording" || paneId === null) {
			return;
		}
		VoiceInput.stopListeningToRelease();
		VoiceInput.lastTranscriptionId += 1;
		const transcriptionId = VoiceInput.lastTranscriptionId;
		voiceInput.transcriptions.push({
			id: transcriptionId,
			paneId,
			recordingId: null,
			state: "waiting",
			recordingSeconds: Math.max(0, Math.floor((Date.now() - voiceInput.startedAt) / 1000)),
		});
		voiceInput.isLatched = false;
		voiceInput.state = "idle";
		voiceInput.ownerPaneId = null;
		const stopping = invoke<number>("voice_stop_recording");
		VoiceInput.stopping = stopping;
		let recordingId: number;
		try {
			recordingId = await stopping;
		} catch (error) {
			if (VoiceInput.removeTranscription(transcriptionId) === true) {
				voiceInput.errors[paneId] = String(error);
			}
			await VoiceInput.runQueue();
			return;
		} finally {
			if (VoiceInput.stopping === stopping) {
				VoiceInput.stopping = null;
			}
		}
		const transcription = VoiceInput.findTranscription(transcriptionId);
		if (transcription === null) {
			await VoiceInput.discardStoppedRecording(recordingId);
			return;
		}
		transcription.recordingId = recordingId;
		await VoiceInput.runQueue();
	}

	/**
	 * Makes sure that no recording runs and no speech of a pane waits to change into text. A recording that runs stops, Whisper
	 * changes the speech into text, and the text goes in the composition bar. The button "Send" calls this first, so that the text
	 * of the speech goes with the message.
	 * @param paneId The identifier of the pane whose message is being sent.
	 * @returns True when nothing was running, or when the recording ended well. False when the recording or the change into text
	 * failed, or was cancelled: the category of an error is in `voiceInput.errors`.
	 */
	static async settle(paneId: string): Promise<boolean> {
		if (VoiceInput.paneState(paneId) === "idle") {
			return true;
		}
		const cancelCount = VoiceInput.cancelCounts[paneId] ?? 0;
		VoiceInput.clearError(paneId);
		if (voiceInput.ownerPaneId === paneId && voiceInput.state === "starting") {
			VoiceInput.pendingRelease = "stop";
		} else if (voiceInput.ownerPaneId === paneId && voiceInput.state === "recording") {
			void VoiceInput.stopAndWrite();
		}
		await VoiceInput.waitForIdle(paneId);
		return cancelCount === (VoiceInput.cancelCounts[paneId] ?? 0) && VoiceInput.errorOf(paneId) === null;
	}

	/**
	 * Cancels recording, a waiting transcription, or a transcription without changing the draft. Late text and errors are
	 * discarded, and a waiting transcription leaves the queue.
	 * @param paneId The pane that owns the operation, or undefined to cancel every operation.
	 * @returns Resolves after the microphone has been released for another recording.
	 */
	static async cancel(paneId?: string): Promise<void> {
		const isOwner = voiceInput.state !== "idle" && (paneId === undefined || voiceInput.ownerPaneId === paneId);
		const cancelled = voiceInput.transcriptions.filter(
			(transcription) => paneId === undefined || transcription.paneId === paneId,
		);
		if (isOwner === false && cancelled.length === 0) {
			await VoiceInput.cancelling;
			return;
		}
		for (const transcription of cancelled) {
			VoiceInput.countCancel(transcription.paneId);
			VoiceInput.clearError(transcription.paneId);
			VoiceInput.removeTranscription(transcription.id);
			if (transcription.state === "waiting" && transcription.recordingId !== null) {
				void VoiceInput.discardStoppedRecording(transcription.recordingId);
			}
		}
		if (isOwner === false) {
			await VoiceInput.runQueue();
			return;
		}
		const ownerPaneId = voiceInput.ownerPaneId;
		if (ownerPaneId !== null) {
			VoiceInput.countCancel(ownerPaneId);
			VoiceInput.clearError(ownerPaneId);
		}
		VoiceInput.operationId += 1;
		VoiceInput.stopListeningToRelease();
		VoiceInput.pendingRelease = "none";
		voiceInput.isLatched = false;
		const cancelling = VoiceInput.discardRecording();
		VoiceInput.cancelling = cancelling;
		voiceInput.state = "idle";
		voiceInput.ownerPaneId = null;
		await cancelling;
		if (VoiceInput.cancelling === cancelling) {
			VoiceInput.cancelling = null;
		}
	}

	/**
	 * Writes a text at the end of the text of a composition bar, after one space when the bar already has a text. A bar that was
	 * closed during the change keeps nothing: closing the bar removes the text.
	 * @param paneId The identifier of the pane whose composition bar started the recording.
	 * @param text The text that Whisper gave. It can be empty.
	 * @returns Nothing.
	 */
	static appendToCompositionBar(paneId: string, text: string): void {
		const spoken = text.trim();
		if (spoken === "") {
			return;
		}
		const compositionBar = CompositionBar.forPane(paneId);
		if (compositionBar.isOpen === false) {
			return;
		}
		const current = compositionBar.text;
		const separator = current === "" || /\s$/.test(current) ? "" : " ";
		compositionBar.text = `${current}${separator}${spoken}`;
	}

	/**
	 * Opens the composition bar and the microphone. The recording ends at the release of a long press, or at the next press after
	 * a short press.
	 * @param paneId The identifier of the pane whose push-to-talk button started the recording.
	 * @returns Resolves after the microphone starts or reports an error.
	 */
	private static async startRecording(paneId: string): Promise<void> {
		if (VoiceInput.cancelling !== null) {
			await VoiceInput.cancelling;
			VoiceInput.cancelling = null;
		}
		if (VoiceInput.stopping !== null) {
			await VoiceInput.stopping.catch(() => {});
		}
		if (settings.voiceInput === false || voiceInput.state !== "idle" || VoiceInput.transcriptionOf(paneId) !== null) {
			return;
		}
		if (VoiceInput.isModelReady() === false) {
			voiceInput.errors[paneId] = "model_missing";
			return;
		}
		VoiceInput.operationId += 1;
		const operationId = VoiceInput.operationId;
		VoiceInput.clearError(paneId);
		voiceInput.ownerPaneId = paneId;
		voiceInput.state = "starting";
		voiceInput.isLatched = false;
		voiceInput.levels = [];
		VoiceInput.pendingRelease = "none";
		VoiceInput.pressedAt = Date.now();
		voiceInput.startedAt = VoiceInput.pressedAt;
		CompositionBar.forPane(paneId).isOpen = true;
		VoiceInput.listenToRelease();
		try {
			await VoiceInput.listenToLevels();
			if (operationId !== VoiceInput.operationId) {
				return;
			}
			VoiceInput.starting = invoke<void>('voice_start_recording');
			await VoiceInput.starting;
		} catch (error) {
			if (operationId !== VoiceInput.operationId) {
				return;
			}
			VoiceInput.stopListeningToRelease();
			voiceInput.errors[paneId] = String(error);
			voiceInput.state = "idle";
			voiceInput.ownerPaneId = null;
			return;
		}
		if (operationId !== VoiceInput.operationId || voiceInput.state !== 'starting') {
			return;
		}
		voiceInput.state = "recording";
		const pendingRelease = VoiceInput.takePendingRelease();
		if (pendingRelease === "stop") {
			await VoiceInput.stopAndWrite();
		} else if (pendingRelease === "keep") {
			VoiceInput.keepRecording();
		}
	}

	/**
	 * Sends the recordings of the queue to Whisper one by one, in their order, until the queue is empty or its first recording is
	 * still stopping. Only one loop runs at a time.
	 * @returns Resolves when this loop ends, or at once when another loop runs.
	 */
	private static async runQueue(): Promise<void> {
		if (VoiceInput.isRunningQueue === true) {
			return;
		}
		VoiceInput.isRunningQueue = true;
		try {
			for (;;) {
				const transcription = voiceInput.transcriptions[0];
				if (transcription === undefined || transcription.recordingId === null) {
					return;
				}
				await VoiceInput.transcribe(transcription);
			}
		} finally {
			VoiceInput.isRunningQueue = false;
		}
	}

	/**
	 * Changes one recording of the queue into text, writes the text in its composition bar, and takes the recording out of the
	 * queue. A transcription that was cancelled meanwhile writes nothing.
	 * @param transcription The first transcription of the queue, with the number of its recording.
	 * @returns Resolves after the text has been written or an error has been saved.
	 */
	private static async transcribe(transcription: VoiceTranscription): Promise<void> {
		const { id, paneId, recordingId } = transcription;
		transcription.state = "transcribing";
		try {
			const text = await invoke<string>("voice_transcribe_recording", {
				recordingId,
				modelId: settings.voiceInputModel,
				language: settings.voiceInputLanguage,
			});
			if (VoiceInput.findTranscription(id) !== null) {
				VoiceInput.appendToCompositionBar(paneId, text);
				VoiceInput.clearError(paneId);
				VoiceInput.removeTranscription(id);
			}
		} catch (error) {
			if (VoiceInput.findTranscription(id) !== null) {
				voiceInput.errors[paneId] = String(error);
				VoiceInput.removeTranscription(id);
			}
		}
	}

	/**
	 * Gives the transcription with a number, as the reactive object of the queue.
	 * @param transcriptionId The number of the transcription.
	 * @returns The transcription, or null when it left the queue.
	 */
	private static findTranscription(transcriptionId: number): VoiceTranscription | null {
		return voiceInput.transcriptions.find((transcription) => transcription.id === transcriptionId) ?? null;
	}

	/**
	 * Takes a transcription out of the queue.
	 * @param transcriptionId The number of the transcription.
	 * @returns True when the transcription was in the queue.
	 */
	private static removeTranscription(transcriptionId: number): boolean {
		const index = voiceInput.transcriptions.findIndex((transcription) => transcription.id === transcriptionId);
		if (index === -1) {
			return false;
		}
		voiceInput.transcriptions.splice(index, 1);
		return true;
	}

	/**
	 * Throws away a stopped recording that will never change into text.
	 * @param recordingId The number that the desktop application gave to the recording.
	 * @returns Resolves after the command, also when it fails.
	 */
	private static async discardStoppedRecording(recordingId: number): Promise<void> {
		try {
			await invoke("voice_discard_recording", { recordingId });
		} catch {
			// There is nothing left to throw away.
		}
	}

	/**
	 * Counts one cancellation of the voice input of a pane.
	 * @param paneId The identifier of the pane.
	 */
	private static countCancel(paneId: string): void {
		VoiceInput.cancelCounts[paneId] = (VoiceInput.cancelCounts[paneId] ?? 0) + 1;
	}

	/**
	 * Gives the pane for which the microphone records now.
	 * @returns The pane, or null when the microphone is free, the option is off, or Herdr does not know the pane.
	 */
	private static recordingPane(): { tab_id: string; workspace_id: string } | null {
		if (settings.voiceInput === false || voiceInput.state === "idle" || voiceInput.ownerPaneId === null) {
			return null;
		}
		return allPanes.value.find((pane) => pane.pane_id === voiceInput.ownerPaneId) ?? null;
	}

	/**
	 * The text of the notification of a press while the microphone records for another composition bar: it names the tab that
	 * records and its workspace.
	 * @returns The translated text.
	 */
	private static recordingElsewhereText(): string {
		const pane = VoiceInput.recordingPane();
		if (pane === null) {
			return t("voiceInput.recordingElsewhere");
		}
		return t("voiceInput.recordingInWorkspaceTab", {
			tab: tabLabel(pane.tab_id),
			workspace: workspaceLabel(pane.workspace_id),
		});
	}

	/**
	 * Waits for an opening microphone before discarding it. Starting another recording waits for this command.
	 * @returns Resolves after the discard command, including when the microphone failed to open.
	 */
	private static async discardRecording(): Promise<void> {
		try {
			await VoiceInput.starting;
		} catch {
			// A microphone that failed to open has no audio to keep.
		}
		VoiceInput.starting = null;
		try {
			await invoke('voice_cancel_recording');
		} catch {
			// There is nothing left to throw away.
		}
	}

	/** Starts, once, to keep the last levels of the voice in `voiceInput.levels` while the microphone records. */
	private static async listenToLevels(): Promise<void> {
		if (VoiceInput.isListeningToLevels === true) {
			return;
		}
		VoiceInput.isListeningToLevels = true;
		await listen<number>(LEVEL_EVENT, (event) => {
			if (voiceInput.state !== "recording" && voiceInput.state !== "starting") {
				return;
			}
			voiceInput.levels = [...voiceInput.levels, event.payload].slice(-LEVEL_COUNT);
		});

	}

	/**
	 * Waits until the voice input of a pane is "idle": no recording and no transcription.
	 * @param paneId The identifier of the pane.
	 * @returns A promise that resolves at once when the pane is already "idle".
	 */
	private static waitForIdle(paneId: string): Promise<void> {
		if (VoiceInput.paneState(paneId) === "idle") {
			return Promise.resolve();
		}
		return new Promise((resolve) => {
			const stopWatching = watch(
				() => VoiceInput.paneState(paneId),
				(paneState) => {
					if (paneState === "idle") {
						stopWatching();
						resolve();
					}
				},
				{ flush: "sync" },
			);
		});
	}

	/** The recording goes on after the release: the pointer and the loss of the keyboard no longer end it. */
	private static keepRecording(): void {
		VoiceInput.stopListeningToRelease();
		voiceInput.isLatched = true;
	}

	/**
	 * Reads and clears what the developer did with the button while the microphone was opening.
	 * @returns "stop" after a long press, "keep" after a short press, and "none" while the button is still down.
	 */
	private static takePendingRelease(): "none" | "keep" | "stop" {
		const pendingRelease = VoiceInput.pendingRelease;
		VoiceInput.pendingRelease = "none";
		return pendingRelease;
	}

	/** Hears the release of the pointer anywhere in the window, and the loss of the keyboard by the window. */
	private static listenToRelease(): void {
		window.addEventListener("pointerup", VoiceInput.onPointerRelease, true);
		window.addEventListener("pointercancel", VoiceInput.onPointerRelease, true);
		window.addEventListener("blur", VoiceInput.onBlur);
	}

	private static stopListeningToRelease(): void {
		window.removeEventListener("pointerup", VoiceInput.onPointerRelease, true);
		window.removeEventListener("pointercancel", VoiceInput.onPointerRelease, true);
		window.removeEventListener("blur", VoiceInput.onBlur);
	}

	private static onPointerRelease = (): void => {
		void VoiceInput.release();
	};

	private static onBlur = (): void => {
		void VoiceInput.release(true);
	};
}
