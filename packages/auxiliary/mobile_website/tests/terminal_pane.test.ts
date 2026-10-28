import { describe, expect, it } from 'vitest';
import { AppHarness } from './app_harness';
import { FakeComputer } from './fake_computer';

const terminal = () =>
	FakeComputer.agent({
		paneId: 'p-terminal',
		hasCodingAgent: false,
		name: 'zsh',
		kind: 'Terminal',
		tab: 'shell',
		status: 'unknown',
		since: null,
		context: null,
	});

const computerWithTerminal = () => {
	const computer = new FakeComputer(
		FakeComputer.snapshotOf([FakeComputer.agent({}), terminal()], []),
	);
	computer.outputText = 'jerome@computer $ git status\nclean\n';
	return computer;
};

describe('Plain terminal', () => {
	it('is listed on the Panes screen with the badge Terminal, next to the coding agents', async () => {
		const harness = await AppHarness.start(computerWithTerminal());
		await harness.tap('button[data-screen="panes"]');
		const rows = [...document.querySelectorAll<HTMLElement>('.list .card')];
		expect(rows.map((row) => row.dataset.paneId)).toEqual(['p-1', 'p-terminal']);
		expect(rows[1].querySelector('.badge')?.textContent).toBe('Terminal');
		expect(rows[1].querySelector('.dot-idle')).not.toBeNull();
	});

	it('shows its output on its screen, and a button to type, but no field for a command, until the developer allows it', async () => {
		const computer = computerWithTerminal();
		const harness = await AppHarness.start(computer);
		await harness.openPane('p-terminal');
		expect(document.querySelector('header h1')?.textContent).toBe('heidrun · shell');
		expect(document.querySelector('header .badge')?.textContent).toBe('Terminal');
		expect(document.querySelector('.output')?.textContent).toBe('jerome@computer $ git status\nclean');
		expect(harness.text()).toContain('The phone only reads this terminal until you allow typing.');
		expect(document.querySelector('[data-action="typing-ask"]')).not.toBeNull();
		for (const selector of [
			'#prompt-field',
			'[data-action="send"]',
			'[data-action="open-macros"]',
			'[data-action="interrupt"]',
			'[data-action="deny"]',
		]) {
			expect(document.querySelector(selector), selector).toBeNull();
		}
		expect(computer.callsOf('read').pop()?.params.paneId).toBe('p-terminal');
	});

	it('shows only the output, with no way to type, when the setting of Heidrun Code forbids typing', async () => {
		const computer = computerWithTerminal();
		computer.terminalTypingAllowed = false;
		const harness = await AppHarness.start(computer);
		await harness.openPane('p-terminal');
		expect(harness.text()).toContain('Typing is off in the Settings window of Heidrun Code.');
		expect(document.querySelector('[data-action="typing-ask"]')).toBeNull();
		expect(document.querySelector('#prompt-field')).toBeNull();
	});

	it('warns before it allows typing, and changes nothing when the developer cancels', async () => {
		const harness = await AppHarness.start(computerWithTerminal());
		await harness.openPane('p-terminal');
		await harness.tap('[data-action="typing-ask"]');
		expect(harness.overlay.querySelector('.typing-sheet')?.textContent).toContain('Typing on a phone is hard');
		expect(harness.overlay.querySelector('.typing-sheet')?.textContent).toContain('guards');
		await harness.tap('button[data-action="typing-cancel"]');
		expect(harness.overlay.querySelector('.typing-sheet')).toBeNull();
		expect(document.querySelector('#prompt-field')).toBeNull();
	});

	it('shows a field for a command after the developer says yes, and sends the command as a prompt of the pane', async () => {
		const computer = computerWithTerminal();
		const harness = await AppHarness.start(computer);
		await harness.openPane('p-terminal');
		await harness.tap('[data-action="typing-ask"]');
		await harness.tap('[data-action="typing-allow"]');
		expect(harness.overlay.querySelector('.typing-sheet')).toBeNull();
		expect(harness.text()).toContain('Every command passes the guards before it runs.');
		harness.field().value = 'git status';
		await harness.tap('[data-action="send"]');
		expect(computer.callsOf('prompt').map((call) => call.params)).toEqual([
			{
				paneId: 'p-terminal',
				text: 'git status',
			},
		]);
		expect(harness.field().value).toBe('');
	});

	it('asks again every time the developer opens the terminal', async () => {
		const harness = await AppHarness.start(computerWithTerminal());
		await harness.openPane('p-terminal');
		await harness.tap('[data-action="typing-ask"]');
		await harness.tap('[data-action="typing-allow"]');
		expect(document.querySelector('#prompt-field')).not.toBeNull();
		await harness.tap('.back');
		await harness.tap(`[data-action="open-pane"][data-pane-id="p-terminal"]`);
		expect(document.querySelector('#prompt-field')).toBeNull();
		expect(document.querySelector('[data-action="typing-ask"]')).not.toBeNull();
	});

	it('asks the developer to check a command that the guards stop, like any other command', async () => {
		const computer = computerWithTerminal();
		computer.answers.prompt = [
			{
				confirm: {
					command: 'rm -rf build',
					why: 'deletes files',
				},
			},
			{
				ok: true,
			},
		];
		const harness = await AppHarness.start(computer);
		await harness.openPane('p-terminal');
		await harness.tap('[data-action="typing-ask"]');
		await harness.tap('[data-action="typing-allow"]');
		harness.field().value = 'rm -rf build';
		await harness.tap('[data-action="send"]');
		expect(harness.overlay.querySelector('.sheet')?.textContent).toContain('rm -rf build');
		await harness.tap('[data-action="sheet-confirm"]');
		expect(computer.callsOf('prompt').pop()?.params).toMatchObject({
			confirmed: true,
			command: 'rm -rf build',
		});
	});

	it('keeps the output fresh with a refresh', async () => {
		const computer = computerWithTerminal();
		const harness = await AppHarness.start(computer);
		await harness.openPane('p-terminal');
		computer.outputText = 'a new line\n';
		await harness.settle(3000);
		expect(document.querySelector('.output')?.textContent).toBe('a new line');
	});

	it('does not count in the Dashboard, and is not in the Needs you screen', async () => {
		const harness = await AppHarness.start(computerWithTerminal(), true, '#/dashboard');
		expect(harness.text()).toContain('1 coding agent in 1 workspace');
		await harness.tap('button[data-screen="needs_you"]');
		expect(document.querySelector('[data-pane-id="p-terminal"]')).toBeNull();
	});

	it('does not need a coding agent to open it by its address', async () => {
		await AppHarness.start(computerWithTerminal(), true, '#/panes/p-terminal');
		expect(document.querySelector('.output')?.textContent).toContain('git status');
	});
});
