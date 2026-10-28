// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DETECTION_FAMILY_IDS, type DetectionFamilyId } from './detection_families';
import { findShellBlock, type RefContext } from './refs';
import { TerminalDetection, type DetectedItem } from './terminal_detection';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	WrappedShellCommandsTest — a "! command" that the coding agent wrote on several lines is run whole (issue #574)
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The repository of the tests. */
const GITHUB: RefContext = {
	base: 'https://github.com/org/app',
	origin: 'https://github.com',
	forge: 'github',
	ticketUrl: '',
	ticketPrefixes: [],
	enabled: true,
};

/** Every detection family is on. */
const ALL_ON: ReadonlySet<DetectionFamilyId> = new Set(DETECTION_FAMILY_IDS);

/** Gives the screen lines of a test, as the detection reads them. */
function screen(lines: string[]): (index: number) => string | null {
	return (index) => lines[index] ?? null;
}

/** Pads a line with spaces of nothing: puts its last character at an exact column. */
function upTo(start: string, length: number): string {
	return start + 'x'.repeat(length - start.length);
}

/** Reads a screen line of a pane, and gives its item of the family "shellCommands". */
function shellItem(lines: string[], row: number, columns: number, agent = 'claude', textEndsAtLastLine = true): DetectedItem | undefined {
	const result = TerminalDetection.detectLine({
		lineAt: screen(lines),
		row,
		rows: lines.length,
		columns,
		context: GITHUB,
		knownCommands: new Set(),
		agent,
		enabledFamilies: ALL_ON,
		textEndsAtLastLine,
	});
	return result.items.find((item) => item.family === 'shellCommands');
}

/** The answer of Claude Code measured on 22 October 2026, in a pane of 119 columns. */
const MEASURED = [
	'⏺ Run this in the prompt: ! pnpm --filter web_frontend exec vitest run src/components/UsageWheel.test.ts',
	'  src/components/InformationCard.test.ts src/lib/terminal_selection.test.ts --reporter verbose',
	'',
];

/** The whole command of `MEASURED`, on one line. */
const MEASURED_COMMAND =
	'pnpm --filter web_frontend exec vitest run src/components/UsageWheel.test.ts src/components/InformationCard.test.ts src/lib/terminal_selection.test.ts --reporter verbose';

describe('A "! command" inside a sentence, on several lines', () => {
	it('sends the whole command from the first line', () => {
		expect(shellItem(MEASURED, 0, 119)?.commandClick).toEqual({ type: 'sendPrompt', text: `! ${MEASURED_COMMAND}` });
	});

	it('sends the whole command from the second line, and underlines only the command on it', () => {
		const item = shellItem(MEASURED, 1, 119);
		expect(item?.commandClick).toEqual({ type: 'sendPrompt', text: `! ${MEASURED_COMMAND}` });
		expect(item?.start).toBe(2);
		expect(MEASURED[1].slice(item!.start, item!.end)).toBe(MEASURED[1].trim());
	});

	it('shows the whole command, as it will be sent, before the click', () => {
		expect(shellItem(MEASURED, 0, 119)?.destination).toBe(`! ${MEASURED_COMMAND}`);
	});

	it('ends the command at the end of the sentence, also on the next line', () => {
		const lines = ['⏺ Run ! pnpm --filter web_frontend exec vitest run src/a.test.ts', '  src/b.test.ts. Then look at the result.'];
		const item = shellItem(lines, 1, 70);
		expect(item?.commandClick).toEqual({ type: 'sendPrompt', text: '! pnpm --filter web_frontend exec vitest run src/a.test.ts src/b.test.ts' });
	});

	it('reads it also in a pane of Codex', () => {
		expect(shellItem(MEASURED, 1, 119, 'codex')?.commandClick).toEqual({ type: 'sendPrompt', text: `! ${MEASURED_COMMAND}` });
	});
});

describe('A "! command" at the start of a line, on several lines', () => {
	it('joins a word cut at the right edge with no space: the example of the developer', () => {
		const first = upTo('! pnpm --filter web_frontend exec vitest run src/compo', 54);
		expect(first).toBe('! pnpm --filter web_frontend exec vitest run src/compo');
		const block = findShellBlock(screen([first, '  nents/UsageWheel.test.ts']), 1, 54, true);
		expect(block?.command).toBe('pnpm --filter web_frontend exec vitest run src/components/UsageWheel.test.ts');
	});

	it('keeps on a continuation line that starts with "--", after a line that the agent wrapped', () => {
		const lines = ['! pnpm --filter web_frontend exec vitest run src/components/UsageWheel.test.ts', '  --reporter verbose'];
		expect(findShellBlock(screen(lines), 0, 80, true)?.command).toBe(
			'pnpm --filter web_frontend exec vitest run src/components/UsageWheel.test.ts --reporter verbose',
		);
	});

	it('reads the example of the issue: a quote wrapped by the agent, then a line continued with a backslash', () => {
		const lines = [
			'! gh issue create --title "Clean the text of a note" --body "The note keeps the line breaks of the',
			'  terminal." --label enhancement \\',
			'    --assignee edefiez',
		];
		expect(findShellBlock(screen(lines), 2, 100, true)?.command).toBe(
			'gh issue create --title "Clean the text of a note" --body "The note keeps the line breaks of the terminal." --label enhancement --assignee edefiez',
		);
	});

	it('keeps two spaces inside quotes', () => {
		expect(findShellBlock(screen(['! git commit -m "a  b"']), 0, 80, true)?.command).toBe('git commit -m "a  b"');
	});

	it('reads a command of 15 lines continued with backslashes', () => {
		const lines = ['! make all \\', ...Array.from({ length: 13 }, (_, index) => `  STEP${index}=1 \\`), '  done'];
		const block = findShellBlock(screen(lines), 14, 80, true);
		expect(block?.last).toBe(14);
		expect(block?.command.endsWith('STEP12=1 done')).toBe(true);
	});

	it('proposes nothing for a command longer than 50 lines, rather than a part of it', () => {
		const lines = ['! make all \\', ...Array.from({ length: 60 }, () => '  X=1 \\'), '  done'];
		expect(findShellBlock(screen(lines), 3, 80, true)).toBeNull();
	});

	it('ends at an empty line, at a new "!", and at a new item of the agent', () => {
		expect(findShellBlock(screen(['! pnpm test', '', '  more']), 0, 80, true)?.last).toBe(0);
		expect(findShellBlock(screen(['! pnpm test', '! pnpm lint']), 0, 80, true)?.command).toBe('pnpm test');
		expect(findShellBlock(screen(['! pnpm test', '⏺ Done.']), 0, 80, true)?.command).toBe('pnpm test');
	});

	it('ends at a line of a list that the agent did not wrap', () => {
		expect(findShellBlock(screen(['! pnpm test', '- then check the result']), 0, 80, true)?.command).toBe('pnpm test');
	});

	it('reads it also in a pane of Codex', () => {
		const lines = ['! pnpm --filter web_frontend exec vitest run src/components/UsageWheel.test.ts', '  --reporter verbose'];
		expect(shellItem(lines, 1, 80, 'codex')?.commandClick).toEqual({
			type: 'sendPrompt',
			text: '! pnpm --filter web_frontend exec vitest run src/components/UsageWheel.test.ts --reporter verbose',
		});
	});
});

describe('A command that the screen may cut, or that is not a command (the code review of issue #574)', () => {
	it('proposes nothing for a "! command" that reaches the bottom of the screen: it may go on out of sight', () => {
		const lines = ['! rm -rf ~/Library/Caches/some/very/long/path/that/the/agent/wrapped/at/the/edge', '  /and/goes/on'];
		expect(findShellBlock(screen(lines), 0, 80)).toBeNull();
		expect(shellItem(lines, 0, 80, 'claude', false)).toBeUndefined();
	});

	it('proposes nothing for a command inside a sentence that runs to the bottom of the screen', () => {
		expect(shellItem(MEASURED.slice(0, 2), 0, 119, 'claude', false)).toBeUndefined();
	});

	it('proposes a command that ends before the bottom of the screen', () => {
		expect(findShellBlock(screen(['! pnpm test', '', '❯ ']), 0, 80)?.command).toBe('pnpm test');
		expect(shellItem(MEASURED, 1, 119, 'claude', false)?.commandClick).toEqual({ type: 'sendPrompt', text: `! ${MEASURED_COMMAND}` });
	});

	it('never joins a new "!" or a new item of the agent, also after a line that reaches the right edge', () => {
		const first = upTo('  ! pnpm test --filter web_frontend', 80);
		expect(findShellBlock(screen([first, '  ! pnpm build', '']), 0, 80)?.command).toBe(first.trim().slice(2));
		expect(findShellBlock(screen([first, '  ⏺ Done.', '']), 0, 80)?.last).toBe(0);
	});

	it('does not join a word longer than a whole line: the agent would have cut it on the line before', () => {
		const lines = ['⏺ run ! pnpm test', `  ${'https://example.com/'.padEnd(78, 'a')}`, ''];
		expect(shellItem(lines, 0, 80)?.commandClick).toEqual({ type: 'sendPrompt', text: '! pnpm test' });
	});

	it('is not a command when the "!" has no space after it: "!48 is merged" is a merge request, also in Codex', () => {
		expect(findShellBlock(screen(['!48 is merged, next step']), 0, 80, true)).toBeNull();
		expect(shellItem(['!48 is merged, next step'], 0, 80, 'codex')).toBeUndefined();
	});

	it('reads a command of exactly 50 lines', () => {
		const lines = ['! make all \\', ...Array.from({ length: 48 }, () => '  X=1 \\'), '  done', ''];
		expect(findShellBlock(screen(lines), 0, 80)?.last).toBe(49);
	});
});
