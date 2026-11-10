<script setup lang="ts">
import { computed } from "vue";
import type { HeidrunCodeDashboardVisibleStatus } from "../../lib/heidrun_code_dashboard/heidrun_code_dashboard_model_types";
import { HeidrunCodeDashboardViewTexts } from "./heidrun_code_dashboard_view_texts";
import { t } from "../../i18n/index";

/** One visible status of the Heidrun Code Dashboard: the shared status dot and its text, so that the status never relies on the color alone. */
const props = defineProps<{
  /** The visible status. */
  status: HeidrunCodeDashboardVisibleStatus;
}>();

/** The class of the shared status dot. */
const dotClass = computed(() => HeidrunCodeDashboardViewTexts.statusDotClass(props.status));

/** The class of the shared status text. */
const textClass = computed(() => `t-${props.status === "finished" ? "done" : props.status}`);
</script>

<template>
  <span class="d-inline-flex align-items-center gap-1 text-nowrap" :data-status="status">
    <span class="dot" :class="dotClass" aria-hidden="true"></span>
    <span :class="textClass">{{ t(`heidrunCodeDashboard.status.${status}`) }}</span>
  </span>
</template>
