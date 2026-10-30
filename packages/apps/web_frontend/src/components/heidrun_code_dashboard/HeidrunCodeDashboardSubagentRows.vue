<script setup lang="ts">
import type { HeidrunCodeDashboardSubagentNode } from "../../lib/heidrun_code_dashboard/heidrun_code_dashboard_model_types";
import { HeidrunCodeDashboardLayout } from "../../lib/heidrun_code_dashboard/heidrun_code_dashboard_layout";
import { HeidrunCodeDashboardStore } from "../../stores/heidrun_code_dashboard/heidrun_code_dashboard_store";
import HeidrunCodeDashboardStatusText from "./HeidrunCodeDashboardStatusText.vue";
import { HeidrunCodeDashboardViewTexts } from "./heidrun_code_dashboard_view_texts";

// The rows of a list of subagents, with their nested subagents indented under them. Each row selects its subagent.

defineProps<{
  /** The subagents of one parent. */
  subagents: HeidrunCodeDashboardSubagentNode[];
  /** The nested level of these subagents, from 1. */
  depth: number;
}>();
</script>

<template>
  <template v-for="subagent in subagents" :key="subagent.nodeId">
    <button
      type="button"
      class="list-action list-group-item list-group-item-action d-flex align-items-center gap-2 text-start"
      :style="{ paddingLeft: `${12 + depth * 16}px` }"
      :title="HeidrunCodeDashboardLayout.subagentName(subagent)"
      :data-select-node-id="subagent.nodeId"
      @click="HeidrunCodeDashboardStore.select(subagent.nodeId)"
    >
      <span aria-hidden="true">↳</span>
      <span class="me-auto text-break">{{ HeidrunCodeDashboardLayout.subagentName(subagent) }}</span>
      <span v-if="HeidrunCodeDashboardViewTexts.freshnessText(subagent.facts.freshness) !== null" class="badge theme-warning">{{ HeidrunCodeDashboardViewTexts.freshnessText(subagent.facts.freshness) }}</span>
      <HeidrunCodeDashboardStatusText :status="subagent.status" />
    </button>
    <HeidrunCodeDashboardSubagentRows :subagents="subagent.children" :depth="depth + 1" />
  </template>
</template>
