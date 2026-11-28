<script setup lang="ts">
import { WorkspaceFolders } from '../stores/workspace_folders';
import { invoke } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import AbbreviatedTime from "./AbbreviatedTime.vue";
import Icon from "./Icon.vue";
import { t } from "../i18n/index";
import { openFolderAsWorkspace, selectWorkspace, state, workspaces } from "../stores/session";

/** Checkout details for a Git worktree. */
type GitWorktree = {
	/** The absolute checkout folder, or null when unavailable. */
	folder: string | null;
	/** The checked-out branch, or null when the head is detached. */
	branch: string | null;
	/** The folder creation time in seconds since 1970, or null when unavailable. */
	created_at: number | null;
	/** The latest commit time in seconds since 1970, or null when unavailable. */
	last_commit_at: number | null;
};

/** A submodule adds a repository-relative path to the checkout details. */
type GitSubmodule = Omit<GitWorktree, 'branch'> & {
	/** The path relative to the selected repository. */
	path: string;
};

type SortKey = "last_commit_at" | "created_at" | "name";

const props = defineProps<{
	/** The root folder of the selected workspace's repository. */
	root: string;
	/** Whether the first checkout read has taken long enough to reveal the window. */
	visible: boolean;
	/** The type of checkout to list. */
	kind: 'worktrees' | 'submodules';
}>();

const emit = defineEmits<{
  close: [];
  loaded: [];
}>();

const dialog = ref<HTMLElement>();
const checkouts = ref<(GitWorktree | GitSubmodule)[]>([]);
const isSubmodulePicker = computed(() => props.kind === 'submodules');
const title = computed(() => t(isSubmodulePicker.value ? 'workspaceStatusSummary.openGitSubmodule' : 'gitWorktreesModal.title'));
const isLoading = ref(false);
const error = ref("");
const copiedFolder = ref<string | null>(null);
let copiedFolderTimer: ReturnType<typeof setTimeout> | undefined;
const sortKey = ref<SortKey>("last_commit_at");
const ascending = ref(false);
const directionLabel = computed(() => {
	if (sortKey.value === "name") {
		return t(ascending.value ? "gitWorktreesModal.azFirst" : "gitWorktreesModal.zaFirst");
	}
	return t(ascending.value ? "gitWorktreesModal.oldestFirst" : "gitWorktreesModal.newestFirst");
});
const rows = computed(() => {
	const result = checkouts.value.map((checkout) => {
		const path = 'path' in checkout ? checkout.path : checkout.folder ?? '';
		const name = 'path' in checkout ? checkout.path.split('/').pop() ?? checkout.path : checkout.branch;
		const workspace = checkout.folder === null ? null :
			workspaces.value.find((candidate) => WorkspaceFolders.get(candidate.workspace_id) === checkout.folder) ?? null;
		return {
			...checkout,
			path,
			name,
			workspace,
		};
	});
	return result.sort((a, b) => {
		const left = a[sortKey.value];
		const right = b[sortKey.value];
		let comparison = 0;
		if (typeof left === "number" && typeof right === "number") comparison = left - right;
		else comparison = String(left ?? "").localeCompare(String(right ?? ""));
		if (comparison === 0) comparison = a.path.localeCompare(b.path);
		return ascending.value ? comparison : -comparison;
	});
});

/** Reads the current checkout list from the selected repository.
 * @returns A promise that ends when the command has answered.
 */
async function refresh(isInitialRead = false): Promise<void> {
	isLoading.value = true;
	error.value = "";
	try {
		checkouts.value = await invoke<(GitWorktree | GitSubmodule)[]>(
			isSubmodulePicker.value ? 'gitSubmodules' : 'git_worktrees',
			{
				root: props.root,
			},
		);
	} catch (reason) {
		error.value = String(reason);
	} finally {
		isLoading.value = false;
		if (isInitialRead) emit("loaded");
	}
}

/** Closes the checkout picker.
 * @returns Nothing.
 */
function close(): void {
	emit("close");
}

/** Opens a selected checkout as a workspace, or selects its workspace when already open.
 * @param row - The checkout row the developer selected.
 * @returns A promise that ends when the workspace has been selected or opened.
 */
