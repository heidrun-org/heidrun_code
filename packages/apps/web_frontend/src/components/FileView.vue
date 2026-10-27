<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import CodeEditor from "./CodeEditor.vue";
import FileViewMenu from "./FileViewMenu.vue";
import { FileViewLabel } from "../lib/file_view_label";
import { FrontMatter } from "../lib/front_matter";
import { isMarkdown, renderMarkdown } from "../lib/markdown";
import { MarkdownLinks } from "../lib/markdown_links";
import { isImage } from "../stores/files";
import { fileViewEdits, FileViewEditState } from "../stores/file_view_edit_state";
import { FileViewEdits } from "../stores/file_view_edits";
import { fileViewAnchorRequests, fileViewLineRequests, FileViewPanes } from "../stores/file_view_panes";
import { FileViewAgentPrompt, type FileViewAgentRequest } from "../stores/file_view_agent_prompt";
import { toast } from "../stores/session";
import type { EditorSelection } from "../lib/editor";
import { settings } from "../stores/settings";
import { codeThemeClass } from "../stores/theme";
import type { AgentInfo } from "../lib/types";
import { t } from "../i18n/index";

// The body of a file view pane: the file of the label of the pane. The developer types in a text file at once, and saves it
// with ⌘S or with the button "Save", which shows only while the file has unsaved changes. An image, a Markdown preview, and a
// file that cannot be edited (binary, too large, not UTF-8) stay read only. The selected lines can go to the coding agent of
// the tab, to explain them or to fix them. The controls of the pane are written here, because they work on the state of the
// file, and they are shown in the header of the pane: the header gives the element `controlsHost`, and the controls are
// teleported into it. The backend watches the file, and the pane shows the new content when the file changes on the disk.
// Issues: https://github.com/heidrun-org/heidrun/issues/714, https://github.com/heidrun-org/heidrun/issues/784,
// https://github.com/heidrun-org/heidrun_code/issues/898, https://github.com/heidrun-org/heidrun_code/issues/899, and
// https://github.com/heidrun-org/heidrun_code/issues/901, and https://github.com/heidrun-org/heidrun_code/issues/931
const props = defineProps<{
  pane: AgentInfo;
  /** The element of the header of the pane that holds the controls, or null while the header is not drawn yet. */
  controlsHost: HTMLElement | null;
}>();

/** The project of the file and the path inside it, as the backend resolves them. */
type FileLocation = { root: string; path: string };
/** The fingerprint of a file on the disk now, or null when the file is gone. */
type FileStamp = { hash: string | null };

const absolutePath = computed(() => FileViewLabel.parse(props.pane.label));
const isMarkdownFile = computed(() => isMarkdown(absolutePath.value));
const isPreview = computed(() => isMarkdownFile.value && settings.filesMdRead);
const location = ref<FileLocation | null>(null);
const text = ref("");
const rendered = ref("");
/** The front matter block of a Markdown file in Preview mode, shown in a card above the rendered text, or null. */
const frontMatter = ref<string | null>(null);
const image = ref("");
const error = ref("");
const isLoading = ref(false);
/** True when the file of a pane with no edit (a preview, an image, a read only file) was deleted on the disk. */
const isDeleted = ref(false);
/** True for a few seconds after the pane read the new content of a file that changed on the disk (issue #931). */
const isChangedOnDisk = ref(false);
const editor = ref<InstanceType<typeof CodeEditor> | null>(null);
/** "preview" or "raw": the display of a Markdown file, saved in the setting `filesMdRead`. */
const markdownMode = computed({
  get: () => (settings.filesMdRead ? "preview" : "raw"),
  set: (mode: string) => {
    settings.filesMdRead = mode === "preview";
  },
});
const markdownModeName = `file-view-markdown-mode-${useId()}`;
/** The Markdown preview uses the whole width of the pane, or a column of about 80 characters (issue 897). */
const markdownWidthClass = computed(() => (settings.markdownWrapAt80Columns ? "wrap-at-80-columns" : "full"));
const isCodeShown = computed(() => isLoading.value === false && error.value === "" && image.value === "" && isPreview.value === false);
/** The reason why the file cannot be edited, for example a binary file, or an empty text when it can be edited. */
const readOnlyReason = ref("");
/** The edit of the pane, when the file of the pane can be edited and is shown as code. */
const edit = computed(() => {
  const current = fileViewEdits[props.pane.pane_id];
  if (current === undefined || location.value === null || current.path !== location.value.path || current.root !== location.value.root) {
    return null;
  }
  return current;
});
const isEditable = computed(() => isCodeShown.value && edit.value !== null);
const isDirty = computed(() => edit.value !== null && FileViewEditState.isDirty(props.pane.pane_id));
/** The line that the pane must show, from a file name in a terminal or from a search result (issue #898). */
const lineRequest = computed(() => (absolutePath.value === null ? null : fileViewLineRequests[absolutePath.value] ?? null));
/** The selected lines of the editor, with the place of the bar of actions in the body of the pane, or null. */
const selection = ref<{ fromLine: number; toLine: number; text: string; left: number; top: number } | null>(null);
const body = ref<HTMLElement>();
const markdownArticle = ref<HTMLElement>();
let sequence = 0;

