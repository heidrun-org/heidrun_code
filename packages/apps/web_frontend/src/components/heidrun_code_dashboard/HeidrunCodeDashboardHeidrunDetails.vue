<script setup lang="ts">
import { computed } from "vue";
import { HeidrunCodeDashboardStore, heidrunCodeDashboardModel } from "../../stores/heidrun_code_dashboard/heidrun_code_dashboard_store";
import HeidrunCodeDashboardAttentionList from "./HeidrunCodeDashboardAttentionList.vue";
import HeidrunCodeDashboardStatusText from "./HeidrunCodeDashboardStatusText.vue";
import { HeidrunCodeDashboardViewTexts } from "./heidrun_code_dashboard_view_texts";
import { t } from "../../i18n/index";

// The details of Heidrun: the pending attention first, then the list of the workspaces.

const attention = computed(() => HeidrunCodeDashboardViewTexts.pendingAttention(heidrunCodeDashboardModel.value));
const blocked = computed(() => HeidrunCodeDashboardViewTexts.blockedWithoutRequest(heidrunCodeDashboardModel.value));
</script>

<template>
  <div class="d-flex flex-column gap-3" data-heidrun-code-dashboard-details="heidrun">
    <div class="d-flex align-items-center justify-content-between gap-2">
      <div class="fs-4 fw-semibold">{{ t("heidrunCodeDashboard.heidrun") }}</div>
      <HeidrunCodeDashboardStatusText :status="heidrunCodeDashboardModel.status" />
    </div>
    <section class="d-flex flex-column gap-2" data-section="attention">
      <div class="eyebrow">{{ t("heidrunCodeDashboard.details.attention") }}</div>
      <p v-if="attention.length === 0 && blocked.length === 0" class="m-0 text-body-secondary">{{ t("heidrunCodeDashboard.details.noAttention") }}</p>
      <HeidrunCodeDashboardAttentionList v-else :entries="attention" :blocked="blocked" :is-requester-shown="true" />
    </section>
    <section class="d-flex flex-column gap-2" data-section="workspaces">
      <div class="eyebrow">{{ t("heidrunCodeDashboard.details.workspaces") }}</div>
      <p v-if="heidrunCodeDashboardModel.workspaces.length === 0" class="m-0 text-body-secondary">{{ t("heidrunCodeDashboard.graph.noWorkspace") }}</p>
      <div v-else class="list-group list-group-flush">
        <button
          v-for="workspace in heidrunCodeDashboardModel.workspaces"
          :key="workspace.nodeId"
          type="button"
          class="list-action list-group-item list-group-item-action d-flex align-items-center gap-2 text-start"
          :title="workspace.label"
          :data-select-node-id="workspace.nodeId"
          @click="HeidrunCodeDashboardStore.select(workspace.nodeId)"
        >
          <span class="me-auto text-break">{{ workspace.label }}</span>
          <span class="text-body-secondary">{{ t("heidrunCodeDashboard.details.itemCount", { count: workspace.coverage.total }) }}</span>
          <HeidrunCodeDashboardStatusText :status="workspace.status" />
        </button>
      </div>
    </section>
  </div>
</template>