async function openCheckout(row: (typeof rows.value)[number]): Promise<void> {
	if (row.folder === null) {
		return;
	}
	close();
	if (row.workspace !== null) {
		selectWorkspace(row.workspace.workspace_id);
		return;
	}
	const label = row.folder.split("/").filter(Boolean).pop() ?? row.folder;
	await openFolderAsWorkspace(row.folder, label);
}

/** Copies a checkout folder path and briefly confirms the successful copy. */
async function copyFolder(folder: string): Promise<void> {
	try {
		await writeText(folder);
	} catch {
		try {
			if (navigator.clipboard === undefined) return;
			await navigator.clipboard.writeText(folder);
		} catch {
			return;
		}
	}
	copiedFolder.value = folder;
	if (copiedFolderTimer !== undefined) clearTimeout(copiedFolderTimer);
	copiedFolderTimer = setTimeout(() => {
		copiedFolder.value = null;
	}, 2000);
}

watch(() => props.visible, async (visible) => {
	if (!visible) return;
	await nextTick();
	dialog.value?.focus();
});

onMounted(() => {
	void refresh(true);
});

onBeforeUnmount(() => {
	if (copiedFolderTimer !== undefined) clearTimeout(copiedFolderTimer);
});
</script>

<template>
  <div v-if="visible" class="overlay" @click.stop @mousedown.self="close">
    <section
      ref="dialog"
      class="window-box"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
      tabindex="-1"
      @keydown.esc.stop.prevent="close"
    >
      <header>
        <h2>{{ title }}</h2>
        <div class="header-tools">
          <label class="sort-label" for="worktree-sort">{{ t("gitWorktreesModal.sortBy") }}</label>
          <select id="worktree-sort" v-model="sortKey" class="form-control form-control-sm w-auto sort-select">
            <option value="last_commit_at">{{ t("gitWorktreesModal.updated") }}</option>
            <option value="created_at">{{ t("gitWorktreesModal.created") }}</option>
            <option value="name">{{ t("gitWorktreesModal.name") }}</option>
          </select>
          <button
            type="button"
            class="btn icon icon-button direction"
            :title="directionLabel"
            :aria-label="directionLabel"
            @click="ascending = !ascending"
          >
            <Icon :name="ascending ? 'arrow-up' : 'arrow-down'" />
          </button>
          <button
            type="button"
            class="btn icon icon-button refresh"
            :title="t('gitWorktreesModal.refresh')"
            :aria-label="t('gitWorktreesModal.refresh')"
            :disabled="isLoading"
            @click="refresh()"
          >
            <Icon name="arrow-clockwise" />
          </button>
          <button type="button" class="btn icon icon-button close" :title="t('gitWorktreesModal.close')" :aria-label="t('gitWorktreesModal.close')" @click="close">
            <Icon name="x-lg" />
          </button>
        </div>
      </header>
      <div class="content">
        <div v-if="isLoading && checkouts.length === 0" class="message" role="status">{{ t(isSubmodulePicker ? 'workspaceStatusSummary.loadingGitSubmodules' : 'gitWorktreesModal.loading') }}</div>
        <div v-else-if="error && checkouts.length === 0" class="message error" role="alert">
          <span>{{ error }}</span>
          <button type="button" class="list-action refresh" @click="refresh()">{{ t("gitWorktreesModal.tryAgain") }}</button>
        </div>
        <div v-else-if="rows.length === 0" class="message">{{ t(isSubmodulePicker ? 'workspaceStatusSummary.noGitSubmodules' : 'gitWorktreesModal.empty') }}</div>
        <div v-else class="worktree-list">
          <div v-if="error" class="message error" role="status">{{ error }}</div>
          <div
            v-for="row in rows"
            :key="row.path"
            class="worktree-row"
            :aria-current="row.workspace?.workspace_id === state.selectedWorkspaceId ? 'location' : undefined"
          >
            <button
              type="button"
              class="list-action open-worktree"
              :disabled="row.folder === null"
              @click="openCheckout(row)"
            >
              <span class="worktree-text">
                <span class="branch-line">
                  <Icon name="folder-symlink" class="folder-icon" />
                  <span class="branch">{{ row.name ?? t("gitWorktreesModal.detached") }}</span>
                </span>
                <span class="folder" :title="row.path">{{ row.path }}</span>
                <span v-if="row.folder === null" class="folder submodule-note">
                  {{ t('workspaceStatusSummary.gitSubmoduleUnavailable') }}
                </span>
                <span v-else class="dates">
                  <span v-if="row.created_at !== null">{{ t("gitWorktreesModal.created") }} <AbbreviatedTime :milliseconds="row.created_at * 1000" /></span>
                  <span v-if="row.last_commit_at !== null">{{ t("gitWorktreesModal.updated") }} <AbbreviatedTime :milliseconds="row.last_commit_at * 1000" /></span>
                </span>
              </span>
              <span v-if="row.workspace" class="open-label">{{ t("gitWorktreesModal.alreadyOpen", { name: row.workspace.label }) }}</span>
            </button>
            <div v-if="row.folder !== null" class="row-actions">
              <button
                type="button"
                class="btn icon icon-button row-action"
                :title="t(copiedFolder === row.folder ? 'gitWorktreesModal.folderCopied' : 'gitWorktreesModal.copyFolder')"
                :aria-label="t(copiedFolder === row.folder ? 'gitWorktreesModal.folderCopied' : 'gitWorktreesModal.copyFolder')"
                @click="copyFolder(row.folder)"
              >
                <Icon :name="copiedFolder === row.folder ? 'clipboard-check' : 'clipboard'" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; z-index: 60; background: var(--overlay); display: flex; align-items: center; justify-content: center; padding: 24px; }
