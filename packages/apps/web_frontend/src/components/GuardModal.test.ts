import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GuardModal from './GuardModal.vue';
import { parseProjectConfig, type ProjectGuard } from '../lib/project_config';
import { closeGuardWindow, guardWindow, openEditGuardWindow, openNewGuardWindow, openViewGuardWindow } from '../stores/guard_window';
import { forgetProjectGuards, guardHit } from '../stores/guards';
import { project } from '../stores/project';
import { state } from '../stores/session';

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }));

enableAutoUnmount(afterEach);

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	GuardModalTest — the guard window adds, edits, and shows a guard, and tries a command
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Helpers for the tests of `GuardModal.vue`. The file `.heidrun/config.json` is a value in memory.
 */
class GuardModalTestHelper {
	/** The root folder of the project of the tests. */
	static readonly ROOT = '/work/app';

	/** The identifier of the workspace of the tests. */
	static readonly WORKSPACE_ID = 'w1';

	/** The content of the file `.heidrun/config.json` in memory, as the last write left it. */
	static fileConfig: unknown = null;

	/** A guard of the project that asks to confirm. */
	static readonly PUBLISH: ProjectGuard = {
		name: 'Publish',
		description: 'Publishing cannot be undone.',
		action: 'confirm',
		matches: [{ type: 'startsWith', text: 'npm publish' }],
	};

	/** A guard of the project that forbids, with two lines. */
	static readonly DEPLOY: ProjectGuard = {
		name: 'Deploy',
		action: 'block',
		matches: [
			{ type: 'contains', text: 'deploy.sh' },
			{ type: 'regex', text: '--prod$' },
		],
	};

	/**
	 * Puts `config` in the file in memory, selects the workspace, and loads the project, as the application does.
	 *
	 * @param config - The content of the file `.heidrun/config.json`.
	 */
	static installProject(config: Record<string, unknown>): void {
		GuardModalTestHelper.fileConfig = config;
		mocks.invoke.mockImplementation(async (name: string, args?: { config?: unknown }) => {
			if (name === 'project_load') {
				return {
					root: GuardModalTestHelper.ROOT,
					config_path: `${GuardModalTestHelper.ROOT}/.heidrun/config.json`,
					config: GuardModalTestHelper.fileConfig,
					detected: [],
				};
			}
			if (name === 'project_save') {
				GuardModalTestHelper.fileConfig = args?.config;
			}
			return null;
		});
		state.selectedWorkspaceId = GuardModalTestHelper.WORKSPACE_ID;
		project.byWorkspace[GuardModalTestHelper.WORKSPACE_ID] = {
			root: GuardModalTestHelper.ROOT,
			config_path: `${GuardModalTestHelper.ROOT}/.heidrun/config.json`,
			config: parseProjectConfig(config),
			detected: [],
		};
		project.errors[GuardModalTestHelper.WORKSPACE_ID] = undefined;
	}

	/**
	 * Counts the writes of the file `.heidrun/config.json`.
	 *
	 * @returns The number of calls of the command `project_save`.
	 */
	static countSaves(): number {
		return mocks.invoke.mock.calls.filter(([name]) => name === 'project_save').length;
	}

	/**
	 * Types the text of the field "Name" and the text of the first line.
	 *
	 * @param wrapper - The mounted window.
	 * @param name - The name of the guard.
	 * @param text - The text of the first line.
	 */
	static async fill(wrapper: ReturnType<typeof mount>, name: string, text: string): Promise<void> {
		await wrapper.get('#guard-name').setValue(name);
		await wrapper.get('[data-field="line"] input').setValue(text);
	}

	/**
	 * Presses the button "Save guard" and waits for the write.
	 *
	 * @param wrapper - The mounted window.
	 */
	static async save(wrapper: ReturnType<typeof mount>): Promise<void> {
		await wrapper.get('[data-field="save"]').trigger('click');
		await flushPromises();
	}
}

