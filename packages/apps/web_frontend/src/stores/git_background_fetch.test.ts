import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import type { GitStatus } from "./git";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("./git", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./git")>()),
  loadStatus: vi.fn(async () => {}),
}));

/** One minute, in milliseconds. */
const MINUTE = 60_000;

/** The arguments of each call of the Tauri command `git_sync`, in order. */
let fetches: { root: string; action: string }[] = [];

/** True when the next call of `git_sync` fails. */
let isFailing = false;

/** A Git status of the test, for the repository whose root is `root`. */
function statusOf(root: string, upstream: string | null = "origin/main"): GitStatus {
  return {
    root,
    branch: "main",
    upstream,
    ahead: 0,
    behind: 0,
    changed: 0,
    untracked: 0,
    files: [],
    last_sha: null,
    last_subject: null,
    last_time: null,
    remote: null,
  };
}

/** Stops the fetch in the background of the stores that the test loaded last, so that its watchers do not leak. */
let stopLastRun: () => void = () => {};

/**
 * The stores, as a new run of Heidrun Code sees them: the modules are loaded again, and nothing is started yet. The mocked
 * module `./git` is not loaded again, so its Git status of the earlier tests is emptied here.
 */
async function loadStores() {
  vi.resetModules();
  const { settings } = await import("./settings");
  const { git, loadStatus } = await import("./git");
  git.status = {};
  const { state } = await import("./session");
  const { synchronize } = await import("./git_synchronize");
  const { sourceControl } = await import("./source_control");
  const store = await import("./git_background_fetch");
  stopLastRun = store.stopGitBackgroundFetch;
  return { settings, git, loadStatus, state, synchronize, sourceControl, ...store };
}

/**
 * Starts the fetch in the background with the workspace "w1" selected, and forgets the first fetch, which Heidrun Code makes
 * at once when the Git status of the selected workspace arrives.
 */
async function startWith(minutes: number, upstream: string | null = "origin/main") {
  const stores = await loadStores();
  stores.settings.gitFetchMinutes = minutes;
  stores.state.selectedWorkspaceId = "w1";
  stores.git.status.w1 = statusOf("/work/a", upstream);
  stores.startGitBackgroundFetch();
  await vi.advanceTimersByTimeAsync(0);
  fetches = [];
  vi.mocked(stores.loadStatus).mockClear();
  return stores;
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  fetches = [];
  isFailing = false;
  vi.mocked(invoke).mockReset();
  vi.mocked(invoke).mockImplementation(async (command, args) => {
    if (command === "git_sync") {
      fetches.push(args as { root: string; action: string });
      if (isFailing) {
        throw new Error("could not resolve host");
      }
    }
    return null;
  });
});

afterEach(() => {
  stopLastRun();
  stopLastRun = () => {};
  vi.useRealTimers();
});

