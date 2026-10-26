<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import TopBar from "./components/TopBar.vue";
import Sidebar from "./components/Sidebar.vue";
import PaneGrid from "./components/PaneGrid.vue";
import TabBar from "./components/TabBar.vue";
import MacroEditor from "./components/MacroEditor.vue";
import { macroEditor, startMacros } from "./stores/macros";
import RightPanel from "./components/RightPanel.vue";
import NoteModal from "./components/NoteModal.vue";
import Resizer from "./components/Resizer.vue";
import RcModal from "./components/RcModal.vue";
import ConfirmModal from "./components/ConfirmModal.vue";
import DangerModal from "./components/DangerModal.vue";
import GuardModal from "./components/GuardModal.vue";
import { merging } from "./stores/git";
import MergeModal from "./components/MergeModal.vue";
import IssueModal from "./components/IssueModal.vue";
import { issueView } from "./stores/issues";
import WorkspaceFolderRecovery from './components/WorkspaceFolderRecovery.vue';
import SearchModal from "./components/SearchModal.vue";
import ColumnOfPinnedPanes from "./components/ColumnOfPinnedPanes.vue";
import ShortcutsModal from "./components/ShortcutsModal.vue";
import MosaicModal from "./components/MosaicModal.vue";
import ImageViewer from "./components/ImageViewer.vue";
import { CompositionBar, compositionBarsByPane } from './stores/composition_bar';
import { mosaic } from "./stores/mosaic";
import { activePaneId, allPinnedPanes } from "./stores/pinned_panes";
import { goBackInPaneFocusHistory, goForwardInPaneFocusHistory } from "./stores/pane_focus_history";
import { search } from "./stores/search";
import { COLLAPSED_SIDEBAR_WIDTH, openSidebarSection } from "./stores/sidebar_sections";
import { answerConfirm, confirmDialog } from "./stores/confirm";
import { answerDanger, danger } from "./stores/guards";
import StatusBar from "./components/StatusBar.vue";
import CommandPalette from "./components/CommandPalette.vue";
import Offline from "./components/Offline.vue";
import {
  allPanes,
  newTerminal,
  closeTab,
  cycleTab,
  cycleWorkspace,
  selectWorkspaceAt,
  selectedPane,
  shiftTab,
  shiftWorkspace,
  start,
  state,
  toast,
} from "./stores/session";
import { NewPane } from "./stores/new_pane";
import { guardWindow } from "./stores/guard_window";
import { resetZoom, settings, settingsModal, zoom, zoomFactor } from "./stores/settings";
import { agentsInformationModal } from "./stores/agentsInformation";
import { newCustomLauncherModal } from "./stores/newCustomLauncher";
import { savedSearchModal } from "./stores/saved_search_modal";
import { findNewSkillsModal, installedSkillModal, skills } from "./stores/skills";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { ImageDrop } from "./lib/image_drop";
import { DropTarget } from "./lib/drop_target";
import Icon from "./components/Icon.vue";
import { notes, pinText, selectionReaders } from "./stores/notes";
import { startProjects } from "./stores/project";
import { startGit } from "./stores/git";
import { startGitBackgroundFetch } from "./stores/git_background_fetch";
import { startAlerts } from "./stores/alerts";
import { startStatusItem } from "./stores/statusItem";
import { startUserActivity } from "./stores/user_activity";
// Records Claude spend by workspace from the start, right sidebar open or not.
import "./stores/spend";
import { history, loadHistory } from "./stores/history";
import AgentsInformationModal from "./components/AgentsInformationModal.vue";
import NewCustomLauncherModal from "./components/NewCustomLauncherModal.vue";
import SavedSearchModal from "./components/SavedSearchModal.vue";
import ImportLaunchersModal from "./components/ImportLaunchersModal.vue";
import { importLaunchersModal } from "./stores/importLaunchers";
import HistoryModal from "./components/HistoryModal.vue";
import SettingsModal from "./components/SettingsModal.vue";
import SkillFileModal from "./components/SkillFileModal.vue";
import InstalledSkillModal from "./components/InstalledSkillModal.vue";
import FindNewSkillsModal from "./components/FindNewSkillsModal.vue";
import AboutModal from "./components/AboutModal.vue";
import MissingProgramsModal from "./components/MissingProgramsModal.vue";
import ThreeJsDemoModal from "./components/ThreeJsDemoModal.vue";
import { threeJsDemoModal } from "./stores/three_js_demo_modal";
import StatisticsModal from "./components/StatisticsModal.vue";
import { statisticsModal } from "./stores/statistics_modal";
import SplashScreen from "./components/SplashScreen.vue";
import QuickOpenModal from "./components/QuickOpenModal.vue";
import { quickOpen, QuickOpen } from "./stores/quick_open";
import { startMobile } from "./stores/mobile";
import { claudeLink, disableClaudeLink, enableClaudeLink, loadClaudeLink, remote, startRemoteWatch } from "./stores/claude";
import { loadAntigravityLink } from "./stores/antigravity";
import { t } from "./i18n/index";
import { ResizerWidth } from "./lib/resizer_width";
import type { PaneOuterEdge } from "./lib/pane_separators";
import { ZenMode } from "./stores/zen_mode";

