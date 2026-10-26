<script setup lang="ts">
// The File explorer sidebar section of the left sidebar: the whole folder tree of the Git repository of the selected
// workspace. A click on a folder folds or unfolds it. A click on a file opens it in the Files window. The only
// changes that the section makes are a new empty file and a new empty folder. It has no button to rename, move,
// delete, or edit a file. A right click on the row of a file or of a folder opens a context menu that copies the
// absolute path or the relative path to the clipboard, and starts a chat about the file. The option "Ignored files" of
// the menu shows the files and the folders that Git ignores, in the muted color. A folder that Git ignores unfolds one
// level at a time.
// - issue #349
// - issue #383
// - issue #430
// - issue #443
// - issue #854
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import Icon from "./Icon.vue";
import SourceControlMenu from "./SourceControlMenu.vue";
import { currentGit, openGitModal } from "../stores/git";
import {
  buildTree,
  files,
  filesPanelIgnoredChildren,
  filesPanelNewFolders,
  filesPanelSelections,
  isInIgnoredFolder,
  loadExpandedIgnoredFolders,
  loadFiles,
  loadIgnoredFolder,
  openFiles,
  visibleRows,
  type TreeRow,
} from "../stores/files";
import { FileViewPanes } from "../stores/file_view_panes";
import { state, toast } from "../stores/session";
import { settings } from "../stores/settings";
import { chatAboutFile } from "../stores/chat_open";
import { fileIconName } from "../lib/chat_files";
import { copy } from "../lib/clipboard";
import { t } from "../i18n/index";

/** The selected row of the selected workspace, or null. Each workspace has its own selected row. */
const selection = computed(() => (state.selectedWorkspaceId === null ? null : filesPanelSelections[state.selectedWorkspaceId] ?? null));

/** Selects a row of the selected workspace, or selects nothing when the path is null. */
function select(path: string | null, isFolder: boolean) {
  const workspaceId = state.selectedWorkspaceId;
  if (workspaceId === null) {
    return;
  }
  if (path === null) {
    delete filesPanelSelections[workspaceId];
    return;
  }
  filesPanelSelections[workspaceId] = { path, isFolder };
}

const tree = computed(() => buildTree(
  files.list,
  [...(filesPanelNewFolders[files.root] ?? []), ...files.submodules],
  files.ignored,
));
const rows = computed(() => visibleRows(tree.value, files.expanded, files.status, filesPanelIgnoredChildren));

/** The width in pixels that each level of a folder adds at the left of a row, for each choice of the menu. */
const INDENT_WIDTHS = { small: 12, medium: 20, large: 28 } as const;

/** The height in pixels of a row, for each choice of the menu. */
const ROW_HEIGHTS = { compact: 24, comfortable: 30 } as const;

const indentWidth = computed(() => INDENT_WIDTHS[settings.filesPanelIndent]);
const rowHeight = computed(() => ROW_HEIGHTS[settings.filesPanelRowHeight]);

/** The mark that the menu puts before the choice that is on. */
function mark(isOn: boolean): string {
  return isOn ? "✓ " : "\u2003";
}

/**
 * The items of the menu of the three dots: the indentation, the row height, the indent guides, and the ignored files.
 * A separator line sits between two groups.
 */
const menuItems = computed(() => [
  { id: "indentTitle", label: t("filesPanel.menu.indent"), isDisabled: true },
  ...(["small", "medium", "large"] as const).map((choice) => ({
    id: `indent:${choice}`,
    label: mark(settings.filesPanelIndent === choice) + t(`filesPanel.menu.indent.${choice}`),
  })),
  { id: "rowHeightTitle", label: t("filesPanel.menu.rowHeight"), isDisabled: true, hasDividerBefore: true },
  ...(["compact", "comfortable"] as const).map((choice) => ({
    id: `rowHeight:${choice}`,
    label: mark(settings.filesPanelRowHeight === choice) + t(`filesPanel.menu.rowHeight.${choice}`),
  })),
  { id: "guidesTitle", label: t("filesPanel.menu.guides"), isDisabled: true, hasDividerBefore: true },
  { id: "guides:on", label: mark(settings.filesPanelIndentGuides) + t("filesPanel.menu.guides.on") },
  { id: "guides:off", label: mark(settings.filesPanelIndentGuides === false) + t("filesPanel.menu.guides.off") },
  { id: "ignoredTitle", label: t("filesPanel.menu.ignored"), isDisabled: true, hasDividerBefore: true },
  { id: "ignored:on", label: mark(settings.filesShowIgnored) + t("filesPanel.menu.ignored.on") },
  { id: "ignored:off", label: mark(settings.filesShowIgnored === false) + t("filesPanel.menu.ignored.off") },
]);

