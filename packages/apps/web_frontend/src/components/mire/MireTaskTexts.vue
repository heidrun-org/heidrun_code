<script setup lang="ts">
import type { MireTaskText } from "../../lib/mire/mire_model_types";
import { MireViewTexts } from "./mire_view_texts";
import { t } from "../../i18n/index";

// The texts about the task of a node, each with its own label: "Initial instructions" or "Last prompt". Neither text
// proves the current task, so neither is called the current task.

defineProps<{
  /** The texts. */
  taskTexts: MireTaskText[];
  /** The text to show when there is no text. */
  emptyText: string;
}>();
</script>

<template>
  <p v-if="taskTexts.length === 0" class="m-0 text-body-secondary" data-no-task-text>{{ emptyText }}</p>
  <div v-for="(taskText, position) in taskTexts" v-else :key="position" class="d-flex flex-column gap-1" :data-task-label="taskText.label">
    <div class="fw-semibold">
      {{ t(`mire.task.${taskText.label}`) }}
      <span v-if="taskText.atMs !== null" class="text-body-secondary">· {{ MireViewTexts.timeText(taskText.atMs) }}</span>
    </div>
    <div class="text-break mire-task-text">{{ taskText.text }}</div>
  </div>
</template>

<style scoped>
.mire-task-text { white-space: pre-wrap; max-height: 160px; overflow-y: auto; }
</style>
