<script setup lang="ts">
import type { MireVisibleStatus } from "../../lib/mire/mire_model_types";
import { MireStore, mireModel, mireState } from "../../stores/mire/mire_store";
import MireStatusText from "./MireStatusText.vue";
import { t } from "../../i18n/index";

// The counters of the Mire: for each visible status, the coding agents and the subagents, each counted once, from the
// whole model. The totals never follow the active filter. Each counter is a filter button: a second click on the same
// counter, or the button "All", shows every node again.

/** The statuses of the counters, in the order of the aggregation, with unknown last. */
const STATUSES: MireVisibleStatus[] = ["working", "blocked", "finished", "idle", "unknown"];
</script>

<template>
  <section class="d-flex flex-column gap-2" :aria-label="t('mire.counters.label')" data-mire-counters>
    <div class="d-flex align-items-center justify-content-between gap-2">
      <div class="eyebrow">{{ t("mire.counters.title") }}</div>
      <button
        type="button"
        class="btn small"
        :aria-pressed="mireState.filter === null"
        :title="t('mire.counters.allTitle')"
        data-filter-all
        @click="MireStore.clearFilter()"
      >{{ t("mire.counters.all") }}</button>
    </div>
    <div class="mire-counter-grid" role="group" :aria-label="t('mire.counters.filterLabel')">
      <button
        v-for="status in STATUSES"
        :key="status"
        type="button"
        class="btn small mire-counter"
        :aria-pressed="mireState.filter === status"
        :title="mireState.filter === status ? t('mire.counters.clearTitle') : t('mire.counters.filterTitle', { status: t(`mire.status.${status}`) })"
        :data-filter="status"
        @click="MireStore.toggleFilter(status)"
      >
        <span class="d-flex align-items-center justify-content-between gap-2">
          <MireStatusText :status="status" />
          <span class="fw-semibold" data-count>{{ mireModel.counters.codingAgents[status] + mireModel.counters.subagents[status] }}</span>
        </span>
        <span class="text-body-secondary mire-counter-detail" data-detail>{{
          t("mire.counters.detail", {
            codingAgents: mireModel.counters.codingAgents[status],
            subagents: mireModel.counters.subagents[status],
          })
        }}</span>
      </button>
    </div>
    <div class="text-body-secondary" data-filter-state>
      {{ mireState.filter === null ? t("mire.counters.noFilter") : t("mire.counters.activeFilter", { status: t(`mire.status.${mireState.filter}`) }) }}
    </div>
  </section>
</template>

<style scoped>
/* A grid of counters of equal width: Bootstrap of the application has no grid part. */
.mire-counter-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
.mire-counter { height: auto; flex-direction: column; align-items: stretch; padding-top: 4px; padding-bottom: 4px; text-align: left; }
.mire-counter-detail { font-size: calc(var(--font-size) * 0.85); white-space: normal; }
</style>
