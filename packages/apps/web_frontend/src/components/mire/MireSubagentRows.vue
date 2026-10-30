<script setup lang="ts">
import type { MireSubagentNode } from "../../lib/mire/mire_model_types";
import { MireLayout } from "../../lib/mire/mire_layout";
import { MireStore } from "../../stores/mire/mire_store";
import MireStatusText from "./MireStatusText.vue";
import { MireViewTexts } from "./mire_view_texts";

// The rows of a list of subagents, with their nested subagents indented under them. Each row selects its subagent.

defineProps<{
  /** The subagents of one parent. */
  subagents: MireSubagentNode[];
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
      :title="MireLayout.subagentName(subagent)"
      :data-select-node-id="subagent.nodeId"
      @click="MireStore.select(subagent.nodeId)"
    >
      <span aria-hidden="true">↳</span>
      <span class="me-auto text-break">{{ MireLayout.subagentName(subagent) }}</span>
      <span v-if="MireViewTexts.freshnessText(subagent.facts.freshness) !== null" class="badge theme-warning">{{ MireViewTexts.freshnessText(subagent.facts.freshness) }}</span>
      <MireStatusText :status="subagent.status" />
    </button>
    <MireSubagentRows :subagents="subagent.children" :depth="depth + 1" />
  </template>
</template>
