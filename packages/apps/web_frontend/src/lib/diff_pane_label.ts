///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	DiffPaneLabel — writes and reads the label that marks a pane as a diff pane
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The text that starts the label of every diff pane. Herdr keeps the label, so it survives a restart of Heidrun Code. */
const LABEL_PREFIX = 'Heidrun diff: ';

/** Writes and reads the label of a diff pane: the marker followed by the absolute path of the changed file. */
export class DiffPaneLabel {
	/**
	 * Writes the label of a diff pane.
	 * @param absolutePath The absolute path of the file whose changes the pane shows.
	 * @returns The label to give to the pane with the Herdr request `pane.rename`.
	 */
	static format(absolutePath: string): string {
		return `${LABEL_PREFIX}${absolutePath}`;
	}

	/**
	 * Reads the absolute path of the file from the label of a pane.
	 * @param label The label of the pane, or null or undefined when the pane has no label.
	 * @returns The absolute path of the file, or null when the label does not mark a diff pane.
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
	 * @returns The last part of the absolute path, or null when the label does not mark a diff pane.
	 */
	static fileName(label: string | null | undefined): string | null {
		const absolutePath = DiffPaneLabel.parse(label);
		if (absolutePath === null) {
			return null;
		}
		const parts = absolutePath.split('/').filter((part) => part !== '');
		return parts[parts.length - 1] ?? absolutePath;
	}
}