function chooseMenuItem(id: string) {
  const [name, choice] = id.split(":");
  if (name === "indent") {
    settings.filesPanelIndent = choice as typeof settings.filesPanelIndent;
  } else if (name === "rowHeight") {
    settings.filesPanelRowHeight = choice as typeof settings.filesPanelRowHeight;
  } else if (name === "guides") {
    settings.filesPanelIndentGuides = choice === "on";
  } else if (name === "ignored") {
    settings.filesShowIgnored = choice === "on";
  }
}

/**
 * Reads the tree again, then forgets the new empty folders that do not exist any more on the disk, for example after the
 * developer removed them in the Finder or in a terminal.
 */
async function loadTree(root: string) {
  await loadFiles(root);
  await loadExpandedIgnoredFolders();
  const remembered = filesPanelNewFolders[files.root] ?? [];
  if (remembered.length === 0) {
    return;
  }
  try {
    filesPanelNewFolders[files.root] = await invoke<string[]>("dirs_existing", { root: files.root, paths: remembered });
  } catch {
    // The folders stay in the list when the backend cannot answer: the next reading tries again.
  }
}

/** Unfolds the folders above the selected row, so that the selected row shows after the tree is read again. */
function revealSelection() {
  const path = selection.value?.path ?? null;
  if (path === null || path.includes("/") === false) {
    return;
  }
  const parts = path.split("/");
  const folders = new Set(files.expanded);
  for (let index = 1; index < parts.length; index++) {
    folders.add(parts.slice(0, index).join("/"));
  }
  files.expanded = folders;
}

// The tree is read again when the repository changes, and when the number of changed files changes. When the
// repository changes, the folders above the selected row of the new workspace unfold.
watch(
  () => [currentGit.value?.root, currentGit.value?.changed, currentGit.value?.untracked],
  ([root], previous) => {
    if (typeof root !== "string") {
      return;
    }
    const isAnotherRepository = previous === undefined || previous[0] !== root;
    void loadTree(root).then(() => {
      if (isAnotherRepository) {
        revealSelection();
        void loadExpandedIgnoredFolders();
      }
    });
  },
  { immediate: true },
);

// The tree is read again when the developer shows or hides the files that Git ignores. A selected row inside a folder
// that Git ignores disappears with the option, so the selection is cleared and a new file does not go into a hidden folder.
watch(
  () => settings.filesShowIgnored,
  (isShown) => {
    const path = selection.value?.path ?? null;
    if (isShown === false && path !== null && isInIgnoredFolder(path)) {
      select(null, false);
    }
    refresh();
  },
);

/** The folder that a new file or a new folder goes into: the selected folder, or the folder of the selected file. */
const targetFolder = computed(() => {
  const selected = selection.value?.path ?? null;
  if (selected === null) {
    return "";
  }
  if (selection.value?.isFolder === true) {
    return selected;
  }
  return selected.includes("/") ? selected.slice(0, selected.lastIndexOf("/")) : "";
});

/** The name that the developer is typing for a new file or a new folder, or null when no name is being typed. */
const naming = ref<{ kind: "file" | "dir"; value: string; folder: string } | null>(null);
let nameInput: HTMLInputElement | null = null;

