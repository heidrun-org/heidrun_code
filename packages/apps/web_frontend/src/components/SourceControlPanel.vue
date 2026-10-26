<script setup lang="ts">
// The Source control sidebar section of the left sidebar, as the source control view of VS Code: the message box, the
// commit button, the group "Staged Changes", and the group "Changes". It shows only the local Git repository.
// - issue #305
import { computed } from "vue";
import Icon from "./Icon.vue";
import SourceControlMenu from "./SourceControlMenu.vue";
import { currentGit, git, openGitModal, refreshGit } from "../stores/git";
import { openFiles } from "../stores/files";
import { DiffPanes } from "../stores/diff_panes";
import {
  commit,
  discardFiles,
  sourceControl,
  splitFiles,
  stageFiles,
  stashChanges,
  syncRepository,
  unstageFiles,
  writeCommitMessage,
  type CommitMode,
  type SourceControlFile,
  type SourceControlGroup,
  type SyncAction,
} from "../stores/source_control";
import { state } from "../stores/session";
import { fileIconName } from "../lib/chat_files";
import { t } from "../i18n/index";

const groups = computed(() => splitFiles(currentGit.value));

/** The commit message of the selected workspace. */
const message = computed({
  get: () => (state.selectedWorkspaceId === null ? "" : sourceControl.messages[state.selectedWorkspaceId] ?? ""),
  set: (text: string) => {
    if (state.selectedWorkspaceId !== null) {
      sourceControl.messages[state.selectedWorkspaceId] = text;
    }
  },
});

const placeholder = computed(() =>
  t("sourceControlPanel.messagePlaceholder", { branch: currentGit.value?.branch ?? t("sourceControlPanel.detached") }),
);

const commitItems = computed(() => [
  { id: "commit", label: t("sourceControlPanel.commitMenu.commit") },
  { id: "commitAndPush", label: t("sourceControlPanel.commitMenu.commitAndPush") },
  { id: "amend", label: t("sourceControlPanel.commitMenu.amend"), isDisabled: currentGit.value?.last_sha === null },
]);

const moreItems = computed(() => [
  { id: "pull", label: t("sourceControlPanel.moreMenu.pull", { count: currentGit.value?.behind ?? 0 }) },
  { id: "push", label: t("sourceControlPanel.moreMenu.push", { count: currentGit.value?.ahead ?? 0 }) },
  { id: "fetch", label: t("sourceControlPanel.moreMenu.fetch") },
  { id: "openLarge", label: t("sourceControlPanel.moreMenu.openLarge") },
]);

/** The class that gives a status letter its color. */
function letterClass(letter: string): string {
  if (letter === "A" || letter === "U") {
    return "added";
  }
  if (letter === "D" || letter === "!") {
    return "deleted";
  }
  if (letter === "R" || letter === "C") {
    return "renamed";
  }
  return "modified";
}

/** The tooltip of a file line: the full path, then the status in words. */
function fileTitle(file: SourceControlFile): string {
  return `${currentGit.value?.root ?? ""}/${file.path} • ${t(`sourceControlPanel.letter.${letterKey(file.letter)}`)}`;
}

/** The key of the translation of a status letter. */
function letterKey(letter: string): string {
  const keys: Record<string, string> = {
    M: "modified",
    A: "added",
    D: "deleted",
    R: "renamed",
    C: "copied",
    T: "typeChanged",
    U: "untracked",
    "!": "conflict",
  };
  return keys[letter] ?? "modified";
}

function toggleGroup(group: SourceControlGroup) {
  sourceControl.folded[group] = sourceControl.folded[group] === false;
}

function paths(group: SourceControlGroup): string[] {
  return groups.value[group].map((file) => file.path);
}

function openFile(file: SourceControlFile) {
  void openFiles(currentGit.value?.root, { path: file.path });
}

// A click on a file line shows its changes in a diff pane. When no pane can show them, the large Git window shows them (issue #885).
async function openDiff(file: SourceControlFile) {
  const root = currentGit.value?.root;
  if (root === undefined || (await DiffPanes.open(`${root}/${file.path}`)) === false) {
    openGitModal(file.path);
  }
}

function onCommitKeyDown(event: KeyboardEvent) {
  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    void commit("commit");
  }
}

function chooseMore(id: string) {
  if (id === "openLarge") {
    openGitModal();
    return;
  }
  void syncRepository(id as SyncAction);
}

</script>

