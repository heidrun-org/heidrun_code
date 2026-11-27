import Fs from 'node:fs';
import Path from 'node:path';
import { TargetPaths } from './target_paths.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	TauriPermissionPaths — repairs cached Tauri permission paths after a clone
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

const TARGET_MARKER = `${Path.sep}${TargetPaths.targetRelativePath}${Path.sep}`;

/** Relocates Tauri permission lists and their entries inside the new Cargo target folder. */
export class TauriPermissionPaths {
	/**
	 * Repairs existing copied files referenced by Tauri permission lists and Cargo build-script records.
	 * @param worktreePath Absolute path of the new worktree.
	 * @returns Nothing.
	 */
	static repair(worktreePath: string): void {
		const target = Fs.realpathSync(TargetPaths.targetPath(worktreePath));
		for (const profile of TauriPermissionPaths._directories(target)) {
			TauriPermissionPaths._repairBuild(Path.join(profile, 'build'), target);
			for (const nestedProfile of TauriPermissionPaths._directories(profile)) {
				TauriPermissionPaths._repairBuild(Path.join(nestedProfile, 'build'), target);
			}
		}
	}

	/**
	 * Lists direct child directories without following symbolic links.
	 * @param path Directory to list.
	 * @returns Absolute paths of the child directories.
	 */
	private static _directories(path: string): string[] {
		if (Fs.lstatSync(path, {
			throwIfNoEntry: false,
		})?.isDirectory() !== true) {
			return [];
		}
		return Fs.readdirSync(path, {
			withFileTypes: true,
		}).filter((entry) => entry.isDirectory()).map((entry) => Path.join(path, entry.name));
	}

	/**
	 * Repairs records and permission lists in a Cargo profile's build directory.
	 * @param build Directory containing Cargo build units.
	 * @param target Canonical path of the copied Cargo target folder.
	 * @returns Nothing.
	 */
	private static _repairBuild(build: string, target: string): void {
		for (const unit of TauriPermissionPaths._directories(build)) {
			TauriPermissionPaths._repairUnit(unit, target);
			for (const nested of TauriPermissionPaths._directories(unit)) {
				if (Path.basename(nested) !== 'out') {
					TauriPermissionPaths._repairUnit(nested, target);
				}
			}
		}
	}

	/**
	 * Repairs Cargo metadata and generated Tauri lists in one build unit.
	 * @param unit Directory of the build unit.
	 * @param target Canonical path of the copied Cargo target folder.
	 * @returns Nothing.
	 */
	private static _repairUnit(unit: string, target: string): void {
		const record = Path.join(unit, 'output');
		const stat = Fs.lstatSync(record, {
			throwIfNoEntry: false,
		});
		if (stat?.isFile() === true) {
			const original = Fs.readFileSync(record, 'utf8');
			const relocated = original.replace(/^(cargo:{1,2}[^=\r\n]*PERMISSION_FILES_PATH=)([^\r\n]+)/gm,
				(_match, key: string, value: string) => key + TauriPermissionPaths._relocate(value, target));
			if (relocated !== original) {
				Fs.writeFileSync(record, relocated);
				Fs.utimesSync(record, stat.atime, stat.mtime);
			}
		}

		const out = Path.join(unit, 'out');
		if (Fs.lstatSync(out, {
			throwIfNoEntry: false,
		})?.isDirectory() === true) {
			TauriPermissionPaths._repairLists(out, target);
		}
	}

	/**
	 * Repairs Tauri permission lists in a build script's generated output.
	 * @param directory Directory to scan for permission lists.
	 * @param target Canonical path of the copied Cargo target folder.
	 * @returns Nothing.
	 */
	private static _repairLists(directory: string, target: string): void {
		for (const entry of Fs.readdirSync(directory, {
			withFileTypes: true,
		})) {
			const path = Path.join(directory, entry.name);
			if (entry.isDirectory() === true) {
				TauriPermissionPaths._repairLists(path, target);
			} else if (entry.isFile() === true && entry.name.endsWith('-permission-files')) {
				const entries: unknown = JSON.parse(Fs.readFileSync(path, 'utf8'));
				if (Array.isArray(entries) === false || entries.some((value) => typeof value !== 'string')) {
					continue;
				}
				const relocated = entries.map((value: string) => TauriPermissionPaths._relocate(value, target));
				if (relocated.some((value, index) => value !== entries[index])) {
					Fs.writeFileSync(path, JSON.stringify(relocated));
				}
			}
		}
	}

	/**
	 * Maps an absolute path to its copied counterpart when the counterpart exists.
	 * @param path An entry from a list or a build-script record.
	 * @param target Canonical path of the copied Cargo target folder.
	 * @returns The copied path or the original entry.
	 */
	private static _relocate(path: string, target: string): string {
		const normalized = Path.normalize(path);
		const marker = normalized.lastIndexOf(TARGET_MARKER);
		if (Path.isAbsolute(path) === false || marker === -1 || normalized.startsWith(target + Path.sep)) {
			return path;
		}

		const copied = Path.join(target, normalized.slice(marker + TARGET_MARKER.length));
		return Fs.statSync(copied, {
			throwIfNoEntry: false,
		})?.isFile() === true ? copied : path;
	}
}
