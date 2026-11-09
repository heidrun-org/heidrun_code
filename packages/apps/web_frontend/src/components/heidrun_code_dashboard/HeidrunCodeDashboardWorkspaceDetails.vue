<script setup lang="ts">
import { computed } from "vue";
import type { HeidrunCodeDashboardTabNode, HeidrunCodeDashboardWorkspaceNode } from "../../lib/heidrun_code_dashboard/heidrun_code_dashboard_model_types";
import { heidrunCodeDashboardMessages, heidrunCodeDashboardModel } from "../../stores/heidrun_code_dashboard/heidrun_code_dashboard_store";
import HeidrunCodeDashboardAttentionList from "./HeidrunCodeDashboardAttentionList.vue";
import HeidrunCodeDashboardHierarchyList from "./HeidrunCodeDashboardHierarchyList.vue";
import HeidrunCodeDashboardMessageList from "./HeidrunCodeDashboardMessageList.vue";
import HeidrunCodeDashboardStatusText from "./HeidrunCodeDashboardStatusText.vue";
import { HeidrunCodeDashboardViewTexts } from "./heidrun_code_dashboard_view_texts";
import { t } from "../../i18n/index";

// The details of a workspace, or of one of its tabs: the status, the coverage, the fixed workspace folder, the tabs
// with their coding agents and the subagents indented under them, the pending attention, and the recent messages.

const props = defineProps<{
  /** The workspace. */
  workspace: HeidrunCodeDashboardWorkspaceNode;
  /** The selected tab, or null when the workspace itself is selected. */
  tab: HeidrunCodeDashboardTabNode | null;
}>();

/** The number of recent messages that the details show. */
const MESSAGE_LIMIT = 20;

const shownNode = computed(() => props.tab ?? props.workspace);
const nodeIds = computed(() => HeidrunCodeDashboardViewTexts.subtreeNodeIds(shownNode.value));
const attention = computed(() => HeidrunCodeDashboardViewTexts.pendingAttentionOf(heidrunCodeDashboardModel.value, nodeIds.value));
const messages = computed(() => HeidrunCodeDashboardViewTexts.recentMessages(heidrunCodeDashboardMessages.value, nodeIds.value, MESSAGE_LIMIT));
</script>

<template>
  <div class="d-flex flex-column gap-3" :data-heidrun-code-dashboard-details="tab === null ? 'workspace' : 'tab'">
    <div class="d-flex flex-column gap-1">
      <div class="eyebrow">{{ tab === null ? t("heidrunCodeDashboard.details.workspace") : t("heidrunCodeDashboard.details.tab") }}</div>
      <div class="d-flex align-items-center justify-content-between gap-2">
        <div class="fs-4 fw-semibold text-break">{{ shownNode.label }}</div>
        <HeidrunCodeDashboardStatusText :status="shownNode.status" />
      </div>
      <div class="text-body-secondary" data-coverage-summary>
        {{
          t("heidrunCodeDashboard.details.coverage", {
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
      <div class="eyebrow">{{ t("heidrunCodeDashboard.details.folder") }}</div>
      <div v-if="workspace.folder !== null" class="font-monospace text-break" data-folder>{{ workspace.folder }}</div>
      <div v-else class="text-body-secondary" data-folder-missing>{{ t("heidrunCodeDashboard.details.folderMissing") }}</div>
    </section>
    <section class="d-flex flex-column gap-2" data-section="hierarchy">
      <div class="eyebrow">{{ t("heidrunCodeDashboard.details.tabsAndAgents") }}</div>
      <HeidrunCodeDashboardHierarchyList :tabs="tab === null ? workspace.tabs : [tab]" />
    </section>
    <section v-if="attention.length > 0" class="d-flex flex-column gap-2" data-section="attention">
      <div class="eyebrow">{{ t("heidrunCodeDashboard.details.attention") }}</div>
      <HeidrunCodeDashboardAttentionList :entries="attention" :blocked="[]" :is-requester-shown="true" />
    </section>
    <section class="d-flex flex-column gap-2" data-section="messages">
      <div class="eyebrow">{{ t("heidrunCodeDashboard.details.messages") }}</div>
      <HeidrunCodeDashboardMessageList :messages="messages" />
    </section>
  </div>
</template>
