import ChildProcess from 'node:child_process';
import Fs from 'node:fs';
import Os from 'node:os';
import Path from 'node:path';
import { TargetPaths } from '../src/target_paths.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	TestRepository — creates a small main checkout with worktrees in a temporary folder, for the tests
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Creates and fills temporary Git repositories. A test uses them in place of the real repository.
 */
export class TestRepository {
	/** The folders that the class created and did not remove yet. */
	private static _createdPaths: string[] = [];

	/** The value of the variable PATH when this file loaded: it finds the real `pnpm`. */
	private static readonly _realPath = process.env.PATH ?? '';

	/** The folder of the fake `pnpm`, shared by the whole process, or undefined before the first use. */
	private static _fakePnpmFolderPath: string | undefined = undefined;

	/** The repository that every new repository copies, shared by the whole process, or undefined before the first use. */
	private static _templatePath: string | undefined = undefined;

	/** The text of a `pnpm-lock.yaml` for a project without dependencies. */
	private static readonly _emptyLockfileText = [
		'lockfileVersion: \'9.0\'',
		'',
		'settings:',
		'  autoInstallPeers: true',
		'  excludeLinksFromLockfile: false',
		'',
		'importers:',
		'',
		'  .: {}',
		'',
	].join('\n');

	/**
	 * Creates a Git repository with one commit. The commit holds a `package.json` without dependencies and its
	 * `pnpm-lock.yaml`, so `pnpm install --frozen-lockfile` works in a worktree without a network. The path is the real
	 * path, without a symbolic link, because Git prints real paths.
	 * @returns The absolute path of the new main checkout.
	 */
	static create(): string {
		const temporaryPath = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'worktree_tools_test_'));
		const repositoryPath = Fs.realpathSync(temporaryPath);
		TestRepository._createdPaths.push(repositoryPath);
		Fs.cpSync(TestRepository._getTemplatePath(), repositoryPath, { recursive: true });
		return repositoryPath;
	}

	/**
	 * Gives a value of the variable PATH where a fake `pnpm` comes first. The fake `pnpm` creates the folder
	 * `node_modules` and exits with the code 0, so a test that does not check the installation does not wait for the real
	 * `pnpm` (about 300 milliseconds). The fake file is written once for the whole process, because macOS checks each new
	 * executable file the first time that it runs.
	 * @returns The value of PATH.
	 */
	static pathWithFakePnpm(): string {
		if (TestRepository._fakePnpmFolderPath === undefined) {
			const folderPath = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'worktree_tools_fake_pnpm_'));
			Fs.writeFileSync(Path.join(folderPath, 'pnpm'), '#!/bin/sh\nmkdir -p node_modules\n', { mode: 0o755 });
			process.once('exit', () => {
				Fs.rmSync(folderPath, { recursive: true, force: true });
			});
			TestRepository._fakePnpmFolderPath = folderPath;
		}
		return `${TestRepository._fakePnpmFolderPath}:${TestRepository._realPath}`;
	}

	/**
	 * Gives the value of the variable PATH that finds the real `pnpm`.
	 * @returns The value of PATH.
	 */
	static pathWithRealPnpm(): string {
		return TestRepository._realPath;
	}

	/**
	 * Creates a repository whose `package.json` has a dependency that its `pnpm-lock.yaml` does not list. In this
	 * repository, `pnpm install --frozen-lockfile` fails, and it fails before any network access.
	 * @returns The absolute path of the new main checkout.
	 */
	static createWithOutdatedLockfile(): string {
		const repositoryPath = TestRepository.create();
		const packageJsonText = TestRepository._packageJsonText({ 'left-pad': '1.3.0' });
		Fs.writeFileSync(Path.join(repositoryPath, 'package.json'), packageJsonText);
		TestRepository.git(repositoryPath, ['commit', '--quiet', '-a', '-m', 'Add a dependency without the lockfile']);
		return repositoryPath;
	}

	/**
	 * Creates a repository with a submodule that contains a nested submodule and has a newer unselected commit.
	 * @returns The path of the main checkout.
	 */
	static createWithSubmodules(): string {
		const nestedRepositoryPath = TestRepository.create();
		Fs.writeFileSync(Path.join(nestedRepositoryPath, 'rule.txt'), 'Nested rule');
		TestRepository.git(nestedRepositoryPath, ['add', 'rule.txt']);
		TestRepository.git(nestedRepositoryPath, ['commit', '--quiet', '-m', 'Add nested rule']);
		const sharedRepositoryPath = TestRepository.create();
		TestRepository.git(sharedRepositoryPath, [
			'-c', 'protocol.file.allow=always', 'submodule', 'add', '--quiet', nestedRepositoryPath, 'nested',
		]);
		Fs.writeFileSync(Path.join(sharedRepositoryPath, 'rule.txt'), 'Recorded rule');
		TestRepository.git(sharedRepositoryPath, ['add', '.']);
		TestRepository.git(sharedRepositoryPath, ['commit', '--quiet', '-m', 'Add recorded rule and nested submodule']);
		const mainCheckoutPath = TestRepository.create();
		TestRepository.git(mainCheckoutPath, [
			'-c', 'protocol.file.allow=always', 'submodule', 'add', '--quiet',
			sharedRepositoryPath, 'submodules/shared',
		]);
		TestRepository.git(mainCheckoutPath, ['commit', '--quiet', '-a', '-m', 'Add shared submodule']);
		Fs.writeFileSync(Path.join(sharedRepositoryPath, 'rule.txt'), 'Newer rule');
		TestRepository.git(sharedRepositoryPath, ['commit', '--quiet', '-a', '-m', 'Change rule after selection']);
		return mainCheckoutPath;
	}

	/**
	 * Creates a repository whose main checkout holds a debug build and bundled command line files.
	 * @returns The absolute path of the new main checkout.
	 */
	static createWithBuiltTarget(): string {
		const repositoryPath = TestRepository.create();
		TestRepository.writeTargetFile(repositoryPath, 'debug/heidrun', 'compiled application');
		TestRepository.writeTargetFile(repositoryPath, 'debug/deps/libserde.rlib', 'compiled dependency');
		TestRepository.writeTargetFile(repositoryPath, 'release/deps/libring.rlib', 'compiled release dependency');
		TestRepository.writeTargetFile(repositoryPath, 'release/bundled_commands/heidrun_code_ctrl', 'heidrun_code_ctrl');
		TestRepository.writeTargetFile(repositoryPath, 'release/bundled_commands/heidrun_data', 'heidrun_data');
		return repositoryPath;
	}

	/**
	 * Creates a repository whose main checkout is built, with one worktree whose target folder is ten days old.
	 * @returns The path of the main checkout, and the path of the target folder of the old worktree.
	 */
	static createWithOldWorktree(): { mainCheckoutPath: string; oldTargetPath: string } {
		const mainCheckoutPath = TestRepository.createWithBuiltTarget();
		const oldWorktreePath = TestRepository.addWorktree(mainCheckoutPath, 'old');
		TestRepository.writeTargetFile(oldWorktreePath, 'debug/heidrun', 'compiled application');
		const oldTargetPath = TargetPaths.targetPath(oldWorktreePath);
		TestRepository.ageTarget(oldWorktreePath, 10);
		return {
			mainCheckoutPath,
			oldTargetPath,
		};
	}

	/**
	 * Makes the Cargo target folder of a checkout look unused for some days.
	 * @param checkoutPath The absolute path of the main checkout or of a worktree.
	 * @param days The number of days.
	 * @returns Nothing.
	 */
	static ageTarget(checkoutPath: string, days: number): void {
		TestRepository.setModificationTimeOfTree(TargetPaths.targetPath(checkoutPath), TestRepository.daysAgo(days));
	}

	/**
	 * Gives a date some days before now.
	 * @param days The number of days.
	 * @returns The date.
	 */
	static daysAgo(days: number): Date {
		return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
	}

	/**
	 * Writes a file inside the Cargo target folder of a checkout, and creates the missing folders.
	 * @param checkoutPath The absolute path of the main checkout or of a worktree.
	 * @param relativePath The path of the file, relative to the Cargo target folder.
	 * @param content The text of the file.
	 * @returns The absolute path of the file.
	 */
	static writeTargetFile(checkoutPath: string, relativePath: string, content: string): string {
		const filePath = Path.join(TargetPaths.targetPath(checkoutPath), relativePath);
		Fs.mkdirSync(Path.dirname(filePath), { recursive: true });
		Fs.writeFileSync(filePath, content);
		return filePath;
	}

	/**
	 * Creates a worktree on a new branch in the folder `.claude/worktrees` of the main checkout, without the clone.
	 * @param mainCheckoutPath The absolute path of the main checkout.
	 * @param name The name of the new branch and of the folder of the worktree.
	 * @returns The absolute path of the new worktree.
	 */
	static addWorktree(mainCheckoutPath: string, name: string): string {
		const worktreePath = Path.join(mainCheckoutPath, '.claude', 'worktrees', name);
		TestRepository.git(mainCheckoutPath, ['worktree', 'add', '--quiet', '-b', name, worktreePath, 'HEAD']);
		return worktreePath;
	}

	/**
	 * Sets the modification time of a folder and of everything inside it.
	 * @param folderPath The absolute path of the folder.
	 * @param date The new modification time.
	 * @returns Nothing.
	 */
	static setModificationTimeOfTree(folderPath: string, date: Date): void {
		for (const entry of Fs.readdirSync(folderPath, { withFileTypes: true })) {
			const entryPath = Path.join(folderPath, entry.name);
			if (entry.isDirectory() === true) {
				TestRepository.setModificationTimeOfTree(entryPath, date);
			} else {
				Fs.utimesSync(entryPath, date, date);
			}
		}
		Fs.utimesSync(folderPath, date, date);
	}

	/**
	 * Runs one `git` command in a repository.
	 * @param repositoryPath The folder to run the command in.
	 * @param args The arguments of the `git` command.
	 * @returns The standard output of the command.
	 */
	static git(repositoryPath: string, args: string[]): string {
		return ChildProcess.execFileSync('git', args, {
			cwd: repositoryPath,
			encoding: 'utf8',
		});
	}

	/**
	 * Removes all the repository folders that the class created.
	 * @returns Nothing.
	 */
	static removeAll(): void {
		for (const repositoryPath of TestRepository._createdPaths.splice(0)) {
			Fs.rmSync(repositoryPath, { recursive: true, force: true });
		}
	}

	/**
	 * Gives the repository that `create` copies. It is built once for the whole process, with the seven `git` commands
	 * that a new repository needs, so a test copies a folder in place of starting these commands.
	 * @returns The absolute path of the repository.
	 */
	private static _getTemplatePath(): string {
		if (TestRepository._templatePath !== undefined) {
			return TestRepository._templatePath;
		}
		const templatePath = Fs.realpathSync(Fs.mkdtempSync(Path.join(Os.tmpdir(), 'worktree_tools_template_')));
		process.once('exit', () => {
			Fs.rmSync(templatePath, { recursive: true, force: true });
		});
		TestRepository.git(templatePath, ['init', '--quiet', '--initial-branch', 'main']);
		TestRepository.git(templatePath, ['config', 'user.name', 'Test Author']);
		TestRepository.git(templatePath, ['config', 'user.email', 'test@example.com']);
		TestRepository.git(templatePath, ['config', 'commit.gpgsign', 'false']);
		Fs.writeFileSync(Path.join(templatePath, 'package.json'), TestRepository._packageJsonText({}));
		Fs.writeFileSync(Path.join(templatePath, 'pnpm-lock.yaml'), TestRepository._emptyLockfileText);
		TestRepository.git(templatePath, ['add', 'package.json', 'pnpm-lock.yaml']);
		TestRepository.git(templatePath, ['commit', '--quiet', '-m', 'Initial commit']);
		TestRepository._templatePath = templatePath;
		return templatePath;
	}

	/**
	 * Builds the text of a `package.json` of a project that is not published.
	 * @param dependencies The dependencies of the project, with the name of each package and its exact version.
	 * @returns The text of the file.
	 */
	private static _packageJsonText(dependencies: Record<string, string>): string {
		const packageJson = {
			name: 'test_repository',
			private: true,
			version: '1.0.0',
			dependencies,
		};
		return `${JSON.stringify(packageJson, null, '\t')}\n`;
	}
}
