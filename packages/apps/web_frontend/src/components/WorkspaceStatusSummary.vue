<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { homeDir } from "@tauri-apps/api/path";
import { openUrl } from "@tauri-apps/plugin-opener";
import Icon from "./Icon.vue";
import GitWorktreesModal from "./GitWorktreesModal.vue";
import InformationCardTooltip from "./InformationCardTooltip.vue";
import InlineRename from "./InlineRename.vue";
import ScrollingLine from "./ScrollingLine.vue";
import VoiceRecordingIcon from "./VoiceRecordingIcon.vue";
import { askConfirm } from "../stores/confirm";
import { settings } from "../stores/settings";
import { currentGit, git, workspaceCwd } from "../stores/git";
import { NewPane } from "../stores/new_pane";
import {
  allPanes,
  closeWorkspace,
  finishRename,
  moveWorkspace,
  otherWorkspaceStatus,
  selectWorkspace,
  startRename,
  state,
  workspaceDotClasses,
  workspaceHasAgent,
  workspaceLabel,
  workspaces,
} from "../stores/session";
import { webOfRemote } from "../lib/refs";
import { useReorder } from "../lib/reorder";
import { VoiceInput } from "../lib/voice_input";
import { startScrolling, stopScrolling } from "../lib/scroll_on_hover";
import { useStatusCard } from "../lib/status_card";
import type { WorkspaceInfo } from "../lib/types";
import { t } from "../i18n/index";

// The workspace selector, at the left end of the status bar: the status dot and the name of the selected workspace.
// A click on it shows a Bootstrap popover with the details of the selected workspace, the list of workspaces, and the entry
// "New workspace…". A click on a workspace of the list selects it.
const root = ref<HTMLElement | null>(null);
const { isOpen, toggle, close, onFocusOut } = useStatusCard(root);

// The width of the card, in pixels: 92 pixels more than `$popover-max-width` in `bootstrap_parts.scss`, so longer paths and
// branch names have more room.
const CARD_WIDTH_PIXELS = 432;
const cardStyle = { width: `${CARD_WIDTH_PIXELS}px`, "--popover-max-width": `${CARD_WIDTH_PIXELS}px` };

const workspaceReorder = useReorder("y", (id, at) => moveWorkspace(id, at));
const isWorktreesOpen = ref(false);
const isWorktreesVisible = ref(false);
let worktreesRevealTimer: ReturnType<typeof setTimeout> | undefined;
const copiedDetail = ref<string | null>(null);
let copiedDetailTimer: ReturnType<typeof setTimeout> | undefined;

/** Starts reading worktrees and shows the window after the short anti-flicker delay. */
function openGitWorktrees(): void {
  close();
  if (worktreesRevealTimer !== undefined) clearTimeout(worktreesRevealTimer);
  isWorktreesOpen.value = true;
  isWorktreesVisible.value = false;
  worktreesRevealTimer = setTimeout(() => {
    worktreesRevealTimer = undefined;
    isWorktreesVisible.value = true;
  }, 500);
}

/** Shows the worktree window as soon as its first read finishes. */
function showGitWorktrees(): void {
  if (worktreesRevealTimer !== undefined) clearTimeout(worktreesRevealTimer);
  worktreesRevealTimer = undefined;
  isWorktreesVisible.value = true;
}

/** Closes the worktree window and cancels its reveal timer. */
function closeGitWorktrees(): void {
  if (worktreesRevealTimer !== undefined) clearTimeout(worktreesRevealTimer);
  worktreesRevealTimer = undefined;
  isWorktreesOpen.value = false;
  isWorktreesVisible.value = false;
}

onBeforeUnmount(() => {
  if (worktreesRevealTimer !== undefined) clearTimeout(worktreesRevealTimer);
  if (copiedDetailTimer !== undefined) clearTimeout(copiedDetailTimer);
});

