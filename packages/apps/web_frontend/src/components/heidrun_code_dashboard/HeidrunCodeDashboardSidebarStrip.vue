<script setup lang="ts">
import { computed } from "vue";
import type { HeidrunCodeDashboardVisibleStatus } from "../../lib/heidrun_code_dashboard/heidrun_code_dashboard_model_types";
import { HeidrunCodeDashboardStore, heidrunCodeDashboardModel, heidrunCodeDashboardState } from "../../stores/heidrun_code_dashboard/heidrun_code_dashboard_store";
import { HeidrunCodeDashboardSidebarFold } from "../../stores/heidrun_code_dashboard/heidrun_code_dashboard_sidebar_fold";
import { HeidrunCodeDashboardViewTexts } from "./heidrun_code_dashboard_view_texts";
import Icon from "../Icon.vue";
import { t } from "../../i18n/index";

// The folded right sidebar of the Heidrun Code Dashboard: a narrow strip with the button that unfolds the sidebar, a
// warning when a coverage notice of the sidebar warns, the counters of each status as a dot and a number, and the
// button "All" while a filter is on. The global state stays visible while the graph takes the whole width. Each
// counter is the same filter button as in the unfolded sidebar.
// - issue #1016

const STATUSES = HeidrunCodeDashboardViewTexts.COUNTER_STATUSES;

/** True when a coverage notice of the sidebar warns that the view is not complete or not fresh. */
const hasWarning = computed(() => HeidrunCodeDashboardViewTexts.hasCoverageWarning(heidrunCodeDashboardModel.value));

/** The title of a counter: the status, its number, and what a click does. */
function counterTitle(status: HeidrunCodeDashboardVisibleStatus): string {
  const name = t(`heidrunCodeDashboard.status.${status}`);
  const action = heidrunCodeDashboardState.filter === status ? t("heidrunCodeDashboard.counters.clearTitle") : t("heidrunCodeDashboard.counters.filterTitle", { status: name });
  return `${name}: ${HeidrunCodeDashboardViewTexts.counterTotal(heidrunCodeDashboardModel.value, status)}. ${action}`;
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
    <button
      v-if="hasWarning"
      type="button"
      class="navigation-action heidrun-code-dashboard-strip-warning"
      :title="t('heidrunCodeDashboard.sidebar.warning')"
      :aria-label="t('heidrunCodeDashboard.sidebar.warning')"
      data-sidebar-warning
      @click="HeidrunCodeDashboardSidebarFold.toggle()"
    >
      <Icon name="exclamation-triangle" />
    </button>
    <div class="d-flex flex-column gap-1" role="group" :aria-label="t('heidrunCodeDashboard.counters.filterLabel')">
      <button
        v-for="status in STATUSES"
        :key="status"
        type="button"
        class="btn small heidrun-code-dashboard-strip-counter"
        :aria-pressed="heidrunCodeDashboardState.filter === status"
        :title="counterTitle(status)"
        :data-filter="status"
        @click="HeidrunCodeDashboardStore.toggleFilter(status)"
      >
        <span class="dot" :class="HeidrunCodeDashboardViewTexts.statusDotClass(status)" aria-hidden="true"></span>
        <span class="fw-semibold" data-count>{{ HeidrunCodeDashboardViewTexts.counterTotal(heidrunCodeDashboardModel, status) }}</span>
      </button>
      <button
        v-if="heidrunCodeDashboardState.filter !== null"
        type="button"
        class="btn small heidrun-code-dashboard-strip-counter"
        :title="t('heidrunCodeDashboard.counters.allTitle')"
        data-filter-all
        @click="HeidrunCodeDashboardStore.clearFilter()"
      >{{ t("heidrunCodeDashboard.counters.all") }}</button>
    </div>
  </aside>
</template>

<style scoped>
/* The strip keeps the place of the sidebar border, so the graph keeps its frame. */
.heidrun-code-dashboard-sidebar-strip { width: 52px; flex-shrink: 0; min-height: 0; border-left: 1px solid var(--line); background: var(--side); }
.heidrun-code-dashboard-strip-counter { width: 44px; height: auto; flex-direction: column; gap: 2px; padding: 4px 0; }
.heidrun-code-dashboard-strip-warning { color: var(--accent); }
</style>
