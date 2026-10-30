<script setup lang="ts">
import type { MireAttentionEntry, MireBlockedEntry } from "./mire_view_texts";
import { MireLayout } from "../../lib/mire/mire_layout";
import { MireStore, mireIndex } from "../../stores/mire/mire_store";
import { MireViewTexts } from "./mire_view_texts";
import { t } from "../../i18n/index";

// The questions and the approvals that wait, and the blocked items with no observed request. Each row selects the
// item that asks.

defineProps<{
  /** The requests that wait. */
  entries: MireAttentionEntry[];
  /** The blocked items that have no observed request. */
  blocked: MireBlockedEntry[];
  /** True to show the name of the item that asks: in the details of Heidrun and of a workspace. */
  isRequesterShown: boolean;
}>();

function requesterNodeId(entry: MireAttentionEntry): string {
  return entry.attention.requester.nodeId ?? entry.holder.nodeId;
}

function requesterName(entry: MireAttentionEntry): string {
  const nodeId = entry.attention.requester.nodeId;
  const indexed = nodeId === null ? undefined : mireIndex.value.get(nodeId);
  return indexed?.label ?? entry.attention.requester.name ?? entry.attention.requester.nativeId ?? itemName(entry.holder);
}

function itemName(item: MireBlockedEntry["item"]): string {
  if (item.kind === "subagent") {
    return MireLayout.subagentName(item);
  }
  return mireIndex.value.get(item.nodeId)?.label ?? item.agent;
}
</script>

<template>
  <ul class="list-group list-group-flush" data-mire-attention>
    <li v-for="entry in entries" :key="entry.attention.id" class="list-group-item d-flex flex-column gap-1" :data-attention-id="entry.attention.id">
      <button
        v-if="isRequesterShown"
        type="button"
        class="btn small align-self-start"
        :data-select-node-id="requesterNodeId(entry)"
        @click="MireStore.select(requesterNodeId(entry))"
      >{{ requesterName(entry) }}</button>
      <div class="d-flex flex-wrap align-items-center gap-1">
        <span class="badge theme-danger">{{ t(`mire.attention.kind.${entry.attention.kind}`) }}</span>
        <span v-if="entry.attention.tool !== null" class="badge theme-secondary font-monospace">{{ entry.attention.tool }}</span>
        <span v-if="entry.attention.isStale" class="badge theme-warning">{{ t("mire.freshness.stale") }}</span>
        <span v-if="entry.attention.atMs !== null" class="text-body-secondary">{{ MireViewTexts.timeText(entry.attention.atMs) }}</span>
      </div>
      <div class="text-break">{{ entry.attention.summary ?? t("mire.attention.noSummary") }}</div>
      <div class="text-body-secondary" data-developer-action>
        {{ entry.attention.developerAction === "required" ? t("mire.attention.developerRequired") : t("mire.attention.developerUnknown") }}
      </div>
    </li>
    <li v-for="entry in blocked" :key="`blocked-${entry.item.nodeId}`" class="list-group-item d-flex flex-column gap-1" :data-blocked-node-id="entry.item.nodeId">
      <button
        v-if="isRequesterShown"
        type="button"
        class="btn small align-self-start"
        :data-select-node-id="entry.item.nodeId"
        @click="MireStore.select(entry.item.nodeId)"
      >{{ itemName(entry.item) }}</button>
      <div class="text-body-secondary">{{ t("mire.attention.blockedWithoutRequest") }}</div>
    </li>
  </ul>
</template>
