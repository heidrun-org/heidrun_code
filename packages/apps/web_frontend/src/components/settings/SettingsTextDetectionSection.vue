<script setup lang="ts">
import SettingsOptionHelp from "./SettingsOptionHelp.vue";
import SettingsSwitchRow from "./SettingsSwitchRow.vue";
import { settings } from "../../stores/settings";
import { t } from "../../i18n/index";

const referenceHelp = [
  { titleKey: "settingsHelp.whatTitle", textKey: "textDetection.all.what" },
  { titleKey: "settingsHelp.onTitle", textKey: "textDetection.all.on" },
  { titleKey: "settingsHelp.offTitle", textKey: "textDetection.all.off" },
] as const;

const webAddressesHelp = [
  { titleKey: "settingsHelp.whatTitle", textKey: "textDetection.family.webAddresses.what" },
  { titleKey: "settingsHelp.onTitle", textKey: "textDetection.family.webAddresses.on" },
  { titleKey: "settingsHelp.offTitle", textKey: "textDetection.family.webAddresses.off" },
] as const;

</script>

<template>
  <div class="d-flex flex-column gap-3">
    <div data-option="textDetection">
      <SettingsSwitchRow v-model="settings.terminalTextDetection" :label="t('textDetection.all.name')">
        <SettingsOptionHelp title-key="textDetection.all.name" :blocks="referenceHelp" />
      </SettingsSwitchRow>
    </div>
    <div data-option="terminalWebAddresses">
      <SettingsSwitchRow v-model="settings.terminalWebAddresses" :label="t('textDetection.family.webAddresses.name')">
        <SettingsOptionHelp title-key="textDetection.family.webAddresses.name" :blocks="webAddressesHelp" />
      </SettingsSwitchRow>
    </div>
  </div>
</template>
