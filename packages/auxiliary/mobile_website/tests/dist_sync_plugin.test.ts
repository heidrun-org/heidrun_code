// @vitest-environment node
import Fs from 'node:fs';
import Os from 'node:os';
import Path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DistSyncPlugin } from '../build_tools/dist_sync_plugin';

/**
 * Writes the folders of one test in a temporary folder.
 */
class SyncFolders {
	/** The temporary folders that the tests created. */
	static createdPaths: string[] = [];

	/** The old date that the files of `dist` get before a synchronization. */
	static readonly oldDate = new Date('2026-01-01T00:00:00Z');

	/**
	 * Creates a staging folder and a `dist` folder with files.
	 * @param stagingFiles The files of the new build, by relative path.
	 * @param distFiles The files of the old build, by relative path.
	 * @returns The paths of the two folders.
	 */
	static create(
		stagingFiles: Record<string, string>,
		distFiles: Record<string, string>,
	): { stagingPath: string; distPath: string } {
		const rootPath = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'dist_sync_test_'));
		SyncFolders.createdPaths.push(rootPath);
		const stagingPath = Path.join(rootPath, 'dist_staging');
		const distPath = Path.join(rootPath, 'dist');
		SyncFolders._writeFiles(stagingPath, stagingFiles);
		SyncFolders._writeFiles(distPath, distFiles);
		for (const relativePath of Object.keys(distFiles)) {
			Fs.utimesSync(Path.join(distPath, relativePath), SyncFolders.oldDate, SyncFolders.oldDate);
		}
		return {
			stagingPath,
			distPath,
		};
	}

	/**
	 * Writes files in a folder.
	 * @param folderPath The absolute path of the folder.
	 * @param files The files, by relative path.
	 * @returns Nothing.
	 */
	private static _writeFiles(folderPath: string, files: Record<string, string>): void {
		Fs.mkdirSync(folderPath, { recursive: true });
		for (const [relativePath, content] of Object.entries(files)) {
			Fs.mkdirSync(Path.dirname(Path.join(folderPath, relativePath)), { recursive: true });
			Fs.writeFileSync(Path.join(folderPath, relativePath), content);
		}
	}
}

describe('DistSyncPlugin.sync', () => {
	afterEach(() => {
		for (const createdPath of SyncFolders.createdPaths.splice(0)) {
			Fs.rmSync(createdPath, { recursive: true, force: true });
		}
	});

	it('keeps an unchanged file with its date, writes a changed file, and deletes a file that is gone', () => {
		const { stagingPath, distPath } = SyncFolders.create(
			{
				'index.html': 'same',
				'assets/index-new.js': 'new code',
				'sw.js': 'changed',
			},
			{
				'index.html': 'same',
				'assets/index-old.js': 'old code',
				'sw.js': 'before',
			},
		);

		const result = DistSyncPlugin.sync(stagingPath, distPath);

		expect(result).toEqual({
			writtenCount: 2,
			keptCount: 1,
			removedCount: 1,
		});
		expect(Fs.statSync(Path.join(distPath, 'index.html')).mtimeMs).toBe(SyncFolders.oldDate.getTime());
		expect(Fs.readFileSync(Path.join(distPath, 'sw.js'), 'utf8')).toBe('changed');
		expect(Fs.readdirSync(Path.join(distPath, 'assets'))).toEqual(['index-new.js']);
	});

	it('leaves every date of dist as it was when the new build is the same', () => {
		const files = {
			'index.html': 'page',
			'assets/index.js': 'code',
		};
		const { stagingPath, distPath } = SyncFolders.create(files, files);
		const result = DistSyncPlugin.sync(stagingPath, distPath);
		expect(result.writtenCount).toBe(0);
		expect(result.removedCount).toBe(0);
		for (const relativePath of Object.keys(files)) {
			expect(Fs.statSync(Path.join(distPath, relativePath)).mtimeMs).toBe(SyncFolders.oldDate.getTime());
		}
	});

	it('creates dist when it does not exist', () => {
		const { stagingPath, distPath } = SyncFolders.create({ 'index.html': 'page' }, {});
		Fs.rmSync(distPath, { recursive: true, force: true });
		DistSyncPlugin.sync(stagingPath, distPath);
		expect(Fs.readFileSync(Path.join(distPath, 'index.html'), 'utf8')).toBe('page');
	});
});
