<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import Icon from "./Icon.vue";
import { ImageDrop } from "../lib/image_drop";
import { CompositionBar } from '../stores/composition_bar';
import { t } from "../i18n/index";

// The big view of images in one pane's composition bar, with the buttons and the keys left and right.
// Issue: https://github.com/heidrun-org/heidrun/issues/712
const props = defineProps<{ paneId: string }>();
const compositionBar = computed(() => CompositionBar.forPane(props.paneId));
const path = computed(() => {
  if (compositionBar.value.viewerIndex === null) {
    return null;
  }
  return compositionBar.value.paths[compositionBar.value.viewerIndex] ?? null;
});
const count = computed(() => compositionBar.value.paths.length);
const picture = computed(() => {
  if (path.value === null) {
    return "";
  }
  return compositionBar.value.previews[path.value] || compositionBar.value.thumbnails[path.value] || "";
});
const isLoaded = computed(() => path.value !== null && path.value in compositionBar.value.previews);
const isFailed = computed(
  () => path.value !== null && isLoaded.value && compositionBar.value.previews[path.value] === "",
);
const fileName = computed(() => (path.value === null ? "" : path.value.slice(path.value.lastIndexOf("/") + 1)));
const root = ref<HTMLElement | null>(null);

// The large picture is made when the big view reaches the image, and kept for the next visit.
watch(
  path,
  (current) => {
    if (current !== null && current in compositionBar.value.previews === false) {
      void ImageDrop.loadPreview(props.paneId, current);
    }
  },
  { immediate: true },
);

// A key of the big view never reaches the terminal, the composition bar, or the shortcuts of the window.
function onKey(event: KeyboardEvent) {
  const actions: Record<string, () => void> = {
    ArrowLeft: () => ImageDrop.moveViewer(props.paneId, -1),
    ArrowRight: () => ImageDrop.moveViewer(props.paneId, 1),
    Escape: () => ImageDrop.closeViewer(props.paneId),
  };
  const action = actions[event.key];
  if (action === undefined) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  action();
}
onMounted(() => {
  window.addEventListener("keydown", onKey, true);
  root.value?.focus();
});
onBeforeUnmount(() => window.removeEventListener("keydown", onKey, true));
</script>

<template>
  <div
    ref="root"
    class="overlay"
    tabindex="-1"
    role="dialog"
    :aria-label="t('imageViewer.label')"
    @mousedown.self="ImageDrop.closeViewer(props.paneId)"
  >
    <button
      class="btn icon image-action close"
      :aria-label="t('imageViewer.close')"
      :title="t('imageViewer.close')"
      @click="ImageDrop.closeViewer(props.paneId)"
    >
      <Icon name="x-lg" />
    </button>
    <button
      v-if="count > 1"
      class="btn icon lg image-action arrow previous"
      :aria-label="t('imageViewer.previous')"
      @click="ImageDrop.moveViewer(props.paneId, -1)"
    >
      <Icon name="chevron-left" />
    </button>
    <figure class="stage" @mousedown.self="ImageDrop.closeViewer(props.paneId)">
      <img v-if="picture" :src="picture" :alt="fileName" />
      <p v-else-if="isFailed" class="message">{{ t("imageViewer.failed") }}</p>
      <p v-else class="message">{{ t("imageViewer.loading") }}</p>
      <figcaption class="badge image-viewer-caption">
        <span class="name">{{ fileName }}</span>
        <span class="position">{{ t("imageViewer.position", { position: (compositionBar.viewerIndex ?? 0) + 1, total: count }) }}</span>
      </figcaption>
    </figure>
    <button
      v-if="count > 1"
      class="btn icon lg image-action arrow next"
      :aria-label="t('imageViewer.next')"
      @click="ImageDrop.moveViewer(props.paneId, 1)"
    >
      <Icon name="chevron-right" />
    </button>
  </div>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center; gap: 12px; padding: 28px; background: var(--overlay-heavy); outline: none; }
.stage { flex: 1; min-width: 0; max-height: 100%; margin: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; }
.stage img { max-width: 100%; max-height: calc(100vh - 110px); object-fit: contain; border-radius: 6px; background: var(--field); }
.message { color: var(--muted); }
.arrow, .close { display: flex; align-items: center; justify-content: center; cursor: pointer; }
.arrow { flex: none; }
.close { position: absolute; top: 14px; right: 14px; }
</style>
