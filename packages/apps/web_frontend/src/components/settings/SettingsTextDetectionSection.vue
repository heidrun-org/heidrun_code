<script setup lang="ts">
import { computed, ref, watch } from "vue";
import SettingsOptionHelp from "./SettingsOptionHelp.vue";
import SettingsSwitchRow from "./SettingsSwitchRow.vue";
import SettingsTextDetectionFamily from "./SettingsTextDetectionFamily.vue";
import SettingsTextDetectionSample from "./SettingsTextDetectionSample.vue";
import { DETECTION_FAMILY_IDS } from "../../lib/detection_families";
import { EMPTY_CONTEXT, claudeCommands, refContext, type RefContext } from "../../lib/refs";
import { selectedWorkspace } from "../../stores/session";
import { settings } from "../../stores/settings";
import { t } from "../../i18n/index";

// The section "Text detection" of the Settings window: the switch of the whole detection, the data of the project of the
// selected workspace, the field "Try a text", and one card for each detection family with its real patterns and examples.
// The families are listed in `lib/detection_families.ts`, and their rules in `lib/detection_catalog.ts`.
// - issue #638

/** The blocks of the information card of the switch of the whole detection, in the order of the card. */
const ALL_HELP_BLOCKS = [
  { titleKey: "settingsHelp.whatTitle", textKey: "textDetection.all.what" },
  { titleKey: "settingsHelp.onTitle", textKey: "textDetection.all.on" },
  { titleKey: "settingsHelp.offTitle", textKey: "textDetection.all.off" },
] as const;

/** The repository and the project settings of the selected workspace. */
const context = ref<RefContext>(EMPTY_CONTEXT);

/** The slash commands that Claude Code knows in the folder of the selected workspace. */
const knownCommands = ref<ReadonlySet<string>>(new Set());

const workspaceFolder = computed(() => selectedWorkspace.value?.workspace_folder ?? null);

watch(
  workspaceFolder,
  async (folder) => {
    context.value = await refContext(folder);
    knownCommands.value = folder === null ? new Set() : await claudeCommands(folder);
  },
  { immediate: true },
);

/** The rows of the data of the project: a label, and the value that Heidrun Code reads. */
const projectRows = computed(() => {
  const forgeKey =
    context.value.forge === null ? "textDetection.project.none" : `textDetection.project.${context.value.forge}`;
  return [
    { field: "workspace", label: t("textDetection.project.workspace"), value: workspaceFolder.value ?? t("textDetection.project.none") },
    { field: "repository", label: t("textDetection.project.repository"), value: context.value.base ?? t("textDetection.project.none") },
    { field: "forge", label: t("textDetection.project.forge"), value: t(forgeKey) },
    { field: "ticketAddress", label: t("textDetection.project.ticketAddress"), value: context.value.ticketUrl ?? t("textDetection.project.none") },
    {
      field: "ticketPrefixes",
      label: t("textDetection.project.ticketPrefixes"),
      value: context.value.ticketPrefixes.length === 0 ? t("textDetection.project.anyPrefix") : context.value.ticketPrefixes.join(", "),
    },
    {
      field: "referencesSwitch",
      label: t("textDetection.project.referencesSwitch"),
      value: t(context.value.enabled ? "textDetection.project.on" : "textDetection.project.off"),
    },
    {
      field: "slashCommands",
      label: t("textDetection.project.slashCommands"),
      value: t("textDetection.project.commandCount", { count: knownCommands.value.size }),
    },
  ];
});
</script>

<template>
  <div class="d-flex flex-column gap-3">
    <div data-option="textDetection">
      <SettingsSwitchRow v-model="settings.terminalTextDetection" :label="t('textDetection.all.name')">
        <SettingsOptionHelp title-key="textDetection.all.name" :blocks="ALL_HELP_BLOCKS" />
      </SettingsSwitchRow>
    </div>
    <p class="m-0">{{ t("textDetection.intro") }}</p>
    <div class="d-flex flex-column gap-2">
      <h4 class="form-label m-0">{{ t("textDetection.project.title") }}</h4>
      <div class="list-group" data-field="project">
        <div v-for="row in projectRows" :key="row.field" class="list-group-item d-flex align-items-baseline gap-3 flex-wrap" :data-row="row.field">
          <span class="text-body-secondary">{{ row.label }}</span>
          <span class="font-monospace text-break ms-auto" data-value>{{ row.value }}</span>
        </div>
      </div>
      <div v-if="workspaceFolder === null" class="form-text" data-field="no-workspace">{{ t("textDetection.project.noWorkspace") }}</div>
      <div class="form-text">{{ t("textDetection.project.configHint") }}</div>
    </div>
    <SettingsTextDetectionSample :context="context" :known-commands="knownCommands" />
    <SettingsTextDetectionFamily
      v-for="familyId in DETECTION_FAMILY_IDS"
      :key="familyId"
      :family-id="familyId"
      :context="context"
      :known-commands="knownCommands"
    />
  </div>
</template>
