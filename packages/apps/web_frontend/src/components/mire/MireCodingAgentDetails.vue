<script setup lang="ts">
import { computed, ref } from "vue";
import type { MireCodingAgentNode } from "../../lib/mire/mire_model_types";
import { MireStore, mireIndex, mireMessages, mireModel } from "../../stores/mire/mire_store";
import MireAttentionList from "./MireAttentionList.vue";
import MireMessageList from "./MireMessageList.vue";
import MireNodeNotices from "./MireNodeNotices.vue";
import MireStatusText from "./MireStatusText.vue";
import MireSubagentRows from "./MireSubagentRows.vue";
import MireTaskTexts from "./MireTaskTexts.vue";
import MireTerminalPreview from "./MireTerminalPreview.vue";
import { MireViewTexts } from "./mire_view_texts";
import { t } from "../../i18n/index";
import Icon from "../Icon.vue";

// The details of a coding agent: the status, the texts about the task with their exact labels, the pending question
// or approval, the subagents, a read-only preview of the terminal of the pane, and the observed messages. The button
// "Open in Heidrun Code" reads the Herdr session again, then shows the exact pane in the main window. When the pane is
// gone, the sidebar says so. There is no button to approve.

const props = defineProps<{
  /** The coding agent. */
  codingAgent: MireCodingAgentNode;
}>();

const emit = defineEmits<{
  /** The pane is now shown in the main window. */
  openedInHeidrunCode: [];
}>();

/** The number of recent messages that the details show. */
const MESSAGE_LIMIT = 20;

const tabLabel = computed(() => mireIndex.value.get(`tab:${props.codingAgent.tabId}`)?.label ?? "");
const isObserved = computed(() => props.codingAgent.facts.freshness !== "not_observed" && props.codingAgent.facts.freshness !== "unmatched");
const attention = computed(() => MireViewTexts.pendingAttentionOf(mireModel.value, new Set([props.codingAgent.nodeId])));
const nodeIds = computed(() => MireViewTexts.subtreeNodeIds(props.codingAgent));
const messages = computed(() => MireViewTexts.recentMessages(mireMessages.value, nodeIds.value, MESSAGE_LIMIT));

/** True while "Open in Heidrun Code" reads the Herdr session. */
const isOpening = ref(false);

async function openInHeidrunCode() {
  if (isOpening.value === true) {
    return;
  }
  isOpening.value = true;
  try {
    const result = await MireStore.openInHeidrunCode(props.codingAgent.paneId);
    if (result === "opened") {
      emit("openedInHeidrunCode");
    }
  } finally {
    isOpening.value = false;
  }
}
</script>

<template>
  <div class="d-flex flex-column gap-3" data-mire-details="coding_agent">
    <div class="d-flex flex-column gap-1">
      <div class="eyebrow">{{ t("mire.details.codingAgent", { agent: MireViewTexts.agentName(codingAgent.agent) }) }}</div>
      <div class="d-flex align-items-center justify-content-between gap-2">
        <div class="d-flex align-items-center gap-2">
          <i v-if="MireViewTexts.agentIcon(codingAgent.agent) !== null" class="bi fs-4" :class="`bi-${MireViewTexts.agentIcon(codingAgent.agent)}`" role="img" :aria-label="MireViewTexts.agentName(codingAgent.agent)" :data-badge="MireViewTexts.agentIcon(codingAgent.agent)"></i>
          <span v-else class="badge theme-secondary font-monospace" :data-badge="MireViewTexts.agentBadge(codingAgent.agent)">{{ MireViewTexts.agentBadge(codingAgent.agent) }}</span>
          <span class="fs-4 fw-semibold text-break" data-tab-name>{{ tabLabel }}</span>
        </div>
        <MireStatusText :status="codingAgent.status" />
      </div>
      <div v-if="codingAgent.label !== null && codingAgent.label !== tabLabel" class="text-body-secondary text-break">{{ t("mire.details.paneName", { name: codingAgent.label }) }}</div>
      <MireNodeNotices :notices="codingAgent.notices" />
      <div class="text-body-secondary text-break" data-chat-state>
        {{ t(`mire.chat.${codingAgent.chat.state}`) }}<template v-if="codingAgent.chat.chatId !== null"> · <span class="font-monospace">{{ codingAgent.chat.chatId }}</span></template>
      </div>
      <div v-if="codingAgent.observedSinceMs !== null" class="text-body-secondary" data-observed-since>
        {{ t("mire.details.observedSince", { time: MireViewTexts.timeText(codingAgent.observedSinceMs) }) }}
      </div>
    </div>
    <button type="button" class="btn primary align-self-start" :disabled="isOpening" data-open-in-heidrun-code @click="openInHeidrunCode()">
      <Icon name="box-arrow-up-right" />
      {{ t("mire.details.openInHeidrunCode") }}
    </button>
    <section class="d-flex flex-column gap-2" data-section="task">
      <div class="eyebrow">{{ t("mire.details.task") }}</div>
      <MireTaskTexts :task-texts="codingAgent.taskTexts" :empty-text="isObserved ? t('mire.details.noTaskText') : t('mire.details.unavailableNotObserved')" />
    </section>
    <section class="d-flex flex-column gap-2" data-section="attention">
      <div class="eyebrow">{{ t("mire.details.attention") }}</div>
      <MireAttentionList v-if="attention.length > 0" :entries="attention" :blocked="[]" :is-requester-shown="false" />
      <p v-else-if="codingAgent.status === 'blocked'" class="m-0 text-body-secondary">{{ t("mire.attention.blockedWithoutRequest") }}</p>
      <p v-else-if="isObserved" class="m-0 text-body-secondary">{{ t("mire.details.noAttention") }}</p>
      <p v-else class="m-0 text-body-secondary" data-unavailable>{{ t("mire.details.unavailableNotObserved") }}</p>
    </section>
    <section class="d-flex flex-column gap-2" data-section="subagents">
      <div class="eyebrow">{{ t("mire.details.subagents") }}</div>
      <div v-if="codingAgent.subagents.length > 0" class="list-group list-group-flush">
        <MireSubagentRows :subagents="codingAgent.subagents" :depth="0" />
      </div>
      <p v-else-if="isObserved" class="m-0 text-body-secondary">{{ t("mire.details.noSubagent") }}</p>
      <p v-else class="m-0 text-body-secondary" data-unavailable>{{ t("mire.details.unavailableNotObserved") }}</p>
    </section>
    <section class="d-flex flex-column gap-2" data-section="terminal">
      <div class="eyebrow">{{ t("mire.details.terminal") }}</div>
      <MireTerminalPreview :pane-id="codingAgent.paneId" />
    </section>
    <section class="d-flex flex-column gap-2" data-section="messages">
      <div class="eyebrow">{{ t("mire.details.messages") }}</div>
      <MireMessageList v-if="isObserved" :messages="messages" />
      <p v-else class="m-0 text-body-secondary" data-unavailable>{{ t("mire.details.unavailableNotObserved") }}</p>
    </section>
  </div>
</template>
