<script setup lang="ts">
import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { onBeforeUnmount, onMounted } from 'vue';
import { availableUpdateVersion } from '../stores/application_update';
import Icon from './Icon.vue';
import MoreMenu from "./MoreMenu.vue";
import PaneFocusHistoryButton from "./PaneFocusHistoryButton.vue";
import ThemeMenu from "./ThemeMenu.vue";
import { selectedWorkspace, state } from "../stores/session";
import { t } from "../i18n/index";

let unlistenUpdate: UnlistenFn | undefined;
let isUnmounted = false;
let hasUpdateEvent = false;

onMounted(async () => {
	if (isTauri() === false) {
		return;
	}
	try {
		const unlisten = await listen<string | null>('application-update-available', ({ payload }) => {
			hasUpdateEvent = true;
			availableUpdateVersion.value = payload;
		});
		if (isUnmounted === true) {
			unlisten();
			return;
		}
		unlistenUpdate = unlisten;
		const version = await invoke<string | null>('applicationUpdateAvailable');
		if (isUnmounted === false && hasUpdateEvent === false) {
			availableUpdateVersion.value = version;
		}
	} catch (error) {
		console.warn('Could not read the available Heidrun Code update', error);
	}
});

onBeforeUnmount(() => {
	isUnmounted = true;
	unlistenUpdate?.();
});
</script>

<template>
  <!-- macOS traffic lights sit over the left padding (titleBarStyle: Overlay). -->
  <header class="top" data-tauri-drag-region>
    <div class="search-wrap" data-tauri-drag-region>
      <div class="history-buttons">
        <PaneFocusHistoryButton direction="back" />
        <PaneFocusHistoryButton direction="forward" />
      </div>
      <button :title="t('topBar.searchTitle')" class="btn search" @click="state.paletteOpen = true">
        <span v-if="selectedWorkspace !== null" class="workspace-name" :title="selectedWorkspace.label">
          {{ selectedWorkspace.label }}
        </span>
        <span v-else>{{ t("topBar.searchPlaceholder") }}</span>
        <kbd>⌘K</kbd>
      </button>
    </div>
    <div class="tools">
      <button
        type="button"
        class="btn icon update-available"
        :class="{ 'update-unavailable': availableUpdateVersion === null }"
        :disabled="availableUpdateVersion === null"
        :aria-hidden="availableUpdateVersion === null ? true : undefined"
        :aria-label="availableUpdateVersion === null ? undefined : t('topBar.updateAvailable', { version: availableUpdateVersion })"
        :title="availableUpdateVersion === null ? undefined : t('topBar.updateAvailable', { version: availableUpdateVersion })"
        @click="invoke('checkForApplicationUpdate')"
      >
        <Icon name="arrow-up-circle-fill" />
      </button>
      <ThemeMenu />
      <MoreMenu />
    </div>
  </header>
</template>

<style scoped>
.top {
  height: 43px; flex-shrink: 0; display: flex; align-items: center; gap: 12px;
  padding: 9px 16px 4px 84px; background: var(--shell);
}
.search-wrap { flex: 1; display: flex; justify-content: center; align-items: center; gap: 8px; min-width: 188px; }
.workspace-name {
  min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
}
.history-buttons { display: flex; flex-shrink: 0; }
.search { width: min(420px, 100%); display: flex; align-items: center; justify-content: space-between; overflow: hidden; white-space: nowrap; }
.search kbd { flex-shrink: 0; margin-left: 12px; font-family: var(--mono); color: var(--muted); }
.tools { display: flex; flex-shrink: 0; align-items: center; gap: 2px; }
.update-unavailable { visibility: hidden; }
</style>
