<script setup lang="ts">
import { computed, ref } from "vue";
import TerminalView from "./TerminalView.vue";
import FileView from "./FileView.vue";
import DiffPane from "./DiffPane.vue";
import ConfirmButton from "./ConfirmButton.vue";
import Icon from "./Icon.vue";
import InlineRename from "./InlineRename.vue";
import MacroMenu from "./MacroMenu.vue";
import UsageWheel from "./UsageWheel.vue";
import CompositionBar from "./CompositionBar.vue";
import { closePane, contextFor, finishRename, paneFullName, selectPane, startRename, state } from "../stores/session";
import { allPinnedPanes, gridPanes, isPinned, pinnedPaneState, togglePinnedPane, unpinPane } from "../stores/pinned_panes";
import { NewPane } from "../stores/new_pane";
import { PaneMoveDrag } from "../stores/pane_move";
import { git } from "../stores/git";
import { settings } from "../stores/settings";
import { mosaic } from "../stores/mosaic";
import { CompositionBar as CompositionBarStore } from '../stores/composition_bar';
import { ImageDrop } from "../lib/image_drop";
import { FileViewLabel } from "../lib/file_view_label";
import { DiffPaneLabel } from "../lib/diff_pane_label";
import { paneDynamicName, paneName, shortPath } from "../lib/format";
import { pinText } from "../stores/notes";
import { ZenMode } from "../stores/zen_mode";
import type { AgentInfo } from "../lib/types";
import { t } from "../i18n/index";

// `isInColumnOfPinnedPanes`: shown in the column of pinned panes, in every tab, the tab of the pane included.
const props = defineProps<{ pane: AgentInfo; isInColumnOfPinnedPanes?: boolean }>();

// A pinned pane that is the selected pane of the selected tab has the keyboard until another pinned pane takes it.
const selected = computed(() => {
  if (ZenMode.state.isActive) {
    return ZenMode.state.paneId === props.pane.pane_id;
  }
  return props.isInColumnOfPinnedPanes
    ? pinnedPaneState.focus === props.pane.pane_id ||
        (pinnedPaneState.focus === null && state.selectedPaneId === props.pane.pane_id)
    : state.selectedPaneId === props.pane.pane_id && !pinnedPaneState.focus;
});
// The highlight of the selected pane shows only when the viewport shows several panes: the panes of the selected tab that the
// grid draws, and the pinned panes of the column of pinned panes.
const hasSeveralPanes = computed(() => gridPanes.value.length + allPinnedPanes.value.length > 1);
const pinned = computed(() => isPinned(props.pane.pane_id));
// A press on the header, away from its buttons, followed by a move of the pointer, moves the pane. A pinned pane of the column
// of pinned panes stays where it is: it has no grid to drop on, and it cannot receive a drop.
function onHeaderPointerDown(event: PointerEvent) {
  if (props.isInColumnOfPinnedPanes) {
    return;
  }
  PaneMoveDrag.onPointerDown(event, props.pane.pane_id);
}
const compositionBar = computed(() => CompositionBarStore.forPane(props.pane.pane_id));
// A click in a pinned pane gives it the keyboard without leaving the current tab.
function onDown() {
  if (props.isInColumnOfPinnedPanes) {
    pinnedPaneState.focus = props.pane.pane_id;
    ZenMode.focusPane(props.pane.pane_id, props.pane.tab_id);
  } else {
    selectPane(props.pane);
    pinnedPaneState.focus = null;
  }
}
const paneElement = ref<HTMLElement | null>(null);
// The header of a file view pane or of a diff pane holds the controls of the file, which the body of the pane draws there.
const viewControlsHost = ref<HTMLElement | null>(null);
// After the composition bar sends its images and its text, the keyboard goes back to the terminal, so that the developer can speak or type, then send.
function focusTerminal() {
  paneElement.value?.querySelector<HTMLTextAreaElement>("textarea.xterm-helper-textarea")?.focus();
}
const status = computed(() => (props.pane.agent ? props.pane.agent_status : "process"));
const ctx = computed(() => contextFor(props.pane));
const shellFolder = computed(() => props.pane.foreground_cwd || props.pane.cwd || "");
const displayName = computed(() => paneName(props.pane));
// A file view pane shows a file, read only, in place of its terminal. The label of the pane holds the absolute path of the file.
const fileViewPath = computed(() => FileViewLabel.parse(props.pane.label));
// A diff pane shows the changes of a file, read only, in place of its terminal. The label of the pane holds the absolute path of
// the file (issue #885).
const diffPath = computed(() => DiffPaneLabel.parse(props.pane.label));
// The absolute path of the file of a file view pane or of a diff pane, or null for a terminal.
const viewPath = computed(() => fileViewPath.value ?? diffPath.value);
function closePaneFromHeader() {
  closePane(props.pane.pane_id);
}
const subtitle = computed(() => {
  const p = props.pane;
  if (viewPath.value !== null) return shortPath(viewPath.value);
  if (props.isInColumnOfPinnedPanes) return paneFullName(p);
  if (p.agent) return `${p.agent} · ${p.pane_id}`;
  const branch = git.branchByFolder[shellFolder.value];
  const path = shortPath(shellFolder.value) || p.pane_id;
  const parts = [p.label ? paneDynamicName(p) : "", branch ?? "", path];
  return parts.filter((part) => part !== "").join(" · ");
});
</script>