// An answer that comes after the path or the mode changed again is dropped.
async function load() {
  const mine = ++sequence;
  text.value = "";
  rendered.value = "";
  frontMatter.value = null;
  image.value = "";
  error.value = "";
  isDeleted.value = false;
  isChangedOnDisk.value = false;
  readOnlyReason.value = "";
  selection.value = null;
  location.value = null;
  const path = absolutePath.value;
  if (path === null) {
    return;
  }
  isLoading.value = true;
  try {
    const resolved = await invoke<FileLocation>("files_resolve", { cwd: props.pane.cwd || props.pane.foreground_cwd, path });
    if (mine !== sequence) {
      return;
    }
    location.value = resolved;
    if (isImage(resolved.path)) {
      const url = await invoke<string>("file_image", { root: resolved.root, path: resolved.path });
      if (mine === sequence) {
        image.value = url;
      }
      return;
    }
    if (isPreview.value) {
      // Unsaved changes of the same file show in the preview too.
      const kept = fileViewEdits[props.pane.pane_id];
      const isKept = kept !== undefined && kept.root === resolved.root && kept.path === resolved.path;
      const content = isKept ? kept.current : await invoke<string>("git_file", { root: resolved.root, path: resolved.path, rev: null });
      if (mine !== sequence) {
        return;
      }
      const split = FrontMatter.split(content.replace(/\n$/, ""));
      frontMatter.value = split.frontMatter;
      rendered.value = renderMarkdown(split.body);
      return;
    }
    try {
      await FileViewEdits.load(props.pane.pane_id, resolved.root, resolved.path);
      return;
    } catch (editError) {
      if (mine !== sequence) {
        return;
      }
      readOnlyReason.value = String(editError);
    }
    const content = (await invoke<string>("git_file", { root: resolved.root, path: resolved.path, rev: null })).replace(/\n$/, "");
    if (mine === sequence) {
      text.value = content;
    }
  } catch (e) {
    if (mine === sequence) {
      error.value = String(e);
    }
  } finally {
    if (mine === sequence) {
      isLoading.value = false;
    }
  }
}
watch([absolutePath, isPreview], load, { immediate: true });

// A link of another Markdown preview asked for a heading of this file: the preview shows it once the text is rendered (issue #928).
watch(
  [rendered, isLoading, () => (absolutePath.value === null ? undefined : fileViewAnchorRequests[absolutePath.value])],
  async () => {
    const path = absolutePath.value;
    if (path === null || isLoading.value === true || rendered.value === "") {
      return;
    }
    const anchor = fileViewAnchorRequests[path];
    if (anchor === undefined) {
      return;
    }
    delete fileViewAnchorRequests[path];
    await nextTick();
    scrollToAnchor(anchor);
  },
  { flush: "post" },
);

