import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  snapshot: vi.fn(),
  handlers: {} as Record<string, (event: { payload: unknown }) => Promise<void>>,
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => null) }));
vi.mock('@tauri-apps/api/event', () => ({
	listen: vi.fn(async (name: string, handler: (event: { payload: unknown }) => Promise<void>) => {
		mocks.handlers[name] = handler;
		return () => {};
	}),
}));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));
vi.mock("../lib/api", () => ({
  snapshot: mocks.snapshot,
  watchPanes: vi.fn(async () => {}),
  codexUsage: vi.fn(async () => ({ available: false, sessions: {} })),
}));

/** Builds a snapshot with one workspace for each given identifier, and Herdr focus on the first one. */
function buildSnapshot(workspaceIds: string[]) {
  return {
    version: "test",
    protocol: 1,
    focused_workspace_id: workspaceIds[0] ?? null,
    workspaces: workspaceIds.map((workspaceId, index) => ({
      workspace_id: workspaceId,
      number: index + 1,
      label: workspaceId,
      focused: index === 0,
      pane_count: 0,
      tab_count: 0,
      active_tab_id: "",
      agent_status: "unknown",
    })),
    tabs: [],
    panes: [],
    layouts: [],
    agents: [],
  };
}

/** Starts the stores again, as a new run of Heidrun Code does, and reads the given snapshot. */
async function startHeidrun(workspaceIds: string[]) {
  vi.resetModules();
  mocks.snapshot.mockResolvedValue(buildSnapshot(workspaceIds));
  const session = await import("./session");
  const settingsStore = await import("./settings");
  await session.refresh();
  return { session, settingsStore };
}

beforeEach(() => {
  localStorage.clear();
  mocks.snapshot.mockReset();
});

describe("selected workspace between two runs", () => {
  it("selects the first workspace on the very first run", async () => {
    const { session } = await startHeidrun(["w1", "w2", "w3"]);
    expect(session.state.selectedWorkspaceId).toBe("w1");
  });

  it("saves the selected workspace when the developer selects another workspace", async () => {
    const { session, settingsStore } = await startHeidrun(["w1", "w2", "w3"]);
    session.selectWorkspace("w3");
    await Promise.resolve();
    expect(settingsStore.settings.selectedWorkspaceId).toBe("w3");
  });

  it("selects the saved workspace again at the next run", async () => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ selectedWorkspaceId: "w3" }));
    const { session } = await startHeidrun(["w1", "w2", "w3"]);
    expect(session.state.selectedWorkspaceId).toBe("w3");
  });

  it("selects the first workspace when the saved workspace does not exist any more", async () => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ selectedWorkspaceId: "w9" }));
    const { session } = await startHeidrun(["w1", "w2", "w3"]);
    expect(session.state.selectedWorkspaceId).toBe("w1");
  });

  it("does not forget the saved workspace when the first snapshot has no workspace", async () => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ selectedWorkspaceId: "w2" }));
    const { session, settingsStore } = await startHeidrun([]);
    expect(session.state.selectedWorkspaceId).toBeNull();
    expect(settingsStore.settings.selectedWorkspaceId).toBe("w2");
  });
});

describe('workspace focus from Herdr', () => {
	it('selects the requested workspace even when Herdr already focused that workspace', async () => {
		const { session } = await startHeidrun(['w1', 'w2']);
		await session.start();
		session.selectWorkspace('w2');
		await mocks.handlers['herdr://event']({
			payload: {
				event: 'workspace_focused',
				data: {
					workspace_id: 'w1',
				},
			},
		});
		expect(session.state.selectedWorkspaceId).toBe('w1');
	});

	it('ignores a focus event for a workspace that has already closed', async () => {
		const { session } = await startHeidrun(['w1', 'w2']);
		await session.start();
		session.selectWorkspace('w2');
		await mocks.handlers['herdr://event']({
			payload: {
				event: 'workspace_focused',
				data: {
					workspace_id: 'closed',
				},
			},
		});
		expect(session.state.selectedWorkspaceId).toBe('w2');
	});
});

it('selects a workspace for a new command line focus request without a Herdr focus change', async () => {
	const { session } = await startHeidrun(['w1', 'w2']);
	await session.start();
	session.selectWorkspace('w2');
	await mocks.handlers['herdr://event']({
		payload: {
			event: 'workspace_metadata_updated',
			data: {
				workspace: {
					workspace_id: 'w1',
					tokens: {
						heidrun_focus_request: 'new-request',
					},
				},
			},
		},
	});
	expect(session.state.selectedWorkspaceId).toBe('w1');
});

it('preserves a pending focus while an older snapshot is being refreshed', async () => {
	const { session } = await startHeidrun(['w1', 'w2']);
	await session.start();
	let complete: ((snapshot: ReturnType<typeof buildSnapshot>) => void) | undefined;
	mocks.snapshot.mockImplementationOnce(() => new Promise((resolve) => {
		complete = resolve;
	}));
	const refresh = session.refresh();
	await mocks.handlers['herdr://event']({
		payload: {
			event: 'workspace_focused',
			data: {
				workspace_id: 'w2',
			},
		},
	});
	complete?.(buildSnapshot(['w1']));
	await refresh;
	expect(session.state.selectedWorkspaceId).toBe('w2');
});

it('does not repeat a command focus when unrelated metadata carries the same request', async () => {
	const { session } = await startHeidrun(['w1', 'w2']);
	await session.start();
	const event = {
		payload: {
			event: 'workspace_metadata_updated',
			data: {
				workspace: {
					workspace_id: 'w1',
					tokens: {
						heidrun_focus_request: 'request',
					},
				},
			},
		},
	};
	await mocks.handlers['herdr://event'](event);
	session.selectWorkspace('w2');
	await mocks.handlers['herdr://event'](event);
	expect(session.state.selectedWorkspaceId).toBe('w2');
});
