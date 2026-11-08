// Macros: reusable texts written into a pane. There are two kinds:
// - the personal macros, kept in the file macros.json of the folder of the data of Heidrun Code;
// - the macros of the project, kept in the key `prompts` of .heidrun/config.json.
// The command line heidrun_code_ctrl changes the two files too, so the window reads them again about every second.
import { computed, reactive } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { readText } from "@tauri-apps/plugin-clipboard-manager";
import { allPanes, state, tabLabel, toast, workspaceLabel } from "./session";
import { currentProject, loadProject, saveProject } from "./project";
import { git } from "./git";
import { selectionReaders } from "./notes";
import { paneName } from "../lib/format";
import { t } from "../i18n/index";

export interface Macro {
  id: string;
  label: string;
  /** One short line shown under the label in the macro menu. May be empty. */
  description: string;
  text: string;
}

/** What the backend reads from the file of the personal macros. */
interface PersonalMacrosFile {
  /** False when the file does not exist. */
  exists: boolean;
  macros: Macro[];
  /** Why the file cannot be read. While it is set, the window never writes the file. */
  error: string | null;
}

/** The key of the old storage of the window. It held the personal macros before they moved to a file. */
const OLD_STORAGE_KEY = "heidrun.prompts";

/** The key where the old storage is kept after its macros moved to the file, so that a developer can get them back. */
const MOVED_STORAGE_KEY = "heidrun.prompts.moved_to_file";

/** How often the window reads the file of the personal macros again, in milliseconds. */
const READ_INTERVAL = 1000;

// ---- The personal macros ------------------------------------------------------------------------------------------

export const macros = reactive({ personal: [] as Macro[] });

/** The personal macros as JSON text, as last read from the file or written to it. */
let knownText = "[]";
/** True once the file was read, or made, without an error. Before that the window writes nothing. */
let isPersonalFileReady = false;
/** Why the file cannot be read, or null. */
let personalFileError: string | null = null;
/** The number of changes that the window made, to tell a read that started before a change from a read after it. */
let localChangeCount = 0;
/** The number of writes in progress. A read that ends during a write is ignored. */
let writeCount = 0;
/** The writes one after the other, so that two quick changes never write from the same old list. */
let writeChain: Promise<void> = Promise.resolve();
let isReading = false;

/** The personal macros of the old storage of the window, or null when it holds none. */
function readOldStorage(): Macro[] | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(OLD_STORAGE_KEY) ?? "null");
    if (Array.isArray(value) === false) {
      return null;
    }
    return (value as Partial<Macro>[])
      .filter((macro) => typeof macro.id === "string" && typeof macro.label === "string" && typeof macro.text === "string")
      .map((macro) => ({ id: macro.id!, label: macro.label!, description: macro.description ?? "", text: macro.text! }));
  } catch {
    return null;
  }
}

/**
 * Moves the personal macros of the old storage of the window to the file, once. The old storage is renamed to
 * `heidrun.prompts.moved_to_file` only after the file is written, so a failure loses nothing, and the move never runs twice.
 *
 * @returns False when the file could not be written. The next read tries again.
 */
