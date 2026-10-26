///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	FileViewLabel — writes and reads the label that marks a pane as a file view pane
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The text that starts the label of every file view pane. Herdr keeps the label, so it survives a restart of Heidrun Code. */
const LABEL_PREFIX = 'Heidrun file view: ';

/** Writes and reads the label of a file view pane: the marker followed by the absolute path of the file. */
export class FileViewLabel {
	/**
	 * Writes the label of a file view pane.
	 * @param absolutePath The absolute path of the file that the pane shows.
	 * @returns The label to give to the pane with the Herdr request `pane.rename`.
	 */
	static format(absolutePath: string): string {
		return `${LABEL_PREFIX}${absolutePath}`;
	}

	/**
	 * Reads the absolute path of the file from the label of a pane.
	 * @param label The label of the pane, or null or undefined when the pane has no label.
	 * @returns The absolute path of the file, or null when the label does not mark a file view pane.
	 */
	static parse(label: string | null | undefined): string | null {
		if (label === null || label === undefined || label.startsWith(LABEL_PREFIX) === false) {
			return null;
		}
		const absolutePath = label.slice(LABEL_PREFIX.length);
		if (absolutePath === '') {
			return null;
		}
		return absolutePath;
	}

	/**
	 * Reads the name of the file from the label of a pane.
	 * @param label The label of the pane, or null or undefined when the pane has no label.
	 * @returns The last part of the absolute path, or null when the label does not mark a file view pane.
	 */
	static fileName(label: string | null | undefined): string | null {
		const absolutePath = FileViewLabel.parse(label);
		if (absolutePath === null) {
			return null;
		}
		const parts = absolutePath.split('/').filter((part) => part !== '');
		return parts[parts.length - 1] ?? absolutePath;
	}
}
