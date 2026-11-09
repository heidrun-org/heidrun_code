<script setup lang="ts">
import { computed, onMounted } from "vue";
import Icon from "../Icon.vue";
import InformationCard from "../InformationCard.vue";
import SettingsOptionHelp from "./SettingsOptionHelp.vue";
import SettingsSwitchRow from "./SettingsSwitchRow.vue";
import { settings } from "../../stores/settings";
import { NEW_TAB_COMMANDS, NewTabCommands } from "../../stores/new_tab_commands";
import { AGENTS, type AgentDefinition } from "../../lib/agents";
import { t } from "../../i18n/index";
import { antigravityLink, disableAntigravityLink, enableAntigravityLink, loadAntigravityLink } from "../../stores/antigravity";

onMounted(loadAntigravityLink);

/** The blocks of the information card of a coding agent, in the order of the card. */
const AGENT_HELP_BLOCKS = [
  { titleKey: "settingsHelp.whatTitle", textKey: "settingsHelp.agent.what" },
  { titleKey: "settingsHelp.onTitle", textKey: "settingsHelp.agent.on" },
  { titleKey: "settingsHelp.offTitle", textKey: "settingsHelp.agent.off" },
] as const;

/** The blocks of the information card of quota monitoring, in the order of the card. */
const QUOTA_MONITORING_HELP_BLOCKS = [
  { titleKey: "settingsHelp.whatTitle", textKey: "settingsHelp.quotaMonitoring.what" },
  { titleKey: "settingsHelp.onTitle", textKey: "settingsHelp.quotaMonitoring.on" },
  { titleKey: "settingsHelp.offTitle", textKey: "settingsHelp.quotaMonitoring.off" },
] as const;

const ANTIGRAVITY_TRACKING_HELP_BLOCKS = [
  { titleKey: "settingsHelp.whatTitle", textKey: "settingsHelp.antigravityTracking.what" },
  { titleKey: "settingsHelp.onTitle", textKey: "settingsHelp.antigravityTracking.on" },
  { titleKey: "settingsHelp.offTitle", textKey: "settingsHelp.antigravityTracking.off" },
  { titleKey: "settingsHelp.howTitle", textKey: "settingsHelp.antigravityTracking.development" },
] as const;

/** The blocks of the information card of the default command of a new tab, in the order of the card. */
const NEW_TAB_HELP_BLOCKS = [
  { titleKey: "settingsHelp.whatTitle", textKey: "settingsHelp.newTab.what" },
  { titleKey: "settingsHelp.howTitle", textKey: "settingsNewTab.help" },
  { titleKey: "settingsNewTab.terminalLabel", textKey: "settingsNewTab.terminalTitle" },
  { titleKey: "settingsNewTab.claudeLabel", textKey: "settingsNewTab.claudeTitle" },
  { titleKey: "settingsNewTab.codexLabel", textKey: "settingsNewTab.codexTitle" },
  { titleKey: "settingsNewTab.antigravityLabel", textKey: "settingsNewTab.antigravityTitle" },
] as const;

/** The information card explains the initial composition bar visibility of new coding agent panes. */
const COMPOSITION_BAR_HELP_BLOCKS = [
  {
    titleKey: 'settingsHelp.whatTitle',
    textKey: 'settingsHelp.compositionBarOnAgentStart.what',
  },
  {
    titleKey: 'settingsHelp.onTitle',
    textKey: 'settingsHelp.compositionBarOnAgentStart.on',
  },
  {
    titleKey: 'settingsHelp.offTitle',
    textKey: 'settingsHelp.compositionBarOnAgentStart.off',
  },
] as const;

/** The information card of the Claude Code observer of the Heidrun Code Dashboard. */
const HEIDRUN_CODE_DASHBOARD_CLAUDE_OBSERVER_HELP_BLOCKS = [
  { titleKey: "settingsHelp.whatTitle", textKey: "settingsHelp.heidrunCodeDashboardClaudeObserver.what" },
  { titleKey: "settingsHelp.onTitle", textKey: "settingsHelp.heidrunCodeDashboardClaudeObserver.on" },
  { titleKey: "settingsHelp.offTitle", textKey: "settingsHelp.heidrunCodeDashboardClaudeObserver.off" },
] as const;

const availableCommands = computed(() => NewTabCommands.available());

const antigravityTracking = computed({
  get: () => antigravityLink.installed,
  set: (enabled: boolean) => {
    if (enabled) {
      void enableAntigravityLink();
    } else {
      void disableAntigravityLink();
    }
  },
});

function isOwned(agent: AgentDefinition): boolean {
  return settings.ownedAgents.includes(agent.id);
}

function toggleOwned(agent: AgentDefinition) {
  const others = settings.ownedAgents.filter((id) => id !== agent.id);
  const wasOwned = isOwned(agent);
  settings.ownedAgents = wasOwned ? others : [...others, agent.id];
  settings.ownedAgentsConfigured = true;
  const command = NEW_TAB_COMMANDS.find((candidate) => candidate.agentId === agent.id);
  if (wasOwned && command !== undefined && settings.newTabCommand === command.id) {
    settings.newTabCommand = "terminal";
  }
}

