<script setup lang="ts">
import { computed } from "vue";
import type { MireMessage } from "../../lib/mire/mire_model_types";
import { MireAnimations, mireAnimationState, type MireEffect } from "../../stores/mire/mire_animations";
import { mireIndex } from "../../stores/mire/mire_store";
import { MireMessageArcs, type MireNodePlace } from "./mire_message_arcs";
import { MireViewTexts } from "./mire_view_texts";
import { t } from "../../i18n/index";

// The short effects of the real transitions, over the radial graph: a single burst for a completion, a single red
// flash for a new blocked item, and the travel of a new message. A message travels only between two drawn nodes that
// its explicit identifiers resolve: a dashed arc while it is queued, a solid arc when it is received. A message with
// one end only shows a marker on that end. A name never links two nodes. The graph mounts this layer only while the
// animations run, and each effect leaves the store at the end of its own animation.

const props = defineProps<{
  /** The drawn coding agents and subagents, by node identifier. */
  places: Map<string, MireNodePlace>;
}>();

/** The angles of the sparks of a burst, in degrees. */
const SPARK_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

/** One effect that has a place in the graph. */
type DrawnEffect =
  | { effect: MireEffect; kind: "burst" | "flash"; place: MireNodePlace }
  | { effect: MireEffect; kind: "travel"; message: MireMessage; path: string; to: MireNodePlace; title: string }
  | { effect: MireEffect; kind: "end"; message: MireMessage; place: MireNodePlace; title: string };

const drawnEffects = computed<DrawnEffect[]>(() => {
  const drawn: DrawnEffect[] = [];
  for (const effect of mireAnimationState.effects) {
    if (effect.kind !== "message") {
      const place = props.places.get(effect.nodeId);
      if (place !== undefined) {
        drawn.push({ effect, kind: effect.kind === "completed" ? "burst" : "flash", place });
      }
      continue;
    }
    const message = effect.message;
    const from = placeOf(message.from.nodeId);
    const to = placeOf(message.to === null ? null : message.to.nodeId);
    const title = messageTitle(message);
    if (from !== undefined && to !== undefined && message.from.nodeId !== message.to?.nodeId) {
      drawn.push({ effect, kind: "travel", message, path: MireMessageArcs.path(from, to), to, title });
      continue;
    }
    const place = from ?? to;
    if (place !== undefined) {
      drawn.push({ effect, kind: "end", message, place, title });
    }
  }
  return drawn;
});

function placeOf(nodeId: string | null): MireNodePlace | undefined {
  return nodeId === null ? undefined : props.places.get(nodeId);
}

function messageTitle(message: MireMessage): string {
  return t("mire.animation.messageTitle", {
    from: MireViewTexts.endpointName(message.from, mireIndex.value),
    to: MireViewTexts.endpointName(message.to, mireIndex.value),
    delivery: t(`mire.messages.delivery.${message.delivery}`),
    text: MireViewTexts.messageText(message),
  });
}

function onAnimationEnd(effectId: string) {
  MireAnimations.removeEffect(effectId);
}
</script>

<template>
  <g class="mire-effects">
    <template v-for="drawn in drawnEffects" :key="drawn.effect.id">
      <g
        v-if="drawn.kind === 'burst' || drawn.kind === 'flash'"
        class="mire-effect"
        :class="drawn.kind === 'burst' ? 'mire-burst' : 'mire-flash'"
        :transform="`translate(${drawn.place.x} ${drawn.place.y})`"
        :data-effect="drawn.kind"
        :data-effect-node-id="drawn.effect.kind === 'message' ? undefined : drawn.effect.nodeId"
        aria-hidden="true"
        @animationend.self="onAnimationEnd(drawn.effect.id)"
      >
        <circle class="mire-effect-ring" r="12" />
        <g v-if="drawn.kind === 'burst'" class="mire-burst-sparks">
          <line
            v-for="angle in SPARK_ANGLES"
            :key="angle"
            :x1="Math.cos((angle * Math.PI) / 180) * 15"
            :y1="Math.sin((angle * Math.PI) / 180) * 15"
            :x2="Math.cos((angle * Math.PI) / 180) * 22"
            :y2="Math.sin((angle * Math.PI) / 180) * 22"
          />
        </g>
      </g>
      <g
        v-else-if="drawn.kind === 'travel'"
        class="mire-effect mire-message"
        :class="`mire-delivery-${drawn.message.delivery}`"
        data-effect="travel"
        :data-delivery="drawn.message.delivery"
        @animationend.self="onAnimationEnd(drawn.effect.id)"
      >
        <title>{{ drawn.title }}</title>
        <path class="mire-message-arc" :d="drawn.path" />
        <path class="mire-message-comet" :d="drawn.path" pathLength="100" />
        <circle
          v-if="drawn.message.delivery === 'received'"
          class="mire-message-arrival"
          :cx="drawn.to.x"
          :cy="drawn.to.y"
          r="16"
          data-arrival
        />
      </g>
      <g
        v-else-if="drawn.kind === 'end'"
        class="mire-effect mire-message mire-message-end"
        :class="`mire-delivery-${drawn.message.delivery}`"
        :transform="`translate(${drawn.place.x} ${drawn.place.y})`"
        data-effect="end"
        :data-delivery="drawn.message.delivery"
        @animationend.self="onAnimationEnd(drawn.effect.id)"
      >
        <title>{{ drawn.title }}</title>
        <circle class="mire-message-end-ring" r="18" />
        <text class="mire-message-end-sign" font-size="11" x="0" y="-22" text-anchor="middle">?</text>
      </g>
    </template>
  </g>
