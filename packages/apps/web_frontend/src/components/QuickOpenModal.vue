<script setup lang="ts">
// The box that searches a file of the project by its name, on top of the panes, as in VS Code. The shortcut ⌘P and the
// entry "Open a project file" of the command palette open it. The developer types a part of the name, the arrow keys move
// in the list, and Enter or a click opens the file in a file view pane. The key Escape or a click outside closes the box.
// - issue #898
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { QuickOpen, quickOpen } from "../stores/quick_open";
import { FileViewPanes } from "../stores/file_view_panes";
import { QuickOpenSearch } from "../lib/quick_open_search";
import { t } from "../i18n/index";

/** The files of the project, as the backend lists them. */
type ProjectFileList = {
  /** The folder of the project. */
  root: string;
  /** The paths of the files, inside the project. */
  files: string[];
};

const query = ref("");
const index = ref(0);
const input = ref<HTMLInputElement>();
const root = ref("");
const paths = ref<string[]>([]);
const isLoading = ref(true);
const error = ref("");

const results = computed(() => (query.value.trim() === "" ? paths.value.filter((path) => path.endsWith("/") === false).slice(0, 80) : QuickOpenSearch.search(query.value.trim(), paths.value)));

watch(query, () => {
  index.value = 0;
});

async function loadFiles() {
  try {
    const list = await invoke<ProjectFileList>("files_list", { cwd: quickOpen.folder, ignored: false });
    root.value = list.root;
    paths.value = list.files;
  } catch (loadError) {
    error.value = String(loadError);
  } finally {
    isLoading.value = false;
  }
}

function openResult(resultIndex: number) {
  const path = results.value[resultIndex];
  if (path === undefined) {
    return;
  }
  QuickOpen.close();
  void FileViewPanes.open(`${root.value}/${path}`);
}

function onKey(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    QuickOpen.close();
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    index.value = Math.min(results.value.length - 1, index.value + 1);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    index.value = Math.max(0, index.value - 1);
  } else if (event.key === "Enter") {
    event.preventDefault();
    openResult(index.value);
  }
}

function fileName(path: string): string {
  return path.split("/").pop() ?? path;
}

function folderName(path: string): string {
  return path.split("/").slice(0, -1).join("/");
}

onMounted(() => {
  void nextTick(() => input.value?.focus());
  void loadFiles();
});
</script>

<template>
  <div class="scrim" @mousedown.self="QuickOpen.close()">
    <div class="quick-open" role="dialog" :aria-label="t('quickOpen.dialogLabel')">
      <div class="field">
        <label class="visually-hidden" for="quick-open-input">{{ t("quickOpen.inputLabel") }}</label>
        <input
          id="quick-open-input"
          ref="input"
          v-model="query"
          class="form-control"
          :placeholder="t('quickOpen.placeholder')"
          spellcheck="false"
          autocomplete="off"
          @keydown="onKey"
        />
        <kbd>esc</kbd>
      </div>
      <div class="list" role="listbox" :aria-label="t('quickOpen.resultsLabel')">
        <div v-if="error !== ''" class="empty err">{{ error }}</div>
        <div v-else-if="isLoading" class="empty">{{ t("quickOpen.loading") }}</div>
        <div v-else-if="results.length === 0" class="empty">{{ t("quickOpen.noFile", { query }) }}</div>
        <button
          v-for="(path, resultIndex) in results"
          :key="path"
          type="button"
          role="option"
          class="list-action row"
          :class="{ active: resultIndex === index }"
          :aria-selected="resultIndex === index"
          :title="t('quickOpen.openTitle')"
          @mouseenter="index = resultIndex"
          @click="openResult(resultIndex)"
        >
          <span class="name">{{ fileName(path) }}</span>
          <span class="folder mono">{{ folderName(path) }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scrim { position: fixed; inset: 0; background: var(--overlay); z-index: 40; display: flex; justify-content: center; align-items: flex-start; padding-top: 120px; }
.quick-open {
  width: min(560px, calc(100% - 32px)); border-radius: 14px; border: 1px solid var(--line-modal); background: var(--field);
  box-shadow: 0 24px 64px var(--shadow); overflow: hidden;
}
.field { display: flex; align-items: center; gap: 10px; height: 52px; padding: 0 16px; border-bottom: 1px solid var(--line-soft); }
.field input { flex: 1; }
kbd { font: 400 var(--font-size) var(--mono); color: var(--muted); }
.list { padding: 8px; max-height: 420px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
.row {
  display: flex; align-items: baseline; gap: 10px; min-height: 34px; padding: 0 10px; border-radius: 8px; border: none;
  background: transparent; color: var(--text-2); text-align: left;
}
.row.active { background: var(--hover); color: var(--text); }
.name { flex-shrink: 0; font-weight: 500; }
.folder { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--muted); font-size: var(--font-size); }
.empty { padding: 16px 10px; color: var(--muted); font-size: var(--font-size); }
.err { color: var(--fail); }
</style>