// A line asked again for the file that the pane shows already: the editor goes to it.
watch(
  () => lineRequest.value?.sequence,
  () => {
    if (lineRequest.value !== null) {
      editor.value?.goToLine(lineRequest.value.line);
    }
  },
);

// The backend watches the file of the pane, and says when it changes on the disk: a coding agent may write it (issue #931).
const watchId = FileViewEdits.newWatchId();
const watchedFile = computed(() => (location.value === null ? null : `${location.value.root}\n${location.value.path}`));
watch(watchedFile, () => {
  if (location.value === null) {
    void invoke("file_watch_stop", { watchId }).catch(() => {});
    return;
  }
  void invoke("file_watch_start", { watchId, root: location.value.root, path: location.value.path }).catch(() => {});
});
let unlistenFileChanged: UnlistenFn | null = null;
let isUnmounted = false;
let fileChangedTimer = 0;
let changedOnDiskTimer = 0;
onMounted(async () => {
  const unlisten = await listen<{ watchId: string }>("file-changed", (event) => {
    if (event.payload.watchId !== watchId) {
      return;
    }
    // One write gives several events: the pane looks at the disk once, when they stop.
    window.clearTimeout(fileChangedTimer);
    fileChangedTimer = window.setTimeout(() => void onFileChanged(), 150);
  });
  if (isUnmounted) {
    unlisten();
    return;
  }
  unlistenFileChanged = unlisten;
});
onBeforeUnmount(() => {
  isUnmounted = true;
  unlistenFileChanged?.();
  window.clearTimeout(fileChangedTimer);
  window.clearTimeout(changedOnDiskTimer);
  void invoke("file_watch_stop", { watchId }).catch(() => {});
});

// A file without unsaved changes shows the new content, at the same place, with a short message. A file with unsaved
// changes keeps the text of the developer and shows the conflict. A save of the pane shows nothing, because the disk
// holds the fingerprint of the save.
async function onFileChanged() {
  const resolved = location.value;
  if (resolved === null || isLoading.value) {
    return;
  }
  let isChanged = false;
  if (edit.value !== null) {
    isChanged = (await FileViewEdits.check(props.pane.pane_id)) === "reloaded";
    if (isPreview.value === false) {
      showChangedOnDisk(isChanged);
      return;
    }
  } else {
    const stamp = await invoke<FileStamp>("file_stat", { root: resolved.root, path: resolved.path }).catch(() => null);
    if (stamp === null) {
      return;
    }
    isDeleted.value = stamp.hash === null;
    if (isDeleted.value) {
      return;
    }
  }
  showChangedOnDisk((await refresh()) || isChanged);
}

// Reads the content again without the state "Loading…", so the pane keeps its content and its scroll position. An edit
// is read by `FileViewEdits.check`. An answer that comes after a new load is dropped.
async function refresh(): Promise<boolean> {
  const resolved = location.value;
  const mine = sequence;
  if (resolved === null) {
    return false;
  }
  const scrollTop = body.value?.scrollTop ?? 0;
  try {
    if (image.value !== "") {
      const url = await invoke<string>("file_image", { root: resolved.root, path: resolved.path });
      if (mine !== sequence || url === image.value) {
        return false;
      }
      image.value = url;
    } else if (isPreview.value) {
      const kept = edit.value;
      const content = kept !== null ? kept.current : await invoke<string>("git_file", { root: resolved.root, path: resolved.path, rev: null });
      const split = FrontMatter.split(content.replace(/\n$/, ""));
      const html = renderMarkdown(split.body);
      if (mine !== sequence || (html === rendered.value && split.frontMatter === frontMatter.value)) {
        return false;
      }
      frontMatter.value = split.frontMatter;
      rendered.value = html;
    } else if (edit.value === null) {
      const content = (await invoke<string>("git_file", { root: resolved.root, path: resolved.path, rev: null })).replace(/\n$/, "");
      if (mine !== sequence || content === text.value) {
        return false;
      }
      text.value = content;
    } else {
      return false;
    }
  } catch {
    return false;
  }
  await nextTick();
  if (body.value !== undefined) {
    body.value.scrollTop = scrollTop;
  }
  return true;
}

