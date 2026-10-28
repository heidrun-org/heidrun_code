<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import splashImage from "../assets/heidrun_splash_screen.jpg";
import { isSplashScreenDisabled, showMainWindow } from "../lib/api";
import { playNextGoatBleat } from "../lib/goat_sounds";
import { t } from "../i18n/index";
import Icon from "./Icon.vue";

const DISPLAY_DURATION_MS = 3000;
const MOTTO_PATH_ID = "splash-motto-path";
/** The distance between the bottom edge of the screen and the lowest point of the line of the motto. */
const MOTTO_LOWEST_POINT_FROM_BOTTOM_PX = 72;
/** The radius of the circle that the motto follows. A larger radius gives a flatter curve. */
const MOTTO_CIRCLE_RADIUS_PX = 1800;

/** False until Heidrun Code tells if it was started with `--no-splash-screen`. The main window is hidden until then. */
const isVisible = ref(false);
const screenWidth = ref(window.innerWidth);
const screenHeight = ref(window.innerHeight);

/**
 * The line that the motto follows: the lower half of a circle. The center of the circle is in the middle of the screen,
 * above the top edge, so the motto bends like a smile. The middle of the motto is the lowest point of the circle.
 * The radius is the same for every size of the screen, so the curve of the motto never changes.
 */
const mottoPath = computed(() => {
  const radius = MOTTO_CIRCLE_RADIUS_PX;
  const centerX = screenWidth.value / 2;
  const centerY = screenHeight.value - MOTTO_LOWEST_POINT_FROM_BOTTOM_PX - radius;
  return `M ${centerX - radius} ${centerY} A ${radius} ${radius} 0 0 0 ${centerX + radius} ${centerY}`;
});

function measureScreen() {
  screenWidth.value = window.innerWidth;
  screenHeight.value = window.innerHeight;
}

onMounted(async () => {
  window.addEventListener("resize", measureScreen);
  let isDisabled = false;
  try {
    isDisabled = await isSplashScreenDisabled();
  } catch {
    // Outside Heidrun Code (a plain browser), there is no command line option, so the splash screen shows.
  }
  if (isDisabled) {
    await showMainWindowIfPossible();
    return;
  }
  isVisible.value = true;
});

onUnmounted(() => {
  window.removeEventListener("resize", measureScreen);
});

function close() {
  isVisible.value = false;
}

async function showMainWindowIfPossible() {
  try {
    await showMainWindow();
  } catch {
    // Outside Heidrun Code (a plain browser), there is no window to show.
  }
}

/**
 * Called when the splash image is loaded, or when it failed to load. The main window is created hidden, so this is
 * the moment the user sees it: the image is decoded first, so the first frame of the window already holds the image.
 * The display time starts here, because the user could not see the splash screen before.
 */
async function onImageSettled(event: Event) {
  try {
    await (event.target as HTMLImageElement).decode();
  } catch {
    // An image that cannot be decoded must not keep the window hidden.
  }
  await showMainWindowIfPossible();
  window.setTimeout(close, DISPLAY_DURATION_MS);
}
</script>

<template>
  <Transition name="splash">
    <div v-if="isVisible" class="splash" @click="close">
      <img class="splash-image" :src="splashImage" alt="" @load="onImageSettled" @error="onImageSettled" />
      <div class="splash-text">
        <h1 class="splash-title">{{ t("identity.title") }}</h1>
      </div>
      <svg class="splash-motto-arc" :width="screenWidth" :height="screenHeight">
        <defs>
          <path :id="MOTTO_PATH_ID" :d="mottoPath" />
        </defs>
        <text class="splash-motto" text-anchor="middle">
          <textPath :href="`#${MOTTO_PATH_ID}`" startOffset="50%">{{ t("identity.motto") }}</textPath>
        </text>
      </svg>
      <button class="btn lg splash-sound-button" type="button" @click.stop="playNextGoatBleat">
        <Icon name="volume-up" /> {{ t("splashScreen.playGoatSound") }}
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.splash {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: var(--illustration-bg);
  cursor: pointer;
}
.splash-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 30%;
}
.splash-text {
  position: relative;
  width: 100%;
  padding: 120px 24px 124px;
  text-align: center;
  color: var(--illustration-text);
  background: linear-gradient(to top, var(--illustration-caption), var(--illustration-fade));
  text-shadow: 0 2px 12px var(--illustration-shadow);
}
.splash-title {
  margin: 0;
  font-size: 128px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--illustration-accent);
}
.splash-motto-arc {
  position: absolute;
  inset: 0;
  filter: drop-shadow(0 2px 6px var(--illustration-shadow));
}
.splash-motto {
  font-size: 52px;
  font-weight: 500;
  fill: var(--illustration-text);
}
.splash .splash-sound-button { position: absolute; right: 24px; bottom: 24px; }
.splash-leave-active {
  transition: opacity 0.6s ease;
}
.splash-leave-to {
  opacity: 0;
}
</style>
