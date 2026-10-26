// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { PaneLayoutWithoutPanes } from './pane_layout_without_panes';
import { PaneSeparators } from './pane_separators';
import type { LayoutSplit, PaneLayoutSnapshot, Rect } from './types';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Layouts
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** Builds the layouts that the tests read. */
class PaneLayoutWithoutPanesTestHelper {
	/**
	 * Builds a layout of 120 by 40 cells from rectangles written as `[x, y, width, height]`.
	 *
	 * @param paneRectList - The rectangle of every pane, by pane name.
	 * @param splitList - The splits, with their rectangle as `[x, y, width, height]`.
	 * @param isZoomed - True when a pane of the tab is zoomed.
	 * @returns The layout of a tab.
	 */
	static build(
		paneRectList: Record<string, number[]>,
		splitList: { id: string; direction: 'down' | 'right'; ratio: number; rect: number[] }[],
		isZoomed = false,
	): PaneLayoutSnapshot {
		const toRect = (values: number[]): Rect => {
			return {
				x: values[0],
				y: values[1],
				width: values[2],
				height: values[3],
			};
		};
		const layout: PaneLayoutSnapshot = {
			workspace_id: 'w1',
			tab_id: 'w1:t1',
			zoomed: isZoomed,
			area: {
				x: 0,
				y: 0,
				width: 120,
				height: 40,
			},
			focused_pane_id: Object.keys(paneRectList)[0],
			panes: Object.entries(paneRectList).map(([paneId, values]) => {
				return {
					pane_id: paneId,
					focused: false,
					rect: toRect(values),
				};
			}),
			splits: splitList.map((split): LayoutSplit => {
				return {
					id: split.id,
					direction: split.direction,
					ratio: split.ratio,
					rect: toRect(split.rect),
				};
			}),
		};
		return layout;
	}

	/**
	 * Reads the rectangle of a pane in a layout.
	 *
	 * @param layout - The layout.
	 * @param paneId - The name of the pane.
	 * @returns The rectangle as `[x, y, width, height]`, or `null` when the pane is not in the layout.
	 */
	static readRect(layout: PaneLayoutSnapshot, paneId: string): number[] | null {
		const layoutPane = layout.panes.find((item) => item.pane_id === paneId);
		if (layoutPane === undefined) {
			return null;
		}
		return [layoutPane.rect.x, layoutPane.rect.y, layoutPane.rect.width, layoutPane.rect.height];
	}

	/**
	 * Adds the area of every pane of a layout.
	 *
	 * @param layout - The layout.
	 * @returns The sum of width times height, in cells.
	 */
	static sumPaneAreas(layout: PaneLayoutSnapshot): number {
		return layout.panes.reduce((sum, layoutPane) => sum + layoutPane.rect.width * layoutPane.rect.height, 0);
	}
}

/** Three panes in a column: the first one, then two panes in the second half. */
const THREE_STACKED_PANES = PaneLayoutWithoutPanesTestHelper.build(
	{
		first: [0, 0, 120, 16],
		second: [0, 16, 120, 12],
		third: [0, 28, 120, 12],
	},
	[
		{ id: 'split_0_root', direction: 'down', ratio: 0.4, rect: [0, 0, 120, 40] },
		{ id: 'split_1_1', direction: 'down', ratio: 0.5, rect: [0, 16, 120, 24] },
	],
);

/** Four panes in two rows, with the two vertical lines at different places. */
const FOUR_PANES_IN_TWO_ROWS = PaneLayoutWithoutPanesTestHelper.build(
	{
		topLeft: [0, 0, 30, 12],
		topRight: [30, 0, 90, 12],
		bottomLeft: [0, 12, 40, 28],
		bottomRight: [40, 12, 80, 28],
	},
	[
		{ id: 'split_0_root', direction: 'down', ratio: 0.3, rect: [0, 0, 120, 40] },
		{ id: 'split_1_0', direction: 'right', ratio: 0.25, rect: [0, 0, 120, 12] },
		{ id: 'split_2_1', direction: 'right', ratio: 0.333, rect: [0, 12, 120, 28] },
	],
);

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Tests
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