/** The selected workspace, or null when Herdr has no workspace. */
const selectedWorkspace = computed(
  () => workspaces.value.find((workspace) => workspace.workspace_id === state.selectedWorkspaceId) ?? null,
);

/** The Git branch read for one workspace, or null when it has no branch. */
function branchOf(workspaceId: string): string | null {
  return git.status[workspaceId]?.branch ?? null;
}

/** The branch and folder shown in the tooltip of a workspace row. */
function workspaceTooltipBlocks(workspace: WorkspaceInfo): { title: string; text: string }[] {
  return [
    {
      title: t("workspaceStatusSummary.branch"),
      text: branchOf(workspace.workspace_id) ?? t("workspaceStatusSummary.noBranch"),
    },
    {
      title: t("workspaceStatusSummary.folder"),
      text: workspaceCwd(workspace.workspace_id) ?? t("workspaceStatusSummary.noFolder"),
    },
  ];
}

/** The name in the status bar: the selected workspace. */
const selectedLabel = computed(() =>
  state.selectedWorkspaceId === null ? t("workspaceStatusSummary.none") : workspaceLabel(state.selectedWorkspaceId),
);

/** True while the name of the selected workspace is in a text field, in the place of the name. */
const isRenaming = computed(
  () => state.selectedWorkspaceId !== null && state.renaming === `ws:${state.selectedWorkspaceId}`,
);

/**
 * The classes of the status dot in the status bar. The status of the agents of another workspace comes first, because the
 * developer does not see them. Without such an agent, the dot shows the status of the selected workspace.
 */
const dotClasses = computed(() => {
  if (otherWorkspaceStatus.value !== null) {
    return ["calling", otherWorkspaceStatus.value];
  }
  if (selectedWorkspace.value === null) {
    return ["quiet"];
  }
  return workspaceDotClasses(selectedWorkspace.value);
});

/** The text of the status dot for a screen reader, only when an agent of another workspace calls. */
const dotLabel = computed(() => {
  if (otherWorkspaceStatus.value === null) {
    return undefined;
  }
  return otherWorkspaceStatus.value === "blocked"
    ? t("workspaceStatusSummary.otherBlocked")
    : t("workspaceStatusSummary.otherDone");
});

/** The rows of the details of the selected workspace, in the card. */
const detailRows = computed(() => {
  const workspace = selectedWorkspace.value;
  if (workspace === null) {
    return [];
  }
  const agentCount = allPanes.value.filter((pane) => pane.workspace_id === workspace.workspace_id && pane.agent).length;
  const repositoryAddress = webOfRemote(currentGit.value?.remote ?? null)?.base ?? null;
  return [
    {
      field: "folder",
      name: t("workspaceStatusSummary.folder"),
      value: workspaceCwd(workspace.workspace_id) ?? t("workspaceStatusSummary.noFolder"),
      href: null,
      copyValue: workspaceCwd(workspace.workspace_id),
      copyLabel: t("workspaceStatusSummary.copyFolder"),
    },
    {
      field: "branch",
      name: t("workspaceStatusSummary.branch"),
      value: currentGit.value?.branch ?? t("workspaceStatusSummary.noBranch"),
      href: null,
      copyValue: currentGit.value?.branch ?? null,
      copyLabel: t("workspaceStatusSummary.copyBranch"),
    },
    {
      field: "repository",
      name: t("workspaceStatusSummary.repository"),
      value: repositoryAddress ?? t("workspaceStatusSummary.noRepository"),
      href: repositoryAddress,
      copyValue: null,
      copyLabel: null,
    },
    { field: "tabs", name: t("workspaceStatusSummary.tabs"), value: workspace.tab_count, href: null, copyValue: null, copyLabel: null },
    { field: "agents", name: t("workspaceStatusSummary.agents"), value: agentCount, href: null, copyValue: null, copyLabel: null },
  ];
});

/**
 * Opens the web page of the repository in the web browser.
 *
 * @param address - The web address of the repository.
 */
