<script setup lang="ts">
import type { HeidrunCodeDashboardTabNode } from "../../lib/heidrun_code_dashboard/heidrun_code_dashboard_model_types";
import { HeidrunCodeDashboardStore } from "../../stores/heidrun_code_dashboard/heidrun_code_dashboard_store";
import HeidrunCodeDashboardStatusText from "./HeidrunCodeDashboardStatusText.vue";
import HeidrunCodeDashboardSubagentRows from "./HeidrunCodeDashboardSubagentRows.vue";
import { HeidrunCodeDashboardViewTexts } from "./heidrun_code_dashboard_view_texts";
import { t } from "../../i18n/index";

// The tabs of a workspace, with their coding agents and the subagents indented under them. Each row selects its node.

defineProps<{
  /** The tabs to list. */
  tabs: HeidrunCodeDashboardTabNode[];
}>();
</script>

<template>
  <p v-if="tabs.length === 0" class="m-0 text-body-secondary">{{ t("heidrunCodeDashboard.details.noTab") }}</p>
  <div v-else class="list-group list-group-flush" data-heidrun-code-dashboard-hierarchy>
    <template v-for="tab in tabs" :key="tab.nodeId">
      <button
        type="button"
        class="list-action list-group-item list-group-item-action d-flex align-items-center gap-2 text-start fw-semibold"
        :title="tab.label"
        :data-select-node-id="tab.nodeId"
        @click="HeidrunCodeDashboardStore.select(tab.nodeId)"
      >
        <span class="me-auto text-break">{{ tab.label }}</span>
        <HeidrunCodeDashboardStatusText :status="tab.status" />
      </button>
      <p v-if="tab.codingAgents.length === 0" class="list-group-item m-0 ps-3 text-body-secondary">{{ t("heidrunCodeDashboard.details.noCodingAgent") }}</p>
      <template v-for="codingAgent in tab.codingAgents" :key="codingAgent.nodeId">
        <button
          type="button"
          class="list-action list-group-item list-group-item-action d-flex align-items-center gap-2 text-start ps-3"
          :title="HeidrunCodeDashboardViewTexts.agentName(codingAgent.agent)"
          :data-select-node-id="codingAgent.nodeId"
          @click="HeidrunCodeDashboardStore.select(codingAgent.nodeId)"
        >
          <i v-if="HeidrunCodeDashboardViewTexts.agentIcon(codingAgent.agent) !== null" class="bi" :class="`bi-${HeidrunCodeDashboardViewTexts.agentIcon(codingAgent.agent)}`" role="img" :aria-label="HeidrunCodeDashboardViewTexts.agentName(codingAgent.agent)" :data-badge="HeidrunCodeDashboardViewTexts.agentIcon(codingAgent.agent)"></i>
          <span v-else class="badge theme-secondary font-monospace" :data-badge="HeidrunCodeDashboardViewTexts.agentBadge(codingAgent.agent)">{{ HeidrunCodeDashboardViewTexts.agentBadge(codingAgent.agent) }}</span>
          <span class="me-auto text-break">{{ codingAgent.label ?? HeidrunCodeDashboardViewTexts.agentName(codingAgent.agent) }}</span>
          <span v-if="HeidrunCodeDashboardViewTexts.freshnessText(codingAgent.facts.freshness) !== null" class="badge theme-warning">{{ HeidrunCodeDashboardViewTexts.freshnessText(codingAgent.facts.freshness) }}</span>
          <HeidrunCodeDashboardStatusText :status="codingAgent.status" />
        </button>
        <HeidrunCodeDashboardSubagentRows :subagents="codingAgent.subagents" :depth="1" />
      </template>
    </template>
  </div>
</template>
