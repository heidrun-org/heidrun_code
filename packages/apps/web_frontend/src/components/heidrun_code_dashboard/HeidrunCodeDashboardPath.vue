<script setup lang="ts">
import { HeidrunCodeDashboardStore, heidrunCodeDashboardSelectedPath } from "../../stores/heidrun_code_dashboard/heidrun_code_dashboard_store";
import { t } from "../../i18n/index";

// The path of the selection, above the details of the right sidebar: Heidrun › workspace › tab › coding agent ›
// subagent. Each level is a button that selects it again; the last level is the selected node.
</script>

<template>
  <nav class="d-flex flex-wrap align-items-center gap-1" :aria-label="t('heidrunCodeDashboard.path.label')" data-heidrun-code-dashboard-path>
    <template v-for="(entry, position) in heidrunCodeDashboardSelectedPath" :key="entry.nodeId">
      <span v-if="position > 0" class="text-body-secondary" aria-hidden="true">›</span>
      <button
        type="button"
        class="btn small heidrun-code-dashboard-path-item"
        :aria-current="position === heidrunCodeDashboardSelectedPath.length - 1 ? 'true' : undefined"
        :title="entry.node.kind === 'heidrun' ? t('heidrunCodeDashboard.heidrun') : entry.label"
        :data-path-node-id="entry.nodeId"
        @click="HeidrunCodeDashboardStore.select(entry.nodeId)"
      >{{ entry.node.kind === "heidrun" ? t("heidrunCodeDashboard.heidrun") : entry.label }}</button>
    </template>
  </nav>
</template>

<style scoped>
.heidrun-code-dashboard-path-item { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline-block; }
</style>
