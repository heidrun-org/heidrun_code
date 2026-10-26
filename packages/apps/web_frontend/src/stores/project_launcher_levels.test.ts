import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Launcher } from '../lib/project_config';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	The two levels of a custom launcher: user and workspace (issue #853)
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The fake file launchers.json, the fake file .heidrun/config.json, and the fake folders of the Tauri commands. */
const fakeDisk = vi.hoisted(() => ({
	userFileExists: false,
	userLaunchers: [] as unknown[],
	userWrites: [] as unknown[][],
	isUserWriteFailing: false,
	projectSaves: [] as unknown[],
	isProjectSaveFailing: false,
	missingFolders: [] as string[],
	folderChecks: [] as { root: string; folder: string }[],
}));

vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn(async (command: string, args?: Record<string, unknown>) => {
		switch (command) {
			case 'launchers_user_read':
				return { exists: fakeDisk.userFileExists, launchers: fakeDisk.userLaunchers, error: null };
			case 'launchers_user_write':
				if (fakeDisk.isUserWriteFailing === true) {
					throw 'The disk is full.';
				}
				fakeDisk.userWrites.push(args?.launchers as unknown[]);
				fakeDisk.userFileExists = true;
				fakeDisk.userLaunchers = args?.launchers as unknown[];
				return null;
			case 'project_save':
				if (fakeDisk.isProjectSaveFailing === true) {
					throw 'The project file is locked.';
				}
				fakeDisk.projectSaves.push(args?.config);
				return null;
			case 'launcher_folder_exists':
				fakeDisk.folderChecks.push({ root: args?.root as string, folder: args?.folder as string });
				return fakeDisk.missingFolders.includes(args?.folder as string) === false;
			default:
				return undefined;
		}
	}),
}));
vi.mock('@tauri-apps/api/webview', () => ({
	getCurrentWebview: () => ({
		setZoom: vi.fn(async () => {}),
	}),
}));
vi.mock('./guards', () => ({
	allowCommand: vi.fn(async () => true),
	forgetProjectGuards: vi.fn(),
}));
vi.mock('../lib/api', async (importOriginal) => ({
	...(await importOriginal<typeof import('../lib/api')>()),
	newTab: vi.fn(async () => ({
		pane_id: 'w1:p1',
		tab_id: 'w1:t1',
	})),
	run: vi.fn(async () => undefined),
}));
vi.mock('./session', async (importOriginal) => ({
	...(await importOriginal<typeof import('./session')>()),
	refresh: vi.fn(async () => undefined),
	selectPane: vi.fn(),
	selectTab: vi.fn(),
	toast: vi.fn(),
}));

const userLauncher: Launcher = { id: 'everywhere', label: 'Everywhere', command: 'make everywhere' };
const otherUserLauncher: Launcher = { id: 'also', label: 'Also', command: 'make also' };
const workspaceLauncher: Launcher = { id: 'here', label: 'Here', command: 'make here' };
const otherWorkspaceLauncher: Launcher = { id: 'there', label: 'There', command: 'make there' };

beforeEach(() => {
	vi.resetModules();
	vi.clearAllMocks();
	fakeDisk.userFileExists = false;
	fakeDisk.userLaunchers = [];
	fakeDisk.userWrites = [];
	fakeDisk.isUserWriteFailing = false;
	fakeDisk.projectSaves = [];
	fakeDisk.isProjectSaveFailing = false;
	fakeDisk.missingFolders = [];
	fakeDisk.folderChecks = [];
});

/**
 * Loads a new copy of the stores, with the workspace w1 selected, and reads the fake file of the user level launchers.
 * @param options - The launchers of the user level, and the launchers of the workspace level.
 * @returns The store of the project, the store of the user level launchers, the fake functions, and the first launchers.
 */
async function setup(options: { user?: Launcher[]; workspace?: Launcher[] } = {}) {
	fakeDisk.userFileExists = options.user !== undefined;
	fakeDisk.userLaunchers = options.user ?? [];
	const projectStore = await import('./project');
	const userStore = await import('./user_launchers');
	const session = await import('./session');
	const api = await import('../lib/api');
	session.state.selectedWorkspaceId = 'w1';
	projectStore.project.byWorkspace.w1 = {
		root: '/project',
		config_path: '',
		config: {
			version: 1,
			launchers: options.workspace ?? [],
		},
		detected: [],
	};
	await userStore.UserLaunchers.readOnce();
	return {
		...projectStore,
		userLaunchers: userStore.userLaunchers,
		toast: vi.mocked(session.toast),
		newTab: vi.mocked(api.newTab),
	};
}

