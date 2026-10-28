import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

interface Macro {
  id: string;
  label: string;
  description: string;
  text: string;
}

interface FakeFile {
  exists: boolean;
  macros: Macro[];
  error: string | null;
}

const HARD_CODED: Macro[] = [
  { id: "revue-mr", label: "Review the merge request", description: "Security, bugs, tests, summary", text: "Review {branche}." },
  { id: "note-reprise", label: "Handover note", description: "Commit", text: "Write the handover note." },
];

/** The file of the personal macros that the fake backend holds, and what was written to it. */
const backend = {
  file: { exists: false, macros: [], error: null } as FakeFile,
  writes: [] as Macro[][],
  /** When set, the next read waits for this promise, then gives the file as it was when the read started. */
  heldRead: null as Promise<void> | null,
};

/** Loads a new copy of the macro store, with the fake backend behind `invoke`. */
async function loadStore() {
  vi.resetModules();
  const { invoke } = await import("@tauri-apps/api/core");
  vi.mocked(invoke).mockImplementation((async (command: string, args?: { macros?: Macro[] }) => {
    if (command === "macros_hard_coded") {
      return structuredClone(HARD_CODED);
    }
    if (command === "macros_personal_read") {
      const snapshot = structuredClone(backend.file);
      const held = backend.heldRead;
      backend.heldRead = null;
      if (held !== null) {
        await held;
      }
      return snapshot;
    }
    if (command === "macros_personal_write") {
      // The real `invoke` writes JSON, so a reactive list is copied the same way.
      const written = JSON.parse(JSON.stringify(args!.macros!)) as Macro[];
      backend.writes.push(written);
      backend.file = { exists: true, macros: structuredClone(written), error: null };
      return undefined;
    }
    throw new Error(`unexpected command ${command}`);
  }) as never);
  const store = await import("./macros");
  return store;
}

/** The list that the last write gave to the file. */
function lastWrite(): Macro[] {
  return backend.writes[backend.writes.length - 1];
}

/** Lets the pending promises of the store finish. */
async function flush() {
  await vi.advanceTimersByTimeAsync(0);
}

const macroA: Macro = { id: "a", label: "A", description: "", text: "Text A" };
const macroB: Macro = { id: "b", label: "B", description: "Line", text: "Text B" };

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  backend.file = { exists: false, macros: [], error: null };
  backend.writes = [];
  backend.heldRead = null;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the hard-coded macros", () => {
  it("come from the backend, and their titles follow the language in use", async () => {
    const store = await loadStore();
    store.startMacros();
    await flush();
    expect(store.hardCodedMacros.value.map((macro) => macro.id)).toEqual(["revue-mr", "note-reprise"]);
    expect(store.hardCodedMacros.value[0].label).toBe("Review the merge request");
    expect(store.hardCodedMacros.value[0].text).toBe("Review {branche}.");
  });
});

describe("the personal macros", () => {
  it("are read from the file at the start", async () => {
    backend.file = { exists: true, macros: [macroA], error: null };
    const store = await loadStore();
    store.startMacros();
    await flush();
    expect(store.macros.personal).toEqual([macroA]);
  });

  it("show what another program, such as the command line heidrun_code_ctrl, writes in the file, within one second", async () => {
    backend.file = { exists: true, macros: [macroA], error: null };
    const store = await loadStore();
    store.startMacros();
    await flush();
    backend.file = { exists: true, macros: [macroA, macroB], error: null };
    await vi.advanceTimersByTimeAsync(1000);
    expect(store.macros.personal).toEqual([macroA, macroB]);
    backend.file = { exists: true, macros: [macroB], error: null };
    await vi.advanceTimersByTimeAsync(1000);
    expect(store.macros.personal).toEqual([macroB]);
  });

  it("become empty when the file is deleted", async () => {
    backend.file = { exists: true, macros: [macroA], error: null };
    const store = await loadStore();
    store.startMacros();
    await flush();
    backend.file = { exists: false, macros: [], error: null };
    await vi.advanceTimersByTimeAsync(1000);
    expect(store.macros.personal).toEqual([]);
  });

  it("are written to the file when the developer adds, updates, or deletes one in the window", async () => {
    backend.file = { exists: true, macros: [macroA], error: null };
    const store = await loadStore();
    store.startMacros();
    await flush();
    const id = await store.addMacro("New macro", "A line", "New text", false);
    expect(lastWrite()).toEqual([macroA, { id, label: "New macro", description: "A line", text: "New text" }]);
    await store.updateMacro(id, false, "Changed", "", "Changed text");
    expect(lastWrite()[1]).toEqual({ id, label: "Changed", description: "", text: "Changed text" });
    await store.removeMacro("a", false);
    expect(lastWrite()).toEqual([{ id, label: "Changed", description: "", text: "Changed text" }]);
    expect(store.macros.personal).toEqual(backend.file.macros);
  });

  it("keep two quick changes of the window, because the writes follow one another", async () => {
    backend.file = { exists: true, macros: [], error: null };
    const store = await loadStore();
    store.startMacros();
    await flush();
    await Promise.all([store.addMacro("One", "", "1", false), store.addMacro("Two", "", "2", false)]);
    expect(backend.file.macros.map((macro) => macro.text)).toEqual(["1", "2"]);
  });

  it("are not undone by a read that started before a change of the window", async () => {
    backend.file = { exists: true, macros: [macroA], error: null };
    const store = await loadStore();
    store.startMacros();
    await flush();
    let release: () => void = () => {};
    backend.heldRead = new Promise<void>((resolve) => {
      release = resolve;
    });
    await vi.advanceTimersByTimeAsync(1000);
    await store.addMacro("New", "", "New text", false);
    release();
    await flush();
    expect(store.macros.personal.map((macro) => macro.text)).toEqual(["Text A", "New text"]);
  });

  it("are never written when the file is not valid, so the file is never overwritten", async () => {
    backend.file = { exists: true, macros: [], error: "The file macros.json is not a list of macros" };
    const store = await loadStore();
    store.startMacros();
    await flush();
    await expect(store.addMacro("New", "", "Text", false)).rejects.toThrow("is not a list of macros");
    expect(backend.writes).toEqual([]);
  });

  it("do not exist as a file until the developer adds one", async () => {
    const store = await loadStore();
    store.startMacros();
    await flush();
    expect(store.macros.personal).toEqual([]);
    expect(backend.writes).toEqual([]);
  });
});

