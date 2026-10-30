<script setup lang="ts">
import type { MireMessage } from "../../lib/mire/mire_model_types";
import { mireIndex } from "../../stores/mire/mire_store";
import { MireViewTexts } from "./mire_view_texts";
import { t } from "../../i18n/index";

// The observed messages between coding agents and subagents, the most recent first. A text that the source does not
// give says so, and never shows an invented text.

defineProps<{
  /** The messages, the most recent first. */
  messages: MireMessage[];
}>();
</script>

<template>
  <p v-if="messages.length === 0" class="m-0 text-body-secondary" data-no-messages>{{ t("mire.messages.none") }}</p>
  <ul v-else class="list-group list-group-flush" data-mire-messages>
    <li v-for="message in messages" :key="message.id" class="list-group-item d-flex flex-column gap-1" :data-message-id="message.id">
      <div class="d-flex flex-wrap align-items-center gap-1">
        <span class="fw-semibold">{{ MireViewTexts.endpointName(message.from, mireIndex) }}</span>
        <span aria-hidden="true">→</span>
        <span class="fw-semibold">{{ MireViewTexts.endpointName(message.to, mireIndex) }}</span>
        <span class="text-body-secondary ms-auto">{{ MireViewTexts.timeText(message.atMs) }}</span>
      </div>
      <div class="text-break" :class="{ 'text-body-secondary fst-italic': message.text === null }" data-message-text>{{ MireViewTexts.messageText(message) }}</div>
      <div class="text-body-secondary">{{ t(`mire.messages.delivery.${message.delivery}`) }}</div>
    </li>
  </ul>
</template>