<template>
  <div class="source-control">
    <div v-if="state.selectedWorkspaceId === null" class="muted">{{ t("sourceControlPanel.selectWorkspace") }}</div>
    <template v-else-if="currentGit">
      <header class="d-flex align-items-center">
        <span class="title me-auto">{{ t("sourceControlPanel.title") }}</span>
        <button
          type="button"
          class="btn icon btn-sm icon-button"
          :aria-label="t('sourceControlPanel.commit')"
          :title="t('sourceControlPanel.commit')"
          :disabled="sourceControl.isBusy"
          @click="commit('commit')"
        >
          <Icon name="check2" />
        </button>
        <button
          type="button"
          class="btn icon btn-sm icon-button"
          :aria-label="t('sourceControlPanel.refresh')"
          :title="t('sourceControlPanel.refresh')"
          :disabled="git.loading"
          @click="refreshGit()"
        >
          <Icon name="arrow-clockwise" />
        </button>
        <SourceControlMenu
          button-class="btn icon btn-sm icon-button"
          icon="three-dots-vertical"
          :label="t('sourceControlPanel.moreActions')"
          :items="moreItems"
          :is-disabled="sourceControl.isBusy"
          @choose="chooseMore"
        />
      </header>

      <div class="message d-flex align-items-start gap-1">
        <textarea
          v-model="message"
          class="form-control flex-fill"
          rows="1"
          :placeholder="placeholder"
          :aria-label="t('sourceControlPanel.messageLabel')"
          @keydown="onCommitKeyDown"
        ></textarea>
        <button
          type="button"
          class="btn icon btn-sm icon-button write-message"
          :aria-label="t('sourceControlPanel.writeMessage')"
          :title="t('sourceControlPanel.writeMessage')"
          :disabled="sourceControl.isWritingMessage"
          @click="writeCommitMessage()"
        >
          <span v-if="sourceControl.isWritingMessage" class="spinner-border spinner-sm" role="status"></span>
          <Icon v-else name="stars" />
        </button>
      </div>

      <div class="btn-group d-flex" role="group" :aria-label="t('sourceControlPanel.commit')">
        <button type="button" class="btn btn-primary flex-fill justify-content-center" :disabled="sourceControl.isBusy" @click="commit('commit')">
          <Icon name="check2" /> {{ t("sourceControlPanel.commit") }}
        </button>
        <SourceControlMenu
          button-class="btn btn-primary commit-arrow"
          icon="chevron-down"
          :label="t('sourceControlPanel.commitActions')"
          :items="commitItems"
          :is-disabled="sourceControl.isBusy"
          @choose="(id) => commit(id as CommitMode)"
        />
      </div>

      <div class="groups">
        <template v-for="group in (['staged', 'changes'] as const)" :key="group">
          <section class="group">
            <div class="group-header d-flex align-items-center" @click="toggleGroup(group)">
              <button
                type="button"
                class="list-action group-toggle d-flex align-items-center gap-2 me-auto"
                :aria-expanded="sourceControl.folded[group] === false"
              >
                <Icon :name="sourceControl.folded[group] ? 'chevron-right' : 'chevron-down'" />
                {{ t(`sourceControlPanel.group.${group}`) }}
              </button>
              <span class="hover-actions" @click.stop>
                <button
                  type="button"
                  class="btn icon btn-sm icon-button"
                  :aria-label="t('sourceControlPanel.stash')"
                  :title="t('sourceControlPanel.stash')"
                  :disabled="sourceControl.isBusy || groups[group].length === 0"
                  @click="stashChanges(group === 'staged')"
                >
                  <Icon name="archive" />
                </button>
                <button
                  type="button"
                  class="btn icon btn-sm icon-button"
                  :aria-label="t('sourceControlPanel.viewChanges')"
                  :title="t('sourceControlPanel.viewChanges')"
                  :disabled="groups[group].length === 0"
                  @click="openGitModal()"
                >
                  <Icon name="files" />
                </button>
                <button
                  v-if="group === 'changes'"
                  type="button"
                  class="btn icon btn-sm icon-button"
                  :aria-label="t('sourceControlPanel.discardAll')"
                  :title="t('sourceControlPanel.discardAll')"
                  :disabled="sourceControl.isBusy || groups.changes.length === 0"
                  @click="discardFiles(paths('changes'))"
                >
                  <Icon name="arrow-90deg-left" />
                </button>
                <button
                  v-if="group === 'changes'"
                  type="button"
                  class="btn icon btn-sm icon-button"
                  :aria-label="t('sourceControlPanel.stageAll')"
                  :title="t('sourceControlPanel.stageAll')"
                  :disabled="sourceControl.isBusy || groups.changes.length === 0"
                  @click="stageFiles(paths('changes'))"
                >
                  <Icon name="plus-lg" />
                </button>
                <button
                  v-else
                  type="button"
                  class="btn icon btn-sm icon-button"
                  :aria-label="t('sourceControlPanel.unstageAll')"
                  :title="t('sourceControlPanel.unstageAll')"
                  :disabled="sourceControl.isBusy || groups.staged.length === 0"
                  @click="unstageFiles(paths('staged'))"
                >
                  <Icon name="dash-lg" />
                </button>
              </span>
              <span class="badge count">{{ groups[group].length }}</span>
            </div>
            <ul v-if="sourceControl.folded[group] === false" class="files">
              <li
                v-for="file in groups[group]"
                :key="`${group}:${file.path}`"
                class="file d-flex align-items-center"
                :title="fileTitle(file)"
              >
                <button type="button" class="list-action file-main d-flex align-items-center gap-2 me-auto" @click="openDiff(file)">
                  <Icon :name="fileIconName(file.name)" />
                  <span class="name">{{ file.name }}</span>
                  <span v-if="file.folder !== ''" class="folder">{{ file.folder }}</span>
                </button>
                <span class="hover-actions">
                  <button
                    type="button"
                    class="btn icon btn-sm icon-button"
                    :aria-label="t('sourceControlPanel.openFile')"
                    :title="t('sourceControlPanel.openFile')"
                    @click="openFile(file)"
                  >
                    <Icon name="file-earmark-arrow-up" />
                  </button>
                  <template v-if="group === 'changes'">
                    <button
                      type="button"
                      class="btn icon btn-sm icon-button"
                      :aria-label="t('sourceControlPanel.discard')"
                      :title="t('sourceControlPanel.discard')"
                      :disabled="sourceControl.isBusy"
                      @click="discardFiles([file.path])"
                    >
                      <Icon name="arrow-90deg-left" />
                    </button>
                    <button
                      type="button"
                      class="btn icon btn-sm icon-button"
                      :aria-label="t('sourceControlPanel.stage')"
                      :title="t('sourceControlPanel.stage')"
                      :disabled="sourceControl.isBusy"
                      @click="stageFiles([file.path])"
                    >
                      <Icon name="plus-lg" />
                    </button>
                  </template>
                  <button
                    v-else
                    type="button"
                    class="btn icon btn-sm icon-button"
                    :aria-label="t('sourceControlPanel.unstage')"
                    :title="t('sourceControlPanel.unstage')"
                    :disabled="sourceControl.isBusy"
                    @click="unstageFiles([file.path])"
                  >
                    <Icon name="dash-lg" />
                  </button>
                </span>
                <span class="letter" :class="letterClass(file.letter)">{{ file.letter }}</span>
              </li>
            </ul>
          </section>
        </template>

      </div>
    </template>
    <div v-else class="muted">{{ t("sourceControlPanel.notRepository") }}</div>
  </div>
