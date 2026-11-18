import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("./git", async (importOriginal) => {
  const original = await importOriginal<typeof import("./git")>();
	return {
		...original,
		refreshGit: vi.fn(),
	};
});

import { commit, discardFiles, sourceControl, splitFiles, stageFiles, writeCommitMessage } from "./source_control";
import { git, loadStatus, type GitStatus } from "./git";
import { answerConfirm, confirmDialog } from "./confirm";
import { state } from "./session";

vi.mock('./workspace_folders', () => ({
	WorkspaceFolders: {
		get: (workspaceId: string) => `/work/${workspaceId}`,
	},
}));

/** The Tauri commands that the store called, with their arguments, in order. */
let calls: { command: string; args: unknown }[] = [];

function makeStatus(files: { status: string; path: string }[] = []): GitStatus {
  return {
    root: "/work/heidrun",
    branch: "main",
    upstream: "origin/main",
    ahead: 0,
    behind: 0,
    changed: files.length,
    untracked: 0,
    files,
    last_sha: "abc1234",
    last_subject: "first",
    last_time: null,
    remote: null,
  };
}

/** A request that the test can complete after observing the current state. */
class PendingRequest {
	/**
	 * Creates a request the test can resolve or reject.
	 * @returns the promise and its completion functions
	 */
	static create<T>() {
		let resolve!: (value: T) => void;
		let reject!: (reason: unknown) => void;
		const promise = new Promise<T>((resolveFn, rejectFn) => {
			resolve = resolveFn;
			reject = rejectFn;
		});
		return {
			promise,
			resolve,
			reject,
		};
	}
}

/** Waits until the confirmation modal dialog opens, then answers it. */
async function answerWhenAsked(isConfirmed: boolean) {
  await vi.waitFor(() => expect(confirmDialog.open).toBe(true));
  answerConfirm(isConfirmed);
}

beforeEach(() => {
  calls = [];
  vi.mocked(invoke).mockImplementation(async (command, args) => {
    calls.push({ command, args });
    if (command === "git_status") {
      return makeStatus();
    }
    if (command === "git_commit_diff") {
      return "diff --git a/README.md b/README.md\n+new line\n";
    }
    if (command === "coding_agent_ask") {
      return { agent: "codex", text: "  Add a line to the README\n" };
    }
    return null;
  });
  state.selectedWorkspaceId = "w1";
});

afterEach(() => {
  state.selectedWorkspaceId = null;
  git.status = {};
  sourceControl.messages = {};
  vi.clearAllMocks();
});

describe("splitFiles", () => {
  it("puts a staged file in Staged Changes, a changed file in Changes, and a file changed twice in both groups", () => {
    const groups = splitFiles(
      makeStatus([
        { status: "M.", path: "src/staged.ts" },
        { status: ".M", path: "README.md" },
        { status: "MM", path: "docs/both.md" },
        { status: "A.", path: "new_staged.ts" },
        { status: ".D", path: "gone.ts" },
      ]),
    );
    expect(groups.staged.map((file) => [file.path, file.letter])).toEqual([
      ["src/staged.ts", "M"],
      ["docs/both.md", "M"],
      ["new_staged.ts", "A"],
    ]);
    expect(groups.changes.map((file) => [file.path, file.letter])).toEqual([
      ["README.md", "M"],
      ["docs/both.md", "M"],
      ["gone.ts", "D"],
    ]);
  });

  it("shows a new file that Git does not know as U, and a file in conflict as !, in Changes", () => {
    const groups = splitFiles(
      makeStatus([
        { status: "??", path: "untracked.txt" },
        { status: "UU", path: "conflict.txt" },
      ]),
    );
    expect(groups.staged).toEqual([]);
    expect(groups.changes.map((file) => file.letter)).toEqual(["U", "!"]);
  });

  it("splits the path into the file name and its folders, with no folder at the root of the repository", () => {
    const [nested, root] = splitFiles(
      makeStatus([
        { status: ".M", path: "docs/agents_rules/user_interface.md" },
        { status: ".M", path: "CHANGELOG.md" },
      ]),
    ).changes;
    expect([nested.name, nested.folder]).toEqual(["user_interface.md", "docs/agents_rules"]);
    expect([root.name, root.folder]).toEqual(["CHANGELOG.md", ""]);
  });
});

