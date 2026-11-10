<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";
import { HeidrunCodeDashboardViewConnection, heidrunCodeDashboardIsOnLocalNetwork } from "../../stores/heidrun_code_dashboard/heidrun_code_dashboard_store";
import { HeidrunCodeDashboardSidebarFold, heidrunCodeDashboardSidebarFolded } from "../../stores/heidrun_code_dashboard/heidrun_code_dashboard_sidebar_fold";
import {
  HEIDRUN_CODE_DASHBOARD_SIDEBAR_DEFAULT_WIDTH,
  HEIDRUN_CODE_DASHBOARD_SIDEBAR_MINIMUM_WIDTH,
  HeidrunCodeDashboardSidebarWidth,
  heidrunCodeDashboardSidebarWidth,
} from "../../stores/heidrun_code_dashboard/heidrun_code_dashboard_sidebar_width";
import Resizer from "../Resizer.vue";
import HeidrunCodeDashboardGraph from "./HeidrunCodeDashboardGraph.vue";
import HeidrunCodeDashboardSidebar from "./HeidrunCodeDashboardSidebar.vue";
import HeidrunCodeDashboardSidebarStrip from "./HeidrunCodeDashboardSidebarStrip.vue";

// One Heidrun Code Dashboard view: the radial graph and its right sidebar. The modal wraps it now, and a separate window can mount the
// same component later. The view registers in the shared collector when it mounts, and leaves it when it unmounts, so
// the desktop application collects the live observations only while a view is open. The developer drags the left edge
// of the right sidebar to change its width, in the modal and in the separate Heidrun Code Dashboard window. On a device of the local
// network, the sidebar keeps the width of its page. The developer folds the sidebar to a narrow strip with the counters,
// so that the graph takes the whole width and stays centered on Heidrun (issue #1016). The fold is saved, separately on
// the computer and on the page of the local network.

const emit = defineEmits<{
  /** A workspace, a tab, or the pane of a coding agent is now shown in the main window: the modal closes. */
  openedInHeidrunCode: [];
}>();

const connection = new HeidrunCodeDashboardViewConnection();

onMounted(() => {
  HeidrunCodeDashboardSidebarWidth.load();
  HeidrunCodeDashboardSidebarFold.load(heidrunCodeDashboardIsOnLocalNetwork.value);
  void connection.open();
});

onBeforeUnmount(() => {
  void connection.close();
});
</script>

<template>
  <div class="heidrun-code-dashboard-view d-flex" data-heidrun-code-dashboard-view>
    <HeidrunCodeDashboardGraph @opened-in-heidrun-code="emit('openedInHeidrunCode')" />
    <HeidrunCodeDashboardSidebarStrip v-if="heidrunCodeDashboardSidebarFolded" />
    <Resizer
      v-if="heidrunCodeDashboardSidebarFolded === false && heidrunCodeDashboardIsOnLocalNetwork === false"
      :width="heidrunCodeDashboardSidebarWidth"
      side="right"
      :min="HEIDRUN_CODE_DASHBOARD_SIDEBAR_MINIMUM_WIDTH"
      :default-width="HEIDRUN_CODE_DASHBOARD_SIDEBAR_DEFAULT_WIDTH"
      :inside="true"
      data-heidrun-code-dashboard-sidebar-resizer
      @update:width="HeidrunCodeDashboardSidebarWidth.set($event)"
    />
    <HeidrunCodeDashboardSidebar
      v-if="heidrunCodeDashboardSidebarFolded === false"
      :style="heidrunCodeDashboardIsOnLocalNetwork ? undefined : { width: `${heidrunCodeDashboardSidebarWidth}px` }"
      @opened-in-heidrun-code="emit('openedInHeidrunCode')"
    />
  </div>
</template>

<style scoped>
.heidrun-code-dashboard-view { width: 100%; height: 100%; min-height: 0; background: var(--bg); }
</style>
