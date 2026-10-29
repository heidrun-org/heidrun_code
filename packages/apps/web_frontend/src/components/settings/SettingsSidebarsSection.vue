<script setup lang="ts">
import { computed } from "vue";
import SettingsOptionHelp from "./SettingsOptionHelp.vue";
import SettingsSwitchRow from "./SettingsSwitchRow.vue";
import { settings } from "../../stores/settings";
import { t } from "../../i18n/index";

/** The choices of the delay after which the finished items disappear, in minutes, in the order of the buttons. 0 is never. */
const TTL_OPTIONS = [
  { v: 5, labelKey: "fontMenu.minutes5" },
  { v: 15, labelKey: "fontMenu.minutes15" },
  { v: 60, labelKey: "fontMenu.hour1" },
  { v: 0, labelKey: "fontMenu.never" },
];

/** The choices of the delay between two reads of the files of the chats, in seconds, in the order of the buttons. */
const REFRESH_CHOICES = [
  { seconds: 5, labelKey: "settingsPastChats.refresh5" },
  { seconds: 10, labelKey: "settingsPastChats.refresh10" },
  { seconds: 30, labelKey: "settingsPastChats.refresh30" },
  { seconds: 60, labelKey: "settingsPastChats.refresh60" },
] as const;

/** The choices of the delay of the fetch in the background, in minutes, in the order of the buttons. 0 is off. */
const GIT_FETCH_CHOICES = [
  { minutes: 0, labelKey: "settingsGeneral.gitFetchOff" },
  { minutes: 1, labelKey: "settingsGeneral.gitFetch1" },
  { minutes: 5, labelKey: "settingsGeneral.gitFetch5" },
  { minutes: 10, labelKey: "settingsGeneral.gitFetch10" },
  { minutes: 30, labelKey: "settingsGeneral.gitFetch30" },
] as const;

/** The blocks of the information card of the list of workspaces of the Needs you section, in the order of the card. */
const SHOW_WORKSPACES_HELP_BLOCKS = [
  { titleKey: "settingsHelp.whatTitle", textKey: "settingsHelp.showWorkspaces.what" },
  { titleKey: "settingsHelp.howTitle", textKey: "needsYouWorkspaces.showWorkspacesHelp" },
] as const;

/** The blocks of the information card of the delay after which the finished items disappear, in the order of the card. */
const FINISHED_HELP_BLOCKS = [
  { titleKey: "settingsHelp.whatTitle", textKey: "settingsHelp.finishedTtl.what" },
  { titleKey: "settingsHelp.howTitle", textKey: "fontMenu.finishedHelp" },
] as const;

/** The blocks of the information card of the delay between two reads of the chats, in the order of the card. */
const CHATS_REFRESH_HELP_BLOCKS = [
  { titleKey: "settingsHelp.whatTitle", textKey: "settingsHelp.chatsRefresh.what" },
  { titleKey: "settingsHelp.howTitle", textKey: "settingsPastChats.refreshHelp" },
] as const;

/** The blocks of the information card of the fetch in the background, in the order of the card. */
const GIT_FETCH_HELP_BLOCKS = [
  { titleKey: "settingsHelp.whatTitle", textKey: "settingsHelp.gitFetch.what" },
  { titleKey: "settingsHelp.howTitle", textKey: "settingsGeneral.gitFetchHelp" },
] as const;

/** The blocks of the information card of the permanent branches of the merge, in the order of the card (issue #570). */
const PERMANENT_BRANCHES_HELP_BLOCKS = [
  { titleKey: "settingsHelp.whatTitle", textKey: "settingsHelp.mergePermanentBranches.what" },
  { titleKey: "settingsHelp.howTitle", textKey: "settingsHelp.mergePermanentBranches.how" },
] as const;

/** The permanent branches as one text, the names separated by commas. */
const permanentBranchesText = computed({
  get: () => settings.mergePermanentBranches.join(", "),
  set: (text: string) => {
    settings.mergePermanentBranches = text
      .split(",")
      .map((name) => name.trim())
      .filter((name) => name !== "");
  },
});
</script>

