///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Types
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The result of `WorktreeCreate.run`.
 */
export type WorktreeCreateResult = {
	/** The absolute path of the new worktree. */
	worktreePath: string;
	/** The name of the new branch that the worktree has checked out. */
	branchName: string;
	/** True when the debug build and bundled command line tools were cloned into the new worktree. */
	isTargetCloned: boolean;
	/** The reason why the clone did not happen, or null when the clone happened. */
	skipReason: string | null;
	/** The number of files and folders that got the dates of the main checkout. Zero without the clone. */
	sourceDates: SourceDatesResult;
	/** The number of cloned build script records whose paths were moved to the worktree. Zero without the clone. */
	rewrittenBuildScriptOutputCount: number;
};

/**
 * The result of `SourceDates.copyFromMainCheckout`.
 */
export type SourceDatesResult = {
	/** The number of files whose dates were copied. */
	fileCount: number;
	/** The number of folders whose dates were copied. */
	folderCount: number;
};

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
