// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { WrappedLines } from './wrapped_lines';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	WrappedLinesTest — the screen lines that a coding agent wrapped itself (issue #574)
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** Gives the screen lines of a test, as the detection reads them. */
function screen(lines: string[]): (index: number) => string | null {
	return (index) => lines[index] ?? null;
}

/** Pads a line with letters up to an exact length, to put its end at the right edge of a pane. */
function upTo(start: string, length: number): string {
	return start + 'x'.repeat(length - start.length);
}

describe('WrappedLines.isWrapped', () => {
	it('sees a wrap at a space: the first word of the next line did not fit (measured in Claude Code, 119 columns)', () => {
		const previous = '⏺ Run this in the prompt: ! pnpm --filter web_frontend exec vitest run src/components/UsageWheel.test.ts';
		expect(previous.length).toBe(104);
		expect(WrappedLines.isWrapped(previous, '  src/components/InformationCard.test.ts src/lib/terminal_selection.test.ts', 119)).toBe(true);
	});

	it('sees a wrap inside a word: the line reaches the right edge', () => {
		expect(WrappedLines.isWrapped(upTo('! ls /a/', 119), '  bbb.txt', 119)).toBe(true);
		expect(WrappedLines.isWrapped(upTo('❯ ls /a/', 118), '  bbb.txt', 119)).toBe(true);
	});

	it('sees a real line break: the first word of the next line would have fitted', () => {
		expect(WrappedLines.isWrapped('! pnpm test', '  Then look at the result.', 119)).toBe(false);
	});

	it('never wraps into a blank line, nor from one', () => {
		expect(WrappedLines.isWrapped(upTo('! a', 119), '   ', 119)).toBe(false);
		expect(WrappedLines.isWrapped('', 'word', 119)).toBe(false);
	});
});

describe('WrappedLines.separator', () => {
	it('joins with no space after a word cut at the right edge, and with one space otherwise', () => {
		expect(WrappedLines.separator(upTo('src/compo', 119), 119)).toBe('');
		expect(WrappedLines.separator('a short line', 119)).toBe(' ');
	});
});

describe('WrappedLines.logicalLine', () => {
	it('joins the lines of a sentence that the agent wrapped, and keeps where each screen line sits in the joined text', () => {
		const lines = [
			'⏺ Run this in the prompt: ! pnpm --filter web_frontend exec vitest run src/components/UsageWheel.test.ts',
			'  src/components/InformationCard.test.ts src/lib/terminal_selection.test.ts --reporter verbose',
			'',
			'  Next paragraph.',
		];
		const logical = WrappedLines.logicalLine(screen(lines), 1, 119);
		expect(logical).toMatchObject({ first: 0, last: 1 });
		expect(logical?.text).toBe(`${lines[0]} ${lines[1].trim()}`);
		expect(logical?.segments[1]).toEqual({ row: 1, column: 2, offset: lines[0].length + 1, length: lines[1].length - 2 });
	});

	it('joins a word cut at the right edge with no space', () => {
		const first = upTo('! pnpm exec vitest run src/compo', 60);
		const logical = WrappedLines.logicalLine(screen([first, '  nents/UsageWheel.test.ts']), 0, 60);
		expect(logical?.text).toBe(`${first}nents/UsageWheel.test.ts`);
	});

	it('reads one screen line alone when nothing is wrapped', () => {
		expect(WrappedLines.logicalLine(screen(['one', 'two']), 1, 80)).toMatchObject({ first: 1, last: 1, text: 'two' });
	});

	it('reads nothing for a logical line longer than the limit, rather than a part of it', () => {
		const lines = Array.from({ length: 60 }, () => 'x'.repeat(40));
		expect(WrappedLines.logicalLine(screen(lines), 5, 40)).toBeNull();
	});
});
