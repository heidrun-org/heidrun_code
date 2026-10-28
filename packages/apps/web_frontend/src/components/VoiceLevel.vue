<script setup lang="ts">
import { computed } from "vue";
import { LEVEL_COUNT } from "../stores/voice_input";
import { t } from "../i18n/index";

// The level bars (issue 662): a row of thin vertical bars that show how loud the voice was in the last two seconds. The newest
// level is on the right. A silent moment is a dot. The row always has the same number of bars, so the row does not grow.
// While Whisper transcribes (issue 820), the bars become flat dots, and one green sine wave goes across them, again and again.
// While the recording waits for Whisper, which works for another composition bar (issue 868), the sine wave is orange.
const props = defineProps<{
  /** The levels from 0 to 1, the newest last. There can be fewer than the bars: the bars on the left then stay dots. */
  levels: number[];
  /** Whisper changes the speech into text: the bars are flat, and the green sine wave goes across them. */
  isTranscribing?: boolean;
  /** The recording waits for Whisper: the bars are flat, and the orange sine wave goes across them. */
  isWaiting?: boolean;
}>();

/** The smallest and the largest height of a bar, in pixels. */
const DOT_HEIGHT_PX = 4;
const BAR_MAX_HEIGHT_PX = 36;

const heights = computed(() => {
  if (props.isTranscribing === true || props.isWaiting === true) {
    return new Array<number>(LEVEL_COUNT).fill(DOT_HEIGHT_PX);
  }
  const shown = props.levels.slice(-LEVEL_COUNT);
  const padding = new Array<number>(LEVEL_COUNT - shown.length).fill(0);
  return [...padding, ...shown].map((level) => {
    const clamped = Math.min(1, Math.max(0, level));
    return Math.round(DOT_HEIGHT_PX + clamped * (BAR_MAX_HEIGHT_PX - DOT_HEIGHT_PX));
  });
});
</script>

<template>
  <div
    class="voice-level d-flex align-items-center"
    :class="{ 'is-transcribing': isTranscribing === true, 'is-waiting': isTranscribing !== true && isWaiting === true }"
    role="img"
    :aria-label="t('voiceInput.levelLabel')"
  >
    <span v-for="(height, index) in heights" :key="index" class="bar" :style="{ height: `${height}px`, '--bar-index': index }"></span>
  </div>
</template>

<style scoped>
.voice-level { flex: 0 1 auto; min-width: 0; overflow: hidden; justify-content: flex-end; gap: 3px; height: 40px; color: var(--muted); }
.bar { flex: none; width: 4px; border-radius: 2px; background: currentColor; }

/*
 * The transcription (issue 820). The bars flatten to dots in 450 milliseconds. Then the sine wave goes across the dots from the
 * left to the right: the wave is 14 bars long and moves by one bar every 28 milliseconds, so each dot lights for 392 milliseconds
 * (19.6% of 2000 milliseconds). In this time the dot goes up 14 pixels, back to its place, down 14 pixels, and back to its place,
 * as one period of a sine. The wave crosses the 40 bars in 1512 milliseconds, then rests for about 500 milliseconds, then starts
 * again. Each quarter of the period has the easing of a sine. The wait for Whisper has the same animation in orange: the color
 * comes from the variable --wave-color, so the wave turns green without a jump when the transcription starts.
 */
.is-waiting .bar { --wave-color: var(--voice-wait); }
.is-transcribing .bar { --wave-color: var(--voice-wave); }
.is-waiting .bar, .is-transcribing .bar {
  transition: height 450ms cubic-bezier(0.42, 0, 0.58, 1);
  animation: voice-level-wave 2000ms linear infinite;
  animation-delay: calc(450ms + var(--bar-index) * 28ms);
}
@keyframes voice-level-wave {
  0% { transform: translateY(0); background-color: var(--wave-color); box-shadow: 0 0 6px var(--wave-color); animation-timing-function: cubic-bezier(0.39, 0.575, 0.565, 1); }
  4.9% { transform: translateY(-14px); background-color: var(--wave-color); box-shadow: 0 0 6px var(--wave-color); animation-timing-function: cubic-bezier(0.47, 0, 0.745, 0.715); }
  9.8% { transform: translateY(0); background-color: var(--wave-color); box-shadow: 0 0 6px var(--wave-color); animation-timing-function: cubic-bezier(0.39, 0.575, 0.565, 1); }
  14.7% { transform: translateY(14px); background-color: var(--wave-color); box-shadow: 0 0 6px var(--wave-color); animation-timing-function: cubic-bezier(0.47, 0, 0.745, 0.715); }
  19.6% { transform: translateY(0); background-color: var(--wave-color); box-shadow: 0 0 6px var(--wave-color); }
  19.7%, 100% { transform: translateY(0); background-color: currentColor; box-shadow: none; }
}
/* With "Reduce motion", the global rule stops every animation: the flat dots only turn orange, then green. */
@media (prefers-reduced-motion: reduce) {
  .is-waiting .bar, .is-transcribing .bar { background-color: var(--wave-color); }
}
</style>
