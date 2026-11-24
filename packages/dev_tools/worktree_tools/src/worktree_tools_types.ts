///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Types
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * One file or one folder of the debug folder that the current builds do not use any more.
 */
export type ObsoleteTargetEntry = {
	/** The absolute path of the file or of the folder. */
	path: string;
	/** The name of the folder of the debug folder that holds the entry, for example `deps`. */
	folderName: string;
	/** The number of files in the entry. A file counts as one. */
	fileCount: number;
};

/**
 * What `TargetPrune.plan` found in the debug folder of one Cargo target folder.
 */
export type TargetPrunePlan = {
	/** The entries that the current builds do not use any more. */
	obsoleteEntries: ObsoleteTargetEntry[];
	/** The number of files in all the obsolete entries. */
	obsoleteFileCount: number;
	/** The number of files that the plan keeps. */
	keptFileCount: number;
};

/**
 * The Cargo target folder of one worktree that no build has used for some days.
 */
export type StaleTargetFolder = {
	/** The absolute path of the worktree that owns the target folder. */
	worktreePath: string;
	/** The absolute path of the Cargo target folder. */
	targetPath: string;
	/** The most recent modification time of any file or folder inside the target folder. */
	lastUsed: Date;
	/** The number of whole days between `lastUsed` and now. */
	ageInDays: number;
};
