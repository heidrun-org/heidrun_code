// @vitest-environment node
import type { Terminal } from '@xterm/xterm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from './api';
import { TerminalSelection } from './terminal_selection';

vi.mock('./api', () => ({
	request: vi.fn(),
}));

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	TerminalSelection — verifies original line boundaries and selection validity
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** Builds only the terminal surface needed by selection reading. */
class SelectionFixture {
	/** The visible rows, with a wrapped line followed by two intentional lines. */
	lines = ['command --long-', 'option', 'FIRST', 'SECOND'];
	/** Selected cells use xterm's exclusive end column. */
	position = {
		start: {
			x: 0,
			y: 0,
		},
		end: {
			x: 6,
			y: 1,
		},
	};
	/** The selection as the terminal displays it: a visual wrap becomes a line break. */
	displayedSelection = 'command --long-\noption';
	/** The terminal test surface. */
	terminal = {
		cols: 15,
		rows: 4,
		getSelectionPosition: () => this.position,
		getSelection: () => this.displayedSelection,
		buffer: {
			active: {
				viewportY: 0,
				getLine: (row: number) => ({
					translateToString: () => this.lines[row] ?? '',
				}),
			},
		},
	} as unknown as Terminal;

	/**
	 * Supplies the real response shapes of Herdr's two read operations.
	 * @param text - the original selected text
	 * @returns nothing
	 */
	respond(text: string): void {
		vi.mocked(request).mockResolvedValueOnce({
			content_revision: 42,
		}).mockResolvedValueOnce({
			read: {
				text: this.lines.join('\n'),
				revision: 0,
			},
		}).mockResolvedValueOnce({
			text,
		});
	}
}

describe('TerminalSelection', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it('copies wrapped rows through Herdr instead of inserting a newline', async () => {
		const fixture = new SelectionFixture();
		fixture.respond('command --long-option');
		await expect(new TerminalSelection().read(fixture.terminal, 'w1:p1'))
			.resolves.toBe('command --long-option');
		expect(request).toHaveBeenLastCalledWith('pane.selection.read', {
			pane_id: 'w1:p1',
			content_revision: 42,
			anchor: {
				row: 0,
				col: 0,
			},
			cursor: {
				row: 1,
				col: 5,
			},
		});
	});

	it('retains intentional line breaks and Unicode without rewriting text', async () => {
		const fixture = new SelectionFixture();
		fixture.displayedSelection = 'écho 界\nSECOND';
		fixture.respond('écho 界\nSECOND');
		await expect(new TerminalSelection().read(fixture.terminal, 'w1:p1'))
			.resolves.toBe('écho 界\nSECOND');
	});

	it('maps an end at the next row start to the previous row final cell', async () => {
		const fixture = new SelectionFixture();
		fixture.position.end = {
			x: 0,
			y: 2,
		};
		fixture.respond('command --long-option');
		await new TerminalSelection().read(fixture.terminal, 'w1:p1');
		expect(vi.mocked(request).mock.calls[2][1]?.cursor).toEqual({
			row: 1,
			col: 14,
		});
	});

	it('uses the displayed rows after Herdr scrolls the viewport', async () => {
		const fixture = new SelectionFixture();
		fixture.lines = ['older command', 'continued', 'FIRST', 'SECOND'];
		fixture.displayedSelection = 'older command\ncontinued';
		fixture.respond('older commandcontinued');
		await expect(new TerminalSelection().read(fixture.terminal, 'w1:p1'))
			.resolves.toBe('older commandcontinued');
	});

	it('rejects a viewport that differs from the selected displayed rows', async () => {
		const fixture = new SelectionFixture();
		vi.mocked(request).mockResolvedValueOnce({
			content_revision: 42,
		}).mockResolvedValueOnce({
			read: {
				text: 'different command\noption',
				revision: 43,
			},
		});
		await expect(new TerminalSelection().read(fixture.terminal, 'w1:p1')).rejects.toThrow('no longer matches');
		expect(request).toHaveBeenCalledTimes(2);
	});

	it('rejects output or scrolling received while a copy is in progress', async () => {
		const fixture = new SelectionFixture();
		fixture.respond('command --long-option');
		const selection = new TerminalSelection();
		const pending = selection.read(fixture.terminal, 'w1:p1');
		selection.invalidate();
		await expect(pending).rejects.toThrow('Terminal changed');
	});

	it('rejects a changed selection while a copy is in progress', async () => {
		const fixture = new SelectionFixture();
		fixture.respond('command --long-option');
		const pending = new TerminalSelection().read(fixture.terminal, 'w1:p1');
		fixture.position = {
			...fixture.position,
			end: {
				x: 3,
				y: 1,
			},
		};
		await expect(pending).rejects.toThrow('Terminal changed');
	});

	it('does not silently copy broken text when Herdr refuses a stale content revision', async () => {
		const fixture = new SelectionFixture();
		vi.mocked(request).mockResolvedValueOnce({
			content_revision: 42,
		}).mockResolvedValueOnce({
			read: {
				text: fixture.lines.join('\n'),
				revision: 0,
			},
		}).mockRejectedValueOnce(new Error('stale_content'));
		await expect(new TerminalSelection().read(fixture.terminal, 'w1:p1')).rejects.toThrow('stale_content');
	});
});

