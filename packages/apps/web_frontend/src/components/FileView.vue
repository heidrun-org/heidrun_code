<script setup lang="ts">
import { computed, ref, useId, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import CodeEditor from "./CodeEditor.vue";
import FileViewMenu from "./FileViewMenu.vue";
import { FileViewLabel } from "../lib/file_view_label";
import { FrontMatter } from "../lib/front_matter";
import { isMarkdown, renderMarkdown } from "../lib/markdown";
import { isImage } from "../stores/files";
import { toast } from "../stores/session";
import { settings } from "../stores/settings";
import { codeThemeClass } from "../stores/theme";
import type { AgentInfo } from "../lib/types";
import { t } from "../i18n/index";

// The body of a file view pane: the file of the label of the pane, shown read only. The developer cannot change the file here.
// The controls of the pane are written here, because they work on the state of the file, and they are shown in the header of
// the pane: the header gives the element `controlsHost`, and the controls are teleported into it.
// Issues: https://github.com/heidrun-org/heidrun/issues/714 and https://github.com/heidrun-org/heidrun/issues/784
const props = defineProps<{
  pane: AgentInfo;
  /** The element of the header of the pane that holds the controls, or null while the header is not drawn yet. */
  controlsHost: HTMLElement | null;
}>();

/** The project of the file and the path inside it, as the backend resolves them. */
type FileLocation = { root: string; path: string };

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
let sequence = 0;

// An answer that comes after the path or the mode changed again is dropped.
async function load() {
  const mine = ++sequence;
  text.value = "";
  rendered.value = "";
  frontMatter.value = null;
  image.value = "";
  error.value = "";
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
    const content = (await invoke<string>("git_file", { root: resolved.root, path: resolved.path, rev: null })).replace(/\n$/, "");
    if (mine !== sequence) {
      return;
    }
    text.value = content;
    if (isPreview.value) {
      const split = FrontMatter.split(content);
      frontMatter.value = split.frontMatter;
      rendered.value = renderMarkdown(split.body);
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
    <div class="code" :class="[codeThemeClass, { editing: isCodeShown }]">
      <div v-if="error !== ''" class="empty err">{{ error }}</div>
      <div v-else-if="isLoading" class="empty">{{ t("fileView.loading") }}</div>
      <div v-else-if="image !== ''" class="img"><img :src="image" :alt="absolutePath ?? ''" /></div>
      <article v-else-if="isPreview" class="md-doc" :class="markdownWidthClass" @click="onMarkdownClick">
        <section v-if="frontMatter !== null" class="front-matter-card" :aria-label="t('fileView.frontMatterLabel')">
          <pre>{{ frontMatter }}</pre>
        </section>
        <div v-html="rendered"></div>
      </article>
      <CodeEditor v-else ref="editor" :key="absolutePath ?? ''" :path="location?.path ?? absolutePath ?? ''" :text="text" :wrap="settings.codeWrap" read-only />
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
/* The front matter is not a part of the text: the card has its own background and rounded corners, and shows the block as it is. */
.front-matter-card { margin-bottom: 1.5em; padding: 12px 16px; border: 1px solid var(--line); border-radius: 8px; background: var(--code-block-bg); }
.front-matter-card pre { margin: 0; font-family: var(--mono); font-size: 0.82em; line-height: 1.55; white-space: pre-wrap; overflow-wrap: anywhere; }
.empty { padding: 24px; color: var(--muted); font-family: var(--sans); font-size: var(--font-size); }
.err { color: var(--fail); }
</style>
