<script setup lang="ts">
import { computed } from "vue";
import type { MireSubagentNode } from "../../lib/mire/mire_model_types";
import { MireLayout } from "../../lib/mire/mire_layout";
import { MireStore, mireIndex, mireIsOnLocalNetwork, mireMessages, mireModel } from "../../stores/mire/mire_store";
import MireAttentionList from "./MireAttentionList.vue";
import MireMessageList from "./MireMessageList.vue";
import MireNodeNotices from "./MireNodeNotices.vue";
import MireStatusText from "./MireStatusText.vue";
import MireSubagentRows from "./MireSubagentRows.vue";
import MireTaskTexts from "./MireTaskTexts.vue";
import MireTranscriptPreview from "./MireTranscriptPreview.vue";
import { MireViewTexts } from "./mire_view_texts";
import { t } from "../../i18n/index";

// The details of a subagent: the native status of its source next to the visible status, the parent, the initial
// instructions when the source gives them, the pending attention, the nested subagents, the transcript preview, and
// the observed messages. A subagent has no terminal of its own: its preview is a transcript.

const props = defineProps<{
  /** The subagent. */
  subagent: MireSubagentNode;
}>();

/** The number of recent messages that the details show. */
const MESSAGE_LIMIT = 20;

const parentLabel = computed(() => mireIndex.value.get(props.subagent.parentNodeId)?.label ?? props.subagent.parentNodeId);
const attention = computed(() => MireViewTexts.pendingAttentionOf(mireModel.value, new Set([props.subagent.nodeId])));
const nodeIds = computed(() => MireViewTexts.subtreeNodeIds(props.subagent));
const messages = computed(() => MireViewTexts.recentMessages(mireMessages.value, nodeIds.value, MESSAGE_LIMIT));
const initialInstructions = computed(() => props.subagent.taskTexts.filter((taskText) => taskText.label === "initial_instructions"));
const otherTaskTexts = computed(() => props.subagent.taskTexts.filter((taskText) => taskText.label !== "initial_instructions"));
</script>

<template>
  <div class="d-flex flex-column gap-3" data-mire-details="subagent">
    <div class="d-flex flex-column gap-1">
      <div class="eyebrow">{{ t("mire.details.subagent") }}</div>
      <div class="d-flex align-items-center justify-content-between gap-2">
        <div class="fs-4 fw-semibold text-break">{{ MireLayout.subagentName(subagent) }}</div>
        <MireStatusText :status="subagent.status" />
      </div>
      <div v-if="subagent.role !== null" class="text-body-secondary text-break" data-role>{{ t("mire.details.role", { role: subagent.role }) }}</div>
      <div class="text-body-secondary text-break" data-native-status>
        {{
          subagent.facts.nativeStatus === null
            ? t("mire.details.nativeStatusUnavailable")
            : t("mire.details.nativeStatus", { source: t(`mire.source.${subagent.facts.nativeStatus.source}`), value: subagent.facts.nativeStatus.value })
        }}
      </div>
      <div v-if="subagent.facts.lastTurnOutcome !== null" class="text-body-secondary" data-outcome>
        {{ t("mire.details.outcome", { outcome: t(`mire.outcome.${subagent.facts.lastTurnOutcome}`) }) }}
      </div>
      <MireNodeNotices :notices="subagent.notices" />
      <div class="d-flex flex-wrap align-items-center gap-1">
        <span class="text-body-secondary">{{ t("mire.details.parent") }}</span>
        <button type="button" class="btn small" :data-select-node-id="subagent.parentNodeId" @click="MireStore.select(subagent.parentNodeId)">{{ parentLabel }}</button>
      </div>
      <div v-if="subagent.startedAtMs !== null" class="text-body-secondary">
        {{ t("mire.details.started", { time: MireViewTexts.timeText(subagent.startedAtMs) }) }}<template v-if="subagent.endedAtMs !== null"> · {{ t("mire.details.ended", { time: MireViewTexts.timeText(subagent.endedAtMs) }) }}</template>
      </div>
    </div>
    <section class="d-flex flex-column gap-2" data-section="instructions">
      <div class="eyebrow">{{ t("mire.task.initial_instructions") }}</div>
      <MireTaskTexts :task-texts="initialInstructions" :empty-text="t('mire.details.instructionsUnavailable')" />
      <MireTaskTexts v-if="otherTaskTexts.length > 0" :task-texts="otherTaskTexts" empty-text="" />
    </section>
    <section class="d-flex flex-column gap-2" data-section="attention">
      <div class="eyebrow">{{ t("mire.details.attention") }}</div>
      <MireAttentionList v-if="attention.length > 0" :entries="attention" :blocked="[]" :is-requester-shown="false" />
      <p v-else class="m-0 text-body-secondary">{{ t("mire.details.noAttention") }}</p>
    </section>
    <section v-if="subagent.children.length > 0" class="d-flex flex-column gap-2" data-section="subagents">
      <div class="eyebrow">{{ t("mire.details.subagents") }}</div>
      <div class="list-group list-group-flush">
        <MireSubagentRows :subagents="subagent.children" :depth="0" />
      </div>
    </section>
    <section v-if="mireIsOnLocalNetwork === false" class="d-flex flex-column gap-2" data-section="transcript">
      <div class="eyebrow">{{ t("mire.details.transcript") }}</div>
      <MireTranscriptPreview :subagent="subagent" />
    </section>
    <section class="d-flex flex-column gap-2" data-section="messages">
      <div class="eyebrow">{{ t("mire.details.messages") }}</div>
      <MireMessageList :messages="messages" />
    </section>
  </div>
</template>
