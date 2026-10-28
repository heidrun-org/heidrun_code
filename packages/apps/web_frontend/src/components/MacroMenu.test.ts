// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { nextTick, type Ref } from 'vue';
import MacroMenu from './MacroMenu.vue';
import MacroEditor from './MacroEditor.vue';
import {
	addMacro, hardCodedMacros, macroEditor, macros, projectMacros, removeMacro, updateMacro, type Macro,
} from '../stores/macros';
import { askConfirm } from '../stores/confirm';
import { insertText, toast } from '../stores/session';
import { t } from '../i18n/index';

vi.mock('../stores/macros', async () => {
	const { reactive, ref } = await import('vue');
	return {
		macros: reactive({
			personal: [],
		}),
		hardCodedMacros: ref([]),
		projectMacros: ref([]),
		macroEditor: reactive({
			open: false,
			selectedId: null,
			isFromProject: false,
		}),
		VARIABLES: ['{workspace}'],
		resolveMacroVariables: vi.fn(async (text: string) => text),
		addMacro: vi.fn(async () => 'new-id'),
		updateMacro: vi.fn(async () => {}),
		removeMacro: vi.fn(async () => {}),
	};
});
vi.mock('../stores/session', () => ({
	insertText: vi.fn(async () => {}),
	toast: vi.fn(),
}));
vi.mock('../stores/confirm', () => ({
	askConfirm: vi.fn(async () => false),
}));
vi.mock('../stores/project', async () => {
	const { ref } = await import('vue');
	return {
		currentProject: ref({}),
	};
});

const personalMacro: Macro = {
	id: 'same-id',
	label: 'Own macro',
	description: 'Own description',
	text: 'Own text',
};
const projectMacro: Macro = {
	id: 'same-id',
	label: 'Project macro',
	description: 'Project description',
	text: 'Project text',
};
const hardCodedMacro: Macro = {
	id: 'fixed',
	label: 'Fixed macro',
	description: 'Fixed description',
	text: 'Fixed text',
};

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	MacroMenuTest — exercises macro actions and the selected editor
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

class MacroMenuTest {
	/** Mounted components to dispose after each test. */
	static wrappers: VueWrapper[] = [];

	/**
	 * Opens the menu with the personal, project and hard-coded macros.
	 * @returns The visible menu element.
	 */
	static async openMenu(): Promise<HTMLElement> {
		const wrapper = mount(MacroMenu, {
			props: {
				paneId: 'pane_1',
			},
			attachTo: document.body,
		});
		this.wrappers.push(wrapper);
		await wrapper.get('button.tool').trigger('click');
		await nextTick();
		return document.body.querySelector<HTMLElement>('.menu')!;
	}

	/**
	 * Finds the menu row for a macro.
	 * @param menu - The open menu.
	 * @param label - The macro title.
	 * @returns The row containing the macro and its actions.
	 */
	static row(menu: HTMLElement, label: string): HTMLElement {
		return [...menu.querySelectorAll<HTMLElement>('.fw-medium')]
			.find((element) => element.textContent === label)!.closest('.menu-item')!.parentElement!;
	}

	/**
	 * Clicks a menu action and waits for asynchronous work.
	 * @param button - The action to click.
	 * @returns Nothing.
	 */
	static async click(button: Element): Promise<void> {
		(button as HTMLElement).click();
		await flushPromises();
	}

	/**
	 * Mounts the selected editor, as App.vue does when macroEditor.open becomes true.
	 * @returns The mounted editor.
	 */
	static editor(): VueWrapper {
		const wrapper = mount(MacroEditor);
		this.wrappers.push(wrapper);
		return wrapper;
	}

	/**
	 * Saves the form through its Save button.
	 * @param wrapper - The editor to save.
	 * @returns Nothing.
	 */
	static async save(wrapper: VueWrapper): Promise<void> {
		await wrapper.get('button.primary').trigger('click');
		await flushPromises();
	}
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(askConfirm).mockResolvedValue(false);
	vi.mocked(addMacro).mockImplementation(async (label, description, text, isProject) => {
		const macro: Macro = {
			id: 'new-id',
			label,
			description,
			text,
		};
		if (isProject === true) {
			(projectMacros as unknown as Ref<Macro[]>).value.push(macro);
		} else {
			macros.personal.push(macro);
		}
		return macro.id;
	});
	vi.mocked(removeMacro).mockImplementation(async (id, isProject) => {
		if (isProject === true) {
			(projectMacros as unknown as Ref<Macro[]>).value = projectMacros.value.filter((macro) => macro.id !== id);
		} else {
			macros.personal = macros.personal.filter((macro) => macro.id !== id);
		}
	});
	vi.mocked(updateMacro).mockResolvedValue(undefined);
	macros.personal = [personalMacro];
	(hardCodedMacros as unknown as Ref<Macro[]>).value = [hardCodedMacro];
	(projectMacros as unknown as Ref<Macro[]>).value = [projectMacro];
	macroEditor.open = false;
	macroEditor.selectedId = null;
	macroEditor.isFromProject = false;
});