<template>
  <div class="d-flex flex-column gap-3">
    <div class="d-flex flex-column gap-2">
      <h4 class="form-label m-0">{{ t("settingsSidebars.needsYouTitle") }}</h4>
      <SettingsSwitchRow v-model="settings.showWorkspacesInNeedsYou" :label="t('needsYouWorkspaces.showWorkspaces')" data-option="showWorkspaces">
        <SettingsOptionHelp title-key="needsYouWorkspaces.showWorkspaces" :blocks="SHOW_WORKSPACES_HELP_BLOCKS" />
      </SettingsSwitchRow>
      <div class="d-flex flex-column gap-2" data-option="finishedTtl">
        <div class="d-flex align-items-center gap-2">
          <div>{{ t("fontMenu.finishedLabel") }}</div>
          <SettingsOptionHelp title-key="fontMenu.finishedLabel" :blocks="FINISHED_HELP_BLOCKS" />
        </div>
        <div class="btn-group" role="group" :aria-label="t('fontMenu.finishedLabel')">
          <label v-for="o in TTL_OPTIONS" :key="o.v" class="btn btn-check btn-outline theme-secondary" :title="t('fontMenu.finishedTitle')">
            <input v-model="settings.finishedTtl" type="radio" name="finished-ttl" autocomplete="off" :value="o.v" />
            {{ t(o.labelKey) }}
          </label>
        </div>
      </div>
    </div>

    <div class="d-flex flex-column gap-2">
      <h4 class="form-label m-0">{{ t("settingsSidebars.pastChatsTitle") }}</h4>
      <div class="d-flex flex-column gap-2" data-option="chatsRefreshSeconds">
        <div class="d-flex align-items-center gap-2">
          <div>{{ t("settingsPastChats.refreshLabel") }}</div>
          <SettingsOptionHelp title-key="settingsPastChats.refreshLabel" :blocks="CHATS_REFRESH_HELP_BLOCKS" />
        </div>
        <div class="btn-group" role="group" :aria-label="t('settingsPastChats.refreshLabel')">
          <label v-for="choice in REFRESH_CHOICES" :key="choice.seconds" class="btn btn-check btn-outline theme-secondary">
            <input v-model="settings.chatsRefreshSeconds" type="radio" name="chats-refresh-seconds" autocomplete="off" :value="choice.seconds" />
            {{ t(choice.labelKey) }}
          </label>
        </div>
      </div>
    </div>

    <div class="d-flex flex-column gap-2">
      <h4 class="form-label m-0">{{ t("settingsSidebars.sourceControlTitle") }}</h4>
      <div class="d-flex flex-column gap-2" data-option="gitFetchMinutes">
        <div class="d-flex align-items-center gap-2">
          <div>{{ t("settingsGeneral.gitFetchLabel") }}</div>
          <SettingsOptionHelp title-key="settingsGeneral.gitFetchLabel" :blocks="GIT_FETCH_HELP_BLOCKS" />
        </div>
        <div class="btn-group" role="group" :aria-label="t('settingsGeneral.gitFetchLabel')">
          <label v-for="choice in GIT_FETCH_CHOICES" :key="choice.minutes" class="btn btn-check btn-outline theme-secondary">
            <input v-model="settings.gitFetchMinutes" type="radio" name="git-fetch-minutes" autocomplete="off" :value="choice.minutes" />
            {{ t(choice.labelKey) }}
          </label>
        </div>
      </div>
    </div>

    <div class="d-flex flex-column gap-2">
      <h4 class="form-label m-0">{{ t("settingsSidebars.codeHostingTitle") }}</h4>
      <div class="d-flex flex-column gap-2" data-option="mergePermanentBranches">
        <div class="d-flex align-items-center gap-2">
          <label class="m-0" for="merge-permanent-branches">{{ t("settingsSidebars.mergePermanentBranches") }}</label>
          <SettingsOptionHelp title-key="settingsSidebars.mergePermanentBranches" :blocks="PERMANENT_BRANCHES_HELP_BLOCKS" />
        </div>
        <input id="merge-permanent-branches" v-model.lazy="permanentBranchesText" type="text" class="form-control" spellcheck="false" />
      </div>
    </div>
  </div>
</template>
