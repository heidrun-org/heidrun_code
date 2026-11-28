<script setup lang="ts">
// The Source control sidebar section of the left sidebar, as the source control view of VS Code: the message box, the
// commit button, the group "Staged Changes", and the group "Changes". It shows only the local Git repository.
// - issue #305
import { computed, nextTick, onBeforeUnmount, reactive, ref, shallowRef, watch } from "vue";
import Icon from "./Icon.vue";
import SourceControlMenu from "./SourceControlMenu.vue";
import { currentGit, git, refreshGit } from "../stores/git";
import { buildTree, visibleRows } from "../stores/files";
import { DiffPanes } from "../stores/diff_panes";
import { FileViewPanes } from "../stores/file_view_panes";
import {
  commit,
  discardFiles,
  sourceControl,
  splitFiles,
  stageFiles,
  stashChanges,
  syncRepository,
  unstageFiles,
  writeCommitMessage,
  type CommitMode,
  type SourceControlFile,
  type SourceControlGroup,
  type SyncAction,
} from "../stores/source_control";
import { state } from "../stores/session";
import { fileIconName } from "../lib/chat_files";
import { t } from "../i18n/index";
import { settings } from "../stores/settings";

const groups = computed(() => splitFiles(currentGit.value));
/** A Source Control row, either a folder or a file with its Git status. */
type ChangeRow =
  | {
      /** The folder path relative to the repository. */
      path: string;
      /** The folder name. */
      name: string;
      /** The number of parent folders. */
      depth: number;
      /** Whether the folder is open. */
      isExpanded: boolean;
      /** Folder rows have no file. */
      file: null;
    }
  | {
      /** The file path relative to the repository. */
      path: string;
      /** The number of parent folders. */
      depth: number;
      /** The file and its Git status in this group. */
      file: SourceControlFile;
    };

const groupNames = ['staged', 'changes'] as const;
const collapsedFolders = reactive({
  staged: new Set<string>(),
  changes: new Set<string>(),
});

watch(() => state.selectedWorkspaceId, () => {
  for (const group of groupNames) {
    collapsedFolders[group].clear();
  }
});

const trees = computed(() => Object.fromEntries(groupNames.map((group) => {
  const files = new Map(groups.value[group].map((file) => [file.path, file]));
  const folders = new Set<string>();
  for (const file of files.values()) {
    const parts = file.path.split('/');
    for (let depth = 1; depth < parts.length; depth++) {
      folders.add(parts.slice(0, depth).join('/'));
    }
  }
  // File explorer receives sorted paths. Keep the same input order for names its comparison treats as equal.
  const sortedPaths = [...files.keys()].sort();
  return [group, {
    files,
    folders,
    tree: buildTree(sortedPaths),
  }] as const;
})));

const rows = computed(() => Object.fromEntries(groupNames.map((group) => {
  if (settings.sourceControlView === 'list') {
    return [group, groups.value[group].map((file): ChangeRow => ({
      file,
      path: file.path,
      depth: 0,
    }))];
  }
  const { files, folders, tree } = trees.value[group];
  const expanded = new Set([...folders].filter((path) => collapsedFolders[group].has(path) === false));
  return [group, visibleRows(tree, expanded, {}).flatMap((row): ChangeRow[] => {
    if (row.dir) {
      return [{
        file: null,
        path: row.path,
        name: row.name,
        depth: row.depth,
        isExpanded: expanded.has(row.path),
      }];
    }
    const file = files.get(row.path);
    return file === undefined ? [] : [{
      file,
      path: row.path,
      depth: row.depth,
    }];
  })];
})));

const viewItems = computed(() => [
  {
    id: 'list',
    label: t('sourceControlPanel.viewMenu.list'),
    icon: settings.sourceControlView === 'list' ? 'check2' : undefined,
  },
  {
    id: 'tree',
    label: t('sourceControlPanel.viewMenu.tree'),
    icon: settings.sourceControlView === 'tree' ? 'check2' : undefined,
  },
  {
    id: 'expandAll',
    label: t('sourceControlPanel.viewMenu.expandAll'),
    hasDividerBefore: true,
    isDisabled: settings.sourceControlView === 'list',
  },
  {
    id: 'collapseAll',
    label: t('sourceControlPanel.viewMenu.collapseAll'),
    isDisabled: settings.sourceControlView === 'list',
  },
]);

