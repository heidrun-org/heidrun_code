<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { ChatImageHover } from "../stores/chat_image_hover";
import { ChatImages } from "../stores/chat_images";
import { ChatImagesFollower } from "../stores/chat_images_follower";
import { ChatImageLinks } from "../lib/chat_image_links";
import { t } from "../i18n/index";

const WIDTH = 360;
const EDGE = 8;
const GAP = 8;

const state = ChatImageHover.state;
const preview = ref<HTMLElement | null>(null);
const height = ref(0);
const windowWidth = ref(window.innerWidth);
const windowHeight = ref(window.innerHeight);
const width = computed(() => Math.max(0, Math.min(WIDTH, windowWidth.value - EDGE * 2)));
const spaceAbove = computed(() => state.y - GAP - EDGE);
const spaceBelow = computed(() => windowHeight.value - state.bottom - GAP - EDGE);
const isBelow = computed(() => spaceAbove.value < height.value && spaceBelow.value > spaceAbove.value);
const placeStyle = computed(() => {
  const left = Math.min(Math.max(state.x - width.value / 2, EDGE), windowWidth.value - width.value - EDGE);
  return {
    left: `${left}px`,
    top: `${isBelow.value ? state.bottom + GAP : state.y - GAP}px`,
    width: `${width.value}px`,
    "--arrow-x": `${state.x - left}px`,
    "--preview-max-height": `${Math.max(spaceAbove.value, spaceBelow.value)}px`,
  };
});

let observer: ResizeObserver | undefined;
watch(preview, (element) => {
  observer?.disconnect();
  if (element !== null) {
    height.value = element.getBoundingClientRect().height;
    observer = new ResizeObserver(() => {
      height.value = element.getBoundingClientRect().height;
    });
    observer.observe(element);
  }
}, { flush: "post" });

watch([() => ChatImagesFollower.state.paneId, () => ChatImages.state.sessionId], ChatImageHover.hide);
watch(() => ChatImages.state.viewerKey, (key) => {
  if (key !== null) {
    ChatImageHover.hide();
  }
});

function resize() {
  windowWidth.value = window.innerWidth;
  windowHeight.value = window.innerHeight;
  ChatImageHover.hide();
}

function openImage() {
  const image = state.image;
  if (image !== null && ChatImages.state.images.includes(image)) {
    ChatImages.openViewer(image.key);
  }
  ChatImageHover.hide();
}

onMounted(() => window.addEventListener("resize", resize));
onBeforeUnmount(() => {
  window.removeEventListener("resize", resize);
  observer?.disconnect();
  ChatImageHover.hide();
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="state.image !== null"
      ref="preview"
      class="chat-image-hover shadow"
      :class="{ below: isBelow }"
      :style="placeStyle"
      @mouseenter="ChatImageHover.keepOpen()"
      @mouseleave="ChatImageHover.hideSoon()"
      @focusin="ChatImageHover.keepOpen()"
      @focusout="ChatImageHover.hideSoon()"
      @keydown.esc.stop="ChatImageHover.hide()"
    >
      <button
        type="button"
        class="btn image-preview-action"
        :aria-label="t('chatImagesSection.openLarge') + ' · ' + ChatImageLinks.imageName(state.image)"
        @click="openImage"
      >
        <span class="preview-image">
          <img :src="state.image.source" alt="" />
        </span>
        <span class="mono">{{ ChatImageLinks.imageName(state.image) }}</span>
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.chat-image-hover {
  position: fixed;
  z-index: 59;
  transform: translateY(-100%);
  border-radius: 7px;
  background: var(--image-preview-bg);
  color: var(--on-solid);
}
.chat-image-hover.below { transform: none; }
/* The transparent strip keeps the preview open while the pointer crosses the arrow gap. */
.chat-image-hover::before {
  content: "";
  position: absolute;
  inset: 100% 0 auto;
  height: 8px;
}
.chat-image-hover.below::before { inset: auto 0 100%; }
.chat-image-hover::after {
  content: "";
  position: absolute;
  left: var(--arrow-x);
  top: 100%;
  width: 16px;
  height: 8px;
  transform: translateX(-50%);
  clip-path: polygon(0 0, 100% 0, 50% 100%);
  background: inherit;
  pointer-events: none;
}
.chat-image-hover.below::after {
  top: auto;
  bottom: 100%;
  clip-path: polygon(50% 0, 100% 100%, 0 100%);
}
.chat-image-hover .btn {
  height: auto;
  width: 100%;
  flex-direction: column;
  align-items: stretch;
  text-align: left;
  cursor: zoom-in;
}
.preview-image {
  width: 100%;
  max-height: min(260px, max(0px, calc(var(--preview-max-height) - 44px)));
  overflow: auto;
  scrollbar-width: none;
  border-radius: 4px;
}
.preview-image img { display: block; width: 100%; height: auto; }
.chat-image-hover .mono { font-size: var(--font-size); }
</style>
