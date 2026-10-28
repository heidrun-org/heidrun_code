import Fs from 'node:fs';
import Path from 'node:path';
import { describe, expect, it } from 'vitest';

const __dirname = import.meta.dirname;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	SettingsBootstrapTest — the Settings window is made of Bootstrap components and utility classes
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Helpers for the tests of the Bootstrap markup of the Settings window.
 */
class SettingsBootstrapTestHelper {
	/**
	 * The files of the Settings window, as paths relative to the folder `components`.
	 */
	static readonly FILE_NAMES = [
		'SettingsModal.vue',
		'settings/settings_design_section.vue',
		'settings/SettingsAgentsSection.vue',
		'settings/SettingsConfirmationsSection.vue',
		'settings/SettingsDynamicTopicsSection.vue',
		'settings/SettingsGeneralSection.vue',
		'settings/SettingsGuardsSection.vue',
		'settings/SettingsMobileAccessSection.vue',
		'settings/SettingsNotificationsSection.vue',
		'settings/SettingsSidebarsSection.vue',
		'settings/SettingsSwitchRow.vue',
		'settings/SettingsTerminalSection.vue',
		'settings/SettingsTextDetectionFamily.vue',
		'settings/SettingsTextDetectionSample.vue',
		'settings/SettingsTextDetectionSection.vue',
		'settings/SettingsVoiceInputSection.vue',
		'settings/SettingsVoiceWordsEditor.vue',
	];

	/**
	 * Reads the source of a file of the Settings window.
	 *
	 * @param fileName - The path of the file relative to the folder `components`.
	 * @returns The source text of the component.
	 */
	static readComponent(fileName: string): string {
		return Fs.readFileSync(Path.resolve(__dirname, 'components', fileName), 'utf8');
	}

	/**
	 * Lists the class selectors that a `<style>` block of a component declares.
	 *
	 * @param sourceText - The source text of the component.
	 * @returns The class names, in order, without the dot.
	 */
	static listStyledClassNames(sourceText: string): string[] {
		const styleMatch = /<style[^>]*>([\s\S]*?)<\/style>/.exec(sourceText);
		if (styleMatch === null) {
			return [];
		}
		return [...styleMatch[1].matchAll(/\.([a-zA-Z][\w-]*)/g)].map((match) => match[1]);
	}

	/**
	 * Cuts the template of a component out of its source text, from the first `<template>` to the last `</template>`.
	 *
	 * @param sourceText - The source text of the component.
	 * @returns The text of the template.
	 */
	static readTemplate(sourceText: string): string {
		return sourceText.slice(sourceText.indexOf('<template>'), sourceText.lastIndexOf('</template>'));
	}

	/**
	 * Lists the opening tags of one element name in the template of a component.
	 *
	 * @param sourceText - The source text of the component.
	 * @param tagName - The element name, for example `button`.
	 * @returns The text of each opening tag, from `<` to `>`.
	 */
	static listOpeningTags(sourceText: string, tagName: string): string[] {
		const templateText = SettingsBootstrapTestHelper.readTemplate(sourceText);
		return [...templateText.matchAll(new RegExp(`<${tagName}(?=[\\s>])[^>]*>`, 'g'))].map((match) => match[0]);
	}
}

describe('the Settings window (issue 412)', () => {
	it('writes no style rule of its own, except the dark layer behind the window, the box of the QR code, and the box of the command', () => {
		const styledClassNameList: Record<string, string[]> = {};
		for (const fileName of SettingsBootstrapTestHelper.FILE_NAMES) {
			const classNameList = SettingsBootstrapTestHelper.listStyledClassNames(SettingsBootstrapTestHelper.readComponent(fileName));
			if (classNameList.length > 0) {
				styledClassNameList[fileName] = [...new Set(classNameList)];
			}
		}
		expect(styledClassNameList).toEqual({
			'SettingsModal.vue': ['overlay'],
			'settings/SettingsMobileAccessSection.vue': ['qr', 'command'],
		});
	});

	it('uses none of the class names of the old custom form controls', () => {
		const oldClassNameList = ['seg', 'keys', 'entry', 'check', 'nrow', 'toggle-switch', 'helpButton', 'window-box', 'pane', 'sr', 'tip', 'checkRow'];
		for (const fileName of SettingsBootstrapTestHelper.FILE_NAMES) {
			const sourceText = SettingsBootstrapTestHelper.readComponent(fileName);
			const templateText = SettingsBootstrapTestHelper.readTemplate(sourceText);
			for (const oldClassName of oldClassNameList) {
				expect({ fileName, oldClassName, isUsed: new RegExp(`class="([^"]* )?${oldClassName}[" ]`).test(templateText) }).toEqual({
					fileName,
					oldClassName,
					isUsed: false,
				});
			}
		}
	});

	it('gives every select and every text input the Bootstrap class form-control', () => {
		let checkedCount = 0;
		for (const fileName of SettingsBootstrapTestHelper.FILE_NAMES) {
			const sourceText = SettingsBootstrapTestHelper.readComponent(fileName);
			const tagList = [
				...SettingsBootstrapTestHelper.listOpeningTags(sourceText, 'select'),
				...SettingsBootstrapTestHelper.listOpeningTags(sourceText, 'input').filter((tag) => /type="(checkbox|radio)"/.test(tag) === false),
			];
			for (const tag of tagList) {
				checkedCount += 1;
				expect({ fileName, tag, hasFormControl: /class="[^"]*\bform-control\b/.test(tag) }).toEqual({ fileName, tag, hasFormControl: true });
			}
		}
		expect(checkedCount).toBeGreaterThanOrEqual(4);
	});

	it('gives every button a Bootstrap class: btn, btn-close, nav-link, or list-group-item', () => {
		let checkedCount = 0;
		for (const fileName of SettingsBootstrapTestHelper.FILE_NAMES) {
			const sourceText = SettingsBootstrapTestHelper.readComponent(fileName);
			for (const tag of SettingsBootstrapTestHelper.listOpeningTags(sourceText, 'button')) {
				checkedCount += 1;
				expect({ fileName, tag, hasBootstrapClass: /class="[^"]*\b(btn|btn-close|nav-link|list-group-item)\b/.test(tag) }).toEqual({
					fileName,
					tag,
					hasBootstrapClass: true,
				});
			}
		}
		expect(checkedCount).toBeGreaterThanOrEqual(6);
	});

	it('draws every checkbox and every radio input as a Bootstrap switch or as the input of a Bootstrap toggle button', () => {
		for (const fileName of SettingsBootstrapTestHelper.FILE_NAMES) {
			const sourceText = SettingsBootstrapTestHelper.readComponent(fileName);
			const inputTagList = SettingsBootstrapTestHelper.listOpeningTags(sourceText, 'input').filter((tag) => /type="(checkbox|radio)"/.test(tag));
			for (const tag of inputTagList) {
				const isSwitch = /role="switch"/.test(tag);
				const isToggleButton = /autocomplete="off"/.test(tag);
				expect({ fileName, tag, isSwitchOrToggleButton: isSwitch || isToggleButton }).toEqual({ fileName, tag, isSwitchOrToggleButton: true });
			}
			const toggleButtonLabelList = SettingsBootstrapTestHelper.listOpeningTags(sourceText, 'label').filter((tag) => /\bbtn-check\b/.test(tag));
			for (const tag of toggleButtonLabelList) {
				expect(tag).toMatch(/\bbtn-outline\b/);
				expect(tag).toMatch(/\btheme-secondary\b/);
			}
		}
	});
});