/** One entry of the list under the header: a row of the tree, or the box where the developer types a new name. */
type ListEntry = { type: "row"; row: TreeRow } | { type: "naming"; depth: number };

/** The rows, with the name box as the first child of the folder that receives the new file or the new folder. */
const entries = computed((): ListEntry[] => {
  const list: ListEntry[] = rows.value.map((row) => ({ type: "row", row }));
  const current = naming.value;
  if (current === null) {
    return list;
  }
  const depth = current.folder === "" ? 0 : current.folder.split("/").length;
  const folderIndex = rows.value.findIndex((row) => row.dir && row.path === current.folder);
  list.splice(current.folder === "" ? 0 : folderIndex + 1, 0, { type: "naming", depth });
  return list;
});

function setNameInput(element: unknown) {
  nameInput = element as HTMLInputElement | null;
}

function startNaming(kind: "file" | "dir") {
  const folder = targetFolder.value;
  const folders = new Set(files.expanded);
  const parts = folder === "" ? [] : folder.split("/");
  for (let index = 1; index <= parts.length; index++) {
    folders.add(parts.slice(0, index).join("/"));
  }
  files.expanded = folders;
  naming.value = { kind, value: "", folder };
  void nextTick(() => nameInput?.focus());
}

function cancelNaming() {
  naming.value = null;
}

async function submitNaming() {
  const current = naming.value;
  if (current === null) {
    return;
  }
  const name = current.value.trim();
  if (name === "") {
    naming.value = null;
    return;
  }
  if (name.includes("/")) {
    toast(t("filesPanel.nameHasSlash"), "error");
    void nextTick(() => nameInput?.focus());
    return;
  }
  const path = current.folder === "" ? name : `${current.folder}/${name}`;
  try {
    await invoke("file_create", { root: files.root, path, dir: current.kind === "dir" });
  } catch (error) {
    toast(String(error), "error");
    void nextTick(() => nameInput?.focus());
    return;
  }
  naming.value = null;
  const folders = new Set(files.expanded);
  if (current.kind === "dir") {
    folders.add(path);
    // A new folder inside a folder that Git ignores shows from the disk, so the tree does not remember it.
    if (isInIgnoredFolder(path) === false) {
      filesPanelNewFolders[files.root] = [...(filesPanelNewFolders[files.root] ?? []), path];
    }
  }
  files.expanded = folders;
  select(path, current.kind === "dir");
  await loadTree(files.root);
  if (current.kind === "file") {
    openGitModal(path);
  }
}

/** A click on the empty space of the section selects nothing: a new file or a new folder then goes to the root. */
function clearSelection() {
  select(null, false);
}

function collapseAll() {
  files.expanded = new Set();
}

function refresh() {
  const root = currentGit.value?.root;
  if (root !== undefined) {
    void loadTree(root);
  }
}

/**
 * Folds or unfolds a folder. A folder that Git ignores unfolds after the program reads its first level from the disk.
 * @param row - The row of the folder.
 */
async function toggleFolder(row: TreeRow) {
  if (files.expanded.has(row.path)) {
    const folded = new Set(files.expanded);
    folded.delete(row.path);
    files.expanded = folded;
    return;
  }
  if (row.isGitIgnored && (await loadIgnoredFolder(row.path)) === false) {
    toast(t("filesPanel.cannotReadFolder"), "error");
    return;
  }
  const unfolded = new Set(files.expanded);
  unfolded.add(row.path);
  files.expanded = unfolded;
}

function chooseRow(row: TreeRow) {
  select(row.path, row.dir);
  if (row.dir) {
    toggleFolder(row);
    return;
  }
  void openFileInPane(row.path);
}

/**
 * Shows a file in a file view pane, read only. Without a selected pane to put it next to, the Files window opens the file.
 * Issue: https://github.com/heidrun-org/heidrun/issues/714
 */
async function openFileInPane(path: string) {
  if (await FileViewPanes.open(`${files.root}/${path}`)) {
    return;
  }
  await openFiles(files.root, { path });
}

