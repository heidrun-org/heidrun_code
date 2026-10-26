// The fetch of the remote repository in the background: Heidrun Code runs `git fetch --prune` for the repository of the
// selected workspace each time the delay of the option "Fetch the remote repository in the background" passes, so that
// the two counts of the Git branch section of the status bar stay true. The Git status is read again after each fetch.
// - issue #432
import { watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { git, loadStatus } from "./git";
import { synchronize } from "./git_synchronize";
import { state as session } from "./session";
import { settings } from "./settings";
import { sourceControl } from "./source_control";

/** The number of milliseconds in one minute. */
const MILLISECONDS_PER_MINUTE = 60_000;

/** The time of the last fetch in the background of each repository, by root of the repository, in milliseconds since 1970. */
const lastFetchAt = new Map<string, number>();

/** True while a fetch in the background runs. A second one cannot start during this time. */
let isFetching = false;

/** The timer that starts a fetch each time the delay passes, or null while the option is off. */
let timer: ReturnType<typeof setInterval> | null = null;

/** True after `startGitBackgroundFetch` ran, until `stopGitBackgroundFetch` runs. */
let isStarted = false;

/** The functions that stop the two watchers of `startGitBackgroundFetch`. */
let stopWatchers: (() => void)[] = [];

/**
 * Fetches the remote repository of the selected workspace, then reads its Git status again. It does nothing when the
 * option is off, when the selected workspace has no Git repository, when its branch has no upstream branch, and while a
 * synchronization, a pull, a push, or another fetch runs. A fetch that fails shows nothing: the next delay tries again.
 *
 * @param isDueOnly - true to fetch only when the last fetch of the repository is older than the delay
 * @returns A promise that ends when the fetch and the new reading of the status are over.
 */
export async function fetchInBackground(isDueOnly: boolean): Promise<void> {
  const delay = settings.gitFetchMinutes * MILLISECONDS_PER_MINUTE;
  const workspaceId = session.selectedWorkspaceId;
  const status = workspaceId === null ? null : (git.status[workspaceId] ?? null);
  if (delay === 0 || workspaceId === null || status === null || status.upstream === null) {
    return;
  }
  if (isFetching || synchronize.isBusy || sourceControl.isBusy) {
    return;
  }
  const lastAt = lastFetchAt.get(status.root);
  if (isDueOnly && lastAt !== undefined && Date.now() - lastAt < delay) {
    return;
  }
  isFetching = true;
  lastFetchAt.set(status.root, Date.now());
  try {
    await invoke("git_sync", { root: status.root, action: "fetch" });
    await loadStatus(workspaceId);
  } catch {
    /* a fetch that fails shows nothing: the next delay tries again */
  } finally {
    isFetching = false;
  }
}

/** Starts a new timer for the delay of the option, and stops the old one. A delay of 0 minutes starts no timer. */
function restartTimer(minutes: number): void {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
  if (minutes > 0) {
    timer = setInterval(() => void fetchInBackground(false), minutes * MILLISECONDS_PER_MINUTE);
  }
}

/** The root of the Git repository of the selected workspace, or null while it is not known. */
function selectedRoot(): string | null {
  const workspaceId = session.selectedWorkspaceId;
  return workspaceId === null ? null : (git.status[workspaceId]?.root ?? null);
}

/**
 * Starts the fetch in the background: a timer for the delay of the option, which starts again when the developer changes
 * the option, and a fetch at once when the repository of the selected workspace changes and its last fetch is older than
 * the delay. The repository changes when the developer selects another workspace, and when the first Git status arrives.
 */
export function startGitBackgroundFetch(): void {
  if (isStarted) {
    return;
  }
  isStarted = true;
  stopWatchers = [
    watch(() => settings.gitFetchMinutes, restartTimer, { immediate: true }),
    watch(
      selectedRoot,
      (root) => {
        if (root !== null) {
          void fetchInBackground(true);
        }
      },
      { immediate: true },
    ),
  ];
}

/** Stops the timer and the two watchers, and forgets the time of the last fetch of each repository. */
export function stopGitBackgroundFetch(): void {
  for (const stopWatcher of stopWatchers) {
    stopWatcher();
  }
  stopWatchers = [];
  restartTimer(0);
  lastFetchAt.clear();
  isFetching = false;
  isStarted = false;
}
