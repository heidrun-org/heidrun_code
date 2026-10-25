<script setup lang="ts">
// The Code hosting sidebar section of the left sidebar: the open issues, and the open pull requests (GitHub) or merge
// requests (GitLab), of the repository of the selected workspace, in two collapsible lists. A row has three lines of the
// same height: the number and the title, then two small detail lines. A click on a row opens an information card at its
// right, with the details that the forge gives (see `ChatReferenceDetails.vue`), and a button that opens the web page of
// the item in the web browser. Each list has its own search line under its title: a search field with the buttons that
// run the search, save it, and edit the saved search that runs, then the saved searches of the list, then a separator.
// The developer keeps a search under a name as a saved search. The button of the header refreshes the two lists. Saving
// and editing open a modal window (see `SavedSearchModal.vue`).
// - issue #370
// - issue #374
// - issue #378
// - issue #607
// - issue #822
import { computed, reactive, ref, watch } from "vue";
import ChatReferenceDetails from "./ChatReferenceDetails.vue";
import CodeHostingSearchHelp from "./CodeHostingSearchHelp.vue";
import Icon from "./Icon.vue";
import InformationCard from "./InformationCard.vue";
import InformationCardTooltip from "./InformationCardTooltip.vue";
import ScrollingLine from "./ScrollingLine.vue";
import { codeHostingDetailLines } from "../lib/code_hosting_rows";
import { referenceLabelStyle, type ChatReference } from "../lib/chat_references";
import { toggleLabelInSearch } from "../lib/code_hosting_search";
import type { Forge } from "../lib/refs";
import { startScrolling, stopScrolling } from "../lib/scroll_on_hover";
import type { ChatReferenceDetails as Details, ChatReferenceLabel } from "../stores/chat_references";
import { loadForgeReferenceDetails } from "../stores/forge_reference_details";
import { shownSavedSearches, type ShownSavedSearch } from "../stores/code_hosting_searches";
import { currentGit } from "../stores/git";
import { selectedWorkspace, state } from "../stores/session";
import {
  CODE_HOSTING_GROUPS,
  CODE_HOSTING_LIMIT,
  codeHosting,
  codeHostingGroupTitle,
  itemPrefix,
  loadCodeHosting,
  searchCodeHosting,
  type CodeHostingGroup,
  type CodeHostingItem,
} from "../stores/code_hosting";
import { openEditSavedSearchModal, openSaveSearchModal } from "../stores/saved_search_modal";
import { t } from "../i18n/index";

/** One row of a list, ready to show. */
type Row = {
  /** The key of the row, for the list of the answers. */
  key: string;
  /** The issue, the pull request, or the merge request. */
  item: CodeHostingItem;
  /** The number with its mark: "#370", or "!5" for a merge request of GitLab. */
  name: string;
  /** The first small detail line. */
  opened: string;
  /** The labels of an issue, shown in their colors on the second small detail line. */
  labels: ChatReferenceLabel[];
  /** The text of the second small detail line when it holds no label. */
  extra: string;
  /** The item as the card of the Past chats sidebar section knows it. */
  reference: ChatReference;
};

/** One list with its rows, ready to show. */
type Section = {
  group: CodeHostingGroup;
  rows: Row[];
};

watch(
  () => currentGit.value?.root ?? null,
  (folder) => {
    void loadCodeHosting(folder);
  },
  { immediate: true },
);

/** The hosting service of the repository. A repository that is not on GitHub is read as GitLab, as everywhere else. */
const forge = computed<Forge>(() => codeHosting.forge ?? "github");

/** The two lists with their rows. */
const sections = computed((): Section[] => {
  const now = Date.now();
  return CODE_HOSTING_GROUPS.map((group) => ({
    group,
    rows: codeHosting[group].map((item) => {
      const lines = codeHostingDetailLines(group, item, now);
      return {
        key: `${group}-${item.number}`,
        item,
        name: `${itemPrefix(group, codeHosting.forge)}${item.number}`,
        opened: lines.opened,
        labels: lines.labels,
        extra: lines.extra,
        reference: { kind: group === "issues" ? "issue" : "pull_request", number: item.number, url: item.url },
      };
    }),
  }));
});

/** What the forge said about each item that has an open card, by key. A key is missing until the forge answered. */
const answers = ref<Record<string, Details | null>>({});

