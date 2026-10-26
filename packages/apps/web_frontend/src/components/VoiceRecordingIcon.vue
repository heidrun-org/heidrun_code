<script setup lang="ts">
import Icon from "./Icon.vue";
import { t } from "../i18n/index";

// The recording icon (issue 762): a red microphone on the tab button and on the workspace buttons of the Needs you sidebar section
// and of the information card of the status bar, while the microphone records for a pane of that tab or of that workspace. So the
// developer sees that the recording goes on after a switch to another tab or another workspace.
</script>

<template>
  <span class="voice-recording-icon d-inline-flex flex-shrink-0" role="img" :aria-label="t('voiceInput.recordingIcon')" :title="t('voiceInput.recordingIcon')">
    <Icon name="mic-fill" />
  </span>
</template>

<style scoped>
/* The red of the push-to-talk button while the microphone is open. */
.voice-recording-icon { color: var(--danger-fg); }
</style>
