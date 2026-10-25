import Fs from 'node:fs';
import Os from 'node:os';
import Path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { TargetPaths } from '../src/target_paths.ts';
import { TargetPrune } from '../src/target_prune.ts';
import { SampleCargoProject } from './sample_cargo_project.ts';
import { TestRepository } from './test_repository.ts';

const USED_HASH = '00000000000000aa';
const OBSOLETE_HASH = '00000000000000bb';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Helpers
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Writes files in a temporary debug folder, for the tests of `TargetPrune.plan`.
 */
class DebugFolder {
	/**
	 * Creates a temporary debug folder.
	 * @returns The absolute path of the new folder.
	 */
	static create(): string {
		return Fs.realpathSync(Fs.mkdtempSync(Path.join(Os.tmpdir(), 'target_prune_test_')));
	}

	/**
	 * Writes a file, and the folders above it.
	 * @param debugPath The absolute path of the debug folder.
	 * @param relativePath The path of the file inside the debug folder.
	 * @returns Nothing.
	 */
	static write(debugPath: string, relativePath: string): void {
		const filePath = Path.join(debugPath, relativePath);
		Fs.mkdirSync(Path.dirname(filePath), { recursive: true });
		Fs.writeFileSync(filePath, 'content');
	}

	/**
	 * Sets the modification time of a folder.
	 * @param folderPath The absolute path of the folder.
	 * @param daysAgo The age of the folder in days.
	 * @returns Nothing.
	 */
	static age(folderPath: string, daysAgo: number): void {
		const time = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
		Fs.utimesSync(folderPath, time, time);
	}

	/**
	 * Finds the entries of a folder whose name holds the hash of a unit.
	 * @param folderPath The absolute path of the folder.
	 * @param hash The hash of a unit.
	 * @returns The names of the entries that hold the hash.
	 */
	static findEntriesWithHash(folderPath: string, hash: string): string[] {
		return Fs.readdirSync(folderPath).filter((entryName) => {
			return entryName.includes(`-${hash}`);
		});
	}
}

