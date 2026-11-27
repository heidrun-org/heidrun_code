<script setup lang="ts">
import { onMounted } from "vue";
import { ChatImages } from "../stores/chat_images";
import { ChatImagesFollower } from "../stores/chat_images_follower";
import { ChatImageLinks } from "../lib/chat_image_links";
import { t } from "../i18n/index";

// The image behind each text [Image #N] of the chat of the selected pane, at the bottom of the Clipboard sidebar section.
// Issues: https://github.com/heidrun-org/heidrun_code/issues/790 and https://github.com/heidrun-org/heidrun_code/issues/924

const imageName = ChatImageLinks.imageName;

const state = ChatImages.state;
const followed = ChatImagesFollower.state;
onMounted(() => ChatImagesFollower.start());
</script>

<template>
  <section class="chat-images d-flex flex-column gap-2 border-top pt-2" :aria-label="t('chatImagesSection.title')">
    <h3 class="fw-semibold m-0">{{ t("chatImagesSection.title") }}</h3>
    <p v-if="followed.sessionId === null" class="empty text-body-secondary m-0">{{ t("chatImagesSection.noChat") }}</p>
    <p v-else-if="state.error !== ''" class="empty text-danger-emphasis m-0">{{ t("chatImagesSection.failed", { error: state.error }) }}</p>
    <p v-else-if="state.images.length === 0" class="empty text-body-secondary m-0">{{ t("chatImagesSection.noImage") }}</p>
    <ul v-else class="images">
      <li v-for="image in state.images" :key="image.key">
        <button
          class="btn thumbnail d-flex flex-column gap-1 p-2"
          :title="t('chatImagesSection.openLarge')"
          @click="ChatImages.openViewer(image.key)"
        >
          <img :src="image.source" :alt="imageName(image)" />
          <span class="mono label">{{ t("chatImagesSection.imageName", { number: image.number }) }}</span>
          <span v-if="image.message !== null" class="label small text-body-secondary">{{ t("chatImagesSection.messageName", { message: image.message }) }}</span>
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
h3, .empty, .mono { font-size: var(--font-size); }
/* The part sits at the bottom of the column of the Clipboard sidebar section, below the notes. */
.chat-images { margin-top: auto; }
.empty { line-height: 1.6; }
/* A grid of thumbnails that fills the width of the sidebar: Bootstrap has no utility class for it. */
.images { display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 8px; margin: 0; padding: 0; list-style: none; }
.thumbnail { width: 100%; height: auto; min-width: 0; }
/* A label longer than the thumbnail ends with an ellipsis instead of covering the next thumbnail. */
.label { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.images img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 6px; background: var(--bg); }
</style>
