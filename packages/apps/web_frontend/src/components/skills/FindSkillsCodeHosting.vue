<script setup lang="ts">
import { onBeforeUnmount, useId } from "vue";
import SkillsHelpCard from "./SkillsHelpCard.vue";
import { findAddress, skills } from "../../stores/skills";
import { t } from "../../i18n/index";

// The field of the source Code hosting: the web address of a folder on GitHub or GitLab, either one skill folder or a folder
// that holds several skill folders. The address is checked 500 milliseconds after the last key typed, because the check asks
// GitHub or GitLab for the list of the files below the folder.

const CHECK_DELAY_MS = 500;
let checkTimer = 0;
const inputId = useId();
const helpId = useId();

function onAddressInput(event: Event) {
  const address = (event.target as HTMLInputElement).value;
  skills.address = address;
  window.clearTimeout(checkTimer);
  checkTimer = window.setTimeout(() => findAddress(address), CHECK_DELAY_MS);
}

onBeforeUnmount(() => window.clearTimeout(checkTimer));
</script>

<template>
  <div class="d-flex flex-column gap-1">
    <div class="d-flex align-items-center gap-2">
      <label class="form-label m-0" :for="inputId">{{ t("settingsSkills.help_address_title") }}</label>
      <SkillsHelpCard topic="address" />
    </div>
    <div :id="helpId" class="form-text m-0">{{ t("settingsSkills.addressHelp") }}</div>
    <input
      :id="inputId"
      class="form-control"
      type="text"
      spellcheck="false"
      :value="skills.address"
      :placeholder="t('settingsSkills.addressPlaceholder')"
      :aria-describedby="helpId"
      @input="onAddressInput"
    />
  </div>
</template>