async function moveOldStorage(): Promise<boolean> {
  const old = readOldStorage();
  if (old === null) {
    return true;
  }
  const list = old;
  if (list.length > 0) {
    try {
      await invoke("macros_personal_write", { macros: list });
    } catch {
      return false;
    }
    knownText = JSON.stringify(list);
    macros.personal = list;
  }
  try {
    localStorage.setItem(MOVED_STORAGE_KEY, localStorage.getItem(OLD_STORAGE_KEY) ?? "[]");
    localStorage.removeItem(OLD_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  return true;
}

/** Reads the file of the personal macros, and shows what another program changed in it. */
async function readPersonalFile(): Promise<void> {
  const changeCountBefore = localChangeCount;
  let file: PersonalMacrosFile;
  try {
    file = await invoke<PersonalMacrosFile>("macros_personal_read");
  } catch {
    return;
  }
  // A change of the window is newer than this read: the read must not undo it.
  if (changeCountBefore !== localChangeCount || writeCount > 0) {
    return;
  }
  if (file.error !== null) {
    if (personalFileError !== file.error) {
      toast(t("macrosStore.personalFileInvalid", { reason: file.error }));
    }
    personalFileError = file.error;
    return;
  }
  personalFileError = null;
  if (file.exists === false) {
    if (isPersonalFileReady === false) {
      isPersonalFileReady = await moveOldStorage();
    } else if (knownText !== "[]") {
      knownText = "[]";
      macros.personal = [];
    }
    return;
  }
  isPersonalFileReady = true;
  const text = JSON.stringify(file.macros);
  if (text !== knownText) {
    knownText = text;
    macros.personal = file.macros;
  }
}

async function readPersonalFileOnce(): Promise<void> {
  if (isReading) {
    return;
  }
  isReading = true;
  try {
    await readPersonalFile();
  } finally {
    isReading = false;
  }
}

let started = false;

/** Loads the user macros, then reads the file of the personal macros again every second. */
export function startMacros(): void {
  if (started) {
    return;
  }
  started = true;
  void (async () => {
    await readPersonalFileOnce();
    window.setInterval(() => void readPersonalFileOnce(), READ_INTERVAL);
  })();
}

/**
 * Changes the personal macros and writes the file. `change` gets the list at the moment of the write, so two quick changes
 * never start from the same old list.
 *
 * @throws The file was not read yet or is not valid (the window never overwrites it), or it cannot be written.
 */
function changePersonal(change: (list: Macro[]) => Macro[]): Promise<void> {
  const run = async () => {
    if (personalFileError !== null) {
      throw new Error(t("macrosStore.personalFileInvalid", { reason: personalFileError }));
    }
    if (isPersonalFileReady === false) {
      throw new Error(t("macrosStore.personalFileNotRead"));
    }
    const list = change(macros.personal);
    localChangeCount++;
    writeCount++;
    try {
      await invoke("macros_personal_write", { macros: list });
      knownText = JSON.stringify(list);
      macros.personal = list;
    } finally {
      writeCount--;
    }
  };
  const result = writeChain.then(run, run);
  writeChain = result.catch(() => undefined);
  return result;
}

// ---- The macros of the project ------------------------------------------------------------------------------------

/** Macros of the selected workspace's project, from the key `prompts` of .heidrun/config.json. The key keeps the old name, because the file is shared with other people. */
export const projectMacros = computed<Macro[]>(() => macrosOfProjectConfig(currentProject.value?.config));

/** The macros of one project, from the key `prompts` of its .heidrun/config.json. The phone asks for the macros of every workspace, not only of the selected one. */
export function macrosOfProjectConfig(config: unknown): Macro[] {
  const list = (config as { prompts?: unknown } | undefined)?.prompts;
  if (!Array.isArray(list)) return [];
  // Hand-written entries: label and id may be missing.
  return (list as Partial<Macro>[])
    .filter((p) => p && typeof p.text === "string")
    .map((p, i) => ({
      id: typeof p.id === "string" && p.id ? p.id : `projet-${i}`,
      label: typeof p.label === "string" && p.label ? p.label : p.text!.slice(0, 40),
      description: typeof p.description === "string" ? p.description : "",
      text: p.text!,
    }));
}

const slug = (s: string) =>
  `${s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "modele"}-${Math.random().toString(36).slice(2, 5)}`;

export async function addMacro(label: string, description: string, text: string, inProject: boolean): Promise<string> {
  const macro = { id: slug(label), label: label.trim() || text.slice(0, 40), description, text };
  const ws = state.selectedWorkspaceId;
  if (inProject && ws && currentProject.value) {
    // Re-read the file first: another workspace on the same repo may have changed it.
    await loadProject(ws);
    const cfg = currentProject.value.config as { prompts?: Macro[] };
    cfg.prompts = [...(Array.isArray(cfg.prompts) ? cfg.prompts : []), macro];
    if (!(await saveProject(ws))) throw new Error(t("macrosStore.saveFailed"));
  } else {
    await changePersonal((list) => [...list, macro]);
  }
  return macro.id;
}

/** Replaces a macro's details, and moves it between the user and project locations when `inProject` changes. */
export async function updateMacro(id: string, fromProject: boolean, label: string, description: string, text: string, inProject = fromProject) {
  const ws = state.selectedWorkspaceId;
  const macro = { id, label: label.trim() || text.slice(0, 40), description, text };
  if (fromProject === inProject) {
    if (fromProject && ws && currentProject.value) {
      await loadProject(ws);
      const cfg = currentProject.value.config as { prompts?: Partial<Macro>[] };
      let found = false;
      cfg.prompts = (cfg.prompts ?? []).map((p, i) => {
        if ((typeof p.id === "string" && p.id ? p.id : `projet-${i}`) !== id) return p;
        found = true;
        return { ...p, ...macro };
      });
      if (found === false) throw new Error(t("macrosStore.macroNotFound"));
      if (!(await saveProject(ws))) throw new Error(t("macrosStore.saveFailed"));
      return;
    }
    if (macros.personal.some((item) => item.id === id) === false) throw new Error(t("macrosStore.macroNotFound"));
    await changePersonal((list) => list.map((item) => (item.id === id ? macro : item)));
    return;
  }

  if (!ws || currentProject.value === undefined) {
    throw new Error(t("macrosStore.projectUnavailable"));
  }
  await loadProject(ws);
  const cfg = currentProject.value.config as { prompts?: Partial<Macro>[] };
  const oldPrompts = cfg.prompts;
  const projectList = cfg.prompts ?? [];
  const projectIndex = projectList.findIndex((item, i) =>
    (typeof item.id === "string" && item.id ? item.id : `projet-${i}`) === id,
  );

  if (fromProject) {
    if (projectIndex === -1) throw new Error(t("macrosStore.macroNotFound"));
    if (macros.personal.some((item) => item.id === id)) throw new Error(t("macrosStore.locationConflict"));

    await changePersonal((list) => [...list, macro]);
    cfg.prompts = projectList.filter((_, i) => i !== projectIndex);
    if (await saveProject(ws)) return;

    cfg.prompts = oldPrompts;
    await changePersonal((list) => list.filter((item) => item.id !== id));
    throw new Error(t("macrosStore.saveFailed"));
  }

  if (macros.personal.some((item) => item.id === id) === false) throw new Error(t("macrosStore.macroNotFound"));
  if (projectIndex !== -1) throw new Error(t("macrosStore.locationConflict"));

  cfg.prompts = [...projectList, macro];
  if (!(await saveProject(ws))) {
    cfg.prompts = oldPrompts;
    throw new Error(t("macrosStore.saveFailed"));
  }
  try {
    await changePersonal((list) => list.filter((item) => item.id !== id));
  } catch (error) {
    cfg.prompts = oldPrompts;
    if (!(await saveProject(ws))) throw new Error(t("macrosStore.moveRollbackFailed"));
    throw error;
  }
}

/** The window that edits the macros. */
export const macroEditor = reactive({
	/** Whether the macro editor is visible. */
	open: false,
	/** The macro to edit, or null when creating a macro. */
	selectedId: null as string | null,
	/** Whether the selected macro belongs to the project. */
	isFromProject: false,
	/** Whether the selected macro is shown without editable fields or saving. */
	isReadOnly: false,
});

export async function removeMacro(id: string, fromProject: boolean) {
  const ws = state.selectedWorkspaceId;
  if (fromProject && ws && currentProject.value) {
    await loadProject(ws);
    const cfg = currentProject.value.config as { prompts?: Partial<Macro>[] };
    cfg.prompts = (cfg.prompts ?? []).filter((p, i) => (typeof p.id === "string" && p.id ? p.id : `projet-${i}`) !== id);
    await saveProject(ws);
  } else {
    await changePersonal((list) => list.filter((p) => p.id !== id));
  }
}

export const VARIABLES = ["{workspace}", "{onglet}", "{agent}", "{branche}", "{selection}", "{presse-papiers}"];

/**
 * Replaces the variables for the pane the consigne goes to. An unknown variable
 * stays as it is, so nothing silently disappears.
 */
export async function resolveMacroVariables(text: string, paneId: string | null): Promise<string> {
  const p = paneId ? allPanes.value.find((x) => x.pane_id === paneId) : undefined;
  const ws = p?.workspace_id ?? state.selectedWorkspaceId ?? "";
  const values: Record<string, () => string | Promise<string>> = {
    workspace: () => (ws ? workspaceLabel(ws) : ""),
    onglet: () => (p ? tabLabel(p.tab_id) : ""),
    agent: () => (p ? paneName(p) : ""),
    branche: () => git.status[ws]?.branch ?? "",
    selection: () => {
      for (const read of [p && selectionReaders.get(p.pane_id), ...selectionReaders.values()]) {
        const s = read?.();
        if (s) return s;
      }
      return "";
    },
    "presse-papiers": async () => (await readText().catch(() => "")) ?? "",
  };
  // Values first, then a single pass: a value that contains "{…}" is not expanded
  // again, and an empty value becomes "" (no "{branche}" left in the consigne).
  const vals: Record<string, string> = {};
  for (const [name, get] of Object.entries(values)) if (text.includes(`{${name}}`)) vals[name] = await get();
  return text.replace(/\{([\w-]+)\}/g, (m, k: string) => (k in vals ? vals[k] : m));
}
