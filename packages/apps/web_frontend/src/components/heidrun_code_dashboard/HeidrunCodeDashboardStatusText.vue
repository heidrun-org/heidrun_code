<script setup lang="ts">
import { computed } from "vue";
import type { HeidrunCodeDashboardVisibleStatus } from "../../lib/heidrun_code_dashboard/heidrun_code_dashboard_model_types";
import { t } from "../../i18n/index";

/** One visible status of the Heidrun Code Dashboard: the shared status dot and its text, so that the status never relies on the color alone. */
const props = defineProps<{
  /** The visible status. */
  status: HeidrunCodeDashboardVisibleStatus;
}>();

/** The class of the shared status dot: Finished uses the class `done` of the panes, Idle has no extra class. */
const dotClass = computed(() => {
  if (props.status === "finished") {
    return "done";
  }
  return props.status === "idle" ? "" : props.status;
});

/** The class of the shared status text. */
const textClass = computed(() => `t-${props.status === "finished" ? "done" : props.status}`);
</script>

<template>
  <span class="d-inline-flex align-items-center gap-1 text-nowrap" :data-status="status">
    <span class="dot" :class="dotClass" aria-hidden="true"></span>
    <span :class="textClass">{{ t(`heidrunCodeDashboard.status.${status}`) }}</span>
  </span>
</template>
