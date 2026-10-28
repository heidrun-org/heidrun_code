<script setup lang="ts">
import { computed } from "vue";
import AbbreviatedTime from "./AbbreviatedTime.vue";
import Icon from "./Icon.vue";
import InformationCard from "./InformationCard.vue";
import { diffStats, type DiffLine } from "../lib/diff";
import type { GitStatus } from "../stores/git";
import { splitFiles } from "../stores/source_control";
import { t } from "../i18n/index";

// The circled question mark of the header of a diff pane. A click opens a card with the facts of the changes: the file, the
// staged and the not staged status, the numbers of added and removed lines, and the last commit that the diff compares with.
// Issue: https://github.com/heidrun-org/heidrun_code/issues/885
const props = defineProps<{
  /** The lines of the diff that the pane shows. */
  lines: DiffLine[];
  /** The path of the file inside the Git repository, or null when it is not known. */
  path: string | null;
  /** The Git status of the workspace of the pane, or null when it is not read or when there is no Git repository. */
  gitStatus: GitStatus | null;
}>();

/** The width of the card: it has a few short rows. */
const CARD_WIDTH = "22rem";

/** The keys of the translations of the status letters, as the Source control sidebar section shows them. */
const LETTER_KEYS: Record<string, string> = {
  M: "modified",
  A: "added",
  D: "deleted",
  R: "renamed",
  C: "copied",
  T: "typeChanged",
  U: "untracked",
  "!": "conflict",
};

const stats = computed(() => diffStats(props.lines));
/** The status letter of the file in each group of the Source control sidebar section, or null when it is not in the group. */
const letters = computed(() => {
  const file = props.gitStatus?.files.find((entry) => entry.path === props.path);
  if (props.gitStatus === null || file === undefined) {
    return { staged: null, changes: null };
  }
  const groups = splitFiles({ ...props.gitStatus, files: [file] });
  return { staged: groups.staged[0]?.letter ?? null, changes: groups.changes[0]?.letter ?? null };
});
/** The time of the last commit, in milliseconds, or null when the repository has no commit. */
const lastCommitTime = computed(() => {
  const seconds = props.gitStatus?.last_time ?? null;
  return seconds === null ? null : seconds * 1000;
});

/** The status of the file in one group, in words, or "No" when the file is not in the group. */
function letterText(letter: string | null): string {
  if (letter === null) {
    return t("diffPane.card.no");
  }
  return t(`sourceControlPanel.letter.${LETTER_KEYS[letter] ?? "modified"}`);
}
</script>

<template>
  <InformationCard :label="t('diffPane.card.title')" placement="bottom" :width="CARD_WIDTH">
    <span class="d-inline-flex align-items-center text-body-secondary" :title="t('diffPane.card.buttonTitle')">
      <Icon name="question-circle" />
    </span>
    <template #card>
      <div class="list-group list-group-flush">
        <div class="list-group-item fw-medium">{{ t("diffPane.card.title") }}</div>
        <div class="list-group-item d-flex justify-content-between gap-3" data-field="file">
          <span class="text-body-secondary">{{ t("diffPane.card.file") }}</span>
          <span class="mono text-break text-end">{{ path ?? "" }}</span>
        </div>
        <div class="list-group-item d-flex justify-content-between gap-3" data-field="staged">
          <span class="text-body-secondary">{{ t("diffPane.card.staged") }}</span>
          <span>{{ letterText(letters.staged) }}</span>
        </div>
        <div class="list-group-item d-flex justify-content-between gap-3" data-field="not-staged">
          <span class="text-body-secondary">{{ t("diffPane.card.notStaged") }}</span>
          <span>{{ letterText(letters.changes) }}</span>
        </div>
        <div class="list-group-item d-flex justify-content-between gap-3" data-field="added">
          <span class="text-body-secondary">{{ t("diffPane.card.added") }}</span>
          <span class="mono plus">+{{ stats.added }}</span>
        </div>
        <div class="list-group-item d-flex justify-content-between gap-3" data-field="removed">
          <span class="text-body-secondary">{{ t("diffPane.card.removed") }}</span>
          <span class="mono minus">−{{ stats.removed }}</span>
        </div>
        <div class="list-group-item d-flex flex-column gap-1" data-field="last-commit">
          <span class="text-body-secondary">{{ t("diffPane.card.lastCommit") }}</span>
          <span v-if="gitStatus?.last_sha" class="text-break">
            <span class="mono">{{ gitStatus.last_sha.slice(0, 7) }}</span> {{ gitStatus.last_subject ?? "" }}
          </span>
          <span v-else>{{ t("diffPane.card.noCommit") }}</span>
        </div>
        <div v-if="lastCommitTime !== null" class="list-group-item d-flex justify-content-between gap-3" data-field="last-commit-date">
          <span class="text-body-secondary text-nowrap">{{ t("diffPane.card.lastCommitDate") }}</span>
          <span class="text-end"><AbbreviatedTime :milliseconds="lastCommitTime" /></span>
        </div>
      </div>
    </template>
  </InformationCard>
</template>

<style scoped>
.plus { color: var(--ok); }
.minus { color: var(--blocked-text); }
</style>
