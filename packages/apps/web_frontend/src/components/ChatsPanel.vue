<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import {
  canShowLessChats,
  canShowMoreChats,
  CHAT_AGENTS,
  chats,
  chooseChatAgent,
  loadChats,
  selectedChatAgent,
  shownChats,
  showLessChats,
  showMoreChats,
  type ChatAgent,
} from "../stores/chats";
import { chatReferences } from "../lib/chat_references";
import { dynamicTopicBarTopics, dynamicTopicChatCounts, withoutCommonTopics } from "../lib/dynamic_topic_bar";
import { chatSummaryLines } from "../lib/chat_summary";
import { EMPTY_CONTEXT, refContext, type RefContext } from "../lib/refs";
import { clusteredTopicsByChat } from "../lib/topic_clusters";
import { prepareChatReferences } from "../stores/chat_references";
import { keywordTopicsOf, prepareKeywordTopics } from "../stores/dynamic_topics";
import { languageModelTopicsOf, prepareLanguageModelTopics } from "../stores/language_model_topics";
import { prepareTopicClusters, topicClusterTable } from "../stores/topic_clusters";
import { workspaceCwd } from "../stores/project";
import { state } from "../stores/session";
import { settings } from "../stores/settings";
import { t } from "../i18n/index";
import ChatDatesLine from "./ChatDatesLine.vue";
import ChatFilesLine from "./ChatFilesLine.vue";
import ChatWorktreesLine from "./ChatWorktreesLine.vue";
import ChatReferencesLine from "./ChatReferencesLine.vue";
import ChatsSortMenu from "./ChatsSortMenu.vue";
import DynamicTopicBar from "./DynamicTopicBar.vue";
import TopicTimelineModal from "./TopicTimelineModal.vue";
import Icon from "./Icon.vue";
import { openChatInApp, openChatInHeidrun } from "../stores/chat_open";

/** The number of milliseconds in one second. */
const MILLISECONDS_PER_SECOND = 1_000;

const folder = computed(() => (state.selectedWorkspaceId === null ? null : workspaceCwd(state.selectedWorkspaceId)));

/** The address and the forge of the repository of the folder, for the buttons that open a file on the web. */
const repository = ref<RefContext>(EMPTY_CONTEXT);

watch(folder, (value) => loadChats(value), { immediate: true });
watch(
  folder,
  async (value) => {
    repository.value = EMPTY_CONTEXT;
    if (value === null) {
      return;
    }
    const context = await refContext(value);
    if (folder.value === value) {
      repository.value = context;
      if (context.forge === "github") {
        prepareChatReferences(value);
      }
    }
  },
  { immediate: true },
);

/**
 * Makes the cache of the method "Keyword" hold the chats that the list shows, each time the list, the method, or the option
 * "Dynamic topics" changes. Then it gives the raw dynamic topics of the list to the clustering, which asks a coding agent
 * for the new ones when the option "Clustered dynamic topics" is on. It does nothing while the option "Dynamic topics" is off.
 */
watch(
  () => [shownChats.value, repository.value, chats.root, settings.dynamicTopicExtraction, settings.dynamicTopics] as const,
  async ([list, context, root, method, isEnabled]) => {
    if (isEnabled === false || method !== "keyword") {
      return;
    }
    await prepareKeywordTopics(list, { folder: chats.folder, root, forge: context.forge });
    if (list === shownChats.value) {
      void prepareTopicClusters([...keywordTopicsOf(list).values()].flat());
    }
  },
  { immediate: true },
);
/**
 * Asks a coding agent for the topics of the chats that the list shows and that have none yet, each time the list, the
 * method, or the option "Dynamic topics" changes. The method "Language model" is the only one that asks, and it never asks
 * while the option "Dynamic topics" is off.
 */
watch(
  () => [shownChats.value, settings.dynamicTopicExtraction, settings.dynamicTopics] as const,
  ([list, method, isEnabled]) => {
    if (isEnabled && method === "languageModel") {
      void prepareLanguageModelTopics(list);
    }
  },
  { immediate: true },
);
// The topics of the method "Language model" come one call after another, so the clustering gets the raw dynamic topics
// each time they change.
watch(
  () =>
    settings.dynamicTopics && settings.dynamicTopicExtraction === "languageModel"
      ? [...languageModelTopicsOf(shownChats.value).values()].flat()
      : null,
  (languageModelRawTopics) => {
    if (languageModelRawTopics !== null) {
      void prepareTopicClusters(languageModelRawTopics);
    }
  },
  { immediate: true },
);
// Switching the option on asks for the clusters of the raw dynamic topics that the list already shows.
watch(
  () => settings.clusteredDynamicTopics,
  (isOn) => {
    if (isOn) {
      void prepareTopicClusters([...rawTopics.value.values()].flat());
    }
  },
);
// The list reads the files of the coding agents again while it is on the screen, after the delay of the Settings window
// (section Past chats). A change of the delay starts the timer again.
let refreshTimer: ReturnType<typeof setInterval> | null = null;
function stopRefreshTimer() {
  if (refreshTimer !== null) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}
