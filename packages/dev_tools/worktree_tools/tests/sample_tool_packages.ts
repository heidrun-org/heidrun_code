import Fs from 'node:fs';
import Path from 'node:path';
import { TargetPaths } from '../src/target_paths.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	SampleToolPackages — writes small Rust packages at the places of the bundled command line tools, for the tests
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Writes the packages `heidrun_code_ctrl` and `heidrun_code_data` at their real places in a checkout, a package
 * `data_layer_operation_log` that `heidrun_code_data` depends on through a `path`, and a package `desktop_tauri`
 * that the tools do not depend on. The packages have no dependency from the network, so `cargo metadata` needs no
 * network. The tests never compile them.
 */
export class SampleToolPackages {
	/** The folder of the package that `heidrun_code_data` depends on, relative to the root of a checkout. */
	static readonly dependencyRelativePath = Path.join('packages', 'data_layers', 'data_layer_operation_log');

	/** The folder of the package that the tools do not depend on, relative to the root of a checkout. */
	static readonly unrelatedRelativePath = Path.join('packages', 'apps', 'desktop_tauri');

	/**
	 * Writes the four packages in a checkout.
	 * @param checkoutPath The absolute path of the root of the checkout.
	 * @returns Nothing.
	 */
	static write(checkoutPath: string): void {
		SampleToolPackages._writePackage(checkoutPath, Path.join('packages', 'auxiliary', 'heidrun_code_ctrl'), '');
		SampleToolPackages._writePackage(
			checkoutPath,
			Path.join('packages', 'data_layers', 'heidrun_code_data'),
			'data_layer_operation_log = { path = "../data_layer_operation_log" }\n',
		);
		SampleToolPackages._writePackage(checkoutPath, SampleToolPackages.dependencyRelativePath, '');
		SampleToolPackages._writePackage(checkoutPath, SampleToolPackages.unrelatedRelativePath, '');
	}

	/**
	 * Writes a fake `scripts/build_command_line_tools.sh`. It writes the two tools in the folder of the bundled command
	 * line tools, and adds one line to the file `build_runs.log` at the root of the checkout at each run.
	 * @param checkoutPath The absolute path of the root of the checkout.
	 * @param isFailing True to write a script that fails with the exit code 3 and writes no tool.
	 * @returns Nothing.
	 */
	static writeBuildScript(checkoutPath: string, isFailing: boolean): void {
		const commandsRelativePath = Path.relative(checkoutPath, TargetPaths.bundledCommandsPath(checkoutPath));
		const scriptLines = isFailing === true
			? [
				'echo run >> build_runs.log',
				'exit 3',
			]
			: [
				'echo run >> build_runs.log',
				`mkdir -p ${commandsRelativePath}`,
				`echo tool > ${Path.join(commandsRelativePath, 'heidrun_code_ctrl')}`,
				`echo tool > ${Path.join(commandsRelativePath, 'heidrun_code_data')}`,
			];
		Fs.mkdirSync(Path.join(checkoutPath, 'scripts'), { recursive: true });
		Fs.writeFileSync(
			Path.join(checkoutPath, 'scripts', 'build_command_line_tools.sh'),
			`#!/bin/sh\n${scriptLines.join('\n')}\n`,
		);
	}

	/**
	 * Counts the runs of the fake build script.
	 * @param checkoutPath The absolute path of the root of the checkout.
	 * @returns The number of runs.
	 */
	static countBuildRuns(checkoutPath: string): number {
		const logPath = Path.join(checkoutPath, 'build_runs.log');
		if (Fs.existsSync(logPath) === false) {
			return 0;
		}
		return Fs.readFileSync(logPath, 'utf8').trim().split('\n').length;
	}

	/**
	 * Writes one package with a library.
	 * @param checkoutPath The absolute path of the root of the checkout.
	 * @param relativePath The folder of the package, relative to the root of the checkout.
	 * @param dependenciesText The lines of the section `[dependencies]`.
	 * @returns Nothing.
	 */
	private static _writePackage(checkoutPath: string, relativePath: string, dependenciesText: string): void {
		const packagePath = Path.join(checkoutPath, relativePath);
		Fs.mkdirSync(Path.join(packagePath, 'src'), { recursive: true });
		Fs.writeFileSync(
			Path.join(packagePath, 'Cargo.toml'),
			[
				'[package]',
				`name = "${Path.basename(relativePath)}"`,
				'version = "0.1.0"',
				'edition = "2021"',
				'',
				'[dependencies]',
				dependenciesText,
			].join('\n'),
		);
		Fs.writeFileSync(Path.join(packagePath, 'src', 'lib.rs'), 'pub fn answer() -> u32 {\n    42\n}\n');
	}
}
