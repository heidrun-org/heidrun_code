<script setup lang="ts">
import { computed } from "vue";
import { mireModel, mireState } from "../../stores/mire/mire_store";
import { MireViewTexts } from "./mire_view_texts";
import { t } from "../../i18n/index";

// The coverage notices of the whole Mire: what the live observations do not cover now. They stay visible, so that an
// incomplete observation is never shown as complete.

const items = computed(() => MireViewTexts.items(mireModel.value));

/** The Claude Code coding agents that no observation covers. */
const claudeNotObservedCount = computed(
  () => items.value.filter((item) => item.kind === "coding_agent" && item.agent === "claude" && item.facts.freshness === "not_observed").length,
);

const unmatchedObservationCount = computed(
  () => mireModel.value.unmatchedObservations.claudeSessionIds.length + mireModel.value.unmatchedObservations.codexRootThreadIds.length,
);
</script>

<template>
  <section class="d-flex flex-column gap-1" :aria-label="t('mire.coverage.label')" data-mire-coverage>
    <div v-if="mireModel.observationsState === 'none'" class="alert theme-secondary m-0 p-2" data-coverage="none">
      {{ mireState.connectionError === null ? t("mire.coverage.none") : t("mire.coverage.connectionError", { error: mireState.connectionError }) }}
    </div>
    <div v-if="mireModel.observationsState === 'stale' && mireModel.observedAtMs !== null" class="alert theme-warning m-0 p-2" data-coverage="stale">
      {{ t("mire.coverage.stale", { time: MireViewTexts.timeText(mireModel.observedAtMs) }) }}
    </div>
    <div v-if="claudeNotObservedCount > 0" class="alert theme-secondary m-0 p-2" data-coverage="claude_not_observed">
      {{ t("mire.coverage.claudeNotObserved", { count: claudeNotObservedCount }) }}
    </div>
    <div v-if="mireModel.codexCoverage === 'unavailable'" class="alert theme-secondary m-0 p-2 text-break" data-coverage="codex_unavailable">
      {{ t("mire.coverage.codexUnavailable", { reason: mireModel.codexUnavailableReason ?? t("mire.coverage.noReason") }) }}
    </div>
    <div v-if="mireModel.coverage.stale > 0" class="alert theme-warning m-0 p-2" data-coverage="stale_items">
      {{ t("mire.coverage.staleItems", { count: mireModel.coverage.stale }) }}
    </div>
    <div v-if="mireModel.coverage.unmatched > 0" class="alert theme-secondary m-0 p-2" data-coverage="unmatched">
      {{ t("mire.coverage.unmatched", { count: mireModel.coverage.unmatched }) }}
    </div>
    <div v-if="unmatchedObservationCount > 0" class="alert theme-secondary m-0 p-2" data-coverage="unclaimed">
      {{ t("mire.coverage.unclaimed", { count: unmatchedObservationCount }) }}
    </div>
    <div v-for="(error, position) in mireModel.errors" :key="position" class="alert theme-danger m-0 p-2 text-break" data-coverage="error">
      {{ t("mire.coverage.error", { source: error.source, message: error.message }) }}
    </div>
  </section>
</template>
