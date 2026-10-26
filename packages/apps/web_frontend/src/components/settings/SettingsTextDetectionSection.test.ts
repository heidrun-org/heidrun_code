import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsTextDetectionSection from './SettingsTextDetectionSection.vue';
import { DetectionCatalog } from '../../lib/detection_catalog';
import { DETECTION_FAMILY_IDS } from '../../lib/detection_families';
import { DetectionPatterns } from '../../lib/detection_patterns';
import { settings } from '../../stores/settings';
import { state } from '../../stores/session';

const mocks = vi.hoisted(() => ({
	invoke: vi.fn(async (name: string, args?: { cwd?: string }): Promise<unknown> => {
		if (name === 'project_refs' && args?.cwd === '/work/tracker') {
			return {
				root: '/work/tracker',
				remote: 'git@github.com:org/tracker.git',
				references: { tickets: 'https://acme.atlassian.net/browse/{key}' },
			};
		}
		if (name === 'project_refs') {
			return { root: '/work/app', remote: 'git@github.com:org/app.git', references: null };
		}
		if (name === 'claude_commands') {
			return ['compact'];
		}
		return null;
	}),
	openUrl: vi.fn(async () => {}),
}));
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }));
vi.mock('@tauri-apps/api/webview', () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: mocks.openUrl }));

