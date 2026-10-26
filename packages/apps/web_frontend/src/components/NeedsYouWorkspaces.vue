<script setup lang="ts">
import {
  moveWorkspace,
  selectWorkspace,
  state,
  workspaceDotClasses,
  workspaceHasAgent,
  workspaces,
} from "../stores/session";
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { git } from "../stores/git";
import { settings } from "../stores/settings";
import { useReorder } from "../lib/reorder";
import { VoiceInput } from "../lib/voice_input";
import VoiceRecordingIcon from "./VoiceRecordingIcon.vue";
import { NeedsYouWorkspacesHeight } from "../lib/needs_you_workspaces_height";
import { t } from "../i18n/index";

// The list of workspaces at the bottom of the Needs you sidebar section: a separator line, the title "Workspaces", and one row
// for each workspace, with its status dot and its name. The rows have the order of the list in the information card of the
// workspace status bar section, and the same drag and drop. A click on a row selects the workspace. The Git branch of the
// workspace sits at the right end of the row. The list touches the left, the right, and the bottom border of the sidebar
// section, and the highlight of a row has no rounded corner. The title and the status dot are 14 pixels from the left border,
// like the first character of the message of `ToHandlePanel.vue` (6 pixels of padding of the cards, 8 pixels of the message).
const workspaceReorder = useReorder("y", (id, at) => moveWorkspace(id, at));

// The separator line above the title is a line to drag, like the line between the viewport and the right sidebar: dragging it
// up makes the list taller. The height is saved in the setting `needsYouWorkspacesHeight` when the drag ends, and 0 means the
// default, the height of the rows up to 40 percent of the sidebar section. A double click goes back to the default. The rows scroll when they do not fit, and the
// title stays (issue #807).
const list = ref<HTMLElement | null>(null);
const isResizing = ref(false);
/** The height during a drag, in pixels, or null when no drag runs: the setting is saved only when the drag ends. */
const dragHeight = ref<number | null>(null);
let startY = 0;
let startHeight = 0;

/** The chosen height, during a drag or saved, or null for the default height. */
const chosenHeight = computed(() => dragHeight.value ?? (settings.needsYouWorkspacesHeight > 0 ? settings.needsYouWorkspacesHeight : null));

// A chosen height never takes the last pixels of the cards, also when the window gets smaller after the drag.
// The smallest height applies only to a chosen height: the default height stays the height of the rows.
const listStyle = computed(() =>
  chosenHeight.value === null
    ? {}
    : {
        height: `${chosenHeight.value}px`,
        minHeight: `${NeedsYouWorkspacesHeight.MIN}px`,
        maxHeight: `calc(100% - ${NeedsYouWorkspacesHeight.CARDS_MIN}px)`,
      },
);

/** The height of the list now, in pixels. */
function currentHeight(): number {
  return list.value?.getBoundingClientRect().height ?? NeedsYouWorkspacesHeight.MIN;
}

/** The height of the whole Needs you sidebar section, in pixels. */
function sectionHeight(): number {
  return list.value?.parentElement?.getBoundingClientRect().height ?? 0;
}

/** Gives a new height of the list, kept between its limits. */
function limited(height: number): number {
  return NeedsYouWorkspacesHeight.clamp(height, sectionHeight());
}

