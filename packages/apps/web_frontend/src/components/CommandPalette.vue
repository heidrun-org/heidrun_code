<script setup lang="ts">
import Icon from "./Icon.vue";
import { computed, nextTick, onMounted, ref } from "vue";
import {
  allPanes,
  closePane,
  closeTab,
  cycleTab,
  cycleWorkspace,
  newTerminal,
  shiftTab,
  shiftWorkspace,
  recentCommands,
  runInNewPane,
  runInPane,
  selectPane,
  selectedPane,
  startRename,
  state,
  workspaceLabel,
} from "../stores/session";
import { NewPane } from "../stores/new_pane";
import { statusLabel, paneName } from "../lib/format";
import { FONTS, openSettings, resetZoom, settings, zoom } from "../stores/settings";
import { currentProject, launchersOf, runLauncher } from "../stores/project";
import { hardCodedMacros, macros, projectMacros, resolveMacroVariables } from "../stores/macros";
import { insertIntoFocusedPane } from "../stores/input";
import { search } from "../stores/search";
import { isPinned, togglePinnedPane } from "../stores/pinned_panes";
import { openFiles } from "../stores/files";
import { openThreeJsDemoModal } from "../stores/three_js_demo_modal";
import { openFindNewSkillsModal, openInstalledSkillModal } from "../stores/skills";
import { t } from "../i18n/index";

interface Item {
  section: string;
  label: string;
  hint?: string;
  hintIcon?: string;
  mono?: boolean;
  run: () => unknown;
}

const query = ref("");
const index = ref(0);
const input = ref<HTMLInputElement>();
const recent = recentCommands();

function close() {
  state.paletteOpen = false;
}

