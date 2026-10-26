<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import UserActivityHistogram from "./UserActivityHistogram.vue";
import { ApplicationLog } from "../lib/application_log";
import { UserActivity, type UserActivityRecord } from "../lib/user_activity";
import { UserActivitySlotLengthText } from "../lib/user_activity_slot_length_text";
import {
  USER_ACTIVITY_RANGES,
  UserActivitySlots,
  type UserActivityRangeId,
  type UserActivitySlot,
  type UserActivitySlotLengthId,
} from "../lib/user_activity_slots";
import {
  UserActivityWorkspaces,
  type UserActivityWorkspaceChoice,
  type UserActivityWorkspaceSlots,
} from "../lib/user_activity_workspaces";
import { settings } from "../stores/settings";
import { activePeriodStartedAt, openWorkspaces, selectedWorkspaceFolder } from "../stores/user_activity";
import { t } from "../i18n/index";

// The tab "User activity" of the Statistics window: the histogram of the user activity time, and three choices. Each bar
// of the histogram is stacked, with one color for each chosen workspace, and the legend of the histogram gives the colors. The
// time range is the last day, the last week, or the last month. The slot length depends on the time range, and it goes back
// to the slot length that the time range starts with each time that the time range changes. The workspaces are all of them
// at first, and the developer can hide any workspace. The records are read once, for the longest time range, when the
// window opens. Each choice then cuts the same records again, so a choice never reads the data layer again. Each choice is
// saved in the settings as soon as it changes, and the tab starts with the saved choices (issue 707).

/** The choices of the radio button group of the time range, from left to right. */
const RANGE_CHOICES = [
  { id: "day", labelKey: "statisticsModal.rangeDay", titleKey: "statisticsModal.rangeDayTitle" },
  { id: "week", labelKey: "statisticsModal.rangeWeek", titleKey: "statisticsModal.rangeWeekTitle" },
  { id: "month", labelKey: "statisticsModal.rangeMonth", titleKey: "statisticsModal.rangeMonthTitle" },
] as const satisfies readonly { id: UserActivityRangeId; labelKey: string; titleKey: string }[];

/** The time range of the histogram. The tab starts with the saved time range, or else with the last day. */
const rangeId = ref<UserActivityRangeId>(settings.statisticsUserActivityRange);

/** Gives the slot length that the tab starts with: the saved slot length when the time range offers it, else the default one. */
function firstSlotLengthId(): UserActivitySlotLengthId {
  const range = USER_ACTIVITY_RANGES[rangeId.value];
  return range.slotLengthIds.includes(settings.statisticsUserActivitySlotLength) ? settings.statisticsUserActivitySlotLength : range.defaultSlotLengthId;
}

/** The slot length of the histogram. The tab starts with the saved slot length, or else with the one that its time range starts with. */
const slotLengthId = ref<UserActivitySlotLengthId>(firstSlotLengthId());

/** The slot lengths that the developer can choose in the time range, from the shortest to the longest. */
const slotLengthIds = computed(() => USER_ACTIVITY_RANGES[rangeId.value].slotLengthIds);

/** The records of the periods that ended, or `null` while they are read. */
const records = ref<UserActivityRecord[] | null>(null);

/** The time of the reading, in milliseconds. The last slot of the histogram holds this time. */
const readAt = ref(0);

/** The folder of the workspace that ran the active period at the time of the reading, or `null` when no period ran. */
const runningPeriodFolder = ref<string | null>(null);

/** The start of the active period that ran at the time of the reading, or `null` when no period ran. */
const runningPeriodStartedAt = ref<number | null>(null);

/** The workspaces that the developer can choose. */
const workspaceChoices = computed<UserActivityWorkspaceChoice[]>(() =>
  UserActivityWorkspaces.choices(openWorkspaces.value.map((workspace) => ({
    folder: workspace.folder,
    label: workspace.label,
  }))),
);

/** The folders of the workspaces that the histogram shows. */
const chosenFolders = ref<string[]>([]);

/**
 * The folders of the workspaces that the histogram shows, for the buttons of the workspaces. A choice of the developer is
 * saved in the settings. A change that the tab makes by itself, when a workspace opens or closes, is not saved, so a
 * workspace that closes for a while does not lose its place in the saved choice.
 */
