<script setup lang="ts">
import { computed } from "vue";
import type { HeidrunCodeDashboardSubagentNode } from "../../lib/heidrun_code_dashboard/heidrun_code_dashboard_model_types";
import { HeidrunCodeDashboardLayout } from "../../lib/heidrun_code_dashboard/heidrun_code_dashboard_layout";
import { HeidrunCodeDashboardStore, heidrunCodeDashboardIndex, heidrunCodeDashboardIsOnLocalNetwork, heidrunCodeDashboardMessages, heidrunCodeDashboardModel } from "../../stores/heidrun_code_dashboard/heidrun_code_dashboard_store";
import HeidrunCodeDashboardAttentionList from "./HeidrunCodeDashboardAttentionList.vue";
import HeidrunCodeDashboardMessageList from "./HeidrunCodeDashboardMessageList.vue";
import HeidrunCodeDashboardNodeNotices from "./HeidrunCodeDashboardNodeNotices.vue";
import HeidrunCodeDashboardStatusText from "./HeidrunCodeDashboardStatusText.vue";
import HeidrunCodeDashboardSubagentRows from "./HeidrunCodeDashboardSubagentRows.vue";
import HeidrunCodeDashboardTaskTexts from "./HeidrunCodeDashboardTaskTexts.vue";
import HeidrunCodeDashboardTranscriptPreview from "./HeidrunCodeDashboardTranscriptPreview.vue";
import { HeidrunCodeDashboardViewTexts } from "./heidrun_code_dashboard_view_texts";
import { t } from "../../i18n/index";

// The details of a subagent: the native status of its source next to the visible status, the parent, the initial
// instructions when the source gives them, the pending attention, the nested subagents, the transcript preview, and
// the observed messages. A subagent has no terminal of its own: its preview is a transcript.

const props = defineProps<{
  /** The subagent. */
  subagent: HeidrunCodeDashboardSubagentNode;
}>();

/** The number of recent messages that the details show. */
const MESSAGE_LIMIT = 20;

const parentLabel = computed(() => heidrunCodeDashboardIndex.value.get(props.subagent.parentNodeId)?.label ?? props.subagent.parentNodeId);
const attention = computed(() => HeidrunCodeDashboardViewTexts.pendingAttentionOf(heidrunCodeDashboardModel.value, new Set([props.subagent.nodeId])));
const nodeIds = computed(() => HeidrunCodeDashboardViewTexts.subtreeNodeIds(props.subagent));
const messages = computed(() => HeidrunCodeDashboardViewTexts.recentMessages(heidrunCodeDashboardMessages.value, nodeIds.value, MESSAGE_LIMIT));
const initialInstructions = computed(() => props.subagent.taskTexts.filter((taskText) => taskText.label === "initial_instructions"));
const otherTaskTexts = computed(() => props.subagent.taskTexts.filter((taskText) => taskText.label !== "initial_instructions"));
</script>

<template>
  <div class="d-flex flex-column gap-3" data-heidrun-code-dashboard-details="subagent">
    <div class="d-flex flex-column gap-1">
      <div class="eyebrow">{{ t("heidrunCodeDashboard.details.subagent") }}</div>
      <div class="d-flex align-items-center justify-content-between gap-2">
        <div class="fs-4 fw-semibold text-break">{{ HeidrunCodeDashboardLayout.subagentName(subagent) }}</div>
        <HeidrunCodeDashboardStatusText :status="subagent.status" />
      </div>
      <div v-if="subagent.role !== null" class="text-body-secondary text-break" data-role>{{ t("heidrunCodeDashboard.details.role", { role: subagent.role }) }}</div>
      <div class="text-body-secondary text-break" data-native-status>
        {{
          subagent.facts.nativeStatus === null
            ? t("heidrunCodeDashboard.details.nativeStatusUnavailable")
            : t("heidrunCodeDashboard.details.nativeStatus", { source: t(`heidrunCodeDashboard.source.${subagent.facts.nativeStatus.source}`), value: subagent.facts.nativeStatus.value })
        }}
      </div>
      <div v-if="subagent.facts.lastTurnOutcome !== null" class="text-body-secondary" data-outcome>
        {{ t("heidrunCodeDashboard.details.outcome", { outcome: t(`heidrunCodeDashboard.outcome.${subagent.facts.lastTurnOutcome}`) }) }}
      </div>
      <HeidrunCodeDashboardNodeNotices :notices="subagent.notices" />
      <div class="d-flex flex-wrap align-items-center gap-1">
        <span class="text-body-secondary">{{ t("heidrunCodeDashboard.details.parent") }}</span>
        <button type="button" class="btn small" :data-select-node-id="subagent.parentNodeId" @click="HeidrunCodeDashboardStore.select(subagent.parentNodeId)">{{ parentLabel }}</button>
      </div>
      <div v-if="subagent.startedAtMs !== null" class="text-body-secondary">
        {{ t("heidrunCodeDashboard.details.started", { time: HeidrunCodeDashboardViewTexts.timeText(subagent.startedAtMs) }) }}<template v-if="subagent.endedAtMs !== null"> · {{ t("heidrunCodeDashboard.details.ended", { time: HeidrunCodeDashboardViewTexts.timeText(subagent.endedAtMs) }) }}</template>
      </div>
    </div>
    <section class="d-flex flex-column gap-2" data-section="instructions">
      <div class="eyebrow">{{ t("heidrunCodeDashboard.task.initial_instructions") }}</div>
      <HeidrunCodeDashboardTaskTexts :task-texts="initialInstructions" :empty-text="t('heidrunCodeDashboard.details.instructionsUnavailable')" />
      <HeidrunCodeDashboardTaskTexts v-if="otherTaskTexts.length > 0" :task-texts="otherTaskTexts" empty-text="" />
    </section>
    <section class="d-flex flex-column gap-2" data-section="attention">
      <div class="eyebrow">{{ t("heidrunCodeDashboard.details.attention") }}</div>
      <HeidrunCodeDashboardAttentionList v-if="attention.length > 0" :entries="attention" :blocked="[]" :is-requester-shown="false" />
      <p v-else class="m-0 text-body-secondary">{{ t("heidrunCodeDashboard.details.noAttention") }}</p>
    </section>
    <section v-if="subagent.children.length > 0" class="d-flex flex-column gap-2" data-section="subagents">
      <div class="eyebrow">{{ t("heidrunCodeDashboard.details.subagents") }}</div>
      <div class="list-group list-group-flush">
        <HeidrunCodeDashboardSubagentRows :subagents="subagent.children" :depth="0" />
      </div>
    </section>
    <section v-if="heidrunCodeDashboardIsOnLocalNetwork === false" class="d-flex flex-column gap-2" data-section="transcript">
      <div class="eyebrow">{{ t("heidrunCodeDashboard.details.transcript") }}</div>
      <HeidrunCodeDashboardTranscriptPreview :subagent="subagent" />
    </section>
    <section class="d-flex flex-column gap-2" data-section="messages">
      <div class="eyebrow">{{ t("heidrunCodeDashboard.details.messages") }}</div>
      <HeidrunCodeDashboardMessageList :messages="messages" />
    </section>
  </div>
</template>
