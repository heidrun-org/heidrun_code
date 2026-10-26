import Fs from 'node:fs';
import Path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InstallScriptRunner } from './install_script_runner.ts';

const DMG_URL = 'https://github.com/heidrun-org/heidrun_code/releases/latest/download/Heidrun_Code_aarch64.dmg';

describe('scripts/install.sh', () => {
	let runner: InstallScriptRunner;

	beforeEach(() => {
		runner = new InstallScriptRunner();
	});

	afterEach(() => {
		runner.remove();
	});

	describe('a normal installation', () => {
		it('copies Heidrun Code.app into the Applications folder and prints the installed version', () => {
			const result = runner.run();
			expect(result.exitCode).toBe(0);
			const appPath = Path.join(runner.applicationsFolder, 'Heidrun Code.app');
			expect(result.stdout).toContain(`Heidrun Code 1.2.3 is installed in ${appPath}.`);
			expect(Fs.existsSync(Path.join(appPath, 'Contents', 'Info.plist'))).toBe(true);
			for (const commandName of ['heidrun_code_ctrl', 'heidrun_data']) {
				const commandLink = Path.join(runner.homeFolder, '.local', 'bin', commandName);
				const commandPath = Path.join(appPath, 'Contents', 'Resources', 'binaries', commandName);
				expect(Fs.readlinkSync(commandLink)).toBe(commandPath);
			}
		});

		it('downloads the disk image of the latest release with curl -fL', () => {
			runner.run();
			const curlLines = runner.readLog().filter((line) => line.startsWith('curl '));
			expect(curlLines).toHaveLength(1);
			expect(curlLines[0]).toMatch(/^curl -fL -o \S+\/Heidrun_Code_aarch64\.dmg /);
			expect(curlLines[0].endsWith(` ${DMG_URL}`)).toBe(true);
		});

		it('mounts the disk image read only and without a window, then ejects it', () => {
			runner.run();
			const hdiutilLines = runner.readLog().filter((line) => line.startsWith('hdiutil '));
			expect(hdiutilLines).toHaveLength(2);
			expect(hdiutilLines[0]).toMatch(
				/^hdiutil attach -nobrowse -readonly -mountpoint \S+\/mount \S+\/Heidrun_Code_aarch64\.dmg$/,
			);
			expect(hdiutilLines[1]).toMatch(/^hdiutil detach \S+\/mount -quiet$/);
		});

		it('copies the application with ditto', () => {
			runner.run();
			const dittoLines = runner.readLog().filter((line) => line.startsWith('ditto '));
			expect(dittoLines).toHaveLength(1);
			expect(dittoLines[0]).toMatch(
				/^ditto \S+\/mount\/Heidrun Code\.app \S+\/Applications\/Heidrun Code\.app$/,
			);
		});

		it('deletes its temporary folder', () => {
			runner.run();
			expect(runner.listTemporaryFolderEntries()).toEqual([]);
		});

		it('replaces the Heidrun Code.app that is already installed', () => {
			const oldFilePath = Path.join(runner.applicationsFolder, 'Heidrun Code.app', 'old_file.txt');
			Fs.mkdirSync(Path.dirname(oldFilePath));
			Fs.writeFileSync(oldFilePath, 'old');
			const result = runner.run();
			expect(result.exitCode).toBe(0);
			expect(Fs.existsSync(oldFilePath)).toBe(false);
			expect(Fs.existsSync(Path.join(runner.applicationsFolder, 'Heidrun Code.app', 'Contents', 'Info.plist'))).toBe(
				true,
			);
		});
	});

	describe('a stop before any download', () => {
		it('stops with a clear message when the computer is not macOS', () => {
			const result = runner.run({
				FAKE_UNAME_S: 'Linux',
			});
			expect(result.exitCode).toBe(1);
			expect(result.stderr).toContain('Heidrun Code runs only on macOS.');
			expect(runner.readLog()).toEqual([]);
			expect(Fs.existsSync(Path.join(runner.applicationsFolder, 'Heidrun Code.app'))).toBe(false);
		});

		it('stops with a clear message when the processor is not Apple silicon', () => {
			const result = runner.run({
				FAKE_UNAME_M: 'x86_64',
			});
			expect(result.exitCode).toBe(1);
			expect(result.stderr).toContain('Heidrun Code has a disk image only for Apple silicon.');
			expect(runner.readLog()).toEqual([]);
			expect(Fs.existsSync(Path.join(runner.applicationsFolder, 'Heidrun Code.app'))).toBe(false);
		});

		it('stops with a clear message when the installed Heidrun Code is running, and does not touch it', () => {
			const installedFilePath = Path.join(runner.applicationsFolder, 'Heidrun Code.app', 'installed_file.txt');
			Fs.mkdirSync(Path.dirname(installedFilePath));
			Fs.writeFileSync(installedFilePath, 'installed');
			const result = runner.run({
				FAKE_IS_RUNNING: '1',
			});
			expect(result.exitCode).toBe(1);
			expect(result.stderr).toContain('Heidrun Code is running. Quit Heidrun Code, then run this command again.');
			expect(runner.readLog().filter((line) => line.startsWith('curl '))).toEqual([]);
			expect(Fs.existsSync(installedFilePath)).toBe(true);
		});

		it('looks for a running program that starts inside the installed Heidrun Code.app only', () => {
			runner.run();
			const pgrepLines = runner.readLog().filter((line) => line.startsWith('pgrep '));
			expect(pgrepLines).toEqual([
				`pgrep -f ${Path.join(runner.applicationsFolder, 'Heidrun Code.app', 'Contents', 'MacOS')}/`,
			]);
		});

		it('stops with a clear message when the user cannot write in the Applications folder', () => {
			Fs.chmodSync(runner.applicationsFolder, 0o555);
			const result = runner.run();
			expect(result.exitCode).toBe(1);
			expect(result.stderr).toContain('cannot write in the folder');
			expect(runner.readLog().filter((line) => line.startsWith('curl '))).toEqual([]);
		});
	});

	describe('a failure after the start of the work', () => {
		it('deletes its temporary folder and does not mount anything when the download fails', () => {
			const result = runner.run({
				FAKE_CURL_FAILS: '1',
			});
			expect(result.exitCode).not.toBe(0);
			expect(runner.readLog().filter((line) => line.startsWith('hdiutil '))).toEqual([]);
			expect(runner.listTemporaryFolderEntries()).toEqual([]);
			expect(Fs.existsSync(Path.join(runner.applicationsFolder, 'Heidrun Code.app'))).toBe(false);
		});

		it('ejects the disk image and deletes its temporary folder when the copy fails', () => {
			const result = runner.run({
				FAKE_DITTO_FAILS: '1',
			});
			expect(result.exitCode).not.toBe(0);
			const hdiutilLines = runner.readLog().filter((line) => line.startsWith('hdiutil '));
			expect(hdiutilLines).toHaveLength(2);
			expect(hdiutilLines[1]).toMatch(/^hdiutil detach /);
			expect(runner.listTemporaryFolderEntries()).toEqual([]);
		});
	});
});
