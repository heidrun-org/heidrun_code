import { beforeEach, describe, expect, it, vi } from 'vitest';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	UserLaunchers — reads and writes the file launchers.json of the user level launchers (issue #853)
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The fake file launchers.json that the Tauri commands read and write. */
const fakeFile = vi.hoisted(() => ({
	exists: false,
	launchers: [] as unknown[],
	error: null as string | null,
	writes: [] as unknown[][],
	isWriteFailing: false,
}));

vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn(async (command: string, args?: { launchers?: unknown[] }) => {
		if (command === 'launchers_user_read') {
			return { exists: fakeFile.exists, launchers: fakeFile.launchers, error: fakeFile.error };
		}
		if (command === 'launchers_user_write') {
			if (fakeFile.isWriteFailing === true) {
				throw 'The disk is full.';
			}
			fakeFile.writes.push(args?.launchers ?? []);
			fakeFile.exists = true;
			fakeFile.launchers = args?.launchers ?? [];
			return null;
		}
		return undefined;
	}),
}));
vi.mock('./session', () => ({
	toast: vi.fn(),
}));

const launcherA = { id: 'a', label: 'A', command: 'make a' };
const launcherB = { id: 'b', label: 'B', command: 'make b', cwd: 'web' };
const launcherC = { id: 'c', label: 'C', command: 'make c' };

beforeEach(() => {
	vi.resetModules();
	vi.clearAllMocks();
	fakeFile.exists = false;
	fakeFile.launchers = [];
	fakeFile.error = null;
	fakeFile.writes = [];
	fakeFile.isWriteFailing = false;
});

/**
 * Loads a new copy of the store, so that no state stays from another test.
 * @returns The store, and the function that shows a message on the screen.
 */
async function loadStore() {
	const store = await import('./user_launchers');
	const session = await import('./session');
	return { ...store, toast: vi.mocked(session.toast) };
}

describe('UserLaunchers', () => {
	it('shows the launchers of the file', async () => {
		fakeFile.exists = true;
		fakeFile.launchers = [launcherA, launcherB];
		const { UserLaunchers, userLaunchers } = await loadStore();
		await UserLaunchers.readOnce();
		expect(userLaunchers.list).toEqual([launcherA, launcherB]);
		expect(userLaunchers.error).toBeNull();
	});

	it('has no launcher when the file does not exist, and the first change creates the file', async () => {
		const { UserLaunchers, userLaunchers } = await loadStore();
		await UserLaunchers.readOnce();
		expect(userLaunchers.list).toEqual([]);
		const isWritten = await UserLaunchers.change((list) => [...list, launcherA]);
		expect(isWritten).toBe(true);
		expect(fakeFile.writes).toEqual([[launcherA]]);
		expect(userLaunchers.list).toEqual([launcherA]);
	});

	it('writes nothing before the first read, and says so', async () => {
		const { UserLaunchers, userLaunchers, toast } = await loadStore();
		const isWritten = await UserLaunchers.change((list) => [...list, launcherA]);
		expect(isWritten).toBe(false);
		expect(fakeFile.writes).toEqual([]);
		expect(userLaunchers.list).toEqual([]);
		expect(toast).toHaveBeenCalledWith(expect.stringContaining('still reading the file'));
	});

	it('never writes a file that cannot be read, and says why once', async () => {
		fakeFile.exists = true;
		fakeFile.error = 'The file launchers.json is not a JSON list of launchers.';
		const { UserLaunchers, userLaunchers, toast } = await loadStore();
		await UserLaunchers.readOnce();
		await UserLaunchers.readOnce();
		expect(userLaunchers.list).toEqual([]);
		expect(userLaunchers.error).toBe(fakeFile.error);
		expect(toast).toHaveBeenCalledTimes(1);
		expect(toast).toHaveBeenCalledWith(expect.stringContaining('is not a JSON list of launchers'));
		const isWritten = await UserLaunchers.change((list) => [...list, launcherA]);
		expect(isWritten).toBe(false);
		expect(fakeFile.writes).toEqual([]);
	});

	it('treats a launcher with an unknown field as a file that cannot be read', async () => {
		fakeFile.exists = true;
		fakeFile.launchers = [{ ...launcherA, colour: 'red' }];
		const { UserLaunchers, userLaunchers } = await loadStore();
		await UserLaunchers.readOnce();
		expect(userLaunchers.list).toEqual([]);
		expect(userLaunchers.error).toMatch(/colour/);
		expect(await UserLaunchers.change((list) => [...list, launcherB])).toBe(false);
		expect(fakeFile.writes).toEqual([]);
	});

	it('writes again once the file is valid again', async () => {
		fakeFile.exists = true;
		fakeFile.error = 'bad file';
		const { UserLaunchers, userLaunchers } = await loadStore();
		await UserLaunchers.readOnce();
		fakeFile.error = null;
		fakeFile.launchers = [launcherA];
		await UserLaunchers.readOnce();
		expect(userLaunchers.error).toBeNull();
		expect(await UserLaunchers.change((list) => [...list, launcherB])).toBe(true);
		expect(fakeFile.writes).toEqual([[launcherA, launcherB]]);
	});

	it('shows what another program changed in the file at the next read', async () => {
		fakeFile.exists = true;
		fakeFile.launchers = [launcherA];
		const { UserLaunchers, userLaunchers } = await loadStore();
		await UserLaunchers.readOnce();
		fakeFile.launchers = [launcherA, launcherB];
		await UserLaunchers.readOnce();
		expect(userLaunchers.list).toEqual([launcherA, launcherB]);
		fakeFile.exists = false;
		fakeFile.launchers = [];
		await UserLaunchers.readOnce();
		expect(userLaunchers.list).toEqual([]);
	});

	it('applies two quick changes one after the other, each from the list that the first one left', async () => {
		fakeFile.exists = true;
		fakeFile.launchers = [launcherA];
		const { UserLaunchers, userLaunchers } = await loadStore();
		await UserLaunchers.readOnce();
		const results = await Promise.all([
			UserLaunchers.change((list) => [...list, launcherB]),
			UserLaunchers.change((list) => [...list, launcherC]),
		]);
		expect(results).toEqual([true, true]);
		expect(fakeFile.writes).toEqual([[launcherA, launcherB], [launcherA, launcherB, launcherC]]);
		expect(userLaunchers.list).toEqual([launcherA, launcherB, launcherC]);
	});

	it('keeps the old list, and says why, when the file cannot be written', async () => {
		fakeFile.exists = true;
		fakeFile.launchers = [launcherA];
		const { UserLaunchers, userLaunchers, toast } = await loadStore();
		await UserLaunchers.readOnce();
		fakeFile.isWriteFailing = true;
		const isWritten = await UserLaunchers.change((list) => [...list, launcherB]);
		expect(isWritten).toBe(false);
		expect(userLaunchers.list).toEqual([launcherA]);
		expect(toast).toHaveBeenCalledWith('The disk is full.');
	});

	it('does not change the list when the file cannot be read at all', async () => {
		const { invoke } = await import('@tauri-apps/api/core');
		vi.mocked(invoke).mockRejectedValueOnce(new Error('no desktop application'));
		const { UserLaunchers, userLaunchers } = await loadStore();
		await UserLaunchers.readOnce();
		expect(userLaunchers.list).toEqual([]);
		expect(userLaunchers.error).toBeNull();
	});
});
