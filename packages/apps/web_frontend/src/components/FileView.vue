<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import CodeEditor from "./CodeEditor.vue";
import FileViewMenu from "./FileViewMenu.vue";
import { FileViewLabel } from "../lib/file_view_label";
import { FrontMatter } from "../lib/front_matter";
import { HtmlPreview } from "../lib/html_preview";
import { isMarkdown, renderMarkdown } from "../lib/markdown";
import { isImage } from "../stores/files";
import { fileViewEdits, FileViewEditState } from "../stores/file_view_edit_state";
import { FileViewEdits } from "../stores/file_view_edits";
import { fileViewLineRequests } from "../stores/file_view_panes";
import { FileViewAgentPrompt, type FileViewAgentRequest } from "../stores/file_view_agent_prompt";
import { toast } from "../stores/session";
import type { EditorSelection } from "../lib/editor";
import { settings } from "../stores/settings";
import { codeThemeClass } from "../stores/theme";
import type { AgentInfo } from "../lib/types";
import { t } from "../i18n/index";

// The body of a file view pane: the file of the label of the pane. The developer types in a text file at once, and saves it
// with ⌘S or with the button "Save", which shows only while the file has unsaved changes. An image, a Markdown preview, and a
// file that cannot be edited (binary, too large, not UTF-8) stay read only. An HTML file in Preview is shown as a web page in
// a sandboxed frame, served by a small web server of the desktop application on the loopback address, so the page has its own
// web origin, loads the files next to it, and cannot reach the Tauri commands. The selected lines can go to the coding agent of
// the tab, to explain them or to fix them. The controls of the pane are written here, because they work on the state of the
// file, and they are shown in the header of the pane: the header gives the element `controlsHost`, and the controls are
// teleported into it.
// Issues: https://github.com/heidrun-org/heidrun/issues/714, https://github.com/heidrun-org/heidrun/issues/784,
// https://github.com/heidrun-org/heidrun_code/issues/898, https://github.com/heidrun-org/heidrun_code/issues/899, and
// https://github.com/heidrun-org/heidrun_code/issues/901, https://github.com/heidrun-org/heidrun_code/issues/925, and
// https://github.com/heidrun-org/heidrun_code/issues/930
const props = defineProps<{
  pane: AgentInfo;
  /** The element of the header of the pane that holds the controls, or null while the header is not drawn yet. */
  controlsHost: HTMLElement | null;
}>();

/** The project of the file and the path inside it, as the backend resolves them. */
type FileLocation = { root: string; path: string };

const absolutePath = computed(() => FileViewLabel.parse(props.pane.label));
const isMarkdownFile = computed(() => isMarkdown(absolutePath.value));
const isHtmlFile = computed(() => HtmlPreview.isHtml(absolutePath.value));
/** A Markdown file and an HTML file have the buttons "Preview" and "Raw" (issue #925). */
const hasPreview = computed(() => isMarkdownFile.value || isHtmlFile.value);
const isPreview = computed(() => hasPreview.value && settings.filesMdRead);
const location = ref<FileLocation | null>(null);
const text = ref("");
const rendered = ref("");
/** The front matter block of a Markdown file in Preview mode, shown in a card above the rendered text, or null. */
const frontMatter = ref<string | null>(null);
const image = ref("");
/** The address of the HTML file in Preview, `http://127.0.0.1:<port>/<secret key>/<path>`, or an empty text. */
const htmlAddress = ref("");
/** The secret key of the open HTML preview, which the desktop application forgets when the preview closes, or null. */
let htmlPreviewKey: string | null = null;
const htmlFrame = ref<HTMLIFrameElement | null>(null);
const error = ref("");
const isLoading = ref(false);
const editor = ref<InstanceType<typeof CodeEditor> | null>(null);
/** "preview" or "raw": the display of a Markdown file or of an HTML file, saved in the setting `filesMdRead`. */
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
let sequence = 0;