/** The title of a list: "Issues", then "Pull requests" on GitHub or "Merge requests" on GitLab. */
function groupTitle(group: CodeHostingGroup): string {
  return codeHostingGroupTitle(group, codeHosting.forge);
}

/**
 * The search that the button "All" of a list writes in the search field: `is:issue` for the issues and `is:pr` for the
 * pull requests of GitHub. GitLab cannot read these words, so the button writes no search there.
 * @param group - the list
 * @returns the search, or an empty text for no search
 */
function allSearch(group: CodeHostingGroup): string {
  if (codeHosting.forge !== "github") {
    return "";
  }
  return group === "issues" ? "is:issue" : "is:pr";
}

/**
 * Tells whether the search of a list shows all its open items: no search, or the search that the button "All" writes.
 * @param group - the list
 * @returns true when the button "All" of the list is the one that runs now
 */
function isAllSearch(group: CodeHostingGroup): boolean {
  const search = codeHosting.search[group];
  return search === "" || search === allSearch(group);
}

/** The text of an empty list: "No open issue.", or "No issue matches the search." while a search runs in the list. */
function emptyText(group: CodeHostingGroup): string {
  const kind = isAllSearch(group) ? "empty" : "emptySearch";
  if (group === "issues") {
    return t(`codeHostingPanel.${kind}.issues`);
  }
  return t(`codeHostingPanel.${kind}.${codeHosting.forge === "gitlab" ? "mergeRequests" : "pullRequests"}`);
}

/** The name of the search field of a list for a screen reader: "Search the issues", and so on. */
function searchLabel(group: CodeHostingGroup): string {
  if (group === "issues") {
    return t("codeHostingPanel.searchLabel.issues");
  }
  return t(codeHosting.forge === "gitlab" ? "codeHostingPanel.searchLabel.mergeRequests" : "codeHostingPanel.searchLabel.pullRequests");
}

/** The text of the search field of each list. It is the search that runs after the key Enter, not always the search that runs now. */
const searchTexts = reactive<Record<CodeHostingGroup, string>>({
  issues: codeHosting.search.issues,
  requests: codeHosting.search.requests,
});

// A search that runs from elsewhere (the window "Save this search", a saved search button) shows in the search field of its list.
for (const group of CODE_HOSTING_GROUPS) {
  watch(
    () => codeHosting.search[group],
    (search) => {
      searchTexts[group] = search;
    },
  );
}

/** True while the remote address or one of the two lists loads. */
const isLoading = computed(() => {
  return codeHosting.status === "loading" || CODE_HOSTING_GROUPS.some((group) => codeHosting.listStatus[group] === "loading");
});

/**
 * The saved search of a list that runs now.
 * @param group - the list
 * @returns the saved search, or undefined when no saved search runs in this list
 */
function runningSearch(group: CodeHostingGroup) {
  const search = codeHosting.search[group];
  if (search === "") {
    return undefined;
  }
  return shownSavedSearches(group).find((saved) => saved.query === search);
}

/**
 * The button "Save this search" of a list works when its field holds a search that no saved search of the list holds.
 * @param group - the list
 * @returns true when the search of the field can be saved
 */
function canSaveSearch(group: CodeHostingGroup): boolean {
  const search = searchTexts[group].trim();
  return search !== "" && shownSavedSearches(group).some((saved) => saved.query === search) === false;
}

/**
 * Runs the search of the search field of a list.
 * @param group - the list
 */
function runSearch(group: CodeHostingGroup) {
  void searchCodeHosting(currentGit.value?.root ?? null, group, searchTexts[group]);
}

/**
 * Puts a search in the search field of a list and runs it.
 * @param group - the list
 * @param query - the search, or an empty text for all the open items
 */
function applySearch(group: CodeHostingGroup, query: string) {
  searchTexts[group] = query;
  runSearch(group);
}

/**
 * Adds a label to the search field of a list, or removes it when the field already asks for it, then runs the search of
 * this list.
 * @param group - the list
 * @param labelName - the name of the label that the developer clicked in the information card
 */
function toggleLabel(group: CodeHostingGroup, labelName: string) {
  searchTexts[group] = toggleLabelInSearch(searchTexts[group], labelName);
  runSearch(group);
}

/**
 * Opens the window "Save this search" for the search of the search field of a list.
 * @param group - the list
 */
function saveCurrentSearch(group: CodeHostingGroup) {
  openSaveSearchModal(group, searchTexts[group].trim());
}