async function openRepository(address: string): Promise<void> {
  await openUrl(address).catch(() => {});
}

/** Copies a workspace detail and briefly confirms the successful copy.
 * @param field - The detail field being copied.
 * @param value - The text to copy.
 */
async function copyDetail(field: string, value: string): Promise<void> {
  try {
    await writeText(value);
  } catch {
    try {
      if (navigator.clipboard === undefined) return;
      await navigator.clipboard.writeText(value);
    } catch {
      return;
    }
  }
  copiedDetail.value = field;
  if (copiedDetailTimer !== undefined) clearTimeout(copiedDetailTimer);
  copiedDetailTimer = setTimeout(() => {
    copiedDetail.value = null;
  }, 2000);
}

/**
 * Selects a workspace and closes the card.
 *
 * @param workspaceId - The identifier of the workspace.
 */
function choose(workspaceId: string): void {
  close();
  selectWorkspace(workspaceId);
}

/**
 * Starts the rename of a workspace, with a text field in the status bar, and closes the card.
 *
 * @param workspaceId - The identifier of the workspace.
 */
function renameFromList(workspaceId: string): void {
  close();
  startRename("ws", workspaceId);
}

/**
 * Asks for a confirmation, then closes a workspace. The question lives in the status bar section and not in the card, because
 * the card closes when the keyboard focus goes to the confirmation dialog. When the setting `confirmWorkspaceClose` is off,
 * the workspace closes at once, without the question.
 *
 * @param workspace - The workspace to close.
 */
async function askClose(workspace: WorkspaceInfo): Promise<void> {
  const isConfirmed =
    settings.confirmWorkspaceClose === false ||
    (await askConfirm(
      t("workspaceStatusSummary.close", { name: workspace.label }),
      t("workspaceStatusSummary.closeConfirm"),
    ));
  if (isConfirmed === true) {
    await closeWorkspace(workspace.workspace_id);
  }
}

/** Asks for the folder of a new workspace, then creates the workspace with the name of the folder. */
async function createWorkspace(): Promise<void> {
  close();
  const path = await openDialog({
    directory: true,
    multiple: false,
    title: t("workspaceStatusSummary.chooseFolder"),
    defaultPath: await homeDir(),
  });
  if (path === null) {
    return;
  }
  const label = path.split("/").filter(Boolean).pop() ?? null;
  await NewPane.openNewWorkspace(path, label);
}

// The command search renames the workspace too: the field replaces the name, so the card must not stay open.
watch(isRenaming, (renaming) => {
  if (renaming === true) {
    close();
  }
});
</script>

