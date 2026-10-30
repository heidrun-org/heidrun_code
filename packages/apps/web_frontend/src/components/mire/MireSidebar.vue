<script setup lang="ts">
import { computed } from "vue";
import type { MireTabNode, MireWorkspaceNode } from "../../lib/mire/mire_model_types";
import { MireStore, mireIndex, mireSelectedEntry, mireState } from "../../stores/mire/mire_store";
import MireCodingAgentDetails from "./MireCodingAgentDetails.vue";
import MireCounters from "./MireCounters.vue";
import MireCoverageNotices from "./MireCoverageNotices.vue";
import MireHeidrunDetails from "./MireHeidrunDetails.vue";
import MirePath from "./MirePath.vue";
import MireSubagentDetails from "./MireSubagentDetails.vue";
import MireWorkspaceDetails from "./MireWorkspaceDetails.vue";
import { t } from "../../i18n/index";

// The right sidebar of the Mire: the counters with their filters at the top, the coverage notices, the path of the
// selection, the message of the last "Open in Heidrun Code" that opened nothing, then the details of the selected node.
// The message stays here, and not in the details, because a pane that is gone also leaves the graph.

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
    <div v-if="mireState.openFailure !== null" class="alert theme-danger m-0 p-2 d-flex align-items-start gap-2" role="status" data-open-failure>
      <span class="me-auto">{{ t(`mire.open.${mireState.openFailure}`) }}</span>
      <button type="button" class="btn small" :title="t('mire.open.dismiss')" @click="MireStore.clearOpenFailure()">{{ t("mire.open.dismiss") }}</button>
    </div>
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
/* The sidebar keeps its width next to the graph, and scrolls on its own. MireView.vue sets the width that the developer
   drags; 380px is the default width, and the width on a device of the local network. */
.mire-sidebar { width: 380px; flex-shrink: 0; min-height: 0; border-left: 1px solid var(--line); background: var(--side); }
</style>
