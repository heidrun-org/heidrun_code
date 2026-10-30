<script setup lang="ts">
import { computed } from "vue";
import type { HeidrunCodeDashboardTabNode, HeidrunCodeDashboardWorkspaceNode } from "../../lib/heidrun_code_dashboard/heidrun_code_dashboard_model_types";
import { HeidrunCodeDashboardStore, heidrunCodeDashboardIndex, heidrunCodeDashboardSelectedEntry, heidrunCodeDashboardState } from "../../stores/heidrun_code_dashboard/heidrun_code_dashboard_store";
import HeidrunCodeDashboardCodingAgentDetails from "./HeidrunCodeDashboardCodingAgentDetails.vue";
import HeidrunCodeDashboardCounters from "./HeidrunCodeDashboardCounters.vue";
import HeidrunCodeDashboardCoverageNotices from "./HeidrunCodeDashboardCoverageNotices.vue";
import HeidrunCodeDashboardHeidrunDetails from "./HeidrunCodeDashboardHeidrunDetails.vue";
import HeidrunCodeDashboardPath from "./HeidrunCodeDashboardPath.vue";
import HeidrunCodeDashboardSubagentDetails from "./HeidrunCodeDashboardSubagentDetails.vue";
import HeidrunCodeDashboardWorkspaceDetails from "./HeidrunCodeDashboardWorkspaceDetails.vue";
import { t } from "../../i18n/index";

// The right sidebar of the Heidrun Code Dashboard: the counters with their filters at the top, the coverage notices, the path of the
// selection, the message of the last "Open in Heidrun Code" that opened nothing, then the details of the selected node.
// The message stays here, and not in the details, because a pane that is gone also leaves the graph.

const emit = defineEmits<{
  /** The pane of a coding agent is now shown in the main window. */
  openedInHeidrunCode: [];
}>();

const node = computed(() => heidrunCodeDashboardSelectedEntry.value.node);

/** The workspace of the selected workspace or tab. */
const workspace = computed<HeidrunCodeDashboardWorkspaceNode | null>(() => {
  if (node.value.kind === "workspace") {
    return node.value;
  }
  if (node.value.kind === "tab") {
    const parent = heidrunCodeDashboardIndex.value.get(`workspace:${node.value.workspaceId}`)?.node;
    return parent !== undefined && parent.kind === "workspace" ? parent : null;
  }
  return null;
});

const tab = computed<HeidrunCodeDashboardTabNode | null>(() => (node.value.kind === "tab" ? node.value : null));
</script>

<template>
  <aside class="heidrun-code-dashboard-sidebar d-flex flex-column gap-3 p-2 overflow-y-auto" :aria-label="t('heidrunCodeDashboard.sidebar.label')" data-heidrun-code-dashboard-sidebar>
    <HeidrunCodeDashboardCounters />
    <HeidrunCodeDashboardCoverageNotices />
    <HeidrunCodeDashboardPath />
    <div v-if="heidrunCodeDashboardState.openFailure !== null" class="alert theme-danger m-0 p-2 d-flex align-items-start gap-2" role="status" data-open-failure>
      <span class="me-auto">{{ t(`heidrunCodeDashboard.open.${heidrunCodeDashboardState.openFailure}`) }}</span>
      <button type="button" class="btn small" :title="t('heidrunCodeDashboard.open.dismiss')" @click="HeidrunCodeDashboardStore.clearOpenFailure()">{{ t("heidrunCodeDashboard.open.dismiss") }}</button>
    </div>
    <HeidrunCodeDashboardHeidrunDetails v-if="node.kind === 'heidrun'" />
    <HeidrunCodeDashboardWorkspaceDetails v-else-if="workspace !== null" :key="node.nodeId" :workspace="workspace" :tab="tab" />
    <HeidrunCodeDashboardCodingAgentDetails
      v-else-if="node.kind === 'coding_agent'"
      :key="node.nodeId"
      :coding-agent="node"
      @opened-in-heidrun-code="emit('openedInHeidrunCode')"
    />
    <HeidrunCodeDashboardSubagentDetails v-else-if="node.kind === 'subagent'" :key="node.nodeId" :subagent="node" />
  </aside>
</template>

<style scoped>
/* The sidebar keeps its width next to the graph, and scrolls on its own. HeidrunCodeDashboardView.vue sets the width that the developer
   drags; 380px is the default width, and the width on a device of the local network. */
.heidrun-code-dashboard-sidebar { width: 380px; flex-shrink: 0; min-height: 0; border-left: 1px solid var(--line); background: var(--side); }
</style>
