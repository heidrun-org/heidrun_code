import Path from 'node:path';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	TargetPaths — the place of the Cargo target folder inside a checkout of the repository
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Gives the paths of the Cargo target folder of the package `desktop_tauri` inside one checkout: the main checkout or a
 * worktree.
 */
export class TargetPaths {
	/** The path of the Cargo target folder, relative to the root of a checkout. */
	static readonly targetRelativePath = Path.join('packages', 'apps', 'desktop_tauri', 'target');

	/** The name of the folder, inside the Cargo target folder, that holds the debug build. */
	static readonly debugFolderName = 'debug';

	/** The name of the folder, inside the Cargo target folder, that holds release builds. */
	static readonly releaseFolderName = 'release';

	/** The name of the folder, inside the release folder, that holds the bundled command line tools. */
	static readonly bundledCommandsFolderName = 'bundled_commands';

	/** The command line tools that Tauri requires in the bundled command line tools folder. */
	static readonly bundledCommandFileNames = ['heidrun_code_ctrl', 'heidrun_code_data'] as const;

	/**
	 * Gives the path of the folder of the package that owns the Cargo target folder: the folder where `cargo build` runs.
	 * @param checkoutPath The absolute path of the root of the main checkout or of a worktree.
	 * @returns The absolute path of the package folder, the parent of the Cargo target folder.
	 */
	static packagePath(checkoutPath: string): string {
		return Path.dirname(TargetPaths.targetPath(checkoutPath));
	}

	/**
	 * Gives the path of the Cargo target folder of a checkout.
	 * @param checkoutPath The absolute path of the root of the main checkout or of a worktree.
	 * @returns The absolute path of the Cargo target folder.
	 */
	static targetPath(checkoutPath: string): string {
		return Path.join(checkoutPath, TargetPaths.targetRelativePath);
	}

	/**
	 * Gives the path of the debug build folder of a checkout.
	 * @param checkoutPath The absolute path of the root of the main checkout or of a worktree.
	 * @returns The absolute path of the `debug` folder inside the Cargo target folder.
	 */
	static debugPath(checkoutPath: string): string {
		return Path.join(TargetPaths.targetPath(checkoutPath), TargetPaths.debugFolderName);
	}

	/**
	 * Gives the path of the release build folder of a checkout.
	 * @param checkoutPath The absolute path of the root of the main checkout or of a worktree.
	 * @returns The absolute path of the `release` folder inside the Cargo target folder.
	 */
	static releasePath(checkoutPath: string): string {
		return Path.join(TargetPaths.targetPath(checkoutPath), TargetPaths.releaseFolderName);
	}

	/**
	 * Gives the path of the bundled command line tools required by Tauri.
	 * @param checkoutPath The absolute path of the root of the main checkout or of a worktree.
	 * @returns The absolute path of the bundled command line tools folder.
	 */
	static bundledCommandsPath(checkoutPath: string): string {
		return Path.join(TargetPaths.releasePath(checkoutPath), TargetPaths.bundledCommandsFolderName);
	}
}
