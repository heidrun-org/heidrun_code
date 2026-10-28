import Fs from 'node:fs';
import Path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TargetPaths } from '../src/target_paths.ts';
import { WorktreeCreate } from '../src/worktree_create.ts';
import { TestRepository } from './test_repository.ts';

describe('WorktreeCreate', () => {
	beforeEach(() => {
		vi.stubEnv('PATH', TestRepository.pathWithFakePnpm());
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		TestRepository.removeAll();
	});

	describe('run', () => {
		it('initializes recorded submodule commits and nested submodules before installing packages', () => {
			vi.stubEnv('GIT_ALLOW_PROTOCOL', 'file');
			const mainCheckoutPath = TestRepository.createWithSubmodules();
			const result = WorktreeCreate.run({
				workingDirectory: mainCheckoutPath,
				name: 'with-submodules',
			});
			const sharedSubmodulePath = Path.join(result.worktreePath, 'submodules', 'shared');
			expect(Fs.readFileSync(Path.join(sharedSubmodulePath, 'rule.txt'), 'utf8')).toBe('Recorded rule');
			expect(Fs.readFileSync(Path.join(sharedSubmodulePath, 'nested', 'rule.txt'), 'utf8')).toBe('Nested rule');
			expect(Fs.existsSync(Path.join(result.worktreePath, 'node_modules'))).toBe(true);
		});

		it('keeps the worktree and stops before package installation when a submodule cannot be initialized', () => {
			vi.stubEnv('GIT_ALLOW_PROTOCOL', 'file');
			const mainCheckoutPath = TestRepository.createWithSubmodules();
			const missingRepositoryPath = Path.join(mainCheckoutPath, 'missing-repository');
			TestRepository.git(mainCheckoutPath, ['config', 'submodule.submodules/shared.url', missingRepositoryPath]);
			const worktreePath = Path.join(mainCheckoutPath, '.claude', 'worktrees', 'unavailable-submodule');
			expect(() => {
				WorktreeCreate.run({
					workingDirectory: mainCheckoutPath,
					name: 'unavailable-submodule',
				});
			}).toThrow(/submodules could not be initialized[\s\S]*git submodule update --init --recursive/);
			expect(Fs.existsSync(worktreePath)).toBe(true);
			expect(Fs.existsSync(Path.join(worktreePath, 'node_modules'))).toBe(false);
		});

		it('creates the worktree in .claude/worktrees on a new branch with the same name', () => {
			const mainCheckoutPath = TestRepository.create();
			const result = WorktreeCreate.run({
				workingDirectory: mainCheckoutPath,
				name: 'fix-thing-12',
			});
			const expectedWorktreePath = Path.join(mainCheckoutPath, '.claude', 'worktrees', 'fix-thing-12');
			expect(result.worktreePath).toBe(expectedWorktreePath);
			expect(result.branchName).toBe('fix-thing-12');
			expect(TestRepository.git(expectedWorktreePath, ['branch', '--show-current']).trim()).toBe('fix-thing-12');
		});

		it('starts the new branch at the base reference', () => {
			const mainCheckoutPath = TestRepository.create();
			TestRepository.git(mainCheckoutPath, ['commit', '--quiet', '--allow-empty', '-m', 'Second commit']);
			TestRepository.git(mainCheckoutPath, ['branch', 'older', 'HEAD~1']);
			const result = WorktreeCreate.run({
				workingDirectory: mainCheckoutPath,
				name: 'from-older',
				baseRef: 'older',
			});
			const subject = TestRepository.git(result.worktreePath, ['log', '-1', '--format=%s']).trim();
			expect(subject).toBe('Initial commit');
		});

		it('finds the main checkout when it runs inside another worktree', () => {
			const mainCheckoutPath = TestRepository.create();
			const firstWorktreePath = TestRepository.addWorktree(mainCheckoutPath, 'first');
			const result = WorktreeCreate.run({
				workingDirectory: firstWorktreePath,
				name: 'second',
			});
			expect(result.worktreePath).toBe(Path.join(mainCheckoutPath, '.claude', 'worktrees', 'second'));
		});

		it.skipIf(process.platform !== 'darwin')('clones the debug folder of the main checkout', () => {
			const mainCheckoutPath = TestRepository.createWithBuiltTarget();
			const result = WorktreeCreate.run({
				workingDirectory: mainCheckoutPath,
				name: 'with-clone',
			});
			expect(result.isTargetCloned).toBe(true);
			expect(result.skipReason).toBeNull();

			const sourceFilePath = Path.join(TargetPaths.debugPath(mainCheckoutPath), 'deps', 'libserde.rlib');
			const cloneFilePath = Path.join(TargetPaths.debugPath(result.worktreePath), 'deps', 'libserde.rlib');
			expect(Fs.readFileSync(cloneFilePath, 'utf8')).toBe('compiled dependency');
			expect(Fs.statSync(cloneFilePath).mtimeMs).toBe(Fs.statSync(sourceFilePath).mtimeMs);

			Fs.writeFileSync(cloneFilePath, 'changed in the worktree');
			expect(Fs.readFileSync(sourceFilePath, 'utf8')).toBe('compiled dependency');
		});

		it.skipIf(process.platform !== 'darwin')('clones the bundled command line resources required by Tauri', () => {
			const mainCheckoutPath = TestRepository.createWithBuiltTarget();
			const result = WorktreeCreate.run({
				workingDirectory: mainCheckoutPath,
				name: 'with-bundled-commands',
			});
			const bundledCommandsPath = TargetPaths.bundledCommandsPath(result.worktreePath);
			expect(Fs.readFileSync(Path.join(bundledCommandsPath, 'heidrun_code_ctrl'), 'utf8')).toBe('heidrun_code_ctrl');
			expect(Fs.readFileSync(Path.join(bundledCommandsPath, 'heidrun_data'), 'utf8')).toBe('heidrun_data');
		});

		it.skipIf(process.platform !== 'darwin')('clones the compiled dependencies of the release folder', () => {
			const mainCheckoutPath = TestRepository.createWithBuiltTarget();
			const result = WorktreeCreate.run({
				workingDirectory: mainCheckoutPath,
				name: 'with-release',
			});
			const clonePath = Path.join(TargetPaths.releasePath(result.worktreePath), 'deps', 'libring.rlib');
			expect(Fs.readFileSync(clonePath, 'utf8')).toBe('compiled release dependency');
		});

		it('installs the packages: the new worktree has a folder node_modules', () => {
			vi.stubEnv('PATH', TestRepository.pathWithRealPnpm());
			const mainCheckoutPath = TestRepository.create();
			const result = WorktreeCreate.run({
				workingDirectory: mainCheckoutPath,
				name: 'with-packages',
			});
			expect(Fs.existsSync(Path.join(result.worktreePath, 'node_modules'))).toBe(true);
			expect(Fs.existsSync(Path.join(mainCheckoutPath, 'node_modules'))).toBe(false);
		});

		it('installs the packages from the lockfile and does not change the lockfile', () => {
			vi.stubEnv('PATH', TestRepository.pathWithRealPnpm());
			const mainCheckoutPath = TestRepository.create();
			const result = WorktreeCreate.run({
				workingDirectory: mainCheckoutPath,
				name: 'lockfile-kept',
			});
			const status = TestRepository.git(result.worktreePath, ['status', '--porcelain', '--', 'pnpm-lock.yaml']);
			expect(status.trim()).toBe('');
		});

		it('throws with the output of pnpm when the installation fails, and keeps the worktree', () => {
			vi.stubEnv('PATH', TestRepository.pathWithRealPnpm());
			const mainCheckoutPath = TestRepository.createWithOutdatedLockfile();
			const worktreePath = Path.join(mainCheckoutPath, '.claude', 'worktrees', 'bad-lockfile');
			expect(() => {
				WorktreeCreate.run({
					workingDirectory: mainCheckoutPath,
					name: 'bad-lockfile',
				});
			}).toThrow(/was created, but "pnpm install --frozen-lockfile" failed[\s\S]*lockfile/);
			expect(Fs.existsSync(worktreePath)).toBe(true);
			expect(Fs.existsSync(Path.join(worktreePath, 'node_modules'))).toBe(false);
		});

		it('clones nothing with the option isWithoutOptimization, even when the main checkout is built', () => {
			const mainCheckoutPath = TestRepository.createWithBuiltTarget();
			const result = WorktreeCreate.run({
				workingDirectory: mainCheckoutPath,
				name: 'without-optimization',
				isWithoutOptimization: true,
			});
			expect(result.isTargetCloned).toBe(false);
			expect(result.skipReason).toBe(WorktreeCreate.withoutOptimizationReason);
			expect(result.sourceDates.fileCount).toBe(0);
			expect(Fs.existsSync(TargetPaths.targetPath(result.worktreePath))).toBe(false);
		});

		it('creates the worktree without a clone when the main checkout has no debug folder', () => {
			const mainCheckoutPath = TestRepository.create();
			const result = WorktreeCreate.run({
				workingDirectory: mainCheckoutPath,
				name: 'no-build',
			});
			expect(Fs.existsSync(result.worktreePath)).toBe(true);
			expect(result.isTargetCloned).toBe(false);
			expect(result.skipReason).not.toBeNull();
			expect(Fs.existsSync(TargetPaths.targetPath(result.worktreePath))).toBe(false);
		});

		it('throws when the name is not a valid branch name', () => {
			const mainCheckoutPath = TestRepository.create();
			expect(() => {
				WorktreeCreate.run({
					workingDirectory: mainCheckoutPath,
					name: 'bad name',
				});
			}).toThrow('is not a valid branch name');
		});

		it('throws when the folder of the worktree exists already', () => {
			const mainCheckoutPath = TestRepository.create();
			WorktreeCreate.run({
				workingDirectory: mainCheckoutPath,
				name: 'twice',
			});
			expect(() => {
				WorktreeCreate.run({
					workingDirectory: mainCheckoutPath,
					name: 'twice',
				});
			}).toThrow('exists already');
		});

		it('throws when the branch exists already', () => {
			const mainCheckoutPath = TestRepository.create();
			TestRepository.git(mainCheckoutPath, ['branch', 'taken']);
			expect(() => {
				WorktreeCreate.run({
					workingDirectory: mainCheckoutPath,
					name: 'taken',
				});
			}).toThrow('already exists');
		});
	});
});
