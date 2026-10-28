<script setup lang="ts">
// The topic timeline: one row for each dynamic topic of the chats that the list shows, the time from left to right, and one
// dot for each chat. The rows are in the order "related topics together". A click on a topic keeps only the chats of this
// topic, and a click on a dot opens the chat (issue 264).
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import DialogCloseButton from "./DialogCloseButton.vue";
import { topicTimelineLayout } from "../lib/topic_timeline";
import { lastMessageAt } from "../stores/dynamic_topics";
import type { Chat } from "../stores/chats";
import { t } from "../i18n/index";

const props = defineProps<{
  /** The chats that the list shows. */
  chats: Chat[];
  /** The dynamic topics of each chat, by identifier of chat, as the rows of the list show them. */
  topics: Map<string, string[]>;
}>();

const emit = defineEmits<{
  /** The developer closed the topic timeline. */
  close: [];
  /** The developer clicked the dot of a chat. */
  open: [chat: Chat];
}>();

/** The height of one row, in pixels. */
const ROW_HEIGHT = 28;

/** The radius of one dot, in pixels. */
const DOT_RADIUS = 5;

/** The part of the width, in percent, left empty at each end of the time axis, so that a dot at an end is not cut. */
const AXIS_MARGIN = 3;

const layout = computed(() =>
  topicTimelineLayout(
    props.chats.map((chat) => ({ id: chat.id, lastAt: lastMessageAt(chat) })),
    props.topics,
  ),
);

/** The chats by identifier, for the title of a dot and for the click on a dot. */
const chatById = computed(() => new Map(props.chats.map((chat) => [chat.id, chat])));

/** The topic that the developer clicked, or null when every chat is shown. */
const selectedTopic = ref<string | null>(null);

/** The chats of the selected topic, or null when every chat is shown. */
const selectedChatIds = computed(() => {
  if (selectedTopic.value === null) {
    return null;
  }
  const ids = new Set<string>();
  for (const [id, topics] of props.topics) {
    if (topics.includes(selectedTopic.value)) {
      ids.add(id);
    }
  }
  return ids;
});

/** True when the chat is dimmed, because a topic is selected and the chat does not have it. */
function isDimmed(chatId: string): boolean {
  return selectedChatIds.value !== null && selectedChatIds.value.has(chatId) === false;
}

/** The horizontal place of a dot or of a line, in percent of the width of the picture. */
function xOf(x: number): string {
  return `${AXIS_MARGIN + x * (100 - 2 * AXIS_MARGIN)}%`;
}

/** The vertical place of the middle of a row, in pixels. */
function yOf(row: number): number {
  return row * ROW_HEIGHT + ROW_HEIGHT / 2;
}

/** The text of the tooltip of a dot: the title of the chat and the date of its last message. */
function dotTitle(chatId: string): string {
  const chat = chatById.value.get(chatId);
  if (chat === undefined) {
    return "";
  }
  return t("topicTimeline.dotTitle", { title: chat.title, date: new Date(lastMessageAt(chat)).toLocaleString() });
}

/** Opens the chat of a dot. */
function openChat(chatId: string): void {
  const chat = chatById.value.get(chatId);
  if (chat !== undefined) {
    emit("open", chat);
  }
}

/** A click on a topic keeps only its chats, and a second click shows every chat again. */
function toggleTopic(topic: string): void {
  selectedTopic.value = selectedTopic.value === topic ? null : topic;
}

/** The date of one end of the time axis, as a short date. */
function dateText(value: number | null): string {
  return value === null ? "" : new Date(value).toLocaleDateString();
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    emit("close");
  }
}

onMounted(() => window.addEventListener("keydown", onKeyDown, true));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeyDown, true));
</script>

