<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import Icon from "./Icon.vue";
import { ChatImages } from "../stores/chat_images";
import { ChatImageLinks } from "../lib/chat_image_links";
import { t } from "../i18n/index";

const imageName = ChatImageLinks.imageName;
const state = ChatImages.state;
const viewerImage = computed(() => state.images.find((image) => image.key === state.viewerKey) ?? null);
const viewerPosition = computed(() => state.images.findIndex((image) => image.key === state.viewerKey) + 1);
const viewer = ref<HTMLElement | null>(null);

// A key of the big view never reaches the terminal or the shortcuts of the window.
function onKey(event: KeyboardEvent) {
  if (viewerImage.value === null) {
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
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKey, true);
  ChatImages.closeViewer();
});
</script>

<template>
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
        <img :src="viewerImage.source" :alt="imageName(viewerImage)" />
        <figcaption>
          <span class="mono">{{ imageName(viewerImage) }}</span>
          <span class="position">{{ t("chatImagesSection.position", { position: viewerPosition, total: state.images.length }) }}</span>
        </figcaption>
      </figure>
      <button v-if="state.images.length > 1" class="btn icon lg image-action arrow" :aria-label="t('chatImagesSection.next')" @click="ChatImages.moveViewer(1)">
        <Icon name="chevron-right" />
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center; gap: 12px; padding: 28px; background: var(--overlay-heavy); outline: none; }
.stage { flex: 1; min-width: 0; max-height: 100%; margin: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; }
.stage img {
  width: 85vw;
  max-width: 100%;
  height: 85vh;
  max-height: calc(100vh - 90px);
  flex: none;
  object-fit: contain;
}
.mono { font-size: var(--font-size); }
figcaption { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 12px; color: var(--text-2); font-size: var(--font-size); }
.position { color: var(--muted); font-variant-numeric: tabular-nums; }
.arrow, .close { display: flex; align-items: center; justify-content: center; cursor: pointer; }
.arrow { flex: none; }
.close { position: absolute; top: 14px; right: 14px; }
</style>
