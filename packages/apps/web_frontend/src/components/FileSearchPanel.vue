<script setup lang="ts">
// The Search in files sidebar section of the left sidebar: a text searched in all the files of the Git repository of the
// selected workspace, with the options "Match case" and "Regular expression". The results are grouped by file, and a click
// on a file folds or unfolds its lines. A click on a line opens the file at that line in a file view pane.
// - issue #900
import { computed, nextTick, onMounted, ref, watch } from "vue";
import Icon from "./Icon.vue";
import { currentGit } from "../stores/git";
import { FILE_SEARCH_MIN_LENGTH, FileSearch, fileSearch, type FileSearchHit } from "../stores/file_search";
import { FileViewPanes } from "../stores/file_view_panes";
import { state } from "../stores/session";
import { settings } from "../stores/settings";
import { fileIconName } from "../lib/chat_files";
import { t } from "../i18n/index";

const input = ref<HTMLInputElement>();
const root = computed(() => currentGit.value?.root ?? null);
const groups = computed(() => FileSearch.groups(fileSearch.hits));
const isQueryLongEnough = computed(() => fileSearch.query.trim().length >= FILE_SEARCH_MIN_LENGTH);

/** The line under the search box: searching, the number of results and of files, or nothing. */
const summary = computed(() => {
  if (fileSearch.isSearching) {
    return t("fileSearchPanel.searching");
  }
  if (isQueryLongEnough.value === false || fileSearch.error !== "") {
    return "";
  }
  const results = t("fileSearchPanel.results", { count: fileSearch.hits.length, more: fileSearch.isTruncated ? "+" : "" });
  const fileCount = t("fileSearchPanel.files", { count: groups.value.length });
  return t("fileSearchPanel.summary", { results, files: fileCount });
});

let searchTimer = 0;

/** Runs the search a short time after the last key, so that each key does not start a search. */
function scheduleSearch() {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(runSearch, 350);
}

function runSearch() {
  window.clearTimeout(searchTimer);
  if (root.value === null) {
    return;
  }
  void FileSearch.run(root.value, settings.fileSearchMatchCase, settings.fileSearchRegularExpression);
}

watch(() => fileSearch.query, scheduleSearch);
watch([() => settings.fileSearchMatchCase, () => settings.fileSearchRegularExpression], runSearch);
// Another repository: the search runs again in it.
watch(root, (newRoot) => {
  if (newRoot !== null && newRoot !== fileSearch.root) {
    runSearch();
  }
});

function toggleGroup(path: string) {
  if (fileSearch.foldedPaths.includes(path)) {
    fileSearch.foldedPaths = fileSearch.foldedPaths.filter((foldedPath) => foldedPath !== path);
    return;
  }
  fileSearch.foldedPaths = [...fileSearch.foldedPaths, path];
}

function openHit(hit: FileSearchHit) {
  void FileViewPanes.open(`${fileSearch.root}/${hit.path}`, hit.line);
}

function lineParts(text: string) {
  return FileSearch.lineParts(text, fileSearch.query, settings.fileSearchMatchCase, settings.fileSearchRegularExpression);
}

function fileName(path: string): string {
  return path.split("/").pop() ?? path;
}

function folderName(path: string): string {
  return path.split("/").slice(0, -1).join("/");
}

onMounted(() => {
  void nextTick(() => {
    input.value?.focus();
    input.value?.select();
  });
  if (root.value !== null && root.value !== fileSearch.root) {
    runSearch();
  }
});
</script>