const chosenFoldersChoice = computed({
  get: () => chosenFolders.value,
  set: (folders: string[]) => {
    chosenFolders.value = folders;
    settings.statisticsUserActivityWorkspaces = {
      isEveryWorkspaceChosen: workspaceChoices.value.length > 0 && workspaceChoices.value.every((choice) => folders.includes(choice.folder)),
      folders: [...folders],
    };
  },
});

/**
 * Gives the folders to choose when the workspaces appear: the saved choice when it still names an open workspace, else every
 * workspace.
 *
 * @param choices - The workspaces that the developer can choose.
 * @returns The folders of the workspaces to show.
 */
function firstChosenFolders(choices: UserActivityWorkspaceChoice[]): string[] {
  const everyFolder = choices.map((choice) => choice.folder);
  const saved = settings.statisticsUserActivityWorkspaces;
  if (saved.isEveryWorkspaceChosen === true) {
    return everyFolder;
  }
  const stillOpen = saved.folders.filter((folder) => everyFolder.includes(folder));
  return saved.folders.length === 0 || stillOpen.length > 0 ? stillOpen : everyFolder;
}

watch(workspaceChoices, (choices, previousChoices) => {
  if (previousChoices === undefined || previousChoices.length === 0) {
    chosenFolders.value = firstChosenFolders(choices);
    return;
  }
  if (chosenFolders.value.length === 0) {
    return;
  }
  const wasEveryWorkspaceChosen = previousChoices.every((choice) => chosenFolders.value.includes(choice.folder));
  const stillOpen = chosenFolders.value.filter((folder) => choices.some((choice) => choice.folder === folder));
  if (wasEveryWorkspaceChosen === true) {
    chosenFolders.value = choices.map((choice) => choice.folder);
    return;
  }
  chosenFolders.value = stillOpen.length > 0 ? stillOpen : choices.slice(0, 1).map((choice) => choice.folder);
}, { immediate: true });

const errorText = ref("");

/** True when the histogram shows every workspace. */
const isEveryWorkspaceChosen = computed(
  () => workspaceChoices.value.length > 0 && workspaceChoices.value.every((choice) => chosenFolders.value.includes(choice.folder)),
);

/** True when the histogram shows no workspace. */
const isNoWorkspaceChosen = computed(() => chosenFolders.value.length === 0);

/** The slots of the histogram, or `null` while the records are read. */
const slots = computed<UserActivitySlot[] | null>(() => {
  if (records.value === null) {
    return null;
  }
  return UserActivitySlots.compute(
    UserActivityWorkspaces.filterRecords(records.value, chosenFolders.value),
    UserActivityWorkspaces.runningPeriodStartedAt(runningPeriodStartedAt.value, runningPeriodFolder.value, chosenFolders.value),
    readAt.value,
    rangeId.value,
    slotLengthId.value,
  );
});

/** The slots of each chosen workspace, in the order of the colors: the parts of the stacked bars. */
const workspaceSlots = computed<UserActivityWorkspaceSlots[]>(() => {
  if (records.value === null) {
    return [];
  }
  return UserActivityWorkspaces.slotsByWorkspace(
    workspaceChoices.value,
    chosenFolders.value,
    records.value,
    runningPeriodStartedAt.value,
    runningPeriodFolder.value,
    readAt.value,
    rangeId.value,
    slotLengthId.value,
  );
});

watch(rangeId, (newRangeId) => {
  slotLengthId.value = USER_ACTIVITY_RANGES[newRangeId].defaultSlotLengthId;
  settings.statisticsUserActivityRange = newRangeId;
});

watch(slotLengthId, (newSlotLengthId) => {
  settings.statisticsUserActivitySlotLength = newSlotLengthId;
});

/** Chooses every workspace. */
function chooseEveryWorkspace(): void {
  chosenFoldersChoice.value = workspaceChoices.value.map((choice) => choice.folder);
}

/** Chooses no workspace. */
function chooseNoWorkspace(): void {
  chosenFoldersChoice.value = [];
}

/**
 * Copies the new lines of the file of the records into the SQLite file of the data layer, then reads the records of the longest
 * time range from the SQLite file.
 */
async function load(): Promise<void> {
  const now = Date.now();
  const startedAt = performance.now();
  try {
    await invoke("user_activity_synchronize");
    const loaded = await invoke<UserActivityRecord[]>("user_activity_records_in_range", {
      since: UserActivity.formatTime(UserActivitySlots.earliestSlotStartedAt(now)),
      until: UserActivity.formatTime(now),
    });
    runningPeriodStartedAt.value = activePeriodStartedAt.value;
    runningPeriodFolder.value = activePeriodStartedAt.value === null ? null : selectedWorkspaceFolder.value;
    readAt.value = now;
    records.value = loaded;
    void ApplicationLog.recordLoadTime("statistics_user_activity", startedAt, null);
  } catch (error) {
    errorText.value = String(error);
    void ApplicationLog.recordLoadTime("statistics_user_activity", startedAt, errorText.value);
  }
}