/**
 * Opens the window "Edit the saved search" for the saved search of a list that runs now.
 * @param group - the list
 */
function editRunningSearch(group: CodeHostingGroup) {
  const running = runningSearch(group);
  if (running !== undefined) {
    openEditSavedSearchModal(group, running.name, running.level);
  }
}

/**
 * The blocks of the information card tooltip of a saved search: the search, the level, and the list.
 * @param saved - the saved search
 * @param group - the list that the saved search is for
 * @returns the blocks, each with a title and a text
 */
function savedSearchBlocks(saved: ShownSavedSearch, group: CodeHostingGroup): { title: string; text: string }[] {
  const levelText =
    saved.level === "user"
      ? t("codeHostingPanel.savedCard.levelUser")
      : t("codeHostingPanel.savedCard.levelWorkspace", { name: selectedWorkspace.value?.label ?? "" });
  return [
    { title: t("codeHostingPanel.savedCard.search"), text: saved.query },
    { title: t("codeHostingPanel.savedCard.level"), text: levelText },
    { title: t("codeHostingPanel.savedCard.list"), text: codeHostingGroupTitle(group, codeHosting.forge) },
  ];
}

function toggleGroup(group: CodeHostingGroup) {
  codeHosting.folded[group] = codeHosting.folded[group] === false;
}

/**
 * Reads the details of a row from the forge. The card of the row opens when this reading is done, so it never shows less
 * than the whole answer. The Tauri command keeps each answer for ten minutes, so a second reading is immediate.
 */
async function readDetails(row: Row) {
  const folder = currentGit.value?.root;
  if (folder === undefined) {
    return;
  }
  const answer = await loadForgeReferenceDetails(folder, forge.value, row.reference);
  answers.value = { ...answers.value, [row.key]: answer };
}
</script>

