<script setup lang="ts">
import { computed, ref } from "vue";
import type { HeidrunCodeDashboardCodingAgentNode } from "../../lib/heidrun_code_dashboard/heidrun_code_dashboard_model_types";
import { HeidrunCodeDashboardStore, heidrunCodeDashboardIndex, heidrunCodeDashboardIsOnLocalNetwork, heidrunCodeDashboardMessages, heidrunCodeDashboardModel } from "../../stores/heidrun_code_dashboard/heidrun_code_dashboard_store";
import HeidrunCodeDashboardAttentionList from "./HeidrunCodeDashboardAttentionList.vue";
import HeidrunCodeDashboardMessageList from "./HeidrunCodeDashboardMessageList.vue";
import HeidrunCodeDashboardNodeNotices from "./HeidrunCodeDashboardNodeNotices.vue";
import HeidrunCodeDashboardStatusText from "./HeidrunCodeDashboardStatusText.vue";
import HeidrunCodeDashboardSubagentRows from "./HeidrunCodeDashboardSubagentRows.vue";
import HeidrunCodeDashboardTaskTexts from "./HeidrunCodeDashboardTaskTexts.vue";
import HeidrunCodeDashboardTerminalPreview from "./HeidrunCodeDashboardTerminalPreview.vue";
import { HeidrunCodeDashboardViewTexts } from "./heidrun_code_dashboard_view_texts";
import { t } from "../../i18n/index";
import Icon from "../Icon.vue";

// The details of a coding agent: the status, the texts about the task with their exact labels, the pending question
// or approval, the subagents, a read-only preview of the terminal of the pane, and the observed messages. The button
// "Open in Heidrun Code" reads the Herdr session again, then shows the exact pane in the main window. When the pane is
// gone, the sidebar says so. There is no button to approve.

const props = defineProps<{
  /** The coding agent. */
  codingAgent: HeidrunCodeDashboardCodingAgentNode;
}>();

const emit = defineEmits<{
  /** The pane is now shown in the main window. */
  openedInHeidrunCode: [];
}>();

/** The number of recent messages that the details show. */
const MESSAGE_LIMIT = 20;

const tabLabel = computed(() => heidrunCodeDashboardIndex.value.get(`tab:${props.codingAgent.tabId}`)?.label ?? "");
const isObserved = computed(() => props.codingAgent.facts.freshness !== "not_observed" && props.codingAgent.facts.freshness !== "unmatched");
const attention = computed(() => HeidrunCodeDashboardViewTexts.pendingAttentionOf(heidrunCodeDashboardModel.value, new Set([props.codingAgent.nodeId])));
const nodeIds = computed(() => HeidrunCodeDashboardViewTexts.subtreeNodeIds(props.codingAgent));
const messages = computed(() => HeidrunCodeDashboardViewTexts.recentMessages(heidrunCodeDashboardMessages.value, nodeIds.value, MESSAGE_LIMIT));

/** True while "Open in Heidrun Code" reads the Herdr session. */
const isOpening = ref(false);

async function openInHeidrunCode() {
  if (isOpening.value === true) {
    return;
  }
  isOpening.value = true;
  try {
    const result = await HeidrunCodeDashboardStore.openInHeidrunCode({
      kind: "pane",
      id: props.codingAgent.paneId,
    });
    if (result === "opened") {
      emit("openedInHeidrunCode");
    }
  } finally {
    isOpening.value = false;
  }
}
</script>