</template>

<style scoped>
.source-control { flex: 1; min-height: 0; padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; overflow-y: auto; }
.title { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.message textarea { resize: vertical; min-height: 34px; }
.source-control :deep(.write-message) { flex: 0 0 auto; height: 34px; }
/* The commit action follows the shared primary button rules in styles.css. */
.btn-group :deep(.commit-arrow) { flex: 0 0 auto; border-left-color: var(--solid-divider); }
.groups { display: flex; flex-direction: column; gap: 4px; margin: 0 -8px; }
.group-header { height: 26px; padding: 0 8px; border-radius: 5px; cursor: pointer; }
.group-header:hover { background: var(--hover-soft); }
.group-toggle, .file-main { border: none; background: none; padding: 0; color: var(--text); font-size: var(--font-size); text-align: left; min-width: 0; }
.group-toggle { font-weight: 600; }
.count { background: var(--line-strong); color: var(--text-2); margin-left: 4px; }
/* The buttons keep their place while they are hidden, so the line does not move when the pointer comes over it. */
.hover-actions { display: inline-flex; align-items: center; visibility: hidden; }
.group-header:hover .hover-actions, .file:hover .hover-actions, .hover-actions:focus-within { visibility: visible; }
.files { list-style: none; margin: 0; padding: 0; }
.file { height: 24px; padding: 0 8px 0 24px; border-radius: 5px; }
.file:hover { background: var(--hover-soft); }
.file-main { flex: 1 1 auto; overflow: hidden; white-space: nowrap; }
.name { flex-shrink: 0; }
.folder { color: var(--muted); overflow: hidden; text-overflow: ellipsis; }
.letter { width: 18px; flex-shrink: 0; text-align: center; font: 600 var(--font-size) var(--mono); }
.letter.modified { color: var(--accent); }
.letter.added { color: var(--ok); }
.letter.deleted { color: var(--blocked-text); }
.letter.renamed { color: var(--done-text); }
.muted { color: var(--muted); }
.req { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; border-radius: 10px; background: var(--field); }
.req.mine { box-shadow: inset 0 0 0 1px var(--pane-ring-selected); }
.req-main { display: flex; flex-direction: column; gap: 4px; border: none; background: none; padding: 0; text-align: left; color: var(--text); }
.req-top { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.ref { color: var(--question); font-size: var(--font-size); }
.req-title { font-size: var(--font-size); font-weight: 500; }
.req-actions { display: flex; gap: 14px; }
.merge.ready { color: var(--question); }
.err { font-size: var(--font-size); color: var(--fail); }
.muted { font-size: var(--font-size); color: var(--muted); }
</style>