describe('TerminalSelection.readForCopy (issue #803)', () => {
	beforeEach(() => {
		vi.resetAllMocks();
		// A failure of Herdr is expected in some tests: keep their warnings out of the output.
		vi.spyOn(console, 'warn').mockImplementation(() => {});
	});

	it('copies the original text from Herdr when the terminal does not change', async () => {
		const fixture = new SelectionFixture();
		fixture.respond('command --long-option');
		await expect(new TerminalSelection().readForCopy(fixture.terminal, 'w1:p1'))
			.resolves.toBe('command --long-option');
	});

	it('copies the displayed selection when the terminal receives output during the copy', async () => {
		const fixture = new SelectionFixture();
		fixture.respond('command --long-option');
		const selection = new TerminalSelection();
		const pending = selection.readForCopy(fixture.terminal, 'w1:p1');
		selection.invalidate();
		await expect(pending).resolves.toBe('command --long-\noption');
	});

	it('copies the displayed selection when the selection is outside the visible rows', async () => {
		const fixture = new SelectionFixture();
		fixture.position = {
			start: {
				x: 0,
				y: 0,
			},
			end: {
				x: 3,
				y: 6,
			},
		};
		fixture.displayedSelection = 'older output\nFIRST';
		await expect(new TerminalSelection().readForCopy(fixture.terminal, 'w1:p1'))
			.resolves.toBe('older output\nFIRST');
		expect(request).not.toHaveBeenCalled();
	});

	it('copies the selection that was displayed when the copy started, even if it is cleared during the copy', async () => {
		const fixture = new SelectionFixture();
		vi.mocked(request).mockRejectedValueOnce(new Error('Herdr is not reachable'));
		const pending = new TerminalSelection().readForCopy(fixture.terminal, 'w1:p1');
		fixture.displayedSelection = '';
		await expect(pending).resolves.toBe('command --long-\noption');
	});

	it('rejects when the selection shows no text and Herdr cannot give the original text, so the copy is not taken for a success', async () => {
		const fixture = new SelectionFixture();
		fixture.displayedSelection = '';
		vi.mocked(request).mockRejectedValueOnce(new Error('Herdr is not reachable'));
		await expect(new TerminalSelection().readForCopy(fixture.terminal, 'w1:p1')).rejects.toThrow('no text');
	});

	it('warns in the console when Herdr fails, but not when the terminal only changed', async () => {
		const warn = vi.mocked(console.warn);
		const fixture = new SelectionFixture();
		const selection = new TerminalSelection();
		fixture.respond('command --long-option');
		const pending = selection.readForCopy(fixture.terminal, 'w1:p1');
		selection.invalidate();
		await pending;
		expect(warn).not.toHaveBeenCalled();

		vi.mocked(request).mockReset().mockRejectedValueOnce(new Error('unknown method'));
		await selection.readForCopy(fixture.terminal, 'w1:p1');
		expect(warn).toHaveBeenCalledTimes(1);
	});

	it('stops asking Herdr as soon as the terminal changed', async () => {
		const fixture = new SelectionFixture();
		fixture.respond('command --long-option');
		const selection = new TerminalSelection();
		const pending = selection.readForCopy(fixture.terminal, 'w1:p1');
		selection.invalidate();
		await pending;
		expect(request).toHaveBeenCalledTimes(1);
	});
});