describe('launchersOf and launcherLevel', () => {
	it('gives the launchers of the user level first, then the launchers of the workspace level', async () => {
		const { launchersOf, launcherLevel } = await setup({
			user: [userLauncher, otherUserLauncher],
			workspace: [workspaceLauncher, otherWorkspaceLauncher],
		});
		const launchers = launchersOf('w1');
		expect(launchers.map((launcher) => launcher.id)).toEqual(['everywhere', 'also', 'here', 'there']);
		expect(launchers.map((launcher) => launcherLevel(launcher))).toEqual(['user', 'user', 'workspace', 'workspace']);
	});

	it('shows the launchers of the user level in a workspace that has no launcher', async () => {
		const { launchersOf } = await setup({ user: [userLauncher] });
		expect(launchersOf('w1')).toEqual([userLauncher]);
		expect(launchersOf('w2')).toEqual([userLauncher]);
	});

	it('does not suggest a detected command that is a launcher of the user level', async () => {
		const { withoutImportedLaunchers } = await setup({ user: [userLauncher] });
		const detected = [
			{ label: 'everywhere', command: 'make everywhere', source: 'Makefile' },
			{ label: 'other', command: 'make other', source: 'Makefile' },
		];
		expect(withoutImportedLaunchers(detected).map((item) => item.command)).toEqual(['make other']);
	});
});

describe('addLauncher', () => {
	it('adds a launcher of the workspace level to the project file by default, and not to the file of the user level', async () => {
		const { addLauncher, project } = await setup({ user: [] });
		await addLauncher('w1', 'Build', 'pnpm build');
		expect(project.byWorkspace.w1?.config.launchers).toHaveLength(1);
		expect(fakeDisk.projectSaves).toHaveLength(1);
		expect(fakeDisk.userWrites).toEqual([]);
	});

	it('adds a launcher of the user level to the file of the user level, and not to the project file', async () => {
		const { addLauncher, project, launchersOf } = await setup({ user: [] });
		await addLauncher('w1', 'Build', 'pnpm build', undefined, 'web', 'Builds all', 'user');
		expect(project.byWorkspace.w1?.config.launchers).toEqual([]);
		expect(fakeDisk.projectSaves).toEqual([]);
		expect(fakeDisk.userWrites).toHaveLength(1);
		expect(fakeDisk.userWrites[0][0]).toMatchObject({
			label: 'Build',
			command: 'pnpm build',
			cwd: 'web',
			description: 'Builds all',
		});
		expect(launchersOf('w2').map((launcher) => launcher.label)).toEqual(['Build']);
	});

	it('gives a new launcher an identifier that a launcher of the other level does not have', async () => {
		const { addLauncher, project } = await setup({ user: [{ id: 'same-i', label: 'Old', command: 'make old' }] });
		const randomSpy = vi.spyOn(Math, 'random');
		randomSpy.mockReturnValueOnce(0.5).mockReturnValueOnce(0.25);
		await addLauncher('w1', 'Same', 'make new');
		randomSpy.mockRestore();
		expect(project.byWorkspace.w1?.config.launchers.map((launcher) => launcher.id)).toEqual(['same-9']);
	});
});

describe('removeLauncher', () => {
	it('removes a launcher of the user level from the file of the user level only', async () => {
		const { removeLauncher, project } = await setup({ user: [userLauncher, otherUserLauncher], workspace: [workspaceLauncher] });
		await removeLauncher('w1', 'everywhere');
		expect(fakeDisk.userWrites).toEqual([[otherUserLauncher]]);
		expect(fakeDisk.projectSaves).toEqual([]);
		expect(project.byWorkspace.w1?.config.launchers).toEqual([workspaceLauncher]);
	});

	it('removes a launcher of the workspace level from the project file only', async () => {
		const { removeLauncher, project } = await setup({ user: [userLauncher], workspace: [workspaceLauncher, otherWorkspaceLauncher] });
		await removeLauncher('w1', 'here');
		expect(fakeDisk.userWrites).toEqual([]);
		expect(fakeDisk.projectSaves).toHaveLength(1);
		expect(project.byWorkspace.w1?.config.launchers).toEqual([otherWorkspaceLauncher]);
	});
});