onMounted(load);
</script>

<template>
  <div class="d-flex flex-column" style="height: 100%">
    <div class="d-flex flex-wrap align-items-center gap-3 mb-3">
      <div class="btn-group" role="group" :aria-label="t('statisticsModal.rangeLabel')">
        <label v-for="choice in RANGE_CHOICES" :key="choice.id" class="btn btn-check btn-outline theme-secondary" :title="t(choice.titleKey)">
          <input
            :id="`statistics-range-${choice.id}`"
            v-model="rangeId"
            type="radio"
            name="statistics-range"
            autocomplete="off"
            :value="choice.id"
          />
          {{ t(choice.labelKey) }}
        </label>
      </div>
      <div class="d-flex align-items-center gap-2">
        <span class="form-text">{{ t("statisticsModal.slotLabel") }}</span>
        <div class="btn-group" role="group" :aria-label="t('statisticsModal.slotLabel')">
          <label
            v-for="id in slotLengthIds"
            :key="id"
            class="btn btn-check btn-outline theme-secondary"
            :title="t('statisticsModal.slotTitle', { slotLength: UserActivitySlotLengthText.of(id) })"
          >
            <input
              :id="`statistics-slot-${id}`"
              v-model="slotLengthId"
              type="radio"
              name="statistics-slot"
              autocomplete="off"
              :value="id"
            />
            {{ UserActivitySlotLengthText.of(id) }}
          </label>
        </div>
      </div>
    </div>
    <div v-if="workspaceChoices.length > 0" class="d-flex flex-wrap align-items-center gap-2 mb-3">
      <span class="form-text">{{ t("statisticsModal.workspacesLabel") }}</span>
      <div class="btn-group btn-group-sm" role="group" :aria-label="t('statisticsModal.workspacesEveryLabel')">
        <label class="btn btn-check btn-outline theme-secondary" :title="t('statisticsModal.workspacesAllTitle')">
          <input
            id="statistics-workspace-all"
            type="radio"
            name="statistics-workspace-every"
            autocomplete="off"
            :checked="isEveryWorkspaceChosen"
            @change="chooseEveryWorkspace"
          />
          {{ t("statisticsModal.workspacesAllButton") }}
        </label>
        <label class="btn btn-check btn-outline theme-secondary" :title="t('statisticsModal.workspacesNoneTitle')">
          <input
            id="statistics-workspace-none"
            type="radio"
            name="statistics-workspace-every"
            autocomplete="off"
            :checked="isNoWorkspaceChosen"
            @change="chooseNoWorkspace"
          />
          {{ t("statisticsModal.workspacesNoneButton") }}
        </label>
      </div>
      <div class="btn-group btn-group-sm flex-wrap" role="group" :aria-label="t('statisticsModal.workspacesLabel')">
        <label
          v-for="(choice, index) in workspaceChoices"
          :key="choice.folder"
          class="btn btn-check btn-outline theme-secondary"
          :title="t('statisticsModal.workspaceTitle', { folder: choice.folder })"
        >
          <input
            :id="`statistics-workspace-${index}`"
            v-model="chosenFoldersChoice"
            type="checkbox"
            autocomplete="off"
            :value="choice.folder"
          />
          {{ choice.name }}
        </label>
      </div>
    </div>
    <div style="flex: 1 1 0; min-height: 240px">
      <div v-if="errorText !== ''" class="alert alert-danger" role="alert">{{ t("statisticsModal.loadError", { error: errorText }) }}</div>
      <span v-else-if="slots === null" class="form-text" role="status"><span class="spinner-border spinner-sm me-2" aria-hidden="true"></span>{{ t("statisticsModal.loading") }}</span>
      <span v-else-if="workspaceChoices.length > 0 && chosenFolders.length === 0" class="form-text">{{ t("statisticsModal.workspacesNone") }}</span>
      <UserActivityHistogram v-else :slots="slots" :workspace-slots="workspaceSlots" :range-id="rangeId" :slot-length-id="slotLengthId" />
    </div>
  </div>
</template>
