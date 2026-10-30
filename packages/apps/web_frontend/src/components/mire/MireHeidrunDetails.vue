<script setup lang="ts">
import { computed } from "vue";
import { MireStore, mireModel } from "../../stores/mire/mire_store";
import MireAttentionList from "./MireAttentionList.vue";
import MireStatusText from "./MireStatusText.vue";
import { MireViewTexts } from "./mire_view_texts";
import { t } from "../../i18n/index";

// The details of Heidrun: the pending attention first, then the list of the workspaces.

const attention = computed(() => MireViewTexts.pendingAttention(mireModel.value));
const blocked = computed(() => MireViewTexts.blockedWithoutRequest(mireModel.value));
</script>

<template>
  <div class="d-flex flex-column gap-3" data-mire-details="heidrun">
    <div class="d-flex align-items-center justify-content-between gap-2">
      <div class="fs-4 fw-semibold">{{ t("mire.heidrun") }}</div>
      <MireStatusText :status="mireModel.status" />
    </div>
    <section class="d-flex flex-column gap-2" data-section="attention">
      <div class="eyebrow">{{ t("mire.details.attention") }}</div>
      <p v-if="attention.length === 0 && blocked.length === 0" class="m-0 text-body-secondary">{{ t("mire.details.noAttention") }}</p>
      <MireAttentionList v-else :entries="attention" :blocked="blocked" :is-requester-shown="true" />
    </section>
    <section class="d-flex flex-column gap-2" data-section="workspaces">
      <div class="eyebrow">{{ t("mire.details.workspaces") }}</div>
      <p v-if="mireModel.workspaces.length === 0" class="m-0 text-body-secondary">{{ t("mire.graph.noWorkspace") }}</p>
      <div v-else class="list-group list-group-flush">
        <button
          v-for="workspace in mireModel.workspaces"
          :key="workspace.nodeId"
          type="button"
          class="list-action list-group-item list-group-item-action d-flex align-items-center gap-2 text-start"
          :title="workspace.label"
          :data-select-node-id="workspace.nodeId"
          @click="MireStore.select(workspace.nodeId)"
        >
          <span class="me-auto text-break">{{ workspace.label }}</span>
          <span class="text-body-secondary">{{ t("mire.details.itemCount", { count: workspace.coverage.total }) }}</span>
          <MireStatusText :status="workspace.status" />
        </button>
      </div>
    </section>
  </div>
</template>
