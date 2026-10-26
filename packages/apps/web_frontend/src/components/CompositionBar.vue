<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import Icon from "./Icon.vue";
import PushToTalkButton from "./PushToTalkButton.vue";
import VoiceLevel from "./VoiceLevel.vue";
import { DropTarget } from "../lib/drop_target";
import { ImageDrop, PASTE_DELAY_MS } from "../lib/image_drop";
import { VoiceInput } from "../lib/voice_input";
import { CompositionBar } from '../stores/composition_bar';
import { insertText, toast } from "../stores/session";
import { settings } from "../stores/settings";
import { voiceInput } from "../stores/voice_input";
import { hasText, t } from "../i18n/index";

// The composition bar under this pane: its images and text wait here until the developer sends them to this pane.
// Issue: https://github.com/heidrun-org/heidrun/issues/712
const props = defineProps<{ paneId: string }>();
const emit = defineEmits<{ (event: "sent"): void }>();
const compositionBar = CompositionBar.forPane(props.paneId);

const textInput = ref<HTMLTextAreaElement | null>(null);
const isSending = ref(false);

/** The file name at the end of a path. */
function fileName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

// The text input gets the keyboard each time that an image arrives, so that the developer types, then presses Enter to send.
function focusTextInput() {
  void nextTick(() => textInput.value?.focus());
}
onMounted(focusTextInput);
onBeforeUnmount(() => {
  VoiceInput.clearError(props.paneId);
  if (elapsedTimerId !== null) {
    clearInterval(elapsedTimerId);
    elapsedTimerId = null;
  }
});

/** The text of the last error of the voice input: a text for its category, else the general text. */
function voiceErrorText(category: string): string {
  const key = `voiceInput.error.${category}`;
  return hasText(key) ? t(key) : t("voiceInput.error.other");
}

/** The seconds since the recording started. */
const elapsedSeconds = ref(0);
let elapsedTimerId: ReturnType<typeof setInterval> | null = null;
function updateElapsedSeconds() {
  elapsedSeconds.value = Math.max(0, Math.floor((Date.now() - voiceInput.startedAt) / 1000));
}
/** What the voice input does now for this pane. */
const paneState = computed(() => VoiceInput.paneState(props.paneId));
/** The microphone is open: the level bars show the voice. */
const isListening = computed(() => settings.voiceInput && (paneState.value === "starting" || paneState.value === "recording"));
/** Recording, the wait for Whisper, and transcription keep the same level bars and cancel button in the owning pane. */
const isVoiceActive = computed(() => settings.voiceInput && paneState.value !== "idle");
/** The seconds that the composition bar shows: the time since the recording started, then the length of the stopped recording. */
const shownSeconds = computed(() => {
  if (isListening.value) {
    return elapsedSeconds.value;
  }
  return VoiceInput.transcriptionOf(props.paneId)?.recordingSeconds ?? elapsedSeconds.value;
});
/** The elapsed time as minutes and seconds, for example 0:07. */
const elapsedText = computed(() => `${Math.floor(shownSeconds.value / 60)}:${String(shownSeconds.value % 60).padStart(2, "0")}`);
/** The text of the text input while it is empty: it tells what the voice input does now, else it asks for the text. */
const textPlaceholder = computed(() => {
  if (settings.voiceInput && paneState.value === "waiting") {
    return t("voiceInput.waiting");
  }
  if (settings.voiceInput && paneState.value === "transcribing") {
    return t("voiceInput.titleTranscribing");
  }
  return isListening.value ? t("voiceInput.listening") : t("compositionBar.textPlaceholder");
});
watch(
  isListening,
  (listening) => {
    if (elapsedTimerId !== null) {
      clearInterval(elapsedTimerId);
      elapsedTimerId = null;
    }
    if (listening) {
      updateElapsedSeconds();
      elapsedTimerId = setInterval(updateElapsedSeconds, 250);
    }
  },
  { immediate: true },
);
watch(
  () => compositionBar.paths.length,
  (length, previousLength) => {
    if (length > previousLength) {
      focusTextInput();
    }
  },
);
watch(
  () => compositionBar.paths.slice(),
  (paths) => {
    for (const path of paths) {
      if (path in compositionBar.thumbnails === false) {
        compositionBar.thumbnails[path] = "";
		void ImageDrop.loadThumbnail(props.paneId, path);
      }
    }
  },
  { immediate: true },
);