watch(
  () => settings.chatsRefreshSeconds,
  (seconds) => {
    stopRefreshTimer();
    refreshTimer = setInterval(() => loadChats(folder.value), seconds * MILLISECONDS_PER_SECOND);
  },
  { immediate: true },
);
onBeforeUnmount(stopRefreshTimer);

/** The name of a coding agent, as the selector shows it. */
function agentLabel(agent: ChatAgent): string {
  return t(`chatsPanel.agent.${agent}`);
}

/**
 * The raw dynamic topics of the chats that the list shows, by identifier of chat, from the method that the developer chose.
 * There is none while the option "Dynamic topics" is off, so the dynamic topic bar and the rows show nothing.
 */
const rawTopics = computed(() => {
  if (settings.dynamicTopics === false) {
    return new Map<string, string[]>();
  }
  return settings.dynamicTopicExtraction === "keyword" ? keywordTopicsOf(shownChats.value) : languageModelTopicsOf(shownChats.value);
});

/**
 * The dynamic topics that the rows and the dynamic topic bar show, by identifier of chat. They are the raw dynamic topics,
 * or the clustered dynamic topics when the option "Clustered dynamic topics" is on, without the topics that more than half
 * of the chats have.
 */
const topics = computed(() =>
  withoutCommonTopics(
    settings.clusteredDynamicTopics ? clusteredTopicsByChat(rawTopics.value, topicClusterTable.value) : rawTopics.value,
  ),
);

/** The topics of the dynamic topic bar, the strongest first. */
const barTopics = computed(() => dynamicTopicBarTopics(topics.value));

/** The number of chats that have each topic of the dynamic topic bar, among the chats that the list shows. */
const barChatCounts = computed(() => dynamicTopicChatCounts(topics.value));

/** The topic that the developer clicked in the dynamic topic bar, or null for the button "All". It is not saved. */
const selectedTopic = ref<string | null>(null);

/** The topic that filters the list: the clicked topic while the chats that the list shows still have it. */
const activeTopic = computed(() =>
  selectedTopic.value !== null && barTopics.value.includes(selectedTopic.value) ? selectedTopic.value : null,
);

// A topic that no chat of the list has any more (another workspace, another coding agent, a shorter list) is forgotten,
// so that it does not filter again when it comes back.
watch(activeTopic, (value) => {
  if (value === null) {
    selectedTopic.value = null;
  }
});
watch([folder, () => selectedChatAgent.value], () => {
  selectedTopic.value = null;
});

/** The chats that the list shows, each with its dynamic topics and the three lines of its summary. */
const rows = computed(() =>
  shownChats.value
    .map((chat) => ({
      chat,
      topics: topics.value.get(chat.id) ?? [],
      lines: chatSummaryLines(chat.meta, new Date(), chats.root),
      references: chatReferences(chat.meta.issues, chat.meta.pull_requests, repository.value.base, repository.value.forge),
    }))
    .filter((row) => activeTopic.value === null || row.topics.includes(activeTopic.value)),
);

/** True while the topic timeline is open. */
const isTopicTimelineOpen = ref(false);

/** Opens the chat of a dot of the topic timeline in Heidrun Code, and closes the topic timeline. */
function openTimelineChat(chat: (typeof shownChats.value)[number]): void {
  isTopicTimelineOpen.value = false;
  openChatInHeidrun(agent.value, chat, chats.folder);
}

/** The coding agent of the selector. */
const agent = computed<ChatAgent>({
  get: () => selectedChatAgent.value ?? chats.agent,
  set: (value) => chooseChatAgent(value),
});

/** The title of the button that opens a chat in the desktop application of the coding agent of the list. */
const appTitle = computed(() => t("chatsPanel.openInAppTitle", { app: agentLabel(agent.value) }));

/** The icon of the coding agent of the list, as the tabs show it: Claude has its own icon, and Codex has the icon of OpenAI. */
const agentIcon = computed(() => (agent.value === "codex" ? "openai" : "claude"));

