// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { HoverButtonsPlacement, type PlacementGrid } from './hover_buttons_placement';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	HoverButtonsPlacementTest — the hover buttons never cover a character (issue #793)
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** Helpers for the test of the placement. */
class HoverButtonsPlacementTestHelper {
	/**
	 * Builds the grid of a screen from its lines of text. A space is a blank cell.
	 *
	 * @param lines - The text of each line of the screen.
	 * @param columns - The number of columns of the screen.
	 * @returns The grid.
	 */
	static gridOf(lines: string[], columns: number): PlacementGrid {
		return {
			columns,
			rows: lines.length,
			isBlank: (row, column) => (lines[row] ?? '').padEnd(columns, ' ')[column] === ' ',
		};
	}

	/**
	 * Tells whether a place covers a character.
	 *
	 * @param lines - The text of each line of the screen.
	 * @param place - The top-left cell of the place.
	 * @param widthCells - The width of the place, in cells.
	 * @param heightRows - The height of the place, in lines.
	 * @returns True when at least one cell of the place holds a character.
	 */
	static coversText(lines: string[], place: { row: number; column: number }, widthCells: number, heightRows: number): boolean {
		for (let row = place.row; row < place.row + heightRows; row++) {
			for (let column = place.column; column < place.column + widthCells; column++) {
				if ((lines[row] ?? '').padEnd(80, ' ')[column] !== ' ') {
					return true;
				}
			}
		}
		return false;
	}
}

describe('HoverButtonsPlacement, with the screen of the issue #793', () => {
	const lines = [
		'The data of the application is in two places:',
		'- ~/.config/heidrun-development/local_storage.json',
		'- ~/Library/WebKit/dev.heidrun-org.heidrun.development',
		'Nothing else.',
	];
	const grid = HoverButtonsPlacementTestHelper.gridOf(lines, 80);

	it('never covers the path on the line above the hovered path, even when the hover buttons are too wide for the line', () => {
		const place = HoverButtonsPlacement.find(grid, { row: 2, startColumn: 2, endColumn: 54, widthCells: 28, heightRows: 1 });
		expect(place).not.toBeNull();
		expect(HoverButtonsPlacementTestHelper.coversText(lines, place!, 28, 1)).toBe(false);
		expect(place!.row === 1 && place!.column < 50).toBe(false);
	});

	it('puts the hover buttons on the line of the path, after its text, when the line has room', () => {
		const place = HoverButtonsPlacement.find(grid, { row: 2, startColumn: 2, endColumn: 54, widthCells: 20, heightRows: 1 });
		expect(place).toEqual({ row: 2, column: 54 });
	});

	it('covers no character whatever the size of the hover buttons', () => {
		for (const widthCells of [10, 20, 24]) {
			for (const heightRows of [1, 2]) {
				const place = HoverButtonsPlacement.find(grid, { row: 1, startColumn: 2, endColumn: 50, widthCells, heightRows });
				if (place !== null) {
					expect(HoverButtonsPlacementTestHelper.coversText(lines, place, widthCells, heightRows)).toBe(false);
				}
			}
		}
	});
});

describe('HoverButtonsPlacement', () => {
	it('uses the line above or below when the line of the text is full', () => {
		const lines = ['', 'x'.repeat(40), ''];
		const grid = HoverButtonsPlacementTestHelper.gridOf(lines, 40);
		const place = HoverButtonsPlacement.find(grid, { row: 1, startColumn: 5, endColumn: 15, widthCells: 12, heightRows: 1 });
		expect(place).not.toBeNull();
		expect([0, 2]).toContain(place!.row);
	});

	it('returns null when every cell near the text holds a character', () => {
		const lines = ['x'.repeat(30), 'x'.repeat(30), 'x'.repeat(30)];
		const grid = HoverButtonsPlacementTestHelper.gridOf(lines, 30);
		expect(HoverButtonsPlacement.find(grid, { row: 1, startColumn: 5, endColumn: 15, widthCells: 10, heightRows: 1 })).toBeNull();
	});

	it('returns null when the only blank place is too far from the text', () => {
		const lines = ['x'.repeat(200) + ' '.repeat(60)];
		const grid = HoverButtonsPlacementTestHelper.gridOf(lines, 260);
		expect(HoverButtonsPlacement.find(grid, { row: 0, startColumn: 0, endColumn: 10, widthCells: 10, heightRows: 1 })).toBeNull();
	});

	it('stays inside the screen', () => {
		const lines = ['link here', '', ''];
		const grid = HoverButtonsPlacementTestHelper.gridOf(lines, 20);
		const place = HoverButtonsPlacement.find(grid, { row: 0, startColumn: 0, endColumn: 9, widthCells: 8, heightRows: 2 });
		expect(place).not.toBeNull();
		expect(place!.column + 8).toBeLessThanOrEqual(20);
		expect(place!.row + 2).toBeLessThanOrEqual(3);
		expect(place!.row).toBeGreaterThanOrEqual(0);
	});

	it('chooses the nearest place', () => {
		const lines = ['', 'link', ''];
		const grid = HoverButtonsPlacementTestHelper.gridOf(lines, 60);
		const place = HoverButtonsPlacement.find(grid, { row: 1, startColumn: 0, endColumn: 4, widthCells: 6, heightRows: 1 });
		expect(place).toEqual({ row: 1, column: 4 });
	});
});
