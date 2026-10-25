// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { PaneFocusHistory } from './pane_focus_history';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	PaneFocusHistoryTest — the order of the panes that had the focus, and the moves through it
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** Helpers for the tests of the pane focus history. */
class PaneFocusHistoryTestHelper {
	/**
	 * Builds a pane focus history and records some panes in it, in order.
	 *
	 * @param paneIds - The names of the panes, in the order of their focus.
	 * @param maxEntries - The largest number of entries.
	 * @returns The pane focus history, with the last pane as current entry.
	 */
	static build(paneIds: string[], maxEntries?: number): PaneFocusHistory {
		const paneFocusHistory = new PaneFocusHistory(maxEntries);
		for (const paneId of paneIds) {
			paneFocusHistory.record(paneId);
		}
		return paneFocusHistory;
	}

	/**
	 * Lists the names of the panes of some entries.
	 *
	 * @param paneFocusHistory - The pane focus history to read.
	 * @returns The names of the panes before the current entry, the nearest first, then the current pane, then the names
	 * of the panes after it, the nearest first, as three lists.
	 */
	static read(paneFocusHistory: PaneFocusHistory): { before: string[]; current: string | null; after: string[] } {
		return {
			before: paneFocusHistory.entriesBefore.map((entry) => entry.paneId),
			current: paneFocusHistory.currentPaneId,
			after: paneFocusHistory.entriesAfter.map((entry) => entry.paneId),
		};
	}
}

