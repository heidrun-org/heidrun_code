// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DETECTION_FAMILY_IDS, type DetectionFamilyId } from './detection_families';
import type { RefContext } from './refs';
import { TerminalDetection, type DetectionInput } from './terminal_detection';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	TerminalDetectionTest — what is found in a line, and which rule wins (issues #793 and #638)
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The repository of the tests: a project on GitHub. */
const GITHUB: RefContext = {
	base: 'https://github.com/org/app',
	origin: 'https://github.com',
	forge: 'github',
	ticketUrl: 'https://tracker.acme.io/browse/{key}',
	ticketPrefixes: [],
	enabled: true,
};

/** Every detection family is on. */
const ALL_ON: ReadonlySet<DetectionFamilyId> = new Set(DETECTION_FAMILY_IDS);

/** Helpers for the tests of the detection. */
class TerminalDetectionTestHelper {
	/**
	 * Reads one line, the only line of a screen.
	 *
	 * @param text - The text of the line.
	 * @param overrides - The parts of the input to change.
	 * @returns The result of the detection.
	 */
	static detect(text: string, overrides: Partial<DetectionInput> = {}) {
		return TerminalDetection.detectLine({
			lineAt: (index) => (index === 0 ? text : null),
			row: 0,
			rows: 1,
			columns: 100,
			textEndsAtLastLine: true,
			context: GITHUB,
			knownCommands: new Set(['compact']),
			agent: 'claude',
			enabledFamilies: ALL_ON,
			...overrides,
		});
	}

	/**
	 * Builds the set of the detection families without one family.
	 *
	 * @param familyId - The family to turn off.
	 * @returns The families that stay on.
	 */
	static without(familyId: DetectionFamilyId): ReadonlySet<DetectionFamilyId> {
		return new Set(DETECTION_FAMILY_IDS.filter((id) => id !== familyId));
	}
}

describe('TerminalDetection, the paths of the screenshot of the issue #793', () => {
	it('finds the whole folder name, and names it in the label of the hover button', () => {
		const text = '- ~/Library/WebKit/dev.heidrun-org.heidrun-code.development';
		const { items } = TerminalDetectionTestHelper.detect(text);
		expect(items).toHaveLength(1);
		expect(items[0]).toMatchObject({ family: 'filePaths', text: '~/Library/WebKit/dev.heidrun-org.heidrun-code.development' });
		expect(items[0].primary?.labelParams).toEqual({ name: 'dev.heidrun-org.heidrun-code.development' });
		expect(items[0].end).toBe(text.length);
	});
});

describe('TerminalDetection, the rules and their families', () => {
	it('gives each kind of text to its own family', () => {
		const cases: [string, DetectionFamilyId][] = [
			['fix #12', 'issueReferences'],
			['merged PR #5', 'requestReferences'],
			['see ABC-123', 'tickets'],
			['commit 26d63ea', 'commits'],
			['edit src/app.ts:42', 'filePaths'],
			['run /compact now', 'slashCommands'],
		];
		for (const [text, familyId] of cases) {
			const families = TerminalDetectionTestHelper.detect(text).items.map((item) => item.family);
			expect(families, text).toContain(familyId);
		}
	});

	it('finds a numbered step, and a shell command inside a sentence, in a pane that runs a coding agent', () => {
		expect(TerminalDetectionTestHelper.detect('  1. Open the issue').items[0]).toMatchObject({ family: 'numberedSteps' });
		expect(TerminalDetectionTestHelper.detect('Run ! pnpm test. Then wait').items[0]).toMatchObject({
			family: 'shellCommands',
			rule: 'inlineShell',
		});
	});

	it('finds no slash command, no step, and no shell command in a plain terminal', () => {
		const detect = (text: string) => TerminalDetectionTestHelper.detect(text, { agent: null }).items.map((item) => item.family);
		expect(detect('run /compact now')).toEqual([]);
		expect(detect('  1. Open the issue')).toEqual([]);
		expect(detect('Run ! pnpm test. Then wait')).toEqual([]);
		expect(detect('see #12 and src/app.ts')).toEqual(['issueReferences', 'filePaths']);
	});

	it('finds slash commands only in a pane that runs Claude Code', () => {
		const detect = (agent: string) => TerminalDetectionTestHelper.detect('run /compact now', { agent }).items.length;
		expect(detect('claude')).toBe(1);
		expect(detect('codex')).toBe(0);
	});

	it('keeps the piece but gives it no action when the repository is not known', () => {
		const empty: RefContext = { ...GITHUB, base: null, origin: null, forge: null };
		const [item] = TerminalDetectionTestHelper.detect('fix #12', { context: empty }).items;
		expect(item).toMatchObject({ family: 'issueReferences', primary: null, commandClick: null, destination: null });
	});

	it('gives an issue the buttons Open and Preview, and a ⌘-click that previews', () => {
		const [item] = TerminalDetectionTestHelper.detect('fix #12').items;
		expect(item.primary?.action).toEqual({ type: 'openAddress', url: 'https://github.com/org/app/issues/12' });
		expect(item.secondary?.action).toMatchObject({ type: 'previewIssue', target: { type: 'issue', number: 12 } });
		expect(item.commandClick).toMatchObject({ type: 'previewIssue' });
	});

	it('gives a commit the button Open only, and a ⌘-click that opens', () => {
		const [item] = TerminalDetectionTestHelper.detect('commit 26d63ea').items;
		expect(item.secondary).toBeNull();
		expect(item.commandClick).toEqual({ type: 'openAddress', url: 'https://github.com/org/app/commit/26d63ea' });
	});
});

describe('TerminalDetection, the switches', () => {
	it('keeps a piece of a family that is off, marked as off', () => {
		const { items } = TerminalDetectionTestHelper.detect('edit src/app.ts', {
			enabledFamilies: TerminalDetectionTestHelper.without('filePaths'),
		});
		expect(items).toHaveLength(1);
		expect(items[0]).toMatchObject({ family: 'filePaths', isEnabled: false });
	});

	it('does not read "PR #12" as the issue "#12" when the pull requests are off', () => {
		const { items } = TerminalDetectionTestHelper.detect('merged PR #12 today', {
			enabledFamilies: TerminalDetectionTestHelper.without('requestReferences'),
		});
		expect(items.filter((item) => item.isEnabled)).toEqual([]);
		expect(items.map((item) => item.family)).toEqual(['requestReferences']);
	});

	it('does not color the references of a family that is off, and does not read them as another family', () => {
		const withoutRequests = TerminalDetectionTestHelper.without('requestReferences');
		expect(TerminalDetection.findColoredReferences('merged PR #12 today', GITHUB, withoutRequests)).toEqual([]);
		expect(TerminalDetection.findColoredReferences('merged PR #12 and #13', GITHUB, withoutRequests).map((m) => m.target?.number)).toEqual([13]);
		expect(TerminalDetection.findColoredReferences('merged PR #12 today', GITHUB, ALL_ON)).toHaveLength(1);
		expect(TerminalDetection.findColoredReferences('merged PR #12 today', GITHUB, new Set())).toEqual([]);
	});

	it('colors nothing when the whole detection is off', () => {
		expect(TerminalDetection.findColoredReferences('fix #12 and 26d63ea and ABC-123', GITHUB, new Set())).toEqual([]);
	});

	it('does not let a file path take back the text of a commit identifier when the commits are off', () => {
		const { items } = TerminalDetectionTestHelper.detect('see logs/26d63ea.txt', {
			enabledFamilies: TerminalDetectionTestHelper.without('commits'),
		});
		expect(items.filter((item) => item.isEnabled)).toEqual([]);
		expect(items.map((item) => item.family)).toEqual(['commits']);
	});
});

describe('TerminalDetection, the precedence', () => {
	it('lets a shell command in a sentence take a reference inside it', () => {
		const { items, suppressed } = TerminalDetectionTestHelper.detect('Run ! gh issue view 12 --repo org/app#9. Then wait');
		expect(items.map((item) => item.family)).toEqual(['shellCommands']);
		expect(suppressed).toEqual([
			expect.objectContaining({ family: 'issueReferences', byFamily: 'shellCommands', byRule: 'inlineShell' }),
		]);
	});

	it('lets a commit identifier take the text of the file name that holds it, and says so', () => {
		const { items, suppressed } = TerminalDetectionTestHelper.detect('see logs/26d63ea.txt');
		expect(items.map((item) => item.family)).toEqual(['commits']);
		expect(suppressed).toEqual([expect.objectContaining({ family: 'filePaths', byFamily: 'commits', byRule: 'commitHash' })]);
	});

	it('lets the whole-line shell command take every other piece of its line', () => {
		const lines = ['! git push origin main # fixes #12', ''];
		const { items, suppressed } = TerminalDetection.detectLine({
			lineAt: (index) => lines[index] ?? null,
			row: 0,
			rows: 2,
			columns: 100,
			context: GITHUB,
			knownCommands: new Set(),
			agent: 'claude',
			enabledFamilies: ALL_ON,
		});
		expect(items).toHaveLength(1);
		expect(items[0]).toMatchObject({ family: 'shellCommands', rule: 'shellBlock' });
		expect(items[0].commandClick).toEqual({ type: 'sendPrompt', text: '! git push origin main # fixes #12' });
		expect(suppressed.map((lost) => lost.family).sort()).toEqual(['issueReferences', 'shellCommands']);
	});

	it('ends the hover zone of a numbered step before the next piece of the line', () => {
		const { items } = TerminalDetectionTestHelper.detect('  1. Fix #12 in the code');
		expect(items.map((item) => item.family)).toEqual(['numberedSteps', 'issueReferences']);
		const [step, issue] = items;
		expect(step.end).toBeLessThanOrEqual(issue.start);
	});

	it('gives no numbered step to a line whose step marker another piece covers', () => {
		const { items } = TerminalDetectionTestHelper.detect('1. Open the issue');
		expect(items.map((item) => item.family)).toEqual(['numberedSteps']);
	});

	it('does not depend on the switches: the same pieces win with every family on and with one family off', () => {
		const text = 'merged PR #12 and #13, see src/app.ts:4';
		const allOn = TerminalDetectionTestHelper.detect(text);
		const withoutFiles = TerminalDetectionTestHelper.detect(text, { enabledFamilies: TerminalDetectionTestHelper.without('filePaths') });
		expect(withoutFiles.items.map((item) => [item.start, item.end])).toEqual(allOn.items.map((item) => [item.start, item.end]));
	});
});

describe('TerminalDetection, the web addresses', () => {
	it('finds a plain web address and no web address inside an issue address', () => {
		const text = 'see https://example.com/page and https://github.com/org/app/issues/12';
		const { items } = TerminalDetectionTestHelper.detect(text);
		const web = TerminalDetection.findPlainWebAddresses(text, items, ALL_ON);
		expect(web.map((item) => item.text)).toEqual(['https://example.com/page']);
		expect(items.map((item) => item.family)).toEqual(['issueReferences']);
	});

	it('gives a web address back to the family of the web addresses when the issues are off', () => {
		const text = 'see https://github.com/org/app/issues/12.';
		const enabled = TerminalDetectionTestHelper.without('issueReferences');
		const { items } = TerminalDetectionTestHelper.detect(text, { enabledFamilies: enabled });
		const web = TerminalDetection.findPlainWebAddresses(text, items, enabled);
		expect(web.map((item) => item.text)).toEqual(['https://github.com/org/app/issues/12']);
		expect(web[0].isEnabled).toBe(true);
	});

	it('marks a web address as off when the family of the web addresses is off', () => {
		const text = 'see https://example.com/page';
		const web = TerminalDetection.findPlainWebAddresses(text, [], TerminalDetectionTestHelper.without('webAddresses'));
		expect(web[0].isEnabled).toBe(false);
	});

	it('answers the web-link add-on for the address of an issue, a pull request, and a commit', () => {
		const find = (address: string, enabled = ALL_ON) => TerminalDetection.findAddressReference(address, GITHUB, enabled);
		expect(find('https://github.com/org/app/issues/12')?.secondary?.action).toMatchObject({ type: 'previewIssue' });
		expect(find('https://github.com/org/app/pull/5')?.family).toBe('requestReferences');
		expect(find('https://github.com/org/app/commit/26d63ea')?.family).toBe('commits');
		expect(find('https://example.com/page')).toBeNull();
		expect(find('https://github.com/org/app/issues/12', TerminalDetectionTestHelper.without('issueReferences'))).toBeNull();
	});
});

describe('TerminalDetection, a sample text', () => {
	const options = { context: GITHUB, knownCommands: new Set(['compact']), agent: 'claude', enabledFamilies: ALL_ON };

	it('reads each line of the sample, and numbers the lines from 1', () => {
		const sample = TerminalDetection.detectText('fix #12\nopen src/app.ts:3', options);
		expect(sample.lines.map((line) => line.number)).toEqual([1, 2]);
		expect(sample.lines[0].items[0]).toMatchObject({ family: 'issueReferences', start: 4, end: 7 });
		expect(sample.lines[1].items[0]).toMatchObject({ family: 'filePaths' });
	});

	it('lists the web addresses with the other pieces, sorted by position', () => {
		const sample = TerminalDetection.detectText('#12 then https://example.com/a', options);
		expect(sample.lines[0].items.map((item) => item.family)).toEqual(['issueReferences', 'webAddresses']);
	});

	it('lists the pieces that lost, with the rule that won', () => {
		const sample = TerminalDetection.detectText('see logs/26d63ea.txt', options);
		expect(sample.lines[0].suppressed).toEqual([expect.objectContaining({ family: 'filePaths', byFamily: 'commits' })]);
	});

	it('reads the question and the numbered choices of a coding agent, and nothing for a plain terminal', () => {
		const screen = ['Do you want to run this command?', '  git status', '❯ 1. Yes', '  2. No'].join('\n');
		const asAgent = TerminalDetection.detectText(screen, options);
		expect(asAgent.screen?.choices?.options).toHaveLength(2);
		const asTerminal = TerminalDetection.detectText(screen, { ...options, agent: null });
		expect(asTerminal.screen).toBeNull();
	});

	it('marks the question and the choices as off when their family is off', () => {
		const screen = ['● Done.', '', 'Should I merge?'].join('\n');
		const sample = TerminalDetection.detectText(screen, { ...options, enabledFamilies: TerminalDetectionTestHelper.without('questionsAndChoices') });
		expect(sample.screen).toMatchObject({ question: 'Should I merge?', isEnabled: false });
	});

	it('runs no action: the result only describes the actions', () => {
		const sample = TerminalDetection.detectText('run /compact and ! pnpm test.', options);
		const types = sample.lines[0].items.flatMap((item) => (item.commandClick === null ? [] : [item.commandClick.type]));
		expect(types).toEqual(['sendPrompt', 'sendPrompt']);
	});
});

describe('TerminalDetection.shortCommand', () => {
	it('keeps a short command and cuts a long one with an ellipsis', () => {
		expect(TerminalDetection.shortCommand('git status')).toBe('git status');
		expect(TerminalDetection.shortCommand('x'.repeat(60))).toBe(`${'x'.repeat(48)}…`);
	});
});
