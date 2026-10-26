// The File explorer sidebar section: the project of the selected workspace and its tree.
import { markRaw, reactive } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "./session";
import { settings } from "./settings";
import { FileViewPanes } from "./file_view_panes";
import { t } from "../i18n/index";

interface FileList {
  root: string;
  git: boolean;
  files: string[];
  /** The entries of `files` that Git ignores, written as in `files`. Empty when the option to show them is off. */
  ignored: string[];
  /** Submodule folders relative to the project root, without a trailing slash. */
  submodules: string[];
  status: Record<string, string>;
  truncated: boolean;
}

export const files = reactive({
  loading: false,
  error: "",
  root: "",
  git: false,
  list: [] as string[],
  /** The entries of `list` that Git ignores: a folder ends with "/". Empty when the option to show them is off. */
  ignored: [] as string[],
  /** Submodule folders, including submodules with no listed files. */
  submodules: [] as string[],
  status: {} as Record<string, string>,
  truncated: false,
  expanded: new Set<string>(),
});

/**
 * Sidebar section File explorer: the empty folders that the developer created in this session, by root of repository. Git does
 * not list an empty folder, so the tree adds them.
 */
export const filesPanelNewFolders = reactive({} as Record<string, string[]>);

/** The selected row of the sidebar section File explorer: a path relative to the root, and whether the path is a folder. */
export type FilesPanelSelection = {
  /** The path of the file or of the folder. */
  path: string;
  /** True when the selected path is a folder. */
  isFolder: boolean;
};

/** Sidebar section File explorer: the file or the folder that the developer clicked last, by workspace identifier. */
export const filesPanelSelections = reactive({} as Record<string, FilesPanelSelection>);

/**
 * Sidebar section File explorer: the first level of each unfolded folder that Git ignores, by path of the folder
 * relative to the root. A folder ends with "/". Git does not list these files, so the program reads them from the disk
 * when the developer unfolds the folder (issue #430).
 */
export const filesPanelIgnoredChildren = reactive({} as Record<string, string[]>);

/** True when the path is a folder that Git ignores, or is inside such a folder. */
export function isInIgnoredFolder(path: string): boolean {
  for (const entry of files.ignored) {
    if (entry.endsWith("/") === false) {
      continue;
    }
    const folder = entry.slice(0, -1);
    if (path === folder || path.startsWith(`${folder}/`)) {
      return true;
    }
  }
  return false;
}

/**
 * Reads the first level of one folder that Git ignores, and keeps it in `filesPanelIgnoredChildren`.
 * @param path - The path of the folder, relative to the root.
 * @returns True when the folder was read. False when it cannot be read, for example because it was removed: the folder
 * is then forgotten.
 */
export async function loadIgnoredFolder(path: string): Promise<boolean> {
  const root = files.root;
  try {
    const names = await invoke<string[]>("folder_children", { root, path });
    if (root === files.root) {
      filesPanelIgnoredChildren[path] = names;
    }
    return true;
  } catch {
    delete filesPanelIgnoredChildren[path];
    return false;
  }
}

/** Reads again every unfolded folder that Git ignores, and forgets the folders that are not unfolded any more. */
export async function loadExpandedIgnoredFolders(): Promise<void> {
  const folders = [...files.expanded].filter((path) => isInIgnoredFolder(path));
  for (const path of Object.keys(filesPanelIgnoredChildren)) {
    if (folders.includes(path) === false) {
      delete filesPanelIgnoredChildren[path];
    }
  }
  await Promise.all(folders.map((path) => loadIgnoredFolder(path)));
}

let loadSeq = 0;

/** False when the project could not be shown. */
export async function loadFiles(cwd: string): Promise<boolean> {
  files.loading = true;
  files.error = "";
  const my = ++loadSeq;
  try {
    const r = await invoke<FileList>("files_list", { cwd, ignored: settings.filesShowIgnored });
    // A later request (another project) won: this answer is dropped.
    if (my !== loadSeq) return false;
    const sameRoot = r.root === files.root;
    // Large and read-only: not made deeply reactive (50 000 paths).
    Object.assign(files, {
      root: r.root,
      git: r.git,
      list: markRaw(r.files),
      ignored: markRaw(r.ignored ?? []),
      submodules: markRaw(r.submodules ?? []),
      status: markRaw(r.status),
      truncated: r.truncated,
    });
    if (!sameRoot) {
      files.expanded = new Set();
      for (const path of Object.keys(filesPanelIgnoredChildren)) {
        delete filesPanelIgnoredChildren[path];
      }
    }
    return true;
  } catch (e) {
    if (my === loadSeq) files.error = String(e);
    return false;
  } finally {
    if (my === loadSeq) files.loading = false;
  }
}

/**
 * Opens a file name seen in a terminal, such as "src/app.ts:42", in a file view pane, at its line. The path is resolved from
 * the folder of the pane.
 * @param cwd - The folder of the pane that shows the file name.
 * @param path - The path of the file, relative to the folder of the pane or absolute.
 * @param line - The line that follows the file name, or null when the file name has no line.
 */
export async function openFileRef(cwd: string | null | undefined, path: string, line: number | null = null) {
  if (!cwd) return toast(t("filesStore.unknownFolder"));
  try {
    const r = await invoke<{ root: string; path: string }>("files_resolve", { cwd, path });
    await FileViewPanes.open(`${r.root}/${r.path}`, line);
  } catch (e) {
    toast(String(e));
  }
}