describe('TargetPrune', () => {
	const temporaryPaths: string[] = [];

	afterEach(() => {
		TestRepository.removeAll();
		for (const temporaryPath of temporaryPaths.splice(0)) {
			Fs.rmSync(temporaryPath, { recursive: true, force: true });
		}
	});

	describe('plan', () => {
		it('lists the entries whose hash is not used, and keeps the others', () => {
			const debugPath = DebugFolder.create();
			temporaryPaths.push(debugPath);
			DebugFolder.write(debugPath, `deps/libserde-${USED_HASH}.rlib`);
			DebugFolder.write(debugPath, `deps/libserde-${USED_HASH}.rmeta`);
			DebugFolder.write(debugPath, `deps/libserde-${OBSOLETE_HASH}.rlib`);
			DebugFolder.write(debugPath, `deps/serde-${OBSOLETE_HASH}.d`);
			DebugFolder.write(debugPath, `.fingerprint/serde-${USED_HASH}/lib-serde`);
			DebugFolder.write(debugPath, `.fingerprint/serde-${OBSOLETE_HASH}/lib-serde`);
			DebugFolder.write(debugPath, `.fingerprint/serde-${OBSOLETE_HASH}/lib-serde.json`);
			DebugFolder.write(debugPath, `build/serde-${OBSOLETE_HASH}/output`);

			const plan = TargetPrune.plan({
				debugPath,
				usedHashes: new Set([USED_HASH]),
			});

			const obsoletePaths = plan.obsoleteEntries.map((obsoleteEntry) => {
				return Path.relative(debugPath, obsoleteEntry.path);
			}).sort();
			expect(obsoletePaths).toEqual([
				`.fingerprint/serde-${OBSOLETE_HASH}`,
				`build/serde-${OBSOLETE_HASH}`,
				`deps/libserde-${OBSOLETE_HASH}.rlib`,
				`deps/serde-${OBSOLETE_HASH}.d`,
			]);
			expect(plan.obsoleteFileCount).toBe(5);
			expect(plan.keptFileCount).toBe(3);
		});

		it('keeps an entry that has no hash in its name', () => {
			const debugPath = DebugFolder.create();
			temporaryPaths.push(debugPath);
			DebugFolder.write(debugPath, 'deps/.cargo-lock');
			DebugFolder.write(debugPath, 'build/.cargo-lock');
			DebugFolder.write(debugPath, `deps/libshort-${USED_HASH.slice(2)}.rlib`);

			const plan = TargetPrune.plan({
				debugPath,
				usedHashes: new Set([USED_HASH]),
			});

			expect(plan.obsoleteEntries).toEqual([]);
			expect(plan.keptFileCount).toBe(3);
		});

		it('never lists a file outside the folders deps, .fingerprint, build, and incremental', () => {
			const debugPath = DebugFolder.create();
			temporaryPaths.push(debugPath);
			DebugFolder.write(debugPath, `heidrun-${OBSOLETE_HASH}`);
			DebugFolder.write(debugPath, `bundle/app-${OBSOLETE_HASH}/file`);
			DebugFolder.write(debugPath, `examples/sample-${OBSOLETE_HASH}`);

			const plan = TargetPrune.plan({
				debugPath,
				usedHashes: new Set([USED_HASH]),
			});

			expect(plan.obsoleteEntries).toEqual([]);
		});

		it('keeps the most recently changed incremental folders of each crate', () => {
			const debugPath = DebugFolder.create();
			temporaryPaths.push(debugPath);
			const daysAgoByFolderName = {
				'sample-aaa': 1,
				'sample-bbb': 5,
				'sample-ccc': 9,
				'other-ddd': 30,
			};
			for (const [folderName, daysAgo] of Object.entries(daysAgoByFolderName)) {
				DebugFolder.write(debugPath, `incremental/${folderName}/s-1/data`);
				DebugFolder.age(Path.join(debugPath, 'incremental', folderName), daysAgo);
			}

			const plan = TargetPrune.plan({
				debugPath,
				usedHashes: new Set([USED_HASH]),
			});

			expect(plan.obsoleteEntries.map((obsoleteEntry) => {
				return Path.basename(obsoleteEntry.path);
			})).toEqual(['sample-ccc']);
			expect(plan.obsoleteEntries[0]?.folderName).toBe('incremental');
			expect(plan.keptFileCount).toBe(3);
		});

		it('gives an empty plan for a debug folder that does not exist', () => {
			expect(TargetPrune.plan({
				debugPath: Path.join(Os.tmpdir(), 'target_prune_missing_folder'),
				usedHashes: new Set([USED_HASH]),
			})).toEqual({
				obsoleteEntries: [],
				obsoleteFileCount: 0,
				keptFileCount: 0,
			});
		});
	});

	describe('remove', () => {
		it('deletes the obsolete entries and nothing else', () => {
			const debugPath = DebugFolder.create();
			temporaryPaths.push(debugPath);
			DebugFolder.write(debugPath, `deps/libserde-${USED_HASH}.rlib`);
			DebugFolder.write(debugPath, `deps/libserde-${OBSOLETE_HASH}.rlib`);
			DebugFolder.write(debugPath, `.fingerprint/serde-${OBSOLETE_HASH}/lib-serde`);

			TargetPrune.remove(TargetPrune.plan({
				debugPath,
				usedHashes: new Set([USED_HASH]),
			}));

			expect(Fs.readdirSync(Path.join(debugPath, 'deps'))).toEqual([`libserde-${USED_HASH}.rlib`]);
			expect(Fs.readdirSync(Path.join(debugPath, '.fingerprint'))).toEqual([]);
		});
	});

	describe('findUsedHashes', () => {
		it('finds the hash of every unit that the builds use, and of no other unit', () => {
			const mainCheckoutPath = TestRepository.create();
			SampleCargoProject.write(mainCheckoutPath, '0.1.0');
			SampleCargoProject.buildAll(mainCheckoutPath);
			const fingerprintPath = Path.join(TargetPaths.debugPath(mainCheckoutPath), '.fingerprint');
			const oldHashes = Fs.readdirSync(fingerprintPath).map((entryName) => {
				return entryName.slice(-16);
			});
			SampleCargoProject.write(mainCheckoutPath, '0.2.0');

			const usedHashes = TargetPrune.findUsedHashes({ packagePath: TargetPaths.packagePath(mainCheckoutPath) });

			expect(usedHashes.size).toBeGreaterThanOrEqual(4);
			for (const oldHash of oldHashes) {
				expect(usedHashes.has(oldHash)).toBe(false);
			}
			for (const usedHash of usedHashes) {
				expect(DebugFolder.findEntriesWithHash(fingerprintPath, usedHash).length).toBeGreaterThan(0);
			}
		});

		it('throws when a Cargo command fails, and deletes nothing', () => {
			const mainCheckoutPath = TestRepository.create();
			SampleCargoProject.write(mainCheckoutPath, '0.1.0');
			Fs.writeFileSync(Path.join(TargetPaths.packagePath(mainCheckoutPath), 'src', 'lib.rs'), 'this is not Rust');

			expect(() => {
				TargetPrune.findUsedHashes({ packagePath: TargetPaths.packagePath(mainCheckoutPath) });
			}).toThrow(/"cargo build" failed with the exit code 101, so no file is deleted/);
		});

		it('throws when the Cargo log names no unit', () => {
			const fakeBinPath = Fs.realpathSync(Fs.mkdtempSync(Path.join(Os.tmpdir(), 'target_prune_fake_cargo_')));
			temporaryPaths.push(fakeBinPath);
			Fs.writeFileSync(Path.join(fakeBinPath, 'cargo'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
			const realPath = process.env.PATH;
			process.env.PATH = `${fakeBinPath}${Path.delimiter}${realPath ?? ''}`;
			try {
				expect(() => {
					TargetPrune.findUsedHashes({ packagePath: fakeBinPath });
				}).toThrow(/names no compilation unit/);
			} finally {
				process.env.PATH = realPath;
			}
		});
	});

	describe('with a real build', () => {
		it('deletes the files of the old version, and the next builds compile nothing', () => {
			const mainCheckoutPath = TestRepository.create();
			SampleCargoProject.write(mainCheckoutPath, '0.1.0');
			SampleCargoProject.buildAll(mainCheckoutPath);
			SampleCargoProject.write(mainCheckoutPath, '0.2.0');
			SampleCargoProject.buildAll(mainCheckoutPath);

			const usedHashes = TargetPrune.findUsedHashes({ packagePath: TargetPaths.packagePath(mainCheckoutPath) });
			const plan = TargetPrune.plan({
				debugPath: TargetPaths.debugPath(mainCheckoutPath),
				usedHashes,
			});
			expect(plan.obsoleteFileCount).toBeGreaterThan(0);
			TargetPrune.remove(plan);

			expect(TargetPrune.plan({
				debugPath: TargetPaths.debugPath(mainCheckoutPath),
				usedHashes,
			}).obsoleteEntries).toEqual([]);
			for (const cargoArguments of [['build'], ['test', '--no-run']]) {
				const result = SampleCargoProject.run(mainCheckoutPath, cargoArguments);
				expect(result.exitCode).toBe(0);
				expect(result.stderr).not.toContain('Compiling');
			}
		});
	});
});
