<script setup lang="ts">
import { computed, ref } from 'vue';
import InstalledSkillRow from "./InstalledSkillRow.vue";
import { installedKey, skills } from "../../stores/skills";
import { t } from "../../i18n/index";

const isUserSelected = ref(true);
const isWorkflowSelected = ref(true);
const visibleSkills = computed(() => skills.installed.filter((skill) =>
  skill.level === 'user' ? isUserSelected.value : isWorkflowSelected.value,
));
</script>

<template>
  <div class="btn-group align-self-start" role="group" :aria-label="t('settingsSkills.installedFilterLabel')">
    <label class="btn btn-check btn-outline theme-secondary">
      <input v-model="isUserSelected" type="checkbox" autocomplete="off" />
      {{ t('settingsSkills.levelUser') }}
    </label>
    <label class="btn btn-check btn-outline theme-secondary">
      <input v-model="isWorkflowSelected" type="checkbox" autocomplete="off" />
      {{ t('settingsSkills.installedFilterWorkflow') }}
    </label>
  </div>
  <p v-if="skills.installed.length === 0" class="keys">{{ t("settingsSkills.installedEmpty") }}</p>
  <p v-else-if="visibleSkills.length === 0" class="keys">{{ t('settingsSkills.installedFilterEmpty') }}</p>
  <div v-else class="list">
    <InstalledSkillRow v-for="skill in visibleSkills" :key="installedKey(skill)" :skill="skill" />
  </div>
</template>
