<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import Icon from "../Icon.vue";
import HeidrunCodeDashboardView from "./HeidrunCodeDashboardView.vue";
import { heidrunCodeDashboardLocalNetworkPageState } from "../../stores/heidrun_code_dashboard/heidrun_code_dashboard_local_network_session";
import { t } from "../../i18n/index";
import { HeidrunCodeDashboardScreenAwake } from "./heidrun_code_dashboard_screen_awake";

// The page of a phone or a tablet of the local network, for a second screen next to the computer: a thin bar with the
// button of full screen, and the same Heidrun Code Dashboard view as the desktop application, read-only (issue 978). On a narrow screen,
// the sidebar goes below the graph. The page keeps the screen of the device on: on the plain HTTP of the local network,
// with a silent video from the first touch (issue 991).

/** True when the web browser can show the page in full screen. The web browser of an iPhone cannot. */
const isFullScreenAvailable = ref(document.fullscreenEnabled === true);
const isFullScreen = ref(document.fullscreenElement !== null && document.fullscreenElement !== undefined);

/** Keeps the screen of the device on while the page shows. */
const screenAwake = new HeidrunCodeDashboardScreenAwake();

async function toggleFullScreen() {
  try {
    if (document.fullscreenElement !== null && document.fullscreenElement !== undefined) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }
  } catch {
    /* the web browser refused: the page stays as it is */
  }
}

function onFullScreenChange() {
  isFullScreen.value = document.fullscreenElement !== null && document.fullscreenElement !== undefined;
}

onMounted(() => {
  document.addEventListener("fullscreenchange", onFullScreenChange);
  screenAwake.start();
});

onBeforeUnmount(() => {
  document.removeEventListener("fullscreenchange", onFullScreenChange);
  screenAwake.stop();
});
</script>

<template>
  <div class="heidrun-code-dashboard-local-network d-flex flex-column" data-heidrun-code-dashboard-local-network>
    <div class="d-flex align-items-center gap-3 px-3 py-1 border-bottom">
      <div class="fw-semibold me-auto" role="heading" aria-level="1">{{ t("heidrunCodeDashboard.title") }}</div>
      <button
        v-if="isFullScreenAvailable"
        type="button"
        class="btn small"
        :title="isFullScreen ? t('heidrunCodeDashboard.localNetwork.exitFullScreenTitle') : t('heidrunCodeDashboard.localNetwork.fullScreenTitle')"
        :aria-pressed="isFullScreen"
        data-full-screen
        @click="toggleFullScreen()"
      >
        <Icon :name="isFullScreen ? 'fullscreen-exit' : 'fullscreen'" />
        {{ isFullScreen ? t("heidrunCodeDashboard.fullScreen.exit") : t("heidrunCodeDashboard.fullScreen.enter") }}
      </button>
    </div>
    <div v-if="heidrunCodeDashboardLocalNetworkPageState.isConnectionLost" class="alert theme-warning m-2 p-2" role="status" data-connection-lost>
      {{ t("heidrunCodeDashboard.localNetwork.connectionLost") }}
    </div>
    <div class="heidrun-code-dashboard-local-network-body d-flex">
      <HeidrunCodeDashboardView />
    </div>
  </div>
</template>

<style scoped>
.heidrun-code-dashboard-local-network { position: fixed; inset: 0; background: var(--bg); color: var(--text); }
.heidrun-code-dashboard-local-network-body { flex: 1 1 0; min-height: 0; }
/* A phone in portrait, or a small tablet: the sidebar goes below the graph, with the full width. */
@media (max-width: 760px) {
  .heidrun-code-dashboard-local-network-body :deep(.heidrun-code-dashboard-view) { flex-direction: column; }
  .heidrun-code-dashboard-local-network-body :deep(.heidrun-code-dashboard-sidebar) { width: 100%; height: 45%; border-left: none; border-top: 1px solid var(--line); }
}
</style>