<template>
  <div class="file-search-panel">
    <div v-if="state.selectedWorkspaceId === null" class="muted">{{ t("fileSearchPanel.selectWorkspace") }}</div>
    <template v-else-if="root !== null">
      <header class="panel-header">
        <span class="title">{{ t("fileSearchPanel.title") }}</span>
      </header>
      <form class="search-form d-flex flex-column gap-2" @submit.prevent="runSearch">
        <label class="form-label mb-0" for="file-search-input">{{ t("fileSearchPanel.inputLabel") }}</label>
        <input
          id="file-search-input"
          ref="input"
          v-model="fileSearch.query"
          class="form-control form-control-sm"
          spellcheck="false"
          autocomplete="off"
        />
        <div class="form-check">
          <input id="file-search-match-case" v-model="settings.fileSearchMatchCase" class="form-check-input" type="checkbox" />
          <label class="form-check-label" for="file-search-match-case">{{ t("fileSearchPanel.matchCase") }}</label>
        </div>
        <div class="form-check">
          <input id="file-search-regular-expression" v-model="settings.fileSearchRegularExpression" class="form-check-input" type="checkbox" />
          <label class="form-check-label" for="file-search-regular-expression">{{ t("fileSearchPanel.regularExpression") }}</label>
        </div>
      </form>
      <div v-if="summary !== ''" class="muted summary">{{ summary }}</div>
      <div v-if="fileSearch.error !== ''" class="error">{{ fileSearch.error }}</div>
      <div v-else-if="isQueryLongEnough === false" class="muted">{{ t("fileSearchPanel.typeMore", { minimum: FILE_SEARCH_MIN_LENGTH }) }}</div>
      <div v-else-if="fileSearch.isSearching === false && fileSearch.hits.length === 0" class="muted">{{ t("fileSearchPanel.noResult") }}</div>
      <ul class="groups">
        <li v-for="group in groups" :key="group.path">
          <button
            type="button"
            class="group-row list-action d-flex align-items-center text-start"
            :aria-expanded="fileSearch.foldedPaths.includes(group.path) === false"
            :title="t('fileSearchPanel.foldTitle')"
            @click="toggleGroup(group.path)"
          >
            <span class="arrow"><Icon :name="fileSearch.foldedPaths.includes(group.path) ? 'chevron-right' : 'chevron-down'" /></span>
            <Icon :name="fileIconName(fileName(group.path))" class="kind" />
            <span class="name">{{ fileName(group.path) }}</span>
            <span class="folder me-auto">{{ folderName(group.path) }}</span>
            <span class="badge rounded-pill text-bg-secondary">{{ group.hits.length }}</span>
          </button>
          <ul v-if="fileSearch.foldedPaths.includes(group.path) === false" class="hits">
            <li v-for="hit in group.hits" :key="`${group.path}:${hit.line}`">
              <button type="button" class="hit-row list-action d-flex text-start" :title="t('fileSearchPanel.openAtLine')" @click="openHit(hit)">
                <span class="line-number">{{ hit.line }}</span>
                <span class="line-text">{{ lineParts(hit.text).before }}<mark>{{ lineParts(hit.text).match }}</mark>{{ lineParts(hit.text).after }}</span>
              </button>
            </li>
          </ul>
        </li>
      </ul>
      <div v-if="fileSearch.isTruncated" class="muted">{{ t("fileSearchPanel.truncated") }}</div>
    </template>
    <div v-else class="muted">{{ t("fileSearchPanel.notRepository") }}</div>
  </div>
</template>

<style scoped>
.file-search-panel { flex: 1; min-height: 0; padding: 0 8px 12px; display: flex; flex-direction: column; gap: 8px; overflow-y: auto; }
.panel-header { position: sticky; top: 0; z-index: 2; padding: 12px 0 0; background: var(--side); }
.title { font-weight: 600; padding-left: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.search-form { padding: 0 8px; font-size: var(--font-size); }
.groups, .hits { list-style: none; margin: 0; padding: 0; }
.group-row { width: 100%; height: 28px; gap: 6px; padding: 0 8px; border: none; border-radius: 5px; color: var(--text); font-size: var(--font-size); white-space: nowrap; }
.group-row:hover, .hit-row:hover { background: var(--files-row-hover); }
.arrow { flex: 0 0 16px; display: inline-flex; justify-content: center; color: var(--muted); }
.kind { flex: 0 0 auto; color: var(--muted); }
.name { flex-shrink: 0; }
.folder { min-width: 0; overflow: hidden; text-overflow: ellipsis; color: var(--muted); }
.hit-row { width: 100%; gap: 8px; padding: 2px 8px 2px 30px; border: none; border-radius: 5px; color: var(--text-2); font: var(--font-size) var(--mono); white-space: nowrap; }
.line-number { flex-shrink: 0; min-width: 28px; text-align: right; color: var(--muted); }
.line-text { overflow: hidden; text-overflow: ellipsis; }
.line-text mark { padding: 0; background: var(--search-match-selected); color: var(--text); border-radius: 2px; }
.summary { padding-top: 0; }
.error { font-size: var(--font-size); color: var(--fail); padding: 0 8px; }
.muted { font-size: var(--font-size); color: var(--muted); padding: 0 8px; }
</style>
