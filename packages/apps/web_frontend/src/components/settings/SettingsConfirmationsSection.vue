<script setup lang="ts">
import SettingsOptionHelp from "./SettingsOptionHelp.vue";
import SettingsSwitchRow from "./SettingsSwitchRow.vue";
import { settings } from "../../stores/settings";
import { t } from "../../i18n/index";

/** The blocks of the information card of the question before the closing of a workspace, in the order of the card. */
const WORKSPACE_CLOSE_HELP_BLOCKS = [
  { titleKey: "settingsHelp.whatTitle", textKey: "settingsHelp.confirmWorkspaceClose.what" },
  { titleKey: "settingsHelp.onTitle", textKey: "settingsHelp.confirmWorkspaceClose.on" },
  { titleKey: "settingsHelp.offTitle", textKey: "settingsHelp.confirmWorkspaceClose.off" },
] as const;

/** The blocks of the information card of the question before the closing of a tab, in the order of the card. */
const TAB_CLOSE_HELP_BLOCKS = [
  { titleKey: "settingsHelp.whatTitle", textKey: "settingsHelp.confirmTabClose.what" },
  { titleKey: "settingsHelp.onTitle", textKey: "settingsHelp.confirmTabClose.on" },
  { titleKey: "settingsHelp.offTitle", textKey: "settingsHelp.confirmTabClose.off" },
] as const;

/** The blocks of the information card of the question before the closing of a pane, in the order of the card. */
const PANE_CLOSE_HELP_BLOCKS = [
  { titleKey: "settingsHelp.whatTitle", textKey: "settingsHelp.confirmPaneClose.what" },
  { titleKey: "settingsHelp.onTitle", textKey: "settingsHelp.confirmPaneClose.on" },
  { titleKey: "settingsHelp.offTitle", textKey: "settingsHelp.confirmPaneClose.off" },
] as const;

/** The blocks of the information card of the question before the deletion of a saved search, in the order of the card. */
const SAVED_SEARCH_DELETE_HELP_BLOCKS = [
  { titleKey: "settingsHelp.whatTitle", textKey: "settingsHelp.confirmSavedSearchDelete.what" },
  { titleKey: "settingsHelp.onTitle", textKey: "settingsHelp.confirmSavedSearchDelete.on" },
  { titleKey: "settingsHelp.offTitle", textKey: "settingsHelp.confirmSavedSearchDelete.off" },
] as const;

/** The blocks of the information card of the files outside the workspace folder, in the order of the card (issue #956). */
const FILES_OUTSIDE_WORKSPACE_HELP_BLOCKS = [
  { titleKey: "settingsHelp.whatTitle", textKey: "settingsHelp.filesOutsideWorkspace.what" },
  { titleKey: "settingsGeneral.filesOutsideWorkspaceAsk", textKey: "settingsHelp.filesOutsideWorkspace.ask" },
  { titleKey: "settingsGeneral.filesOutsideWorkspaceOpen", textKey: "settingsHelp.filesOutsideWorkspace.open" },
  { titleKey: "settingsGeneral.filesOutsideWorkspaceOpenDefault", textKey: "settingsHelp.filesOutsideWorkspace.openDefault" },
  { titleKey: "settingsGeneral.filesOutsideWorkspaceNever", textKey: "settingsHelp.filesOutsideWorkspace.never" },
] as const;

/** The four choices of the setting `filesOutsideWorkspace`, in the order of the buttons. */
const FILES_OUTSIDE_WORKSPACE_CHOICES = [
  { id: "ask", labelKey: "settingsGeneral.filesOutsideWorkspaceAsk" },
  { id: "open", labelKey: "settingsGeneral.filesOutsideWorkspaceOpen" },
  { id: "openDefault", labelKey: "settingsGeneral.filesOutsideWorkspaceOpenDefault" },
  { id: "never", labelKey: "settingsGeneral.filesOutsideWorkspaceNever" },
] as const;
</script>

<template>
  <div class="d-flex flex-column gap-3">
    <div class="d-flex flex-column gap-2">
      <h4 class="form-label m-0">{{ t("settingsGeneral.askBeforeClosingTitle") }}</h4>
      <SettingsSwitchRow v-model="settings.confirmWorkspaceClose" :label="t('settingsGeneral.confirmWorkspaceClose')" data-option="confirmWorkspaceClose">
        <SettingsOptionHelp title-key="settingsGeneral.confirmWorkspaceClose" :blocks="WORKSPACE_CLOSE_HELP_BLOCKS" />
      </SettingsSwitchRow>
      <SettingsSwitchRow v-model="settings.confirmTabClose" :label="t('settingsGeneral.confirmTabClose')" data-option="confirmTabClose">
        <SettingsOptionHelp title-key="settingsGeneral.confirmTabClose" :blocks="TAB_CLOSE_HELP_BLOCKS" />
      </SettingsSwitchRow>
      <SettingsSwitchRow v-model="settings.confirmPaneClose" :label="t('settingsGeneral.confirmPaneClose')" data-option="confirmPaneClose">
        <SettingsOptionHelp title-key="settingsGeneral.confirmPaneClose" :blocks="PANE_CLOSE_HELP_BLOCKS" />
      </SettingsSwitchRow>
    </div>

    <div class="d-flex flex-column gap-2">
      <h4 class="form-label m-0">{{ t("settingsGeneral.askBeforeDeletingTitle") }}</h4>
      <SettingsSwitchRow v-model="settings.confirmSavedSearchDelete" :label="t('settingsGeneral.confirmSavedSearchDelete')" data-option="confirmSavedSearchDelete">
        <SettingsOptionHelp title-key="settingsGeneral.confirmSavedSearchDelete" :blocks="SAVED_SEARCH_DELETE_HELP_BLOCKS" />
      </SettingsSwitchRow>
    </div>

    <div class="d-flex flex-column gap-2" data-option="filesOutsideWorkspace">
      <div class="d-flex align-items-center gap-2">
        <h4 class="form-label m-0">{{ t("settingsGeneral.filesOutsideWorkspace") }}</h4>
        <SettingsOptionHelp title-key="settingsGeneral.filesOutsideWorkspace" :blocks="FILES_OUTSIDE_WORKSPACE_HELP_BLOCKS" />
      </div>
      <div class="btn-group" role="group" :aria-label="t('settingsGeneral.filesOutsideWorkspace')">
        <label v-for="choice in FILES_OUTSIDE_WORKSPACE_CHOICES" :key="choice.id" class="btn btn-check btn-outline theme-secondary">
          <input v-model="settings.filesOutsideWorkspace" type="radio" name="files-outside-workspace" autocomplete="off" :value="choice.id" />
          {{ t(choice.labelKey) }}
        </label>
      </div>
    </div>
  </div>
</template>
