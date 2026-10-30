<script setup lang="ts">
import type { HeidrunCodeDashboardVisibleStatus } from "../../lib/heidrun_code_dashboard/heidrun_code_dashboard_model_types";
import { HeidrunCodeDashboardStore, heidrunCodeDashboardModel, heidrunCodeDashboardState } from "../../stores/heidrun_code_dashboard/heidrun_code_dashboard_store";
import HeidrunCodeDashboardStatusText from "./HeidrunCodeDashboardStatusText.vue";
import { t } from "../../i18n/index";

// The counters of the Heidrun Code Dashboard: for each visible status, the coding agents and the subagents, each counted once, from the
// whole model. The totals never follow the active filter. Each counter is a filter button: a second click on the same
// counter, or the button "All", shows every node again.

/** The statuses of the counters, in the order of the aggregation, with unknown last. */
const STATUSES: HeidrunCodeDashboardVisibleStatus[] = ["working", "blocked", "finished", "idle", "unknown"];
</script>

<template>
  <section class="d-flex flex-column gap-2" :aria-label="t('heidrunCodeDashboard.counters.label')" data-heidrun-code-dashboard-counters>
    <div class="d-flex align-items-center justify-content-between gap-2">
      <div class="eyebrow">{{ t("heidrunCodeDashboard.counters.title") }}</div>
      <button
        type="button"
        class="btn small"
        :aria-pressed="heidrunCodeDashboardState.filter === null"
        :title="t('heidrunCodeDashboard.counters.allTitle')"
        data-filter-all
        @click="HeidrunCodeDashboardStore.clearFilter()"
      >{{ t("heidrunCodeDashboard.counters.all") }}</button>
    </div>
    <div class="heidrun-code-dashboard-counter-grid" role="group" :aria-label="t('heidrunCodeDashboard.counters.filterLabel')">
      <button
        v-for="status in STATUSES"
        :key="status"
        type="button"
        class="btn small heidrun-code-dashboard-counter"
        :aria-pressed="heidrunCodeDashboardState.filter === status"
        :title="heidrunCodeDashboardState.filter === status ? t('heidrunCodeDashboard.counters.clearTitle') : t('heidrunCodeDashboard.counters.filterTitle', { status: t(`heidrunCodeDashboard.status.${status}`) })"
        :data-filter="status"
        @click="HeidrunCodeDashboardStore.toggleFilter(status)"
      >
        <span class="d-flex align-items-center justify-content-between gap-2">
          <HeidrunCodeDashboardStatusText :status="status" />
          <span class="fw-semibold" data-count>{{ heidrunCodeDashboardModel.counters.codingAgents[status] + heidrunCodeDashboardModel.counters.subagents[status] }}</span>
        </span>
        <span class="text-body-secondary heidrun-code-dashboard-counter-detail" data-detail>{{
          t("heidrunCodeDashboard.counters.detail", {
            codingAgents: heidrunCodeDashboardModel.counters.codingAgents[status],
            subagents: heidrunCodeDashboardModel.counters.subagents[status],
          })
        }}</span>
      </button>
    </div>
    <div class="text-body-secondary" data-filter-state>
      {{ heidrunCodeDashboardState.filter === null ? t("heidrunCodeDashboard.counters.noFilter") : t("heidrunCodeDashboard.counters.activeFilter", { status: t(`heidrunCodeDashboard.status.${heidrunCodeDashboardState.filter}`) }) }}
    </div>
  </section>
</template>

<style scoped>
/* A grid of counters of equal width: Bootstrap of the application has no grid part. */
.heidrun-code-dashboard-counter-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
.heidrun-code-dashboard-counter { height: auto; flex-direction: column; align-items: stretch; padding-top: 4px; padding-bottom: 4px; text-align: left; }
.heidrun-code-dashboard-counter-detail { font-size: calc(var(--font-size) * 0.85); white-space: normal; }
</style>