// ---- Tree -----------------------------------------------------------------------

export interface TreeRow {
  path: string;
  name: string;
  depth: number;
  dir: boolean;
  /** True for a folder that Git ignores and that the tree lists as one row, without its content. */
  ignored: boolean;
  /** True for every row that Git ignores: a folder, a file, and a row inside a folder that Git ignores. */
  isGitIgnored: boolean;
  /** Git state of the file, or "•" for a folder holding changes. */
  status: string | null;
}

interface Node {
  dirs: Map<string, Node>;
  files: string[];
  /** The names, among `files`, that Git ignores. */
  ignoredFiles: Set<string>;
}

const collator = new Intl.Collator("fr", { sensitivity: "base", numeric: true });

function emptyNode(): Node {
  return { dirs: new Map(), files: [], ignoredFiles: new Set() };
}

export function buildTree(list: string[], emptyFolders: string[] = [], ignoredPaths: string[] = []): Node {
  const root = emptyNode();
  const ignoredSet = new Set(ignoredPaths);
  for (const path of list) {
    const ignoredDir = path.endsWith("/");
    const parts = (ignoredDir ? path.slice(0, -1) : path).split("/");
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      let next = node.dirs.get(parts[i]);
      if (!next) node.dirs.set(parts[i], (next = emptyNode()));
      node = next;
    }
    const last = parts[parts.length - 1];
    if (ignoredDir) {
      if (!node.dirs.has(last + "/")) node.dirs.set(last + "/", emptyNode());
    } else {
      node.files.push(last);
      if (ignoredSet.has(path)) {
        node.ignoredFiles.add(last);
      }
    }
  }
  for (const folder of emptyFolders) {
    let node = root;
    for (const part of folder.split("/")) {
      // The content of a folder that Git ignores comes from the disk, so the folder is not added a second time.
      if (node.dirs.has(part + "/")) {
        break;
      }
      let next = node.dirs.get(part);
      if (!next) node.dirs.set(part, (next = emptyNode()));
      node = next;
    }
  }
  // Sorted once here, not at every expand.
  const sortNode = (n: Node) => {
    n.files.sort(collator.compare);
    n.dirs = new Map([...n.dirs.entries()].sort((a, b) => collator.compare(a[0], b[0])));
    n.dirs.forEach(sortNode);
  };
  sortNode(root);
  return root;
}

/**
 * Visible rows: folders first, then files, A→Z; only expanded folders are opened.
 * @param tree - The tree that `buildTree` made.
 * @param expanded - The paths of the unfolded folders.
 * @param status - The Git status letter of each changed path.
 * @param ignoredChildren - When given, a folder that Git ignores unfolds, and its rows come from this record: the first
 * level of each folder, by path of the folder. When not given, a folder that Git ignores never unfolds.
 * @returns The rows to show, in order.
 */
export function visibleRows(
  tree: Node,
  expanded: Set<string>,
  status: Record<string, string>,
  ignoredChildren?: Record<string, string[]>,
): TreeRow[] {
  const changedDirs = new Set<string>();
  for (const p of Object.keys(status)) {
    const parts = p.split("/");
    for (let i = 1; i < parts.length; i++) changedDirs.add(parts.slice(0, i).join("/"));
  }
  const rows: TreeRow[] = [];
  const walkIgnoredFolder = (folder: string, depth: number) => {
    const names = ignoredChildren?.[folder] ?? [];
    const folderNames = names.filter((name) => name.endsWith("/")).map((name) => name.slice(0, -1)).sort(collator.compare);
    const fileNames = names.filter((name) => name.endsWith("/") === false).sort(collator.compare);
    for (const name of folderNames) {
      const path = `${folder}/${name}`;
      rows.push({ path, name, depth, dir: true, ignored: true, isGitIgnored: true, status: null });
      if (expanded.has(path)) {
        walkIgnoredFolder(path, depth + 1);
      }
    }
    for (const name of fileNames) {
      rows.push({ path: `${folder}/${name}`, name, depth, dir: false, ignored: false, isGitIgnored: true, status: null });
    }
  };
  const walk = (node: Node, prefix: string, depth: number) => {
    for (const name of node.dirs.keys()) {
      const ignored = name.endsWith("/");
      const clean = ignored ? name.slice(0, -1) : name;
      const path = prefix ? `${prefix}/${clean}` : clean;
      rows.push({ path, name: clean, depth, dir: true, ignored, isGitIgnored: ignored, status: changedDirs.has(path) ? "•" : null });
      if (ignored) {
        if (ignoredChildren !== undefined && expanded.has(path)) {
          walkIgnoredFolder(path, depth + 1);
        }
      } else if (expanded.has(path)) {
        walk(node.dirs.get(name)!, path, depth + 1);
      }
    }
    for (const name of node.files) {
      const path = prefix ? `${prefix}/${name}` : name;
      rows.push({ path, name, depth, dir: false, ignored: false, isGitIgnored: node.ignoredFiles.has(name), status: status[path] ?? null });
    }
  };
  walk(tree, "", 0);
  return rows;
}

export const isImage = (path: string) => /\.(png|jpe?g|gif|webp|svg|ico|bmp)$/i.test(path);