function showChangedOnDisk(isChanged: boolean) {
  if (isChanged === false) {
    return;
  }
  isChangedOnDisk.value = true;
  window.clearTimeout(changedOnDiskTimer);
  changedOnDiskTimer = window.setTimeout(() => {
    isChangedOnDisk.value = false;
  }, 3000);
}

function onEditorChange(newText: string) {
  if (edit.value !== null) {
    edit.value.current = newText;
  }
}
function save(isOverwrite = false) {
  if (edit.value !== null) {
    void FileViewEdits.save(props.pane.pane_id, isOverwrite);
  }
}
async function reloadFromDisk() {
  await FileViewEdits.reload(props.pane.pane_id);
  if (isPreview.value) {
    await refresh();
  }
}
function keepMine() {
  FileViewEdits.keepMine(props.pane.pane_id);
}

// The bar of actions on the selected lines sits under the end of the selection, inside the body of the pane.
function onEditorSelection(editorSelection: EditorSelection | null) {
  const box = body.value?.getBoundingClientRect();
  if (editorSelection === null || box === undefined) {
    selection.value = null;
    return;
  }
  selection.value = {
    fromLine: editorSelection.fromLine,
    toLine: editorSelection.toLine,
    text: editorSelection.text,
    left: Math.max(8, Math.min(editorSelection.left - box.left, box.width - 330)),
    top: editorSelection.bottom - box.top + 6,
  };
}
async function askCodingAgent(request: FileViewAgentRequest) {
  const current = selection.value;
  if (current === null || location.value === null) {
    return;
  }
  const isWritten = await FileViewAgentPrompt.ask(props.pane, { path: location.value.path, fromLine: current.fromLine, toLine: current.toLine, text: current.text }, request);
  if (isWritten) {
    selection.value = null;
  }
}

async function copyPath(isAbsolute: boolean) {
  const path = isAbsolute ? absolutePath.value : location.value?.path;
  if (path === null || path === undefined) {
    return;
  }
  await writeText(path).catch(() => {});
  toast(t("fileView.copied", { path }));
}
function showInFinder() {
  if (absolutePath.value !== null) {
    revealItemInDir(absolutePath.value).catch((e) => toast(String(e)));
  }
}
async function openInVisualStudioCode() {
  if (location.value === null) {
    return;
  }
  await invoke("file_open_external", { root: location.value.root, path: location.value.path }).catch((e) => toast(String(e)));
}
// A web link of the rendered Markdown opens in the browser. A link to a heading shows the heading, and a link to a file of the
// disk opens the file in this pane, as a browser follows a link (issue #928).
function onMarkdownClick(event: MouseEvent) {
  const linkElement = (event.target as HTMLElement).closest("a");
  if (linkElement === null) {
    return;
  }
  event.preventDefault();
  const path = absolutePath.value;
  if (path === null || location.value === null) {
    return;
  }
  const target = MarkdownLinks.resolve(linkElement.getAttribute("href") ?? "", path, location.value.root);
  if (target === null) {
    return;
  }
  if (target.kind === "web") {
    openUrl(target.url).catch(() => {});
    return;
  }
  if (target.kind === "heading") {
    scrollToAnchor(target.anchor);
    return;
  }
  if (target.absolutePath === path) {
    if (target.anchor !== null) {
      scrollToAnchor(target.anchor);
    }
    return;
  }
  const line = target.anchor === null ? null : MarkdownLinks.lineOfAnchor(target.anchor);
  void FileViewPanes.open(target.absolutePath, line, line === null ? target.anchor : null);
}
// The heading of an anchor goes to the top of the pane. An anchor with no heading leaves the text where it is. Only the body
// of the pane scrolls: `scrollIntoView` also moved the window by one pixel.
function scrollToAnchor(anchor: string) {
  if (markdownArticle.value === undefined || body.value === undefined) {
    return;
  }
  const element = MarkdownLinks.findAnchor(markdownArticle.value, anchor);
  if (element !== null) {
    body.value.scrollTop += element.getBoundingClientRect().top - body.value.getBoundingClientRect().top;
  }
}
</script>