<template>
  <section
    ref="paneElement"
    class="pane"
    :class="[status, { selected, 'several-panes': hasSeveralPanes, 'in-column-of-pinned-panes': isInColumnOfPinnedPanes }]"
    :data-pane-move-destination="isInColumnOfPinnedPanes ? undefined : pane.pane_id"
    @mousedown="onDown"
  >
    <div v-if="status === 'working'" class="sweep" aria-hidden="true"><span></span></div>
    <header class="head" @pointerdown="onHeaderPointerDown">
      <span class="dot" :class="status"></span>
      <InlineRename
        v-if="state.renaming === `pane:${pane.pane_id}`"
        class="pane-rename"
        :value="pane.label || displayName"
        :label="t('paneCard.renameLabel')"
        allow-empty
        @save="(v) => finishRename('pane', pane.pane_id, v)"
        @cancel="state.renaming = null"
      />
      <span v-else-if="viewPath !== null" class="name" :title="viewPath">{{ displayName }}</span>
      <span v-else class="name" :title="t('paneCard.nameTitle', { name: displayName })" @dblclick="startRename('pane', pane.pane_id)">{{ displayName }}</span>
      <span class="sub" :class="{ 'file-view-path': viewPath !== null }">{{ subtitle }}</span>
      <span v-if="viewPath !== null" ref="viewControlsHost" class="file-view-controls"></span>
      <span class="spacer"></span>
      <span class="tools">
        <UsageWheel v-if="ctx" :usage="ctx" />
        <button
          v-if="viewPath === null"
          class="btn icon small tool"
          :class="{ on: compositionBar.isOpen }"
          :aria-pressed="compositionBar.isOpen"
          :aria-label="t('paneCard.compositionBar')"
          :title="t('paneCard.compositionBarTitle')"
          @mousedown.stop="onDown"
          @click="ImageDrop.toggleBar(pane.pane_id)"
        >
          <Icon name="input-cursor-text" />
        </button>
        <MacroMenu v-if="viewPath === null" :pane-id="pane.pane_id" />
        <template v-if="isInColumnOfPinnedPanes">
          <button class="btn icon small tool" :title="t('paneCard.goToTab')" @mousedown.stop @click="selectPane(pane)"><Icon name="box-arrow-up-right" /></button>
          <button
            class="btn icon small tool on"
            aria-pressed="true"
            :aria-label="t('paneCard.unpin')"
            :title="t('paneCard.unpinTitle')"
            @mousedown.stop
            @click="unpinPane(pane.pane_id)"
          >
            <Icon name="pin-fill" />
          </button>
        </template>
        <template v-else>
        <button
          v-if="(pane.agent ?? '').includes('claude')"
          class="btn icon small tool"
          :title="t('paneCard.mosaicTitle')"
          :aria-label="t('paneCard.mosaic')"
          @mousedown.stop
          @click="mosaic.paneId = pane.pane_id"
        ><Icon name="grid-3x3-gap" /></button>
        <button
          class="btn icon small tool"
          :class="{ on: pinned }"
          :aria-pressed="pinned"
          :title="pinned ? t('paneCard.unpin') : t('paneCard.pinTitle')"
          @mousedown.stop
          @click="togglePinnedPane(pane.pane_id)"
        >
          <Icon :name="pinned ? 'pin-fill' : 'pin'" />
        </button>
        <button class="btn icon small tool" :aria-label="t('paneCard.splitRight')" :title="t('paneCard.splitRightTitle')" @mousedown.stop @click="NewPane.onSplitPaneClick($event, 'right', pane.pane_id)">
          <Icon name="layout-split" />
        </button>
        <button class="btn icon small tool" :aria-label="t('paneCard.splitDown')" :title="t('paneCard.splitDownTitle')" @mousedown.stop @click="NewPane.onSplitPaneClick($event, 'down', pane.pane_id)">
          <Icon name="layout-split" class="rotated" />
        </button>
        </template>
        <button
          class="btn icon small tool"
          :class="{ on: ZenMode.state.isActive }"
          :aria-pressed="ZenMode.state.isActive"
          :aria-label="ZenMode.state.isActive ? t('paneCard.zenModeExit') : t('paneCard.zenModeEnter')"
          :title="ZenMode.state.isActive ? t('paneCard.zenModeExit') : t('paneCard.zenModeEnter')"
          @mousedown.stop
          @click="ZenMode.toggle(pane.pane_id, pane.tab_id)"
        >
          <Icon :name="ZenMode.state.isActive ? 'fullscreen-exit' : 'arrows-fullscreen'" />
        </button>
        <ConfirmButton
          v-if="isInColumnOfPinnedPanes !== true || ZenMode.state.isActive"
          icon="x-lg"
          :confirm-label="t('paneCard.closeConfirm')"
          :question="t('paneCard.close')"
          :is-confirm-required="settings.confirmPaneClose"
          @confirm="closePaneFromHeader"
        />
      </span>
    </header>
    <FileView v-if="fileViewPath !== null" :pane="pane" :controls-host="viewControlsHost" />
    <DiffPane v-else-if="diffPath !== null" :pane="pane" :controls-host="viewControlsHost" />
    <TerminalView
      v-else
      :key="pane.terminal_id"
      :terminal-id="pane.terminal_id"
      :pane-id="pane.pane_id"
      :cwd="pane.foreground_cwd || pane.cwd"
      :agent="pane.agent"
      :focused="selected"
      @pin="(text) => pinText(text, pane)"
    />
    <CompositionBar v-if="viewPath === null && compositionBar.isOpen" :pane-id="pane.pane_id" @sent="focusTerminal" />
  </section>
