import ChildProcess from 'node:child_process';
import Fs from 'node:fs';
import Os from 'node:os';
import Path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const __filename = import.meta.filename;
const __dirname = import.meta.dirname;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Helpers
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Runs a copy of `scripts/build_command_line_tools.sh` in a temporary repository, with a fake `cargo` that writes the
 * value of `MACOSX_DEPLOYMENT_TARGET` that it receives. The built tools are files with the name of the tool as content.
 */
class ToolsScriptRunner {
	/** The temporary folders that the tests created. */
	static createdPaths: string[] = [];

	/** The script of the repository. */
	static readonly scriptPath = Path.join(__dirname, '..', '..', '..', '..', 'scripts', 'build_command_line_tools.sh');

	/** The old date of the bundled tools that a test writes before the script runs. */
	static readonly oldDate = new Date('2026-01-01T00:00:00Z');

	/**
	 * Creates the temporary repository.
	 * @returns The absolute path of the root of the temporary repository.
	 */
	static create(): string {
		const rootPath = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'tools_script_test_'));
		ToolsScriptRunner.createdPaths.push(rootPath);
		Fs.mkdirSync(Path.join(rootPath, 'scripts'));
		Fs.copyFileSync(ToolsScriptRunner.scriptPath, Path.join(rootPath, 'scripts', 'build_command_line_tools.sh'));
		Fs.mkdirSync(Path.join(rootPath, 'packages', 'auxiliary', 'heidrun_code_ctrl'), { recursive: true });
		Fs.mkdirSync(Path.join(rootPath, 'packages', 'data_layers', 'heidrun_code_data'), { recursive: true });
		const releasePath = Path.join(rootPath, 'packages', 'apps', 'desktop_tauri', 'target', 'release');
		Fs.mkdirSync(releasePath, { recursive: true });
		Fs.writeFileSync(Path.join(releasePath, 'heidrun_code_ctrl'), 'heidrun_code_ctrl');
		Fs.writeFileSync(Path.join(releasePath, 'heidrun_code_data'), 'heidrun_code_data');
		Fs.writeFileSync(
			Path.join(rootPath, 'packages', 'apps', 'desktop_tauri', 'tauri.conf.json'),
			JSON.stringify(
				{
					bundle: {
						macOS: {
							minimumSystemVersion: '11.0',
						},
					},
				},
				null,
				2,
			),
		);
		return rootPath;
	}

	/**
	 * Gives the folder of the bundled tools of the temporary repository.
	 * @param rootPath The absolute path of the root of the temporary repository.
	 * @returns The absolute path of the folder `bundled_commands`.
	 */
	static bundledCommandsPath(rootPath: string): string {
		return Path.join(rootPath, 'packages', 'apps', 'desktop_tauri', 'target', 'release', 'bundled_commands');
	}

	/**
	 * Writes a bundled tool with the old date, as an earlier run of the script left it.
	 * @param rootPath The absolute path of the root of the temporary repository.
	 * @param toolName The name of the tool.
	 * @param content The content of the bundled tool.
	 * @returns The absolute path of the bundled tool.
	 */
	static writeBundledTool(rootPath: string, toolName: string, content: string): string {
		const toolPath = Path.join(ToolsScriptRunner.bundledCommandsPath(rootPath), toolName);
		Fs.mkdirSync(Path.dirname(toolPath), { recursive: true });
		Fs.writeFileSync(toolPath, content);
		Fs.utimesSync(toolPath, ToolsScriptRunner.oldDate, ToolsScriptRunner.oldDate);
		return toolPath;
	}

	/**
	 * Runs the script in a temporary repository.
	 * @param rootPath The absolute path of the root of the temporary repository.
	 * @param environment The variables to add to the environment of the script.
	 * @returns The values of `MACOSX_DEPLOYMENT_TARGET` that the fake `cargo` received, one for each call.
	 */
	static run(rootPath: string, environment: Record<string, string>): string[] {
		const fakeBinPath = Path.join(rootPath, 'fake_bin');
		const recordPath = Path.join(rootPath, 'deployment_targets.txt');
		Fs.mkdirSync(fakeBinPath);
		Fs.writeFileSync(
			Path.join(fakeBinPath, 'cargo'),
			`#!/bin/sh\necho "\${MACOSX_DEPLOYMENT_TARGET:-none}" >> "${recordPath}"\n`,
			{
				mode: 0o755,
			},
		);
		const environmentWithoutTarget = {
			...process.env,
		};
		delete environmentWithoutTarget.MACOSX_DEPLOYMENT_TARGET;
		const result = ChildProcess.spawnSync('sh', [Path.join(rootPath, 'scripts', 'build_command_line_tools.sh')], {
			encoding: 'utf8',
			env: {
				...environmentWithoutTarget,
				...environment,
				PATH: `${fakeBinPath}${Path.delimiter}${process.env.PATH ?? ''}`,
			},
		});
		expect(result.status, result.stderr).toBe(0);
		return Fs.readFileSync(recordPath, 'utf8').trim().split('\n');
	}
}

describe('scripts/build_command_line_tools.sh', () => {
	afterEach(() => {
		for (const createdPath of ToolsScriptRunner.createdPaths.splice(0)) {
			Fs.rmSync(createdPath, { recursive: true, force: true });
		}
	});

	it('builds with MACOSX_DEPLOYMENT_TARGET set to minimumSystemVersion of tauri.conf.json', () => {
		expect(ToolsScriptRunner.run(ToolsScriptRunner.create(), {})).toEqual(['11.0', '11.0']);
	});

	it('keeps a MACOSX_DEPLOYMENT_TARGET that the caller already set', () => {
		const deploymentTargets = ToolsScriptRunner.run(ToolsScriptRunner.create(), {
			MACOSX_DEPLOYMENT_TARGET: '12.0',
		});
		expect(deploymentTargets).toEqual(['12.0', '12.0']);
	});

	it('copies the built tools when they are missing', () => {
		const rootPath = ToolsScriptRunner.create();
		ToolsScriptRunner.run(rootPath, {});
		const ctrlPath = Path.join(ToolsScriptRunner.bundledCommandsPath(rootPath), 'heidrun_code_ctrl');
		expect(Fs.readFileSync(ctrlPath, 'utf8')).toBe('heidrun_code_ctrl');
	});

	it('keeps the date of a bundled tool that did not change, and copies a tool that changed', () => {
		const rootPath = ToolsScriptRunner.create();
		const sameToolPath = ToolsScriptRunner.writeBundledTool(rootPath, 'heidrun_code_ctrl', 'heidrun_code_ctrl');
		const changedToolPath = ToolsScriptRunner.writeBundledTool(rootPath, 'heidrun_code_data', 'older build');
		ToolsScriptRunner.run(rootPath, {});
		expect(Fs.statSync(sameToolPath).mtimeMs).toBe(ToolsScriptRunner.oldDate.getTime());
		expect(Fs.readFileSync(changedToolPath, 'utf8')).toBe('heidrun_code_data');
		expect(Fs.statSync(changedToolPath).mtimeMs).not.toBe(ToolsScriptRunner.oldDate.getTime());
	});
});
