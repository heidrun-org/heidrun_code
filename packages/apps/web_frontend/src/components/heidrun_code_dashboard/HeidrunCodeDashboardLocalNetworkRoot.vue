<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import Icon from "../Icon.vue";
import HeidrunCodeDashboardView from "./HeidrunCodeDashboardView.vue";
import { heidrunCodeDashboardLocalNetworkPageState } from "../../stores/heidrun_code_dashboard/heidrun_code_dashboard_local_network_session";
import { t } from "../../i18n/index";

// The page of a phone or a tablet of the local network, for a second screen next to the computer: a thin bar with the
// button of full screen, and the same Heidrun Code Dashboard view as the desktop application, read-only (issue 978). On a narrow screen,
// the sidebar goes below the graph. The page asks the device to keep its screen on; a web browser allows it only on
// HTTPS, so on the plain HTTP of the local network the developer turns off the automatic lock of the device.

/** The part of the Screen Wake Lock interface of the web browser that the page uses. */
type WakeLockSentinelLike = {
  /** Lets the screen turn off again. */
  release: () => Promise<void>;
};

/** True when the web browser can show the page in full screen. The web browser of an iPhone cannot. */
const isFullScreenAvailable = ref(document.fullscreenEnabled === true);
const isFullScreen = ref(document.fullscreenElement !== null && document.fullscreenElement !== undefined);

/** The request that keeps the screen on, or null. */
let wakeLock: WakeLockSentinelLike | null = null;

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

/** Asks the device to keep its screen on. The web browser refuses outside HTTPS, and when the page is hidden. */
async function keepScreenOn() {
  const wakeLockApi = (navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> } }).wakeLock;
  if (wakeLockApi === undefined || wakeLock !== null) {
    return;
  }
  try {
    wakeLock = await wakeLockApi.request("screen");
  } catch {
    wakeLock = null;
  }
}

/** The web browser releases the screen when the page hides: ask again when it shows. */
function onVisibilityChange() {
  if (document.visibilityState === "visible") {
    wakeLock = null;
    void keepScreenOn();
  }
}

onMounted(() => {
  document.addEventListener("fullscreenchange", onFullScreenChange);
  document.addEventListener("visibilitychange", onVisibilityChange);
  void keepScreenOn();
});

onBeforeUnmount(() => {
  document.removeEventListener("fullscreenchange", onFullScreenChange);
  document.removeEventListener("visibilitychange", onVisibilityChange);
  void wakeLock?.release().catch(() => undefined);
  wakeLock = null;
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
