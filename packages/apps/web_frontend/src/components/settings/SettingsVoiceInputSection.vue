<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import SettingsOptionHelp from "./SettingsOptionHelp.vue";
import SettingsSwitchRow from "./SettingsSwitchRow.vue";
import SettingsVoiceWordsEditor from "./SettingsVoiceWordsEditor.vue";
import { VoiceInput } from "../../lib/voice_input";
import { settings } from "../../stores/settings";
import { voiceInput } from "../../stores/voice_input";
import { locale, t } from "../../i18n/index";

// The Settings section of the voice input (issue 662): the switch, the language of the speech, the Whisper model with the
// state of its download, and the word replacement list (issue 836).

/** The blocks of the information card of the option "Enable voice input", in the order of the card. */
const ENABLE_HELP_BLOCKS = [
  { titleKey: "settingsHelp.whatTitle", textKey: "settingsHelp.voiceInput.what" },
  { titleKey: "settingsHelp.onTitle", textKey: "settingsHelp.voiceInput.on" },
  { titleKey: "settingsHelp.offTitle", textKey: "settingsHelp.voiceInput.off" },
] as const;

/** The blocks of the information card of the language, in the order of the card. */
const LANGUAGE_HELP_BLOCKS = [
  { titleKey: "settingsHelp.whatTitle", textKey: "settingsHelp.voiceInputLanguage.what" },
  { titleKey: "settingsHelp.howTitle", textKey: "settingsHelp.voiceInputLanguage.how" },
] as const;

/** The blocks of the information card of the model, in the order of the card. */
const MODEL_HELP_BLOCKS = [
  { titleKey: "settingsHelp.whatTitle", textKey: "settingsHelp.voiceInputModel.what" },
  { titleKey: "settingsHelp.howTitle", textKey: "settingsHelp.voiceInputModel.how" },
] as const;

/** The options of the language: the automatic choice, then each language with its name in the language of the window. */
const languageOptions = computed(() => {
  const names = new Intl.DisplayNames([locale.value], { type: "language" });
  const codes = voiceInput.options?.languages ?? [];
  return [
    { code: "auto", name: t("settingsVoiceInput.languageAutomatic") },
    ...codes.map((code) => {
      const name = names.of(code) ?? code;
      return { code, name: name.charAt(0).toLocaleUpperCase(locale.value) + name.slice(1) };
    }),
  ];
});

/** A size in bytes, written in megabytes or in gigabytes, like Finder writes it. */
function size(bytes: number): string {
  if (bytes >= 1_000_000_000) {
    return t("settingsVoiceInput.sizeGigabytes", { value: (bytes / 1_000_000_000).toFixed(1) });
  }
  return t("settingsVoiceInput.sizeMegabytes", { value: Math.round(bytes / 1_000_000) });
}

/** The options of the model: its identifier, its size, and a note for a model that understands only English. */
const modelOptions = computed(() =>
  (voiceInput.options?.models ?? []).map((model) => ({
    id: model.id,
    text: t(model.isEnglishOnly ? "settingsVoiceInput.modelEnglishOnly" : "settingsVoiceInput.model", { name: model.id, size: size(model.sizeBytes) }),
  })),
);

const chosenModel = computed(() => VoiceInput.chosenModel());
const isDownloading = computed(() => voiceInput.download.modelId !== null);
const percent = computed(() => VoiceInput.downloadPercent());

// The developer turns the option on or off. Turning it off throws away a recording that runs. Turning it on downloads the model.
watch(
  () => settings.voiceInput,
  (isOn) => {
    if (isOn === false) {
      void VoiceInput.cancel();
      return;
    }
    void VoiceInput.loadOptions()
      .then(() => VoiceInput.ensureChosenModel())
      .catch(() => {});
  },
);

/** The developer chooses another model: it downloads at once when it is not on the disk. */
function onModelChange(): void {
  voiceInput.download.error = null;
  void VoiceInput.ensureChosenModel();
}

onMounted(() => {
  if (voiceInput.options === null) {
    void VoiceInput.loadOptions().catch(() => {});
  }
});
</script>

<template>
  <div class="d-flex flex-column gap-3">
    <SettingsSwitchRow v-model="settings.voiceInput" :label="t('settingsVoiceInput.enableLabel')" data-option="voiceInput">
      <SettingsOptionHelp title-key="settingsVoiceInput.enableLabel" :blocks="ENABLE_HELP_BLOCKS" />
    </SettingsSwitchRow>

    <div class="d-flex flex-column gap-2" data-option="voiceInputLanguage">
      <div class="d-flex align-items-center gap-2">
        <label class="form-label m-0" for="voice-input-language">{{ t("settingsVoiceInput.languageTitle") }}</label>
        <SettingsOptionHelp title-key="settingsVoiceInput.languageTitle" :blocks="LANGUAGE_HELP_BLOCKS" />
      </div>
      <select id="voice-input-language" v-model="settings.voiceInputLanguage" class="form-control" :disabled="settings.voiceInput === false">
        <option v-for="option in languageOptions" :key="option.code" :value="option.code">{{ option.name }}</option>
      </select>
    </div>

    <div class="d-flex flex-column gap-2" data-option="voiceInputModel">
      <div class="d-flex align-items-center gap-2">
        <label class="form-label m-0" for="voice-input-model">{{ t("settingsVoiceInput.modelTitle") }}</label>
        <SettingsOptionHelp title-key="settingsVoiceInput.modelTitle" :blocks="MODEL_HELP_BLOCKS" />
      </div>
      <select id="voice-input-model" v-model="settings.voiceInputModel" class="form-control" :disabled="settings.voiceInput === false || isDownloading" @change="onModelChange">
        <option v-for="option in modelOptions" :key="option.id" :value="option.id">{{ option.text }}</option>
      </select>
      <template v-if="settings.voiceInput && chosenModel !== null">
        <div v-if="isDownloading" class="d-flex flex-column gap-1" role="status">
          <div class="form-text">{{ t("settingsVoiceInput.downloading", { percent: percent ?? 0 }) }}</div>
          <div class="progress" role="progressbar" :aria-label="t('settingsVoiceInput.downloadingLabel')" :aria-valuenow="percent ?? 0" aria-valuemin="0" aria-valuemax="100">
            <div class="progress-bar" :style="{ width: `${percent ?? 0}%` }"></div>
          </div>
        </div>
        <div v-else-if="voiceInput.download.error !== null" class="d-flex align-items-center gap-2" role="alert">
          <span class="form-text m-0">{{ t("settingsVoiceInput.downloadFailed") }}</span>
          <button type="button" class="btn" @click="onModelChange">{{ t("settingsVoiceInput.tryAgain") }}</button>
        </div>
        <div v-else-if="chosenModel.isDownloaded" class="form-text" role="status">{{ t("settingsVoiceInput.modelDownloaded") }}</div>
        <div v-else class="d-flex align-items-center gap-2">
          <span class="form-text m-0">{{ t("settingsVoiceInput.modelMissing") }}</span>
          <button type="button" class="btn" @click="onModelChange">{{ t("settingsVoiceInput.download") }}</button>
        </div>
      </template>
    </div>

    <SettingsVoiceWordsEditor />
  </div>
</template>