describe('the guard window', () => {
	beforeEach(() => {
		mocks.invoke.mockReset();
		forgetProjectGuards();
		closeGuardWindow();
		state.selectedWorkspaceId = null;
		project.byWorkspace = {};
		project.errors = {};
	});

	describe('in the mode "Add a guard"', () => {
		it('shows the title, a label for every field, the action Ask to confirm, and one empty line', () => {
			GuardModalTestHelper.installProject({ version: 1, launchers: [] });
			openNewGuardWindow();
			const wrapper = mount(GuardModal);
			expect(wrapper.get('#guard-window-title').text()).toBe('Add a guard');
			expect(wrapper.get('label[for="guard-name"]').text()).toBe('Name');
			expect(wrapper.get('label[for="guard-description"]').text()).toBe('Description');
			expect(wrapper.get('label[for="guard-try"]').text()).toBe('Try a command');
			expect((wrapper.get('#guard-action-confirm').element as HTMLInputElement).checked).toBe(true);
			expect(wrapper.get('label[for="guard-action-confirm"]').text()).toBe('Ask to confirm');
			expect(wrapper.get('label[for="guard-action-block"]').text()).toBe('Forbid');
			expect(wrapper.findAll('[data-field="line"]')).toHaveLength(1);
			expect(wrapper.find('[data-field="save"]').exists()).toBe(true);
		});

		it('gives every field a visible label or a label for the screen reader, so that no input has to be guessed', () => {
			GuardModalTestHelper.installProject({ version: 1, launchers: [] });
			openNewGuardWindow();
			const wrapper = mount(GuardModal);
			for (const field of wrapper.findAll('input, select, textarea')) {
				const id = field.attributes('id');
				const hasLabel = id !== undefined && wrapper.find(`label[for="${id}"]`).exists();
				expect(hasLabel || field.attributes('aria-label') !== undefined, field.html()).toBe(true);
			}
		});

		it('offers the four types of line, in order', () => {
			GuardModalTestHelper.installProject({ version: 1, launchers: [] });
			openNewGuardWindow();
			const wrapper = mount(GuardModal);
			const options = wrapper.findAll('[data-field="line"] select option').map((option) => [option.attributes('value'), option.text()]);
			expect(options).toEqual([
				['contains', 'Contains'],
				['startsWith', 'Starts with'],
				['endsWith', 'Ends with'],
				['regex', 'Regular expression'],
			]);
		});

		it('adds a line and removes a line, and keeps at least one line', async () => {
			GuardModalTestHelper.installProject({ version: 1, launchers: [] });
			openNewGuardWindow();
			const wrapper = mount(GuardModal);
			const onlyRemoveButton = wrapper.get('[data-field="line"] button');
			expect(onlyRemoveButton.attributes('disabled')).toBeDefined();
			await wrapper.get('[data-field="add-line"]').trigger('click');
			expect(wrapper.findAll('[data-field="line"]')).toHaveLength(2);
			await wrapper.findAll('[data-field="line"] button')[0].trigger('click');
			expect(wrapper.findAll('[data-field="line"]')).toHaveLength(1);
		});

		it('refuses to save an empty name and an empty line, shows both errors, writes nothing, and stays open', async () => {
			GuardModalTestHelper.installProject({ version: 1, launchers: [] });
			openNewGuardWindow();
			const wrapper = mount(GuardModal);
			expect(wrapper.find('[data-field="name-error"]').exists()).toBe(false);
			await GuardModalTestHelper.save(wrapper);
			expect(wrapper.get('[data-field="name-error"]').text()).toBe('Type a name.');
			expect(wrapper.get('[data-field="line-error"]').text()).toBe('Type the text of this line.');
			expect(GuardModalTestHelper.countSaves()).toBe(0);
			expect(guardWindow.isOpen).toBe(true);
		});

		it('shows at once that a regular expression cannot be read, and refuses to save it', async () => {
			GuardModalTestHelper.installProject({ version: 1, launchers: [] });
			openNewGuardWindow();
			const wrapper = mount(GuardModal);
			await wrapper.get('[data-field="line"] select').setValue('regex');
			await wrapper.get('[data-field="line"] input').setValue('(unclosed');
			expect(wrapper.get('[data-field="line-error"]').text()).toContain('This is not a valid regular expression:');
			await wrapper.get('#guard-name').setValue('Broken');
			await GuardModalTestHelper.save(wrapper);
			expect(GuardModalTestHelper.countSaves()).toBe(0);
		});

		it('refuses a name that another guard of the project has', async () => {
			GuardModalTestHelper.installProject({ version: 1, launchers: [], guards: { projectGuards: [GuardModalTestHelper.PUBLISH] } });
			openNewGuardWindow();
			const wrapper = mount(GuardModal);
			await GuardModalTestHelper.fill(wrapper, ' publish ', 'x');
			await GuardModalTestHelper.save(wrapper);
			expect(wrapper.get('[data-field="name-error"]').text()).toBe('Another guard of this project has this name.');
			expect(GuardModalTestHelper.countSaves()).toBe(0);
		});

		it('saves the guard in the file, closes the window, and the next command is stopped', async () => {
			GuardModalTestHelper.installProject({ version: 1, launchers: [] });
			expect(await guardHit('npm publish', GuardModalTestHelper.ROOT)).toBeNull();
			openNewGuardWindow();
			const wrapper = mount(GuardModal);
			await GuardModalTestHelper.fill(wrapper, 'Publish', 'npm publish');
			await wrapper.get('#guard-description').setValue('Publishing cannot be undone.');
			await wrapper.get('[data-field="line"] select').setValue('startsWith');
			await GuardModalTestHelper.save(wrapper);
			expect(GuardModalTestHelper.fileConfig).toEqual({
				version: 1,
				launchers: [],
				guards: { projectGuards: [GuardModalTestHelper.PUBLISH] },
			});
			expect(guardWindow.isOpen).toBe(false);
			const hit = await guardHit('npm publish --tag next', GuardModalTestHelper.ROOT);
			expect(hit?.level).toBe('confirm');
			expect(hit?.description).toBe('Publishing cannot be undone.');
		});

		it('saves the action Forbid when the developer chooses it, and the next command is forbidden', async () => {
			GuardModalTestHelper.installProject({ version: 1, launchers: [] });
			openNewGuardWindow();
			const wrapper = mount(GuardModal);
			await GuardModalTestHelper.fill(wrapper, 'Deploy', 'deploy.sh');
			await wrapper.get('#guard-action-block').setValue(true);
			await GuardModalTestHelper.save(wrapper);
			expect((await guardHit('./deploy.sh', GuardModalTestHelper.ROOT))?.level).toBe('block');
		});

		it('keeps the window open, and the file unchanged, when the file cannot be written', async () => {
			GuardModalTestHelper.installProject({ version: 1, launchers: [] });
			mocks.invoke.mockRejectedValue('disk full');
			openNewGuardWindow();
			const wrapper = mount(GuardModal);
			await GuardModalTestHelper.fill(wrapper, 'Publish', 'npm publish');
			await GuardModalTestHelper.save(wrapper);
			expect(guardWindow.isOpen).toBe(true);
			expect(project.byWorkspace[GuardModalTestHelper.WORKSPACE_ID]?.config.guards).toBeUndefined();
		});

		it('closes at the button Cancel, at the key Escape, and writes nothing', async () => {
			GuardModalTestHelper.installProject({ version: 1, launchers: [] });
			openNewGuardWindow();
			let wrapper = mount(GuardModal);
			await wrapper.get('[data-field="cancel"]').trigger('click');
			expect(guardWindow.isOpen).toBe(false);
			wrapper.unmount();
			openNewGuardWindow();
			wrapper = mount(GuardModal);
			window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
			expect(guardWindow.isOpen).toBe(false);
			expect(GuardModalTestHelper.countSaves()).toBe(0);
		});
	});

	describe('in the mode "Edit the guard"', () => {
		it('shows the guard in the fields, and saves a change in the place of the guard', async () => {
			GuardModalTestHelper.installProject({
				version: 1,
				launchers: [],
				guards: { projectGuards: [GuardModalTestHelper.PUBLISH, GuardModalTestHelper.DEPLOY] },
			});
			openEditGuardWindow('Publish');
			const wrapper = mount(GuardModal);
			expect(wrapper.get('#guard-window-title').text()).toBe('Edit the guard');
			expect((wrapper.get('#guard-name').element as HTMLInputElement).value).toBe('Publish');
			expect((wrapper.get('#guard-description').element as HTMLTextAreaElement).value).toBe('Publishing cannot be undone.');
			expect((wrapper.get('#guard-action-confirm').element as HTMLInputElement).checked).toBe(true);
			await wrapper.get('#guard-name').setValue('Publish to npm');
			await wrapper.get('#guard-action-block').setValue(true);
			await GuardModalTestHelper.save(wrapper);
			expect(GuardModalTestHelper.fileConfig).toEqual({
				version: 1,
				launchers: [],
				guards: {
					projectGuards: [{ ...GuardModalTestHelper.PUBLISH, name: 'Publish to npm', action: 'block' }, GuardModalTestHelper.DEPLOY],
				},
			});
			expect(guardWindow.isOpen).toBe(false);
		});

		it('lets the guard keep its own name', async () => {
			GuardModalTestHelper.installProject({ version: 1, launchers: [], guards: { projectGuards: [GuardModalTestHelper.PUBLISH] } });
			openEditGuardWindow('Publish');
			const wrapper = mount(GuardModal);
			await GuardModalTestHelper.save(wrapper);
			expect(GuardModalTestHelper.countSaves()).toBe(1);
			expect(wrapper.find('[data-field="name-error"]').exists()).toBe(false);
		});

		it('moves a guard of an old list to the new key when it is saved', async () => {
			GuardModalTestHelper.installProject({ version: 1, launchers: [], guards: { block: ['deploy\\.sh'] } });
			openEditGuardWindow('deploy\\.sh');
			const wrapper = mount(GuardModal);
			expect((wrapper.get('[data-field="line"] select').element as HTMLSelectElement).value).toBe('regex');
			await wrapper.get('#guard-name').setValue('Deploy');
			await GuardModalTestHelper.save(wrapper);
			expect(GuardModalTestHelper.fileConfig).toEqual({
				version: 1,
				launchers: [],
				guards: { projectGuards: [{ name: 'Deploy', action: 'block', matches: [{ type: 'regex', text: 'deploy\\.sh' }] }] },
			});
		});

		it('closes at once when the guard is not in the file any more', async () => {
			GuardModalTestHelper.installProject({ version: 1, launchers: [] });
			openEditGuardWindow('Gone');
			mount(GuardModal);
			await flushPromises();
			expect(guardWindow.isOpen).toBe(false);
		});
	});

	describe('the field "Try a command"', () => {
		it('says which line matches, and marks the line', async () => {
			GuardModalTestHelper.installProject({ version: 1, launchers: [], guards: { projectGuards: [GuardModalTestHelper.DEPLOY] } });
			openEditGuardWindow('Deploy');
			const wrapper = mount(GuardModal);
			expect(wrapper.find('[data-field="try-message"]').exists()).toBe(false);
			await wrapper.get('#guard-try').setValue('make all --prod');
			expect(wrapper.get('[data-field="try-message"]').text()).toBe('This command matches line 2. Heidrun Code forbids it.');
			expect(wrapper.findAll('[data-field="line-match"]')).toHaveLength(1);
			expect(wrapper.findAll('[data-field="line"]')[1].find('[data-field="line-match"]').exists()).toBe(true);
		});

		it('uses the action that is chosen in the window to tell what Heidrun Code does', async () => {
			GuardModalTestHelper.installProject({ version: 1, launchers: [] });
			openNewGuardWindow();
			const wrapper = mount(GuardModal);
			await wrapper.get('[data-field="line"] input').setValue('publish');
			await wrapper.get('#guard-try').setValue('npm PUBLISH');
			expect(wrapper.get('[data-field="try-message"]').text()).toBe('This command matches line 1. Heidrun Code asks you to confirm it.');
		});

		it('says that no line matches', async () => {
			GuardModalTestHelper.installProject({ version: 1, launchers: [] });
			openNewGuardWindow();
			const wrapper = mount(GuardModal);
			await wrapper.get('[data-field="line"] input').setValue('publish');
			await wrapper.get('#guard-try').setValue('npm test');
			expect(wrapper.get('[data-field="try-message"]').text()).toBe('This command matches no line, so this guard does not stop it.');
			expect(wrapper.find('[data-field="line-match"]').exists()).toBe(false);
		});

		it('says which line is a regular expression that cannot be read', async () => {
			GuardModalTestHelper.installProject({ version: 1, launchers: [] });
			openNewGuardWindow();
			const wrapper = mount(GuardModal);
			await wrapper.get('[data-field="line"] select').setValue('regex');
			await wrapper.get('[data-field="line"] input').setValue('(unclosed');
			await wrapper.get('#guard-try').setValue('ls');
			expect(wrapper.get('[data-field="try-invalid"]').text()).toBe('Line 1 is not a valid regular expression, so it matches nothing.');
		});
	});

	describe('in the mode that shows a hardcoded guard', () => {
		const SQL_DROP_KEY = 'guards.why.sqlDrop';

		it('shows the criteria as a line of the type Regular expression, with every field read only and no button to save', () => {
			GuardModalTestHelper.installProject({ version: 1, launchers: [] });
			openViewGuardWindow(SQL_DROP_KEY);
			const wrapper = mount(GuardModal);
			expect(wrapper.get('#guard-window-title').text()).toBe('Hardcoded guard');
			expect((wrapper.get('#guard-name').element as HTMLInputElement).value).toBe('SQL deletion (DROP / TRUNCATE)');
			expect((wrapper.get('#guard-description').element as HTMLTextAreaElement).value).not.toContain('`');
			expect((wrapper.get('[data-field="line"] select').element as HTMLSelectElement).value).toBe('regex');
			expect((wrapper.get('[data-field="line"] input').element as HTMLInputElement).value).toBe('\\b(DROP|TRUNCATE)\\s+(TABLE|DATABASE|SCHEMA)\\b');
			expect(wrapper.find('[data-field="save"]').exists()).toBe(false);
			expect(wrapper.find('[data-field="add-line"]').exists()).toBe(false);
			expect(wrapper.get('[data-field="built-in-note"]').text()).toContain('cannot be changed');
			for (const field of wrapper.findAll('input, select, textarea')) {
				if (field.attributes('id') === 'guard-try') {
					continue;
				}
				expect(field.attributes('disabled'), field.html()).toBeDefined();
			}
			expect(wrapper.get('[data-field="cancel"]').text()).toBe('Close');
		});

		it('lets the developer try a command, with the flags of the regular expression of the guard', async () => {
			GuardModalTestHelper.installProject({ version: 1, launchers: [] });
			openViewGuardWindow(SQL_DROP_KEY);
			const wrapper = mount(GuardModal);
			await wrapper.get('#guard-try').setValue('drop table users');
			expect(wrapper.get('[data-field="try-message"]').text()).toBe('This command matches line 1. Heidrun Code asks you to confirm it.');
			await wrapper.get('#guard-try').setValue('select 1');
			expect(wrapper.get('[data-field="try-message"]').text()).toBe('This command matches no line, so this guard does not stop it.');
		});

		it('keeps the case of a regular expression that has no flag i', async () => {
			GuardModalTestHelper.installProject({ version: 1, launchers: [] });
			openViewGuardWindow('guards.why.deleteFilesAsRoot');
			const wrapper = mount(GuardModal);
			await wrapper.get('#guard-try').setValue('SUDO RM x');
			expect(wrapper.get('[data-field="try-message"]').text()).toContain('matches no line');
			await wrapper.get('#guard-try').setValue('sudo rm x');
			expect(wrapper.get('[data-field="try-message"]').text()).toContain('matches line 1');
		});

		it('writes nothing, even when the form is sent', async () => {
			GuardModalTestHelper.installProject({ version: 1, launchers: [] });
			openViewGuardWindow(SQL_DROP_KEY);
			const wrapper = mount(GuardModal);
			await wrapper.get('form').trigger('submit');
			await flushPromises();
			expect(GuardModalTestHelper.countSaves()).toBe(0);
		});
	});
});