// The column of pinned panes never squeezes the panes of the selected tab below 420 px, whatever the window size.
const winW = ref(window.innerWidth);
const onResize = () => (winW.value = window.innerWidth);

// Claude Code reports quota data through its status line. Keep that integration in step with Settings.
let lastQuotaMonitoringRequest: boolean | undefined;
watch(
  () => [settings.quotaMonitoring && settings.ownedAgents.includes("claude"), claudeLink.loaded, claudeLink.installed, claudeLink.busy] as const,
  ([enabled, loaded, installed, busy]) => {
    if (!loaded || busy || lastQuotaMonitoringRequest === enabled) return;
    if (enabled === installed) {
      lastQuotaMonitoringRequest = enabled;
      return;
    }
    lastQuotaMonitoringRequest = enabled;
    if (enabled) void enableClaudeLink(false);
    else void disableClaudeLink(false);
  },
);
// A sidebar collapsed to the sidebar icon bar takes the width of the sidebar icon bar.
const leftTakenWidth = computed(() => (settings.leftCollapsed ? COLLAPSED_SIDEBAR_WIDTH : settings.leftWidth));
const rightTakenWidth = computed(() => (settings.rightCollapsed ? COLLAPSED_SIDEBAR_WIDTH : settings.rightWidth));
const sides = computed(() => leftTakenWidth.value + (state.snapshot ? rightTakenWidth.value : 0));
const columnOfPinnedPanesShownWidth = computed(() => Math.max(240, Math.min(settings.columnOfPinnedPanesWidth, winW.value - sides.value - 420)));
const columnOfPinnedPanesTakenWidth = computed(() => (allPinnedPanes.value.length ? columnOfPinnedPanesShownWidth.value : 0));
const isZenPanePinned = computed(() => allPinnedPanes.value.some((pane) => pane.pane_id === ZenMode.state.paneId));
const compositionViewerPaneId = computed(() => {
  const paneId = Object.keys(compositionBarsByPane).find(
    (candidatePaneId) => compositionBarsByPane[candidatePaneId]?.viewerIndex !== null,
  );
  return paneId ?? null;
});

watch(
  () => allPanes.value.map((pane) => pane.pane_id),
  (paneIds) => {
    const existingPaneIds = new Set(paneIds);
    for (const paneId of Object.keys(compositionBarsByPane)) {
      if (existingPaneIds.has(paneId) === false) {
        ImageDrop.close(paneId);
        CompositionBar.removePane(paneId);
      }
    }
  },
);