describe("the old storage of the window", () => {
  it("moves to the file once, and is renamed to heidrun.prompts.moved_to_file after the file is written", async () => {
    const oldStorageText = JSON.stringify([
      { id: "revue-mr", label: "Revue de la MR", description: "", text: "Review {branche}." },
      { id: "note-reprise", label: "Note", description: "", text: "A text that the developer changed." },
      { id: "own-1", label: "Own", text: "Own text" },
    ]);
    localStorage.setItem("heidrun.prompts", oldStorageText);
    const store = await loadStore();
    store.startMacros();
    await flush();
    expect(backend.writes).toHaveLength(1);
    expect(backend.file.macros).toEqual([
      { id: "note-reprise-personal", label: "Note", description: "", text: "A text that the developer changed." },
      { id: "own-1", label: "Own", description: "", text: "Own text" },
    ]);
    expect(store.macros.personal).toEqual(backend.file.macros);
    expect(localStorage.getItem("heidrun.prompts")).toBeNull();
    expect(localStorage.getItem("heidrun.prompts.moved_to_file")).toBe(oldStorageText);
    await vi.advanceTimersByTimeAsync(3000);
    expect(backend.writes).toHaveLength(1);
  });

  it("does not move when the file already exists", async () => {
    backend.file = { exists: true, macros: [macroA], error: null };
    localStorage.setItem("heidrun.prompts", JSON.stringify([{ id: "own-1", label: "Own", description: "", text: "Own text" }]));
    const store = await loadStore();
    store.startMacros();
    await flush();
    expect(store.macros.personal).toEqual([macroA]);
    expect(backend.writes).toEqual([]);
  });

  it("drops a default macro that the developer never changed, and keeps one that was changed under a new id", async () => {
    const store = await loadStore();
    const old = [
      { id: "revue-mr", label: "x", description: "", text: "Review {branche}." },
      { id: "note-reprise", label: "y", description: "", text: "Changed" },
      macroA,
    ];
    expect(store.personalMacrosFromOldStorage(old, HARD_CODED).map((macro) => macro.id)).toEqual(["note-reprise-personal", "a"]);
  });
});

describe("the macros of a project", () => {
  it("come from the key prompts of the file .heidrun/config.json, and get an id and a label when the file has none", async () => {
    const store = await loadStore();
    const { project } = await import("./project");
    const { state } = await import("./session");
    state.selectedWorkspaceId = "workspace_test";
    project.byWorkspace.workspace_test = {
      root: "/tmp/project",
      config: { version: 1, launchers: [], prompts: [{ text: "Review the branch" }] },
    } as never;
    await nextTick();
    expect(store.projectMacros.value).toEqual([
      { id: "projet-0", label: "Review the branch", description: "", text: "Review the branch" },
    ]);
  });
});

describe("resolveMacroVariables", () => {
  it("leaves a variable that it does not know, so that nothing disappears", async () => {
    const store = await loadStore();
    expect(await store.resolveMacroVariables("a {unknown} b", null)).toBe("a {unknown} b");
  });

  it("replaces a known variable that has no value with an empty text", async () => {
    const store = await loadStore();
    expect(await store.resolveMacroVariables("branch: {branche}.", null)).toBe("branch: .");
  });
});
