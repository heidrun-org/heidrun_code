<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from "vue";
import ConfirmButton from "./ConfirmButton.vue";
import Icon from "./Icon.vue";
import InlineRename from "./InlineRename.vue";
import VoiceRecordingIcon from "./VoiceRecordingIcon.vue";
import { allPanes, closeTab, finishRename, moveTab, selectTab, startRename, state, tabLabel, tabs } from "../stores/session";
import { remote } from "../stores/claude";
import { settings } from "../stores/settings";
import { useReorder } from "../lib/reorder";
import { tabIconName } from "../lib/tab_icon";
import { VoiceInput } from "../lib/voice_input";
import { NewPane } from "../stores/new_pane";
import { NewTabCommands, type NewTabCommand } from "../stores/new_tab_commands";
import { PaneMoveDrag } from "../stores/pane_move";
import { t } from "../i18n/index";

const tabReorder = useReorder("x", (id, at) => moveTab(id, at));

/** The tab ids in the order of the tab bar. */
const tabIds = computed(() => tabs.value.map((tab) => tab.tab_id));

/** The icon of the tab: the icon of the agent in the pane that decides the status dot, or the terminal icon. */
function iconOf(tabId: string): string {
  return tabIconName(allPanes.value.filter((pane) => pane.tab_id === tabId), state.selectedPaneId);
}

/** True when Remote Control is connected to a pane of the tab. */
function isRemoteControlled(tabId: string): boolean {
  return allPanes.value.some((pane) => pane.tab_id === tabId && remote.byPane[pane.pane_id] === "active");
}

/** How long the developer presses the plus button, in milliseconds, before the list of the commands of a new tab opens. */
const LONG_PRESS_MS = 500;

/** True while the list of the commands of a new tab is open. */
const isCommandListOpen = ref(false);
const plusButton = ref<HTMLButtonElement>();
const commandMenu = ref<HTMLElement>();
/** Where the list sits, in pixels from the top and from the left edge of the window. */
const commandMenuPosition = ref({ top: 0, left: 0 });
/** The commands of the list: the terminal, and each coding agent switched on in the Settings window. */
const commandList = computed(() => NewTabCommands.available());

let pressTimer: ReturnType<typeof setTimeout> | null = null;
/** True from the moment a long press opens the list until the next press: the click that ends the press is ignored. */
let isLongPress = false;

/** Stops the wait for a long press. */
function cancelPress() {
  if (pressTimer !== null) {
    clearTimeout(pressTimer);
    pressTimer = null;
  }
}

/** Starts the wait for a long press. The list opens when the developer keeps the plus button pressed long enough. */
function onPlusPointerDown(event: PointerEvent) {
  isLongPress = false;
  cancelPress();
  if (event.button !== 0) {
    return;
  }
  pressTimer = setTimeout(() => {
    pressTimer = null;
    isLongPress = true;
    openCommandList();
  }, LONG_PRESS_MS);
}

/** Creates a tab with the default command of a new tab, or a terminal on a shift click, unless the click ends a long press. */
function onPlusClick(event: MouseEvent) {
  if (isLongPress) {
    isLongPress = false;
    return;
  }
  NewPane.onNewPaneClick(event);
}

/** Opens the list under the plus button, and keeps it inside the window. */
function openCommandList() {
  if (plusButton.value === undefined) {
    return;
  }
  const rect = plusButton.value.getBoundingClientRect();
  commandMenuPosition.value = { top: rect.bottom + 6, left: Math.max(8, rect.left) };
  isCommandListOpen.value = true;
  nextTick(() => {
    const menuWidth = commandMenu.value?.offsetWidth ?? 0;
    commandMenuPosition.value.left = Math.max(8, Math.min(commandMenuPosition.value.left, window.innerWidth - menuWidth - 8));
    document.addEventListener("mousedown", onDocumentMouseDown, true);
    document.addEventListener("keydown", onKeyDown, true);
  });
}

/** Closes the list. */
function closeCommandList() {
  isCommandListOpen.value = false;
  document.removeEventListener("mousedown", onDocumentMouseDown, true);
  document.removeEventListener("keydown", onKeyDown, true);
}

/** Closes the list on a click outside the list and outside the plus button. */
function onDocumentMouseDown(event: MouseEvent) {
  const target = event.target as Node;
  if (commandMenu.value?.contains(target) === true || plusButton.value?.contains(target) === true) {
    return;
  }
  closeCommandList();
}

/** Closes the list on the key Escape, and gives the keyboard focus back to the plus button. */
function onKeyDown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.stopPropagation();
    closeCommandList();
    plusButton.value?.focus();
  }
}

/** Creates a tab with the chosen command, and closes the list. */
function chooseCommand(commandId: NewTabCommand["id"]) {
  closeCommandList();
  void NewPane.startNewTab(commandId);
}

onBeforeUnmount(() => {
  cancelPress();
  closeCommandList();
});
</script>