<template>
  <div class="code-hosting">
    <div v-if="state.selectedWorkspaceId === null" class="muted">{{ t("codeHostingPanel.selectWorkspace") }}</div>
    <div v-else-if="currentGit === null" class="muted">{{ t("codeHostingPanel.notRepository") }}</div>
    <template v-else>
      <header class="d-flex align-items-center">
        <span class="title me-auto">{{ t("codeHostingPanel.title") }}</span>
        <button
          type="button"
          class="btn icon btn-sm icon-button"
          :aria-label="t('codeHostingPanel.refresh')"
          :title="t('codeHostingPanel.refresh')"
          :disabled="isLoading"
          @click="loadCodeHosting(currentGit.root, true)"
        >
          <Icon name="arrow-clockwise" />
        </button>
      </header>

      <div class="scroll-area">
        <div v-if="codeHosting.status === 'noRemote'" class="muted">{{ t("codeHostingPanel.noRemote") }}</div>
        <div v-else-if="codeHosting.status === 'failed'" class="failure">{{ codeHosting.error }}</div>
        <div v-else-if="codeHosting.status !== 'ready'" class="muted">{{ t("codeHostingPanel.loading") }}</div>
        <div v-else class="groups">
          <section v-for="section in sections" :key="section.group" class="group" :data-group="section.group">
            <div class="group-header d-flex align-items-center" @click="toggleGroup(section.group)">
              <button
                type="button"
                class="group-toggle list-action d-flex align-items-center gap-2"
                :aria-expanded="codeHosting.folded[section.group] === false"
              >
                <Icon :name="codeHosting.folded[section.group] ? 'chevron-right' : 'chevron-down'" />
                {{ groupTitle(section.group) }}
              </button>
              <CodeHostingSearchHelp
                class="ms-1 me-auto"
                :forge="forge"
                :title="groupTitle(section.group)"
                :is-requests="section.group === 'requests'"
                @click.stop
              />
              <span v-if="codeHosting.listStatus[section.group] === 'ready'" class="badge count">{{ section.rows.length }}</span>
            </div>
            <template v-if="codeHosting.folded[section.group] === false">
              <form class="search d-flex align-items-center gap-1" role="search" @submit.prevent="runSearch(section.group)">
                <input
                  v-model="searchTexts[section.group]"
                  type="text"
                  class="form-control form-control-sm"
                  spellcheck="false"
                  autocomplete="off"
                  :placeholder="t('codeHostingPanel.searchPlaceholder')"
                  :title="t('codeHostingPanel.searchHint')"
                  :aria-label="searchLabel(section.group)"
                />
                <button
                  type="submit"
                  class="btn icon btn-sm icon-button"
                  data-run-search
                  :aria-label="t('codeHostingPanel.searchRun')"
                  :title="t('codeHostingPanel.searchRun')"
                >
                  <Icon name="search" />
                </button>
                <button
                  type="button"
                  class="btn icon btn-sm icon-button"
                  data-save-search
                  :aria-label="t('codeHostingPanel.saveSearch')"
                  :title="t('codeHostingPanel.saveSearch')"
                  :disabled="canSaveSearch(section.group) === false"
                  @click="saveCurrentSearch(section.group)"
                >
                  <Icon name="bookmark-plus" />
                </button>
                <button
                  type="button"
                  class="btn icon btn-sm icon-button"
                  data-edit-saved-search
                  :aria-label="t('codeHostingPanel.editSearch')"
                  :title="t('codeHostingPanel.editSearch')"
                  :disabled="runningSearch(section.group) === undefined"
                  @click="editRunningSearch(section.group)"
                >
                  <Icon name="pencil" />
                </button>
              </form>
              <div
                v-if="shownSavedSearches(section.group).length > 0"
                class="saved d-flex flex-wrap align-items-center gap-1"
                role="group"
                :aria-label="t('codeHostingPanel.savedSearches')"
              >
                <button
                  type="button"
                  class="btn btn-sm saved-button"
                  data-saved-search="all"
                  :class="{ active: isAllSearch(section.group) }"
                  :aria-pressed="isAllSearch(section.group)"
                  @click="applySearch(section.group, allSearch(section.group))"
                >
                  {{ t("codeHostingPanel.allItems") }}
                </button>
                <InformationCardTooltip
                  v-for="saved in shownSavedSearches(section.group)"
                  :key="`${saved.level}:${saved.name}`"
                  :title="saved.name"
                  :blocks="savedSearchBlocks(saved, section.group)"
                  v-slot="{ triggerProps }"
                >
                  <button
                    v-bind="triggerProps"
                    type="button"
                    class="btn btn-sm saved-button"
                    data-saved-search
                    :data-saved-search-level="saved.level"
                    :class="{ active: codeHosting.search[section.group] === saved.query }"
                    :aria-pressed="codeHosting.search[section.group] === saved.query"
                    @click="applySearch(section.group, saved.query)"
                  >
                    <span class="saved-name">{{ saved.name }}</span>
                  </button>
                </InformationCardTooltip>
              </div>
              <div class="list-separator" role="separator"></div>
              <div v-if="codeHosting.listNotice[section.group] !== ''" class="failure empty" data-code-hosting-notice>
                {{ codeHosting.listNotice[section.group] }}
              </div>
              <div v-if="codeHosting.listStatus[section.group] === 'loading'" class="muted empty">
                {{ t("codeHostingPanel.loading") }}
              </div>
              <div v-else-if="codeHosting.listStatus[section.group] === 'failed'" class="failure empty">
                {{ codeHosting.listError[section.group] }}
              </div>
              <ul v-else-if="section.rows.length > 0" class="items">
                <li v-for="row in section.rows" :key="row.key">
                  <InformationCard
                    class="row-card"
                    placement="end"
                    :label="t('codeHostingPanel.cardLabel', { name: row.name })"
                    :busy-label="t('codeHostingPanel.cardBusy', { name: row.name })"
                    :prepare="() => readDetails(row)"
                  >
                    <div
                      class="item d-flex align-items-center gap-2"
                      data-code-hosting-item
                      @pointerenter="startScrolling"
                      @pointerleave="stopScrolling"
                    >
                      <div class="item-lines">
                        <div class="title-line">
                          <span class="number">{{ row.name }}</span>
                          <ScrollingLine class="title-text">{{ row.item.title }}</ScrollingLine>
                        </div>
                        <div class="detail-line">{{ row.opened }}</div>
                        <div v-if="row.labels.length > 0" class="detail-line labels-line">
                          <span
                            v-for="label in row.labels"
                            :key="label.name"
                            class="badge label-badge"
                            :style="referenceLabelStyle(label.color)"
                          >
                            {{ label.name }}
                          </span>
                        </div>
                        <div v-else class="detail-line">{{ row.extra }}</div>
                      </div>
                    </div>
                    <template #card>
                      <div class="card-content">
                        <ChatReferenceDetails
                          :reference="row.reference"
                          :details="answers[row.key]"
                          :folder="currentGit.root"
                          :forge="forge"
                          :web-base="codeHosting.webBase"
                          :title="row.item.title"
                          :name="row.name"
                          :search="searchTexts[section.group]"
                          @toggle-label="toggleLabel(section.group, $event)"
                        />
                      </div>
                    </template>
                  </InformationCard>
                </li>
              </ul>
              <div v-else class="muted empty">{{ emptyText(section.group) }}</div>
              <div v-if="section.rows.length >= CODE_HOSTING_LIMIT && codeHosting.listStatus[section.group] === 'ready'" class="muted empty">
                {{ t("codeHostingPanel.truncated", { limit: CODE_HOSTING_LIMIT }) }}
              </div>
            </template>
          </section>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.code-hosting { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.code-hosting > .muted { padding: 12px 16px; }
/* The header stays at the top of the sidebar section: only the scroll area under it scrolls, with the search lines of the two lists. */
.code-hosting > header { flex: 0 0 auto; padding: 12px 16px 8px; }
/* The search line and the line of saved searches of a list sit under its title, with the same side space as the header. */
.search { padding: 4px 16px 8px; }
.saved { padding: 0 16px 8px; }
.list-separator { border-top: 1px solid var(--line); }
.scroll-area { flex: 1; min-height: 0; padding: 0 16px 12px; display: flex; flex-direction: column; gap: 8px; overflow-y: auto; }
.title { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.code-hosting :deep(.icon-button) { height: 22px; padding: 0 5px; color: var(--muted); border: none; }
.code-hosting :deep(.icon-button:hover:not(:disabled)) { background: var(--hover); color: var(--text); }
.search .form-control { flex: 1 1 auto; min-width: 0; }
/* A saved search is a small button with a round border: the one that runs now is filled. */
.saved-button { display: inline-flex; align-items: center; max-width: 100%; white-space: nowrap; }
/* A name that does not fit ends with an ellipsis. A button cannot show one itself, so the name is in its own span. */
.saved-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.groups { display: flex; flex-direction: column; gap: 4px; margin: 0 -16px; }
/* A click anywhere on the header folds or unfolds the list: the button inside it gives the keyboard access. */
.group-header { height: 26px; margin: 0 8px; padding: 0 8px; border-radius: 5px; cursor: pointer; }
.group-header:hover { background: var(--hover-soft); }
.group-toggle { border: none; background: none; padding: 0; color: var(--text); font-size: var(--font-size); text-align: left; min-width: 0; font-weight: 600; }
.count { background: var(--line-strong); color: var(--text-2); margin-left: 4px; }
.items { list-style: none; margin: 0; padding: 0; }
/* A row takes the whole width of the sidebar section, has square corners, and has a very light line under it. */
.items .row-card { margin: 0; padding: 0; border-radius: 0; border-bottom: 1px solid color-mix(in srgb, var(--line) 50%, transparent); }
/* Every row has the same height: each line has its own height, and a text that does not fit ends with an ellipsis. */
.item { padding: 4px 16px 4px 32px; }
/* The spinning wheel of a row that waits for its details is on the bottom line of the row, near its right end. */
.row-card :deep(.information-card-busy) { top: auto; bottom: 5px; margin-top: 0; }
.item-lines { flex: 1 1 auto; min-width: 0; }
.title-line, .detail-line { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.title-line { display: flex; gap: 0.35em; height: 1.5em; line-height: 1.5; }
.title-text { flex: 1 1 0; min-width: 0; }
/* The pills of the labels are as high as their line, less one pixel above and below, so that their border is never cut. */
.labels-line { display: flex; align-items: center; gap: 0.35em; }
/* Bootstrap gives a badge a minimum height of 1.375rem, which is higher than the line. */
.label-badge { flex: 0 0 auto; box-sizing: border-box; min-height: 0; height: calc(100% - 2px); border: 1px solid; padding: 0 0.5em; line-height: 1; }
.detail-line { height: 1.35em; line-height: 1.35; font-size: 0.85em; color: var(--muted); }
.number { color: var(--muted); }
/* The card has no padding of its own: its content decides it. */
.card-content { padding: 12px 16px; }
.empty { padding: 0 16px 0 32px; }
.failure { font-size: var(--font-size); color: var(--fail); }
.muted { font-size: var(--font-size); color: var(--muted); }
</style>