/** The context menu of a file row or a folder row: the relative path, and where the pointer was. Null when closed. */
const fileMenu = ref<{ path: string; top: number; left: number } | null>(null);
const fileMenuElement = ref<HTMLElement>();

/** The space in pixels that the context menu keeps between itself and the edge of the window. */
const FILE_MENU_MARGIN = 8;

/** Opens the context menu at the pointer for the row of a file or of a folder, and hides the default context menu. */
function openFileMenu(event: MouseEvent, row: TreeRow) {
  event.preventDefault();
  fileMenu.value = { path: row.path, top: event.clientY, left: event.clientX };
  document.addEventListener("mousedown", onDocumentMouseDown, true);
  document.addEventListener("keydown", onDocumentKeyDown, true);
  void nextTick(() => {
    const menuElement = fileMenuElement.value;
    const current = fileMenu.value;
    if (menuElement === undefined || current === null) {
      return;
    }
    // The context menu stays inside the window, whatever the place of the pointer.
    fileMenu.value = {
      ...current,
      top: Math.max(FILE_MENU_MARGIN, Math.min(current.top, window.innerHeight - menuElement.offsetHeight - FILE_MENU_MARGIN)),
      left: Math.max(FILE_MENU_MARGIN, Math.min(current.left, window.innerWidth - menuElement.offsetWidth - FILE_MENU_MARGIN)),
    };
  });
}

/** Closes the context menu. */
function closeFileMenu() {
  fileMenu.value = null;
  document.removeEventListener("mousedown", onDocumentMouseDown, true);
  document.removeEventListener("keydown", onDocumentKeyDown, true);
}

/** Closes the context menu on a click outside the context menu. */
function onDocumentMouseDown(event: MouseEvent) {
  if (fileMenuElement.value?.contains(event.target as Node) === true) {
    return;
  }
  closeFileMenu();
}

/** Closes the context menu on the key Escape. */
function onDocumentKeyDown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.stopPropagation();
    closeFileMenu();
  }
}

/** Puts the absolute path or the relative path of the row of the context menu on the clipboard, and closes the menu. */
async function copyPath(kind: "absolute" | "relative") {
  const relativePath = fileMenu.value?.path ?? null;
  closeFileMenu();
  if (relativePath === null) {
    return;
  }
  let text = relativePath;
  if (kind === "absolute") {
    try {
      text = await invoke<string>("file_full_path", { root: files.root, path: relativePath });
    } catch (error) {
      toast(String(error), "error");
      return;
    }
  }
  await copy(text);
  toast(t("filesPanel.copied", { path: text }));
}

/**
 * Starts a coding agent in a new tab of the selected workspace, with the first message "Let's chat about <absolute path>"
 * for the row of the context menu, and closes the menu. The new tab has the name of the file.
 * Issue: https://github.com/heidrun-org/heidrun_code/issues/854
 */
async function chatAboutRow() {
  const relativePath = fileMenu.value?.path ?? null;
  closeFileMenu();
  if (relativePath === null) {
    return;
  }
  let absolutePath: string;
  try {
    absolutePath = await invoke<string>("file_full_path", { root: files.root, path: relativePath });
  } catch (error) {
    toast(String(error), "error");
    return;
  }
  await chatAboutFile(absolutePath, relativePath.split("/").pop() ?? relativePath, files.root);
}

onBeforeUnmount(closeFileMenu);

/** The icon of a row: a folder that is closed or open, or the kind of the file. */
function rowIcon(row: TreeRow): string {
  if (row.dir) {
    if (files.submodules.includes(row.path)) {
      return "file-submodule";
    }
    return files.expanded.has(row.path) ? "folder2-open" : "folder2";
  }
  return fileIconName(row.name);
}

/** The name of the arrow of a folder row. A file row has no arrow, but it keeps the space of the arrow. */
function arrowIcon(row: TreeRow): string | null {
  if (row.dir === false) {
    return null;
  }
  return files.expanded.has(row.path) ? "chevron-down" : "chevron-right";
}

