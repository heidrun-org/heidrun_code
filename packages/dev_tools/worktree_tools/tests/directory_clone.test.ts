import Fs from 'node:fs';
import Os from 'node:os';
import Path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DirectoryClone } from '../src/directory_clone.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Helpers
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Creates a source folder with files and subfolders that all have an old date.
 */
class DatedFolder {
	/** The temporary folders that the tests created. */
	static createdPaths: string[] = [];

	/** The old date of every file and folder of the source. */
	static readonly oldDate = new Date('2026-01-01T00:00:00Z');

	/** The relative paths of the entries that the tests compare, the folders included. */
	static readonly relativePaths = ['.', 'deps', 'deps/libserde.rlib', 'build', 'build/serde-1/output'];

	/**
	 * Creates the source folder `debug` in a new temporary folder.
	 * @returns The path of the source folder and the path where the clone goes.
	 */
	static create(): { sourcePath: string; destinationPath: string } {
		const rootPath = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'directory_clone_test_'));
		DatedFolder.createdPaths.push(rootPath);
		const sourcePath = Path.join(rootPath, 'debug');
		Fs.mkdirSync(Path.join(sourcePath, 'deps'), { recursive: true });
		Fs.mkdirSync(Path.join(sourcePath, 'build', 'serde-1'), { recursive: true });
		Fs.writeFileSync(Path.join(sourcePath, 'deps', 'libserde.rlib'), 'compiled');
		Fs.writeFileSync(Path.join(sourcePath, 'build', 'serde-1', 'output'), 'cargo:rustc-cfg=fast\n');
		Fs.chmodSync(Path.join(sourcePath, 'deps', 'libserde.rlib'), 0o755);
		const paths = [...DatedFolder.relativePaths, 'build/serde-1'];
		for (const relativePath of paths.reverse()) {
			Fs.utimesSync(Path.join(sourcePath, relativePath), DatedFolder.oldDate, DatedFolder.oldDate);
		}
		return {
			sourcePath,
			destinationPath: Path.join(rootPath, 'clone'),
		};
	}

	/**
	 * Checks that the clone has the content, the permissions, and the dates of the source.
	 * @param sourcePath The absolute path of the source folder.
	 * @param destinationPath The absolute path of the cloned folder.
	 * @returns Nothing.
	 */
	static expectSame(sourcePath: string, destinationPath: string): void {
		for (const relativePath of DatedFolder.relativePaths) {
			const sourceStat = Fs.statSync(Path.join(sourcePath, relativePath));
			const destinationStat = Fs.statSync(Path.join(destinationPath, relativePath));
			expect(destinationStat.mtimeMs).toBe(sourceStat.mtimeMs);
			expect(destinationStat.mode).toBe(sourceStat.mode);
		}
		expect(Fs.readFileSync(Path.join(destinationPath, 'deps', 'libserde.rlib'), 'utf8')).toBe('compiled');
	}
}

describe('DirectoryClone', () => {
	afterEach(() => {
		for (const createdPath of DatedFolder.createdPaths.splice(0)) {
			Fs.rmSync(createdPath, { recursive: true, force: true });
		}
	});

	it.runIf(process.platform === 'darwin')('clones a folder with the dates of its files and of its folders', () => {
		const { sourcePath, destinationPath } = DatedFolder.create();
		expect(DirectoryClone.clone(sourcePath, destinationPath)).toBeNull();
		DatedFolder.expectSame(sourcePath, destinationPath);
	});

	it('falls back to cp when python3 is missing, and keeps the same dates', () => {
		const { sourcePath, destinationPath } = DatedFolder.create();
		const result = DirectoryClone.clone(sourcePath, destinationPath, {
			pythonCommand: 'missing_python_command_for_test',
		});
		expect(result).toBeNull();
		DatedFolder.expectSame(sourcePath, destinationPath);
	});

	it('returns the error of cp when the source does not exist', () => {
		const { sourcePath, destinationPath } = DatedFolder.create();
		const result = DirectoryClone.clone(Path.join(sourcePath, 'missing'), destinationPath);
		expect(result).not.toBeNull();
		expect(Fs.existsSync(destinationPath)).toBe(false);
	});
});
