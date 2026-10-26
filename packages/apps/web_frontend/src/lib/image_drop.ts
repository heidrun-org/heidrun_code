import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { VoiceInput } from "./voice_input";
import { CompositionBar } from '../stores/composition_bar';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	ImageDrop — collects image files in the composition bar, and pastes them in a terminal
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The result of one drop on the window, or of one choice in the file picker. */
export type ImageDropResult = "added" | "duplicate" | "not_an_image";

/** The result of the paste of the composition bar in one terminal. */
export type ImagePasteResult = {
	/** How many images, from the first one, are in the terminal. */
	pastedCount: number;
	/** What happened to the paste. */
	result: "pasted" | "failed" | "no_terminal";
};

/** Writes a text to one terminal. */
export type TerminalWriter = (data: string) => Promise<void>;

/** The Control+V key, as the byte that a terminal sends. */
const CONTROL_V = "\x16";

/** The file extensions that Heidrun Code accepts as images. The same list is in `clipboard.rs`. */
const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "heic", "tif", "tiff", "bmp"];

/** The wait between two pastes, in milliseconds: a coding agent reads one clipboard image at a time. */
export const PASTE_DELAY_MS = 500;

/** The longest side of a small picture, in pixels: twice the size on the screen, for a screen with a high pixel density. */
const THUMBNAIL_LONGEST_SIDE = 256;

/** The longest side of a picture of the big view, in pixels. */
const PREVIEW_LONGEST_SIDE = 1600;

export class ImageDrop {
	/** Writer of every mounted terminal, keyed by the identifier of its pane. */
	private static writers = new Map<string, TerminalWriter>();

	/**
	 * Makes the terminal of a pane a valid target for the paste of the composition bar.
	 * @param paneId The identifier of the pane.
	 * @param writer Writes a text to the terminal.
	 */
	static register(paneId: string, writer: TerminalWriter): void {
		ImageDrop.writers.set(paneId, writer);
	}

	/**
	 * Removes the terminal of a pane from the valid targets.
	 * @param paneId The identifier of the pane.
	 */
	static unregister(paneId: string): void {
		ImageDrop.writers.delete(paneId);
	}

	/**
	 * Tells if a path has the extension of an image file.
	 * @param path A file path.
	 * @returns True when the extension is one of the image extensions, in any letter case.
	 */
	static isImagePath(path: string): boolean {
		const dotIndex = path.lastIndexOf(".");
		if (dotIndex === -1 || path.indexOf("/", dotIndex) !== -1) {
			return false;
		}
		return IMAGE_EXTENSIONS.includes(path.slice(dotIndex + 1).toLowerCase());
	}

	/**
	 * Adds the image files of a drop to the composition bar, and opens the composition bar. A file that is not an image
	 * is ignored. A file already in the composition bar is not added twice, which also ignores a drop that the window
	 * delivers twice.
	 * @param paneId The identifier of the pane that owns the composition bar.
	 * @param paths Absolute paths of the dropped files.
	 * @returns "added" when at least one image is new, "duplicate" when every image is already in the composition bar,
	 * and "not_an_image" when no file is an image.
	 */
	static handleDrop(paneId: string, paths: string[]): ImageDropResult {
		const imagePaths = paths.filter((path) => ImageDrop.isImagePath(path));
		if (imagePaths.length === 0) {
			return "not_an_image";
		}
		const compositionBar = CompositionBar.forPane(paneId);
		compositionBar.isOpen = true;
		const newPaths = [...new Set(imagePaths)].filter((path) => compositionBar.paths.includes(path) === false);
		if (newPaths.length === 0) {
			return "duplicate";
		}
		compositionBar.paths.push(...newPaths);
		return "added";
	}

	/**
	 * Opens the file picker of the system, then adds the chosen image files to the composition bar.
	 * @param paneId The identifier of the pane that opened the file picker.
	 * @returns What happened to the chosen files, or null when the developer closed the file picker with no choice.
	 */
	static async pickImages(paneId: string): Promise<ImageDropResult | null> {
		const chosen = await openDialog({
			multiple: true,
			directory: false,
			filters: [{ name: "Images", extensions: IMAGE_EXTENSIONS }],
		});
		if (chosen === null || chosen.length === 0) {
			return null;
		}
		return ImageDrop.handleDrop(paneId, chosen);
	}

	/**
	 * Removes one image from the composition bar. The big view follows: it moves to the next image, or closes when no
	 * image is left.
	 * @param paneId The identifier of the pane that owns the image.
	 * @param path The path of the image.
	 * @returns Nothing.
	 */
	static remove(paneId: string, path: string): void {
		const compositionBar = CompositionBar.forPane(paneId);
		compositionBar.paths = compositionBar.paths.filter((imagePath) => imagePath !== path);
		delete compositionBar.thumbnails[path];
		delete compositionBar.previews[path];
		if (compositionBar.viewerIndex !== null) {
			compositionBar.viewerIndex =
				compositionBar.paths.length === 0 ? null : Math.min(compositionBar.viewerIndex, compositionBar.paths.length - 1);
		}
	}

