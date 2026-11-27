import Fs from 'node:fs';
import Os from 'node:os';
import Path from 'node:path';
import { expect, it } from 'vitest';
import { TargetPaths } from '../src/target_paths.ts';
import { TauriPermissionPaths } from '../src/tauri_permission_paths.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	TauriPermissionPaths — tests repair of copied Cargo build output
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

it.each(['debug/build/tauri-unit', 'aarch64-apple-darwin/debug/build/tauri/unit'])(
	'repairs copied Tauri permission paths in %s',
	(unit) => {
		const root = Fs.realpathSync(Fs.mkdtempSync(Path.join(Os.tmpdir(), 'tauri-permissions-')));
		try {
			const source = TargetPaths.targetPath(Path.join(root, 'source'));
			const former = TargetPaths.targetPath(Path.join(root, 'former'));
			const worktree = Path.join(root, 'worktree');
			const target = TargetPaths.targetPath(worktree);
			const permission = Path.join(unit, 'out', 'permissions', 'allow.toml');
			const list = Path.join(unit, 'out', 'tauri-core-permission-files');
			const validList = Path.join(unit, 'out', 'tauri-plugin-permission-files');
			const record = Path.join(unit, 'output');
			const external = Path.join(root, 'external.toml');
			const originalList = JSON.stringify([Path.join(former, permission), external]);
			const validContents = JSON.stringify([external], null, 2);
			const originalRecord = `cargo:core:app__CORE_PLUGIN___PERMISSION_FILES_PATH=${Path.join(former, list)}\n`;
			Fs.mkdirSync(Path.dirname(Path.join(source, permission)), {
				recursive: true,
			});
			Fs.writeFileSync(external, 'permission');
			Fs.writeFileSync(Path.join(source, permission), 'permission');
			Fs.writeFileSync(Path.join(source, list), originalList);
			Fs.writeFileSync(Path.join(source, validList), validContents);
			Fs.writeFileSync(Path.join(source, record), originalRecord);
			Fs.cpSync(source, target, {
				recursive: true,
			});

			expect(Fs.existsSync(former)).toBe(false);
			TauriPermissionPaths.repair(worktree);
			TauriPermissionPaths.repair(worktree);

			expect(Fs.readFileSync(Path.join(target, list), 'utf8')).toBe(
				JSON.stringify([Path.join(target, permission), external]),
			);
			expect(Fs.readFileSync(Path.join(target, validList), 'utf8')).toBe(validContents);
			expect(Fs.readFileSync(Path.join(target, record), 'utf8')).toBe(
				`cargo:core:app__CORE_PLUGIN___PERMISSION_FILES_PATH=${Path.join(target, list)}\n`,
			);
			expect(Fs.readFileSync(Path.join(source, list), 'utf8')).toBe(originalList);
			expect(Fs.readFileSync(Path.join(source, record), 'utf8')).toBe(originalRecord);
		} finally {
			Fs.rmSync(root, {
				recursive: true,
				force: true,
			});
		}
	},
);
