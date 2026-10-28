<script setup lang="ts">
import { computed } from "vue";
import Icon from "./Icon.vue";
import {
  PersonWorkUpdateStages,
  type PersonWorkUpdateReports,
  type PersonWorkUpdateStage,
  type PersonWorkUpdateStageId,
} from "../lib/person_work_update_stages";
import { locale, t } from "../i18n/index";

// The wait of the tab "Work of one person" while the data layer updates the database: a big busy wheel in the middle of
// the tab, the text of the stage in progress, which slides in each time that a new stage starts, and the list of the six
// stages of each workspace. A stage waits, is in progress with its progress from 0 to 100 percent, or is done with a check
// mark. A stage whose total is not known is in progress with no percent.

const props = defineProps<{
  /** The folders that the tab reads, each one with the last progress report of each stage. */
  updates: { folder: string; reports: PersonWorkUpdateReports }[];
}>();

/** The key of the text of each stage. */
const STAGE_TEXT_KEYS: Record<PersonWorkUpdateStageId, string> = {
  readCommits: "statisticsModal.personWorkStageReadCommits",
  writeCommits: "statisticsModal.personWorkStageWriteCommits",
  readIssues: "statisticsModal.personWorkStageReadIssues",
  writeIssues: "statisticsModal.personWorkStageWriteIssues",
  readPullRequests: "statisticsModal.personWorkStageReadPullRequests",
  writePullRequests: "statisticsModal.personWorkStageWritePullRequests",
};

/** One folder of the list: the name of its repository, and its six stages with their texts. */
type FolderStages = {
  /** The folder. */
  folder: string;
  /** The stages, in order, each one with its text and the text of its count. */
  stages: (PersonWorkUpdateStage & { text: string; countText: string })[];
};

/** The folders of the list, each one with its six stages. */
const folders = computed<FolderStages[]>(() =>
  props.updates.map((update) => {
    const repository = repositoryName(update.folder, PersonWorkUpdateStages.repositoryOf(update.reports));
    return {
      folder: update.folder,
      stages: PersonWorkUpdateStages.stagesOf(update.reports).map((stage) => ({
        ...stage,
        text: t(STAGE_TEXT_KEYS[stage.id], { repository }),
        countText: countText(update.reports, stage),
      })),
    };
  }),
);

/** The stage in progress that the big text shows: the first one of the first folder that is not done, or `null`. */
const currentStage = computed(() => {
  for (const folder of folders.value) {
    const stage = folder.stages.find((found) => found.state === "working");
    if (stage !== undefined) {
      return {
        key: `${folder.folder}:${stage.id}`,
        text: stage.text,
      };
    }
  }
  return null;
});

/**
 * Gives the short name of a repository: the part after the slash, for example `heidrun_code`. Before the first report, the
 * repository is not known, and the name is the last part of the folder.
 *
 * @param folder - The folder of the workspace.
 * @param repository - The repository in the format `owner/name`, or `null`.
 * @returns The short name.
 */
function repositoryName(folder: string, repository: string | null): string {
  const name = repository ?? folder.replace(/\/+$/, "");
  return name.split("/").pop() ?? name;
}

/**
 * Gives the count of a stage in progress: the items done and the total, or the items done when the total is not known. A
 * stage that waits, that is done, or that has handled no item yet has no count.
 *
 * @param reports - The last report of each stage.
 * @param stage - The stage.
 * @returns The text of the count, or an empty text.
 */
function countText(reports: PersonWorkUpdateReports, stage: PersonWorkUpdateStage): string {
  const report = reports[stage.id];
  if (stage.state !== "working" || report === undefined) {
    return "";
  }
  const format = new Intl.NumberFormat(locale.value);
  if (report.totalCount === null) {
    return report.doneCount === 0 ? "" : t("statisticsModal.personWorkStageCountUnknown", { done: format.format(report.doneCount) });
  }
  return t("statisticsModal.personWorkStageCount", { done: format.format(report.doneCount), total: format.format(report.totalCount) });
}
</script>

