// The Source control sidebar section: the files of the two groups "Staged Changes" and "Changes", and the Git
// actions on them (stage, unstage, discard, commit, stash, pull, push, fetch). Each action reads the Git status again.
// - issue #305
import { reactive } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { git, loadStatus, refreshGit, type GitStatus } from "./git";
import { askConfirm } from "./confirm";
import { state as session, toast } from "./session";
import { t } from "../i18n/index";

/** The two groups of files of the Source control sidebar section. */
export type SourceControlGroup = "staged" | "changes";

/** One file line of the Source control sidebar section. */
export interface SourceControlFile {
  /** The path of the file, from the root of the repository. */
  path: string;
  /** The name of the file, without its folders. */
  name: string;
  /** The folders of the file, or an empty text for a file at the root of the repository. */
  folder: string;
  /**
   * The status letter that VS Code shows: "M" modified, "A" added, "D" deleted, "R" renamed, "C" copied, "T" type
   * changed, "U" untracked, "!" in conflict.
   */
  letter: string;
}

/** What the commit button does: commit, commit then push, or replace the last commit. */
export type CommitMode = "commit" | "commitAndPush" | "amend";

/** The confirmation to show for each successful commit action. */
const COMMIT_RESULT_KEYS: Record<CommitMode, string> = {
	commit: 'sourceControlPanel.committed',
	commitAndPush: 'sourceControlPanel.committedAndPushed',
	amend: 'sourceControlPanel.commitAmended',
};

/** A Git action that talks to the remote repository. */
export type SyncAction = "pull" | "push" | "fetch";

/** What the Tauri command `coding_agent_ask` gives. */
interface CodingAgentAnswer {
  agent: string;
  text: string;
}

/** The state of the Source control sidebar section. */
export const sourceControl = reactive({
  /** The commit message being written, by workspace id. */
  messages: {} as Record<string, string>,
  /** True while a Git action runs. The buttons wait for it. */
  isBusy: false,
  /** The workspace and current step of a commit, or null when no commit is running. */
  commitProgress: null as { workspaceId: string; step: 'committing' | 'pushingCommit' } | null,
  /** True while a coding agent writes the commit message. */
  isWritingMessage: false,
  /** The groups that are folded. */
  folded: { staged: false, changes: false } as Record<SourceControlGroup, boolean>,
});

/** The status letters of the index and of the working folder that mean a conflict. */
const CONFLICT_PAIRS = new Set(["DD", "AU", "UD", "UA", "DU", "AA", "UU"]);

/**
 * Splits the files of the Git status into the two groups. The status is the pair "XY" of `git status --porcelain=v2`:
 * X is the index ("Staged Changes"), Y is the working folder ("Changes"), and "." means no change. A file can be in the
 * two groups. A new file that Git does not know ("??") and a file in conflict are in "Changes".
 */
export function splitFiles(status: GitStatus | null): Record<SourceControlGroup, SourceControlFile[]> {
  const groups: Record<SourceControlGroup, SourceControlFile[]> = { staged: [], changes: [] };
  if (status === null) {
    return groups;
  }
  for (const file of status.files) {
    if (file.status === "??") {
      groups.changes.push(makeFile(file.path, "U"));
      continue;
    }
    if (CONFLICT_PAIRS.has(file.status)) {
      groups.changes.push(makeFile(file.path, "!"));
      continue;
    }
    const indexLetter = file.status[0] ?? ".";
    const workingFolderLetter = file.status[1] ?? ".";
    if (indexLetter !== ".") {
      groups.staged.push(makeFile(file.path, indexLetter));
    }
    if (workingFolderLetter !== ".") {
      groups.changes.push(makeFile(file.path, workingFolderLetter));
    }
  }
  return groups;
}

/** Stages the files `paths`. */
export async function stageFiles(paths: string[]): Promise<void> {
	await runOnRoot((root) => invoke('git_stage', {
		root,
		paths,
	}));
}

/** Unstages the files `paths`. */
export async function unstageFiles(paths: string[]): Promise<void> {
	await runOnRoot((root) => invoke('git_unstage', {
		root,
		paths,
	}));
}

/** Discards the changes of the files `paths`, after the user confirms it. The changes cannot come back. */
export async function discardFiles(paths: string[]): Promise<void> {
  if (paths.length === 0) {
    return;
  }
  const title =
    paths.length === 1
      ? t("sourceControlPanel.discardOneQuestion", { path: paths[0] })
      : t("sourceControlPanel.discardManyQuestion", { count: paths.length });
  const isConfirmed = await askConfirm(title, t("sourceControlPanel.discardConfirm"));
  if (isConfirmed === false) {
    return;
  }
	await runOnRoot((root) => invoke('git_discard', {
		root,
		paths,
	}));
}

/** Puts the changes aside with `git stash`: the staged files only when `isStagedOnly`. */
export async function stashChanges(isStagedOnly: boolean): Promise<void> {
	const isDone = await runOnRoot((root) => invoke('git_stash', {
		root,
		stagedOnly: isStagedOnly,
	}));
	if (isDone) {
		toast(t('sourceControlPanel.stashed'));
	}
}