<template>
  <div class="tab-bar d-flex gap-2">
    <ul class="nav nav-tabs" role="tablist" :aria-label="t('tabBar.label')">
      <li v-for="(tab, tabIndex) in tabs" :key="tab.tab_id" class="nav-item position-relative" role="presentation" :data-reorder-id="tab.tab_id" :data-tab-id="tab.tab_id">
        <div v-if="state.renaming === `tab:${tab.tab_id}`" class="nav-link active d-flex align-items-center gap-2">
          <span class="dot" :class="tab.agent_status === 'idle' ? '' : tab.agent_status"></span>
          <Icon :name="iconOf(tab.tab_id)" class="tab-icon" />
          <InlineRename
            class="tab-rename"
            :value="tabLabel(tab.tab_id)"
            :label="t('tabBar.newName')"
            @save="(value) => finishRename('tab', tab.tab_id, value)"
            @cancel="state.renaming = null"
          />
        </div>
        <div
          v-else
          class="nav-link tab-closable d-flex align-items-center gap-2"
          role="presentation"
          :class="{
            active: tab.tab_id === state.selectedTabId,
            dragging: tabReorder.dragging.value === tab.tab_id,
            'drop-before': tabReorder.gap.value === tabIndex,
            'drop-after': tabReorder.gap.value === tabIndex + 1 && tabIndex === tabs.length - 1,
          }"
          @pointerdown="tabReorder.onPointerDown($event, tabIds)"
        >
          <button
            class="navigation-action tab-main d-flex align-items-center gap-2"
            role="tab"
            :aria-selected="tab.tab_id === state.selectedTabId"
            :title="t('tabBar.tabTitle', { name: tabLabel(tab.tab_id) })"
            @click="selectTab(tab.tab_id)"
            @dblclick="startRename('tab', tab.tab_id)"
          >
            <span class="dot" :class="tab.agent_status === 'idle' ? '' : tab.agent_status"></span>
            <Icon :name="iconOf(tab.tab_id)" class="tab-icon" />
            <span class="tab-label">{{ tabLabel(tab.tab_id) }}</span>
            <VoiceRecordingIcon v-if="VoiceInput.isRecordingInTab(tab.tab_id)" />
            <span v-if="isRemoteControlled(tab.tab_id)" class="rc" :title="t('tabBar.remoteControlConnected')">{{ t("tabBar.remoteControlBadge") }}</span>
          </button>
          <ConfirmButton
            icon="x-lg"
            :confirm-label="t('tabBar.closeConfirm')"
            :question="t('tabBar.close', { name: tabLabel(tab.tab_id) })"
            :is-confirm-required="settings.confirmTabClose && tabs.length > 1"
            @confirm="closeTab(tab.tab_id)"
          />
        </div>
      </li>
    </ul>
    <button
      ref="plusButton"
      class="btn justify-content-center add"
      :class="PaneMoveDrag.state.isNewTabTargeted ? 'pane-drop-target' : 'border-0'"
      data-pane-move-new-tab
      :title="t('tabBar.newTabTitle')"
      :aria-label="t('tabBar.newTabTitle')"
      @pointerdown="onPlusPointerDown"
      @pointerup="cancelPress"
      @pointerleave="cancelPress"
      @pointercancel="cancelPress"
      @click="onPlusClick"
    ><Icon name="plus-lg" /></button>
    <Teleport to="body">
      <div
        v-if="isCommandListOpen"
        ref="commandMenu"
        class="menu show position-fixed"
        role="menu"
        :aria-label="t('tabBar.commandMenuLabel')"
        :style="{ top: `${commandMenuPosition.top}px`, left: `${commandMenuPosition.left}px` }"
      >
        <button
          v-for="command in commandList"
          :key="command.id"
          type="button"
          class="menu-item"
          role="menuitem"
          :data-command="command.id"
          :title="t(command.titleKey)"
          @click="chooseCommand(command.id)"
        >
          {{ t(command.labelKey) }}
        </button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* As in Visual Studio Code, no gap separates the tab bar from the panes. The bar goes 1 pixel over the top of the panes, and
   the selected tab goes down to the bottom of the bar: it covers the border of the panes and joins the pane. The border of the panes
   is the line under the other tabs. The first tab starts at the left edge of the panes. The outline of the selected tab has the
   color of the border of the selected pane, so the two outlines make one line. */
.tab-bar {
  position: relative; z-index: 2; flex-shrink: 0; min-width: 0; align-items: flex-end; padding: 4px var(--pane-radius) 0 0;
  margin-bottom: -1px;
}
/* Bootstrap draws the tabs: a border around the selected tab and around the tab under the
   mouse. These variables give Bootstrap the colors of the application. The selected tab has the color of the panes. */
