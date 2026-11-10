<script setup lang="ts">
import type { HeidrunCodeDashboardVisibleStatus } from "../../lib/heidrun_code_dashboard/heidrun_code_dashboard_model_types";
import { HeidrunCodeDashboardStore, heidrunCodeDashboardModel, heidrunCodeDashboardState } from "../../stores/heidrun_code_dashboard/heidrun_code_dashboard_store";
import { HeidrunCodeDashboardSidebarFold } from "../../stores/heidrun_code_dashboard/heidrun_code_dashboard_sidebar_fold";
import Icon from "../Icon.vue";
import { t } from "../../i18n/index";

// The folded right sidebar of the Heidrun Code Dashboard: a narrow strip with the button that unfolds the sidebar, and the
// counters of each status as a dot and a number, so that the global state stays visible while the graph takes the
// whole width. Each counter is the same filter button as in the unfolded sidebar.
// - issue #1016

/** The statuses of the counters, in the order of the unfolded sidebar. */
const STATUSES: HeidrunCodeDashboardVisibleStatus[] = ["working", "blocked", "finished", "idle", "unknown"];

/** The class of the shared status dot: Finished uses the class `done` of the panes, Idle has no extra class. */
function dotClass(status: HeidrunCodeDashboardVisibleStatus): string {
  if (status === "finished") {
    return "done";
  }
  return status === "idle" ? "" : status;
}

/** The number of coding agents and subagents of a status, from the whole model. */
function countOf(status: HeidrunCodeDashboardVisibleStatus): number {
  return heidrunCodeDashboardModel.value.counters.codingAgents[status] + heidrunCodeDashboardModel.value.counters.subagents[status];
}
</script>

<template>
  <aside class="heidrun-code-dashboard-sidebar-strip d-flex flex-column align-items-center gap-2 py-2" :aria-label="t('heidrunCodeDashboard.sidebar.label')" data-heidrun-code-dashboard-sidebar-strip>
    <button
      type="button"
      class="navigation-action"
      :title="t('heidrunCodeDashboard.sidebar.unfold')"
      :aria-label="t('heidrunCodeDashboard.sidebar.unfold')"
      data-sidebar-unfold
      @click="HeidrunCodeDashboardSidebarFold.toggle()"
    >
      <Icon name="chevron-bar-left" />
    </button>
    <div class="d-flex flex-column gap-1" role="group" :aria-label="t('heidrunCodeDashboard.counters.filterLabel')">
      <button
        v-for="status in STATUSES"
        :key="status"
        type="button"
        class="btn small heidrun-code-dashboard-strip-counter"
        :aria-pressed="heidrunCodeDashboardState.filter === status"
        :title="`${t(`heidrunCodeDashboard.status.${status}`)}: ${countOf(status)}`"
        :data-filter="status"
        @click="HeidrunCodeDashboardStore.toggleFilter(status)"
      >
        <span class="dot" :class="dotClass(status)" aria-hidden="true"></span>
        <span class="fw-semibold" data-count>{{ countOf(status) }}</span>
      </button>
    </div>
  </aside>
</template>

<style scoped>
/* The strip keeps the place of the sidebar border, so the graph keeps its frame. */
.heidrun-code-dashboard-sidebar-strip { width: 52px; flex-shrink: 0; min-height: 0; border-left: 1px solid var(--line); background: var(--side); }
.heidrun-code-dashboard-strip-counter { width: 44px; height: auto; flex-direction: column; gap: 2px; padding: 4px 0; }
</style>