<template>
  <div
    ref="root"
    class="workspace-status status-section"
    :class="{ show: isOpen }"
    tabindex="0"
    @click="toggle"
    @keydown.enter.self.prevent="toggle"
    @keydown.space.self.prevent="toggle"
    @focusout="onFocusOut"
  >
    <InlineRename
      v-if="isRenaming"
      class="workspace-rename"
      :value="selectedLabel"
      :label="t('workspaceStatusSummary.newName')"
      @save="(value) => finishRename('ws', state.selectedWorkspaceId!, value)"
      @cancel="state.renaming = null"
    />
    <template v-else>
      <span class="dot" :class="dotClasses" :role="dotLabel === undefined ? undefined : 'img'" :aria-label="dotLabel"></span>
      <span class="name">{{ selectedLabel }}</span>
    </template>
    <div
      v-if="isOpen"
      class="popover popover-instant show bs-popover-top position-absolute bottom-100"
      role="dialog"
      :style="cardStyle"
      :aria-label="t('workspaceStatusSummary.workspaceTitle')"
      @click.stop
      @pointerenter="startScrolling"
      @pointerleave="stopScrolling"
    >
      <div class="popover-arrow position-absolute ms-3"></div>
      <div class="popover-body d-flex flex-column gap-2 overflow-y-auto" :style="{ maxHeight: '70vh' }">
        <h2 class="h6 mb-0 fw-semibold workspace-card-title">{{ t("workspaceStatusSummary.workspaceTitle") }}</h2>
        <div v-if="detailRows.length > 0" class="d-flex flex-column gap-2" data-field="details">
          <div v-for="row in detailRows" :key="row.field" class="detail-row d-flex justify-content-between gap-3">
            <span class="text-body-secondary flex-shrink-0">{{ row.name }}</span>
            <div class="detail-value d-flex align-items-center gap-1">
              <a
                v-if="row.href !== null"
                class="text-end text-break"
                :href="row.href"
                :data-field="row.field"
                @click.prevent="openRepository(row.href)"
              >{{ row.value }}</a>
              <ScrollingLine v-else-if="row.field === 'folder'" class="text-end" :data-field="row.field">{{ row.value }}</ScrollingLine>
              <span v-else class="text-end text-break" :data-field="row.field">{{ row.value }}</span>
              <button
                v-if="row.copyValue !== null && row.copyLabel !== null"
                type="button"
                class="btn btn-sm btn-outline-secondary copy-detail-button"
                :title="copiedDetail === row.field ? t('workspaceStatusSummary.copied') : row.copyLabel"
                :aria-label="copiedDetail === row.field ? t('workspaceStatusSummary.copied') : row.copyLabel"
                @click="copyDetail(row.field, row.copyValue)"
              ><Icon :name="copiedDetail === row.field ? 'clipboard-check' : 'clipboard'" /></button>
            </div>
          </div>
        </div>
        <div
          class="d-flex flex-column"
          :class="{ 'border-top pt-2': detailRows.length > 0 }"
          role="group"
          :aria-label="t('workspaceStatusSummary.listLabel')"
        >
          <InformationCardTooltip
            v-for="(workspace, workspaceIndex) in workspaces"
            :key="workspace.workspace_id"
            :title="workspace.label"
            :blocks="workspaceTooltipBlocks(workspace)"
            placement="side"
            v-slot="{ triggerProps }"
          >
            <div
              class="workspace-row d-flex align-items-center position-relative"
              :class="{
                active: workspace.workspace_id === state.selectedWorkspaceId,
                quiet: !workspaceHasAgent(workspace.workspace_id),
                dragging: workspaceReorder.dragging.value === workspace.workspace_id,
                'drop-before': workspaceReorder.gap.value === workspaceIndex,
                'drop-after': workspaceReorder.gap.value === workspaceIndex + 1 && workspaceIndex === workspaces.length - 1,
              }"
              :data-reorder-id="workspace.workspace_id"
              v-bind="triggerProps"
              @pointerdown="workspaceReorder.onPointerDown($event, workspaces.map((other) => other.workspace_id))"
            >
              <button
                type="button"
                class="btn border-0 d-flex align-items-center gap-2 h-auto text-start workspace-main"
                :aria-current="workspace.workspace_id === state.selectedWorkspaceId"
                @click="choose(workspace.workspace_id)"
              >
                <span class="dot" :class="workspaceDotClasses(workspace)"></span>
                <span
                  class="name"
                  :class="{
                    'text-body-secondary': !workspaceHasAgent(workspace.workspace_id) && workspace.workspace_id !== state.selectedWorkspaceId,
                  }"
                >{{ workspace.label }}</span>
                <VoiceRecordingIcon v-if="VoiceInput.isRecordingInWorkspace(workspace.workspace_id)" />
                <span
                  v-if="branchOf(workspace.workspace_id) !== null"
                  class="workspace-branch"
                >
                  <span class="workspace-branch-name">{{ branchOf(workspace.workspace_id) }}</span>
                </span>
              </button>
              <span class="row-actions">
                <button
                  type="button"
                  class="btn icon small row-button"
                  :aria-label="t('workspaceStatusSummary.rename', { name: workspace.label })"
                  :title="t('workspaceStatusSummary.rename', { name: workspace.label })"
                  @click.stop="renameFromList(workspace.workspace_id)"
                ><Icon name="pencil" /></button>
                <button
                  type="button"
                  class="btn icon small row-button"
                  :aria-label="t('workspaceStatusSummary.close', { name: workspace.label })"
                  :title="t('workspaceStatusSummary.close', { name: workspace.label })"
                  @click.stop="askClose(workspace)"
                ><Icon name="x-lg" /></button>
              </span>
            </div>
          </InformationCardTooltip>
        </div>
        <div v-if="workspaces.length > 0" class="border-top" role="separator"></div>
        <button
          type="button"
          class="btn border-0 d-flex align-items-center gap-2 h-auto text-start"
          :title="t('workspaceStatusSummary.newTitle')"
          @click="createWorkspace"
        >
          <Icon name="folder-symlink" /> {{ t("workspaceStatusSummary.new") }}
        </button>
        <button
          type="button"
          class="btn border-0 d-flex align-items-center gap-2 h-auto text-start"
          :disabled="selectedWorkspace === null || currentGit?.root === undefined"
          :title="selectedWorkspace !== null && currentGit?.root !== undefined ? t('workspaceStatusSummary.openGitWorktreeTitle') : undefined"
          @click="openGitWorktrees"
        >
          <Icon name="diagram-3" /> {{ t("workspaceStatusSummary.openGitWorktree") }}
        </button>
      </div>
    </div>
    <GitWorktreesModal
      v-if="isWorktreesOpen && currentGit?.root"
      :root="currentGit.root"
      :visible="isWorktreesVisible"
      @close="closeGitWorktrees"
      @loaded="showGitWorktrees"
    />
  </div>