	/**
	 * Closes this pane's composition bar, removes its images and text, closes its big view, and throws away a running voice
	 * input recording.
	 * @param paneId The identifier of the pane whose composition bar closes.
	 * @returns Nothing.
	 */
	static close(paneId: string): void {
		void VoiceInput.cancel(paneId);
		const compositionBar = CompositionBar.forPane(paneId);
		compositionBar.isOpen = false;
		compositionBar.paths = [];
		compositionBar.text = "";
		compositionBar.thumbnails = {};
		compositionBar.previews = {};
		compositionBar.viewerIndex = null;
	}

	/**
	 * Toggles this pane's composition bar. Closing the composition bar removes every image and the text.
	 * @param paneId The identifier of the pane whose header button was pressed.
	 * @returns Nothing.
	 */
	static toggleBar(paneId: string): void {
		const compositionBar = CompositionBar.forPane(paneId);
		if (compositionBar.isOpen === true) {
			ImageDrop.close(paneId);
			return;
		}
		compositionBar.isOpen = true;
	}

	/**
	 * Opens the big view on one image of the composition bar.
	 * @param paneId The identifier of the pane that owns the image.
	 * @param path The path of the image.
	 * @returns Nothing.
	 */
	static openViewer(paneId: string, path: string): void {
		for (const otherPaneId of Object.keys(CompositionBar.byPane)) {
			if (otherPaneId !== paneId) {
				CompositionBar.forPane(otherPaneId).viewerIndex = null;
			}
		}
		const compositionBar = CompositionBar.forPane(paneId);
		const index = compositionBar.paths.indexOf(path);
		compositionBar.viewerIndex = index === -1 ? null : index;
	}

	/**
	 * Moves the big view to the next or to the previous image. After the last image comes the first image.
	 * @param paneId The identifier of the pane that owns the images.
	 * @param step 1 for the next image, -1 for the previous image.
	 * @returns Nothing.
	 */
	static moveViewer(paneId: string, step: 1 | -1): void {
		const compositionBar = CompositionBar.forPane(paneId);
		const count = compositionBar.paths.length;
		if (compositionBar.viewerIndex === null || count === 0) {
			return;
		}
		compositionBar.viewerIndex = (compositionBar.viewerIndex + step + count) % count;
	}

	/**
	 * Closes the big view.
	 * @param paneId The identifier of the pane that owns the images.
	 * @returns Nothing.
	 */
	static closeViewer(paneId: string): void {
		CompositionBar.forPane(paneId).viewerIndex = null;
	}

	/**
	 * Makes the small picture of one image of the composition bar, and keeps it there.
	 * @param paneId The identifier of the pane that owns the image.
	 * @param path The path of the image.
	 * @returns Resolves after the picture is stored if the image remains in the pane's composition bar.
	 */
	static async loadThumbnail(paneId: string, path: string): Promise<void> {
		const thumbnail = await ImageDrop.makePicture(path, THUMBNAIL_LONGEST_SIDE);
		const compositionBar = CompositionBar.byPane[paneId];
		if (compositionBar !== undefined && compositionBar.paths.includes(path) === true) {
			compositionBar.thumbnails[path] = thumbnail;
		}
	}

	/**
	 * Makes the large picture of one image of the composition bar for the big view, and keeps it there.
	 * @param paneId The identifier of the pane that owns the image.
	 * @param path The path of the image.
	 * @returns Resolves after the picture is stored if the image remains in the pane's composition bar.
	 */
	static async loadPreview(paneId: string, path: string): Promise<void> {
		const preview = await ImageDrop.makePicture(path, PREVIEW_LONGEST_SIDE);
		const compositionBar = CompositionBar.byPane[paneId];
		if (compositionBar !== undefined && compositionBar.paths.includes(path) === true) {
			compositionBar.previews[path] = preview;
		}
	}

	/**
	 * Pastes the images one after the other in the terminal of a pane: each image goes to the clipboard, then the
	 * terminal receives Control+V. It stops at the first image that fails.
	 * @param paneId The identifier of the pane.
	 * @param paths The paths of the images, in the order of the paste.
	 * @param delayMs The wait between two pastes, in milliseconds.
	 * @returns How many images are pasted, and why the paste stopped.
	 */
	static async pasteInto(paneId: string, paths: string[], delayMs = PASTE_DELAY_MS): Promise<ImagePasteResult> {
		const writer = ImageDrop.writers.get(paneId);
		if (writer === undefined) {
			return { pastedCount: 0, result: "no_terminal" };
		}
		let pastedCount = 0;
		for (const path of paths) {
			if (pastedCount > 0) {
				await new Promise((resolve) => setTimeout(resolve, delayMs));
			}
			try {
				await invoke("clipboard_set_image", { path });
				await writer(CONTROL_V);
			} catch {
				return { pastedCount, result: "failed" };
			}
			pastedCount += 1;
		}
		return { pastedCount, result: "pasted" };
	}

	/**
	 * Asks the desktop application for a picture of an image file.
	 * @param path The path of the image.
	 * @param longestSide The longest side of the picture, in pixels.
	 * @returns The picture as a `data:` address, or an empty text when the picture could not be made.
	 */
	private static async makePicture(path: string, longestSide: number): Promise<string> {
		try {
			return await invoke<string>("image_preview", { path, longestSide });
		} catch {
			return "";
		}
	}
}
