import Fs from 'node:fs';
import Path from 'node:path';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Component } from 'vue';
import SettingsDesignSection from './settings_design_section.vue';
import SettingsAgentsSection from './SettingsAgentsSection.vue';
import SettingsConfirmationsSection from './SettingsConfirmationsSection.vue';
import SettingsDynamicTopicsSection from './SettingsDynamicTopicsSection.vue';
import SettingsGeneralSection from './SettingsGeneralSection.vue';
import SettingsGuardsSection from './SettingsGuardsSection.vue';
import SettingsMobileAccessSection from './SettingsMobileAccessSection.vue';
import SettingsNotificationsSection from './SettingsNotificationsSection.vue';
import SettingsSidebarsSection from './SettingsSidebarsSection.vue';
import SettingsTerminalSection from './SettingsTerminalSection.vue';
import SettingsTextDetectionSection from './SettingsTextDetectionSection.vue';
import SettingsVoiceInputSection from './SettingsVoiceInputSection.vue';
import { DETECTION_FAMILY_IDS } from '../../lib/detection_families';
import { DEFAULT_GUARDS } from '../../lib/guards';
import { NOTIFICATION_KINDS } from '../../lib/notification_channels';
import { parseProjectConfig } from '../../lib/project_config';
import { project } from '../../stores/project';
import { settings } from '../../stores/settings';
import { state } from '../../stores/session';

const mocks = vi.hoisted(() => ({ invoke: vi.fn(async (_name: string): Promise<unknown> => []) }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }));
vi.mock('@tauri-apps/api/webview', () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: vi.fn(async () => {}) }));