/** The class that gives a status letter its color. */
function letterClass(letter: string): string {
  if (letter === "A" || letter === "?") {
    return "added";
  }
  if (letter === "D") {
    return "deleted";
  }
  if (letter === "R") {
    return "renamed";
  }
  return "modified";
}
</script>

<template>
  <div class="files-panel" @click.self="clearSelection">
    <div v-if="state.selectedWorkspaceId === null" class="muted">{{ t("filesPanel.selectWorkspace") }}</div>
    <template v-else-if="currentGit">
      <header class="panel-header d-flex align-items-center">
        <span class="title me-auto">{{ t("filesPanel.title") }}</span>
        <button
          type="button"
          class="btn icon btn-sm icon-button"
          :aria-label="t('filesPanel.newFile')"
          :title="t('filesPanel.newFile')"
          @click="startNaming('file')"
        >
          <Icon name="file-earmark-plus" />
        </button>
        <button
          type="button"
          class="btn icon btn-sm icon-button"
          :aria-label="t('filesPanel.newFolder')"
          :title="t('filesPanel.newFolder')"
          @click="startNaming('dir')"
        >
          <Icon name="folder-plus" />
        </button>
        <button
          type="button"
          class="btn icon btn-sm icon-button"
          :aria-label="t('filesPanel.refresh')"
          :title="t('filesPanel.refresh')"
          :disabled="files.loading"
          @click="refresh()"
        >
          <Icon name="arrow-clockwise" />
        </button>
        <button
          type="button"
          class="btn icon btn-sm icon-button"
          :aria-label="t('filesPanel.collapseAll')"
          :title="t('filesPanel.collapseAll')"
          @click="collapseAll()"
        >
          <Icon name="dash-square" />
        </button>
        <SourceControlMenu
          button-class="btn btn-sm icon-button"
          icon="three-dots-vertical"
          :label="t('filesPanel.menu.label')"
          :items="menuItems"
          @choose="chooseMenuItem"
        />
      </header>
      <div v-if="files.error !== ''" class="error">{{ files.error }}</div>
      <ul v-else class="rows" @click.self="clearSelection" :style="{ '--row-height': `${rowHeight}px`, '--indent-width': `${indentWidth}px` }">
        <template v-for="entry in entries" :key="entry.type === 'row' ? entry.row.path + (entry.row.dir ? '/' : '') : 'naming'">
          <li v-if="entry.type === 'naming' && naming !== null" class="naming-row d-flex align-items-center">
            <template v-if="settings.filesPanelIndentGuides">
              <span v-for="level in entry.depth" :key="level" class="guide"></span>
            </template>
            <span v-else :style="{ width: `${entry.depth * indentWidth}px` }" class="flex-shrink-0"></span>
            <span class="arrow"></span>
            <Icon :name="naming.kind === 'dir' ? 'folder2' : 'file-earmark'" class="kind" />
            <input
              :ref="setNameInput"
              v-model="naming.value"
              class="form-control form-control-sm"
              spellcheck="false"
              :aria-label="naming.kind === 'dir' ? t('filesPanel.newFolder') : t('filesPanel.newFile')"
              @keydown.enter.prevent="submitNaming"
              @keydown.esc.prevent="cancelNaming"
              @blur="cancelNaming"
            />
          </li>
          <li v-else-if="entry.type === 'row'">
            <button
              type="button"
              class="row list-action d-flex align-items-center text-start"
              :class="{ selected: entry.row.path === selection?.path, ignored: entry.row.isGitIgnored }"
              :title="entry.row.path"
              :aria-expanded="entry.row.dir ? files.expanded.has(entry.row.path) : undefined"
              @click="chooseRow(entry.row)"
              @contextmenu="openFileMenu($event, entry.row)"
            >
              <template v-if="settings.filesPanelIndentGuides">
                <span v-for="level in entry.row.depth" :key="level" class="guide"></span>
              </template>
              <span v-else :style="{ width: `${entry.row.depth * indentWidth}px` }" class="flex-shrink-0"></span>
              <span class="arrow">
                <Icon v-if="arrowIcon(entry.row) !== null" :name="arrowIcon(entry.row) ?? ''" />
              </span>
              <Icon :name="rowIcon(entry.row)" class="kind" />
              <span class="name me-auto">{{ entry.row.name }}</span>
              <span v-if="entry.row.status !== null && entry.row.dir" class="letter modified">•</span>
              <span v-else-if="entry.row.status !== null" class="letter" :class="letterClass(entry.row.status)">{{ entry.row.status === "?" ? "U" : entry.row.status }}</span>
            </button>
          </li>
        </template>
      </ul>
      <div v-if="files.truncated" class="muted">{{ t("filesPanel.truncated") }}</div>
    </template>
    <div v-else class="muted">{{ t("filesPanel.notRepository") }}</div>
    <Teleport to="body">
      <div
        v-if="fileMenu !== null"
        ref="fileMenuElement"
        class="menu show position-fixed"
        role="menu"
        :aria-label="t('filesPanel.fileMenu.label')"
        :style="{ top: `${fileMenu.top}px`, left: `${fileMenu.left}px` }"
      >
        <button type="button" class="menu-item" role="menuitem" @click="copyPath('absolute')">
          {{ t("filesPanel.fileMenu.copyAbsolutePath") }}
        </button>
        <button type="button" class="menu-item" role="menuitem" @click="copyPath('relative')">
          {{ t("filesPanel.fileMenu.copyRelativePath") }}
        </button>
        <div class="menu-divider" role="separator"></div>
        <button type="button" class="menu-item" role="menuitem" @click="chatAboutRow()">
          {{ t("filesPanel.fileMenu.chatAboutFile") }}
        </button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.files-panel { flex: 1; min-height: 0; padding: 0 8px 12px; display: flex; flex-direction: column; gap: 8px; overflow-y: auto; }