describe('TerminalSelection compares the text of Herdr with the selection (issue #805)', () => {
	beforeEach(() => {
		vi.resetAllMocks();
		vi.spyOn(console, 'warn').mockImplementation(() => {});
	});

	it('rejects a text of Herdr that comes from other rows, even with the same length', async () => {
		const fixture = new SelectionFixture();
		fixture.displayedSelection = 'REPERE-COPIE-803';
		fixture.respond('    240  .file-v');
		await expect(new TerminalSelection().read(fixture.terminal, 'w1:p1')).rejects.toThrow('another text');
	});

	it('copies the displayed selection, and warns with the two texts, when Herdr returns another text', async () => {
		const fixture = new SelectionFixture();
		fixture.displayedSelection = 'REPERE-COPIE-803';
		fixture.respond('    240  .file-v');
		await expect(new TerminalSelection().readForCopy(fixture.terminal, 'w1:p1')).resolves.toBe('REPERE-COPIE-803');
		expect(vi.mocked(console.warn).mock.calls[0][1].message).toContain('"    240  .file-v"');
	});

	it('copies the wrapped command joined on one line when Herdr returns the selected text', async () => {
		const fixture = new SelectionFixture();
		fixture.displayedSelection = 'command --long-\noption';
		fixture.respond('command --long-option');
		await expect(new TerminalSelection().readForCopy(fixture.terminal, 'w1:p1')).resolves.toBe('command --long-option');
		expect(console.warn).not.toHaveBeenCalled();
	});

	it('accepts the trailing spaces of the displayed rows', async () => {
		const fixture = new SelectionFixture();
		fixture.displayedSelection = 'FIRST   \nSECOND';
		fixture.respond('FIRST\nSECOND');
		await expect(new TerminalSelection().readForCopy(fixture.terminal, 'w1:p1')).resolves.toBe('FIRST\nSECOND');
		expect(console.warn).not.toHaveBeenCalled();
	});
});

describe('TerminalSelection.copy writes the displayed selection at once (issue #805)', () => {
	beforeEach(() => {
		vi.resetAllMocks();
		vi.spyOn(console, 'warn').mockImplementation(() => {});
	});

	it('writes the displayed selection before Herdr answers, so that a paste right after the copy gets it', async () => {
		const fixture = new SelectionFixture();
		let answer: (value: unknown) => void = () => {};
		vi.mocked(request).mockReturnValueOnce(new Promise((resolve) => {
			answer = resolve;
		}));
		const write = vi.fn(async () => {});
		const pending = new TerminalSelection().copy(fixture.terminal, 'w1:p1', write);
		await Promise.resolve();
		expect(write).toHaveBeenCalledWith('command --long-\noption');
		answer({ content_revision: 42 });
		vi.mocked(request).mockResolvedValueOnce({ read: { text: fixture.lines.join('\n') } }).mockResolvedValueOnce({ text: 'command --long-option' });
		await pending;
	});

	it('replaces the displayed selection with the original text of Herdr when Herdr confirms it', async () => {
		const fixture = new SelectionFixture();
		fixture.respond('command --long-option');
		const write = vi.fn(async () => {});
		await new TerminalSelection().copy(fixture.terminal, 'w1:p1', write);
		expect(write.mock.calls).toEqual([['command --long-\noption'], ['command --long-option']]);
	});

	it('keeps the displayed selection when Herdr returns another text', async () => {
		const fixture = new SelectionFixture();
		fixture.displayedSelection = 'REPERE-COPIE-803';
		fixture.respond('    240  .file-v');
		const write = vi.fn(async () => {});
		await new TerminalSelection().copy(fixture.terminal, 'w1:p1', write);
		expect(write.mock.calls).toEqual([['REPERE-COPIE-803']]);
	});

	it('writes once when the original text is the displayed selection', async () => {
		const fixture = new SelectionFixture();
		fixture.displayedSelection = 'FIRST';
		fixture.respond('FIRST');
		const write = vi.fn(async () => {});
		await new TerminalSelection().copy(fixture.terminal, 'w1:p1', write);
		expect(write).toHaveBeenCalledTimes(1);
	});

	it('does not replace the text of a newer copy with the original text of an older one', async () => {
		const fixture = new SelectionFixture();
		fixture.respond('command --long-option');
		const selection = new TerminalSelection();
		const write = vi.fn(async () => {});
		const older = selection.copy(fixture.terminal, 'w1:p1', write);
		const newer = new SelectionFixture();
		newer.displayedSelection = 'NEWER';
		vi.mocked(request).mockRejectedValue(new Error('Herdr is not reachable'));
		await selection.copy(newer.terminal, 'w1:p1', write);
		await older;
		expect(write).not.toHaveBeenCalledWith('command --long-option');
		expect(write).toHaveBeenLastCalledWith('NEWER');
	});

	it('rejects when the selection has no text, and when the clipboard cannot be written', async () => {
		const fixture = new SelectionFixture();
		fixture.displayedSelection = '';
		await expect(new TerminalSelection().copy(fixture.terminal, 'w1:p1', vi.fn(async () => {}))).rejects.toThrow('no text');
		fixture.displayedSelection = 'FIRST';
		await expect(new TerminalSelection().copy(fixture.terminal, 'w1:p1', async () => Promise.reject(new Error('refused')))).rejects.toThrow('refused');
	});
});