/**
 * Applies an item from the Source Control view menu.
 * @param id - The selected menu item.
 * @returns Nothing.
 */
function chooseView(id: string): void {
  if (id === 'list' || id === 'tree') {
    settings.sourceControlView = id;
    return;
  }
  for (const group of groupNames) {
    collapsedFolders[group] = new Set(id === 'collapseAll' ? trees.value[group].folders : []);
  }
}

/**
 * Opens or closes a single folder in a change group.
 * @param group - The group that contains the folder.
 * @param path - The folder path relative to the repository.
 * @returns Nothing.
 */
function toggleFolder(group: SourceControlGroup, path: string): void {
  const collapsed = collapsedFolders[group];
  if (collapsed.delete(path) === false) {
    collapsed.add(path);
  }
}

const commitStep = computed(() => {
  const progress = sourceControl.commitProgress;
  return progress?.workspaceId === state.selectedWorkspaceId ? progress.step : null;
});
const commitLabel = computed(() => t(`sourceControlPanel.${commitStep.value ?? "commit"}`));
const isCommitDisabled = computed(() => sourceControl.isBusy || sourceControl.isWritingMessage);

/** The commit message of the selected workspace. */
const message = computed({
  get: () => (state.selectedWorkspaceId === null ? "" : sourceControl.messages[state.selectedWorkspaceId] ?? ""),
  set: (text: string) => {
    if (state.selectedWorkspaceId !== null) {
      sourceControl.messages[state.selectedWorkspaceId] = text;
    }
  },
});

const placeholder = computed(() =>
  t("sourceControlPanel.messagePlaceholder", { branch: currentGit.value?.branch ?? t("sourceControlPanel.detached") }),
);

const commitItems = computed(() => [
  { id: "commit", label: t("sourceControlPanel.commitMenu.commit") },
  { id: "commitAndPush", label: t("sourceControlPanel.commitMenu.commitAndPush") },
  { id: "amend", label: t("sourceControlPanel.commitMenu.amend"), isDisabled: currentGit.value?.last_sha === null },
]);

const moreItems = computed(() => [
  { id: "pull", label: t("sourceControlPanel.moreMenu.pull", { count: currentGit.value?.behind ?? 0 }) },
  { id: "push", label: t("sourceControlPanel.moreMenu.push", { count: currentGit.value?.ahead ?? 0 }) },
  { id: "fetch", label: t("sourceControlPanel.moreMenu.fetch") },
]);

/** The class that gives a status letter its color. */
function letterClass(letter: string): string {
  if (letter === "A" || letter === "U") {
    return "added";
  }
  if (letter === "D" || letter === "!") {
    return "deleted";
  }
  if (letter === "R" || letter === "C") {
    return "renamed";
  }
  return "modified";
}

/** The tooltip of a file line: the full path, then the status in words. */
function fileTitle(file: SourceControlFile): string {
  return `${currentGit.value?.root ?? ""}/${file.path} • ${t(`sourceControlPanel.letter.${letterKey(file.letter)}`)}`;
}

/** The key of the translation of a status letter. */
function letterKey(letter: string): string {
  const keys: Record<string, string> = {
    M: "modified",
    A: "added",
    D: "deleted",
    R: "renamed",
    C: "copied",
    T: "typeChanged",
    U: "untracked",
    "!": "conflict",
  };
  return keys[letter] ?? "modified";
}

function toggleGroup(group: SourceControlGroup) {
  sourceControl.folded[group] = sourceControl.folded[group] === false;
}

function paths(group: SourceControlGroup): string[] {
  return groups.value[group].map((file) => file.path);
}

function openFile(file: SourceControlFile) {
  const root = currentGit.value?.root;
  if (root !== undefined) {
    void FileViewPanes.open(`${root}/${file.path}`);
  }
}