// The three columns that the user drags, and the width that the other columns take away from each of them.
const LEFT_COLUMN = { min: 200, defaultWidth: 280 };
const RIGHT_COLUMN = { min: 260, defaultWidth: 320 };
const COLUMN_OF_PINNED_PANES = { min: 320, max: 1400, defaultWidth: 560 };
const leftReserve = computed(() => rightTakenWidth.value + columnOfPinnedPanesTakenWidth.value);
const rightReserve = computed(() => leftTakenWidth.value + columnOfPinnedPanesTakenWidth.value);
const columnOfPinnedPanesReserve = computed(() => leftTakenWidth.value + rightTakenWidth.value);

// The sides of the panes that have a column against them: the drag handle of that column ends at the panes there.
// A sidebar collapsed to the sidebar icon bar has a fixed width: nobody drags it.
const paneOuterEdges = computed(() => ({
  left: settings.leftCollapsed === false,
  right: allPinnedPanes.value.length > 0 || (state.snapshot !== null && settings.rightCollapsed === false),
}));

// The column that a corner of the panes under the pointer touches: its line is drawn in colour.
const highlightedEdge = ref<PaneOuterEdge | null>(null);

/** The column that sits against one side of the panes, with the way its width follows the pointer. */
function columnAgainst(edge: PaneOuterEdge) {
  if (edge === "left") {
    return { ...LEFT_COLUMN, reserve: leftReserve.value, width: settings.leftWidth, sign: 1, set: (w: number) => (settings.leftWidth = w) };
  }
  if (allPinnedPanes.value.length > 0) {
    return { ...COLUMN_OF_PINNED_PANES, reserve: columnOfPinnedPanesReserve.value, width: columnOfPinnedPanesShownWidth.value, sign: -1, set: (w: number) => (settings.columnOfPinnedPanesWidth = w) };
  }
  return { ...RIGHT_COLUMN, reserve: rightReserve.value, width: settings.rightWidth, sign: -1, set: (w: number) => (settings.rightWidth = w) };
}

// A corner of the panes that touches a column also moves that column, from the width it had when the drag began.
let cornerColumn: { edge: PaneOuterEdge; width: number } | null = null;

function onCornerStart(edge: PaneOuterEdge) {
  cornerColumn = { edge, width: columnAgainst(edge).width };
}

function onCornerMove(edge: PaneOuterEdge, dx: number) {
  if (cornerColumn === null || cornerColumn.edge !== edge) {
    return;
  }
  const column = columnAgainst(edge);
  column.set(ResizerWidth.clamp(cornerColumn.width + column.sign * dx, column, window.innerWidth));
}

let armedClose: string | null = null;
let armedAt = 0;