<template>
  <div class="d-flex flex-column align-items-center justify-content-center gap-3 flex-fill" role="status" data-note="update-stages">
    <span class="spinner-border update-stages-spinner text-primary-emphasis" aria-hidden="true"></span>
    <span class="fs-4 fw-semibold">{{ t("statisticsModal.personWorkLoading") }}</span>
    <div class="overflow-hidden position-relative update-stage-slot">
      <Transition name="update-stage" mode="out-in">
        <span v-if="currentStage !== null" :key="currentStage.key" class="position-absolute top-0 bottom-0 text-body-secondary update-stage-text" data-note="current-stage">{{ currentStage.text }}</span>
      </Transition>
    </div>
    <ul v-for="folder in folders" :key="folder.folder" class="list-group update-stages-list" :data-folder="folder.folder">
      <li
        v-for="stage in folder.stages"
        :key="stage.id"
        class="list-group-item d-flex align-items-center gap-2 position-relative"
        :data-stage="stage.id"
        :data-state="stage.state"
      >
        <span class="d-inline-flex justify-content-center update-stage-icon">
          <span v-if="stage.state === 'working'" class="spinner-border spinner-sm text-primary-emphasis" :aria-label="t('statisticsModal.personWorkStageWorking')"></span>
          <span v-else-if="stage.state === 'done'" class="text-success-emphasis" :title="t('statisticsModal.personWorkStageDone')">
            <Icon name="check-circle-fill" />
          </span>
          <span v-else class="text-body-secondary" :title="t('statisticsModal.personWorkStageWaiting')"><Icon name="circle" /></span>
        </span>
        <span
          class="update-stage-row-text"
          :class="stage.state === 'waiting' ? 'text-body-secondary' : stage.state === 'working' ? 'fw-semibold' : ''"
          :title="stage.text"
          data-note="stage-text"
          >{{ stage.text }}</span
        >
        <span v-if="stage.countText !== ''" class="form-text ms-auto" data-note="count">{{ stage.countText }}</span>
        <span v-if="stage.state === 'working' && stage.percent !== null" class="form-text" :class="stage.countText === '' ? 'ms-auto' : ''" data-note="percent">{{ stage.percent }} %</span>
        <div
          v-if="stage.state === 'working' && stage.percent !== null"
          class="progress position-absolute bottom-0 update-stage-progress"
          role="progressbar"
          :aria-valuenow="stage.percent"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-label="stage.text"
        >
          <div class="progress-bar" :style="{ width: `${stage.percent}%` }"></div>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
/* Bootstrap has no large size of busy wheel: its size tokens are set here. */
.update-stages-spinner {
  --spinner-width: 3rem;
  --spinner-height: 3rem;
  --spinner-border-width: 0.25rem;
}

/* The list keeps a readable width in a wide window. */
.update-stages-list {
  width: min(100%, 36rem);
}

/* Every row keeps the height of one line, so the list never moves: the icons have one width, a long text ends with an
   ellipsis, and the progress bar is a thin line on the lower edge of the row of the stage in progress. */
.update-stage-icon {
  flex: 0 0 1rem;
}

.update-stage-row-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.update-stage-progress {
  --progress-height: 0.25rem;
  --progress-border-radius: 0;
  left: 0;
  right: 0;
}

/* The slot of the text of the stage in progress keeps the height of one line and the width of the list, so the busy wheel
   and the list never move while the text changes or slides. */
.update-stage-slot {
  width: min(100%, 36rem);
  height: 1.5em;
}

.update-stage-text {
  left: 0;
  right: 0;
  text-align: center;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

/* The text of a new stage slides up into its place, and the text of the stage before slides up and away. */
.update-stage-enter-active,
.update-stage-leave-active {
  transition: transform 0.25s ease, opacity 0.25s ease;
}

.update-stage-enter-from {
  transform: translateY(100%);
  opacity: 0;
}

.update-stage-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>