const items = computed<Item[]>(() => {
  const q = query.value.trim();
  const lower = q.toLowerCase();
  const list: Item[] = [];
  const shell = selectedPane.value && !selectedPane.value.agent ? selectedPane.value : null;

  if (q) {
    list.push({ section: t("commandPalette.section.run"), label: t("commandPalette.runInNewPane", { command: q }), hint: "↵", run: () => runInNewPane(q) });
    if (shell) list.push({ section: t("commandPalette.section.run"), label: t("commandPalette.runInPane", { pane: paneName(shell) }), hint: "⌥↵", run: () => runInPane(shell.pane_id, q) });
    list.push({ section: t("commandPalette.section.run"), label: t("commandPalette.runAndNotify"), hint: "⇧↵", run: () => runInNewPane(q, "passed|failed|error|Error|✓|✗|done|Done") });
  }

  // Macros: fill the input bar (editable before sending).
  for (const macro of [...projectMacros.value, ...macros.personal, ...hardCodedMacros.value].filter((x) => !lower || x.label.toLowerCase().includes(lower)).slice(0, 6)) {
    list.push({
      section: t("commandPalette.section.macros"),
      label: macro.label,
      hint: t("commandPalette.macroHint"),
      run: async () => insertIntoFocusedPane(await resolveMacroVariables(macro.text, selectedPane.value?.pane_id ?? null)),
    });
  }

  for (const cmd of recent.filter((c) => !lower || c.toLowerCase().includes(lower)).slice(0, 5)) {
    list.push({ section: t("commandPalette.section.recent"), label: cmd, mono: true, run: () => runInNewPane(cmd) });
  }

  for (const p of allPanes.value.filter((x) => !lower || paneName(x).toLowerCase().includes(lower)).slice(0, 6)) {
    list.push({
      section: t("commandPalette.section.goTo"),
      label: `${paneName(p)} · ${workspaceLabel(p.workspace_id)}`,
      hint: p.agent ? statusLabel(p.agent_status) : t("commandPalette.terminalHint"),
      run: () => selectPane(p),
    });
    if (p.agent && p.tab_id !== state.selectedTabId)
      list.push({
        section: t("commandPalette.section.pin"),
        label: t(isPinned(p.pane_id) ? "commandPalette.unpin" : "commandPalette.pin", { pane: `${paneName(p)} · ${workspaceLabel(p.workspace_id)}` }),
        hintIcon: "pin",
        run: () => togglePinnedPane(p.pane_id),
      });
  }

  const sel = selectedPane.value;
  const wsId = state.selectedWorkspaceId;
  const proj = currentProject.value;
  if (wsId && proj) {
    for (const a of launchersOf(wsId).filter((x) => !lower || x.label.toLowerCase().includes(lower) || x.command.toLowerCase().includes(lower))) {
      list.push({ section: t("commandPalette.section.projectLaunchers"), label: a.label, hint: a.command, run: () => runLauncher(wsId, a) });
    }
  }
  const actions: Item[] = [
    { section: t("commandPalette.section.terminals"), label: t("commandPalette.newTab"), hint: "⌘T", run: () => NewPane.startDefaultNewTab() },
    { section: t("commandPalette.section.terminals"), label: t("commandPalette.newTerminal"), hint: "⇧⌘T", run: () => newTerminal() },
    { section: t("commandPalette.section.terminals"), label: t("commandPalette.splitRight"), hint: "⌘D", run: () => NewPane.startDefaultSplit("right") },
    { section: t("commandPalette.section.terminals"), label: t("commandPalette.splitDown"), hint: "⇧⌘D", run: () => NewPane.startDefaultSplit("down") },
    ...(sel ? [{ section: t("commandPalette.section.terminals"), label: t("commandPalette.closePane", { pane: paneName(sel) }), hint: "⌘W ⌘W", run: () => closePane(sel.pane_id) }] : []),
    ...(state.selectedTabId ? [{ section: t("commandPalette.section.terminals"), label: t("commandPalette.closeTab"), run: () => closeTab(state.selectedTabId!) }] : []),
    ...(state.selectedWorkspaceId ? [{ section: t("commandPalette.section.rename"), label: t("commandPalette.renameWorkspace"), run: () => startRename("ws", state.selectedWorkspaceId!) }] : []),
    ...(state.selectedTabId ? [{ section: t("commandPalette.section.rename"), label: t("commandPalette.renameTab"), run: () => startRename("tab", state.selectedTabId!) }] : []),
    ...(sel ? [{ section: t("commandPalette.section.rename"), label: t("commandPalette.renamePane"), run: () => startRename("pane", sel.pane_id) }] : []),
    { section: t("commandPalette.section.navigation"), label: t("commandPalette.searchTerminals"), hint: "⇧⌘F", run: () => (search.open = true) },
    { section: t("commandPalette.section.navigation"), label: t("commandPalette.openFile"), hint: "⌘P", run: () => openFiles(selectedPane.value?.foreground_cwd || selectedPane.value?.cwd, { search: true }) },
    { section: t("commandPalette.section.help"), label: t("commandPalette.shortcuts"), hint: "⌘/", run: () => (state.shortcutsOpen = true) },
    { section: t("commandPalette.section.help"), label: t("commandPalette.threeJsDemo"), run: () => openThreeJsDemoModal() },
    { section: t("commandPalette.section.display"), label: t("commandPalette.mobile"), run: () => openSettings("mobileAccess") },
    { section: t("commandPalette.section.display"), label: t("commandPalette.agents"), run: () => openSettings("agents") },
    { section: t("commandPalette.section.display"), label: t("commandPalette.installedSkill"), run: () => openInstalledSkillModal() },
    { section: t("commandPalette.section.display"), label: t("commandPalette.findNewSkills"), run: () => openFindNewSkillsModal() },
    { section: t("commandPalette.section.navigation"), label: t("commandPalette.nextTab"), hint: "⌥⌘→", run: () => cycleTab(1) },
    { section: t("commandPalette.section.navigation"), label: t("commandPalette.previousTab"), hint: "⌥⌘←", run: () => cycleTab(-1) },
    { section: t("commandPalette.section.navigation"), label: t("commandPalette.nextWorkspace"), hint: "⌥⌘↓", run: () => cycleWorkspace(1) },
    { section: t("commandPalette.section.reorder"), label: t("commandPalette.moveTabLeft"), hint: "⇧⌥⌘←", run: () => shiftTab(-1) },
    { section: t("commandPalette.section.reorder"), label: t("commandPalette.moveTabRight"), hint: "⇧⌥⌘→", run: () => shiftTab(1) },
    { section: t("commandPalette.section.reorder"), label: t("commandPalette.moveWorkspaceUp"), hint: "⇧⌥⌘↑", run: () => shiftWorkspace(-1) },
    { section: t("commandPalette.section.reorder"), label: t("commandPalette.moveWorkspaceDown"), hint: "⇧⌥⌘↓", run: () => shiftWorkspace(1) },
    { section: t("commandPalette.section.navigation"), label: t("commandPalette.previousWorkspace"), hint: "⌥⌘↑", run: () => cycleWorkspace(-1) },
    {
      section: t("commandPalette.section.display"),
      label: settings.mouseMode === "select" ? t("commandPalette.mouseToApp") : t("commandPalette.mouseSelect"),
      run: () => (settings.mouseMode = settings.mouseMode === "select" ? "app" : "select"),
    },
    { section: t("commandPalette.section.display"), label: t("commandPalette.zoomIn"), hint: "⌘+", run: () => zoom(0.5) },
    { section: t("commandPalette.section.display"), label: t("commandPalette.zoomOut"), hint: "⌘−", run: () => zoom(-0.5) },
    { section: t("commandPalette.section.display"), label: t("commandPalette.zoomReset"), hint: "⌘0", run: () => resetZoom() },
    { section: t("commandPalette.section.display"), label: t("commandPalette.leftSidebar"), hint: "⌘B", run: () => (settings.leftCollapsed = !settings.leftCollapsed) },
    { section: t("commandPalette.section.display"), label: t("commandPalette.rightSidebar"), hint: "⌥⌘B", run: () => (settings.rightCollapsed = !settings.rightCollapsed) },
    ...FONTS.map((f) => ({ section: t("commandPalette.section.display"), label: t("commandPalette.font", { font: f.label }), hintIcon: f.id === settings.fontId ? "check-lg" : undefined, run: () => (settings.fontId = f.id) })),
  ];
  list.push(...actions.filter((a) => !lower || a.label.toLowerCase().includes(lower)));
  return list;
});