// Capture phase: our shortcuts win over xterm, which otherwise swallows the keys.
// e.code is used because ⌥ changes e.key on macOS (⌥B gives "∫").
function onKey(e: KeyboardEvent) {
  if (confirmDialog.open) {
    // The confirmation dialog owns the keyboard: Esc cancels, nothing else runs behind it.
    if (e.key === "Escape") {
      e.preventDefault();
      // Not the Settings window below the dialog, which also listens to Escape.
      e.stopImmediatePropagation();
      answerConfirm(false);
    } else if (e.metaKey) {
      e.preventDefault();
    }
    return;
  }
  if (danger.open) {
    // The confirmation window owns the keyboard: Esc cancels, nothing else runs behind it.
    if (e.key === "Escape") {
      e.preventDefault();
      answerDanger(false);
    } else if (e.metaKey) e.preventDefault();
    return;
  }
  if (e.metaKey === false || e.ctrlKey === true) {
    return;
  }
  const run = (fn: () => unknown) => {
    e.preventDefault();
    e.stopPropagation();
    fn();
  };
  // ⌥⌘ + arrows: ←/→ tabs, ↑/↓ workspaces.
  // ⇧⌥⌘ + arrows: move the selected tab / workspace.
  if (e.altKey && e.shiftKey) {
    if (e.code === "ArrowLeft") return run(() => shiftTab(-1));
    if (e.code === "ArrowRight") return run(() => shiftTab(1));
    if (e.code === "ArrowUp") return run(() => shiftWorkspace(-1));
    if (e.code === "ArrowDown") return run(() => shiftWorkspace(1));
  }
  if (e.altKey) {
    if (e.code === "ArrowLeft") return run(() => cycleTab(-1));
    if (e.code === "ArrowRight") return run(() => cycleTab(1));
    if (e.code === "ArrowUp") return run(() => cycleWorkspace(-1));
    if (e.code === "ArrowDown") return run(() => cycleWorkspace(1));
  }
  // ⌘/ — and ⌘: on a French keyboard, where "/" needs ⇧. By e.key: the physical
  // "Slash" key is "=" on AZERTY (⌘= zooms).
  if (["/", "?", ":"].includes(e.key)) return run(() => (state.shortcutsOpen = !state.shortcutsOpen));
  // ⌘1 … ⌘9: workspace by position.
  const digit = /^Digit([1-9])$/.exec(e.code);
  if (digit && !e.altKey && !e.shiftKey) return run(() => selectWorkspaceAt(Number(digit[1]) - 1));
  // ⌘[ / ⌘]: back / forward through the panes that had the focus, as in Chrome. By e.key: on a French keyboard,
  // "[" and "]" need ⇧⌥, and the physical key of "[" is another character.
  if (e.key === "[") {
    return run(() => goBackInPaneFocusHistory());
  }
  if (e.key === "]") {
    return run(() => goForwardInPaneFocusHistory());
  }

  switch (e.code) {
    case "KeyP":
      // ⌘P: the box that searches a file of the project by its name (issue #898).
      if (!e.shiftKey) return run(() => QuickOpen.open());
      return run(() => {
        const id = activePaneId();
        const pane = allPanes.value.find((p) => p.pane_id === id) ?? selectedPane.value;
        const text = pane ? selectionReaders.get(pane.pane_id)?.() : "";
        if (pane && text) {
          pinText(text, pane);
          openSidebarSection("notes");
        } else toast(t("app.selectTextFirst"));
      });
    case "KeyF":
      if (!e.shiftKey) return;
      return run(() => (search.open = !search.open));
    case "KeyH":
      if (!e.shiftKey) return;
      return run(() => (history.open = !history.open));
    case "KeyK":
      return run(() => (state.paletteOpen = !state.paletteOpen));
    case "KeyT":
      return run(() => (e.shiftKey ? newTerminal() : NewPane.startDefaultNewTab()));
    case "KeyD":
      return run(() => NewPane.startDefaultSplit(e.shiftKey ? "down" : "right"));
    case "KeyW":
      return run(() => {
        const tabId = state.selectedTabId;
        if (tabId === null || e.repeat === true) {
          return;
        }
        if (armedClose === tabId && Date.now() - armedAt < 2000) {
          armedClose = null;
          void closeTab(tabId);
        } else {
          armedClose = tabId;
          armedAt = Date.now();
          toast(t('app.pressAgainToClose'));
        }
      });
    case "KeyB":
      return run(() => {
        if (e.altKey) settings.rightCollapsed = !settings.rightCollapsed;
        else settings.leftCollapsed = !settings.leftCollapsed;
      });
    // ⌘+ / ⌘− / ⌘0 zoom the whole window, whatever window is open.
    case "Equal":
    case "NumpadAdd":
      return run(() => zoom(0.5));
    case "Minus":
    case "NumpadSubtract":
      return run(() => zoom(-0.5));
    case "Digit0":
    case "Numpad0":
      return run(() => resetZoom());
  }
}

