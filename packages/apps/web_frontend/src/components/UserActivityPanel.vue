<script setup lang="ts">
// The User activity sidebar section: a view to check by eye that the detection of the activity of the user works. It
// shows the state now, the folder of the selected workspace, the total of each folder today, and the last periods.
import { computed } from "vue";
import { UserActivity } from "../lib/user_activity";
import { UserActivityView } from "../lib/user_activity_view";
import { startScrolling, stopScrolling } from "../lib/scroll_on_hover";
import {
  activePeriodStartedAt,
  isUserActive,
  selectedWorkspaceFolder,
  userActivityRecordsOfToday,
} from "../stores/user_activity";
import { t } from "../i18n/index";
import ScrollingLine from "./ScrollingLine.vue";

/** The file where the records are kept, as the sidebar section shows it. */
const RECORDS_FILE = "~/.config/heidrun_code/user_activity.jsonl";

/** The time of the day when the running period started, or an empty text when no period runs. */
const activeSinceTime = computed(() =>
  activePeriodStartedAt.value === null
    ? ""
    : UserActivityView.timeOfDay(UserActivity.formatTime(activePeriodStartedAt.value)),
);

/** The total time of each folder today, the longest first. */
const totals = computed(() => UserActivityView.totalsByFolder(userActivityRecordsOfToday.value));

/** The last periods, the newest first. */
const rows = computed(() => UserActivityView.rows(userActivityRecordsOfToday.value));
</script>

<template>
  <div class="user-activity" :aria-label="t('userActivityPanel.label')">
    <header class="user-activity-title d-flex align-items-center gap-2">
      <span class="fw-semibold text-truncate me-auto">{{ t("userActivityPanel.title") }}</span>
      <span class="badge" :class="isUserActive ? 'theme-success' : 'theme-secondary'" data-field="state">
        {{ isUserActive ? t("userActivityPanel.active") : t("userActivityPanel.notActive") }}
      </span>
    </header>
    <div class="user-activity-body">
      <p v-if="isUserActive" class="text-body-secondary mb-0" data-field="since">
        {{ t("userActivityPanel.activeSince", { time: activeSinceTime }) }}
      </p>
      <section>
        <h3 class="user-activity-section-title fw-semibold">{{ t("userActivityPanel.folderLabel") }}</h3>
        <div v-if="selectedWorkspaceFolder !== null" data-field="folder" @pointerenter="startScrolling" @pointerleave="stopScrolling">
          <ScrollingLine class="font-monospace">{{ selectedWorkspaceFolder }}</ScrollingLine>
        </div>
        <p v-else class="text-body-secondary mb-0" data-field="folder">{{ t("userActivityPanel.noFolder") }}</p>
      </section>
      <section>
        <h3 class="user-activity-section-title fw-semibold">{{ t("userActivityPanel.todayTitle") }}</h3>
        <p v-if="totals.length === 0" class="text-body-secondary mb-0" data-field="no-today">{{ t("userActivityPanel.noToday") }}</p>
        <div v-else class="list-group list-group-flush" data-field="totals">
          <div
            v-for="total in totals"
            :key="total.workspaceFolder"
            class="list-group-item d-flex justify-content-between gap-2"
            data-total
            @pointerenter="startScrolling"
            @pointerleave="stopScrolling"
          >
            <ScrollingLine class="font-monospace">{{ total.workspaceFolder }}</ScrollingLine>
            <span class="text-nowrap fw-medium">{{ UserActivityView.formatDuration(total.durationMs) }}</span>
          </div>
        </div>
      </section>
      <section>
        <h3 class="user-activity-section-title fw-semibold">{{ t("userActivityPanel.lastPeriodsTitle") }}</h3>
        <div class="list-group list-group-flush" data-field="periods">
          <div
            v-for="row in rows"
            :key="row.key"
            class="list-group-item d-flex flex-column gap-2"
            data-period
            @pointerenter="startScrolling"
            @pointerleave="stopScrolling"
          >
            <div class="d-flex justify-content-between gap-2">
              <span class="font-monospace text-nowrap">{{ row.timeRange }}</span>
              <span class="text-nowrap fw-medium">{{ row.duration }}</span>
            </div>
            <ScrollingLine class="font-monospace text-body-secondary">{{ row.workspaceFolder }}</ScrollingLine>
            <div class="d-flex flex-wrap gap-2 text-body-secondary">
              <span>{{ t("userActivityPanel.keyboardCount", { number: row.keyboardActionCount }) }}</span>
              <span>{{ t("userActivityPanel.mouseCount", { number: row.mouseActionCount }) }}</span>
            </div>
            <span class="text-body-secondary" data-reason>{{ t(`userActivityPanel.reason.${row.endReason}`) }}</span>
          </div>
        </div>
      </section>
      <p class="text-body-secondary mb-0">{{ t("userActivityPanel.fileLabel") }}: <span class="font-monospace">{{ RECORDS_FILE }}</span></p>
    </div>
  </div>
</template>

<style scoped>
.user-activity { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.user-activity-title { flex: 0 0 auto; padding: 12px 14px 0; }
.user-activity-body { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; padding: 10px 14px 18px; font-size: var(--font-size); }
.user-activity-section-title { margin: 0 0 4px; font-size: var(--font-size); }
</style>