</template>

<style scoped>
/* A pane has no rounded corner: the panes touch each other and the border of the viewport, and the viewport clips the
   corners that touch its own rounded corners. The border of a pane is the line between two panes. At the edge of the viewport,
   the border of the pane is hidden under the border of the viewport. */
.pane {
  height: 100%; display: flex; flex-direction: column; background: var(--bg); position: relative; z-index: 0;
  border: 1px solid var(--line); overflow: hidden;
}
/* The ring of a blocked pane and of the selected pane has two parts. At the top, the ring is the border itself, so that the outline
   of the selected tab of the tab bar joins the ring without an offset. On the left, on the right, and at the bottom, the ring is
   drawn just inside the border, so that it also shows where the viewport hides the border. The ring goes over the border of the
   next pane that it touches. */
.pane::after {
  content: ""; position: absolute; inset: 0; z-index: 2; pointer-events: none;
  border: 0 solid transparent; border-width: 0 1px 1px;
}
.pane.blocked { border-top-color: var(--pane-ring-blocked); z-index: 1; }
.pane.selected { border-top-color: var(--pane-ring-selected); z-index: 1; }
.pane.blocked.selected { border-top-color: var(--pane-ring-blocked-selected); }
.pane.blocked::after { border-color: var(--pane-ring-blocked); }
.pane.selected::after { border-color: var(--pane-ring-selected); }
.pane.blocked.selected::after { border-color: var(--pane-ring-blocked-selected); }
.sweep { position: absolute; top: 0; left: 0; right: 0; height: 2px; overflow: hidden; background: var(--tint-working); z-index: 1; }
.sweep span {
  position: absolute; top: 0; left: 0; width: 40%; height: 2px;
  background: linear-gradient(90deg, transparent, var(--working), transparent);
  animation: sweep 2.4s ease-in-out infinite;
}
.head {
  height: 34px; flex-shrink: 0; display: flex; align-items: center; gap: 8px; padding: 0 14px;
  border-bottom: 1px solid var(--pane-head-line); font-size: var(--font-size);
}
/* When the viewport shows several panes, the header of the selected pane has a tinted background, and the name and the folder of
   every other pane are dimmed, so that the selected pane is the one pane with a full contrast. A blocked pane keeps the red look
   of its header and its text. A viewport with one pane has no highlight, because there is no other pane to tell it from. */
.pane.several-panes.selected:not(.blocked) .head { background: var(--pane-head-selected); }
.pane.blocked .head { background: var(--tint-err); border-bottom-color: var(--pane-head-line-blocked); }
.pane.several-panes:not(.selected):not(.blocked) .name { color: var(--muted); }
.pane.several-panes:not(.selected):not(.blocked) .sub { color: var(--muted); }
.name { min-width: 0; overflow: hidden; text-overflow: ellipsis; font-weight: 600; white-space: nowrap; cursor: default; }
.pane-rename { width: 180px; height: 24px; }
.sub { color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* In a file view pane and in a diff pane, a narrow header shortens the short path first, then the name. The controls of the file stay visible. */
.sub.file-view-path { min-width: 0; flex-shrink: 10000; }
.file-view-controls { flex-shrink: 0; display: flex; align-items: center; gap: 8px; margin-left: 4px; }
.spacer { flex: 1; }
/* The information card of the usage wheel is inside the pane, so the pane that holds the open card goes above the panes
   that come after it. Without this, the next pane hides the part of the card that goes over it. The level 8 is also above
   the lines between the panes (5), the line of the right sidebar (6), and the corners of the viewport (7) (issue #586). */
.pane:has(.information-card-part.is-open) { z-index: 8; }
/* The usage wheel is the first item of the tools, so it appears and disappears with the buttons, and it is 2 pixels from the first button. */
.tools {
  flex-shrink: 0; display: flex; align-items: center; gap: 2px;
  opacity: 0; visibility: hidden; pointer-events: none;
  transition: opacity 0.15s ease, visibility 0s linear 0.15s;
}
.pane:hover .tools {
  opacity: 1; visibility: visible; pointer-events: auto; transition-delay: 0s;
}
.tool { display: inline-flex; align-items: center; justify-content: center; }
.pane.in-column-of-pinned-panes .head { background: var(--bar); }
.pane.in-column-of-pinned-panes.several-panes.selected:not(.blocked) .head { background: var(--pane-head-selected); }
</style>