function openDiff(file: SourceControlFile) {
  const root = currentGit.value?.root;
  const workspaceId = state.selectedWorkspaceId;
  if (root !== undefined && workspaceId !== null) {
    void DiffPanes.openInNewTab(workspaceId, `${root}/${file.path}`);
  }
}

/** The selected file and the position of its context menu in the window. */
const fileMenu = shallowRef<{
  /** The clicked file. */
  file: SourceControlFile;
  /** The horizontal position in pixels. */
  left: number;
  /** The vertical position in pixels. */
  top: number;
} | null>(null);
const fileMenuElement = ref<HTMLElement>();
let fileMenuTrigger: HTMLButtonElement | null = null;

/**
 * Opens the file menu at the pointer or at the file button for a keyboard request.
 * @param event - The context menu event.
 * @param file - The file whose actions to show.
 * @returns Nothing.
 */
function showFileMenu(event: MouseEvent, file: SourceControlFile): void {
  const row = event.currentTarget as HTMLElement;
  fileMenuTrigger = row.querySelector<HTMLButtonElement>('.file-main');
  const bounds = fileMenuTrigger?.getBoundingClientRect();
  const isKeyboard = event.clientX === 0 && event.clientY === 0;
  const menu = {
    file,
    left: isKeyboard ? bounds?.left ?? 0 : event.clientX,
    top: isKeyboard ? bounds?.bottom ?? 0 : event.clientY,
  };
  fileMenu.value = menu;
  document.addEventListener('mousedown', dismissFileMenuOutside, true);
  document.addEventListener('keydown', dismissFileMenuOnEscape, true);
  void nextTick(() => {
    const element = fileMenuElement.value;
    if (element === undefined || fileMenu.value !== menu) {
      return;
    }
    const margin = 8;
    fileMenu.value = {
      file,
      left: Math.max(margin, Math.min(menu.left, window.innerWidth - element.offsetWidth - margin)),
      top: Math.max(margin, Math.min(menu.top, window.innerHeight - element.offsetHeight - margin)),
    };
    element.querySelector('button')?.focus();
  });
}

function closeFileMenu(): void {
  fileMenu.value = null;
  fileMenuTrigger = null;
  document.removeEventListener('mousedown', dismissFileMenuOutside, true);
  document.removeEventListener('keydown', dismissFileMenuOnEscape, true);
}

function dismissFileMenuOutside(event: MouseEvent): void {
  if (fileMenuElement.value?.contains(event.target as Node) !== true) {
    closeFileMenu();
  }
}

function dismissFileMenuOnEscape(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.stopPropagation();
    fileMenuTrigger?.focus();
    closeFileMenu();
  }
}

function chooseFileAction(action: 'diff' | 'file'): void {
  const file = fileMenu.value?.file;
  closeFileMenu();
  if (file === undefined) {
    return;
  }
  if (action === 'diff') {
    openDiff(file);
  } else {
    openFile(file);
  }
}

watch(() => state.selectedWorkspaceId, closeFileMenu);
onBeforeUnmount(closeFileMenu);

function onCommitKeyDown(event: KeyboardEvent) {
  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    void commit("commit");
  }
}

function chooseMore(id: string) {
  void syncRepository(id as SyncAction);
}

</script>