/** The key Enter switches the focused switch, as the key Space does. Holding the key down switches only once. */
function onEnter(event: KeyboardEvent, agent: AgentDefinition) {
  event.preventDefault();
  if (event.repeat) {
    return;
  }
  toggleOwned(agent);
}
</script>

<template>
  <div class="d-flex flex-column gap-3">
    <p class="m-0">{{ t("settingsAgents.lead") }}</p>
    <div class="list-group">
      <label
        v-for="agent in AGENTS"
        :key="agent.id"
        class="list-group-item list-group-item-action d-flex align-items-center gap-2"
        data-option="agent"
      >
        <span class="fw-semibold">{{ agent.name }}</span>
        <!-- The row is a label: a click in the question mark or in its card must not switch the agent. -->
        <span class="me-auto" @click.capture.prevent>
          <SettingsOptionHelp title-key="settingsHelp.agent.title" :params="{ name: agent.name }" :blocks="AGENT_HELP_BLOCKS" />
        </span>
        <span class="switch">
          <input
            type="checkbox"
            role="switch"
            :aria-label="agent.name"
            :checked="isOwned(agent)"
            @change="toggleOwned(agent)"
            @keydown.enter="onEnter($event, agent)"
          />
        </span>
      </label>
    </div>

    <SettingsSwitchRow v-model="settings.quotaMonitoring" :label="t('settingsAgents.quotaMonitoring')" data-option="quotaMonitoring">
      <SettingsOptionHelp title-key="settingsAgents.quotaMonitoring" :blocks="QUOTA_MONITORING_HELP_BLOCKS" />
    </SettingsSwitchRow>

    <div class="d-flex flex-column gap-2" data-option="antigravityQuotaTracking">
      <SettingsSwitchRow
        v-model="antigravityTracking"
        :label="t('antigravityStore.settingsLabel')"
        :is-disabled="!antigravityLink.canChange || antigravityLink.busy"
      >
        <SettingsOptionHelp title-key="antigravityStore.settingsLabel" :blocks="ANTIGRAVITY_TRACKING_HELP_BLOCKS" />
      </SettingsSwitchRow>
    </div>

    <div class="d-flex flex-column gap-2" data-option="newTabCommand">
      <div class="d-flex align-items-center gap-2">
        <h4 class="form-label m-0">{{ t("settingsNewTab.commandTitle") }}</h4>
        <SettingsOptionHelp title-key="settingsNewTab.commandTitle" :blocks="NEW_TAB_HELP_BLOCKS" />
      </div>
      <div class="btn-group" role="group" :aria-label="t('settingsNewTab.commandTitle')">
        <label
          v-for="command in availableCommands"
          :key="command.id"
          class="btn btn-check btn-outline theme-secondary"
          :title="t(command.titleKey)"
        >
          <input v-model="settings.newTabCommand" type="radio" name="new-tab-command" autocomplete="off" :value="command.id" />
          {{ t(command.labelKey) }}
        </label>
      </div>
    </div>

    <SettingsSwitchRow
      v-model="settings.isCompositionBarShownOnAgentStart"
      :label="t('settingsAgents.compositionBarOnAgentStart')"
      data-option="compositionBarOnAgentStart"
    >
      <SettingsOptionHelp
        title-key="settingsAgents.compositionBarOnAgentStart"
        :blocks="COMPOSITION_BAR_HELP_BLOCKS"
      />
    </SettingsSwitchRow>

    <SettingsSwitchRow
      v-model="settings.heidrunCodeDashboardClaudeObserver"
      :label="t('settingsAgents.heidrunCodeDashboardClaudeObserver')"
      data-option="heidrunCodeDashboardClaudeObserver"
    >
      <SettingsOptionHelp title-key="settingsAgents.heidrunCodeDashboardClaudeObserver" :blocks="HEIDRUN_CODE_DASHBOARD_CLAUDE_OBSERVER_HELP_BLOCKS" />
    </SettingsSwitchRow>

    <div class="d-flex flex-column gap-2">
      <h4 class="form-label m-0">{{ t("settingsGeneral.quitTitle") }}</h4>
      <SettingsSwitchRow v-model="settings.keepAgentsRunningAfterQuit" :label="t('settingsGeneral.keepAgentsRunning')" data-option="keepAgentsRunning">
        <InformationCard :label="t('settingsGeneral.keepAgentsRunningHelpLabel')" placement="bottom-center">
          <span class="text-body-secondary" role="img" :aria-label="t('settingsGeneral.keepAgentsRunningHelpLabel')">
            <Icon name="question-circle" />
          </span>
          <template #card>
            <div class="list-group list-group-flush">
              <div class="list-group-item d-flex align-items-center gap-2 fw-medium">
                <Icon name="question-circle" />
                {{ t("settingsGeneral.keepAgentsRunning") }}
              </div>
              <div class="list-group-item text-body-secondary">{{ t("settingsGeneral.keepAgentsRunningHelp") }}</div>
            </div>
          </template>
        </InformationCard>
      </SettingsSwitchRow>
    </div>
  </div>
</template>
