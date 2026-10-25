import ChildProcess from 'node:child_process';
import Fs from 'node:fs';
import Path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { TargetPaths } from '../src/target_paths.ts';
import { BundledCommandsStamp } from '../src/bundled_commands_stamp.ts';
import { SampleCargoProject } from './sample_cargo_project.ts';
import { SampleToolPackages } from './sample_tool_packages.ts';
import { TestRepository } from './test_repository.ts';

const __dirname = import.meta.dirname;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Helpers
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The result of one run of a command line.
 */
type CliResult = {
	/** The text printed on the standard output. */
	stdout: string;
	/** The text printed on the standard error output. */
	stderr: string;
	/** The exit code of the command line. */
	exitCode: number | null;
};

/**
 * Runs a command line file of the package in a new process, the same way the pnpm scripts run it.
 */
class CliRunner {
	/**
	 * Runs a command line file and waits for it to exit.
	 * @param fileName The name of the file in the folder `src`, for example `worktree_create_cli.ts`.
	 * @param workingDirectory The folder to run the command line in.
	 * @param args The arguments of the command line.
	 * @param isRealPnpm True to run the real `pnpm`. False, the default, puts a fake `pnpm` first in PATH.
	 * @returns The standard output, the standard error output, and the exit code.
	 */
	static run(fileName: string, workingDirectory: string, args: string[], isRealPnpm = false): CliResult {
		const tsxPath = Path.join(__dirname, '..', 'node_modules', '.bin', 'tsx');
		const cliPath = Path.join(__dirname, '..', 'src', fileName);
		const result = ChildProcess.spawnSync(tsxPath, [cliPath, ...args], {
			cwd: workingDirectory,
			encoding: 'utf8',
			env: {
				...process.env,
				PATH: isRealPnpm === true ? TestRepository.pathWithRealPnpm() : TestRepository.pathWithFakePnpm(),
			},
		});
		return {
			stdout: result.stdout,
			stderr: result.stderr,
			exitCode: result.status,
		};
	}
}

describe('worktree_create_cli', () => {
	afterEach(() => {
		TestRepository.removeAll();
	});

	it('creates the worktree and prints where', () => {
		const mainCheckoutPath = TestRepository.create();
		const result = CliRunner.run('worktree_create_cli.ts', mainCheckoutPath, ['fix-thing-12']);
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain(Path.join(mainCheckoutPath, '.claude', 'worktrees', 'fix-thing-12'));
		expect(Fs.existsSync(Path.join(mainCheckoutPath, '.claude', 'worktrees', 'fix-thing-12'))).toBe(true);
	});

	it.skipIf(process.platform !== 'darwin')('says that it cloned the debug folder', () => {
		const mainCheckoutPath = TestRepository.createWithBuiltTarget();
		const result = CliRunner.run('worktree_create_cli.ts', mainCheckoutPath, ['with-clone']);
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain('Cloned target/debug and target/release from the main checkout');
		const worktreePath = Path.join(mainCheckoutPath, '.claude', 'worktrees', 'with-clone');
		expect(Fs.existsSync(Path.join(TargetPaths.debugPath(worktreePath), 'heidrun'))).toBe(true);
		expect(Fs.existsSync(Path.join(TargetPaths.bundledCommandsPath(worktreePath), 'heidrun_code_ctrl'))).toBe(true);
		expect(Fs.existsSync(Path.join(TargetPaths.bundledCommandsPath(worktreePath), 'heidrun_code_data'))).toBe(true);
	});

	it('installs the packages and says so', () => {
		const mainCheckoutPath = TestRepository.create();
		const result = CliRunner.run('worktree_create_cli.ts', mainCheckoutPath, ['with-packages'], true);
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain('Installed the packages in the worktree');
		const worktreePath = Path.join(mainCheckoutPath, '.claude', 'worktrees', 'with-packages');
		expect(Fs.existsSync(Path.join(worktreePath, 'node_modules'))).toBe(true);
	});

	it('prints the error of pnpm and exits with code 1 when the installation fails', () => {
		const mainCheckoutPath = TestRepository.createWithOutdatedLockfile();
		const result = CliRunner.run('worktree_create_cli.ts', mainCheckoutPath, ['bad-lockfile'], true);
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain('"pnpm install --frozen-lockfile" failed');
		expect(result.stderr).toContain('lockfile');
		expect(result.stdout).not.toContain('Installed the packages');
	});

	it('clones nothing with the option --without-optimization, and says why', () => {
		const mainCheckoutPath = TestRepository.createWithBuiltTarget();
		const result = CliRunner.run('worktree_create_cli.ts', mainCheckoutPath, ['plain', '--without-optimization']);
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain('--without-optimization');
		const worktreePath = Path.join(mainCheckoutPath, '.claude', 'worktrees', 'plain');
		expect(Fs.existsSync(TargetPaths.debugPath(worktreePath))).toBe(false);
	});

	it('says that it did not clone when the main checkout is not built', () => {
		const mainCheckoutPath = TestRepository.create();
		const result = CliRunner.run('worktree_create_cli.ts', mainCheckoutPath, ['no-build']);
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain('were not cloned');
	});

	it('prints an error and exits with code 1 when the name is not valid', () => {
		const mainCheckoutPath = TestRepository.create();
		const result = CliRunner.run('worktree_create_cli.ts', mainCheckoutPath, ['bad name']);
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain('is not a valid branch name');
	});

	it('exits with a non-zero code when the name is missing', () => {
		const mainCheckoutPath = TestRepository.create();
		const result = CliRunner.run('worktree_create_cli.ts', mainCheckoutPath, []);
		expect(result.exitCode).not.toBe(0);
		expect(result.stderr).toContain('missing required argument');
	});
});