<template>
  <div class="overlay" @mousedown.self="emit('close')">
    <dialog class="dialog dialog-lg dialog-instant dialog-nonmodal" open aria-labelledby="topic-timeline-title">
      <div class="dialog-header">
        <div id="topic-timeline-title" class="dialog-title me-auto" role="heading" aria-level="2">
          {{ t("topicTimeline.title") }}
        </div>
        <DialogCloseButton :title="t('topicTimeline.close')" :label="t('topicTimeline.close')" @click="emit('close')" />
      </div>
      <div class="dialog-body">
        <p v-if="layout.topics.length === 0" class="text-body-secondary mb-0">{{ t("topicTimeline.empty") }}</p>
        <template v-else>
          <p class="form-text mt-0">{{ t("topicTimeline.help") }}</p>
          <div class="timeline d-flex">
            <div class="timeline-topics d-flex flex-column" role="group" :aria-label="t('topicTimeline.topicsLabel')">
              <button
                v-for="(topic, row) in layout.topics"
                :key="topic"
                type="button"
                class="timeline-topic btn btn-sm text-truncate"
                :class="{ 'is-selected': selectedTopic === topic }"
                :aria-pressed="selectedTopic === topic"
                :title="
                  selectedTopic === topic
                    ? t('topicTimeline.topicAllTitle')
                    : t('topicTimeline.topicTitle', { topic, count: layout.chatCounts[row] })
                "
                @click="toggleTopic(topic)"
              >
                {{ topic }} <span class="text-body-secondary">{{ layout.chatCounts[row] }}</span>
              </button>
            </div>
            <div class="timeline-plot flex-fill">
              <svg
                class="d-block"
                width="100%"
                :height="layout.topics.length * ROW_HEIGHT"
                role="img"
                :aria-label="t('topicTimeline.plotLabel')"
              >
                <line
                  v-for="(topic, row) in layout.topics"
                  :key="`row-${topic}`"
                  class="row-guide"
                  x1="0"
                  x2="100%"
                  :y1="yOf(row)"
                  :y2="yOf(row)"
                />
                <line
                  v-for="line in layout.lines"
                  :key="`line-${line.chatId}`"
                  class="chat-line"
                  :class="{ 'is-dimmed': isDimmed(line.chatId) }"
                  :x1="xOf(line.x)"
                  :x2="xOf(line.x)"
                  :y1="yOf(line.topRow)"
                  :y2="yOf(line.bottomRow)"
                />
                <circle
                  v-for="dot in layout.dots"
                  :key="`dot-${dot.chatId}-${dot.row}`"
                  class="chat-dot"
                  :class="{ 'is-dimmed': isDimmed(dot.chatId) }"
                  :cx="xOf(dot.x)"
                  :cy="yOf(dot.row)"
                  :r="DOT_RADIUS"
                  role="button"
                  tabindex="0"
                  :aria-label="dotTitle(dot.chatId)"
                  @click="openChat(dot.chatId)"
                  @keydown.enter="openChat(dot.chatId)"
                >
                  <title>{{ dotTitle(dot.chatId) }}</title>
                </circle>
              </svg>
              <div class="timeline-axis d-flex justify-content-between form-text">
                <span>{{ dateText(layout.firstAt) }}</span>
                <span>{{ dateText(layout.lastAt) }}</span>
              </div>
            </div>
          </div>
        </template>
      </div>
    </dialog>
  </div>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; z-index: 59; background: var(--overlay); }
.timeline { gap: 8px; max-height: 60vh; overflow-y: auto; }
.timeline-topics { flex: 0 0 auto; max-width: 40%; }
.timeline-topic { height: 28px; justify-content: flex-start; border: 0; }
.timeline-topic.is-selected { background-color: var(--fg-body); color: var(--bg-body); }
.timeline-topic.is-selected .text-body-secondary { color: inherit !important; }
.timeline-plot { min-width: 0; }
.row-guide { stroke: var(--bg-2); }
.chat-line { stroke: var(--border-color); stroke-width: 2; }
.chat-dot { fill: var(--fg-body); cursor: pointer; }
.chat-dot:hover, .chat-dot:focus-visible { r: 7; outline: none; }
.is-dimmed { opacity: 0.12; }
</style>