describe("Git actions", () => {
  it("stages the files on the root of the repository", async () => {
    git.status = { w1: makeStatus([{ status: ".M", path: "README.md" }]) };
    await stageFiles(["README.md"]);
    expect(calls).toEqual([{ command: "git_stage", args: { root: "/work/heidrun", paths: ["README.md"] } }]);
  });

  it("discards the changes only after the user confirms it", async () => {
    git.status = { w1: makeStatus([{ status: ".M", path: "README.md" }]) };
    const refused = discardFiles(["README.md"]);
    await answerWhenAsked(false);
    await refused;
    expect(calls).toEqual([]);
    const accepted = discardFiles(["README.md"]);
    await answerWhenAsked(true);
    await accepted;
    expect(calls).toEqual([{ command: "git_discard", args: { root: "/work/heidrun", paths: ["README.md"] } }]);
  });

  it("commits the staged files with the message, then empties the message box", async () => {
    git.status = { w1: makeStatus([{ status: "M.", path: "README.md" }]) };
    sourceControl.messages.w1 = "Add a line";
    await commit("commit");
    expect(calls).toEqual([
      { command: "git_commit", args: { root: "/work/heidrun", message: "Add a line", amend: false } },
      { command: "git_status", args: { cwd: "/work/w1" } },
    ]);
    expect(sourceControl.messages.w1).toBe("");
  });

  it("stages every change with no question when nothing is staged, then commits", async () => {
    git.status = {
      w1: makeStatus([
        { status: ".M", path: "README.md" },
        { status: "??", path: "NEW.md" },
      ]),
    };
    sourceControl.messages.w1 = "Add a line";
    await commit("commit");
    expect(confirmDialog.open).toBe(false);
    expect(calls).toEqual([
      { command: "git_stage", args: { root: "/work/heidrun", paths: ["README.md", "NEW.md"] } },
      { command: "git_commit", args: { root: "/work/heidrun", message: "Add a line", amend: false } },
      { command: "git_status", args: { cwd: "/work/w1" } },
    ]);
    expect(sourceControl.messages.w1).toBe("");
  });

  it("does not stage anything and does not commit when nothing changed", async () => {
    git.status = { w1: makeStatus([]) };
    sourceControl.messages.w1 = "Add a line";
    await commit("commit");
    expect(calls).toEqual([]);
  });

  it("does not commit without a message", async () => {
    git.status = { w1: makeStatus([{ status: "M.", path: "README.md" }]) };
    await commit("commit");
    expect(calls).toEqual([]);
  });

  it("pushes after the commit with the mode commit and push", async () => {
    git.status = { w1: makeStatus([{ status: "M.", path: "README.md" }]) };
    sourceControl.messages.w1 = "Add a line";
    await commit("commitAndPush");
    expect(calls.map((call) => call.command)).toEqual(["git_commit", "git_status", "git_sync", "git_status"]);
    expect(calls[2].args).toEqual({ root: "/work/heidrun", action: "push" });
  });

	it('keeps automatic staging and commit in the starting workspace until its status refresh completes', async () => {
		const initialStatus = makeStatus([
			{
				status: '.M',
				path: 'README.md',
			},
		]);
		git.status.w1 = initialStatus;
		git.status.w2 = makeStatus([
			{
				status: 'M.',
				path: 'other.md',
			},
		]);
		git.status.w2.root = '/work/other';
		sourceControl.messages.w1 = 'Add a line';
		sourceControl.messages.w2 = 'Another draft';
		const staging = PendingRequest.create<void>();
		const refresh = PendingRequest.create<GitStatus>();
		vi.mocked(invoke).mockImplementationOnce(() => staging.promise);
		vi.mocked(invoke).mockResolvedValueOnce(null);
		vi.mocked(invoke).mockImplementationOnce(() => refresh.promise);

		const pendingCommit = commit('commit');
		expect(sourceControl.commitProgress?.step).toBe('committing');
		state.selectedWorkspaceId = 'w2';
		await commit('commit');
		expect(invoke).toHaveBeenCalledTimes(1);

		staging.resolve();
		await vi.waitFor(() => expect(invoke).toHaveBeenCalledTimes(3));
		expect(invoke).toHaveBeenNthCalledWith(2, 'git_commit', {
			root: '/work/heidrun',
			message: 'Add a line',
			amend: false,
		});
		expect(invoke).toHaveBeenNthCalledWith(3, 'git_status', {
			cwd: '/work/w1',
		});
		expect(sourceControl.commitProgress?.workspaceId).toBe('w1');
		expect(sourceControl.isBusy).toBe(true);

		refresh.resolve(makeStatus());
		await pendingCommit;
		expect(git.status.w1.files).toEqual([]);
		expect(sourceControl.messages.w2).toBe('Another draft');
		expect(sourceControl.commitProgress).toBeNull();
		expect(sourceControl.isBusy).toBe(false);
	});

	it('keeps the message and refreshes staged changes when the commit fails', async () => {
		const stagedStatus = makeStatus([
			{
				status: 'M.',
				path: 'README.md',
			},
		]);
		git.status.w1 = makeStatus([
			{
				status: '.M',
				path: 'README.md',
			},
		]);
		sourceControl.messages.w1 = 'Add a line';
		vi.mocked(invoke).mockResolvedValueOnce(null);
		vi.mocked(invoke).mockRejectedValueOnce('Pre-commit check failed.');
		vi.mocked(invoke).mockResolvedValueOnce(stagedStatus);

		await commit('commit');

		expect(sourceControl.messages.w1).toBe('Add a line');
		expect(git.status.w1).toEqual(stagedStatus);
		expect(state.toast).toBe('Pre-commit check failed.');
		expect(state.toastKind).toBe('error');
		expect(sourceControl.commitProgress).toBeNull();
	});

	it('reports a failed push separately from the successful commit', async () => {
		git.status.w1 = makeStatus([
			{
				status: 'M.',
				path: 'README.md',
			},
		]);
		sourceControl.messages.w1 = 'Add a line';
		const committedStatus = makeStatus();
		committedStatus.ahead = 1;
		const push = PendingRequest.create<void>();
		vi.mocked(invoke).mockResolvedValueOnce(null);
		vi.mocked(invoke).mockResolvedValueOnce(committedStatus);
		vi.mocked(invoke).mockImplementationOnce(() => push.promise);
		vi.mocked(invoke).mockResolvedValueOnce(committedStatus);

		const pendingCommit = commit('commitAndPush');
		await vi.waitFor(() => expect(invoke).toHaveBeenCalledTimes(3));
		expect(sourceControl.commitProgress?.step).toBe('pushingCommit');
		expect(sourceControl.messages.w1).toBe('');
		expect(git.status.w1.ahead).toBe(1);

		push.reject('Remote rejected the push.');
		await pendingCommit;
		expect(state.toast).toBe('Commit created. Push failed: Remote rejected the push.');
		expect(state.toastKind).toBe('error');
		expect(sourceControl.commitProgress).toBeNull();
	});

	it('keeps the refreshed status when an earlier poll returns after the commit', async () => {
		const stagedStatus = makeStatus([
			{
				status: 'M.',
				path: 'README.md',
			},
		]);
		git.status.w1 = stagedStatus;
		sourceControl.messages.w1 = 'Add a line';
		const poll = PendingRequest.create<GitStatus>();
		vi.mocked(invoke).mockImplementationOnce(() => poll.promise);

		const pendingPoll = loadStatus('w1');
		await commit('commit');
		poll.resolve(stagedStatus);
		await pendingPoll;

		expect(git.status.w1.files).toEqual([]);
	});

  it("puts the commit message that the coding agent wrote from the diff in the message box", async () => {
    git.status = { w1: makeStatus([{ status: "M.", path: "README.md" }]) };
    await writeCommitMessage();
    expect(calls.map((call) => call.command)).toEqual(["git_commit_diff", "coding_agent_ask"]);
    expect((calls[1].args as { prompt: string }).prompt).toContain("+new line");
    expect(sourceControl.messages.w1).toBe("Add a line to the README");
  });
});