describe('target_clean_cli', () => {
	afterEach(() => {
		TestRepository.removeAll();
	});

	it('only lists the stale target folders without the option --yes', () => {
		const { mainCheckoutPath, oldTargetPath } = TestRepository.createWithOldWorktree();
		const result = CliRunner.run('target_clean_cli.ts', mainCheckoutPath, []);
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain(oldTargetPath);
		expect(result.stdout).toContain('Nothing was deleted');
		expect(Fs.existsSync(oldTargetPath)).toBe(true);
	});

	it('deletes the stale target folders with the option --yes', () => {
		const { mainCheckoutPath, oldTargetPath } = TestRepository.createWithOldWorktree();
		const result = CliRunner.run('target_clean_cli.ts', mainCheckoutPath, ['--yes']);
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain('Deleted 1 target folders');
		expect(Fs.existsSync(oldTargetPath)).toBe(false);
		expect(Fs.existsSync(TargetPaths.targetPath(mainCheckoutPath))).toBe(true);
	});

	it('lists nothing when the option --days is larger than the age of the folder', () => {
		const { mainCheckoutPath, oldTargetPath } = TestRepository.createWithOldWorktree();
		const result = CliRunner.run('target_clean_cli.ts', mainCheckoutPath, ['--days', '30', '--yes']);
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain('No worktree has a target folder that is 30 days old or older');
		expect(Fs.existsSync(oldTargetPath)).toBe(true);
	});

	it('exits with a non-zero code when the option --days is not a whole number', () => {
		const { mainCheckoutPath } = TestRepository.createWithOldWorktree();
		const result = CliRunner.run('target_clean_cli.ts', mainCheckoutPath, ['--days', 'many']);
		expect(result.exitCode).not.toBe(0);
		expect(result.stderr).toContain('Give a whole number of days');
	});
});