<template>
  <div class="source-control">
    <div v-if="state.selectedWorkspaceId === null" class="muted">{{ t("sourceControlPanel.selectWorkspace") }}</div>
    <template v-else-if="currentGit">
      <header class="d-flex align-items-center">
        <span class="title me-auto">{{ t("sourceControlPanel.title") }}</span>
        <button
          type="button"
          class="btn icon btn-sm icon-button"
          :aria-label="commitLabel"
          :title="commitLabel"
          :disabled="isCommitDisabled"
          @click="commit('commit')"
        >
          <span v-if="commitStep !== null" class="spinner-border spinner-sm" aria-hidden="true"></span>
          <Icon v-else name="check2" />
        </button>
        <button
          type="button"
          class="btn icon btn-sm icon-button"
          :aria-label="t('sourceControlPanel.refresh')"
          :title="t('sourceControlPanel.refresh')"
          :disabled="git.loading || sourceControl.isBusy"
          @click="refreshGit()"
        >
          <Icon name="arrow-clockwise" />
        </button>
        <SourceControlMenu
          button-class="btn icon btn-sm icon-button"
          :icon="settings.sourceControlView === 'tree' ? 'diagram-3' : 'list-ul'"
          :label="t('sourceControlPanel.viewActions')"
          :items="viewItems"
          @choose="chooseView"
        />
        <SourceControlMenu
          button-class="btn icon btn-sm icon-button"
          icon="three-dots-vertical"
          :label="t('sourceControlPanel.moreActions')"
          :items="moreItems"
          :is-disabled="sourceControl.isBusy"
          @choose="chooseMore"
        />
      </header>

      <div class="message d-flex align-items-start gap-1">
        <textarea
          v-model="message"
          class="form-control flex-fill"
          rows="1"
          :placeholder="placeholder"
          :aria-label="t('sourceControlPanel.messageLabel')"
          @keydown="onCommitKeyDown"
        ></textarea>
        <button
          type="button"
          class="btn icon btn-sm icon-button write-message"
          :aria-label="t('sourceControlPanel.writeMessage')"
          :title="t('sourceControlPanel.writeMessage')"
          :disabled="sourceControl.isWritingMessage || sourceControl.isBusy"
          @click="writeCommitMessage()"
        >
          <span v-if="sourceControl.isWritingMessage" class="spinner-border spinner-sm" role="status"></span>
          <Icon v-else name="stars" />
        </button>
      </div>

      <div class="btn-group d-flex" role="group" :aria-label="t('sourceControlPanel.commit')">
        <button
          type="button"
          class="btn btn-primary flex-fill justify-content-center"
          :disabled="isCommitDisabled"
          @click="commit('commit')"
        >
          <span v-if="commitStep !== null" class="spinner-border spinner-sm" aria-hidden="true"></span>
          <Icon v-else name="check2" />
          <span role="status">{{ commitLabel }}</span>
        </button>
        <SourceControlMenu
          button-class="btn btn-primary commit-arrow"
          icon="chevron-down"
          :label="t('sourceControlPanel.commitActions')"
          :items="commitItems"
          :is-disabled="isCommitDisabled"
          @choose="(id) => commit(id as CommitMode)"
        />
      </div>

      <div class="groups">
        <template v-for="group in groupNames" :key="group">
          <section class="group">
            <div class="group-header d-flex align-items-center" @click="toggleGroup(group)">
              <button
                type="button"
                class="list-action group-toggle d-flex align-items-center gap-2 me-auto"
                :aria-expanded="sourceControl.folded[group] === false"
              >
                <Icon :name="sourceControl.folded[group] ? 'chevron-right' : 'chevron-down'" />
                {{ t(`sourceControlPanel.group.${group}`) }}
              </button>
              <span class="hover-actions" @click.stop>
                <button
                  type="button"
                  class="btn icon btn-sm icon-button"
                  :aria-label="t('sourceControlPanel.stash')"
                  :title="t('sourceControlPanel.stash')"
                  :disabled="sourceControl.isBusy || groups[group].length === 0"
                  @click="stashChanges(group === 'staged')"
                >
                  <Icon name="archive" />
                </button>
                <button
                  v-if="group === 'changes'"
                  type="button"
                  class="btn icon btn-sm icon-button"
                  :aria-label="t('sourceControlPanel.discardAll')"
                  :title="t('sourceControlPanel.discardAll')"
                  :disabled="sourceControl.isBusy || groups.changes.length === 0"
                  @click="discardFiles(paths('changes'))"
                >
                  <Icon name="arrow-90deg-left" />
                </button>
                <button
                  v-if="group === 'changes'"
                  type="button"
                  class="btn icon btn-sm icon-button"
                  :aria-label="t('sourceControlPanel.stageAll')"
                  :title="t('sourceControlPanel.stageAll')"
                  :disabled="sourceControl.isBusy || groups.changes.length === 0"
                  @click="stageFiles(paths('changes'))"
                >
                  <Icon name="plus-lg" />
                </button>
                <button
                  v-else
                  type="button"
                  class="btn icon btn-sm icon-button"
                  :aria-label="t('sourceControlPanel.unstageAll')"
                  :title="t('sourceControlPanel.unstageAll')"
                  :disabled="sourceControl.isBusy || groups.staged.length === 0"
                  @click="unstageFiles(paths('staged'))"
                >
                  <Icon name="dash-lg" />
                </button>
              </span>
              <span class="badge count">{{ groups[group].length }}</span>
            </div>
            <ul v-if="sourceControl.folded[group] === false" class="files">
              <template v-for="row in rows[group]" :key="`${row.file === null ? 'folder' : 'file'}:${row.path}`">
                <li
                  v-if="row.file === null"
                  class="file tree-row d-flex align-items-center"
                  :style="{ '--tree-depth': row.depth }"
                >
                  <button
                    type="button"
                    class="list-action file-main tree-folder d-flex align-items-center me-auto"
                    :aria-expanded="row.isExpanded"
                    :title="row.path"
                    @click="toggleFolder(group, row.path)"
                  >
                    <Icon :name="row.isExpanded ? 'chevron-down' : 'chevron-right'" class="tree-icon" />
                    <Icon :name="row.isExpanded ? 'folder2-open' : 'folder2'" class="tree-icon" />
                    <span class="tree-folder-name">{{ row.name }}</span>
                  </button>
                </li>
                <li
                  v-else
                  class="file d-flex align-items-center"
                  :title="fileTitle(row.file)"
                  @contextmenu.prevent="showFileMenu($event, row.file)"
                  :class="{ 'tree-row tree-file': settings.sourceControlView === 'tree' }"
                  :style="settings.sourceControlView === 'tree' ? { '--tree-depth': row.depth } : undefined"
                >
                  <button type="button" class="list-action file-main d-flex align-items-center gap-2 me-auto" aria-haspopup="menu" @click="openDiff(row.file)">
                    <Icon :name="fileIconName(row.file.name)" />
                    <span class="name">{{ row.file.name }}</span>
                    <span v-if="settings.sourceControlView === 'list' && row.file.folder !== ''" class="folder">{{ row.file.folder }}</span>
                  </button>
                  <span class="hover-actions">
                    <button
                      type="button"
                      class="btn icon btn-sm icon-button"
                      :aria-label="t('sourceControlPanel.openFile')"
                      :title="t('sourceControlPanel.openFile')"
                      @click="openFile(row.file)"
                    >
                      <Icon name="file-earmark-arrow-up" />
                    </button>
                    <template v-if="group === 'changes'">
                      <button
                        type="button"
                        class="btn icon btn-sm icon-button"
                        :aria-label="t('sourceControlPanel.discard')"
                        :title="t('sourceControlPanel.discard')"
                        :disabled="sourceControl.isBusy"
                        @click="discardFiles([row.file.path])"
                      >
                        <Icon name="arrow-90deg-left" />
                      </button>
                      <button
                        type="button"
                        class="btn icon btn-sm icon-button"
                        :aria-label="t('sourceControlPanel.stage')"
                        :title="t('sourceControlPanel.stage')"
                        :disabled="sourceControl.isBusy"
                        @click="stageFiles([row.file.path])"
                      >
                        <Icon name="plus-lg" />
                      </button>
                    </template>
                    <button
                      v-else
                      type="button"
                      class="btn icon btn-sm icon-button"
                      :aria-label="t('sourceControlPanel.unstage')"
                      :title="t('sourceControlPanel.unstage')"
                      :disabled="sourceControl.isBusy"
                      @click="unstageFiles([row.file.path])"
                    >
                      <Icon name="dash-lg" />
                    </button>
                  </span>
                  <span class="letter" :class="letterClass(row.file.letter)">{{ row.file.letter }}</span>
                </li>
              </template>
            </ul>
          </section>
        </template>

      </div>
      <Teleport to="body">
        <div
          v-if="fileMenu !== null"
          ref="fileMenuElement"
          class="menu show position-fixed"
          role="menu"
          :aria-label="fileTitle(fileMenu.file)"
          :style="{ top: `${fileMenu.top}px`, left: `${fileMenu.left}px` }"
        >
          <button type="button" class="menu-item" role="menuitem" @click="chooseFileAction('diff')">
            {{ t('sourceControlPanel.openDiff') }}
          </button>
          <button type="button" class="menu-item" role="menuitem" @click="chooseFileAction('file')">
            {{ t('sourceControlPanel.openFileFromMenu') }}
          </button>
        </div>
      </Teleport>
    </template>
    <div v-else class="muted">{{ t("sourceControlPanel.notRepository") }}</div>
  </div>