// An answer that comes after the path or the mode changed again is dropped.
async function load() {
  const mine = ++sequence;
  text.value = "";
  rendered.value = "";
  frontMatter.value = null;
  image.value = "";
  htmlAddress.value = "";
  closeHtmlPreview();
  error.value = "";
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
    if (isPreview.value && isHtmlFile.value) {
      // The frame reads the file on the disk, so unsaved changes do not show in the web page.
      const opening = await invoke<{ key: string; address: string }>("html_preview_open", { root: resolved.root });
      if (mine !== sequence) {
        void invoke("html_preview_close", { key: opening.key }).catch(() => {});
        return;
      }
      htmlPreviewKey = opening.key;
      htmlAddress.value = HtmlPreview.fileAddress(opening.address, resolved.path);
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

// A line asked again for the file that the pane shows already: the editor goes to it.
watch(
  () => lineRequest.value?.sequence,
  () => {
    if (lineRequest.value !== null) {
      editor.value?.goToLine(lineRequest.value.line);
    }
  },
);

// The file on the disk is looked at every few seconds: a coding agent may change it. A file without unsaved changes is read
// again quietly, and a file with unsaved changes shows the conflict.
let checkTimer = 0;
onMounted(() => {
  checkTimer = window.setInterval(() => {
    if (edit.value !== null) {
      void FileViewEdits.check(props.pane.pane_id);
    }
  }, 4000);
});
onBeforeUnmount(() => window.clearInterval(checkTimer));

// A click on a link to a web site in the HTML preview comes as a message of the frame, and opens in the browser.
function onFrameMessage(event: MessageEvent) {
  if (htmlFrame.value === null || event.source !== htmlFrame.value.contentWindow) {
    return;
  }
  const url = HtmlPreview.openUrlOf(event.data);
  if (url !== null) {
    openUrl(url).catch(() => {});
  }
}
onMounted(() => window.addEventListener("message", onFrameMessage));
onBeforeUnmount(() => window.removeEventListener("message", onFrameMessage));

// The desktop application stops its web server when the last HTML preview closes.
function closeHtmlPreview() {
  if (htmlPreviewKey === null) {
    return;
  }
  void invoke("html_preview_close", { key: htmlPreviewKey }).catch(() => {});
  htmlPreviewKey = null;
}
// A preview that is still opening when the pane closes is dropped too.
onBeforeUnmount(() => {
  sequence++;
  closeHtmlPreview();
});

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
function reloadFromDisk() {
  void FileViewEdits.reload(props.pane.pane_id);
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
// Links in rendered Markdown open in the browser.
function onMarkdownClick(event: MouseEvent) {
  const anchor = (event.target as HTMLElement).closest("a");
  if (anchor === null) {
    return;
  }
  event.preventDefault();
  const href = anchor.getAttribute("href") ?? "";
  if (/^https?:\/\//.test(href)) {
    openUrl(href).catch(() => {});
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
      <div
        v-if="hasPreview"
        class="btn-group btn-group-sm"
        role="group"
        :aria-label="isHtmlFile ? t('fileView.htmlLabel') : t('fileView.markdownLabel')"
      >
        <label class="btn small btn-check btn-outline theme-secondary" :title="isHtmlFile ? t('fileView.previewHtmlTitle') : t('fileView.previewTitle')">
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
    <div v-if="edit !== null && edit.isConflict && isCodeShown" class="banner warn" role="alert">
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
        <button type="button" class="btn small" data-action="overwrite" :title="t('fileView.conflict.overwriteTitle')" @click="save(true)">
          {{ t("fileView.conflict.overwrite") }}
        </button>
      </template>
    </div>
    <div v-if="readOnlyReason !== '' && isCodeShown" class="banner info">{{ t("fileView.readOnly", { reason: readOnlyReason }) }}</div>
    <div ref="body" class="code" :class="[codeThemeClass, { editing: isCodeShown }]" @scroll.capture="selection = null">
      <div v-if="error !== ''" class="empty err">{{ error }}</div>
      <div v-else-if="isLoading" class="empty">{{ t("fileView.loading") }}</div>
      <div v-else-if="image !== ''" class="img"><img :src="image" :alt="absolutePath ?? ''" /></div>
      <iframe
        v-else-if="htmlAddress !== ''"
        ref="htmlFrame"
        class="html-preview"
        sandbox="allow-scripts allow-same-origin"
        :src="htmlAddress"
        :title="absolutePath ?? ''"
      ></iframe>
      <article v-else-if="isPreview" class="md-doc" :class="markdownWidthClass" @click="onMarkdownClick">
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
.img { padding: 24px; display: flex; justify-content: center; background: repeating-conic-gradient(var(--image-checker-light) 0% 25%, var(--image-checker-dark) 0% 50%) 50% / 20px 20px; min-height: 100%; }
.img img { max-width: 100%; height: auto; image-rendering: auto; }
.md-doc { padding: 24px 36px 60px; }
/* The web page fills the body of the pane, on a white page as in a browser. */
.html-preview { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; background: var(--web-page-bg); }
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
