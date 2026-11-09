<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { getCurrentWindow } from "@tauri-apps/api/window";
import Icon from "../Icon.vue";
import HeidrunCodeDashboardView from "./HeidrunCodeDashboardView.vue";
import { t } from "../../i18n/index";

// The page of the separate Heidrun Code Dashboard window, for a second screen: a thin bar with the button of full screen, and the same
// Heidrun Code Dashboard view as the modal. "Open in Heidrun Code" gives the focus to the main window, and this window stays open. The
// usual macOS shortcut ⌃⌘F (the item "Enter Full Screen" of the menu Window) also works, and ⌘W closes the window.

const isFullScreen = ref(false);

async function readFullScreen() {
  try {
    isFullScreen.value = await getCurrentWindow().isFullscreen();
  } catch {
    /* outside the Tauri window (a test, a plain browser) there is no window to ask */
  }
}

async function toggleFullScreen() {
  try {
    await getCurrentWindow().setFullscreen(isFullScreen.value === false);
  } catch {
    /* outside the Tauri window there is no window to change */
  }
  await readFullScreen();
}

function onKeyDown(event: KeyboardEvent) {
  const isOnlyCommand = event.metaKey === true && event.ctrlKey === false && event.altKey === false && event.shiftKey === false;
  if (isOnlyCommand === true && event.code === "KeyW") {
    event.preventDefault();
    void getCurrentWindow().close().catch(() => undefined);
  }
}

function onResize() {
  void readFullScreen();
}

onMounted(() => {
  void readFullScreen();
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("resize", onResize);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("resize", onResize);
});
</script>

<template>
  <div class="heidrun-code-dashboard-window d-flex flex-column" data-heidrun-code-dashboard-window>
    <div class="d-flex align-items-center gap-3 px-3 py-1 border-bottom">
      <div class="fw-semibold me-auto" role="heading" aria-level="1">{{ t("heidrunCodeDashboard.title") }}</div>
      <button
        type="button"
        class="btn small"
        :title="isFullScreen ? t('heidrunCodeDashboard.fullScreen.exitTitle') : t('heidrunCodeDashboard.fullScreen.enterTitle')"
        :aria-pressed="isFullScreen"
        data-full-screen
        @click="toggleFullScreen()"
      >
        <Icon :name="isFullScreen ? 'fullscreen-exit' : 'fullscreen'" />
        {{ isFullScreen ? t("heidrunCodeDashboard.fullScreen.exit") : t("heidrunCodeDashboard.fullScreen.enter") }}
      </button>
    </div>
    <div class="d-flex" style="flex: 1 1 0; min-height: 0">
      <HeidrunCodeDashboardView />
    </div>
  </div>
</template>

<style scoped>
.heidrun-code-dashboard-window { position: fixed; inset: 0; background: var(--bg); color: var(--text); }
</style>