.window-box { width: min(900px, 100%); max-height: 84vh; display: flex; flex-direction: column; border-radius: 14px; overflow: hidden; outline: none; background: var(--panel); border: 1px solid var(--line-strong); box-shadow: 0 24px 64px var(--shadow-soft); }
header { display: flex; align-items: center; gap: 20px; padding: 16px 20px; border-bottom: 1px solid var(--line); }
h2 { margin: 0; flex: 1; min-width: 0; font-size: calc(var(--font-size) * 1.15); font-weight: 600; }
.header-tools { display: flex; align-items: center; gap: 8px; }
.sort-label { color: var(--muted); font-size: calc(var(--font-size) * 0.9); }
.sort-select { max-width: 150px; }
.icon-button { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; }
.icon-button:focus-visible, .open-worktree:focus-visible { outline: 2px solid var(--line-strong); outline-offset: 2px; }
.content { min-height: 150px; overflow-y: auto; padding: 14px 20px; display: flex; flex-direction: column; gap: 12px; }
.worktree-list { display: flex; flex-direction: column; }
.worktree-row { position: relative; display: flex; align-items: stretch; min-width: 0; border-bottom: 1px solid var(--line); background: transparent; }
.worktree-row:last-child { border-bottom: 0; }
.worktree-row:hover:has(.open-worktree:enabled), .worktree-row:focus-within { border-color: var(--line); background: var(--hover); }
.open-worktree { min-width: 0; flex: 1; display: flex; align-items: center; gap: 12px; padding: 12px 54px 12px 12px; border: 0; border-radius: 0; background: transparent; color: var(--text); text-align: left; }
.worktree-text { display: flex; flex-direction: column; min-width: 0; flex: 1; gap: 2px; }
.branch-line { display: flex; align-items: center; gap: 7px; min-width: 0; }
.folder-icon { flex: 0 0 auto; color: var(--text-2); }
.branch { font-weight: 600; }
.folder { color: var(--muted); font-weight: 400; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.submodule-note { white-space: normal; }
.dates { display: flex; flex-wrap: wrap; gap: 4px 18px; margin-top: 3px; color: var(--muted); font-size: calc(var(--font-size) * 0.9); font-weight: 400; }
.open-label, .muted { color: var(--muted); }
.row-actions { position: absolute; top: 4px; right: 4px; display: flex; align-items: center; }
.message { padding: 28px 8px; text-align: center; color: var(--muted); }
.error { color: var(--danger, var(--fail)); display: flex; flex-direction: column; gap: 8px; }
.icon-button:disabled { cursor: default; }
@media (max-width: 700px) { header { align-items: flex-start; flex-wrap: wrap; } .header-tools { width: 100%; } .sort-label { margin-left: auto; } .open-label { display: none; } }
</style>
