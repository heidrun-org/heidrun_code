import ChildProcess from 'node:child_process';
import Fs from 'node:fs';
import Os from 'node:os';
import Path from 'node:path';

const __dirname = import.meta.dirname;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	InstallScriptRunner — runs scripts/install.sh with fake commands in a temporary folder
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The result of one run of the script `scripts/install.sh`.
 */
export type InstallScriptResult = {
	/** The exit code of the script, or null when a signal stopped the script. */
	exitCode: number | null;
	/** Everything that the script wrote on the standard output. */
	stdout: string;
	/** Everything that the script wrote on the standard error output. */
	stderr: string;
};

const SCRIPT_PATH = Path.resolve(__dirname, '..', '..', '..', '..', 'scripts', 'install.sh');

const FAKE_COMMANDS: Record<string, string> = {
	uname: /* sh */`#!/bin/sh
case "$1" in
	-s) echo "\${FAKE_UNAME_S:-Darwin}" ;;
	-m) echo "\${FAKE_UNAME_M:-arm64}" ;;
esac
`,
	pgrep: /* sh */`#!/bin/sh
echo "pgrep $*" >> "$FAKE_LOG"
if [ -n "\${FAKE_IS_RUNNING:-}" ]; then
	exit 0
fi
exit 1
`,
	curl: /* sh */`#!/bin/sh
echo "curl $*" >> "$FAKE_LOG"
if [ -n "\${FAKE_CURL_FAILS:-}" ]; then
	exit 22
fi
while [ $# -gt 0 ]; do
	if [ "$1" = "-o" ]; then
		echo "fake disk image" > "$2"
	fi
	shift
done
`,
	hdiutil: /* sh */`#!/bin/sh
echo "hdiutil $*" >> "$FAKE_LOG"
action="$1"
if [ "$action" = "attach" ]; then
	while [ $# -gt 0 ]; do
		if [ "$1" = "-mountpoint" ]; then
			cp -R "$FAKE_FIXTURE_FOLDER/Heidrun Code.app" "$2/Heidrun Code.app"
		fi
		shift
	done
elif [ "$action" = "detach" ]; then
	rm -rf "$2/Heidrun Code.app"
fi
`,
	ditto: /* sh */`#!/bin/sh
echo "ditto $*" >> "$FAKE_LOG"
if [ -n "\${FAKE_DITTO_FAILS:-}" ]; then
	exit 1
fi
cp -R "$1" "$2"
`,
};

/**
 * Runs the script `scripts/install.sh` in a temporary folder. The folder holds a fake Applications folder, a fake
 * temporary folder, a fake disk image, and fake versions of the commands `uname`, `pgrep`, `curl`, `hdiutil`, and
 * `ditto`. Each fake command writes its arguments in a log file, so a test can read what the script did.
 */
export class InstallScriptRunner {
	/** The folder of the fake commands, shared by every runner of this process, or undefined before the first need. */
	private static _fakeCommandsFolder: string | undefined = undefined;

	/** The temporary folder that holds everything of this runner. */
	readonly rootFolder: string;

	/** The folder that receives Heidrun Code.app, in place of /Applications. */
	readonly applicationsFolder: string;

	/** The home folder that receives the command links, in place of the user's home folder. */
	readonly homeFolder: string;

	/** The folder that the script uses in place of /tmp. The script must leave it empty. */
	readonly temporaryFolder: string;

	/** The file where each fake command writes one line for each call. */
	readonly logPath: string;

