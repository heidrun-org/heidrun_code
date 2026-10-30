<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import Icon from "./Icon.vue";
import { state } from "../stores/session";
import { openAgentsInformationModal } from "../stores/agentsInformation";
import { openSettings } from "../stores/settings";
import { openStatisticsModal } from "../stores/statistics_modal";
import { MireModal } from "../stores/mire/mire_modal";
import { openFindNewSkillsModal, openInstalledSkillModal } from "../stores/skills";
import { t } from "../i18n/index";

const open = ref(false);
const root = ref<HTMLElement>();

function chooseShortcutsHelp() {
  open.value = false;
  state.shortcutsOpen = true;
}

function chooseAgentsInformation() {
  open.value = false;
  openAgentsInformationModal();
}

function chooseMire() {
  open.value = false;
  MireModal.open();
}

function chooseStatistics() {
  open.value = false;
  openStatisticsModal();
}

function chooseInstalledSkill() {
  open.value = false;
  openInstalledSkillModal();
}

function chooseFindNewSkills() {
  open.value = false;
  openFindNewSkillsModal();
}

function chooseSettings() {
  open.value = false;
  openSettings();
}

function onDocClick(e: MouseEvent) {
  if (open.value && root.value && !root.value.contains(e.target as Node)) {
    open.value = false;
  }
}
onMounted(() => document.addEventListener("mousedown", onDocClick));
onBeforeUnmount(() => document.removeEventListener("mousedown", onDocClick));
</script>

<template>
  <div ref="root" class="wrap">
    <button
      class="btn icon icon-btn"
      :class="{ on: open }"
      :aria-expanded="open"
      aria-haspopup="menu"
      :aria-label="t('moreMenu.buttonLabel')"
      :title="t('moreMenu.buttonTitle')"
      @click="open = !open"
    >
      <Icon name="three-dots-vertical" />
    </button>
    <div v-if="open" class="menu show popup-menu" role="menu" :aria-label="t('moreMenu.menuLabel')">
      <button class="menu-item item" role="menuitem" :title="t('moreMenu.shortcutsHelpTitle')" @click="chooseShortcutsHelp()">
        <Icon name="question-lg" />
        <span class="label">{{ t("moreMenu.shortcutsHelpLabel") }}</span>
        <kbd>⌘/</kbd>
      </button>
      <button class="menu-item item" role="menuitem" :title="t('moreMenu.agentsInformationTitle')" @click="chooseAgentsInformation()">
        <Icon name="people" />
        <span class="label">{{ t("moreMenu.agentsInformationLabel") }}</span>
      </button>
      <button class="menu-item item" role="menuitem" :title="t('moreMenu.mireTitle')" @click="chooseMire()">
        <Icon name="bullseye" />
        <span class="label">{{ t("moreMenu.mireLabel") }}</span>
      </button>
      <button class="menu-item item" role="menuitem" :title="t('moreMenu.statisticsTitle')" @click="chooseStatistics()">
        <Icon name="bar-chart" />
        <span class="label">{{ t("moreMenu.statisticsLabel") }}</span>
      </button>
      <div class="divider" role="separator"></div>
      <div class="group" role="group" aria-labelledby="more-menu-skills">
        <div id="more-menu-skills" class="heading">{{ t("moreMenu.skillsHeading") }}</div>
        <button class="menu-item item" role="menuitem" :title="t('moreMenu.installedSkillTitle')" @click="chooseInstalledSkill()">
          <Icon name="list-check" />
          <span class="label">{{ t("moreMenu.installedSkillLabel") }}</span>
        </button>
        <button class="menu-item item" role="menuitem" :title="t('moreMenu.findNewSkillsTitle')" @click="chooseFindNewSkills()">
          <Icon name="search" />
          <span class="label">{{ t("moreMenu.findNewSkillsLabel") }}</span>
        </button>
      </div>
      <div class="divider" role="separator"></div>
      <button class="menu-item item" role="menuitem" :title="t('moreMenu.settingsTitle')" @click="chooseSettings()">
        <Icon name="gear" />
        <span class="label">{{ t("moreMenu.settingsLabel") }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.wrap { position: relative; }
.icon-btn { display: inline-flex; align-items: center; justify-content: center; }
.popup-menu {
  position: absolute; right: 0; top: 38px; min-width: 240px; z-index: 30; padding: 6px; border-radius: 12px;
  border: 1px solid var(--line-modal); background: var(--field); box-shadow: 0 18px 48px var(--shadow-soft);
  display: flex; flex-direction: column; gap: 2px;
}
.item { display: flex; align-items: center; gap: 10px; height: 34px; text-align: left; }
.label { flex: 1; white-space: nowrap; }
.group { display: flex; flex-direction: column; gap: 2px; }
.heading { padding: 6px 10px 2px; color: var(--muted); font-size: calc(var(--font-size) * 0.9); font-weight: 600; }
.divider { height: 1px; margin: 4px 6px; background: var(--line); }
.item kbd { font-family: var(--mono); color: var(--muted); }
</style>
