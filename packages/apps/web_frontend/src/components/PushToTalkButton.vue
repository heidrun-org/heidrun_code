<script setup lang="ts">
import { computed, onMounted } from "vue";
import Icon from "./Icon.vue";
import { VoiceInput } from "../lib/voice_input";
import { voiceInput } from "../stores/voice_input";
import { t } from "../i18n/index";

const props = defineProps<{ paneId: string }>();

// The push-to-talk button (issue 662). A long press is push to talk: the developer holds the button, speaks, and releases it.
// A short press is a click: the recording goes on until the next click. Heidrun Code changes the speech into text and writes the
// text in the composition bar. The window hears the pointer release, so a release outside of the button ends a long press too.

// The options tell whether the model is on the disk. They are read once, the first time that a button appears.
onMounted(() => {
  if (voiceInput.options === null) {
    void VoiceInput.loadOptions().catch(() => {});
  }
});

const isRecording = computed(
  () =>
    VoiceInput.ownerPaneId() === props.paneId &&
    (voiceInput.state === "recording" || voiceInput.state === "starting"),
);
const isTranscribing = computed(() => VoiceInput.ownerPaneId() === props.paneId && voiceInput.state === "transcribing");
const isLatched = computed(() => VoiceInput.ownerPaneId() === props.paneId && voiceInput.isLatched);
const isModelReady = computed(() => VoiceInput.isModelReady());
const title = computed(() => {
  if (isTranscribing.value) {
    return t("voiceInput.titleTranscribing");
  }
  if (isLatched.value) {
    return t("voiceInput.titleLatched");
  }
  if (isRecording.value) {
    return t("voiceInput.titleRecording");
  }
  return isModelReady.value ? t("voiceInput.title") : t("voiceInput.titleModelMissing");
});

function onPointerDown(event: PointerEvent): void {
  if (event.button !== 0) {
    return;
  }
  void VoiceInput.press(props.paneId);
}

// The keyboard presses the button with Space or Enter. The repeat of a key held down starts nothing.
function onKeyDown(event: KeyboardEvent): void {
  if ((event.key === " " || event.key === "Enter") && event.repeat === false) {
    event.preventDefault();
    void VoiceInput.press(props.paneId);
  }
}
function onKeyUp(event: KeyboardEvent): void {
  if (event.key === " " || event.key === "Enter") {
    event.preventDefault();
    void VoiceInput.release(false, props.paneId);
  }
}
</script>

<template>
  <button
    type="button"
    :class="['btn icon lg push-to-talk border-0', { 'is-recording': isRecording, 'is-transcribing': isTranscribing }]"
    :aria-pressed="isRecording"
    :aria-label="t('voiceInput.label')"
    :title="title"
    :disabled="isModelReady === false || isTranscribing"
    @mousedown.stop.prevent
    @pointerdown.prevent="onPointerDown"
    @keydown="onKeyDown"
    @keyup="onKeyUp"
    @click.prevent
  >
    <span v-if="isTranscribing" class="spinner-border spinner-sm" aria-hidden="true"></span>
    <Icon v-else :name="isLatched ? 'stop-fill' : isRecording ? 'mic-fill' : 'mic'" />
  </button>
</template>

<style scoped>
/* While the microphone is open, the icon is red: the red of the theme, not the pale red of the Bootstrap emphasis text. */
.btn.is-recording { --btn-color: var(--danger-fg); --btn-hover-color: var(--danger-fg); --btn-active-color: var(--danger-fg); }
/* While Whisper changes the speech into text, the wheel is green, and the dimmed look of a disabled button does not fade it. */
.btn.is-transcribing { --btn-color: var(--success-fg); --btn-disabled-color: var(--success-fg); --btn-disabled-opacity: 1; }
</style>