afterEach(() => {
	for (const wrapper of MacroMenuTest.wrappers) {
		wrapper.unmount();
	}
	MacroMenuTest.wrappers = [];
});

describe('the macro menu', () => {
	it('keeps project, personal and hard-coded groups in order, with one row per macro', async () => {
		const menu = await MacroMenuTest.openMenu();
		expect([...menu.querySelectorAll('.menu-header')].map((element) => element.textContent)).toEqual([
			t('macroMenu.project'), t('macroMenu.personal'), t('macroMenu.hardCoded'),
		]);
		expect(menu.querySelectorAll('.fw-medium')).toHaveLength(3);
		expect(menu.querySelectorAll('.menu-divider')).toHaveLength(3);
		expect(MacroMenuTest.row(menu, 'Fixed macro').querySelectorAll('button')).toHaveLength(1);
		expect(MacroMenuTest.row(menu, 'Own macro').querySelectorAll('button')).toHaveLength(3);
		expect(MacroMenuTest.row(menu, 'Project macro').querySelectorAll('button')).toHaveLength(3);
	});

	it('is wide, and puts small Edit and Delete buttons without borders on the title line of the row', async () => {
		const menu = await MacroMenuTest.openMenu();
		expect(menu.style.width).toContain('420px');
		for (const label of ['Own macro', 'Project macro']) {
			const row = MacroMenuTest.row(menu, label);
			const actionList = row.querySelector<HTMLElement>('.position-absolute')!;
			expect(actionList.classList.contains('top-0')).toBe(true);
			expect(actionList.classList.contains('end-0')).toBe(true);
			const actionButtonList = [...actionList.querySelectorAll('button')];
			expect(actionButtonList).toHaveLength(2);
			for (const actionButton of actionButtonList) {
				expect(actionButton.classList.contains('icon')).toBe(true);
				expect(actionButton.classList.contains('small')).toBe(true);
				expect(actionButton.classList.contains('btn-sm')).toBe(false);
			}
			expect(row.querySelector('.fw-medium')!.classList.contains('pe-5')).toBe(true);
		}
	});

	it('gives a hard-coded macro no action buttons and no space for them', async () => {
		const menu = await MacroMenuTest.openMenu();
		const row = MacroMenuTest.row(menu, 'Fixed macro');
		expect(row.querySelector('.position-absolute')).toBeNull();
		expect(row.querySelector('.fw-medium')!.classList.contains('pe-5')).toBe(false);
	});

	it('hides group titles when only hard-coded macros exist and keeps Create last', async () => {
		macros.personal = [];
		(projectMacros as unknown as Ref<Macro[]>).value = [];
		const menu = await MacroMenuTest.openMenu();
		expect(menu.querySelector('.menu-header')).toBeNull();
		expect(menu.lastElementChild!.textContent!.trim()).toBe(t('macroMenu.create'));
	});

	it.each([false, true])('preserves macro insertion with Shift=%s', async (isShift) => {
		const menu = await MacroMenuTest.openMenu();
		MacroMenuTest.row(menu, 'Own macro').querySelector('button')!.dispatchEvent(new MouseEvent('click', {
			bubbles: true,
			shiftKey: isShift,
		}));
		await flushPromises();
		expect(insertText).toHaveBeenCalledWith('pane_1', 'Own text', isShift);
	});

	it.each([false, true])('edits the selected macro with project=%s even when identifiers overlap', async (isProject) => {
		const macro = isProject ? projectMacro : personalMacro;
		const menu = await MacroMenuTest.openMenu();
		await MacroMenuTest.click(MacroMenuTest.row(menu, macro.label).querySelectorAll('button')[1]);
		expect(insertText).not.toHaveBeenCalled();
		expect(macroEditor.open).toBe(true);
		const editor = MacroMenuTest.editor();
		expect((editor.get('#macro-editor-label').element as HTMLInputElement).value).toBe(macro.label);
		expect((editor.get('#macro-editor-description').element as HTMLInputElement).value).toBe(macro.description);
		expect((editor.get('#macro-editor-text').element as HTMLTextAreaElement).value).toBe(macro.text);
		expect(editor.find('select').exists()).toBe(false);
		expect(editor.find('#macro-editor-in-project').exists()).toBe(false);
		await editor.get('#macro-editor-label').setValue('Changed title');
		await MacroMenuTest.save(editor);
		expect(updateMacro).toHaveBeenCalledWith(macro.id, isProject, 'Changed title', macro.description, macro.text);
		expect(addMacro).not.toHaveBeenCalled();
		expect(macroEditor.open).toBe(false);
	});

	it.each([false, true])('creates a macro with project=%s and closes after Save', async (isProject) => {
		macroEditor.selectedId = 'stale-selection';
		const menu = await MacroMenuTest.openMenu();
		await MacroMenuTest.click(menu.lastElementChild!);
		const editor = MacroMenuTest.editor();
		expect((editor.get('#macro-editor-label').element as HTMLInputElement).value).toBe('');
		await editor.get('#macro-editor-label').setValue('New macro');
		await editor.get('#macro-editor-description').setValue('New description');
		await editor.get('#macro-editor-text').setValue('New text');
		await editor.get('#macro-editor-in-project').setValue(isProject);
		await MacroMenuTest.save(editor);
		expect(addMacro).toHaveBeenCalledWith('New macro', 'New description', 'New text', isProject);
		expect(updateMacro).not.toHaveBeenCalled();
		expect(insertText).not.toHaveBeenCalled();
		expect(macroEditor.open).toBe(false);
		const reopened = await MacroMenuTest.openMenu();
		expect(MacroMenuTest.row(reopened, 'New macro').textContent).toContain('New description');
	});

	it.each([false, true])('requires confirmation before deleting a macro with project=%s', async (isProject) => {
		const macro = isProject ? projectMacro : personalMacro;
		const menu = await MacroMenuTest.openMenu();
		await MacroMenuTest.click(MacroMenuTest.row(menu, macro.label).querySelectorAll('button')[2]);
		expect(askConfirm).toHaveBeenCalledWith(
			t('macroMenu.deleteConfirm', {
				label: macro.label,
			}),
			t('macroMenu.delete'),
		);
		expect(removeMacro).not.toHaveBeenCalled();
		expect(insertText).not.toHaveBeenCalled();
		expect(macros.personal).toEqual([personalMacro]);
	});

	it.each([false, true])('deletes only the confirmed macro with project=%s', async (isProject) => {
		vi.mocked(askConfirm).mockResolvedValue(true);
		const macro = isProject ? projectMacro : personalMacro;
		const menu = await MacroMenuTest.openMenu();
		await MacroMenuTest.click(MacroMenuTest.row(menu, macro.label).querySelectorAll('button')[2]);
		expect(removeMacro).toHaveBeenCalledWith(macro.id, isProject);
		expect(insertText).not.toHaveBeenCalled();
		const reopened = await MacroMenuTest.openMenu();
		const labels = [...reopened.querySelectorAll('.fw-medium')].map((element) => element.textContent);
		expect(labels).not.toContain(macro.label);
		expect(labels).toContain(isProject ? personalMacro.label : projectMacro.label);
	});
});

describe('the macro editor', () => {
	it('keeps the form open when saving fails', async () => {
		vi.mocked(addMacro).mockRejectedValueOnce(new Error('Write failed'));
		macroEditor.open = true;
		const editor = MacroMenuTest.editor();
		await editor.get('#macro-editor-text').setValue('Keep this text');
		await MacroMenuTest.save(editor);
		expect(macroEditor.open).toBe(true);
		expect(toast).toHaveBeenCalledWith('Error: Write failed');
	});

	it('rejects empty text', async () => {
		macroEditor.open = true;
		await MacroMenuTest.save(MacroMenuTest.editor());
		expect(addMacro).not.toHaveBeenCalled();
		expect(macroEditor.open).toBe(true);
	});

	it('closes when another program removes the selected macro', async () => {
		macroEditor.open = true;
		macroEditor.selectedId = personalMacro.id;
		MacroMenuTest.editor();
		macros.personal = [];
		await nextTick();
		expect(macroEditor.open).toBe(false);
		expect(addMacro).not.toHaveBeenCalled();
	});
});