describe('target_prune_cli', () => {
	afterEach(() => {
		TestRepository.removeAll();
	});

	it('only lists the obsolete files without the option --yes', () => {
		const mainCheckoutPath = TestRepository.create();
		const oldFolderNames = SampleCargoProject.buildThenChangeVersion(mainCheckoutPath);
		const result = CliRunner.run('target_prune_cli.ts', mainCheckoutPath, []);
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain('Running "cargo build" and "cargo test --no-run"');
		expect(result.stdout).toContain('debug/deps:');
		expect(result.stdout).toContain('Nothing was deleted');
		const fingerprintPath = Path.join(TargetPaths.debugPath(mainCheckoutPath), '.fingerprint');
		for (const oldFolderName of oldFolderNames) {
			expect(Fs.existsSync(Path.join(fingerprintPath, oldFolderName))).toBe(true);
		}
	});

	it('deletes the obsolete files with the option --yes, and the next builds compile nothing', () => {
		const mainCheckoutPath = TestRepository.create();
		const oldFolderNames = SampleCargoProject.buildThenChangeVersion(mainCheckoutPath);
		const result = CliRunner.run('target_prune_cli.ts', mainCheckoutPath, ['--yes']);
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain('Deleted');
		const fingerprintPath = Path.join(TargetPaths.debugPath(mainCheckoutPath), '.fingerprint');
		for (const oldFolderName of oldFolderNames) {
			expect(Fs.existsSync(Path.join(fingerprintPath, oldFolderName))).toBe(false);
		}
		for (const cargoArguments of [['build'], ['test', '--no-run']]) {
			const cargoResult = SampleCargoProject.run(mainCheckoutPath, cargoArguments);
			expect(cargoResult.exitCode).toBe(0);
			expect(cargoResult.stderr).not.toContain('Compiling');
		}
	});

	it('finds nothing to delete in a folder that is already clean', () => {
		const mainCheckoutPath = TestRepository.create();
		SampleCargoProject.buildThenChangeVersion(mainCheckoutPath);
		CliRunner.run('target_prune_cli.ts', mainCheckoutPath, ['--yes']);
		const result = CliRunner.run('target_prune_cli.ts', mainCheckoutPath, ['--yes']);
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain('0 obsolete files in 0 entries');
		expect(result.stdout).not.toContain('Deleted');
	});

	it('works on the worktree that holds the current folder, and not on the main checkout', () => {
		const mainCheckoutPath = TestRepository.create();
		const worktreePath = TestRepository.addWorktree(mainCheckoutPath, 'feature');
		const oldFolderNames = SampleCargoProject.buildThenChangeVersion(worktreePath);
		const result = CliRunner.run('target_prune_cli.ts', TargetPaths.packagePath(worktreePath), ['--yes']);
		expect(result.exitCode).toBe(0);
		const fingerprintPath = Path.join(TargetPaths.debugPath(worktreePath), '.fingerprint');
		for (const oldFolderName of oldFolderNames) {
			expect(Fs.existsSync(Path.join(fingerprintPath, oldFolderName))).toBe(false);
		}
		expect(Fs.existsSync(TargetPaths.targetPath(mainCheckoutPath))).toBe(false);
	});

	it('prints the error of Cargo, deletes nothing, and exits with code 1 when the build fails', () => {
		const mainCheckoutPath = TestRepository.create();
		const oldFolderNames = SampleCargoProject.buildThenChangeVersion(mainCheckoutPath);
		Fs.writeFileSync(Path.join(TargetPaths.packagePath(mainCheckoutPath), 'src', 'lib.rs'), 'this is not Rust');
		const result = CliRunner.run('target_prune_cli.ts', mainCheckoutPath, ['--yes']);
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain('"cargo build" failed');
		expect(result.stdout).not.toContain('Deleted');
		const fingerprintPath = Path.join(TargetPaths.debugPath(mainCheckoutPath), '.fingerprint');
		for (const oldFolderName of oldFolderNames) {
			expect(Fs.existsSync(Path.join(fingerprintPath, oldFolderName))).toBe(true);
		}
	});
});

