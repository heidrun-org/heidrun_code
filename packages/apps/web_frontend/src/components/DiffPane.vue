<script setup lang="ts">
import { computed, ref, useId, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import DiffLines from "./DiffLines.vue";
import DiffPaneInformationCard from "./DiffPaneInformationCard.vue";
import FileViewMenu from "./FileViewMenu.vue";
import Icon from "./Icon.vue";
import SettingsSwitchRow from "./settings/SettingsSwitchRow.vue";
import { DiffPaneLabel } from "../lib/diff_pane_label";
import { parseDiff, type DiffLine } from "../lib/diff";
import { highlightLine, languageFor } from "../lib/highlight";
import { FileViewPanes } from "../stores/file_view_panes";
import { git, refreshGit } from "../stores/git";
import { toast } from "../stores/session";
import { settings } from "../stores/settings";
import { codeThemeClass } from "../stores/theme";
import type { AgentInfo } from "../lib/types";
import { t } from "../i18n/index";

// The body of a diff pane: the changes of the file of the label of the pane, compared to the last commit, shown read only.
// The controls of the pane are written here, because they work on the state of the diff, and they are shown in the header of
// the pane: the header gives the element `controlsHost`, and the controls are teleported into it.
// Issue: https://github.com/heidrun-org/heidrun_code/issues/885
const props = defineProps<{
  pane: AgentInfo;
  /** The element of the header of the pane that holds the controls, or null while the header is not drawn yet. */
  controlsHost: HTMLElement | null;
}>();

/** The number of lines that the pane shows at most. */
const MAX_ROWS = 6000;

const absolutePath = computed(() => DiffPaneLabel.parse(props.pane.label));
/** True when the Git status of the workspace of the pane is read: before, the pane cannot know the Git repository. */
const isStatusRead = computed(() => git.status[props.pane.workspace_id] !== undefined);
/** The root of the Git repository of the workspace of the pane, or null when there is no Git repository or no status yet. */
const root = computed(() => git.status[props.pane.workspace_id]?.root ?? null);
/** The path of the file inside the Git repository, or null when the file is not inside it. */
const path = computed(() => {
  if (absolutePath.value === null || root.value === null || absolutePath.value.startsWith(`${root.value}/`) === false) {
    return null;
  }
  return absolutePath.value.slice(root.value.length + 1);
});
const isDeleted = computed(() => {
  const file = git.status[props.pane.workspace_id]?.files.find((entry) => entry.path === path.value);
  return file?.status.includes("D") ?? false;
});
const lines = ref<DiffLine[]>([]);
const html = ref<string[]>([]);
const isTruncated = ref(false);
const error = ref("");
const isLoading = ref(false);
/** "unified" or "split": the display of the diff, saved in the setting `diffMode`. */
const diffMode = computed({
  get: () => settings.diffMode,
  set: (mode: "unified" | "split") => {
    settings.diffMode = mode;
  },
});
const diffModeName = `diff-pane-mode-${useId()}`;
let sequence = 0;

// An answer that comes after the file changed again is dropped.
async function load() {
  const mine = ++sequence;
  lines.value = [];
  html.value = [];
  isTruncated.value = false;
  error.value = "";
  if (absolutePath.value === null || isStatusRead.value === false) {
    return;
  }
  if (root.value === null) {
    error.value = t("diffPane.noRepository");
    return;
  }
  if (path.value === null) {
    error.value = t("diffPane.outsideRepository", { path: absolutePath.value });
    return;
  }
  isLoading.value = true;
  try {
    const text = await invoke<string>("git_diff", { root: root.value, path: path.value });
    if (mine !== sequence) {
      return;
    }
    const parsed = parseDiff(text);
    const language = languageFor(path.value);
    isTruncated.value = parsed.length > MAX_ROWS;
    lines.value = parsed.slice(0, MAX_ROWS);
    html.value = lines.value.map((line) => (line.kind === "hunk" ? "" : highlightLine(line.text, language)));
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
// The Git status object is replaced at each poll, so the pane watches only the root, and does not read the diff again then.
watch([absolutePath, root, isStatusRead], load, { immediate: true });

async function refreshDiff() {
  await Promise.all([load(), refreshGit(props.pane.workspace_id)]);
}
function openFile() {
  if (absolutePath.value !== null) {
    void FileViewPanes.open(absolutePath.value);
  }
}
async function copyPath(isAbsolute: boolean) {
  const copied = isAbsolute ? absolutePath.value : path.value;
  if (copied === null) {
    return;
  }
  await writeText(copied).catch(() => {});
  toast(t("diffPane.copied", { path: copied }));
}
function showInFinder() {
  if (absolutePath.value !== null) {
    revealItemInDir(absolutePath.value).catch((e) => toast(String(e)));
  }
}
async function openInVisualStudioCode() {
  if (root.value === null || path.value === null) {
    return;
  }
  await invoke("file_open_external", { root: root.value, path: path.value }).catch((e) => toast(String(e)));
}
</script>

<template>
  <div class="diff-pane">
    <Teleport v-if="controlsHost !== null" :to="controlsHost">
      <DiffPaneInformationCard :lines="lines" :path="path" :git-status="git.status[pane.workspace_id] ?? null" />
      <div class="btn-group btn-group-sm" role="group" :aria-label="t('diffPane.display')">
        <label class="btn small btn-check btn-outline theme-secondary" :title="t('diffPane.unifiedTitle')">
          <input v-model="diffMode" type="radio" :name="diffModeName" autocomplete="off" value="unified" />
          {{ t("diffPane.unified") }}
        </label>
        <label class="btn small btn-check btn-outline theme-secondary text-nowrap" :title="t('diffPane.splitTitle')">
          <input v-model="diffMode" type="radio" :name="diffModeName" autocomplete="off" value="split" />
          {{ t("diffPane.split") }}
        </label>
      </div>
      <SettingsSwitchRow v-model="settings.codeWrap" class="text-nowrap" :label="t('diffPane.wrap')" :title="t('diffPane.wrapTitle')" />
      <FileViewMenu
        :is-search-shown="false"
        @copy-path="copyPath"
        @show-in-finder="showInFinder"
        @open-in-visual-studio-code="openInVisualStudioCode"
      >
        <template #default="{ choose }">
          <button
            type="button"
            class="menu-item d-flex align-items-center gap-2"
            role="menuitem"
            data-action="refresh"
            :title="t('diffPane.refreshTitle')"
            @click="choose(refreshDiff)"
          >
            <Icon name="arrow-clockwise" />
            {{ t("diffPane.refresh") }}
          </button>
          <button
            v-if="isDeleted === false"
            type="button"
            class="menu-item d-flex align-items-center gap-2"
            role="menuitem"
            data-action="open-file"
            :title="t('diffPane.openFileTitle')"
            @click="choose(openFile)"
          >
            <Icon name="file-earmark" />
            {{ t("diffPane.openFile") }}
          </button>
        </template>
      </FileViewMenu>
    </Teleport>
    <div class="code" :class="codeThemeClass">
      <div v-if="error !== ''" class="empty err">{{ error }}</div>
      <div v-else-if="isStatusRead === false || (isLoading && lines.length === 0)" class="empty">{{ t("diffPane.loading") }}</div>
      <div v-else-if="lines.length === 0" class="empty">{{ t("diffPane.noChange") }}</div>
      <DiffLines v-else :lines="lines" :html="html" :mode="diffMode" :is-wrap="settings.codeWrap" />
      <div v-if="isTruncated" class="empty">{{ t("diffPane.truncated", { count: MAX_ROWS }) }}</div>
    </div>
  </div>
</template>

<style scoped>
.diff-pane { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.code { flex: 1; min-height: 0; overflow: auto; font-family: var(--mono); line-height: 1.55; }
.empty { padding: 24px; color: var(--muted); font-family: var(--sans); font-size: var(--font-size); }
.err { color: var(--fail); }
</style>