/* The header stays at the top while the rows scroll under it. Its own padding replaces the top padding of the panel, so no row shows above it. */
.panel-header { position: sticky; top: 0; z-index: 2; padding: 12px 0 8px; background: var(--side); }
.title { font-weight: 600; padding-left: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.files-panel :deep(.icon-button) { height: 22px; padding: 0 5px; color: var(--muted); border: none; }
.files-panel :deep(.icon-button:hover:not(:disabled)) { background: var(--hover); color: var(--text); }
.rows { list-style: none; margin: 0; padding: 0; }
.row { width: 100%; height: var(--row-height); padding: 0 8px; border: none; border-radius: 5px; color: var(--text); font-size: var(--font-size); white-space: nowrap; }
.row:hover { background: var(--files-row-hover); }
.row.ignored { color: var(--muted); }
/* The selected row is darker than a row under the pointer, and has a blue line, as the selected row of VS Code. */
.row.selected { background: var(--line-strong); box-shadow: inset 0 0 0 1px var(--done); }
/* One guide for each level: its line sits under the arrow of the folder of that level. */
.guide { position: relative; flex: 0 0 var(--indent-width); align-self: stretch; }
.guide::before { content: ""; position: absolute; left: 7px; top: 0; bottom: 0; border-left: 1px solid var(--line); }
.arrow { flex: 0 0 16px; width: 16px; display: inline-flex; justify-content: center; color: var(--muted); }
.kind { flex: 0 0 auto; margin-right: 6px; color: var(--muted); }
.name { overflow: hidden; text-overflow: ellipsis; }
.letter { width: 18px; flex-shrink: 0; text-align: center; font: 600 var(--font-size) var(--mono); }
.letter.modified { color: var(--accent); }
.letter.added { color: var(--ok); }
.letter.deleted { color: var(--blocked-text); }
.letter.renamed { color: var(--done-text); }
.naming-row { height: var(--row-height); padding: 0 8px; }
.naming-row .form-control { flex: 1 1 auto; min-width: 0; }
.error { font-size: var(--font-size); color: var(--fail); }
.muted { font-size: var(--font-size); color: var(--muted); padding: 0 8px; }
</style>
