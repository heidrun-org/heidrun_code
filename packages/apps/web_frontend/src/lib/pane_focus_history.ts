///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	PaneFocusHistory — the panes that had the focus, in order, with a current place in the list
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** One entry of a pane focus history, as the list of a long press shows it. */
export type PaneFocusHistoryEntry = {
	/** Place of the entry in the pane focus history. */
	index: number;
	/** Name of the pane in Herdr, for example `w1:p1`. */
	paneId: string;
};

/** The largest number of entries that a pane focus history keeps. The oldest entry goes first. */
export const PANE_FOCUS_HISTORY_MAX_ENTRIES = 50;

/**
 * The panes that had the focus, the oldest first, and one current place in the list, like the history of a web
 * browser. "Back" moves the current place to the entry before, and "Forward" moves it to the entry after. A new focus
 * after a "Back" removes the entries after the current place.
 */
export class PaneFocusHistory {
	/** The names of the panes that had the focus, the oldest first. */
	private _paneIds: string[] = [];

	/** Place of the current entry in `_paneIds`, or -1 when the history is empty. */
	private _currentIndex = -1;

	/** The largest number of entries. */
	private _maxEntries: number;

	/**
	 * @param maxEntries - The largest number of entries. The oldest entry goes first when there are more.
	 */
	constructor(maxEntries = PANE_FOCUS_HISTORY_MAX_ENTRIES) {
		this._maxEntries = maxEntries;
	}

	/** The name of the pane of the current entry, or `null` when the history is empty. */
	get currentPaneId(): string | null {
		return this._paneIds[this._currentIndex] ?? null;
	}

	/** True when an entry exists before the current entry. */
	get canGoBack(): boolean {
		return this._currentIndex > 0;
	}

	/** True when an entry exists after the current entry. */
	get canGoForward(): boolean {
		return this._currentIndex >= 0 && this._currentIndex < this._paneIds.length - 1;
	}

	/** The names of the panes of all the entries, the oldest first. A pane that had the focus twice appears twice. */
	get paneIds(): string[] {
		return [...this._paneIds];
	}

	/** The entries before the current entry, the nearest first. */
	get entriesBefore(): PaneFocusHistoryEntry[] {
		const entryList: PaneFocusHistoryEntry[] = [];
		for (let index = this._currentIndex - 1; index >= 0; index--) {
			entryList.push({ index, paneId: this._paneIds[index] });
		}
		return entryList;
	}

	/** The entries after the current entry, the nearest first. */
	get entriesAfter(): PaneFocusHistoryEntry[] {
		const entryList: PaneFocusHistoryEntry[] = [];
		for (let index = this._currentIndex + 1; index < this._paneIds.length; index++) {
			entryList.push({ index, paneId: this._paneIds[index] });
		}
		return entryList;
	}

	/**
	 * Records that a pane got the focus. The entries after the current entry go away, and the new entry becomes the
	 * current entry. Nothing changes when the pane is already the pane of the current entry.
	 *
	 * @param paneId - The name of the pane that got the focus.
	 * @returns True when the history changed.
	 */
	record(paneId: string): boolean {
		if (this._paneIds[this._currentIndex] === paneId) {
			return false;
		}
		this._paneIds.splice(this._currentIndex + 1);
		this._paneIds.push(paneId);
		if (this._paneIds.length > this._maxEntries) {
			this._paneIds.shift();
		}
		this._currentIndex = this._paneIds.length - 1;
		return true;
	}

	/**
	 * Moves the current place to the entry before.
	 *
	 * @returns The name of the pane of the new current entry, or `null` when no entry exists before.
	 */
	goBack(): string | null {
		if (this.canGoBack === false) {
			return null;
		}
		this._currentIndex -= 1;
		return this._paneIds[this._currentIndex];
	}

	/**
	 * Moves the current place to the entry after.
	 *
	 * @returns The name of the pane of the new current entry, or `null` when no entry exists after.
	 */
	goForward(): string | null {
		if (this.canGoForward === false) {
			return null;
		}
		this._currentIndex += 1;
		return this._paneIds[this._currentIndex];
	}

	/**
	 * Moves the current place to one entry.
	 *
	 * @param index - The place of the entry in the history.
	 * @returns The name of the pane of the new current entry, or `null` when no entry has this place.
	 */
	goTo(index: number): string | null {
		const paneId = this._paneIds[index];
		if (Number.isInteger(index) === false || paneId === undefined) {
			return null;
		}
		this._currentIndex = index;
		return paneId;
	}

	/**
	 * Finds the pane that had the focus most recently among the entries that pass a test. The search starts at the
	 * current entry and goes back to the first entry. When no entry passes the test, the search goes on from the entry
	 * after the current entry to the last entry. The history does not change.
	 *
	 * @param isAcceptedFn - Tells if the pane of an entry can be chosen, for example because the pane still exists.
	 * @returns The name of the chosen pane, or `null` when no entry passes the test.
	 */
	findMostRecentPaneId(isAcceptedFn: (paneId: string) => boolean): string | null {
		for (let index = this._currentIndex; index >= 0; index--) {
			if (isAcceptedFn(this._paneIds[index]) === true) {
				return this._paneIds[index];
			}
		}
		for (let index = this._currentIndex + 1; index < this._paneIds.length; index++) {
			if (isAcceptedFn(this._paneIds[index]) === true) {
				return this._paneIds[index];
			}
		}
		return null;
	}

	/**
	 * Removes every entry of some panes, for example the panes that the developer closed. Two entries of the same pane
	 * that become neighbours make one entry. When the current entry goes away, the current place moves to the nearest
	 * entry before it, or to the first entry when no entry exists before it.
	 *
	 * @param paneIds - The names of the panes to remove. A name that is not in the history is ignored.
	 */
	remove(paneIds: string[]): void {
		const removedSet = new Set(paneIds);
		const keptPaneIds: string[] = [];
		let keptCurrentIndex = -1;
		this._paneIds.forEach((paneId, index) => {
			if (removedSet.has(paneId) === true) {
				return;
			}
			if (keptPaneIds[keptPaneIds.length - 1] !== paneId) {
				keptPaneIds.push(paneId);
			}
			if (index <= this._currentIndex) {
				keptCurrentIndex = keptPaneIds.length - 1;
			}
		});
		this._paneIds = keptPaneIds;
		this._currentIndex = keptPaneIds.length === 0 ? -1 : Math.max(keptCurrentIndex, 0);
	}
}
