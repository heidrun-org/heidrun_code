import Fs from 'node:fs';
import Path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { BuildScriptOutputs } from '../src/build_script_outputs.ts';
import { TargetPaths } from '../src/target_paths.ts';
import { TestRepository } from './test_repository.ts';

describe('BuildScriptOutputs', () => {
	afterEach(() => {
		TestRepository.removeAll();
	});

	it('replaces the path of the main checkout with the path of the worktree, and keeps the date', () => {
		const mainCheckoutPath = TestRepository.create();
		const worktreePath = TestRepository.addWorktree(mainCheckoutPath, 'feature');
		const outputFolderPath = Path.join(TargetPaths.debugPath(worktreePath), 'build', 'heidrun_code-0123456789abcdef');
		Fs.mkdirSync(outputFolderPath, { recursive: true });
		const outputPath = Path.join(outputFolderPath, BuildScriptOutputs.outputFileName);
		Fs.writeFileSync(outputPath, [
			`cargo:rerun-if-changed=${mainCheckoutPath}/packages/apps/desktop_tauri/tauri.conf.json`,
			'cargo:rerun-if-changed=capabilities',
			'',
		].join('\n'));
		const oldDate = new Date('2026-01-01T00:00:00Z');
		Fs.utimesSync(outputPath, oldDate, oldDate);

		expect(BuildScriptOutputs.rewrite(mainCheckoutPath, worktreePath)).toBe(1);

		expect(Fs.readFileSync(outputPath, 'utf8')).toBe([
			`cargo:rerun-if-changed=${worktreePath}/packages/apps/desktop_tauri/tauri.conf.json`,
			'cargo:rerun-if-changed=capabilities',
			'',
		].join('\n'));
		expect(Fs.statSync(outputPath).mtimeMs).toBe(oldDate.getTime());
	});

	it('replaces the path of the main checkout in a record of the release folder', () => {
		const mainCheckoutPath = TestRepository.create();
		const worktreePath = TestRepository.addWorktree(mainCheckoutPath, 'feature');
		const outputFolderPath = Path.join(TargetPaths.releasePath(worktreePath), 'build', 'ring-0123456789abcdef');
		Fs.mkdirSync(outputFolderPath, { recursive: true });
		const outputPath = Path.join(outputFolderPath, BuildScriptOutputs.outputFileName);
		Fs.writeFileSync(outputPath, `cargo:rustc-link-search=native=${mainCheckoutPath}/packages/apps/desktop_tauri/out\n`);

		expect(BuildScriptOutputs.rewrite(mainCheckoutPath, worktreePath)).toBe(1);

		expect(Fs.readFileSync(outputPath, 'utf8'))
			.toBe(`cargo:rustc-link-search=native=${worktreePath}/packages/apps/desktop_tauri/out\n`);
	});

	it('changes nothing in a record without the path of the main checkout, or without a debug folder', () => {
		const mainCheckoutPath = TestRepository.create();
		const worktreePath = TestRepository.addWorktree(mainCheckoutPath, 'feature');
		expect(BuildScriptOutputs.rewrite(mainCheckoutPath, worktreePath)).toBe(0);
		const outputFolderPath = Path.join(TargetPaths.debugPath(worktreePath), 'build', 'serde-0123456789abcdef');
		Fs.mkdirSync(outputFolderPath, { recursive: true });
		Fs.writeFileSync(Path.join(outputFolderPath, BuildScriptOutputs.outputFileName), 'cargo:rustc-cfg=fast\n');
		expect(BuildScriptOutputs.rewrite(mainCheckoutPath, worktreePath)).toBe(0);
	});
});