let unlistenDrop: (() => void) | null = null;
onMounted(async () => {
  // First of all: the detection of the activity of the user must see every action before the other listeners do.
  startUserActivity();
  window.addEventListener("keydown", onKey, true);
  window.addEventListener("resize", onResize);
  start();
  startProjects();
  startMacros();
  startGit();
  startGitBackgroundFetch();
  startAlerts();
  startStatusItem();
  loadHistory();
  startMobile();
  loadClaudeLink();
  loadAntigravityLink();
  startRemoteWatch();
  unlistenDrop = await getCurrentWebview().onDragDropEvent((event) => {
    if (event.payload.type === "enter") {
      void DropTarget.measureTopInset(zoomFactor());
    }
    if (event.payload.type === "enter" || event.payload.type === "over") {
      DropTarget.hover(event.payload.position, zoomFactor());
      return;
    }
    DropTarget.clearHover();
    if (event.payload.type !== "drop") {
      return;
    }
    const paneId = DropTarget.paneIdAt(event.payload.position, zoomFactor());
    if (paneId === null) {
      return;
    }
    const result = ImageDrop.handleDrop(paneId, event.payload.paths);
    if (result === "not_an_image") toast(t("app.dropNotAnImage"), "error");
  });
});
onBeforeUnmount(() => {
  unlistenDrop?.();
  window.removeEventListener("keydown", onKey, true);
  window.removeEventListener("resize", onResize);
});
</script>

