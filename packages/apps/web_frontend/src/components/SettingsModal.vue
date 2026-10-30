<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";
import DialogCloseButton from "./DialogCloseButton.vue";
import Icon from "./Icon.vue";
import SettingsAgentsSection from "./settings/SettingsAgentsSection.vue";
import SettingsConfirmationsSection from "./settings/SettingsConfirmationsSection.vue";
import SettingsDynamicTopicsSection from "./settings/SettingsDynamicTopicsSection.vue";
import SettingsDesignSection from './settings/settings_design_section.vue';
import SettingsGeneralSection from "./settings/SettingsGeneralSection.vue";
import SettingsGuardsSection from "./settings/SettingsGuardsSection.vue";
import SettingsMireSection from "./settings/SettingsMireSection.vue";
import SettingsMobileAccessSection from "./settings/SettingsMobileAccessSection.vue";
import SettingsNotificationsSection from "./settings/SettingsNotificationsSection.vue";
import SettingsSidebarsSection from "./settings/SettingsSidebarsSection.vue";
import SettingsTerminalSection from "./settings/SettingsTerminalSection.vue";
import SettingsTextDetectionSection from "./settings/SettingsTextDetectionSection.vue";
import SettingsVoiceInputSection from "./settings/SettingsVoiceInputSection.vue";
import { guardWindow } from "../stores/guard_window";
import { settingsModal, type SettingsSection } from "../stores/settings";
import { t } from "../i18n/index";

const SECTIONS: { id: SettingsSection; icon: string; labelKey: string }[] = [
  { id: "general", icon: "sliders", labelKey: "settingsModal.general" },
  { id: "designReview", icon: "palette", labelKey: "settingsModal.designReview" },
  { id: "terminal", icon: "terminal", labelKey: "settingsModal.terminal" },
  { id: "textDetection", icon: "regex", labelKey: "settingsModal.textDetection" },
  { id: "agents", icon: "robot", labelKey: "settingsModal.agents" },
  { id: "mire", icon: "bullseye", labelKey: "settingsModal.mire" },
  { id: "confirmations", icon: "shield-check", labelKey: "settingsModal.confirmations" },
  { id: "guards", icon: "shield-exclamation", labelKey: "settingsModal.guards" },
  { id: "notifications", icon: "bell", labelKey: "settingsModal.notifications" },
  { id: "sidebars", icon: "layout-sidebar-inset-reverse", labelKey: "settingsModal.sidebars" },
  { id: "dynamicTopics", icon: "tags", labelKey: "settingsModal.dynamicTopics" },
  { id: "mobileAccess", icon: "phone", labelKey: "settingsModal.mobileAccess" },
  { id: "voiceInput", icon: "mic", labelKey: "settingsModal.voiceInput" },
];

function close() {
  settingsModal.open = false;
}
function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") {
    // The guard window is open over this window: the key belongs to the guard window.
    if (guardWindow.isOpen) {
      return;
    }
    // An open information card closes first: the key reaches the card, which closes alone.
    if (e.target instanceof Element && e.target.closest(".information-card-part.is-open") !== null) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    close();
  }
}
onMounted(() => window.addEventListener("keydown", onKey, true));
onBeforeUnmount(() => window.removeEventListener("keydown", onKey, true));
</script>

<template>
  <div class="overlay" @mousedown.self="close">
    <dialog class="dialog dialog-lg dialog-instant dialog-nonmodal h-75" open aria-labelledby="settings-title">
      <div class="dialog-header">
        <div id="settings-title" class="dialog-title me-auto" role="heading" aria-level="2">{{ t("settingsModal.title") }}</div>
        <DialogCloseButton :title="t('settingsModal.closeTitle')" :label="t('settingsModal.closeLabel')" @click="close" />
      </div>
      <div class="dialog-body d-flex gap-3 overflow-y-auto">
        <nav class="nav flex-column theme-secondary align-self-start" :aria-label="t('settingsModal.sectionsLabel')">
          <button
            v-for="s in SECTIONS"
            :key="s.id"
            type="button"
            class="navigation-action nav-link justify-content-start"
            :class="{ active: settingsModal.section === s.id }"
            :aria-current="settingsModal.section === s.id ? 'page' : undefined"
            @click="settingsModal.section = s.id"
          >
            <Icon :name="s.icon" />
            <span>{{ t(s.labelKey) }}</span>
          </button>
        </nav>
        <section class="flex-fill overflow-y-auto d-flex flex-column gap-3">
          <h3 class="m-0 fw-semibold">{{ t(SECTIONS.find((s) => s.id === settingsModal.section)?.labelKey ?? "settingsModal.title") }}</h3>
          <SettingsGeneralSection v-if="settingsModal.section === 'general'" />
          <SettingsDesignSection v-else-if="settingsModal.section === 'designReview'" />
          <SettingsTerminalSection v-else-if="settingsModal.section === 'terminal'" />
          <SettingsTextDetectionSection v-else-if="settingsModal.section === 'textDetection'" />
          <SettingsAgentsSection v-else-if="settingsModal.section === 'agents'" />
          <SettingsMireSection v-else-if="settingsModal.section === 'mire'" />
          <SettingsConfirmationsSection v-else-if="settingsModal.section === 'confirmations'" />
          <SettingsGuardsSection v-else-if="settingsModal.section === 'guards'" />
          <SettingsNotificationsSection v-else-if="settingsModal.section === 'notifications'" />
          <SettingsSidebarsSection v-else-if="settingsModal.section === 'sidebars'" />
          <SettingsDynamicTopicsSection v-else-if="settingsModal.section === 'dynamicTopics'" />
          <SettingsMobileAccessSection v-else-if="settingsModal.section === 'mobileAccess'" />
          <SettingsVoiceInputSection v-else-if="settingsModal.section === 'voiceInput'" />
        </section>
      </div>
    </dialog>
  </div>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; z-index: 60; background: var(--overlay); }
</style>
