<script setup lang="ts">
import { computed } from "vue";
import { ChatImageHover } from "../stores/chat_image_hover";
import { ChatImageLinks } from "../lib/chat_image_links";

// The image behind a text [Image #N] of a terminal, shown above the pointer while the pointer is over the text.
// Issue: https://github.com/heidrun-org/heidrun_code/issues/924

/** Half the widest image, in pixels: the image never leaves the window on the left or on the right. */
const HALF_WIDTH = 180;

/** Below this distance from the top of the window, in pixels, the image shows below the pointer instead of above it. */
const SPACE_ABOVE = 300;

const state = ChatImageHover.state;
const placeStyle = computed(() => {
  const left = Math.min(Math.max(state.x, HALF_WIDTH + 8), window.innerWidth - HALF_WIDTH - 8);
  const isBelow = state.y < SPACE_ABOVE;
  return {
    left: `${left}px`,
    top: `${state.y}px`,
    transform: isBelow ? "translate(-50%, 20px)" : "translate(-50%, calc(-100% - 12px))",
  };
});
</script>

<template>
  <Teleport to="body">
    <figure v-if="state.image !== null" class="chat-image-hover card shadow d-flex flex-column gap-1 p-2 m-0" :style="placeStyle">
      <img :src="state.image.source" :alt="ChatImageLinks.imageName(state.image)" />
      <figcaption class="mono text-body-secondary">{{ ChatImageLinks.imageName(state.image) }}</figcaption>
    </figure>
  </Teleport>
</template>

<style scoped>
/* A floating image above the terminal: Bootstrap has no component that follows the pointer. */
.chat-image-hover { position: fixed; z-index: 70; max-width: 360px; pointer-events: none; }
.chat-image-hover img { max-width: 344px; max-height: 260px; object-fit: contain; border-radius: 6px; background: var(--bg); }
figcaption { font-size: var(--font-size); }
</style>
