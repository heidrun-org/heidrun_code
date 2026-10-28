// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { PaneSeparators } from './pane_separators';
import type { LayoutSplit, PaneLayoutSnapshot, Rect } from './types';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Layouts — copied from the answers of a real Herdr 0.9.3 server (`herdr pane layout`)
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** Builds the layouts that the tests read. */
class PaneLayoutFixture {
	/**
	 * Builds a layout from rectangles written as `[x, y, width, height]`.
	 *
	 * @param paneRectList - The rectangle of every pane, by pane name.
	 * @param splitList - The splits, with their rectangle as `[x, y, width, height]`.
	 * @returns The layout of a tab.
	 */
	static build(
		paneRectList: Record<string, number[]>,
		splitList: { id: string; direction: 'down' | 'right'; ratio: number; rect: number[] }[],
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
			zoomed: false,
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
}

/** Two panes, one above the other. */
const TWO_STACKED_PANES = PaneLayoutFixture.build(
	{
		top: [0, 0, 120, 20],
		bottom: [0, 20, 120, 20],
	},
	[{ id: 'split_0_root', direction: 'down', ratio: 0.5, rect: [0, 0, 120, 40] }],
);

/** Three panes in a column: the first one, then two panes in the second half. */
const THREE_STACKED_PANES = PaneLayoutFixture.build(
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

/** Four panes in two rows, with the two vertical lines at the same place. */
const FOUR_PANES_IN_A_CROSS = PaneLayoutFixture.build(
	{
		topLeft: [0, 0, 60, 20],
		topRight: [60, 0, 60, 20],
		bottomLeft: [0, 20, 60, 20],
		bottomRight: [60, 20, 60, 20],
	},
	[
		{ id: 'split_0_root', direction: 'down', ratio: 0.5, rect: [0, 0, 120, 40] },
		{ id: 'split_1_0', direction: 'right', ratio: 0.5, rect: [0, 0, 120, 20] },
		{ id: 'split_2_1', direction: 'right', ratio: 0.5, rect: [0, 20, 120, 20] },
	],
);

/** Four panes in two rows, with the two vertical lines at different places. */
const FOUR_PANES_IN_TWO_ROWS = PaneLayoutFixture.build(
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

describe('PaneSeparators.findSeparators', () => {
	it('finds the horizontal line between two stacked panes', () => {
		const separatorList = PaneSeparators.findSeparators(TWO_STACKED_PANES);
		expect(separatorList).toEqual([
			{
				splitId: 'split_0_root',
				direction: 'down',
				position: 20,
				start: 0,
				end: 120,
				origin: 0,
				size: 40,
				ratio: 0.5,
				path: [],
			},
		]);
	});

	it('finds nothing when Herdr sends no split', () => {
		const layout = PaneLayoutFixture.build({ only: [0, 0, 120, 40] }, []);
		expect(PaneSeparators.findSeparators(layout)).toEqual([]);
		delete layout.splits;
		expect(PaneSeparators.findSeparators(layout)).toEqual([]);
	});

	it('finds nothing while a pane is zoomed', () => {
		const layout = { ...TWO_STACKED_PANES, zoomed: true };
		expect(PaneSeparators.findSeparators(layout)).toEqual([]);
	});

	it('puts the line of a split at the edge of the panes that belongs to the split', () => {
		const separatorList = PaneSeparators.findSeparators(THREE_STACKED_PANES);
		expect(separatorList.map((separator) => [separator.splitId, separator.position])).toEqual([
			['split_0_root', 16],
			['split_1_1', 28],
		]);
	});

	it('gives each split the way from the root of the layout', () => {
		const separatorList = PaneSeparators.findSeparators(FOUR_PANES_IN_TWO_ROWS);
		expect(separatorList.map((separator) => [separator.splitId, separator.path])).toEqual([
			['split_0_root', []],
			['split_1_0', [false]],
			['split_2_1', [true]],
		]);
	});

	it('gives a vertical line its own length and its place', () => {
		const separatorList = PaneSeparators.findSeparators(FOUR_PANES_IN_TWO_ROWS);
		const bottomLine = separatorList.find((separator) => separator.splitId === 'split_2_1');
		expect(bottomLine).toMatchObject({
			direction: 'right',
			position: 40,
			start: 12,
			end: 40,
			origin: 0,
			size: 120,
		});
	});

	it('follows a nested split of the same direction down to the second group', () => {
		const separatorList = PaneSeparators.findSeparators(THREE_STACKED_PANES);
		expect(separatorList[1].path).toEqual([true]);
		expect(separatorList[1].origin).toBe(16);
		expect(separatorList[1].size).toBe(24);
	});
});

describe('PaneSeparators.findCorners', () => {
	const outerEdges = {
		left: true,
		right: true,
	};
	const noOuterEdges = {
		left: false,
		right: false,
	};

	it('finds no corner for panes in one column when no column of the window sits against them', () => {
		const separatorList = PaneSeparators.findSeparators(TWO_STACKED_PANES);
		expect(PaneSeparators.findCorners(separatorList, TWO_STACKED_PANES.area, noOuterEdges)).toEqual([]);
	});

	it('finds a corner at each side that has a column of the window against it', () => {
		const separatorList = PaneSeparators.findSeparators(TWO_STACKED_PANES);
		const cornerList = PaneSeparators.findCorners(separatorList, TWO_STACKED_PANES.area, outerEdges);
		expect(cornerList.map((corner) => [corner.outerEdge, corner.x, corner.y])).toEqual([
			['left', 0, 20],
			['right', 120, 20],
		]);
	});

	it('finds a corner only at the side that has a column of the window against it', () => {
		const separatorList = PaneSeparators.findSeparators(TWO_STACKED_PANES);
		const leftOnly = {
			left: true,
			right: false,
		};
		const cornerList = PaneSeparators.findCorners(separatorList, TWO_STACKED_PANES.area, leftOnly);
		expect(cornerList.map((corner) => corner.outerEdge)).toEqual(['left']);
	});

	it('finds the corner where a vertical line ends on a horizontal line', () => {
		const separatorList = PaneSeparators.findSeparators(FOUR_PANES_IN_TWO_ROWS);
		const cornerList = PaneSeparators.findCorners(separatorList, FOUR_PANES_IN_TWO_ROWS.area, noOuterEdges);
		expect(cornerList.map((corner) => [corner.x, corner.y])).toEqual([
			[30, 12],
			[40, 12],
		]);
		expect(cornerList[0].horizontalSeparators.map((separator) => separator.splitId)).toEqual(['split_0_root']);
		expect(cornerList[0].verticalSeparators.map((separator) => separator.splitId)).toEqual(['split_1_0']);
	});

	it('puts the lines that meet at one point in one corner', () => {
		const separatorList = PaneSeparators.findSeparators(FOUR_PANES_IN_A_CROSS);
		const cornerList = PaneSeparators.findCorners(separatorList, FOUR_PANES_IN_A_CROSS.area, noOuterEdges);
		expect(cornerList.length).toBe(1);
		expect(cornerList[0].x).toBe(60);
		expect(cornerList[0].y).toBe(20);
		expect(cornerList[0].horizontalSeparators.map((separator) => separator.splitId)).toEqual(['split_0_root']);
		expect(cornerList[0].verticalSeparators.map((separator) => separator.splitId)).toEqual([
			'split_1_0',
			'split_2_1',
		]);
	});

	it('does not find a corner for a horizontal line that does not reach a side of the area', () => {
		const separatorList = PaneSeparators.findSeparators(FOUR_PANES_IN_TWO_ROWS);
		const cornerList = PaneSeparators.findCorners(separatorList, FOUR_PANES_IN_TWO_ROWS.area, outerEdges);
		const edgeCornerList = cornerList.filter((corner) => corner.outerEdge !== null);
		expect(edgeCornerList.map((corner) => [corner.outerEdge, corner.y])).toEqual([
			['left', 12],
			['right', 12],
		]);
	});
});

describe('PaneSeparators.moveRatio', () => {
	it('adds the move, divided by the size of the split, to the share', () => {
		const separator = PaneSeparators.findSeparators(TWO_STACKED_PANES)[0];
		expect(PaneSeparators.moveRatio(separator, 4)).toBeCloseTo(0.6);
		expect(PaneSeparators.moveRatio(separator, -8)).toBeCloseTo(0.3);
	});

	it('stays between 0 and 1', () => {
		const separator = PaneSeparators.findSeparators(TWO_STACKED_PANES)[0];
		expect(PaneSeparators.moveRatio(separator, 1000)).toBe(1);
		expect(PaneSeparators.moveRatio(separator, -1000)).toBe(0);
	});
});