	/**
	 * Creates the temporary folder, the fake commands, and a fake Heidrun Code.app that has the given version.
	 * @param version The version that the fake Heidrun Code.app has in its Info.plist.
	 */
	constructor(version = '1.2.3') {
		this.rootFolder = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'install_script_tests_'));
		this.applicationsFolder = Path.join(this.rootFolder, 'Applications');
		this.homeFolder = Path.join(this.rootFolder, 'home');
		this.temporaryFolder = Path.join(this.rootFolder, 'tmp');
		this.logPath = Path.join(this.rootFolder, 'log.txt');
		Fs.mkdirSync(this.applicationsFolder);
		Fs.mkdirSync(this.homeFolder);
		Fs.mkdirSync(this.temporaryFolder);
		Fs.writeFileSync(this.logPath, '');

		const contentsFolder = Path.join(this.rootFolder, 'fixture', 'Heidrun Code.app', 'Contents');
		Fs.mkdirSync(contentsFolder, {
			recursive: true,
		});
		Fs.writeFileSync(
			Path.join(contentsFolder, 'Info.plist'),
			`<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0">\n<dict>\n`
				+ `\t<key>CFBundleName</key>\n\t<string>Heidrun Code</string>\n`
				+ `\t<key>CFBundleShortVersionString</key>\n\t<string>${version}</string>\n`
				+ `</dict>\n</plist>\n`,
		);
		const binariesFolder = Path.join(contentsFolder, 'Resources', 'binaries');
		Fs.mkdirSync(binariesFolder, {
			recursive: true,
		});
		for (const commandName of ['heidrun_code_ctrl', 'heidrun_data']) {
			Fs.writeFileSync(Path.join(binariesFolder, commandName), '#!/bin/sh\n', {
				mode: 0o755,
			});
		}
	}

	/**
	 * Runs the script `scripts/install.sh` with the fake commands.
	 * @param environment More environment variables for the run. The fake commands read FAKE_UNAME_S, FAKE_UNAME_M,
	 * FAKE_IS_RUNNING, FAKE_CURL_FAILS, and FAKE_DITTO_FAILS.
	 * @returns The exit code, the standard output, and the standard error output of the script.
	 */
	run(environment: Record<string, string> = {}): InstallScriptResult {
		const result = ChildProcess.spawnSync('/bin/sh', [SCRIPT_PATH], {
			encoding: 'utf8',
			env: {
				PATH: `${InstallScriptRunner._getFakeCommandsFolder()}:/usr/bin:/bin`,
				TMPDIR: this.temporaryFolder,
				HEIDRUN_CODE_APPLICATIONS_FOLDER: this.applicationsFolder,
				HOME: this.homeFolder,
				FAKE_LOG: this.logPath,
				FAKE_FIXTURE_FOLDER: Path.join(this.rootFolder, 'fixture'),
				...environment,
			},
		});
		return {
			exitCode: result.status,
			stdout: result.stdout,
			stderr: result.stderr,
		};
	}

	/**
	 * Reads the calls that the fake commands wrote in the log file.
	 * @returns One line for each call, in the order of the calls, for example `curl -fL -o <path> <address>`.
	 */
	readLog(): string[] {
		return Fs.readFileSync(this.logPath, 'utf8').split('\n').filter((line) => line !== '');
	}

	/**
	 * Lists what the script left in its temporary folder.
	 * @returns The names of the files and folders that are still in the temporary folder.
	 */
	listTemporaryFolderEntries(): string[] {
		return Fs.readdirSync(this.temporaryFolder);
	}

	/**
	 * Deletes the temporary folder of this runner.
	 * @returns Nothing.
	 */
	remove(): void {
		Fs.chmodSync(this.applicationsFolder, 0o755);
		Fs.rmSync(this.rootFolder, {
			recursive: true,
			force: true,
		});
	}

	/**
	 * Gives the folder of the fake commands. The folder is created once for the whole process, because macOS checks each new
	 * executable file the first time that it runs, and this costs more than 100 milliseconds for each fake command.
	 * @returns The path of the folder.
	 */
	private static _getFakeCommandsFolder(): string {
		if (InstallScriptRunner._fakeCommandsFolder !== undefined) {
			return InstallScriptRunner._fakeCommandsFolder;
		}
		const folder = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'install_script_tests_commands_'));
		for (const [commandName, commandText] of Object.entries(FAKE_COMMANDS)) {
			Fs.writeFileSync(Path.join(folder, commandName), commandText, {
				mode: 0o755,
			});
		}
		process.once('exit', () => {
			Fs.rmSync(folder, {
				recursive: true,
				force: true,
			});
		});
		InstallScriptRunner._fakeCommandsFolder = folder;
		return folder;
	}
}