describe('PaneLayoutWithoutPanes.remove', () => {
	it('gives back the same layout when no pane of the layout is removed', () => {
		expect(PaneLayoutWithoutPanes.remove(THREE_STACKED_PANES, [])).toBe(THREE_STACKED_PANES);
		expect(PaneLayoutWithoutPanes.remove(THREE_STACKED_PANES, ['another'])).toBe(THREE_STACKED_PANES);
	});

	it('gives the whole rectangle to the other panes when the first pane leaves', () => {
		const layout = PaneLayoutWithoutPanes.remove(THREE_STACKED_PANES, ['first']);
		expect(layout).not.toBeNull();
		expect(PaneLayoutWithoutPanesTestHelper.readRect(layout!, 'first')).toBeNull();
		expect(PaneLayoutWithoutPanesTestHelper.readRect(layout!, 'second')).toEqual([0, 0, 120, 20]);
		expect(PaneLayoutWithoutPanesTestHelper.readRect(layout!, 'third')).toEqual([0, 20, 120, 20]);
	});

	it('gives the whole rectangle to the first pane when the second group leaves', () => {
		const layout = PaneLayoutWithoutPanes.remove(THREE_STACKED_PANES, ['second', 'third']);
		expect(layout).not.toBeNull();
		expect(PaneLayoutWithoutPanesTestHelper.readRect(layout!, 'first')).toEqual([0, 0, 120, 40]);
		expect(layout!.splits).toEqual([]);
	});

	it('gives the freed rectangle to the pane next to the pane that leaves, and keeps the other splits', () => {
		const layout = PaneLayoutWithoutPanes.remove(THREE_STACKED_PANES, ['third']);
		expect(layout).not.toBeNull();
		expect(PaneLayoutWithoutPanesTestHelper.readRect(layout!, 'first')).toEqual([0, 0, 120, 16]);
		expect(PaneLayoutWithoutPanesTestHelper.readRect(layout!, 'second')).toEqual([0, 16, 120, 24]);
		expect(layout!.splits?.map((split) => split.id)).toEqual(['split_0_root']);
	});

	it('keeps the share of the splits that stay, in a split that holds a group of panes', () => {
		const layout = PaneLayoutWithoutPanes.remove(FOUR_PANES_IN_TWO_ROWS, ['topRight']);
		expect(layout).not.toBeNull();
		expect(PaneLayoutWithoutPanesTestHelper.readRect(layout!, 'topLeft')).toEqual([0, 0, 120, 12]);
		expect(PaneLayoutWithoutPanesTestHelper.readRect(layout!, 'bottomLeft')).toEqual([0, 12, 40, 28]);
		expect(PaneLayoutWithoutPanesTestHelper.readRect(layout!, 'bottomRight')).toEqual([40, 12, 80, 28]);
		expect(layout!.splits?.map((split) => split.id)).toEqual(['split_0_root', 'split_2_1']);
	});

	it('leaves no hole and no overlap: the panes that stay cover the whole area', () => {
		for (const removedPaneId of ['topLeft', 'topRight', 'bottomLeft', 'bottomRight']) {
			const layout = PaneLayoutWithoutPanes.remove(FOUR_PANES_IN_TWO_ROWS, [removedPaneId]);
			expect(layout).not.toBeNull();
			expect(PaneLayoutWithoutPanesTestHelper.sumPaneAreas(layout!)).toBe(120 * 40);
		}
	});

	it('keeps the way of each split in the layout of Herdr, so that a drag changes the right split', () => {
		const layout = PaneLayoutWithoutPanes.remove(THREE_STACKED_PANES, ['first']);
		expect(layout).not.toBeNull();
		const separatorList = PaneSeparators.findSeparators(layout!);
		expect(separatorList.map((separator) => ({ splitId: separator.splitId, path: separator.path }))).toEqual([
			{
				splitId: 'split_1_1',
				path: [true],
			},
		]);
	});

	it('finds the line of a split that stays at the place of its share in the smaller rectangle', () => {
		const layout = PaneLayoutWithoutPanes.remove(FOUR_PANES_IN_TWO_ROWS, ['bottomLeft', 'bottomRight']);
		expect(layout).not.toBeNull();
		const separatorList = PaneSeparators.findSeparators(layout!);
		expect(separatorList.map((separator) => separator.splitId)).toEqual(['split_1_0']);
		expect(separatorList[0].position).toBe(30);
		expect(separatorList[0].size).toBe(120);
	});

	it('gives a layout without any pane when every pane leaves', () => {
		const layout = PaneLayoutWithoutPanes.remove(THREE_STACKED_PANES, ['first', 'second', 'third']);
		expect(layout?.panes).toEqual([]);
		expect(layout?.splits).toEqual([]);
	});

	it('only removes the panes of a zoomed layout, because it has no line to move', () => {
		const zoomed = PaneLayoutWithoutPanesTestHelper.build(
			{
				first: [0, 0, 120, 40],
				second: [0, 0, 120, 40],
			},
			[{ id: 'split_0_root', direction: 'right', ratio: 0.5, rect: [0, 0, 120, 40] }],
			true,
		);
		const layout = PaneLayoutWithoutPanes.remove(zoomed, ['first']);
		expect(layout?.panes.map((layoutPane) => layoutPane.pane_id)).toEqual(['second']);
		expect(PaneLayoutWithoutPanesTestHelper.readRect(layout!, 'second')).toEqual([0, 0, 120, 40]);
	});

	it('gives nothing back when Herdr sends no split for several panes, so that the caller chooses a layout', () => {
		const withoutSplits = PaneLayoutWithoutPanesTestHelper.build(
			{
				first: [0, 0, 60, 40],
				second: [60, 0, 60, 40],
			},
			[],
		);
		expect(PaneLayoutWithoutPanes.remove(withoutSplits, ['first'])).toBeNull();
	});

	it('does not change the layout that it reads', () => {
		const before = JSON.stringify(THREE_STACKED_PANES);
		PaneLayoutWithoutPanes.remove(THREE_STACKED_PANES, ['first']);
		expect(JSON.stringify(THREE_STACKED_PANES)).toBe(before);
	});
});
