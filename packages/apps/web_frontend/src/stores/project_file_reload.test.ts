import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

/** The text of the file .heidrun/config.json that the fake backend gives, and how many times the project was loaded. The fake project has the configuration of that text, when the text is a configuration of the version 1. */
const backend = { configText: "{}", loads: 0 };

async function loadStores() {
  vi.resetModules();
  const { invoke } = await import("@tauri-apps/api/core");
  vi.mocked(invoke).mockImplementation((async (command: string) => {
    if (command === "project_config_text") {
      return backend.configText;
    }
    if (command === "project_load") {
      backend.loads++;
      const file = JSON.parse(backend.configText) as { version?: number };
      const config = file.version === 1 ? file : { version: 1, launchers: [] };
      return { root: "/project", config_path: "/project/.heidrun/config.json", config, detected: [] };
    }
    throw new Error(`unexpected command ${command}`);
  }) as never);
  const projectStore = await import("./project");
  const sessionStore = await import("./session");
  sessionStore.state.snapshot = {
    workspaces: [{ workspace_id: "w1", number: 1, workspace_folder: "/project" }],
    tabs: [],
    panes: [],
  } as never;
  sessionStore.state.selectedWorkspaceId = "w1";
  projectStore.project.byWorkspace.w1 = { root: "/project", config_path: "", config: { version: 1, launchers: [] }, detected: [] };
  return projectStore;
}

beforeEach(() => {
  backend.configText = "{}";
  backend.loads = 0;
});

describe("reloadProjectWhenFileChanged", () => {
  it("only records the text the first time", async () => {
    const store = await loadStores();
    await store.reloadProjectWhenFileChanged();
    expect(backend.loads).toBe(0);
  });

  it("loads the project again when another program changed the file", async () => {
    const store = await loadStores();
    await store.reloadProjectWhenFileChanged();
    backend.configText = '{"version":1,"launchers":[],"prompts":[{"text":"New"}]}';
    await store.reloadProjectWhenFileChanged();
    expect(backend.loads).toBe(1);
  });

  it("shows an added, a changed, and a deleted launcher, as the command line heidrun_code_ctrl makes them", async () => {
    const store = await loadStores();
    const commands = () => store.project.byWorkspace.w1?.config.launchers.map((launcher) => `${launcher.id}: ${launcher.command}`);
    const fileWith = (...commands: string[]) =>
      JSON.stringify({ version: 1, launchers: commands.map((command) => ({ id: "run-x7q2", label: "Run", command })) });
    backend.configText = fileWith();
    await store.reloadProjectWhenFileChanged();
    expect(commands()).toEqual([]);
    backend.configText = fileWith("pnpm test");
    await store.reloadProjectWhenFileChanged();
    expect(commands()).toEqual(["run-x7q2: pnpm test"]);
    backend.configText = fileWith("pnpm run test:unit");
    await store.reloadProjectWhenFileChanged();
    expect(commands()).toEqual(["run-x7q2: pnpm run test:unit"]);
    backend.configText = fileWith();
    await store.reloadProjectWhenFileChanged();
    expect(commands()).toEqual([]);
    expect(backend.loads).toBe(3);
  });

  it("reads a launcher under the old key actions, as the command line heidrun_code_ctrl reads it", async () => {
    const store = await loadStores();
    await store.reloadProjectWhenFileChanged();
    backend.configText = JSON.stringify({ version: 1, actions: [{ id: "a", label: "A", command: "ls" }] });
    await store.reloadProjectWhenFileChanged();
    expect(store.project.byWorkspace.w1?.config.launchers[0]?.id).toBe("a");
  });

  it("loads nothing when the file did not change", async () => {
    const store = await loadStores();
    await store.reloadProjectWhenFileChanged();
    await store.reloadProjectWhenFileChanged();
    await store.reloadProjectWhenFileChanged();
    expect(backend.loads).toBe(0);
  });

  it("does nothing for a workspace whose project is not loaded yet", async () => {
    const store = await loadStores();
    delete store.project.byWorkspace.w1;
    backend.configText = "changed";
    await store.reloadProjectWhenFileChanged();
    await store.reloadProjectWhenFileChanged();
    expect(backend.loads).toBe(0);
  });
});