async function addImages() {
  try {
    await ImageDrop.pickImages(props.paneId);
  } catch {
    toast(t("compositionBar.pickFailed"), "error");
  }
  focusTextInput();
}

// The text input grows with its lines, up to a maximum height, then scrolls.
const TEXT_MAX_HEIGHT_PX = 160;
function resizeTextInput() {
  const element = textInput.value;
  if (element === null) {
    return;
  }
  if (compositionBar.text === "") {
    element.style.height = "";
    return;
  }
  element.style.height = "auto";
  element.style.height = `${Math.min(element.scrollHeight, TEXT_MAX_HEIGHT_PX)}px`;
}
watch(() => compositionBar.text, () => void nextTick(resizeTextInput));
onMounted(resizeTextInput);

// Enter sends. Shift+Enter writes a new line.
function onTextKeydown(event: KeyboardEvent) {
  if (event.key === "Enter" && event.shiftKey === false && event.isComposing === false) {
    event.preventDefault();
    void send();
  }
}

// Sends the images first, then the text. The text is written and submitted only when it is not empty: with no text, the
// developer keeps the keyboard in the terminal and speaks or types there.
async function send() {
  if (isSending.value === true) {
    return;
  }
  isSending.value = true;
  const isSettled = await VoiceInput.settle(props.paneId);
  if (isSettled === false || compositionBar.isOpen === false) {
    isSending.value = false;
    return;
  }
  const paths = compositionBar.paths.slice();
  const text = compositionBar.text.trim();
  const { pastedCount, result } = await ImageDrop.pasteInto(props.paneId, paths);
  for (const path of paths.slice(0, pastedCount)) {
    ImageDrop.remove(props.paneId, path);
  }
  if (result === "failed") {
    isSending.value = false;
    toast(t("compositionBar.pasteFailed"), "error");
    return;
  }
  if (result === "no_terminal") {
    isSending.value = false;
    toast(t("compositionBar.noTerminal"), "error");
    return;
  }
  if (text !== "") {
    if (pastedCount > 0) {
      await new Promise((resolve) => setTimeout(resolve, PASTE_DELAY_MS));
    }
    await insertText(props.paneId, text, true);
  }
  isSending.value = false;
  compositionBar.text = "";
  emit("sent");
}
</script>