enableAutoUnmount(afterEach);

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	SettingsTextDetectionSectionTest — the section "Text detection": switches, project data, rules, and the field "Try a text" (issue #638)
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** Helpers for the test of the section "Text detection" of the Settings window. */
class SettingsTextDetectionTestHelper {
	/**
	 * Mounts the section, with a selected workspace whose folder has a GitHub remote.
	 *
	 * @param folder - The folder of the selected workspace.
	 * @returns The mounted section.
	 */
	static async mountPart(folder = '/work/app') {
		state.snapshot = {
			version: 'test',
			protocol: 22,
			workspaces: [
				{
					workspace_id: 'w1',
					number: 1,
					label: 'App',
					focused: true,
					pane_count: 0,
					tab_count: 0,
					active_tab_id: '',
					agent_status: 'idle',
					workspace_folder: folder,
				},
			],
			tabs: [],
			panes: [],
			agents: [],
			layouts: [],
		};
		state.selectedWorkspaceId = 'w1';
		const wrapper = mount(SettingsTextDetectionSection);
		await flushPromises();
		return wrapper;
	}

	/**
	 * Types a sample and waits for the result.
	 *
	 * @param wrapper - The mounted part.
	 * @param sample - The sample text.
	 */
	static async typeSample(wrapper: Awaited<ReturnType<typeof SettingsTextDetectionTestHelper.mountPart>>, sample: string): Promise<void> {
		await wrapper.get('textarea').setValue(sample);
		await flushPromises();
	}

	/**
	 * Reads the lines of the result of the sample.
	 *
	 * @param wrapper - The mounted part.
	 * @returns The text of each found piece and each lost piece.
	 */
	static resultText(wrapper: Awaited<ReturnType<typeof SettingsTextDetectionTestHelper.mountPart>>): string {
		return wrapper.find('[data-sample-result]').text();
	}
}

beforeEach(() => {
	localStorage.clear();
	settings.language = 'en';
	settings.terminalTextDetection = true;
	settings.disabledDetectionFamilies = [];
	mocks.openUrl.mockClear();
});

describe('the switches of the text detection', () => {
	it('shows the switch of the whole detection, then one switch for each family, in the order of the families', async () => {
		const wrapper = await SettingsTextDetectionTestHelper.mountPart();
		expect(wrapper.findAll('[data-option="textDetection"]')).toHaveLength(1);
		const rows = wrapper.findAll('[data-option="detectionFamily"]');
		expect(rows).toHaveLength(DETECTION_FAMILY_IDS.length);
		expect(rows.map((row) => row.get('label').text())).toEqual([
			'Web addresses',
			'Issues',
			'Pull requests and merge requests',
			'Ticket keys (ABC-123)',
			'Commits',
			'File paths',
			'Shell commands',
			'Slash commands',
			'Numbered steps',
			'Agent list and input box',
			'Questions and numbered choices',
		]);
	});

	it('shows every switch on by default', async () => {
		const wrapper = await SettingsTextDetectionTestHelper.mountPart();
		const switches = wrapper.findAll('input[type=checkbox]');
		expect(switches).toHaveLength(DETECTION_FAMILY_IDS.length + 1);
		for (const input of switches) {
			expect((input.element as HTMLInputElement).checked).toBe(true);
		}
	});

	it('saves a family that the developer turns off, and turns it on again', async () => {
		const wrapper = await SettingsTextDetectionTestHelper.mountPart();
		const filePaths = wrapper.findAll('[data-option="detectionFamily"]')[DETECTION_FAMILY_IDS.indexOf('filePaths')].get('input');
		await filePaths.setValue(false);
		expect(settings.disabledDetectionFamilies).toEqual(['filePaths']);
		expect(settings.terminalTextDetection).toBe(true);
		await filePaths.setValue(true);
		expect(settings.disabledDetectionFamilies).toEqual([]);
	});

	it('turns the whole detection off, keeps the family switches, and blocks them', async () => {
		settings.disabledDetectionFamilies = ['tickets'];
		const wrapper = await SettingsTextDetectionTestHelper.mountPart();
		await wrapper.get('[data-option="textDetection"] input').setValue(false);
		expect(settings.terminalTextDetection).toBe(false);
		expect(settings.disabledDetectionFamilies).toEqual(['tickets']);
		for (const row of wrapper.findAll('[data-option="detectionFamily"]')) {
			expect(row.get('input').attributes('disabled')).toBeDefined();
		}
		const ticketsRow = wrapper.findAll('[data-option="detectionFamily"]')[DETECTION_FAMILY_IDS.indexOf('tickets')];
		expect((ticketsRow.get('input').element as HTMLInputElement).checked).toBe(false);
	});
});

describe('the field "Try a text"', () => {
	it('has a visible label for the text and for the kind of pane', async () => {
		const wrapper = await SettingsTextDetectionTestHelper.mountPart();
		const labels = wrapper.findAll('[data-option="textDetectionSample"] label').map((label) => label.text());
		expect(labels).toEqual(['Try a text', 'Pretend the pane runs']);
		for (const control of wrapper.findAll('textarea, select')) {
			expect(wrapper.find(`label[for="${control.attributes('id')}"]`).exists()).toBe(true);
		}
	});

	it('names the repository of the selected workspace', async () => {
		const wrapper = await SettingsTextDetectionTestHelper.mountPart();
		expect(wrapper.text()).toContain('Repository of the selected workspace: https://github.com/org/app');
	});

	it('shows nothing before the developer types, and a plain sentence when nothing is found', async () => {
		const wrapper = await SettingsTextDetectionTestHelper.mountPart();
		expect(wrapper.find('[data-sample-result]').exists()).toBe(false);
		await SettingsTextDetectionTestHelper.typeSample(wrapper, 'nothing special here');
		expect(wrapper.get('[data-sample-nothing]').text()).toBe('Nothing is found in this text.');
	});

	it('shows the family, the rule, the place, the destination, and the buttons of a found piece', async () => {
		const wrapper = await SettingsTextDetectionTestHelper.mountPart();
		await SettingsTextDetectionTestHelper.typeSample(wrapper, 'fix #12 now');
		const result = SettingsTextDetectionTestHelper.resultText(wrapper);
		expect(result).toContain('#12');
		expect(result).toContain('Line 1');
		expect(result).toContain('Characters 5 to 7');
		expect(result).toContain('Family: Issues');
		expect(result).toContain('Rule: number sign and number');
		expect(result).toContain('Destination: https://github.com/org/app/issues/12');
		expect(result).toContain('Open #12');
		expect(result).toContain('Preview');
		expect(result).toContain('⌘-click: shows the issue or the request in the preview window');
	});

	it('shows the example of the issue #793 as one whole path', async () => {
		const wrapper = await SettingsTextDetectionTestHelper.mountPart();
		await SettingsTextDetectionTestHelper.typeSample(wrapper, '- ~/Library/WebKit/dev.heidrun-org.heidrun-code.development');
		const item = wrapper.get('[data-sample-item]');
		expect(item.text()).toContain('~/Library/WebKit/dev.heidrun-org.heidrun-code.development');
		expect(item.text()).toContain('Open dev.heidrun-org.heidrun-code.development');
		expect(wrapper.findAll('[data-sample-item]')).toHaveLength(1);
	});

	it('says which rule took the text when two rules found it', async () => {
		const wrapper = await SettingsTextDetectionTestHelper.mountPart();
		await SettingsTextDetectionTestHelper.typeSample(wrapper, 'see logs/26d63ea.txt');
		const lost = wrapper.get('[data-sample-suppressed]');
		expect(lost.text()).toContain('also matches File paths (file path)');
		expect(lost.text()).toContain('Commits (commit identifier) takes this text first');
	});

	it('shows a family that is off as off, with no action', async () => {
		settings.disabledDetectionFamilies = ['issueReferences'];
		const wrapper = await SettingsTextDetectionTestHelper.mountPart();
		await SettingsTextDetectionTestHelper.typeSample(wrapper, 'fix #12');
		expect(SettingsTextDetectionTestHelper.resultText(wrapper)).toContain('This family is off: nothing happens for this text.');
	});

	it('follows a change of a switch at once', async () => {
		const wrapper = await SettingsTextDetectionTestHelper.mountPart();
		await SettingsTextDetectionTestHelper.typeSample(wrapper, 'fix #12');
		expect(SettingsTextDetectionTestHelper.resultText(wrapper)).not.toContain('This family is off');
		settings.terminalTextDetection = false;
		await flushPromises();
		expect(SettingsTextDetectionTestHelper.resultText(wrapper)).toContain('This family is off');
	});

	it('does not read a slash command or a numbered step for a plain terminal, and reads them for Claude Code', async () => {
		const wrapper = await SettingsTextDetectionTestHelper.mountPart();
		await SettingsTextDetectionTestHelper.typeSample(wrapper, '1. Run /compact now');
		expect(SettingsTextDetectionTestHelper.resultText(wrapper)).toContain('Family: Slash commands');
		expect(SettingsTextDetectionTestHelper.resultText(wrapper)).toContain('Family: Numbered steps');
		await wrapper.get('select').setValue('plain');
		expect(wrapper.find('[data-sample-result]').exists()).toBe(false);
		expect(wrapper.find('[data-sample-nothing]').exists()).toBe(true);
	});

	it('shows the question of a coding agent', async () => {
		const wrapper = await SettingsTextDetectionTestHelper.mountPart();
		await SettingsTextDetectionTestHelper.typeSample(wrapper, '● Done.\n\nShould I merge?');
		expect(SettingsTextDetectionTestHelper.resultText(wrapper)).toContain('Question found: Should I merge?');
	});

	it('opens nothing, sends nothing, and runs nothing', async () => {
		const wrapper = await SettingsTextDetectionTestHelper.mountPart();
		mocks.invoke.mockClear();
		await SettingsTextDetectionTestHelper.typeSample(wrapper, 'see https://example.com/a and #12 and ! pnpm test.');
		await wrapper.get('[data-sample-item]').trigger('click');
		expect(mocks.openUrl).not.toHaveBeenCalled();
		const names = mocks.invoke.mock.calls.map((call) => call[0]);
		expect(names.filter((name) => name !== 'project_refs' && name !== 'claude_commands')).toEqual([]);
	});

	it('has no missing translation in French', async () => {
		settings.language = 'fr';
		const wrapper = await SettingsTextDetectionTestHelper.mountPart();
		await SettingsTextDetectionTestHelper.typeSample(wrapper, 'see logs/26d63ea.txt and #12');
		expect(wrapper.text()).not.toMatch(/textDetection\.[a-z]/i);
		expect(wrapper.text()).toContain('Essayer un texte');
		settings.language = 'en';
	});
});

describe('the data of the project of the selected workspace', () => {
	it('shows the repository, the forge, the ticket address, the prefixes, the references switch, and the slash commands', async () => {
		const wrapper = await SettingsTextDetectionTestHelper.mountPart();
		const value = (field: string) => wrapper.get(`[data-row="${field}"] [data-value]`).text();
		expect(value('workspace')).toBe('/work/app');
		expect(value('repository')).toBe('https://github.com/org/app');
		expect(value('forge')).toBe('GitHub');
		expect(value('ticketAddress')).toBe('none');
		expect(value('ticketPrefixes')).toContain('any, except');
		expect(value('referencesSwitch')).toBe('yes');
		expect(value('slashCommands')).toBe('1 known');
	});

	it('shows the ticket address that the project file gives', async () => {
		const wrapper = await SettingsTextDetectionTestHelper.mountPart('/work/tracker');
		expect(wrapper.get('[data-row="ticketAddress"] [data-value]').text()).toBe('https://acme.atlassian.net/browse/{key}');
	});

	it('says that no workspace is selected, and shows no repository', async () => {
		state.selectedWorkspaceId = null;
		const wrapper = mount(SettingsTextDetectionSection);
		await flushPromises();
		expect(wrapper.find('[data-field="no-workspace"]').exists()).toBe(true);
		expect(wrapper.get('[data-row="repository"] [data-value]').text()).toBe('none');
	});
});

describe('the rules of each family, with their real patterns and examples', () => {
	it('shows every rule of the catalog, in a card of its family', async () => {
		const wrapper = await SettingsTextDetectionTestHelper.mountPart();
		for (const family of DetectionCatalog.FAMILIES) {
			const card = wrapper.get(`[data-family="${family.id}"]`);
			expect(card.findAll('[data-rule]').map((rule) => rule.attributes('data-rule'))).toEqual(family.rules.map((rule) => rule.id));
		}
	});

	it('shows the exact regular expression that the detection runs, for each pattern of a rule', async () => {
		const wrapper = await SettingsTextDetectionTestHelper.mountPart();
		const hash = wrapper.get('[data-family="issueReferences"] [data-rule="hash"]');
		expect(hash.get('[data-pattern] code').text()).toBe(DetectionPatterns.HASH.toString());
		const fullAddress = wrapper.get('[data-family="issueReferences"] [data-rule="fullAddress"]');
		expect(fullAddress.findAll('[data-pattern] code').map((code) => code.text())).toEqual([
			DetectionPatterns.REFERENCE_ADDRESS.toString(),
			DetectionPatterns.GITHUB_ADDRESS_PATH.toString(),
			DetectionPatterns.GITLAB_ADDRESS_PATH.toString(),
		]);
	});

	it('shows each example with its real result in this project: the matched text, the action, and the destination', async () => {
		const wrapper = await SettingsTextDetectionTestHelper.mountPart();
		const hash = wrapper.get('[data-family="issueReferences"] [data-rule="hash"]');
		const found = hash.get('[data-example="found"]');
		expect(found.get('[data-example-text]').text()).toBe('fix #12');
		expect(found.get('[data-example-result]').text()).toBe('→ matches “#12” · ↗ Open #12 / ⧉ Preview · https://github.com/org/app/issues/12');
		const refused = hash.findAll('[data-example="refused"]');
		expect(refused.map((example) => example.get('[data-example-text]').text())).toEqual(['a &#39; b', 'C#12', 'https://example.com/page#12']);
		for (const example of refused) {
			expect(example.get('[data-example-result]').text()).toContain('nothing found');
		}
	});

	it('shows the file path of the issue 793 as one whole path', async () => {
		const wrapper = await SettingsTextDetectionTestHelper.mountPart();
		const rows = wrapper.findAll('[data-family="filePaths"] [data-example="found"]');
		const row = rows.find((example) => example.get('[data-example-text]').text().startsWith('~/Library/WebKit'));
		expect(row?.get('[data-example-result]').text()).toBe('→ 📄 Open dev.heidrun-org.heidrun-code.development');
	});

	it('shows an example on several lines in a block', async () => {
		const wrapper = await SettingsTextDetectionTestHelper.mountPart();
		const block = wrapper.get('[data-family="agentList"] [data-rule="agentRow"] pre');
		expect(block.text()).toBe('● main\n○ worker-1');
	});

	it('explains what a ticket is, and says that nothing is found while the project has no ticket address', async () => {
		const wrapper = await SettingsTextDetectionTestHelper.mountPart();
		const card = wrapper.get('[data-family="tickets"]');
		expect(card.get('[data-field="tickets-setup"]').text()).toContain('the name that a ticket tracker such as Jira gives to a task');
		expect(card.get('[data-field="tickets-setup"]').text()).toContain('"prefixes": ["ABC", "OPS"]');
		expect(card.get('[data-need]').text()).toBe('This project has no ticket address: nothing is found.');
		expect(card.get('[data-example="found"] [data-example-result]').text()).toContain('not found in this project');
	});

	it('finds the ticket keys when the project gives a ticket address', async () => {
		const wrapper = await SettingsTextDetectionTestHelper.mountPart('/work/tracker');
		const card = wrapper.get('[data-family="tickets"]');
		expect(card.find('[data-need]').exists()).toBe(false);
		const result = card.get('[data-example="found"] [data-example-result]').text();
		expect(result).toBe('→ ↗ Open ABC-123 · https://acme.atlassian.net/browse/ABC-123');
	});

	it('says that the exclamation mark and a number is for GitLab, and finds nothing in a GitHub project', async () => {
		const wrapper = await SettingsTextDetectionTestHelper.mountPart();
		const rule = wrapper.get('[data-family="requestReferences"] [data-rule="bang"]');
		expect(rule.get('[data-need]').text()).toBe('This project is not on GitLab: nothing is found.');
		expect(rule.get('[data-example="found"] [data-example-result]').text()).toContain('not found in this project');
	});

	it('says how many options the menu of an example has, with the singular and the plural form', async () => {
		const wrapper = await SettingsTextDetectionTestHelper.mountPart();
		const result = wrapper.get('[data-family="questionsAndChoices"] [data-rule="choices"] [data-example="found"] [data-example-result]');
		expect(result.text()).toBe('→ a menu of 2 options');
	});

	it('names the panes in which a rule works', async () => {
		const wrapper = await SettingsTextDetectionTestHelper.mountPart();
		expect(wrapper.get('[data-family="slashCommands"] [data-field="pane"]').text()).toBe('Panes that run Claude Code');
		expect(wrapper.get('[data-family="numberedSteps"] [data-field="pane"]').text()).toBe('Panes that run a coding agent');
		expect(wrapper.find('[data-family="filePaths"] [data-field="pane"]').exists()).toBe(false);
	});

	it('writes every text in French as well, without a missing translation', async () => {
		settings.language = 'fr';
		const wrapper = await SettingsTextDetectionTestHelper.mountPart();
		expect(wrapper.text()).not.toMatch(/textDetection\.[a-z]/i);
		expect(wrapper.get('[data-family="tickets"]').text()).toContain('Clés de ticket (ABC-123)');
		settings.language = 'en';
	});
});