</template>

<style scoped>
/* The colors come from the theme variables of styles.css. A message is not a status, so it uses the color of the
   focus, not one of the four status colors. */
.mire-effects { pointer-events: none; }
.mire-effects .mire-message { pointer-events: visiblePainted; }
.mire-effect { animation: mire-effect-life 1.4s ease-out forwards; }
.mire-message { animation-duration: 2.6s; }

.mire-effect-ring {
  fill: none;
  stroke-width: 3;
  transform-box: fill-box;
  transform-origin: center;
  animation: mire-effect-grow 1.4s ease-out forwards;
}
.mire-burst .mire-effect-ring { stroke: var(--done); }
.mire-flash .mire-effect-ring { stroke: var(--blocked); }
.mire-burst-sparks {
  transform-box: fill-box;
  transform-origin: center;
  animation: mire-effect-grow 1.4s ease-out forwards;
}
.mire-burst-sparks line { stroke: var(--done); stroke-width: 2.5; stroke-linecap: round; }

.mire-message-arc { fill: none; stroke: var(--focus); stroke-width: 1.5; stroke-opacity: 0.75; }
.mire-delivery-queued .mire-message-arc { stroke-dasharray: 6 5; }
.mire-delivery-failed .mire-message-arc,
.mire-delivery-unknown .mire-message-arc { stroke-dasharray: 1 5; stroke-linecap: round; }
.mire-message-comet {
  fill: none;
  stroke: var(--focus);
  stroke-width: 5;
  stroke-linecap: round;
  stroke-dasharray: 6 194;
  stroke-dashoffset: 6;
  animation: mire-comet 1.6s ease-in-out forwards;
}
.mire-delivery-failed .mire-message-comet { stroke: var(--muted); animation-name: mire-comet-stops; }
.mire-message-arrival {
  fill: none;
  stroke: var(--focus);
  stroke-width: 3;
  opacity: 0;
  transform-box: fill-box;
  transform-origin: center;
  animation: mire-arrival 0.9s ease-out 1.5s forwards;
}
.mire-message-end-ring {
  fill: none;
  stroke: var(--focus);
  stroke-width: 2;
  stroke-dasharray: 3 3;
  transform-box: fill-box;
  transform-origin: center;
  animation: mire-effect-grow 2.6s ease-out forwards;
}
.mire-message-end-sign { fill: var(--focus); font-weight: 700; paint-order: stroke; stroke: var(--bg); stroke-width: 3px; }

@keyframes mire-effect-life {
  0%, 70% { opacity: 1; }
  100% { opacity: 0; }
}
@keyframes mire-effect-grow {
  from { transform: scale(0.5); }
  to { transform: scale(1.7); }
}
@keyframes mire-comet {
  from { stroke-dashoffset: 6; }
  to { stroke-dashoffset: -100; }
}
@keyframes mire-comet-stops {
  from { stroke-dashoffset: 6; }
  to { stroke-dashoffset: -50; }
}
@keyframes mire-arrival {
  0% { opacity: 1; transform: scale(0.6); }
  100% { opacity: 0; transform: scale(1.6); }
}
</style>
