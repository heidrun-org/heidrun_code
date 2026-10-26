import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  snapshot: vi.fn(),
  codexUsage: vi.fn(async () => ({ available: false, sessions: {} })),
  handlers: {} as Record<string, (event: { payload: unknown }) => void>,
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => null) }));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    mocks.handlers[name] = handler;
    return () => {};
  }),
}));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));
vi.mock("../lib/api", () => ({
  snapshot: mocks.snapshot,
  watchPanes: vi.fn(async () => {}),
  read: vi.fn(async () => ""),
  codexUsage: mocks.codexUsage,
}));

/** A snapshot with one workspace that holds one pane that runs no coding agent. */
function buildSnapshot() {
  return {
    version: "test",
    protocol: 1,
    focused_workspace_id: "w1",
    workspaces: [{ workspace_id: "w1", number: 1, label: "heidrun", focused: true, pane_count: 1, tab_count: 1, active_tab_id: "t1", agent_status: "idle" }],
    tabs: [{ tab_id: "t1", workspace_id: "w1", number: 1, label: "main", focused: true, pane_count: 1, agent_status: "idle" }],
    panes: [{ pane_id: "p1", tab_id: "t1", workspace_id: "w1", focused: true, cwd: "/work", agent_status: "idle" }],
    layouts: [{ tab_id: "t1", focused_pane_id: "p1", root: { type: "pane", pane_id: "p1" } }],
    agents: [],
  };
}

/** Starts the session store with fake timers, so that the test can move the clock by minutes. */
async function startTheSessionStore() {
  vi.resetModules();
  vi.useFakeTimers();
  const session = await import("./session");
  await session.start();
  return session;
}

beforeEach(() => {
  localStorage.clear();
  mocks.snapshot.mockReset();
  mocks.snapshot.mockImplementation(async () => buildSnapshot());
  mocks.codexUsage.mockClear();
  for (const name of Object.keys(mocks.handlers)) {
    delete mocks.handlers[name];
  }
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the snapshot of Herdr is read after an event, never after a timer", () => {
  it("reads the snapshot once at the start, and never again while no event arrives", async () => {
    await startTheSessionStore();
    expect(mocks.snapshot).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(10 * 60_000);

    expect(mocks.snapshot).toHaveBeenCalledTimes(1);
  });

  it("keeps the same list of workspaces while no event arrives", async () => {
    const session = await startTheSessionStore();
    const workspaces = session.state.snapshot?.workspaces;
    expect(workspaces).toBeDefined();

    await vi.advanceTimersByTimeAsync(60_000);

    expect(session.state.snapshot?.workspaces).toBe(workspaces);
  });

  it("reads the snapshot again after an event that Herdr pushes", async () => {
    await startTheSessionStore();

    mocks.handlers["herdr://event"]({ payload: {} });
    await vi.advanceTimersByTimeAsync(100);

    expect(mocks.snapshot).toHaveBeenCalledTimes(2);
  });

  it("reads the snapshot again at once after the connection to Herdr comes back", async () => {
    await startTheSessionStore();

    mocks.handlers["herdr://connected"]({ payload: null });
    await vi.advanceTimersByTimeAsync(0);

    expect(mocks.snapshot).toHaveBeenCalledTimes(2);
  });

  it("reads the snapshot again after Herdr says that it lost events", async () => {
    await startTheSessionStore();

    mocks.handlers["herdr://resync"]({ payload: "events_lost" });
    await vi.advanceTimersByTimeAsync(200);

    expect(mocks.snapshot).toHaveBeenCalledTimes(2);
  });
});

describe("the usage of Codex", () => {
  it("is read again every 10 seconds, because Codex writes it outside Heidrun Code and no event announces it", async () => {
    await startTheSessionStore();
    mocks.codexUsage.mockClear();

    await vi.advanceTimersByTimeAsync(30_000);

    expect(mocks.codexUsage).toHaveBeenCalledTimes(3);
  });
});