describe("the fetch in the background", () => {
  it("fetches the repository of the selected workspace each time the delay passes", async () => {
    await startWith(5);
    await vi.advanceTimersByTimeAsync(5 * MINUTE - 1);
    expect(fetches).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetches).toEqual([{ root: "/work/a", action: "fetch" }]);
    await vi.advanceTimersByTimeAsync(5 * MINUTE);
    expect(fetches).toHaveLength(2);
  });

  it("fetches at once when the first Git status of the selected workspace arrives", async () => {
    const stores = await loadStores();
    stores.state.selectedWorkspaceId = "w1";
    stores.startGitBackgroundFetch();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetches).toEqual([]);
    stores.git.status.w1 = statusOf("/work/a");
    await vi.advanceTimersByTimeAsync(0);
    expect(fetches).toEqual([{ root: "/work/a", action: "fetch" }]);
  });

  it("reads the Git status of the workspace again after each fetch", async () => {
    const { loadStatus } = await startWith(5);
    await vi.advanceTimersByTimeAsync(5 * MINUTE);
    expect(loadStatus).toHaveBeenCalledTimes(1);
    expect(loadStatus).toHaveBeenCalledWith("w1");
  });

  it("never fetches while the option is Off, and starts again when the option is switched on", async () => {
    const { settings } = await startWith(0);
    await vi.advanceTimersByTimeAsync(60 * MINUTE);
    expect(fetches).toEqual([]);
    settings.gitFetchMinutes = 10;
    await vi.advanceTimersByTimeAsync(10 * MINUTE);
    expect(fetches).toHaveLength(1);
  });

  it("stops fetching when the developer switches the option to Off", async () => {
    const { settings } = await startWith(5);
    settings.gitFetchMinutes = 0;
    await vi.advanceTimersByTimeAsync(60 * MINUTE);
    expect(fetches).toEqual([]);
  });

  it("starts the new delay at once when the developer changes the option, and drops the old delay", async () => {
    const { settings } = await startWith(30);
    await vi.advanceTimersByTimeAsync(10 * MINUTE);
    settings.gitFetchMinutes = 1;
    await vi.advanceTimersByTimeAsync(MINUTE - 1);
    expect(fetches).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetches).toHaveLength(1);
    settings.gitFetchMinutes = 30;
    await vi.advanceTimersByTimeAsync(29 * MINUTE);
    expect(fetches).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(MINUTE);
    expect(fetches).toHaveLength(2);
  });

  it("does not fetch while a synchronization runs, and fetches at the next delay", async () => {
    const { synchronize } = await startWith(5);
    synchronize.isBusy = true;
    await vi.advanceTimersByTimeAsync(5 * MINUTE);
    expect(fetches).toEqual([]);
    synchronize.isBusy = false;
    await vi.advanceTimersByTimeAsync(5 * MINUTE);
    expect(fetches).toHaveLength(1);
  });

  it("does not fetch while a pull, a push, or a fetch of the Source control sidebar section runs", async () => {
    const { sourceControl } = await startWith(5);
    sourceControl.isBusy = true;
    await vi.advanceTimersByTimeAsync(5 * MINUTE);
    expect(fetches).toEqual([]);
  });

  it("does not start a second fetch while a fetch runs", async () => {
    await startWith(1);
    let finish: () => void = () => {};
    vi.mocked(invoke).mockImplementation(async (command, args) => {
      if (command === "git_sync") {
        fetches.push(args as { root: string; action: string });
        await new Promise<void>((resolve) => (finish = resolve));
      }
      return null;
    });
    await vi.advanceTimersByTimeAsync(3 * MINUTE);
    expect(fetches).toHaveLength(1);
    finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetches).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(MINUTE);
    expect(fetches).toHaveLength(2);
  });

  it("does not fetch when the branch has no upstream branch", async () => {
    await startWith(5, null);
    await vi.advanceTimersByTimeAsync(30 * MINUTE);
    expect(fetches).toEqual([]);
  });

  it("does not fetch when the selected workspace has no Git repository, or when no workspace is selected", async () => {
    const { git, state } = await startWith(5);
    git.status.w1 = null;
    await vi.advanceTimersByTimeAsync(30 * MINUTE);
    expect(fetches).toEqual([]);
    git.status.w1 = statusOf("/work/a");
    state.selectedWorkspaceId = null;
    await vi.advanceTimersByTimeAsync(30 * MINUTE);
    expect(fetches).toEqual([]);
  });

  it("shows nothing when a fetch fails, reads no status, and tries again at the next delay", async () => {
    const { state, loadStatus } = await startWith(5);
    isFailing = true;
    await vi.advanceTimersByTimeAsync(5 * MINUTE);
    expect(fetches).toHaveLength(1);
    expect(state.toast).toBe("");
    expect(loadStatus).not.toHaveBeenCalled();
    isFailing = false;
    await vi.advanceTimersByTimeAsync(5 * MINUTE);
    expect(fetches).toHaveLength(2);
    expect(loadStatus).toHaveBeenCalledTimes(1);
  });
});

describe("the fetch when the developer selects another workspace", () => {
  it("fetches the repository of the new workspace at once, when it was never fetched", async () => {
    const { git, state } = await startWith(5);
    git.status.w2 = statusOf("/work/b");
    state.selectedWorkspaceId = "w2";
    await vi.advanceTimersByTimeAsync(0);
    expect(fetches).toEqual([{ root: "/work/b", action: "fetch" }]);
  });

  it("does not fetch again a repository whose last fetch is younger than the delay", async () => {
    const { git, state } = await startWith(5);
    git.status.w2 = statusOf("/work/b");
    state.selectedWorkspaceId = "w2";
    await vi.advanceTimersByTimeAsync(0);
    fetches = [];
    state.selectedWorkspaceId = "w1";
    await vi.advanceTimersByTimeAsync(0);
    expect(fetches).toEqual([]);
  });

  it("fetches again a repository whose last fetch is older than the delay", async () => {
    const { git, state } = await startWith(5);
    git.status.w2 = statusOf("/work/b");
    state.selectedWorkspaceId = "w2";
    await vi.advanceTimersByTimeAsync(0);
    fetches = [];
    vi.setSystemTime(Date.now() + 6 * MINUTE);
    state.selectedWorkspaceId = "w1";
    await vi.advanceTimersByTimeAsync(0);
    expect(fetches).toEqual([{ root: "/work/a", action: "fetch" }]);
  });

  it("makes no fetch at once when the option is Off", async () => {
    const { git, state } = await startWith(0);
    git.status.w2 = statusOf("/work/b");
    state.selectedWorkspaceId = "w2";
    await vi.advanceTimersByTimeAsync(0);
    expect(fetches).toEqual([]);
  });
});
