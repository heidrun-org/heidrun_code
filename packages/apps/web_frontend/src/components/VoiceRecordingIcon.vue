<script setup lang="ts">
import { computed } from 'vue';
import Icon from './Icon.vue';
import { t } from '../i18n/index';

const props = defineProps<{ state: 'idle' | 'recording' | 'waiting' | 'transcribing' }>();

const label = computed(() => {
  if (props.state === 'transcribing') {
    return t('voiceInput.titleTranscribing');
  }
  if (props.state === 'waiting') {
    return t('voiceInput.waiting');
  }
  return t('voiceInput.recordingIcon');
});
</script>

<template>
  <span
    v-if="state !== 'idle'"
    class="voice-recording-icon d-inline-flex flex-shrink-0"
    :class="{ 'is-waiting': state === 'waiting', 'is-transcribing': state === 'transcribing' }"
    role="img"
    :aria-label="label"
    :title="label"
  >
    <Icon name="mic-fill" />
  </span>
</template>

<style scoped>
.voice-recording-icon { color: var(--danger-fg); }
.voice-recording-icon.is-waiting { color: var(--voice-wait); }
.voice-recording-icon.is-transcribing { color: var(--success-fg); }
</style>
