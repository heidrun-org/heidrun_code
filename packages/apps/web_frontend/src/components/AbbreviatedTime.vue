<script setup lang="ts">
import { computed } from "vue";
import { ago } from "../lib/format";
import { fullDateText } from "../lib/chat_dates";
import { t } from "../i18n/index";
import Icon from "./Icon.vue";

/**
 * An abbreviated time ("just now", "3 min ago") with a small circled question mark after it.
 * The title of the circled question mark is the exact time.
 *
 * - issue #499
 */
const props = defineProps<{
  /** The date, in milliseconds since 1970. */
  milliseconds: number;
  /** The key of a phrase that ends with the time, as `{time}`, for example "mobileModal.lastSeen". */
  phraseKey?: string;
}>();

/** The exact time: the full date, with the day of the week and the time. */
const fullText = computed(() => fullDateText(props.milliseconds));
</script>

<template>
  <span class="abbreviated-time">
    {{ phraseKey === undefined ? ago(milliseconds) : t(phraseKey, { time: ago(milliseconds) }) }}
    <span class="ms-1" :title="fullText" :aria-label="fullText" role="img" data-exact-time>
      <small><Icon name="question-circle" /></small>
    </span>
  </span>
</template>