const grouped = computed(() => {
  const groups: { section: string; items: { item: Item; i: number }[] }[] = [];
  items.value.forEach((item, i) => {
    let g = groups.find((x) => x.section === item.section);
    if (!g) groups.push((g = { section: item.section, items: [] }));
    g.items.push({ item, i });
  });
  return groups;
});

function execute(item?: Item) {
  if (!item) return;
  close();
  item.run();
}

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") return close();
  if (e.key === "ArrowDown") {
    e.preventDefault();
    index.value = Math.min(items.value.length - 1, index.value + 1);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    index.value = Math.max(0, index.value - 1);
  } else if (e.key === "Enter") {
    e.preventDefault();
    const q = query.value.trim();
    const shell = selectedPane.value && !selectedPane.value.agent ? selectedPane.value : null;
    if (q && e.altKey && shell) return execute({ section: "", label: "", run: () => runInPane(shell.pane_id, q) });
    if (q && e.shiftKey) return execute({ section: "", label: "", run: () => runInNewPane(q, "passed|failed|error|Error|✓|✗|done|Done") });
    execute(items.value[index.value]);
  }
}

onMounted(() => nextTick(() => input.value?.focus()));
</script>

<template>
  <div class="scrim" @mousedown.self="close">
    <div class="palette" role="dialog" :aria-label="t('commandPalette.dialogLabel')">
      <div class="field">
        <span class="mono prompt">$</span>
        <label class="sr" for="palette-input">{{ t("commandPalette.inputLabel") }}</label>
        <input
          id="palette-input"
          ref="input"
          v-model="query"
          class="form-control mono"
          :placeholder="t('commandPalette.placeholder')"
          spellcheck="false"
          autocomplete="off"
          @input="index = 0"
          @keydown="onKey"
        />
        <kbd>esc</kbd>
      </div>
      <div class="list">
        <template v-for="g in grouped" :key="g.section">
          <div class="eyebrow sec">{{ g.section }}</div>
          <button :title="t('commandPalette.runTitle')"
            v-for="{ item, i } in g.items"
            :key="i"
            class="list-action row"
            :class="{ active: i === index, mono: item.mono }"
            @mouseenter="index = i"
            @click="execute(item)"
          >
            <span class="grow">{{ item.label }}</span>
            <span v-if="item.hint || item.hintIcon" class="hint"><Icon v-if="item.hintIcon" :name="item.hintIcon" /><template v-else>{{ item.hint }}</template></span>
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scrim { position: fixed; inset: 0; background: var(--overlay); z-index: 40; display: flex; justify-content: center; align-items: flex-start; padding-top: 120px; }
.palette {
  width: min(560px, calc(100% - 32px)); border-radius: 14px; border: 1px solid var(--line-modal); background: var(--field);
  box-shadow: 0 24px 64px var(--shadow); overflow: hidden;
}
.field { display: flex; align-items: center; gap: 10px; height: 52px; padding: 0 16px; border-bottom: 1px solid var(--line-soft); }
.prompt { color: var(--working-text); font-size: var(--font-size); }
.field input { flex: 1; }
kbd { font: 400 var(--font-size) var(--mono); color: var(--muted); }
.list { padding: 8px; max-height: 420px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
.sec { padding: 10px 10px 4px; }
.row {
  display: flex; align-items: center; gap: 10px; min-height: 38px; padding: 0 10px; border-radius: 8px; border: none;
  background: transparent; color: var(--text-2); font-weight: 500; text-align: left;
}
.row.mono { font-family: var(--mono); font-weight: 400; font-size: var(--font-size); }
.row.active { background: var(--hover); color: var(--text); }
.grow { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hint { font: 400 var(--font-size) var(--mono); color: var(--muted); }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