describe('PaneFocusHistory', () => {
	describe('an empty history', () => {
		it('has no current pane, and neither "Back" nor "Forward"', () => {
			const paneFocusHistory = new PaneFocusHistory();
			expect(paneFocusHistory.currentPaneId).toBeNull();
			expect(paneFocusHistory.canGoBack).toBe(false);
			expect(paneFocusHistory.canGoForward).toBe(false);
			expect(paneFocusHistory.goBack()).toBeNull();
			expect(paneFocusHistory.goForward()).toBeNull();
		});
	});

	describe('record', () => {
		it('makes the first pane the current pane, with nothing to go back to', () => {
			const paneFocusHistory = PaneFocusHistoryTestHelper.build(['w1:p1']);
			expect(paneFocusHistory.currentPaneId).toBe('w1:p1');
			expect(paneFocusHistory.canGoBack).toBe(false);
			expect(paneFocusHistory.canGoForward).toBe(false);
		});

		it('enables "Back" once a second pane got the focus', () => {
			const paneFocusHistory = PaneFocusHistoryTestHelper.build(['w1:p1', 'w1:p2']);
			expect(paneFocusHistory.currentPaneId).toBe('w1:p2');
			expect(paneFocusHistory.canGoBack).toBe(true);
			expect(paneFocusHistory.canGoForward).toBe(false);
		});

		it('ignores the pane of the current entry', () => {
			const paneFocusHistory = PaneFocusHistoryTestHelper.build(['w1:p1', 'w1:p2']);
			expect(paneFocusHistory.record('w1:p2')).toBe(false);
			expect(PaneFocusHistoryTestHelper.read(paneFocusHistory)).toEqual({
				before: ['w1:p1'],
				current: 'w1:p2',
				after: [],
			});
		});

		it('records a pane again when it is not the current pane', () => {
			const paneFocusHistory = PaneFocusHistoryTestHelper.build(['w1:p1', 'w1:p2', 'w1:p1']);
			expect(PaneFocusHistoryTestHelper.read(paneFocusHistory)).toEqual({
				before: ['w1:p2', 'w1:p1'],
				current: 'w1:p1',
				after: [],
			});
		});

		it('removes the entries after the current entry, as a web browser does', () => {
			const paneFocusHistory = PaneFocusHistoryTestHelper.build(['w1:p1', 'w1:p2', 'w1:p3']);
			paneFocusHistory.goBack();
			paneFocusHistory.goBack();
			expect(paneFocusHistory.record('w1:p4')).toBe(true);
			expect(PaneFocusHistoryTestHelper.read(paneFocusHistory)).toEqual({
				before: ['w1:p1'],
				current: 'w1:p4',
				after: [],
			});
			expect(paneFocusHistory.canGoForward).toBe(false);
		});

		it('keeps the same entries when the pane after a "Back" is the pane of the current entry', () => {
			const paneFocusHistory = PaneFocusHistoryTestHelper.build(['w1:p1', 'w1:p2', 'w1:p3']);
			paneFocusHistory.goBack();
			expect(paneFocusHistory.record('w1:p2')).toBe(false);
			expect(paneFocusHistory.canGoForward).toBe(true);
		});

		it('drops the oldest entry when there are more entries than the largest number', () => {
			const paneFocusHistory = PaneFocusHistoryTestHelper.build(['w1:p1', 'w1:p2', 'w1:p3', 'w1:p4'], 3);
			expect(PaneFocusHistoryTestHelper.read(paneFocusHistory)).toEqual({
				before: ['w1:p3', 'w1:p2'],
				current: 'w1:p4',
				after: [],
			});
		});
	});

	describe('goBack and goForward', () => {
		it('walk through the entries one by one', () => {
			const paneFocusHistory = PaneFocusHistoryTestHelper.build(['w1:p1', 'w1:p2', 'w1:p3']);
			expect(paneFocusHistory.goBack()).toBe('w1:p2');
			expect(paneFocusHistory.goBack()).toBe('w1:p1');
			expect(paneFocusHistory.goBack()).toBeNull();
			expect(paneFocusHistory.canGoBack).toBe(false);
			expect(paneFocusHistory.canGoForward).toBe(true);
			expect(paneFocusHistory.goForward()).toBe('w1:p2');
			expect(paneFocusHistory.goForward()).toBe('w1:p3');
			expect(paneFocusHistory.goForward()).toBeNull();
			expect(paneFocusHistory.canGoForward).toBe(false);
			expect(paneFocusHistory.canGoBack).toBe(true);
		});

		it('list the entries before and after the current entry, the nearest first', () => {
			const paneFocusHistory = PaneFocusHistoryTestHelper.build(['w1:p1', 'w1:p2', 'w1:p3', 'w1:p4']);
			paneFocusHistory.goBack();
			paneFocusHistory.goBack();
			expect(paneFocusHistory.entriesBefore).toEqual([{ index: 0, paneId: 'w1:p1' }]);
			expect(paneFocusHistory.entriesAfter).toEqual([
				{ index: 2, paneId: 'w1:p3' },
				{ index: 3, paneId: 'w1:p4' },
			]);
		});
	});

	describe('goTo', () => {
		it('moves the current place to the chosen entry', () => {
			const paneFocusHistory = PaneFocusHistoryTestHelper.build(['w1:p1', 'w1:p2', 'w1:p3', 'w1:p4']);
			expect(paneFocusHistory.goTo(1)).toBe('w1:p2');
			expect(PaneFocusHistoryTestHelper.read(paneFocusHistory)).toEqual({
				before: ['w1:p1'],
				current: 'w1:p2',
				after: ['w1:p3', 'w1:p4'],
			});
			expect(paneFocusHistory.goTo(3)).toBe('w1:p4');
			expect(paneFocusHistory.canGoForward).toBe(false);
		});

		it('changes nothing for a place that has no entry', () => {
			const paneFocusHistory = PaneFocusHistoryTestHelper.build(['w1:p1', 'w1:p2']);
			expect(paneFocusHistory.goTo(2)).toBeNull();
			expect(paneFocusHistory.goTo(-1)).toBeNull();
			expect(paneFocusHistory.goTo(0.5)).toBeNull();
			expect(paneFocusHistory.currentPaneId).toBe('w1:p2');
		});
	});

	describe('remove', () => {
		it('removes every entry of a closed pane, before and after the current entry', () => {
			const paneFocusHistory = PaneFocusHistoryTestHelper.build(['w1:p1', 'w1:p2', 'w1:p3', 'w1:p2', 'w1:p4']);
			paneFocusHistory.goBack();
			paneFocusHistory.goBack();
			paneFocusHistory.remove(['w1:p2']);
			expect(PaneFocusHistoryTestHelper.read(paneFocusHistory)).toEqual({
				before: ['w1:p1'],
				current: 'w1:p3',
				after: ['w1:p4'],
			});
		});

		it('keeps the current entry when another pane goes away', () => {
			const paneFocusHistory = PaneFocusHistoryTestHelper.build(['w1:p1', 'w1:p2', 'w1:p3']);
			paneFocusHistory.goBack();
			paneFocusHistory.remove(['w1:p1']);
			expect(PaneFocusHistoryTestHelper.read(paneFocusHistory)).toEqual({
				before: [],
				current: 'w1:p2',
				after: ['w1:p3'],
			});
		});

		it('joins two entries of the same pane that become neighbours', () => {
			const paneFocusHistory = PaneFocusHistoryTestHelper.build(['w1:p1', 'w1:p2', 'w1:p1', 'w1:p3']);
			paneFocusHistory.remove(['w1:p2']);
			expect(PaneFocusHistoryTestHelper.read(paneFocusHistory)).toEqual({
				before: ['w1:p1'],
				current: 'w1:p3',
				after: [],
			});
		});

		it('keeps the current place on the joined entry when the current entry is one of the two', () => {
			const paneFocusHistory = PaneFocusHistoryTestHelper.build(['w1:p1', 'w1:p2', 'w1:p1', 'w1:p3']);
			paneFocusHistory.goTo(2);
			paneFocusHistory.remove(['w1:p2']);
			expect(PaneFocusHistoryTestHelper.read(paneFocusHistory)).toEqual({
				before: [],
				current: 'w1:p1',
				after: ['w1:p3'],
			});
		});

		it('moves the current place to the nearest entry before when the current pane is closed', () => {
			const paneFocusHistory = PaneFocusHistoryTestHelper.build(['w1:p1', 'w1:p2', 'w1:p3']);
			paneFocusHistory.remove(['w1:p3']);
			expect(PaneFocusHistoryTestHelper.read(paneFocusHistory)).toEqual({
				before: ['w1:p1'],
				current: 'w1:p2',
				after: [],
			});
		});

		it('moves the current place to the first entry when no entry exists before the current pane', () => {
			const paneFocusHistory = PaneFocusHistoryTestHelper.build(['w1:p1', 'w1:p2', 'w1:p3']);
			paneFocusHistory.goTo(0);
			paneFocusHistory.remove(['w1:p1']);
			expect(PaneFocusHistoryTestHelper.read(paneFocusHistory)).toEqual({
				before: [],
				current: 'w1:p2',
				after: ['w1:p3'],
			});
		});

		it('empties the history when every pane is closed', () => {
			const paneFocusHistory = PaneFocusHistoryTestHelper.build(['w1:p1', 'w1:p2']);
			paneFocusHistory.remove(['w1:p1', 'w1:p2']);
			expect(paneFocusHistory.currentPaneId).toBeNull();
			expect(paneFocusHistory.canGoBack).toBe(false);
			expect(paneFocusHistory.canGoForward).toBe(false);
		});

		it('ignores a name that is not in the history', () => {
			const paneFocusHistory = PaneFocusHistoryTestHelper.build(['w1:p1', 'w1:p2']);
			paneFocusHistory.remove(['w1:p9']);
			expect(PaneFocusHistoryTestHelper.read(paneFocusHistory)).toEqual({
				before: ['w1:p1'],
				current: 'w1:p2',
				after: [],
			});
		});
	});

	describe('findMostRecentPaneId', () => {
		it('finds the current pane when it passes the test', () => {
			const paneFocusHistory = PaneFocusHistoryTestHelper.build(['w1:p1', 'w1:p2', 'w1:p3']);
			expect(paneFocusHistory.findMostRecentPaneId(() => true)).toBe('w1:p3');
		});

		it('skips every entry that does not pass the test, the latest entries first', () => {
			const paneFocusHistory = PaneFocusHistoryTestHelper.build(['w1:p1', 'w1:p2', 'w1:p3', 'w1:p4']);
			expect(paneFocusHistory.findMostRecentPaneId((paneId) => paneId === 'w1:p1' || paneId === 'w1:p2')).toBe('w1:p2');
		});

		it('searches back from the current entry first, after a move back', () => {
			const paneFocusHistory = PaneFocusHistoryTestHelper.build(['w1:p1', 'w1:p2', 'w1:p3', 'w1:p4']);
			paneFocusHistory.goTo(2);
			expect(paneFocusHistory.findMostRecentPaneId((paneId) => paneId !== 'w1:p3')).toBe('w1:p2');
		});

		it('searches the entries after the current entry when no entry before passes the test', () => {
			const paneFocusHistory = PaneFocusHistoryTestHelper.build(['w1:p1', 'w1:p2', 'w1:p3', 'w1:p4']);
			paneFocusHistory.goTo(1);
			expect(paneFocusHistory.findMostRecentPaneId((paneId) => paneId === 'w1:p3' || paneId === 'w1:p4')).toBe('w1:p3');
		});

		it('returns null when no entry passes the test, or when the history is empty', () => {
			const paneFocusHistory = PaneFocusHistoryTestHelper.build(['w1:p1', 'w1:p2']);
			expect(paneFocusHistory.findMostRecentPaneId(() => false)).toBeNull();
			expect(PaneFocusHistoryTestHelper.build([]).findMostRecentPaneId(() => true)).toBeNull();
		});

		it('does not change the history', () => {
			const paneFocusHistory = PaneFocusHistoryTestHelper.build(['w1:p1', 'w1:p2', 'w1:p3']);
			paneFocusHistory.goTo(1);
			paneFocusHistory.findMostRecentPaneId((paneId) => paneId === 'w1:p3');
			expect(PaneFocusHistoryTestHelper.read(paneFocusHistory)).toEqual({
				before: ['w1:p1'],
				current: 'w1:p2',
				after: ['w1:p3'],
			});
		});
	});
});
