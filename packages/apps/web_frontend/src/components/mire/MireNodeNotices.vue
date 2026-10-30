<script setup lang="ts">
import type { MireNotice } from "../../lib/mire/mire_model_types";
import { t } from "../../i18n/index";

/** The facts that the visible status alone hides, each as a badge with its text. */
defineProps<{
  /** The notices of the node. */
  notices: MireNotice[];
}>();
</script>

<template>
  <div v-if="notices.length > 0" class="d-flex flex-wrap gap-1" data-notices>
    <span v-for="notice in notices" :key="notice" class="badge theme-warning" :data-notice="notice">{{ t(`mire.notice.${notice}`) }}</span>
  </div>
</template>
