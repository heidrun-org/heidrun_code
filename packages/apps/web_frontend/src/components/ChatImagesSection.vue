<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import Icon from "./Icon.vue";
import { ChatImages } from "../stores/chat_images";
import { selectedPane } from "../stores/session";
import { t } from "../i18n/index";

// The image behind each text [Image #N] of the chat of the selected pane, at the bottom of the Clipboard sidebar section.
// Issue: https://github.com/heidrun-org/heidrun_code/issues/790

/** The shortest time between two reads of the images, in milliseconds: the status line of Claude Code reports often. */
const READ_INTERVAL_MILLISECONDS = 2000;

const state = ChatImages.state;
const sessionId = computed(() => selectedPane.value?.tokens?.hd_sid ?? null);
// The status line of Claude Code writes a new time after each change of the chat.
const reportTime = computed(() => selectedPane.value?.tokens?.hd_ts ?? "");
const viewerImage = computed(() => state.images.find((image) => image.number === state.viewerNumber) ?? null);
const viewerPosition = computed(() => state.images.findIndex((image) => image.number === state.viewerNumber) + 1);
const viewer = ref<HTMLElement | null>(null);

let lastReadAt = 0;
let timer: ReturnType<typeof setTimeout> | null = null;

function readSoon() {
  if (timer !== null) {
    return;
  }
  const wait = Math.max(0, lastReadAt + READ_INTERVAL_MILLISECONDS - Date.now());
  timer = setTimeout(() => {
    timer = null;
    lastReadAt = Date.now();
    void ChatImages.load(sessionId.value);
  }, wait);
}

watch(sessionId, (current) => {
  // A new chat shows at once, without the images of the chat before.
  void ChatImages.load(current);
  lastReadAt = Date.now();
});
watch(reportTime, () => readSoon());

// A key of the big view never reaches the terminal or the shortcuts of the window.
function onKey(event: KeyboardEvent) {
  if (state.viewerNumber === null) {
    return;
  }
  const actions: Record<string, () => void> = {
    ArrowLeft: () => ChatImages.moveViewer(-1),
    ArrowRight: () => ChatImages.moveViewer(1),
    Escape: () => ChatImages.closeViewer(),
  };
  const action = actions[event.key];
  if (action === undefined) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  action();
}

watch(viewer, (element) => element?.focus());

onMounted(() => {
  window.addEventListener("keydown", onKey, true);
  lastReadAt = Date.now();
  void ChatImages.load(sessionId.value);
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKey, true);
  if (timer !== null) {
    clearTimeout(timer);
  }
  ChatImages.closeViewer();
});
</script>

<template>
  <section class="chat-images d-flex flex-column gap-2 border-top pt-2" :aria-label="t('chatImagesSection.title')">
    <h3 class="fw-semibold m-0">{{ t("chatImagesSection.title") }}</h3>
    <p v-if="sessionId === null" class="empty text-body-secondary m-0">{{ t("chatImagesSection.noChat") }}</p>
    <p v-else-if="state.error !== ''" class="empty text-danger-emphasis m-0">{{ t("chatImagesSection.failed", { error: state.error }) }}</p>
    <p v-else-if="state.images.length === 0" class="empty text-body-secondary m-0">{{ t("chatImagesSection.noImage") }}</p>
    <ul v-else class="images">
      <li v-for="image in state.images" :key="image.number">
        <button
          class="btn thumbnail d-flex flex-column gap-1 p-2"
          :title="t('chatImagesSection.openLarge')"
          @click="ChatImages.openViewer(image.number)"
        >
          <img :src="image.source" :alt="t('chatImagesSection.imageName', { number: image.number })" />
          <span class="mono">{{ t("chatImagesSection.imageName", { number: image.number }) }}</span>
        </button>
      </li>
    </ul>

    <Teleport to="body">
      <div
        v-if="viewerImage !== null"
        ref="viewer"
        class="overlay"
        tabindex="-1"
        role="dialog"
        :aria-label="t('chatImagesSection.viewerLabel')"
        @mousedown.self="ChatImages.closeViewer()"
      >
        <button class="btn icon image-action close" :aria-label="t('chatImagesSection.close')" :title="t('chatImagesSection.close')" @click="ChatImages.closeViewer()">
          <Icon name="x-lg" />
        </button>
        <button v-if="state.images.length > 1" class="btn icon lg image-action arrow" :aria-label="t('chatImagesSection.previous')" @click="ChatImages.moveViewer(-1)">
          <Icon name="chevron-left" />
        </button>
        <figure class="stage" @mousedown.self="ChatImages.closeViewer()">
          <img :src="viewerImage.source" :alt="t('chatImagesSection.imageName', { number: viewerImage.number })" />
          <figcaption>
            <span class="mono">{{ t("chatImagesSection.imageName", { number: viewerImage.number }) }}</span>
            <span class="position">{{ t("chatImagesSection.position", { position: viewerPosition, total: state.images.length }) }}</span>
          </figcaption>
        </figure>
        <button v-if="state.images.length > 1" class="btn icon lg image-action arrow" :aria-label="t('chatImagesSection.next')" @click="ChatImages.moveViewer(1)">
          <Icon name="chevron-right" />
        </button>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
h3, .empty, .mono { font-size: var(--font-size); }
/* The part sits at the bottom of the column of the Clipboard sidebar section, below the notes. */
.chat-images { margin-top: auto; }
.empty { line-height: 1.6; }
/* A grid of thumbnails that fills the width of the sidebar: Bootstrap has no utility class for it. */
.images { display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 8px; margin: 0; padding: 0; list-style: none; }
.thumbnail { width: 100%; height: auto; }
.images img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 6px; background: var(--bg); }
.overlay { position: fixed; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center; gap: 12px; padding: 28px; background: var(--overlay-heavy); outline: none; }
.stage { flex: 1; min-width: 0; max-height: 100%; margin: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; }
.stage img { max-width: 100%; max-height: calc(100vh - 110px); object-fit: contain; border-radius: 6px; background: var(--field); }
figcaption { display: flex; gap: 12px; color: var(--text-2); font-size: var(--font-size); }
.position { color: var(--muted); font-variant-numeric: tabular-nums; }
.arrow, .close { display: flex; align-items: center; justify-content: center; cursor: pointer; }
.arrow { flex: none; }
.close { position: absolute; top: 14px; right: 14px; }
</style>
