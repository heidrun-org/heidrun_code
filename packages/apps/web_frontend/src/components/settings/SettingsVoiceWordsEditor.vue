<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import Icon from "../Icon.vue";
import SettingsOptionHelp from "./SettingsOptionHelp.vue";
import { VoiceWords } from "../../lib/voice_words";
import { voiceWords, type VoiceWord } from "../../stores/voice_words";
import { t } from "../../i18n/index";

// The word replacement list of the voice input (issue 836): the developer adds, edits, and deletes the entries. Each entry has
// two texts, the text that Whisper writes and the text that Heidrun Code writes instead. The list is the file `voice_words.json`,
// which the command line `heidrun_code_ctrl voice_words` changes too, so the file is read again every second while this part is
// open. An existing entry is saved when the developer leaves a text. A new entry is saved with its button.

/** The blocks of the information card of the word replacement list, in the order of the card. */
const HELP_BLOCKS = [
  { titleKey: "settingsHelp.whatTitle", textKey: "settingsHelp.voiceWords.what" },
  { titleKey: "settingsHelp.howTitle", textKey: "settingsHelp.voiceWords.how" },
] as const;

/** The entry that the developer is writing, or null while no new entry is open. */
const draft = ref<{ whisperWrites: string; heidrunWrites: string } | null>(null);
const draftWhisperInput = ref<HTMLInputElement>();

/** The file is read and valid, so a change can be written. */
const isEditable = computed(() => voiceWords.isRead && voiceWords.fileError === null);
const isDraftComplete = computed(() => draft.value !== null && draft.value.whisperWrites.trim() !== "");
const isEmpty = computed(() => isEditable.value && voiceWords.list.length === 0 && draft.value === null);
const hasRows = computed(() => voiceWords.list.length > 0 || draft.value !== null);

async function toggleDraft(): Promise<void> {
  voiceWords.changeError = null;
  if (draft.value !== null) {
    draft.value = null;
    return;
  }
  draft.value = { whisperWrites: "", heidrunWrites: "" };
  await nextTick();
  draftWhisperInput.value?.focus();
}

async function addDraft(): Promise<void> {
  if (draft.value === null) {
    return;
  }
  if (isDraftComplete.value === false) {
    voiceWords.changeError = t("settingsVoiceInput.wordsWhisperWritesEmpty");
    return;
  }
  if (await VoiceWords.add(draft.value.whisperWrites, draft.value.heidrunWrites)) {
    draft.value = null;
  }
}

/** The developer left the text that Whisper writes: an empty text is refused, and the old text comes back. */
async function onWhisperWritesChange(word: VoiceWord, event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  if (input.value === word.whisper_writes) {
    return;
  }
  if (input.value.trim() === "") {
    input.value = word.whisper_writes;
    voiceWords.changeError = t("settingsVoiceInput.wordsWhisperWritesEmpty");
    return;
  }
  if ((await VoiceWords.update(word.id, { whisperWrites: input.value })) === false) {
    input.value = word.whisper_writes;
  }
}

/** The developer left the text that Heidrun Code writes instead. */
async function onHeidrunWritesChange(word: VoiceWord, event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  if (input.value === word.heidrun_writes) {
    return;
  }
  if ((await VoiceWords.update(word.id, { heidrunWrites: input.value })) === false) {
    input.value = word.heidrun_writes;
  }
}

onMounted(() => {
  void VoiceWords.startReading();
});

onBeforeUnmount(() => {
  VoiceWords.stopReading();
});
</script>