<template>
  <div class="file-view">
    <Teleport v-if="controlsHost !== null" :to="controlsHost">
      <button
        v-if="isDirty"
        type="button"
        class="btn small theme-primary text-nowrap"
        data-action="save"
        :disabled="edit?.isSaving === true"
        :title="t('fileView.saveTitle')"
        @click="save()"
      >
        {{ t("fileView.save") }}
      </button>
      <div v-if="isMarkdownFile" class="btn-group btn-group-sm" role="group" :aria-label="t('fileView.markdownLabel')">
        <label class="btn small btn-check btn-outline theme-secondary" :title="t('fileView.previewTitle')">
          <input v-model="markdownMode" type="radio" :name="markdownModeName" autocomplete="off" value="preview" />
          {{ t("fileView.preview") }}
        </label>
        <label class="btn small btn-check btn-outline theme-secondary" :title="t('fileView.rawTitle')">
          <input v-model="markdownMode" type="radio" :name="markdownModeName" autocomplete="off" value="raw" />
          {{ t("fileView.raw") }}
        </label>
      </div>
      <FileViewMenu
        :is-search-shown="isCodeShown"
        @search="editor?.openSearch()"
        @copy-path="copyPath"
        @show-in-finder="showInFinder"
        @open-in-visual-studio-code="openInVisualStudioCode"
      >
        <template #options>
          <button
            type="button"
            class="menu-item d-flex align-items-center gap-2"
            role="menuitemcheckbox"
            :aria-checked="settings.codeWrap"
            data-action="wrap-lines"
            @click="settings.codeWrap = !settings.codeWrap"
          >
            <span class="switch pe-none"><input type="checkbox" tabindex="-1" aria-hidden="true" :checked="settings.codeWrap" /></span>
            {{ t("fileView.wrap") }}
          </button>
          <button
            v-if="isMarkdownFile"
            type="button"
            class="menu-item d-flex align-items-center gap-2"
            role="menuitemcheckbox"
            :aria-checked="settings.markdownWrapAt80Columns"
            data-action="wrap-at-80-columns"
            @click="settings.markdownWrapAt80Columns = !settings.markdownWrapAt80Columns"
          >
            <span class="switch pe-none">
              <input type="checkbox" tabindex="-1" aria-hidden="true" :checked="settings.markdownWrapAt80Columns" />
            </span>
            {{ t("fileView.wrapAt80Columns") }}
          </button>
        </template>
      </FileViewMenu>
    </Teleport>
    <div v-if="edit !== null && edit.isConflict" class="banner warn" role="alert">
      <template v-if="edit.diskHash === null && edit.diskText === null">
        <span>{{ t("fileView.conflict.deleted") }}</span>
        <button type="button" class="btn small" data-action="recreate" :title="t('fileView.conflict.recreateTitle')" @click="save(true)">
          {{ t("fileView.conflict.recreate") }}
        </button>
      </template>
      <template v-else>
        <span>{{ t("fileView.conflict.modified") }}</span>
        <button type="button" class="btn small" data-action="reload" :title="t('fileView.conflict.reloadTitle')" @click="reloadFromDisk">
          {{ t("fileView.conflict.reload") }}
        </button>
        <button type="button" class="btn small" data-action="keep-mine" :title="t('fileView.conflict.keepMineTitle')" @click="keepMine">
          {{ t("fileView.conflict.keepMine") }}
        </button>
      </template>
    </div>
    <div v-if="isDeleted && edit === null" class="banner warn" role="alert" data-state="deleted">{{ t("fileView.conflict.deleted") }}</div>
    <div v-if="isChangedOnDisk" class="banner info" role="status" data-state="changed-on-disk">{{ t("fileView.changedOnDisk") }}</div>
    <div v-if="readOnlyReason !== '' && isCodeShown" class="banner info">{{ t("fileView.readOnly", { reason: readOnlyReason }) }}</div>
    <div ref="body" class="code" :class="[codeThemeClass, { editing: isCodeShown, preview: isPreview }]" @scroll.capture="selection = null">
      <div v-if="error !== ''" class="empty err">{{ error }}</div>
      <div v-else-if="isLoading" class="empty">{{ t("fileView.loading") }}</div>
      <div v-else-if="image !== ''" class="img"><img :src="image" :alt="absolutePath ?? ''" /></div>
      <article v-else-if="isPreview" ref="markdownArticle" class="md-doc" :class="markdownWidthClass" @click="onMarkdownClick">
        <section v-if="frontMatter !== null" class="front-matter-card" :aria-label="t('fileView.frontMatterLabel')">
          <pre>{{ frontMatter }}</pre>
        </section>
        <div v-html="rendered"></div>
      </article>
      <CodeEditor
        v-else
        ref="editor"
        :key="absolutePath ?? ''"
        :path="location?.path ?? absolutePath ?? ''"
        :text="edit !== null ? edit.current : text"
        :wrap="settings.codeWrap"
        :line="lineRequest?.line ?? null"
        :read-only="isEditable === false"
        :auto-focus="false"
        @change="onEditorChange"
        @save="save()"
        @selection="onEditorSelection"
      />
      <div
        v-if="selection !== null && isCodeShown"
        class="selection-bar"
        role="toolbar"
        :aria-label="t('fileView.selectionLabel')"
        :style="{ left: `${selection.left}px`, top: `${selection.top}px` }"
        @mousedown.prevent
      >
        <span class="text-body-secondary">
          {{ selection.fromLine === selection.toLine ? t("fileView.selection.line", { line: selection.fromLine }) : t("fileView.selection.lines", { from: selection.fromLine, to: selection.toLine }) }}
        </span>
        <button type="button" class="btn small" data-action="explain" :title="t('fileView.explainTitle')" @click="askCodingAgent('explain')">{{ t("fileView.explain") }}</button>
        <button type="button" class="btn small" data-action="fix" :title="t('fileView.fixTitle')" @click="askCodingAgent('fix')">{{ t("fileView.fix") }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.file-view { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.code { position: relative; flex: 1; min-height: 0; overflow: auto; font-family: var(--mono); line-height: 1.55; }
.code.editing { overflow: hidden; }
/* The Markdown preview is text, not code: it has the background of a pane, not the background of the code theme (issue #928). */
.code.preview { background: var(--bg); }
.img { padding: 24px; display: flex; justify-content: center; background: repeating-conic-gradient(var(--image-checker-light) 0% 25%, var(--image-checker-dark) 0% 50%) 50% / 20px 20px; min-height: 100%; }
.img img { max-width: 100%; height: auto; image-rendering: auto; }
.md-doc { padding: 24px 36px 60px; }
/* The front matter is not a part of the text: the card has its own background and rounded corners, and shows the block as it is. */
.front-matter-card { margin-bottom: 1.5em; padding: 12px 16px; border: 1px solid var(--line); border-radius: 8px; background: var(--code-block-bg); }
.front-matter-card pre { margin: 0; font-family: var(--mono); font-size: 0.82em; line-height: 1.55; white-space: pre-wrap; overflow-wrap: anywhere; }
.banner { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 6px 12px; font-family: var(--sans); font-size: var(--font-size); border-bottom: 1px solid var(--line); }
.banner.warn { background: var(--tint-warn); color: var(--level-warn); }
.banner.info { background: var(--tint-done); color: var(--text-2); }
/* The bar of actions on the selected lines floats over the code, under the end of the selection. */
.selection-bar { position: absolute; z-index: 3; display: flex; align-items: center; gap: 6px; padding: 5px 6px 5px 10px; border-radius: 9px; background: var(--raised); border: 1px solid var(--line-strong); box-shadow: 0 10px 28px var(--shadow); font-family: var(--sans); font-size: var(--font-size); white-space: nowrap; }
.empty { padding: 24px; color: var(--muted); font-family: var(--sans); font-size: var(--font-size); }
.err { color: var(--fail); }
</style>
