import Fs from 'node:fs';
import Path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { BundledCommandsStamp } from '../src/bundled_commands_stamp.ts';
import { TargetPaths } from '../src/target_paths.ts';
import { SampleToolPackages } from './sample_tool_packages.ts';
import { TestRepository } from './test_repository.ts';

describe('BundledCommandsStamp', () => {
	afterEach(() => {
		TestRepository.removeAll();
	});

	describe('findSourceFolders', () => {
		it('finds the two tools and the packages that they depend on, and no other package', () => {
			const checkoutPath = TestRepository.create();
			SampleToolPackages.write(checkoutPath);
			const relativePaths = BundledCommandsStamp.findSourceFolders(checkoutPath).map((folderPath) => {
				return Path.relative(checkoutPath, folderPath);
			});
			expect(relativePaths).toEqual([
				Path.join('packages', 'auxiliary', 'heidrun_code_ctrl'),
				Path.join('packages', 'data_layers', 'data_layer_operation_log'),
				Path.join('packages', 'data_layers', 'heidrun_code_data'),
			]);
		});
	});

	describe('computeFingerprint', () => {
		it('gives the same fingerprint for the same sources in two checkouts at different paths', () => {
			const firstCheckoutPath = TestRepository.create();
			const secondCheckoutPath = TestRepository.create();
			SampleToolPackages.write(firstCheckoutPath);
			SampleToolPackages.write(secondCheckoutPath);
			expect(BundledCommandsStamp.computeFingerprint(firstCheckoutPath))
				.toBe(BundledCommandsStamp.computeFingerprint(secondCheckoutPath));
		});

		it('changes when a file of a package that a tool depends on changes', () => {
			const checkoutPath = TestRepository.create();
			SampleToolPackages.write(checkoutPath);
			const fingerprintBefore = BundledCommandsStamp.computeFingerprint(checkoutPath);
			Fs.appendFileSync(Path.join(checkoutPath, SampleToolPackages.dependencyRelativePath, 'src', 'lib.rs'), '// x\n');
			expect(BundledCommandsStamp.computeFingerprint(checkoutPath)).not.toBe(fingerprintBefore);
		});

		it('changes when a file is added to a tool', () => {
			const checkoutPath = TestRepository.create();
			SampleToolPackages.write(checkoutPath);
			const fingerprintBefore = BundledCommandsStamp.computeFingerprint(checkoutPath);
			Fs.writeFileSync(
				Path.join(checkoutPath, 'packages', 'auxiliary', 'heidrun_code_ctrl', 'src', 'new_module.rs'),
				'pub fn new_function() {}\n',
			);
			expect(BundledCommandsStamp.computeFingerprint(checkoutPath)).not.toBe(fingerprintBefore);
		});

		it('does not change when a package that no tool depends on changes, or when a build writes files', () => {
			const checkoutPath = TestRepository.create();
			SampleToolPackages.write(checkoutPath);
			const fingerprintBefore = BundledCommandsStamp.computeFingerprint(checkoutPath);
			Fs.appendFileSync(Path.join(checkoutPath, SampleToolPackages.unrelatedRelativePath, 'src', 'lib.rs'), '// x\n');
			const outputPath = Path.join(checkoutPath, 'packages', 'auxiliary', 'heidrun_code_ctrl', 'target', 'debug');
			Fs.mkdirSync(outputPath, { recursive: true });
			Fs.writeFileSync(Path.join(outputPath, 'output'), 'compiled');
			expect(BundledCommandsStamp.computeFingerprint(checkoutPath)).toBe(fingerprintBefore);
		});

		it('changes when the shared lock file at the root changes', () => {
			const checkoutPath = TestRepository.create();
			SampleToolPackages.write(checkoutPath);
			Fs.writeFileSync(Path.join(checkoutPath, 'Cargo.lock'), 'version = 4\n');
			const fingerprintBefore = BundledCommandsStamp.computeFingerprint(checkoutPath);
			Fs.appendFileSync(Path.join(checkoutPath, 'Cargo.lock'), '# another version\n');
			expect(BundledCommandsStamp.computeFingerprint(checkoutPath)).not.toBe(fingerprintBefore);
		});

		it('throws when the file Cargo.toml of a tool is not valid', () => {
			const checkoutPath = TestRepository.create();
			SampleToolPackages.write(checkoutPath);
			Fs.writeFileSync(Path.join(checkoutPath, 'packages', 'auxiliary', 'heidrun_code_ctrl', 'Cargo.toml'), 'not toml [');
			expect(() => {
				BundledCommandsStamp.computeFingerprint(checkoutPath);
			}).toThrow(/cargo metadata .* failed/);
		});
	});

	describe('isUpToDate and write', () => {
		it('is up to date only when both tools and a stamp with the same fingerprint exist', () => {
			const checkoutPath = TestRepository.create();
			const commandsPath = TargetPaths.bundledCommandsPath(checkoutPath);
			expect(BundledCommandsStamp.isUpToDate(checkoutPath, 'fingerprint')).toBe(false);

			Fs.mkdirSync(commandsPath, { recursive: true });
			for (const commandFileName of TargetPaths.bundledCommandFileNames) {
				Fs.writeFileSync(Path.join(commandsPath, commandFileName), 'tool');
			}
			expect(BundledCommandsStamp.isUpToDate(checkoutPath, 'fingerprint')).toBe(false);

			BundledCommandsStamp.write(checkoutPath, 'fingerprint');
			expect(Fs.readFileSync(Path.join(commandsPath, BundledCommandsStamp.stampFileName), 'utf8'))
				.toBe('fingerprint\n');
			expect(BundledCommandsStamp.isUpToDate(checkoutPath, 'fingerprint')).toBe(true);
			expect(BundledCommandsStamp.isUpToDate(checkoutPath, 'other fingerprint')).toBe(false);

			Fs.rmSync(Path.join(commandsPath, 'heidrun_code_data'));
			expect(BundledCommandsStamp.isUpToDate(checkoutPath, 'fingerprint')).toBe(false);
		});
	});
});
