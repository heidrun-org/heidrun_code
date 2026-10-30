<script setup lang="ts">
import { computed } from "vue";
import type { MireTabNode, MireWorkspaceNode } from "../../lib/mire/mire_model_types";
import { mireIndex, mireSelectedEntry } from "../../stores/mire/mire_store";
import MireCodingAgentDetails from "./MireCodingAgentDetails.vue";
import MireCounters from "./MireCounters.vue";
import MireCoverageNotices from "./MireCoverageNotices.vue";
import MireHeidrunDetails from "./MireHeidrunDetails.vue";
import MirePath from "./MirePath.vue";
import MireSubagentDetails from "./MireSubagentDetails.vue";
import MireWorkspaceDetails from "./MireWorkspaceDetails.vue";
import { t } from "../../i18n/index";

// The right sidebar of the Mire: the counters with their filters at the top, the coverage notices, the path of the
// selection, then the details of the selected node.

const emit = defineEmits<{
  /** The pane of a coding agent is now shown in the main window. */
  openedInHeidrunCode: [];
}>();

const node = computed(() => mireSelectedEntry.value.node);

/** The workspace of the selected workspace or tab. */
const workspace = computed<MireWorkspaceNode | null>(() => {
  if (node.value.kind === "workspace") {
    return node.value;
  }
  if (node.value.kind === "tab") {
    const parent = mireIndex.value.get(`workspace:${node.value.workspaceId}`)?.node;
    return parent !== undefined && parent.kind === "workspace" ? parent : null;
  }
  return null;
});

const tab = computed<MireTabNode | null>(() => (node.value.kind === "tab" ? node.value : null));
</script>

<template>
  <aside class="mire-sidebar d-flex flex-column gap-3 p-2 overflow-y-auto" :aria-label="t('mire.sidebar.label')" data-mire-sidebar>
    <MireCounters />
    <MireCoverageNotices />
    <MirePath />
    <MireHeidrunDetails v-if="node.kind === 'heidrun'" />
    <MireWorkspaceDetails v-else-if="workspace !== null" :key="node.nodeId" :workspace="workspace" :tab="tab" />
    <MireCodingAgentDetails
      v-else-if="node.kind === 'coding_agent'"
      :key="node.nodeId"
      :coding-agent="node"
      @opened-in-heidrun-code="emit('openedInHeidrunCode')"
    />
    <MireSubagentDetails v-else-if="node.kind === 'subagent'" :key="node.nodeId" :subagent="node" />
  </aside>
</template>

<style scoped>
/* The sidebar keeps its width next to the graph, and scrolls on its own. */
.mire-sidebar { width: 380px; flex-shrink: 0; min-height: 0; border-left: 1px solid var(--line); background: var(--side); }
</style>
