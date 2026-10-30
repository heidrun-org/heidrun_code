<script setup lang="ts">
import type { MireTabNode } from "../../lib/mire/mire_model_types";
import { MireStore } from "../../stores/mire/mire_store";
import MireStatusText from "./MireStatusText.vue";
import MireSubagentRows from "./MireSubagentRows.vue";
import { MireViewTexts } from "./mire_view_texts";
import { t } from "../../i18n/index";

// The tabs of a workspace, with their coding agents and the subagents indented under them. Each row selects its node.

defineProps<{
  /** The tabs to list. */
  tabs: MireTabNode[];
}>();
</script>

<template>
  <p v-if="tabs.length === 0" class="m-0 text-body-secondary">{{ t("mire.details.noTab") }}</p>
  <div v-else class="list-group list-group-flush" data-mire-hierarchy>
    <template v-for="tab in tabs" :key="tab.nodeId">
      <button
        type="button"
        class="list-action list-group-item list-group-item-action d-flex align-items-center gap-2 text-start fw-semibold"
        :title="tab.label"
        :data-select-node-id="tab.nodeId"
        @click="MireStore.select(tab.nodeId)"
      >
        <span class="me-auto text-break">{{ tab.label }}</span>
        <MireStatusText :status="tab.status" />
      </button>
      <p v-if="tab.codingAgents.length === 0" class="list-group-item m-0 ps-3 text-body-secondary">{{ t("mire.details.noCodingAgent") }}</p>
      <template v-for="codingAgent in tab.codingAgents" :key="codingAgent.nodeId">
        <button
          type="button"
          class="list-action list-group-item list-group-item-action d-flex align-items-center gap-2 text-start ps-3"
          :title="MireViewTexts.agentName(codingAgent.agent)"
          :data-select-node-id="codingAgent.nodeId"
          @click="MireStore.select(codingAgent.nodeId)"
        >
          <i v-if="MireViewTexts.agentIcon(codingAgent.agent) !== null" class="bi" :class="`bi-${MireViewTexts.agentIcon(codingAgent.agent)}`" role="img" :aria-label="MireViewTexts.agentName(codingAgent.agent)" :data-badge="MireViewTexts.agentIcon(codingAgent.agent)"></i>
          <span v-else class="badge theme-secondary font-monospace" :data-badge="MireViewTexts.agentBadge(codingAgent.agent)">{{ MireViewTexts.agentBadge(codingAgent.agent) }}</span>
          <span class="me-auto text-break">{{ codingAgent.label ?? MireViewTexts.agentName(codingAgent.agent) }}</span>
          <span v-if="MireViewTexts.freshnessText(codingAgent.facts.freshness) !== null" class="badge theme-warning">{{ MireViewTexts.freshnessText(codingAgent.facts.freshness) }}</span>
          <MireStatusText :status="codingAgent.status" />
        </button>
        <MireSubagentRows :subagents="codingAgent.subagents" :depth="1" />
      </template>
    </template>
  </div>
</template>