/** The view of the list: "expanded" gives more air to the rows, and every other saved value gives the compact view. */
const view = computed<"compact" | "expanded">({
  get: () => (settings.chatsView === "expanded" ? "expanded" : "compact"),
  set: (value) => {
    settings.chatsView = value;
  },
});

/** The two views of the list, in the order of the buttons: the expanded view first, then the compact view. */
const VIEWS = [
  { id: "expanded", icon: "view-stacked", title: "chatsPanel.viewExpanded" },
  { id: "compact", icon: "list", title: "chatsPanel.viewCompact" },
] as const;
</script>

<template>
  <section class="past-chats d-flex flex-column" :aria-label="t('chatsPanel.label')">
    <header class="past-chats-title d-flex align-items-center">
      <span class="fw-semibold text-truncate">{{ t("chatsPanel.title") }}</span>
    </header>
    <div class="chats-panel d-flex flex-column gap-3 overflow-y-auto">
      <div v-if="chats.error !== null" class="alert theme-danger" role="alert">{{ chats.error }}</div>
      <div v-else-if="chats.isLoading" class="text-body-secondary">{{ t("chatsPanel.loading") }}</div>
      <div v-else-if="selectedChatAgent === null" class="text-body-secondary">
        {{ folder === null ? t("chatsPanel.noWorkspace") : t("chatsPanel.empty") }}
      </div>
      <template v-else>
        <div class="chats-header d-flex flex-column gap-3">
          <div class="d-flex flex-wrap align-items-center justify-content-between gap-2">
            <div class="btn-group" role="group" :aria-label="t('chatsPanel.agentLabel')">
              <label
                v-for="choice in CHAT_AGENTS"
                :key="choice"
                class="btn btn-check"
                :title="chats[choice].length === 0 ? t('chatsPanel.agentUnavailableTitle') : undefined"
              >
                <input
                  :id="`chats-agent-${choice}`"
                  v-model="agent"
                  type="radio"
                  name="chats-agent"
                  autocomplete="off"
                  :value="choice"
                  :disabled="chats[choice].length === 0"
                />
                {{ agentLabel(choice) }}
              </label>
            </div>
            <div class="d-flex align-items-center gap-2">
              <button
                v-if="barTopics.length > 0"
                type="button"
                class="btn"
                :title="t('chatsPanel.topicTimelineTitle')"
                :aria-label="t('chatsPanel.topicTimelineTitle')"
                @click="isTopicTimelineOpen = true"
              >
                <Icon name="bar-chart-steps" />
              </button>
              <ChatsSortMenu />
              <div class="btn-group" role="group" :aria-label="t('chatsPanel.viewLabel')">
                <label v-for="choice in VIEWS" :key="choice.id" class="btn btn-check" :title="t(choice.title)">
                  <input
                    :id="`chats-view-${choice.id}`"
                    v-model="view"
                    type="radio"
                    name="chats-view"
                    autocomplete="off"
                    :value="choice.id"
                    :aria-label="t(choice.title)"
                  />
                  <Icon :name="choice.icon" />
                </label>
              </div>
            </div>
          </div>
          <DynamicTopicBar
            v-if="barTopics.length > 0"
            :topics="barTopics"
            :chat-counts="barChatCounts"
            :selected="activeTopic"
            @select="selectedTopic = $event"
          />
          <div class="chats-separator border-top" role="separator"></div>
        </div>
        <ul class="list-group list-group-flush" :class="{ 'is-expanded': view === 'expanded' }">
          <li v-for="row in rows" :key="row.chat.id" class="list-group-item list-group-item-action text-break">
            <div class="d-flex align-items-start gap-2">
              <div class="chat-title flex-fill">{{ row.chat.title }}</div>
              <div class="chat-actions btn-group" role="group" :aria-label="t('chatsPanel.chatActionsLabel')">
                <button
                  type="button"
                  class="btn"
                  :title="appTitle"
                  :aria-label="appTitle"
                  @click="openChatInApp(agent, row.chat)"
                >
                  <Icon :name="agentIcon" />
                </button>
                <button
                  type="button"
                  class="btn"
                  :title="t('chatsPanel.heidrunTitle')"
                  :aria-label="t('chatsPanel.heidrunTitle')"
                  @click="openChatInHeidrun(agent, row.chat, chats.folder)"
                >
                  <Icon name="heidrun-goat-only" />
                </button>
              </div>
            </div>
            <div v-if="row.topics.length > 0" class="chat-topics" role="group" :aria-label="t('chatsPanel.topicsLabel')">
              <button
                v-for="topic in row.topics"
                :key="topic"
                type="button"
                class="badge me-2"
                :class="{ 'is-selected': activeTopic === topic }"
                :aria-pressed="activeTopic === topic"
                :title="
                  activeTopic === topic
                    ? t('chatsPanel.topicAllTitle')
                    : t('chatsPanel.topicTitle', { topic, count: barChatCounts.get(topic) ?? 0 })
                "
                @click="selectedTopic = activeTopic === topic ? null : topic"
              >
                {{ topic }}
              </button>
            </div>
            <div class="chat-summary d-flex flex-column text-body-secondary">
              <ChatDatesLine
                v-if="row.lines.dates !== ''"
                :text="row.lines.dates"
                :meta="row.chat.meta"
                :usage="row.chat.usage ?? null"
              />
              <ChatReferencesLine
                v-if="row.references.length > 0"
                :text="row.lines.references"
                :references="row.references"
                :folder="chats.folder ?? ''"
                :forge="repository.forge"
                :web-base="repository.base"
              />
              <ChatFilesLine
                v-if="row.lines.files !== ''"
                :text="row.lines.files"
                :entries="row.lines.fileEntries"
                :folder="chats.folder ?? ''"
                :web-base="repository.base"
                :forge="repository.forge"
              />
              <ChatWorktreesLine v-if="row.lines.worktrees !== ''" :entries="row.lines.worktreeEntries" />
            </div>
          </li>
        </ul>
        <div class="d-flex gap-2">
          <button
            type="button"
            class="btn flex-fill justify-content-center position-relative"
            :disabled="canShowMoreChats === false || chats.isShowingMore"
            :aria-busy="chats.isShowingMore"
            @click="showMoreChats"
          >
            {{ t("chatsPanel.showMore") }}
            <span
              v-if="chats.isShowingMore"
              class="busy-spinner spinner-border position-absolute top-0 bottom-0 end-0 my-auto me-2"
              role="status"
              aria-hidden="true"
            ></span>
          </button>
          <button
            type="button"
            class="btn flex-fill justify-content-center"
            :disabled="canShowLessChats === false || chats.isShowingMore"
            @click="showLessChats"
          >
            {{ t("chatsPanel.showLess") }}
          </button>
        </div>
      </template>
    </div>
    <TopicTimelineModal
      v-if="isTopicTimelineOpen"
      :chats="shownChats"
      :topics="topics"
      @close="isTopicTimelineOpen = false"
      @open="openTimelineChat"
    />
  </section>