function onResizeDown(event: PointerEvent) {
  isResizing.value = true;
  startY = event.clientY;
  startHeight = currentHeight();
  (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
  document.body.style.cursor = "row-resize";
  event.preventDefault();
  event.stopPropagation();
}

function onResizeMove(event: PointerEvent) {
  if (isResizing.value === false) {
    return;
  }
  dragHeight.value = limited(startHeight - (event.clientY - startY));
}

/** Ends a drag: saves the height when the line moved, and gives the cursor back. */
function onResizeUp() {
  if (isResizing.value === false) {
    return;
  }
  isResizing.value = false;
  document.body.style.cursor = "";
  if (dragHeight.value !== null) {
    settings.needsYouWorkspacesHeight = dragHeight.value;
    dragHeight.value = null;
  }
}

// The list disappears when the last workspace closes, also during a drag: the drag ends, so the cursor does not stay.
watch(list, (element) => {
  if (element === null) {
    onResizeUp();
  }
});

function onResizeKey(event: KeyboardEvent) {
  const step = event.shiftKey ? NeedsYouWorkspacesHeight.LARGE_STEP : NeedsYouWorkspacesHeight.STEP;
  if (event.key === "ArrowUp") {
    settings.needsYouWorkspacesHeight = limited(currentHeight() + step);
  } else if (event.key === "ArrowDown") {
    settings.needsYouWorkspacesHeight = limited(currentHeight() - step);
  } else {
    return;
  }
  event.preventDefault();
}

onBeforeUnmount(() => {
  if (isResizing.value === true) {
    document.body.style.cursor = "";
  }
});

/**
 * Gives the current Git branch of a workspace.
 *
 * @param workspaceId - The identifier of the workspace.
 * @returns The name of the branch, or null when the workspace has no Git repository or Herdr has not read it yet.
 */
function branchOf(workspaceId: string): string | null {
  return git.status[workspaceId]?.branch ?? null;
}
</script>

<template>
  <div v-if="workspaces.length > 0" ref="list" class="needs-you-workspaces border-top" :style="listStyle">
    <div
      class="workspaces-resizer"
      :class="{ active: isResizing }"
      role="separator"
      aria-orientation="horizontal"
      :aria-valuenow="chosenHeight ?? undefined"
      :aria-valuemin="NeedsYouWorkspacesHeight.MIN"
      :aria-label="t('needsYouWorkspaces.resizeLabel')"
      tabindex="0"
      :title="t('resizer.title')"
      @pointerdown="onResizeDown"
      @pointermove="onResizeMove"
      @pointerup="onResizeUp"
      @pointercancel="onResizeUp"
      @lostpointercapture="onResizeUp"
      @dblclick="settings.needsYouWorkspacesHeight = 0"
      @keydown="onResizeKey"
    ></div>
    <div class="title text-body-secondary">{{ t("needsYouWorkspaces.title") }}</div>
    <div class="workspace-rows d-flex flex-column" role="group" :aria-label="t('needsYouWorkspaces.listLabel')">
      <div
        v-for="(workspace, workspaceIndex) in workspaces"
        :key="workspace.workspace_id"
        class="workspace-row d-flex align-items-center position-relative"
        :class="{
          active: workspace.workspace_id === state.selectedWorkspaceId,
          quiet: !workspaceHasAgent(workspace.workspace_id),
          dragging: workspaceReorder.dragging.value === workspace.workspace_id,
          'drop-before': workspaceReorder.gap.value === workspaceIndex,
          'drop-after': workspaceReorder.gap.value === workspaceIndex + 1 && workspaceIndex === workspaces.length - 1,
        }"
        :data-reorder-id="workspace.workspace_id"
        @pointerdown="workspaceReorder.onPointerDown($event, workspaces.map((other) => other.workspace_id))"
      >
        <button
          type="button"
          class="btn border-0 d-flex align-items-center gap-2 h-auto text-start workspace-main"
          :aria-current="workspace.workspace_id === state.selectedWorkspaceId"
          :title="t('needsYouWorkspaces.rowTitle')"
          @click="selectWorkspace(workspace.workspace_id)"
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
            class="branch text-body-secondary"
            :title="branchOf(workspace.workspace_id) ?? undefined"
          >{{ branchOf(workspace.workspace_id) }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* The list is a column: the title stays, and only the rows scroll when they do not fit in the height (issue #807). */
.needs-you-workspaces {
  flex-shrink: 0; position: relative; display: flex; flex-direction: column; max-height: 40%; padding: 12px 0 0;
}
.workspace-rows { flex: 1 1 auto; min-height: 0; overflow-y: auto; }
/* The place to grab the separator line, like the line between the viewport and the right sidebar: it takes no room, it covers
   the line, and its color fills the width of the sash under the pointer and while dragging. */
.workspaces-resizer {
  position: absolute; left: 0; right: 0; top: calc(var(--pane-gap) / -2 - 0.5px); height: var(--pane-gap); z-index: 1;
  cursor: row-resize; touch-action: none; background: transparent; transition: background 0.15s;
}
.workspaces-resizer:hover, .workspaces-resizer.active, .workspaces-resizer:focus-visible { background: var(--done); }
.workspaces-resizer:focus-visible { outline: none; }
.title { flex-shrink: 0; padding: 0 14px 8px; font-size: var(--font-size); font-weight: 600; }
.name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.branch { flex: 0 1 auto; min-width: 0; max-width: 50%; margin-left: auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.workspace-row { min-height: 40px; border-radius: 0; }
.workspace-main { flex: 1; min-width: 0; align-self: stretch; padding-left: 14px; border-radius: 0; background: transparent; }
.workspace-row:hover, .workspace-row:focus-within { background: var(--hover-soft); }
.workspace-row.active { background: var(--hover); }
.workspace-row.dragging { opacity: 0.4; }
.workspace-row.drop-before::before, .workspace-row.drop-after::after {
  content: ""; position: absolute; left: 6px; right: 6px; height: 2px; border-radius: 1px; background: var(--done);
}
.workspace-row.drop-before::before { top: -1px; }
.workspace-row.drop-after::after { bottom: -1px; }
</style>