describe('bundled_commands_build_cli', () => {
	afterEach(() => {
		TestRepository.removeAll();
	});

	it('builds the tools and writes the stamp when there is no stamp', () => {
		const checkoutPath = TestRepository.create();
		SampleToolPackages.write(checkoutPath);
		SampleToolPackages.writeBuildScript(checkoutPath, false);
		const result = CliRunner.run('bundled_commands_build_cli.ts', checkoutPath, []);
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain('Built the bundled command line tools');
		expect(SampleToolPackages.countBuildRuns(checkoutPath)).toBe(1);
		const stampPath = Path.join(TargetPaths.bundledCommandsPath(checkoutPath), BundledCommandsStamp.stampFileName);
		expect(Fs.readFileSync(stampPath, 'utf8').trim()).toBe(BundledCommandsStamp.computeFingerprint(checkoutPath));
	});

	it('builds nothing the second time when the sources did not change', () => {
		const checkoutPath = TestRepository.create();
		SampleToolPackages.write(checkoutPath);
		SampleToolPackages.writeBuildScript(checkoutPath, false);
		CliRunner.run('bundled_commands_build_cli.ts', checkoutPath, []);
		const result = CliRunner.run('bundled_commands_build_cli.ts', checkoutPath, []);
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain('up to date. Nothing to build');
		expect(SampleToolPackages.countBuildRuns(checkoutPath)).toBe(1);
	});

	it('builds again when a source of a tool changed, or with the option --force', () => {
		const checkoutPath = TestRepository.create();
		SampleToolPackages.write(checkoutPath);
		SampleToolPackages.writeBuildScript(checkoutPath, false);
		CliRunner.run('bundled_commands_build_cli.ts', checkoutPath, []);
		Fs.appendFileSync(Path.join(checkoutPath, SampleToolPackages.dependencyRelativePath, 'src', 'lib.rs'), '// x\n');
		CliRunner.run('bundled_commands_build_cli.ts', checkoutPath, []);
		expect(SampleToolPackages.countBuildRuns(checkoutPath)).toBe(2);
		CliRunner.run('bundled_commands_build_cli.ts', checkoutPath, ['--force']);
		expect(SampleToolPackages.countBuildRuns(checkoutPath)).toBe(3);
	});

	it('exits with code 1 and writes no stamp when the build script fails', () => {
		const checkoutPath = TestRepository.create();
		SampleToolPackages.write(checkoutPath);
		SampleToolPackages.writeBuildScript(checkoutPath, true);
		const result = CliRunner.run('bundled_commands_build_cli.ts', checkoutPath, []);
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain('The build script failed with the exit code 3');
		const stampPath = Path.join(TargetPaths.bundledCommandsPath(checkoutPath), BundledCommandsStamp.stampFileName);
		expect(Fs.existsSync(stampPath)).toBe(false);
	});

	it('builds nothing in a worktree that has the tools and the stamp of the main checkout', () => {
		const mainCheckoutPath = TestRepository.create();
		SampleToolPackages.write(mainCheckoutPath);
		SampleToolPackages.writeBuildScript(mainCheckoutPath, false);
		TestRepository.git(mainCheckoutPath, ['add', '.']);
		TestRepository.git(mainCheckoutPath, ['commit', '--quiet', '-m', 'tools']);
		CliRunner.run('bundled_commands_build_cli.ts', mainCheckoutPath, []);
		const worktreePath = TestRepository.addWorktree(mainCheckoutPath, 'feature');
		Fs.cpSync(TargetPaths.bundledCommandsPath(mainCheckoutPath), TargetPaths.bundledCommandsPath(worktreePath), {
			recursive: true,
		});
		const result = CliRunner.run('bundled_commands_build_cli.ts', worktreePath, []);
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain('up to date. Nothing to build');
		expect(SampleToolPackages.countBuildRuns(worktreePath)).toBe(0);
	});
});