</template>

<style scoped>
.past-chats { --chats-inset: 14px; --chats-top: 8px; flex: 1; min-height: 0; }
.past-chats-title { flex: 0 0 auto; padding: 12px var(--chats-inset) 0; }
.chats-panel { flex: 1; min-height: 0; padding: var(--chats-top) var(--chats-inset) 18px; }
.chats-header {
  position: sticky; top: calc(-1 * var(--chats-top)); z-index: 2; margin: calc(-1 * var(--chats-top)) calc(-1 * var(--chats-inset)) -0.5rem;
  padding: var(--chats-top) var(--chats-inset) 0; background: var(--side);
}
.list-group { margin: 0 calc(-1 * var(--chats-inset)); --list-group-item-padding-x: var(--chats-inset); }
.chats-separator { margin: 0 calc(-1 * var(--chats-inset)); }
.is-expanded { --list-group-item-padding-y: 1rem; }
.is-expanded .chat-title { min-width: 0; }
.chat-topics { margin-top: 6px; overflow: hidden; white-space: nowrap; }
/* The reset of the rule "button:where(:not(.btn))" in styles.css is not in a layer, so it wins over the layer of Bootstrap: the label gives the badge values back. */
.chat-topics .badge {
  --badge-color: var(--fg-body); background-color: var(--bg-2); border: 0;
  color: var(--badge-color); font-size: var(--badge-font-size); font-weight: var(--badge-font-weight); line-height: 1;
}
.chat-topics .badge:hover { background-color: var(--border-color); }
.chat-topics .badge.is-selected { --badge-color: var(--bg-body); background-color: var(--fg-body); }
.chat-actions .btn { height: 26px; --btn-padding-x: 8px; }
.chat-summary { margin-top: 6px; gap: 4px; }
.chat-summary { margin-top: 2px; font-size: 0.85em; width: fit-content; max-width: 100%; }
.busy-spinner { --spinner-width: 0.75rem; --spinner-height: 0.75rem; --spinner-border-width: 0.15em; }
</style>
