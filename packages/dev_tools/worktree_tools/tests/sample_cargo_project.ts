import ChildProcess from 'node:child_process';
import Fs from 'node:fs';
import Path from 'node:path';
import { TargetPaths } from '../src/target_paths.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	SampleCargoProject — writes a small Rust package at the place of the real package, and builds it, for the tests
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The result of one Cargo command that a test runs.
 */
export type CargoResult = {
	/** The exit code of the command, or null when the command did not start. */
	exitCode: number | null;
	/** The text that Cargo printed on the standard error output. */
	stderr: string;
};

/**
 * A Rust package with a library, a program, and one unit test, and no dependency, so Cargo needs no network to build
 * it. A new version number gives every unit a new hash, so an old build becomes obsolete without any change of code.
 */
export class SampleCargoProject {
	/**
	 * Writes the package in the package folder of a checkout, in place of the real package.
	 * @param checkoutPath The absolute path of the root of the checkout.
	 * @param version The version number of the package, for example `0.1.0`.
	 * @returns Nothing.
	 */
	static write(checkoutPath: string, version: string): void {
		const packagePath = TargetPaths.packagePath(checkoutPath);
		Fs.mkdirSync(Path.join(packagePath, 'src'), { recursive: true });
		Fs.writeFileSync(
			Path.join(packagePath, 'Cargo.toml'),
			[
				'[package]',
				'name = "sample_application"',
				`version = "${version}"`,
				'edition = "2021"',
				'',
				'[lib]',
				'name = "sample_application_lib"',
				'path = "src/lib.rs"',
				'',
			].join('\n'),
		);
		Fs.writeFileSync(
			Path.join(packagePath, 'src', 'lib.rs'),
			[
				'pub fn answer() -> u32 {',
				'    42',
				'}',
				'',
				'#[cfg(test)]',
				'mod tests {',
				'    #[test]',
				'    fn answer_is_forty_two() {',
				'        assert_eq!(super::answer(), 42);',
				'    }',
				'}',
				'',
			].join('\n'),
		);
		Fs.writeFileSync(
			Path.join(packagePath, 'src', 'main.rs'),
			'fn main() {\n    println!("{}", sample_application_lib::answer());\n}\n',
		);
	}

	/**
	 * Runs `cargo build`, then `cargo test --no-run`, in the package folder of a checkout, like a developer does.
	 * @param checkoutPath The absolute path of the root of the checkout.
	 * @returns Nothing.
	 * @throws An error when a command fails.
	 */
	static buildAll(checkoutPath: string): void {
		for (const cargoArguments of [['build'], ['test', '--no-run']]) {
			const result = SampleCargoProject.run(checkoutPath, cargoArguments);
			if (result.exitCode !== 0) {
				throw new Error(`cargo ${cargoArguments.join(' ')} failed: ${result.stderr}`);
			}
		}
	}

	/**
	 * Builds the package in version 0.1.0, then writes the version 0.2.0, so the files of the first build are obsolete.
	 * @param checkoutPath The absolute path of the root of the checkout.
	 * @returns The names of the folders of the first build in the folder `.fingerprint`.
	 */
	static buildThenChangeVersion(checkoutPath: string): string[] {
		SampleCargoProject.write(checkoutPath, '0.1.0');
		SampleCargoProject.buildAll(checkoutPath);
		const oldFolderNames = Fs.readdirSync(Path.join(TargetPaths.debugPath(checkoutPath), '.fingerprint'));
		SampleCargoProject.write(checkoutPath, '0.2.0');
		return oldFolderNames;
	}

	/**
	 * Runs one Cargo command in the package folder of a checkout.
	 * @param checkoutPath The absolute path of the root of the checkout.
	 * @param cargoArguments The arguments of `cargo`, for example `['build']`.
	 * @returns The exit code and the standard error output of the command.
	 */
	static run(checkoutPath: string, cargoArguments: string[]): CargoResult {
		const result = ChildProcess.spawnSync('cargo', cargoArguments, {
			cwd: TargetPaths.packagePath(checkoutPath),
			encoding: 'utf8',
			env: {
				...process.env,
				CARGO_TARGET_DIR: undefined,
				CARGO_TERM_COLOR: 'never',
			},
		});
		return {
			exitCode: result.status,
			stderr: result.stderr,
		};
	}
}
