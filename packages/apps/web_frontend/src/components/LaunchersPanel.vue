<script setup lang="ts">
import Icon from "./Icon.vue";
import { computed, watch } from "vue";
import SourceControlMenu from "./SourceControlMenu.vue";
import {
  launcherLevel,
  launcherStatus,
  launchersOf,
  currentProject,
  loadProject,
  project,
  removeLauncher,
  runLauncher,
  stopLauncher,
  type Launcher,
} from "../stores/project";
import { state } from "../stores/session";
import { askConfirm } from "../stores/confirm";
import { openEditCustomLauncherModal, openNewCustomLauncherModal } from "../stores/newCustomLauncher";
import { openImportLaunchersModal } from "../stores/importLaunchers";
import { t } from "../i18n/index";

const ws = computed(() => state.selectedWorkspaceId);
const p = currentProject;
const error = computed(() => (ws.value ? project.errors[ws.value] : undefined));

/** The launchers of the selected workspace: the user level first, then the workspace level. */
const launchers = computed(() => (ws.value ? launchersOf(ws.value) : []));

// Load (or reload) the project file whenever the workspace changes.
watch(ws, (id) => id && loadProject(id), { immediate: true });

/** Number of characters of the command line that a card shows as its description, when the launcher has no description. */
const DESCRIPTION_FROM_COMMAND_LENGTH = 120;

/** The description of a card: the description of the launcher, or else the beginning of its command line. */
function describe(a: Launcher): string {
  return a.description ?? a.command.slice(0, DESCRIPTION_FROM_COMMAND_LENGTH);
}

/** The items of the menu of the three dots of a card. */
function menuItems() {
  return [
    { id: "edit", label: t("launchersPanel.menu.edit"), icon: "pencil" },
    { id: "delete", label: t("launchersPanel.menu.delete"), icon: "trash", isDanger: true, hasDividerBefore: true },
  ];
}

/** Does what the person chose in the menu of the three dots of a card. */
async function onMenuChoice(a: Launcher, id: string) {
  if (ws.value === null || ws.value === undefined) {
    return;
  }
  if (id === "edit") {
    openEditCustomLauncherModal(a.id);
  } else if (id === "delete" && (await askConfirm(t("launchersPanel.removeLauncher", { launcher: a.label }), t("launchersPanel.removeConfirm")))) {
    await removeLauncher(ws.value, a.id);
  }
}

function status(a: Launcher) {
  return ws.value ? launcherStatus(ws.value, a) : "idle";
}
</script>

<template>
  <div class="panel">
    <template v-if="ws && p">
      <header class="d-flex align-items-center">
        <span class="title me-auto">{{ t("launchersPanel.title") }}</span>
        <button type="button" class="btn icon btn-sm icon-button import" :aria-label="t('launchersPanel.importTitle')" :title="t('launchersPanel.importTitle')" @click="openImportLaunchersModal()">
          <Icon name="box-arrow-in-down" />
        </button>
        <button type="button" class="btn icon btn-sm icon-button create" :aria-label="t('launchersPanel.createTitle')" :title="t('launchersPanel.createTitle')" @click="openNewCustomLauncherModal()">
          <Icon name="plus-lg" />
        </button>
      </header>

      <div v-if="launchers.length === 0" class="empty">
        {{ t("launchersPanel.empty") }}
      </div>

      <div v-for="a in launchers" :key="a.id" class="launcher" :class="status(a)">
        <div class="top">
          <span class="dot" :class="status(a) === 'running' ? 'working' : status(a) === 'finished' ? 'done' : ''"></span>
          <span class="label">{{ a.label }}</span>
          <SourceControlMenu
            button-class="tool"
            icon="three-dots-vertical"
            :label="t('launchersPanel.menuLabel', { launcher: a.label })"
            :items="menuItems()"
            @choose="(id) => onMenuChoice(a, id)"
          />
        </div>
        <span class="desc" :class="{ mono: a.description === undefined }" :title="a.description ?? a.command">{{ describe(a) }}</span>
        <div class="bottom">
          <div class="state-line">
            <span class="state" :class="status(a)">{{ t(`launchersPanel.state.${status(a)}`) }}</span>
            <span v-if="launcherLevel(a) === 'user'" class="level" :title="t('launchersPanel.levelUserTitle')">{{ t("launchersPanel.levelUser") }}</span>
          </div>
          <button v-if="status(a) === 'running'" class="btn" :title="t('launchersPanel.stop')" @click="stopLauncher(ws, a)"><Icon name="stop-fill" /> {{ t("launchersPanel.stopLabel") }}</button>
          <button v-else class="btn" :title="t('launchersPanel.runInTab')" @click="runLauncher(ws, a, true)"><Icon name="play-fill" /> {{ t("launchersPanel.run") }}</button>
        </div>
      </div>
    </template>
    <p v-else-if="error" class="err mono">{{ error }}</p>
    <p v-else class="empty">{{ t("launchersPanel.noProject") }}</p>
  </div>
</template>

<style scoped>
.panel { flex: 1; min-height: 0; overflow-y: auto; padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; }
.title { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.panel :deep(.icon-button) { height: 22px; padding: 0 5px; color: var(--muted); border: none; }
.panel :deep(.icon-button:hover:not(:disabled)) { background: var(--hover); color: var(--text); }
.empty { margin: 0; font-size: var(--font-size); color: var(--muted); line-height: 1.5; }
.launcher { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--line-strong); background: var(--field); }
.launcher.running { border-color: var(--working); background: color-mix(in srgb, var(--working) 12%, var(--field)); }
.top { display: flex; align-items: center; gap: 8px; }
.label {
  flex: 1; min-width: 0; border: none; background: transparent; padding: 0; text-align: left; color: inherit;
  font-weight: 600; font-size: var(--font-size); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.desc {
  border: none; background: transparent; padding: 0; text-align: left; color: var(--muted); font-size: var(--font-size); line-height: 1.4;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word;
}
.bottom { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.state { font-size: var(--font-size); color: var(--muted); white-space: nowrap; }
.state-line { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
.level { font-size: var(--font-size); color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.state.running { color: var(--working-text); }
.state.finished { color: var(--done-text); }
.top :deep(.tool) {
  width: 26px; height: 26px; border: none; border-radius: 6px; background: transparent; color: var(--muted);
  font-size: var(--font-size); display: inline-flex; align-items: center; justify-content: center; padding: 0;
}
.top :deep(.tool:hover), .top :deep(.tool.show) { background: var(--hover); color: var(--text); }
.err { color: var(--fail); font-size: var(--font-size); }
</style>