/** Runs `git pull`, `git push`, or `git fetch`. */
export async function syncRepository(action: SyncAction): Promise<void> {
	const isDone = await runOnRoot((root) => invoke('git_sync', {
		root,
		action,
	}));
	if (isDone) {
		toast(t(`sourceControlPanel.synced.${action}`));
	}
}

/**
 * Makes a commit with the message of the selected workspace. When no file is staged, it stages every change first,
 * with no question. The message box is emptied after the commit.
 * @param mode - whether to commit, amend, or commit and push
 * @returns a promise that ends after the local status refresh
 */
export async function commit(mode: CommitMode): Promise<void> {
	const workspaceId = session.selectedWorkspaceId;
	if (workspaceId === null || sourceControl.isBusy === true || sourceControl.isWritingMessage === true) {
		return;
	}
	const status = git.status[workspaceId] ?? null;
	const draft = sourceControl.messages[workspaceId] ?? '';
	const message = draft.trim();
	if (status === null) {
		return;
	}
	if (message === '') {
		toast(t('sourceControlPanel.emptyMessage'));
		return;
	}
	const groups = splitFiles(status);
	const isAutoStaging = mode !== 'amend' && groups.staged.length === 0;
	if (isAutoStaging && groups.changes.length === 0) {
		toast(t('sourceControlPanel.nothingToCommit'));
		return;
	}

	sourceControl.commitProgress = {
		workspaceId,
		step: 'committing',
	};
	try {
		const isDone = await runOnRoot(async (root) => {
			if (isAutoStaging) {
				await invoke('git_stage', {
					root,
					paths: groups.changes.map((file) => file.path),
				});
			}
			await invoke('git_commit', {
				root,
				message,
				amend: mode === 'amend',
			});
			if (sourceControl.messages[workspaceId] === draft) {
				sourceControl.messages[workspaceId] = '';
			}
			if (mode === 'commitAndPush') {
				sourceControl.commitProgress = {
					workspaceId,
					step: 'pushingCommit',
				};
				await loadStatus(workspaceId);
				try {
					await invoke('git_sync', {
						root,
						action: 'push',
					});
				} catch (error) {
					throw t('sourceControlPanel.pushAfterCommitFailed', {
						error: String(error),
					});
				}
			}
		}, loadStatus);
		if (isDone) {
			toast(t(COMMIT_RESULT_KEYS[mode]));
		}
	} finally {
		sourceControl.commitProgress = null;
	}
}

/** Asks a coding agent to write the commit message from the diff, and puts the message in the message box. */
export async function writeCommitMessage(): Promise<void> {
  const workspaceId = session.selectedWorkspaceId;
  if (workspaceId === null || sourceControl.isWritingMessage || sourceControl.isBusy) {
    return;
  }
  const root = git.status[workspaceId]?.root;
  if (root === undefined) {
    return;
  }
  sourceControl.isWritingMessage = true;
  try {
    const diff = await invoke<string>("git_commit_diff", { root });
    if (diff.trim() === "") {
      toast(t("sourceControlPanel.nothingToCommit"));
      return;
    }
    const answer = await invoke<CodingAgentAnswer>("coding_agent_ask", { prompt: t("sourceControlPanel.messagePrompt", { diff }) });
    sourceControl.messages[workspaceId] = answer.text.trim();
  } catch (error) {
    const text = String(error);
    toast(text === "no_coding_agent" ? t("sourceControlPanel.noCodingAgent") : text);
  } finally {
    sourceControl.isWritingMessage = false;
  }
}

/** Makes one file line from a path and its status letter. */
function makeFile(path: string, letter: string): SourceControlFile {
  const slash = path.lastIndexOf("/");
  return {
    path,
    name: slash === -1 ? path : path.slice(slash + 1),
    folder: slash === -1 ? "" : path.slice(0, slash),
    letter,
  };
}

/**
 * Runs a Git action on the selected repository and refreshes the originating workspace even when the action fails.
 * @param actionFn - the Git action to run with the captured repository root
 * @param refreshFn - the status refresh to run for the originating workspace
 * @returns whether the Git action completed
 */
async function runOnRoot(
	actionFn: (root: string) => Promise<unknown>,
	refreshFn: (workspaceId: string) => Promise<void> = refreshGit,
): Promise<boolean> {
	const workspaceId = session.selectedWorkspaceId;
	if (workspaceId === null || sourceControl.isBusy === true) {
		return false;
	}
	const root = git.status[workspaceId]?.root;
	if (root === undefined) {
		return false;
	}
	sourceControl.isBusy = true;
	try {
		await actionFn(root);
		return true;
	} catch (error) {
		toast(String(error).split('\n').slice(0, 4).join('\n'), 'error');
		return false;
	} finally {
		try {
			await refreshFn(workspaceId);
		} finally {
			sourceControl.isBusy = false;
		}
	}
}