</template>

<style scoped>
.workspace-status {
  max-width: 260px;
  display: flex; align-items: center; gap: 8px; color: var(--text-2); font-weight: 600;
}
.workspace-rename { width: 180px; height: 26px; }
.detail-row { min-width: 0; }
.detail-value { min-width: 0; }
.detail-value > [data-field="folder"] { min-width: 0; }
.copy-detail-button { flex: 0 0 auto; }
.workspace-status > .popover { cursor: default; }
.workspace-status > .popover .btn:not(:disabled) { cursor: pointer; }
.name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* The name takes only its width, so the recording icon of the voice input sits right after it (issue 762). */
.workspace-main > .name { flex: 0 1 auto; }
.workspace-row { min-height: 32px; border-radius: 6px; }
.workspace-main { flex: 1; min-width: 0; align-self: stretch; }
.workspace-branch {
  display: flex; align-items: center; gap: 4px; flex: 0 1 auto; min-width: 0; max-width: 50%; margin-left: auto;
  overflow: hidden; color: var(--muted); font-size: calc(var(--font-size) * 0.8); font-weight: 400; line-height: 1.2;
}
.workspace-branch-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.workspace-row:hover, .workspace-row:focus-within { background: var(--hover-soft); }
.workspace-row.active { background: var(--hover); }
.row-actions {
  position: absolute; top: 50%; right: 6px; z-index: 1; display: none; align-items: center; gap: 2px; padding-right: 2px;
  transform: translateY(-50%); background: var(--hover-soft);
}
.workspace-row.active .row-actions { background: var(--hover); }
.workspace-row:hover .row-actions, .workspace-row:focus-within .row-actions { display: flex; }
.row-button { display: inline-flex; align-items: center; justify-content: center; min-width: 22px; }
.workspace-row.dragging { opacity: 0.4; }
.workspace-row.drop-before::before, .workspace-row.drop-after::after {
  content: ""; position: absolute; left: 6px; right: 6px; height: 2px; border-radius: 1px; background: var(--done);
}
.workspace-row.drop-before::before { top: -1px; }
.workspace-row.drop-after::after { bottom: -1px; }
</style>