</template>

<style scoped>
.source-control { flex: 1; min-height: 0; padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; overflow-y: auto; }
.title { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.message textarea { resize: vertical; min-height: 34px; }
.source-control :deep(.write-message) { flex: 0 0 auto; height: 34px; }
/* The commit action follows the shared primary button rules in styles.css. */
.btn-group :deep(.commit-arrow) { flex: 0 0 auto; border-left-color: var(--solid-divider); }
.groups { display: flex; flex-direction: column; gap: 4px; margin: 0 -8px; }
.group-header { height: 26px; padding: 0 8px; border-radius: 5px; cursor: pointer; }
.group-header:hover { background: var(--hover-soft); }
.group-toggle, .file-main { border: none; background: none; padding: 0; color: var(--text); font-size: var(--font-size); text-align: left; min-width: 0; }
.group-toggle { font-weight: 600; }
.count { background: var(--line-strong); color: var(--text-2); margin-left: 4px; }
/* The buttons keep their place while they are hidden, so the line does not move when the pointer comes over it. */
.hover-actions { display: inline-flex; align-items: center; visibility: hidden; }
.group-header:hover .hover-actions, .file:hover .hover-actions, .hover-actions:focus-within { visibility: visible; }
.files { list-style: none; margin: 0; padding: 0; }
.file { height: 24px; padding: 0 8px 0 24px; border-radius: 5px; }
.file:hover { background: var(--hover-soft); }
.file-main { flex: 1 1 auto; overflow: hidden; white-space: nowrap; }
.name { flex-shrink: 0; }
.tree-row {
  font-size: var(--font-size);
  --tree-icon-gap: 0.5rem;
  --tree-icon-slot: calc(1em + var(--tree-icon-gap));
  --tree-file-offset: 0px;
  padding-inline-start: calc(8px + (var(--tree-depth) + 1) * var(--tree-icon-slot) + var(--tree-file-offset));
}
.tree-file { --tree-file-offset: var(--tree-icon-slot); }
.tree-folder { column-gap: var(--tree-icon-gap); }
.tree-icon { flex: 0 0 1em; }
/* Align the visible chevron stroke with the column above it. */
.tree-icon.bi-chevron-down { transform: translateX(calc(1px - 0.09375em)); }
.tree-icon.bi-chevron-right { transform: translateX(calc(1px - 0.28125em)); }
.tree-folder-name { overflow: hidden; text-overflow: ellipsis; }
.folder { color: var(--muted); overflow: hidden; text-overflow: ellipsis; }
.letter { width: 18px; flex-shrink: 0; text-align: center; font: 600 var(--font-size) var(--mono); }
.letter.modified { color: var(--accent); }
.letter.added { color: var(--ok); }
.letter.deleted { color: var(--blocked-text); }
.letter.renamed { color: var(--done-text); }
.muted { color: var(--muted); }
.req { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; border-radius: 10px; background: var(--field); }
.req.mine { box-shadow: inset 0 0 0 1px var(--pane-ring-selected); }
.req-main { display: flex; flex-direction: column; gap: 4px; border: none; background: none; padding: 0; text-align: left; color: var(--text); }
.req-top { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.ref { color: var(--question); font-size: var(--font-size); }
.req-title { font-size: var(--font-size); font-weight: 500; }
.req-actions { display: flex; gap: 14px; }
.merge.ready { color: var(--question); }
.err { font-size: var(--font-size); color: var(--fail); }
.muted { font-size: var(--font-size); color: var(--muted); }
</style>
