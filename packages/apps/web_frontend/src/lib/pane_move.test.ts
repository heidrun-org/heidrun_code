// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { PaneMove, type PaneMovePlanInput } from './pane_move';
import type { Box } from './reorder';

/** A pane 200 pixels wide and 100 pixels high, with its top left corner at (100, 50). */
const PANE: Box = { left: 100, top: 50, right: 300, bottom: 150 };

describe('PaneMove.sideAt', () => {
	it('gives the top for a point in the top triangle', () => {
		expect(PaneMove.sideAt(PANE, 200, 60)).toBe('top');
	});

	it('gives the bottom for a point in the bottom triangle', () => {
		expect(PaneMove.sideAt(PANE, 200, 140)).toBe('bottom');
	});

	it('gives the left for a point in the left triangle', () => {
		expect(PaneMove.sideAt(PANE, 110, 100)).toBe('left');
	});

	it('gives the right for a point in the right triangle', () => {
		expect(PaneMove.sideAt(PANE, 290, 100)).toBe('right');
	});

	it('cuts the pane along the two diagonals from corner to corner, not along the middle lines', () => {
		// Near the top left corner, a point just right of the diagonal is in the top triangle, and just below it is in the left one.
		expect(PaneMove.sideAt(PANE, 140, 60)).toBe('top');
		expect(PaneMove.sideAt(PANE, 105, 80)).toBe('left');
		// Near the bottom right corner, the same holds mirrored.
		expect(PaneMove.sideAt(PANE, 295, 120)).toBe('right');
		expect(PaneMove.sideAt(PANE, 260, 145)).toBe('bottom');
	});

	it('gives each of the four corners to a triangle that touches it', () => {
		expect(PaneMove.sideAt(PANE, 100.5, 50.2)).toBe('top');
		expect(PaneMove.sideAt(PANE, 299.5, 50.2)).toBe('top');
		expect(PaneMove.sideAt(PANE, 100.5, 149.8)).toBe('bottom');
		expect(PaneMove.sideAt(PANE, 299.5, 149.8)).toBe('bottom');
	});

	it('follows the shape of a tall pane: the diagonals are the diagonals of the pane, not of a square', () => {
		const tall: Box = { left: 0, top: 0, right: 100, bottom: 400 };
		// Share x = 0.3, share y = 0.2: above both diagonals, so the top triangle, even though the point is far from the middle.
		expect(PaneMove.sideAt(tall, 30, 80)).toBe('top');
		// Share x = 0.3, share y = 0.5: left of the pane's center and below the first diagonal, so the left triangle.
		expect(PaneMove.sideAt(tall, 30, 200)).toBe('left');
	});

	it('does not fail on a pane without size', () => {
		const empty: Box = { left: 10, top: 10, right: 10, bottom: 10 };
		expect(['top', 'bottom', 'left', 'right']).toContain(PaneMove.sideAt(empty, 10, 10));
	});
});

describe('PaneMove.halfOf', () => {
	it('gives the top half for the top side', () => {
		expect(PaneMove.halfOf(PANE, 'top')).toEqual({ left: 100, top: 50, right: 300, bottom: 100 });
	});

	it('gives the bottom half for the bottom side', () => {
		expect(PaneMove.halfOf(PANE, 'bottom')).toEqual({ left: 100, top: 100, right: 300, bottom: 150 });
	});

	it('gives the left half for the left side', () => {
		expect(PaneMove.halfOf(PANE, 'left')).toEqual({ left: 100, top: 50, right: 200, bottom: 150 });
	});

	it('gives the right half for the right side', () => {
		expect(PaneMove.halfOf(PANE, 'right')).toEqual({ left: 200, top: 50, right: 300, bottom: 150 });
	});
});

describe('PaneMove.plan', () => {
	const ACROSS_TABS: PaneMovePlanInput = {
		paneId: 'w1:p3',
		workspaceId: 'w1',
		sourceTabId: 'w1:t2',
		destinationTabId: 'w1:t1',
		destinationPaneId: 'w1:p1',
		side: 'right',
	};

	it('puts a pane to the right of the destination pane with one move to the right', () => {
		expect(PaneMove.plan(ACROSS_TABS)).toEqual([
			{ kind: 'move-next-to-pane', paneId: 'w1:p3', tabId: 'w1:t1', destinationPaneId: 'w1:p1', direction: 'right' },
		]);
	});

	it('puts a pane below the destination pane with one move down', () => {
		expect(PaneMove.plan({ ...ACROSS_TABS, side: 'bottom' })).toEqual([
			{ kind: 'move-next-to-pane', paneId: 'w1:p3', tabId: 'w1:t1', destinationPaneId: 'w1:p1', direction: 'down' },
		]);
	});

	it('puts a pane to the left of the destination pane with a move to the right, then a swap of the two panes', () => {
		expect(PaneMove.plan({ ...ACROSS_TABS, side: 'left' })).toEqual([
			{ kind: 'move-next-to-pane', paneId: 'w1:p3', tabId: 'w1:t1', destinationPaneId: 'w1:p1', direction: 'right' },
			{ kind: 'swap', paneId: 'w1:p3', destinationPaneId: 'w1:p1' },
		]);
	});

	it('puts a pane above the destination pane with a move down, then a swap of the two panes', () => {
		expect(PaneMove.plan({ ...ACROSS_TABS, side: 'top' })).toEqual([
			{ kind: 'move-next-to-pane', paneId: 'w1:p3', tabId: 'w1:t1', destinationPaneId: 'w1:p1', direction: 'down' },
			{ kind: 'swap', paneId: 'w1:p3', destinationPaneId: 'w1:p1' },
		]);
	});

	it('moves a pane inside its own tab through a temporary tab, because Herdr moves no pane inside its own tab', () => {
		expect(PaneMove.plan({ ...ACROSS_TABS, sourceTabId: 'w1:t1', side: 'top' })).toEqual([
			{ kind: 'move-to-new-tab', paneId: 'w1:p3', workspaceId: 'w1' },
			{ kind: 'move-next-to-pane', paneId: 'w1:p3', tabId: 'w1:t1', destinationPaneId: 'w1:p1', direction: 'down' },
			{ kind: 'swap', paneId: 'w1:p3', destinationPaneId: 'w1:p1' },
		]);
	});

	it('never starts the temporary tab for a move to another tab', () => {
		for (const side of ['top', 'bottom', 'left', 'right'] as const) {
			const kinds = PaneMove.plan({ ...ACROSS_TABS, side }).map((step) => step.kind);
			expect(kinds).not.toContain('move-to-new-tab');
		}
	});
});

describe('PaneMove.planNewTab', () => {
	it('moves a pane into a new tab with one step, and starts no other step', () => {
		expect(PaneMove.planNewTab({ paneId: 'w1:p3', workspaceId: 'w1' })).toEqual([
			{ kind: 'move-to-new-tab', paneId: 'w1:p3', workspaceId: 'w1' },
		]);
	});
});