<template>
  <div
    class="composition-bar position-relative d-flex flex-column gap-3"
    role="region"
    :aria-label="t('compositionBar.label')"
    :data-composition-bar-pane-id="props.paneId"
    @keydown.esc="ImageDrop.close(props.paneId)"
  >
    <div v-if="compositionBar.paths.length > 0" class="thumbs d-flex flex-wrap align-items-center gap-2">
      <figure v-for="path in compositionBar.paths" :key="path" class="thumb" :title="path">
        <button
          class="open"
          :aria-label="t('compositionBar.open', { name: fileName(path) })"
          @click="ImageDrop.openViewer(props.paneId, path)"
        >
          <img v-if="compositionBar.thumbnails[path]" :src="compositionBar.thumbnails[path]" :alt="t('compositionBar.thumbnailAlt', { name: fileName(path) })" />
          <Icon v-else name="image" />
        </button>
        <button
          class="btn icon image-action remove"
          :aria-label="t('compositionBar.remove', { name: fileName(path) })"
          @click="ImageDrop.remove(props.paneId, path)"
        >
          <Icon name="x-lg" />
        </button>
      </figure>
    </div>
    <div class="controls d-flex align-items-end gap-1">
      <button class="btn icon lg icon-button border-0" :aria-label="t('compositionBar.add')" :title="t('compositionBar.addTitle')" @click="addImages">
        <Icon name="plus-lg" />
      </button>
      <div class="field position-relative flex-fill" :class="{ 'is-listening': isVoiceActive }">
        <textarea
          ref="textInput"
          v-model="compositionBar.text"
          class="form-control text"
          rows="1"
          :aria-label="t('compositionBar.textLabel')"
          :placeholder="textPlaceholder"
          @keydown="onTextKeydown"
        ></textarea>
        <div v-if="isVoiceActive" class="listening position-absolute end-0 bottom-0 d-flex align-items-center justify-content-end gap-1 pe-2">
          <button
            type="button"
            class="btn icon small cancel-voice border-0"
            :aria-label="t('voiceInput.cancel')"
            :title="t('voiceInput.cancel')"
            @pointerdown.stop.prevent="VoiceInput.cancel(props.paneId)"
            @keydown.enter.stop
            @click.stop="VoiceInput.cancel(props.paneId)"
          >
            <Icon name="x-lg" />
          </button>
          <VoiceLevel
            :levels="isListening ? voiceInput.levels : []"
            :is-waiting="paneState === 'waiting'"
            :is-transcribing="paneState === 'transcribing'"
          />
          <span class="elapsed ms-1">{{ elapsedText }}</span>
        </div>
      </div>
      <button class="btn icon lg icon-button border-0 send" :aria-label="t('compositionBar.send')" :title="t('compositionBar.sendTitle')" :disabled="isSending" @click="send">
        <Icon name="send" />
      </button>
      <PushToTalkButton v-if="settings.voiceInput" :pane-id="props.paneId" />
    </div>
    <div
      v-if="settings.voiceInput && VoiceInput.errorOf(props.paneId) !== null"
      class="form-text text-danger m-0"
      role="alert"
    >
      {{ voiceErrorText(VoiceInput.errorOf(props.paneId) ?? "") }}
    </div>
    <div v-if="DropTarget.state.hoveredPaneId === props.paneId" class="drop-feedback"></div>
  </div>
</template>

<style scoped>
.composition-bar { flex: none; padding: 14px 16px; border-top: 1px solid var(--line); background: var(--raised); }
.drop-feedback { position: absolute; inset: 0; pointer-events: none; border: 3px solid var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent); }
.thumb {
  position: relative; display: flex; align-items: center; justify-content: center; width: 144px; height: 96px; margin: 0; font-size: calc(var(--font-size) * 2.4);
  border: 1px solid var(--line-modal); border-radius: 6px; background: var(--field); color: var(--muted); overflow: hidden;
}
.open { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; padding: 0; border: 0; background: transparent; color: inherit; cursor: zoom-in; }
.thumb img { width: 100%; height: 100%; object-fit: cover; }
.remove { position: absolute; top: 6px; right: 6px; justify-content: center; }
.field.is-listening .text { padding-right: calc(var(--listening-width) + 8px); }
.field { min-width: 0; --listening-width: min(40%, 340px); }
.text { --control-min-height: 46px; --control-padding-y: 7px; --control-font-size: calc(var(--font-size) * 1.2); resize: none; max-height: 160px; overflow-y: auto; }
.controls { margin-inline: -8px; }
.icon-button, .push-to-talk { flex: none; width: calc(23px + var(--font-size) * 0.65); height: 46px; padding: 0; justify-content: center; font-size: calc(var(--font-size) * 1.3); }
.listening { width: var(--listening-width); height: 46px; pointer-events: none; color: var(--muted); }
.cancel-voice { flex: none; justify-content: center; pointer-events: auto; }
.elapsed { font-size: calc(var(--font-size) * 1.05); font-variant-numeric: tabular-nums; }
</style>
