<script setup lang="ts">
import { computed } from "vue";
import type { MireTabNode, MireWorkspaceNode } from "../../lib/mire/mire_model_types";
import { mireMessages, mireModel } from "../../stores/mire/mire_store";
import MireAttentionList from "./MireAttentionList.vue";
import MireHierarchyList from "./MireHierarchyList.vue";
import MireMessageList from "./MireMessageList.vue";
import MireStatusText from "./MireStatusText.vue";
import { MireViewTexts } from "./mire_view_texts";
import { t } from "../../i18n/index";

// The details of a workspace, or of one of its tabs: the status, the coverage, the fixed workspace folder, the tabs
// with their coding agents and the subagents indented under them, the pending attention, and the recent messages.

const props = defineProps<{
  /** The workspace. */
  workspace: MireWorkspaceNode;
  /** The selected tab, or null when the workspace itself is selected. */
  tab: MireTabNode | null;
}>();

/** The number of recent messages that the details show. */
const MESSAGE_LIMIT = 20;

const shownNode = computed(() => props.tab ?? props.workspace);
const nodeIds = computed(() => MireViewTexts.subtreeNodeIds(shownNode.value));
const attention = computed(() => MireViewTexts.pendingAttentionOf(mireModel.value, nodeIds.value));
const messages = computed(() => MireViewTexts.recentMessages(mireMessages.value, nodeIds.value, MESSAGE_LIMIT));
</script>

<template>
  <div class="d-flex flex-column gap-3" :data-mire-details="tab === null ? 'workspace' : 'tab'">
    <div class="d-flex flex-column gap-1">
      <div class="eyebrow">{{ tab === null ? t("mire.details.workspace") : t("mire.details.tab") }}</div>
      <div class="d-flex align-items-center justify-content-between gap-2">
        <div class="fs-4 fw-semibold text-break">{{ shownNode.label }}</div>
        <MireStatusText :status="shownNode.status" />
      </div>
      <div class="text-body-secondary" data-coverage-summary>
        {{
          t("mire.details.coverage", {
            total: shownNode.coverage.total,
            unknown: shownNode.coverage.unknown,
            stale: shownNode.coverage.stale,
            unmatched: shownNode.coverage.unmatched,
            notObserved: shownNode.coverage.notObserved,
          })
        }}
      </div>
    </div>
    <section class="d-flex flex-column gap-1" data-section="folder">
      <div class="eyebrow">{{ t("mire.details.folder") }}</div>
      <div v-if="workspace.folder !== null" class="font-monospace text-break" data-folder>{{ workspace.folder }}</div>
      <div v-else class="text-body-secondary" data-folder-missing>{{ t("mire.details.folderMissing") }}</div>
    </section>
    <section class="d-flex flex-column gap-2" data-section="hierarchy">
      <div class="eyebrow">{{ t("mire.details.tabsAndAgents") }}</div>
      <MireHierarchyList :tabs="tab === null ? workspace.tabs : [tab]" />
    </section>
    <section v-if="attention.length > 0" class="d-flex flex-column gap-2" data-section="attention">
      <div class="eyebrow">{{ t("mire.details.attention") }}</div>
      <MireAttentionList :entries="attention" :blocked="[]" :is-requester-shown="true" />
    </section>
    <section class="d-flex flex-column gap-2" data-section="messages">
      <div class="eyebrow">{{ t("mire.details.messages") }}</div>
      <MireMessageList :messages="messages" />
    </section>
  </div>
</template>
