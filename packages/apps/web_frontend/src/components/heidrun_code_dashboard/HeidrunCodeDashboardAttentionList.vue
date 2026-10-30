<script setup lang="ts">
import type { HeidrunCodeDashboardAttentionEntry, HeidrunCodeDashboardBlockedEntry } from "./heidrun_code_dashboard_view_texts";
import { HeidrunCodeDashboardLayout } from "../../lib/heidrun_code_dashboard/heidrun_code_dashboard_layout";
import { HeidrunCodeDashboardStore, heidrunCodeDashboardIndex } from "../../stores/heidrun_code_dashboard/heidrun_code_dashboard_store";
import { HeidrunCodeDashboardViewTexts } from "./heidrun_code_dashboard_view_texts";
import { t } from "../../i18n/index";

// The questions and the approvals that wait, and the blocked items with no observed request. Each row selects the
// item that asks.

defineProps<{
  /** The requests that wait. */
  entries: HeidrunCodeDashboardAttentionEntry[];
  /** The blocked items that have no observed request. */
  blocked: HeidrunCodeDashboardBlockedEntry[];
  /** True to show the name of the item that asks: in the details of Heidrun and of a workspace. */
  isRequesterShown: boolean;
}>();

function requesterNodeId(entry: HeidrunCodeDashboardAttentionEntry): string {
  return entry.attention.requester.nodeId ?? entry.holder.nodeId;
}

function requesterName(entry: HeidrunCodeDashboardAttentionEntry): string {
  const nodeId = entry.attention.requester.nodeId;
  const indexed = nodeId === null ? undefined : heidrunCodeDashboardIndex.value.get(nodeId);
  return indexed?.label ?? entry.attention.requester.name ?? entry.attention.requester.nativeId ?? itemName(entry.holder);
}

function itemName(item: HeidrunCodeDashboardBlockedEntry["item"]): string {
  if (item.kind === "subagent") {
    return HeidrunCodeDashboardLayout.subagentName(item);
  }
  return heidrunCodeDashboardIndex.value.get(item.nodeId)?.label ?? item.agent;
}
</script>

<template>
  <ul class="list-group list-group-flush" data-heidrun-code-dashboard-attention>
    <li v-for="entry in entries" :key="entry.attention.id" class="list-group-item d-flex flex-column gap-1" :data-attention-id="entry.attention.id">
      <button
        v-if="isRequesterShown"
        type="button"
        class="btn small align-self-start"
        :data-select-node-id="requesterNodeId(entry)"
        @click="HeidrunCodeDashboardStore.select(requesterNodeId(entry))"
      >{{ requesterName(entry) }}</button>
      <div class="d-flex flex-wrap align-items-center gap-1">
        <span class="badge theme-danger">{{ t(`heidrunCodeDashboard.attention.kind.${entry.attention.kind}`) }}</span>
        <span v-if="entry.attention.tool !== null" class="badge theme-secondary font-monospace">{{ entry.attention.tool }}</span>
        <span v-if="entry.attention.isStale" class="badge theme-warning">{{ t("heidrunCodeDashboard.freshness.stale") }}</span>
        <span v-if="entry.attention.atMs !== null" class="text-body-secondary">{{ HeidrunCodeDashboardViewTexts.timeText(entry.attention.atMs) }}</span>
      </div>
      <div class="text-break">{{ entry.attention.summary ?? t("heidrunCodeDashboard.attention.noSummary") }}</div>
      <div class="text-body-secondary" data-developer-action>
        {{ entry.attention.developerAction === "required" ? t("heidrunCodeDashboard.attention.developerRequired") : t("heidrunCodeDashboard.attention.developerUnknown") }}
      </div>
    </li>
    <li v-for="entry in blocked" :key="`blocked-${entry.item.nodeId}`" class="list-group-item d-flex flex-column gap-1" :data-blocked-node-id="entry.item.nodeId">
      <button
        v-if="isRequesterShown"
        type="button"
        class="btn small align-self-start"
        :data-select-node-id="entry.item.nodeId"
        @click="HeidrunCodeDashboardStore.select(entry.item.nodeId)"
      >{{ itemName(entry.item) }}</button>
      <div class="text-body-secondary">{{ t("heidrunCodeDashboard.attention.blockedWithoutRequest") }}</div>
    </li>
  </ul>
</template>
