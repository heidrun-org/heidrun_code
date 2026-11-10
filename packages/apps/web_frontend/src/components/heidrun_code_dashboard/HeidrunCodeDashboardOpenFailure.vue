<script setup lang="ts">
import { HeidrunCodeDashboardStore, heidrunCodeDashboardState } from "../../stores/heidrun_code_dashboard/heidrun_code_dashboard_store";
import { t } from "../../i18n/index";

// The message of the last "Open in Heidrun Code" that opened nothing, with its button "Dismiss". The sidebar shows it, and
// the view shows it over the graph while the sidebar is folded, so that a failure is never silent (issue #1016).
</script>

<template>
  <div v-if="heidrunCodeDashboardState.openFailure !== null" class="alert theme-danger m-0 p-2 d-flex align-items-start gap-2" role="status" data-open-failure>
    <span class="me-auto">{{ t(`heidrunCodeDashboard.open.${heidrunCodeDashboardState.openFailure}`) }}</span>
    <button type="button" class="btn small" :title="t('heidrunCodeDashboard.open.dismiss')" @click="HeidrunCodeDashboardStore.clearOpenFailure()">{{ t("heidrunCodeDashboard.open.dismiss") }}</button>
  </div>
</template>
