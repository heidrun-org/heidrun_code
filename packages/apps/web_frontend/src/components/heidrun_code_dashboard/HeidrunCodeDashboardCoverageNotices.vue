<script setup lang="ts">
import { computed } from "vue";
import { heidrunCodeDashboardModel, heidrunCodeDashboardState } from "../../stores/heidrun_code_dashboard/heidrun_code_dashboard_store";
import { HeidrunCodeDashboardViewTexts } from "./heidrun_code_dashboard_view_texts";
import { t } from "../../i18n/index";

// The coverage notices of the whole Heidrun Code Dashboard: what the live observations do not cover now. They stay visible, so that an
// incomplete observation is never shown as complete.

const items = computed(() => HeidrunCodeDashboardViewTexts.items(heidrunCodeDashboardModel.value));

/** The Claude Code coding agents that no observation covers. */
const claudeNotObservedCount = computed(
  () => items.value.filter((item) => item.kind === "coding_agent" && item.agent === "claude" && item.facts.freshness === "not_observed").length,
);

const unmatchedObservationCount = computed(
  () => heidrunCodeDashboardModel.value.unmatchedObservations.claudeSessionIds.length + heidrunCodeDashboardModel.value.unmatchedObservations.codexRootThreadIds.length,
);
</script>

<template>
  <section class="d-flex flex-column gap-1" :aria-label="t('heidrunCodeDashboard.coverage.label')" data-heidrun-code-dashboard-coverage>
    <div v-if="heidrunCodeDashboardModel.observationsState === 'none'" class="alert theme-secondary m-0 p-2" data-coverage="none">
      {{ heidrunCodeDashboardState.connectionError === null ? t("heidrunCodeDashboard.coverage.none") : t("heidrunCodeDashboard.coverage.connectionError", { error: heidrunCodeDashboardState.connectionError }) }}
    </div>
    <div v-if="heidrunCodeDashboardModel.observationsState === 'stale' && heidrunCodeDashboardModel.observedAtMs !== null" class="alert theme-warning m-0 p-2" data-coverage="stale">
      {{ t("heidrunCodeDashboard.coverage.stale", { time: HeidrunCodeDashboardViewTexts.timeText(heidrunCodeDashboardModel.observedAtMs) }) }}
    </div>
    <div v-if="claudeNotObservedCount > 0" class="alert theme-secondary m-0 p-2" data-coverage="claude_not_observed">
      {{ t("heidrunCodeDashboard.coverage.claudeNotObserved", { count: claudeNotObservedCount }) }}
    </div>
    <div v-if="heidrunCodeDashboardModel.codexCoverage === 'unavailable'" class="alert theme-secondary m-0 p-2 text-break" data-coverage="codex_unavailable">
      {{ t("heidrunCodeDashboard.coverage.codexUnavailable", { reason: heidrunCodeDashboardModel.codexUnavailableReason ?? t("heidrunCodeDashboard.coverage.noReason") }) }}
    </div>
    <div v-if="heidrunCodeDashboardModel.coverage.stale > 0" class="alert theme-warning m-0 p-2" data-coverage="stale_items">
      {{ t("heidrunCodeDashboard.coverage.staleItems", { count: heidrunCodeDashboardModel.coverage.stale }) }}
    </div>
    <div v-if="heidrunCodeDashboardModel.coverage.unmatched > 0" class="alert theme-secondary m-0 p-2" data-coverage="unmatched">
      {{ t("heidrunCodeDashboard.coverage.unmatched", { count: heidrunCodeDashboardModel.coverage.unmatched }) }}
    </div>
    <div v-if="unmatchedObservationCount > 0" class="alert theme-secondary m-0 p-2" data-coverage="unclaimed">
      {{ t("heidrunCodeDashboard.coverage.unclaimed", { count: unmatchedObservationCount }) }}
    </div>
    <div v-for="(error, position) in heidrunCodeDashboardModel.errors" :key="position" class="alert theme-danger m-0 p-2 text-break" data-coverage="error">
      {{ t("heidrunCodeDashboard.coverage.error", { source: error.source, message: error.message }) }}
    </div>
  </section>
</template>