<template>
  <div class="d-flex flex-column gap-3" data-heidrun-code-dashboard-details="coding_agent">
    <div class="d-flex flex-column gap-1">
      <div class="eyebrow">{{ t("heidrunCodeDashboard.details.codingAgent", { agent: HeidrunCodeDashboardViewTexts.agentName(codingAgent.agent) }) }}</div>
      <div class="d-flex align-items-center justify-content-between gap-2">
        <div class="d-flex align-items-center gap-2">
          <i v-if="HeidrunCodeDashboardViewTexts.agentIcon(codingAgent.agent) !== null" class="bi fs-4" :class="`bi-${HeidrunCodeDashboardViewTexts.agentIcon(codingAgent.agent)}`" role="img" :aria-label="HeidrunCodeDashboardViewTexts.agentName(codingAgent.agent)" :data-badge="HeidrunCodeDashboardViewTexts.agentIcon(codingAgent.agent)"></i>
          <span v-else class="badge theme-secondary font-monospace" :data-badge="HeidrunCodeDashboardViewTexts.agentBadge(codingAgent.agent)">{{ HeidrunCodeDashboardViewTexts.agentBadge(codingAgent.agent) }}</span>
          <span class="fs-4 fw-semibold text-break" data-tab-name>{{ tabLabel }}</span>
        </div>
        <HeidrunCodeDashboardStatusText :status="codingAgent.status" />
      </div>
      <div v-if="codingAgent.label !== null && codingAgent.label !== tabLabel" class="text-body-secondary text-break">{{ t("heidrunCodeDashboard.details.paneName", { name: codingAgent.label }) }}</div>
      <HeidrunCodeDashboardNodeNotices :notices="codingAgent.notices" />
      <div class="text-body-secondary text-break" data-chat-state>
        {{ t(`heidrunCodeDashboard.chat.${codingAgent.chat.state}`) }}<template v-if="codingAgent.chat.chatId !== null"> · <span class="font-monospace">{{ codingAgent.chat.chatId }}</span></template>
      </div>
      <div v-if="codingAgent.observedSinceMs !== null" class="text-body-secondary" data-observed-since>
        {{ t("heidrunCodeDashboard.details.observedSince", { time: HeidrunCodeDashboardViewTexts.timeText(codingAgent.observedSinceMs) }) }}
      </div>
    </div>
    <button v-if="heidrunCodeDashboardIsOnLocalNetwork === false" type="button" class="btn primary align-self-start" :disabled="isOpening" data-open-in-heidrun-code @click="openInHeidrunCode()">
      <Icon name="box-arrow-up-right" />
      {{ t("heidrunCodeDashboard.details.openInHeidrunCode") }}
    </button>
    <section class="d-flex flex-column gap-2" data-section="task">
      <div class="eyebrow">{{ t("heidrunCodeDashboard.details.task") }}</div>
      <HeidrunCodeDashboardTaskTexts :task-texts="codingAgent.taskTexts" :empty-text="isObserved ? t('heidrunCodeDashboard.details.noTaskText') : t('heidrunCodeDashboard.details.unavailableNotObserved')" />
    </section>
    <section class="d-flex flex-column gap-2" data-section="attention">
      <div class="eyebrow">{{ t("heidrunCodeDashboard.details.attention") }}</div>
      <HeidrunCodeDashboardAttentionList v-if="attention.length > 0" :entries="attention" :blocked="[]" :is-requester-shown="false" />
      <p v-else-if="codingAgent.status === 'blocked'" class="m-0 text-body-secondary">{{ t("heidrunCodeDashboard.attention.blockedWithoutRequest") }}</p>
      <p v-else-if="isObserved" class="m-0 text-body-secondary">{{ t("heidrunCodeDashboard.details.noAttention") }}</p>
      <p v-else class="m-0 text-body-secondary" data-unavailable>{{ t("heidrunCodeDashboard.details.unavailableNotObserved") }}</p>
    </section>
    <section class="d-flex flex-column gap-2" data-section="subagents">
      <div class="eyebrow">{{ t("heidrunCodeDashboard.details.subagents") }}</div>
      <div v-if="codingAgent.subagents.length > 0" class="list-group list-group-flush">
        <HeidrunCodeDashboardSubagentRows :subagents="codingAgent.subagents" :depth="0" />
      </div>
      <p v-else-if="isObserved" class="m-0 text-body-secondary">{{ t("heidrunCodeDashboard.details.noSubagent") }}</p>
      <p v-else class="m-0 text-body-secondary" data-unavailable>{{ t("heidrunCodeDashboard.details.unavailableNotObserved") }}</p>
    </section>
    <section v-if="heidrunCodeDashboardIsOnLocalNetwork === false" class="d-flex flex-column gap-2" data-section="terminal">
      <div class="eyebrow">{{ t("heidrunCodeDashboard.details.terminal") }}</div>
      <HeidrunCodeDashboardTerminalPreview :pane-id="codingAgent.paneId" />
    </section>
    <section class="d-flex flex-column gap-2" data-section="messages">
      <div class="eyebrow">{{ t("heidrunCodeDashboard.details.messages") }}</div>
      <HeidrunCodeDashboardMessageList v-if="isObserved" :messages="messages" />
      <p v-else class="m-0 text-body-secondary" data-unavailable>{{ t("heidrunCodeDashboard.details.unavailableNotObserved") }}</p>
    </section>
  </div>
</template>
