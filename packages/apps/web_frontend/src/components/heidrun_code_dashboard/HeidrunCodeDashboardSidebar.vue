<script setup lang="ts">
import { computed } from "vue";
import type { HeidrunCodeDashboardTabNode, HeidrunCodeDashboardWorkspaceNode } from "../../lib/heidrun_code_dashboard/heidrun_code_dashboard_model_types";
import { heidrunCodeDashboardIndex, heidrunCodeDashboardSelectedEntry } from "../../stores/heidrun_code_dashboard/heidrun_code_dashboard_store";
import HeidrunCodeDashboardCodingAgentDetails from "./HeidrunCodeDashboardCodingAgentDetails.vue";
import HeidrunCodeDashboardCounters from "./HeidrunCodeDashboardCounters.vue";
import HeidrunCodeDashboardCoverageNotices from "./HeidrunCodeDashboardCoverageNotices.vue";
import HeidrunCodeDashboardHeidrunDetails from "./HeidrunCodeDashboardHeidrunDetails.vue";
import HeidrunCodeDashboardOpenFailure from "./HeidrunCodeDashboardOpenFailure.vue";
import HeidrunCodeDashboardPath from "./HeidrunCodeDashboardPath.vue";
import HeidrunCodeDashboardSubagentDetails from "./HeidrunCodeDashboardSubagentDetails.vue";
import HeidrunCodeDashboardWorkspaceDetails from "./HeidrunCodeDashboardWorkspaceDetails.vue";
import { HeidrunCodeDashboardSidebarFold } from "../../stores/heidrun_code_dashboard/heidrun_code_dashboard_sidebar_fold";
import Icon from "../Icon.vue";
import { t } from "../../i18n/index";

// The right sidebar of the Heidrun Code Dashboard: the counters with their filters at the top, the coverage notices, the path of the
// selection, the message of the last "Open in Heidrun Code" that opened nothing, then the details of the selected node.
// The message stays here, and not in the details, because a pane that is gone also leaves the graph. The button next to
// the counters folds the sidebar to a strip (issue #1016).

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
    <div class="d-flex align-items-start gap-2">
      <HeidrunCodeDashboardCounters class="flex-grow-1" style="min-width: 0" />
      <button
        type="button"
        class="navigation-action"
        :title="t('heidrunCodeDashboard.sidebar.fold')"
        :aria-label="t('heidrunCodeDashboard.sidebar.fold')"
        data-sidebar-fold
        @click="HeidrunCodeDashboardSidebarFold.toggle()"
      >
        <Icon name="chevron-bar-right" />
      </button>
    </div>
    <HeidrunCodeDashboardCoverageNotices />
    <HeidrunCodeDashboardPath />
    <HeidrunCodeDashboardOpenFailure />
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