enableAutoUnmount(afterEach);

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	SettingsInformationCardsTest — every option of the Settings window has an information card (issue #608)
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** One section of the Settings window, with the options that it must show, in the order of the page. */
type SectionCase = {
	/** The name of the section, as the sidebar of the Settings window writes it. */
	name: string;
	/** The component of the section. */
	component: Component;
	/** The value of the attribute `data-option` of each option of the section, in the order of the page. */
	optionList: string[];
};

/** Helpers for the test of the information cards of the Settings window. */
class SettingsInformationCardsTestHelper {
	/** The root folder of the project of the section Guards. */
	static readonly ROOT = '/work/app';

	/** The identifier of the workspace of the section Guards. */
	static readonly WORKSPACE_ID = 'w1';

	/**
	 * The eleven sections of the Settings window, with their options. A new option goes in this list, and the test then
	 * fails until the option has an information card.
	 */
	static readonly SECTION_LIST: SectionCase[] = [
		{
			name: 'General',
			component: SettingsGeneralSection,
			optionList: ['language', 'timeFormat', 'workingDays', 'goatSound'],
		},
		{
			name: 'Color themes',
			component: SettingsDesignSection,
			optionList: ['colorTheme'],
		},
		{
			name: 'Terminal',
			component: SettingsTerminalSection,
			optionList: ['font', 'fontSize', 'mouseMode'],
		},
		{
			name: 'Text detection',
			component: SettingsTextDetectionSection,
			optionList: ['textDetection', 'textDetectionSample', ...DETECTION_FAMILY_IDS.map(() => 'detectionFamily')],
		},
		{
			name: 'Coding agents',
			component: SettingsAgentsSection,
			optionList: ['agent', 'agent', 'agent', 'quotaMonitoring', 'antigravityQuotaTracking', 'newTabCommand', 'compositionBarOnAgentStart', 'keepAgentsRunning'],
		},
		{
			name: 'Confirmations',
			component: SettingsConfirmationsSection,
			optionList: ['confirmWorkspaceClose', 'confirmTabClose', 'confirmPaneClose', 'confirmSavedSearchDelete'],
		},
		{
			name: 'Guards',
			component: SettingsGuardsSection,
			optionList: ['projectGuards', ...DEFAULT_GUARDS.map(() => 'builtInGuard')],
		},
		{
			name: 'Notifications',
			component: SettingsNotificationsSection,
			optionList: [
				'notifBlockedMin',
				'notifContext',
				'notifQuota',
				'notifEvening',
				'quietHours',
				...NOTIFICATION_KINDS.map(() => 'notificationChannel'),
				'showStatusItem',
			],
		},
		{
			name: 'Sidebars',
			component: SettingsSidebarsSection,
			optionList: ['showWorkspaces', 'finishedTtl', 'chatsRefreshSeconds', 'gitFetchMinutes'],
		},
		{
			name: 'Dynamic topics',
			component: SettingsDynamicTopicsSection,
			optionList: ['dynamicTopics', 'dynamicTopicExtraction', 'clusteredDynamicTopics', 'rebuildClusters'],
		},
		{
			name: 'Mobile access',
			component: SettingsMobileAccessSection,
			optionList: ['mobileAccess', 'mobileTerminalTyping'],
		},
		{
			name: 'Voice input',
			component: SettingsVoiceInputSection,
			optionList: ['voiceInput', 'voiceInputLanguage', 'voiceInputModel', 'voiceWords'],
		},
	];

	/** A text of a block of an information card that looks like the key of a text: the translation is missing. */
	static readonly KEY_PATTERN = /^[a-z][A-Za-z]*(\.[A-Za-z]+)+$/;

	/**
	 * Selects a workspace and puts a project in memory, so that the section Guards shows its lists.
	 */
	static installProject(): void {
		const config = { version: 1, launchers: [] };
		const projectData = {
			root: SettingsInformationCardsTestHelper.ROOT,
			config_path: `${SettingsInformationCardsTestHelper.ROOT}/.heidrun/config.json`,
			config,
			detected: [],
		};
		mocks.invoke.mockImplementation(async (name: string) => (name === 'project_load' ? projectData : null));
		state.selectedWorkspaceId = SettingsInformationCardsTestHelper.WORKSPACE_ID;
		project.byWorkspace[SettingsInformationCardsTestHelper.WORKSPACE_ID] = {
			...projectData,
			config: parseProjectConfig(config),
		};
		project.errors[SettingsInformationCardsTestHelper.WORKSPACE_ID] = undefined;
	}

	/**
	 * Mounts a section and waits for its first reads to end.
	 *
	 * @param sectionCase - The section to mount.
	 * @returns The mounted section.
	 */
	static async mountSection(sectionCase: SectionCase) {
		const wrapper = mount(sectionCase.component);
		await flushPromises();
		return wrapper;
	}
}

describe('the information cards of the Settings window (issue #608)', () => {
	beforeEach(() => {
		localStorage.clear();
		mocks.invoke.mockReset();
		mocks.invoke.mockResolvedValue(null);
		settings.language = 'en';
		state.selectedWorkspaceId = null;
		project.byWorkspace = {};
		project.errors = {};
		SettingsInformationCardsTestHelper.installProject();
	});

	for (const sectionCase of SettingsInformationCardsTestHelper.SECTION_LIST) {
		describe(`the section ${sectionCase.name}`, () => {
			it('shows the options of the issue, each one marked with the attribute data-option', async () => {
				const wrapper = await SettingsInformationCardsTestHelper.mountSection(sectionCase);
				const optionList = wrapper.findAll('[data-option]').map((option) => option.attributes('data-option'));
				expect(optionList).toEqual(sectionCase.optionList);
			});

			it('puts a circled question mark and an information card in every option', async () => {
				const wrapper = await SettingsInformationCardsTestHelper.mountSection(sectionCase);
				const missingList = wrapper
					.findAll('[data-option]')
					.filter((option) => option.find('.information-card-part [role="img"]').exists() === false)
					.map((option) => option.attributes('data-option'));
				expect(missingList).toEqual([]);
			});

			it('has no input, no select, and no text area outside an option', async () => {
				const wrapper = await SettingsInformationCardsTestHelper.mountSection(sectionCase);
				const lostControlList = wrapper
					.findAll('input, select, textarea')
					.filter((control) => control.element.closest('[data-option]') === null)
					.map((control) => control.element.outerHTML);
				expect(lostControlList).toEqual([]);
			});

			it('opens each information card below its circled question mark, with a text and no missing translation', async () => {
				const wrapper = await SettingsInformationCardsTestHelper.mountSection(sectionCase);
				for (const mark of wrapper.findAll('.information-card-part')) {
					await mark.trigger('click');
					await flushPromises();
					const card = wrapper.get('.popover');
					expect(card.classes()).toContain('bs-popover-bottom');
					expect(card.text().length).toBeGreaterThan(0);
					expect(card.text()).toContain(' ');
					for (const block of card.findAll('[data-help-block]')) {
						for (const part of block.findAll('div')) {
							expect(part.text()).not.toMatch(SettingsInformationCardsTestHelper.KEY_PATTERN);
						}
					}
					await mark.trigger('click');
					expect(wrapper.find('.popover').exists()).toBe(false);
				}
			});

			it('centers each information card on its circled question mark (issue #646)', async () => {
				const rectangleSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
					const isCard = this.classList.contains('popover');
					return isCard
						? ({ top: 0, left: 0, right: 400, bottom: 200, width: 400, height: 200, x: 0, y: 0, toJSON: () => ({}) } as DOMRect)
						: ({ top: 100, left: 500, right: 520, bottom: 120, width: 20, height: 20, x: 500, y: 100, toJSON: () => ({}) } as DOMRect);
				});
				try {
					const wrapper = await SettingsInformationCardsTestHelper.mountSection(sectionCase);
					for (const mark of wrapper.findAll('.information-card-part')) {
						await mark.trigger('click');
						await flushPromises();
						const card = wrapper.get('.popover');
						expect(card.attributes('style')).toContain('left: 310px');
						expect(card.get('.popover-arrow').attributes('style')).toContain('left: 192px');
						await mark.trigger('click');
					}
				} finally {
					rectangleSpy.mockRestore();
				}
			});
		});
	}
});

// Vitest omits CSS imports by default; use the real stylesheet for the runtime palette.
vi.mock('../../styles.css?raw', () => ({
	default: Fs.readFileSync(Path.resolve(import.meta.dirname, '../../styles.css'), 'utf8'),
}));