<template>
  <div class="app">
    <SplashScreen />
    <MissingProgramsModal />
    <AboutModal />
    <TopBar v-if="ZenMode.state.isActive === false" />
    <div class="body" :class="{ 'zen-mode': ZenMode.state.isActive }">
      <template v-if="ZenMode.state.isActive === false">
        <Sidebar />
        <Resizer v-if="settings.leftCollapsed === false" v-model:width="settings.leftWidth" side="left" :min="LEFT_COLUMN.min" :default-width="LEFT_COLUMN.defaultWidth" :reserve="leftReserve" :highlighted="highlightedEdge === 'left'" />
        <!-- A collapsed sidebar has no line to drag, but it keeps the gap that the line fills. -->
        <div v-else class="sidebar-gap"></div>
      </template>
      <main class="center" :class="{ 'zen-mode': ZenMode.state.isActive }" data-information-card-boundary>
        <template v-if="state.snapshot">
          <TabBar v-if="ZenMode.state.isActive === false" />
          <div class="stage" :class="{ 'zen-mode': ZenMode.state.isActive, 'zen-mode-pinned-pane': isZenPanePinned }">
            <PaneGrid :outer-edges="paneOuterEdges" :zen-pane-id="ZenMode.state.isActive ? ZenMode.state.paneId : null" @outer-start="onCornerStart" @outer-move="onCornerMove" @outer-highlight="highlightedEdge = $event" />
            <Resizer
              v-if="allPinnedPanes.length && ZenMode.state.isActive === false"
              :width="columnOfPinnedPanesShownWidth"
              @update:width="(v: number) => (settings.columnOfPinnedPanesWidth = v)"
              side="right"
              inside
              :min="COLUMN_OF_PINNED_PANES.min"
              :max="COLUMN_OF_PINNED_PANES.max"
              :default-width="COLUMN_OF_PINNED_PANES.defaultWidth"
              :reserve="columnOfPinnedPanesReserve"
              :highlighted="highlightedEdge === 'right'"
            />
            <ColumnOfPinnedPanes
              v-if="allPinnedPanes.length"
              :class="{
                'zen-mode': ZenMode.state.isActive && isZenPanePinned,
                'zen-mode-hidden': ZenMode.state.isActive && isZenPanePinned === false,
              }"
              :zen-pane-id="ZenMode.state.isActive && isZenPanePinned ? ZenMode.state.paneId : null"
              :style="{ width: ZenMode.state.isActive && isZenPanePinned ? '100%' : `${columnOfPinnedPanesShownWidth}px` }"
            />
          </div>
        </template>
        <Offline v-else />
      </main>
      <template v-if="state.snapshot && ZenMode.state.isActive === false">
        <Resizer v-if="settings.rightCollapsed === false" v-model:width="settings.rightWidth" side="right" :min="RIGHT_COLUMN.min" :default-width="RIGHT_COLUMN.defaultWidth" :reserve="rightReserve" :highlighted="highlightedEdge === 'right' && allPinnedPanes.length === 0" />
        <div v-else class="sidebar-gap"></div>
        <RightPanel />
      </template>
    </div>
    <StatusBar v-if="ZenMode.state.isActive === false" />
    <CommandPalette v-if="state.paletteOpen" />
    <MacroEditor v-if="macroEditor.open" />
    <ThreeJsDemoModal v-if="threeJsDemoModal.open" />
    <StatisticsModal v-if="statisticsModal.open" />
    <NoteModal v-if="notes.openId" />
    <RcModal v-if="remote.openFor" />
    <MergeModal v-if="merging.open && merging.req" />
    <IssueModal v-if="issueView.open" />
    <WorkspaceFolderRecovery />
    <SearchModal v-if="search.open" />
    <ShortcutsModal v-if="state.shortcutsOpen" />
    <MosaicModal v-if="mosaic.paneId" />
    <ImageViewer v-if="compositionViewerPaneId !== null" :pane-id="compositionViewerPaneId" />
    <AgentsInformationModal v-if="agentsInformationModal.open" />
    <NewCustomLauncherModal v-if="newCustomLauncherModal.open" />
    <SavedSearchModal v-if="savedSearchModal.open" />
    <ImportLaunchersModal v-if="importLaunchersModal.open" />
    <HistoryModal v-if="history.open" />
    <SettingsModal v-if="settingsModal.open" />
    <GuardModal v-if="guardWindow.isOpen" />
    <InstalledSkillModal v-if="installedSkillModal.open" />
    <FindNewSkillsModal v-if="findNewSkillsModal.open" />
    <SkillFileModal v-if="skills.view !== null" />
    <QuickOpenModal v-if="quickOpen.isOpen" />
    <DangerModal v-if="danger.open" />
    <ConfirmModal v-if="confirmDialog.open" />
    <Transition name="toast">
      <div v-if="state.toast" class="toast" :class="{ error: state.toastKind === 'error' }" :role="state.toastKind === 'error' ? 'alert' : 'status'">
        <Icon v-if="state.toastKind === 'error'" name="exclamation-octagon-fill" class="toast-icon" />
        {{ state.toast }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.app { height: 100%; display: flex; flex-direction: column; background: var(--shell); }
.body { flex: 1; min-height: 0; display: flex; padding: 0 var(--pane-gap); }
/* The viewport is a frame like the two sidebars: same border, same corners, same background. The tab bar is inside the frame.
   The frame has no padding: the panes touch its border, and the frame clips the corners of the panes that touch its own rounded
   corners. */
.center {
  flex: 1; min-width: 0; display: flex; flex-direction: column; overflow: hidden;
  border: 1px solid var(--line); border-radius: var(--pane-radius); background: var(--side);
}
.body.zen-mode { padding: 0; }
.center.zen-mode { border: 0; border-radius: 0; background: var(--bg); }
.sidebar-gap { width: var(--pane-gap); flex-shrink: 0; }
/* The border of the panes goes 1 pixel past the frame on the left, on the right, and at the bottom: the frame clips it, so the
   border of the frame is the only line there. At the top, the border of the panes is the line under the tab bar. */
.stage { flex: 1; min-height: 0; display: flex; margin: 0 -1px -1px; }
.stage.zen-mode { position: relative; margin: 0; }
.stage.zen-mode.zen-mode-pinned-pane > :first-child { display: none; }
.stage > :first-child { flex: 1; min-width: 0; }
.toast {
  position: fixed; right: 16px; bottom: 52px;
  padding: 10px 16px; border-radius: 10px; background: var(--toast-bg); border: 1px solid var(--line-strong);
  color: var(--text); font-size: var(--font-size); box-shadow: 0 12px 32px var(--toast-shadow); z-index: 50;
}
.toast.error { background: var(--tint-err); border-color: var(--fail); color: var(--fail); font-weight: 600; }
.toast-icon { margin-right: 8px; color: var(--text); }
.toast-enter-active, .toast-leave-active { transition: opacity 0.2s, transform 0.2s; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(6px); }
</style>