describe('updateLauncher', () => {
	it('keeps the level and the place of a launcher of the user level when no level is given', async () => {
		const { updateLauncher } = await setup({ user: [userLauncher, otherUserLauncher] });
		await updateLauncher('w1', 'everywhere', { label: 'Renamed', command: 'make renamed' });
		expect(fakeDisk.userWrites).toEqual([[{ id: 'everywhere', label: 'Renamed', command: 'make renamed' }, otherUserLauncher]]);
		expect(fakeDisk.projectSaves).toEqual([]);
	});

	it('keeps the level and the place of a launcher of the workspace level when the level is the same', async () => {
		const { updateLauncher, project } = await setup({ workspace: [workspaceLauncher, otherWorkspaceLauncher] });
		await updateLauncher('w1', 'here', { label: 'Renamed', command: 'make renamed' }, 'workspace');
		expect(project.byWorkspace.w1?.config.launchers).toEqual([
			{ id: 'here', label: 'Renamed', command: 'make renamed' },
			otherWorkspaceLauncher,
		]);
		expect(fakeDisk.userWrites).toEqual([]);
	});

	it('moves a launcher of the workspace level to the end of the user level', async () => {
		const { updateLauncher, project, userLaunchers } = await setup({
			user: [userLauncher],
			workspace: [workspaceLauncher, otherWorkspaceLauncher],
		});
		await updateLauncher('w1', 'here', { label: 'Here', command: 'make here' }, 'user');
		expect(userLaunchers.list.map((launcher) => launcher.id)).toEqual(['everywhere', 'here']);
		expect(fakeDisk.userWrites).toEqual([[userLauncher, workspaceLauncher]]);
		expect(project.byWorkspace.w1?.config.launchers).toEqual([otherWorkspaceLauncher]);
		expect(fakeDisk.projectSaves).toHaveLength(1);
	});

	it('moves a launcher of the user level to the end of the workspace level', async () => {
		const { updateLauncher, project, userLaunchers } = await setup({
			user: [userLauncher, otherUserLauncher],
			workspace: [workspaceLauncher],
		});
		await updateLauncher('w1', 'everywhere', { label: 'Everywhere', command: 'make everywhere' }, 'workspace');
		expect(project.byWorkspace.w1?.config.launchers).toEqual([workspaceLauncher, userLauncher]);
		expect(fakeDisk.projectSaves).toHaveLength(1);
		expect(userLaunchers.list).toEqual([otherUserLauncher]);
		expect(fakeDisk.userWrites).toEqual([[otherUserLauncher]]);
	});

	it('keeps the launcher at its old level when the file of the user level cannot be written', async () => {
		const { updateLauncher, project, userLaunchers } = await setup({ user: [], workspace: [workspaceLauncher] });
		fakeDisk.isUserWriteFailing = true;
		await updateLauncher('w1', 'here', { label: 'Here', command: 'make here' }, 'user');
		expect(project.byWorkspace.w1?.config.launchers).toEqual([workspaceLauncher]);
		expect(userLaunchers.list).toEqual([]);
		expect(fakeDisk.projectSaves).toEqual([]);
	});

	it('keeps the launcher at its old level when the project file cannot be written', async () => {
		const { updateLauncher, project, userLaunchers } = await setup({ user: [userLauncher], workspace: [] });
		fakeDisk.isProjectSaveFailing = true;
		await updateLauncher('w1', 'everywhere', { label: 'Everywhere', command: 'make everywhere' }, 'workspace');
		expect(project.byWorkspace.w1?.config.launchers).toEqual([]);
		expect(userLaunchers.list).toEqual([userLauncher]);
		expect(fakeDisk.userWrites).toEqual([]);
	});

	it('does nothing for an identifier that no launcher has', async () => {
		const { updateLauncher } = await setup({ user: [userLauncher], workspace: [workspaceLauncher] });
		await updateLauncher('w1', 'missing', { label: 'X', command: 'x' }, 'user');
		expect(fakeDisk.userWrites).toEqual([]);
		expect(fakeDisk.projectSaves).toEqual([]);
	});
});

describe('runLauncher for a launcher of the user level', () => {
	/**
	 * Runs a launcher and lets the wait before the command pass.
	 * @param run - Starts the run.
	 * @returns Nothing.
	 */
	async function runAndWait(run: () => Promise<void>): Promise<void> {
		vi.useFakeTimers();
		try {
			const running = run();
			await vi.advanceTimersByTimeAsync(500);
			await running;
		} finally {
			vi.useRealTimers();
		}
	}

	it('starts the tab in the folder of the workspace when the folder exists', async () => {
		const { runLauncher, newTab } = await setup({ user: [{ ...userLauncher, cwd: 'web' }] });
		await runAndWait(() => runLauncher('w1', { ...userLauncher, cwd: 'web' }));
		expect(fakeDisk.folderChecks).toEqual([{ root: '/project', folder: 'web' }]);
		expect(newTab).toHaveBeenCalledWith('w1', '/project/web', 'Everywhere');
	});

	it('does not start a tab, and says why, when the folder does not exist in the workspace', async () => {
		fakeDisk.missingFolders = ['web'];
		const { launchersOf, launcherLevel, runLauncher, newTab, toast } = await setup({ user: [{ ...userLauncher, cwd: 'web' }] });
		const launcher = launchersOf('w1')[0];
		expect(launcherLevel(launcher)).toBe('user');
		await runAndWait(() => runLauncher('w1', launcher));
		expect(newTab).not.toHaveBeenCalled();
		expect(toast).toHaveBeenCalledWith(expect.stringContaining('the folder web does not exist'));
	});

	it('checks no folder when the launcher has no folder', async () => {
		const { launchersOf, runLauncher, newTab } = await setup({ user: [userLauncher] });
		await runAndWait(() => runLauncher('w1', launchersOf('w1')[0]));
		expect(fakeDisk.folderChecks).toEqual([]);
		expect(newTab).toHaveBeenCalledWith('w1', '/project', 'Everywhere');
	});

	it('keeps the old behavior for a launcher of the workspace level: no check of the folder', async () => {
		fakeDisk.missingFolders = ['web'];
		const { launchersOf, runLauncher, newTab } = await setup({ workspace: [{ ...workspaceLauncher, cwd: 'web' }] });
		await runAndWait(() => runLauncher('w1', launchersOf('w1')[0]));
		expect(fakeDisk.folderChecks).toEqual([]);
		expect(newTab).toHaveBeenCalledWith('w1', '/project/web', 'Here');
	});
});
