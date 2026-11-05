import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';
import SettingsConfirmationsSection from './SettingsConfirmationsSection.vue';
import { settings } from '../../stores/settings';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	SettingsConfirmationsSectionTest — the section Confirmations holds the questions before closing and deleting
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Helpers for the tests of `SettingsConfirmationsSection.vue`.
 */
class SettingsConfirmationsSectionTestHelper {
	/**
	 * Finds the switch row whose label has the given text.
	 *
	 * @param wrapper - The mounted section.
	 * @param labelText - The text of the label of the switch.
	 * @returns The switch input of the row.
	 */
	static getSwitch(wrapper: ReturnType<typeof mount>, labelText: string) {
		const label = wrapper.findAll('label').find((candidate) => candidate.text() === labelText);
		if (label === undefined) {
			throw new Error(`The switch "${labelText}" is missing.`);
		}
		return wrapper.get(`input[id="${label.attributes('for')}"]`);
	}
}

describe('heading Ask before closing', () => {
	beforeEach(() => {
		settings.confirmWorkspaceClose = true;
		settings.confirmTabClose = true;
		settings.confirmPaneClose = true;
	});

	it('holds three switches: workspace, then tab, then pane', () => {
		const wrapper = mount(SettingsConfirmationsSection);
		expect(wrapper.findAll('h4').map((heading) => heading.text())).toContain('Ask before closing');
		const labelTextList = wrapper
			.findAll('label')
			.map((label) => label.text())
			.filter((text) => text.startsWith('Ask before closing'));
		expect(labelTextList).toEqual([
			'Ask before closing a workspace',
			'Ask before closing a tab',
			'Ask before closing a pane',
		]);
	});

	it('links each switch to its own setting', async () => {
		const wrapper = mount(SettingsConfirmationsSection);
		const switchList = [
			SettingsConfirmationsSectionTestHelper.getSwitch(wrapper, 'Ask before closing a workspace'),
			SettingsConfirmationsSectionTestHelper.getSwitch(wrapper, 'Ask before closing a tab'),
			SettingsConfirmationsSectionTestHelper.getSwitch(wrapper, 'Ask before closing a pane'),
		];
		await switchList[0].setValue(false);
		expect(settings.confirmWorkspaceClose).toBe(false);
		expect(settings.confirmTabClose).toBe(true);
		expect(settings.confirmPaneClose).toBe(true);
		await switchList[1].setValue(false);
		expect(settings.confirmTabClose).toBe(false);
		await switchList[2].setValue(false);
		expect(settings.confirmPaneClose).toBe(false);
	});
});

describe('heading Ask before deleting', () => {
	beforeEach(() => {
		settings.confirmSavedSearchDelete = true;
	});

	it('holds the switch Ask before deleting a saved search, linked to its setting, after the heading Ask before closing', async () => {
		const wrapper = mount(SettingsConfirmationsSection);
		const headingTextList = wrapper.findAll('h4').map((heading) => heading.text());
		expect(headingTextList).toEqual(['Ask before closing', 'Ask before deleting', 'Files outside the workspace folder']);
		const switchInput = SettingsConfirmationsSectionTestHelper.getSwitch(wrapper, 'Ask before deleting a saved search');
		expect(switchInput.attributes('role')).toBe('switch');
		expect((switchInput.element as HTMLInputElement).checked).toBe(true);
		await switchInput.setValue(false);
		expect(settings.confirmSavedSearchDelete).toBe(false);
	});
});

describe('heading Files outside the workspace folder (issue #956)', () => {
	beforeEach(() => {
		settings.filesOutsideWorkspace = 'ask';
	});

	it('holds four choices, Ask first and chosen by default', () => {
		const wrapper = mount(SettingsConfirmationsSection);
		const option = wrapper.get('[data-option="filesOutsideWorkspace"]');
		expect(option.get('h4').text()).toBe('Files outside the workspace folder');
		expect(option.findAll('label').map((label) => label.text())).toEqual(['Ask', 'Open in Heidrun Code', 'Open in the default app', 'Never open']);
		expect((option.findAll('input')[0].element as HTMLInputElement).checked).toBe(true);
	});

	it('changes the setting at once', async () => {
		const wrapper = mount(SettingsConfirmationsSection);
		const inputList = wrapper.get('[data-option="filesOutsideWorkspace"]').findAll('input');
		await inputList[3].setValue(true);
		expect(settings.filesOutsideWorkspace).toBe('never');
		await inputList[2].setValue(true);
		expect(settings.filesOutsideWorkspace).toBe('openDefault');
		await inputList[1].setValue(true);
		expect(settings.filesOutsideWorkspace).toBe('open');
	});
});