.nav-tabs {
  --nav-tabs-border-width: 1px;
  --nav-tabs-border-color: var(--line-strong);
  --nav-tabs-border-radius: 8px;
  --nav-tabs-link-hover-border-color: var(--line) var(--line) transparent;
  --nav-tabs-link-active-border-color: var(--pane-ring-selected) var(--pane-ring-selected) var(--bg);
  --nav-tabs-link-active-color: var(--text);
  --nav-tabs-link-active-bg: var(--bg);
  --nav-link-padding-x: 18px;
  --nav-link-padding-y: 0;
  --nav-link-font-weight: 500;
  --nav-link-color: var(--muted);
  --nav-link-hover-color: var(--text-2);
  flex-wrap: nowrap; align-items: flex-start; min-width: 0; margin: 0; gap: 2px; border-bottom: 0; overflow-x: auto; scrollbar-width: none;
}
.nav-item { flex: 0 1 auto; min-width: 170px; max-width: 260px; }
/* The height of a tab is fixed, so that the rename field cannot make the tab bar higher. The selected tab is 1 pixel higher than
   the other tabs: the 1 pixel that goes over the panes. It has no border at the bottom, so that its left and right borders go down
   to the border of the panes. */
.nav-tabs .nav-link { width: 100%; height: 40px; margin-bottom: 0; background-color: rgba(var(--wash), 0.04); }
.nav-tabs .nav-link:not(.active):hover { background-color: var(--overlay-hover); }
.nav-tabs .nav-link.active { height: 41px; font-weight: 600; background-color: var(--bg); border-bottom-width: 0; }
/* The close button is 7 pixels from the right border of the tab: its box is 6 pixels from the border, and the cross has a margin of
   1 pixel inside its box. A tab that is being renamed has no close button, so it keeps the padding of Bootstrap. */
.nav-tabs .nav-link.tab-closable { padding-right: 5px; }
.nav-link.dragging { opacity: 0.4; }
/* As in Visual Studio Code, a short line between two tabs shows where a tab stops. It is hidden next to the selected tab and the
   tab under the mouse, which have a border. */
.nav-item:not(:last-child)::after {
  content: ""; position: absolute; top: 12px; bottom: 12px; right: -2px; width: 1px; background: var(--line-strong); pointer-events: none;
}
.nav-item:has(.nav-link.active)::after, .nav-item:has(+ .nav-item .nav-link.active)::after,
.nav-item:hover::after, .nav-item:has(+ .nav-item:hover)::after { opacity: 0; }
.nav-link.drop-before::before, .nav-link.drop-after::after {
  content: ""; position: absolute; top: 4px; bottom: 4px; width: 2px; border-radius: 1px; background: var(--done);
}
.nav-link.drop-before::before { left: -2px; }
.nav-link.drop-after::after { right: -2px; }
/* The tab bar clips what goes out of it, so at the two ends of the bar the line stays inside the first tab and inside the last tab. */
.nav-item:first-child .nav-link.drop-before::before { left: 0; }
.nav-item:last-child .nav-link.drop-after::after { right: 0; }
.tab-main {
  flex: 1; min-width: 0; padding: 0; border: none; background: transparent; color: inherit; font: inherit; text-align: left;
}
/* The button that selects the tab covers the whole tab, padding included. The close button sits over it, so a click on the close
   button closes the tab. */
.tab-main::after { content: ""; position: absolute; top: 0; right: 0; bottom: 0; left: 0; }
.tab-icon { flex-shrink: 0; color: var(--muted); }
.tab-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nav-link .tab-rename { flex: 1; min-width: 0; width: auto; height: 24px; padding: 0 6px; }
.rc {
  font: 600 var(--font-size) var(--mono); letter-spacing: 0.4px; padding: 1px 5px; border-radius: 4px;
  background: var(--tint-working); color: var(--working-text);
}
/* As in Visual Studio Code, the close button of the selected tab is always visible, and the close button of another tab shows
   when the mouse is over it. The button keeps its place, so the tabs do not move. */
.nav-link .confirm {
  position: relative; z-index: 1; flex-shrink: 0; width: 16px; min-width: 16px; height: 16px; padding: 0; border-radius: 4px;
  font-size: calc(var(--font-size) * 0.85); color: var(--muted);
}
.nav-link:not(.active) .confirm { opacity: 0; }
.nav-link:not(.active):hover .confirm, .nav-link:not(.active):focus-within .confirm { opacity: 1; }
.nav-link .confirm:hover { background: var(--overlay-hover); color: var(--text); }
.add { flex-shrink: 0; width: 34px; margin-bottom: 4px; }
/* While the developer drags a pane over the plus button, the button has the look of the layer of a drop of images on the composition
   bar: a solid border of 3 pixels in the color --accent and a background of the same color at 12 percent strength. The border stays
   inside the fixed height of the button, so the tab bar does not move. */
.add.pane-drop-target {
  --btn-border-width: 3px; --btn-border-color: var(--accent); --btn-hover-border-color: var(--accent);
  --btn-bg: color-mix(in srgb, var(--accent) 12%, transparent); --btn-hover-bg: color-mix(in srgb, var(--accent) 12%, transparent);
}
/* The application never had a pressed look or a focus background: only the mouse hover changes the colors. */
</style>
