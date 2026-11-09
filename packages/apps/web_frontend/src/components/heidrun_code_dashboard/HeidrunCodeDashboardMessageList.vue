<script setup lang="ts">
import type { HeidrunCodeDashboardMessage } from "../../lib/heidrun_code_dashboard/heidrun_code_dashboard_model_types";
import { heidrunCodeDashboardIndex } from "../../stores/heidrun_code_dashboard/heidrun_code_dashboard_store";
import { HeidrunCodeDashboardViewTexts } from "./heidrun_code_dashboard_view_texts";
import { t } from "../../i18n/index";

// The observed messages between coding agents and subagents, the most recent first. A text that the source does not
// give says so, and never shows an invented text.

defineProps<{
  /** The messages, the most recent first. */
  messages: HeidrunCodeDashboardMessage[];
}>();
</script>

<template>
  <p v-if="messages.length === 0" class="m-0 text-body-secondary" data-no-messages>{{ t("heidrunCodeDashboard.messages.none") }}</p>
  <ul v-else class="list-group list-group-flush" data-heidrun-code-dashboard-messages>
    <li v-for="message in messages" :key="message.id" class="list-group-item d-flex flex-column gap-1" :data-message-id="message.id">
      <div class="d-flex flex-wrap align-items-center gap-1">
        <span class="fw-semibold">{{ HeidrunCodeDashboardViewTexts.endpointName(message.from, heidrunCodeDashboardIndex) }}</span>
        <span aria-hidden="true">→</span>
        <span class="fw-semibold">{{ HeidrunCodeDashboardViewTexts.endpointName(message.to, heidrunCodeDashboardIndex) }}</span>
        <span class="text-body-secondary ms-auto">{{ HeidrunCodeDashboardViewTexts.timeText(message.atMs) }}</span>
      </div>
      <div class="text-break" :class="{ 'text-body-secondary fst-italic': message.text === null }" data-message-text>{{ HeidrunCodeDashboardViewTexts.messageText(message) }}</div>
      <div class="text-body-secondary">{{ t(`heidrunCodeDashboard.messages.delivery.${message.delivery}`) }}</div>
    </li>
  </ul>
</template>