<template>
  <div class="d-flex flex-column gap-2" data-option="voiceWords">
    <div class="d-flex align-items-center gap-2">
      <span class="form-label m-0">{{ t("settingsVoiceInput.wordsTitle") }}</span>
      <SettingsOptionHelp title-key="settingsVoiceInput.wordsTitle" :blocks="HELP_BLOCKS" />
      <button type="button" class="btn ms-auto" :disabled="isEditable === false" data-field="toggle-draft" @click="toggleDraft">
        <template v-if="draft === null"><Icon name="plus-lg" /> {{ t("settingsVoiceInput.wordsAdd") }}</template>
        <template v-else><Icon name="x-lg" /> {{ t("settingsVoiceInput.wordsCancel") }}</template>
      </button>
    </div>

    <div v-if="voiceWords.fileError !== null" class="alert theme-danger text-break" role="alert" data-field="file-error">
      {{ t("settingsVoiceInput.wordsFileInvalid", { reason: voiceWords.fileError }) }}
    </div>
    <div v-if="voiceWords.changeError !== null" class="alert theme-danger text-break" role="alert" data-field="change-error">
      {{ t("settingsVoiceInput.wordsChangeFailed", { reason: voiceWords.changeError }) }}
    </div>
    <p v-if="isEmpty" class="m-0 text-body-secondary" data-field="no-word">{{ t("settingsVoiceInput.wordsNone") }}</p>

    <div v-if="hasRows" class="d-flex flex-column gap-2">
      <div class="d-flex gap-2 align-items-end" data-field="headings">
        <span class="form-text m-0 flex-fill">{{ t("settingsVoiceInput.wordsWhisperWrites") }}</span>
        <span class="form-text m-0 flex-fill">{{ t("settingsVoiceInput.wordsHeidrunWrites") }}</span>
        <span class="btn invisible" aria-hidden="true"><Icon name="trash" /></span>
      </div>

      <div v-for="word in voiceWords.list" :key="word.id" class="d-flex gap-2 align-items-center" :data-word="word.id" data-field="word">
        <input
          type="text"
          class="form-control flex-fill"
          :value="word.whisper_writes"
          :aria-label="t('settingsVoiceInput.wordsWhisperWrites')"
          :disabled="isEditable === false"
          autocomplete="off"
          spellcheck="false"
          data-field="whisper-writes"
          @change="onWhisperWritesChange(word, $event)"
        />
        <input
          type="text"
          class="form-control flex-fill"
          :value="word.heidrun_writes"
          :aria-label="t('settingsVoiceInput.wordsHeidrunWrites')"
          :disabled="isEditable === false"
          autocomplete="off"
          spellcheck="false"
          data-field="heidrun-writes"
          @change="onHeidrunWritesChange(word, $event)"
        />
        <button
          type="button"
          class="btn"
          :aria-label="t('settingsVoiceInput.wordsDelete', { text: word.whisper_writes })"
          :title="t('settingsVoiceInput.wordsDelete', { text: word.whisper_writes })"
          :disabled="isEditable === false"
          data-field="delete-word"
          @click="VoiceWords.remove(word.id)"
        >
          <Icon name="trash" />
        </button>
      </div>

      <div v-if="draft !== null" class="d-flex gap-2 align-items-center" data-field="draft">
        <input
          ref="draftWhisperInput"
          v-model="draft.whisperWrites"
          type="text"
          class="form-control flex-fill"
          :aria-label="t('settingsVoiceInput.wordsWhisperWrites')"
          autocomplete="off"
          spellcheck="false"
          data-field="draft-whisper-writes"
          @keydown.enter="addDraft"
        />
        <input
          v-model="draft.heidrunWrites"
          type="text"
          class="form-control flex-fill"
          :aria-label="t('settingsVoiceInput.wordsHeidrunWrites')"
          autocomplete="off"
          spellcheck="false"
          data-field="draft-heidrun-writes"
          @keydown.enter="addDraft"
        />
        <button
          type="button"
          class="btn"
          :aria-label="t('settingsVoiceInput.wordsAddThisWord')"
          :title="t('settingsVoiceInput.wordsAddThisWord')"
          :disabled="isDraftComplete === false"
          data-field="add-word"
          @click="addDraft"
        >
          <Icon name="check-lg" />
        </button>
      </div>
    </div>
  </div>
</template>
