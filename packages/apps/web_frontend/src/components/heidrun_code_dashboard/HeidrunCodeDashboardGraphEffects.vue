<script setup lang="ts">
import { computed } from "vue";
import type { HeidrunCodeDashboardMessage } from "../../lib/heidrun_code_dashboard/heidrun_code_dashboard_model_types";
import { HeidrunCodeDashboardAnimations, heidrunCodeDashboardAnimationState, type HeidrunCodeDashboardEffect } from "../../stores/heidrun_code_dashboard/heidrun_code_dashboard_animations";
import { heidrunCodeDashboardIndex } from "../../stores/heidrun_code_dashboard/heidrun_code_dashboard_store";
import { HeidrunCodeDashboardMessageArcs, type HeidrunCodeDashboardNodePlace } from "./heidrun_code_dashboard_message_arcs";
import { HeidrunCodeDashboardViewTexts } from "./heidrun_code_dashboard_view_texts";
import { t } from "../../i18n/index";

// The short effects of the real transitions, over the radial graph: a single burst for a completion, a single red
// flash for a new blocked item, and the travel of a new message. A message travels only between two drawn nodes that
// its explicit identifiers resolve: a dashed arc while it is queued, a solid arc when it is received. A message with
// one end only shows a marker on that end. A name never links two nodes. The graph mounts this layer only while the
// animations run, and each effect leaves the store at the end of its own animation.

const props = defineProps<{
  /** The drawn coding agents and subagents, by node identifier. */
  places: Map<string, HeidrunCodeDashboardNodePlace>;
}>();

/** The angles of the sparks of a burst, in degrees. */
const SPARK_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

/** One effect that has a place in the graph. */
type DrawnEffect =
  | { effect: HeidrunCodeDashboardEffect; kind: "burst" | "flash"; place: HeidrunCodeDashboardNodePlace }
  | { effect: HeidrunCodeDashboardEffect; kind: "travel"; message: HeidrunCodeDashboardMessage; path: string; to: HeidrunCodeDashboardNodePlace; title: string }
  | { effect: HeidrunCodeDashboardEffect; kind: "end"; message: HeidrunCodeDashboardMessage; place: HeidrunCodeDashboardNodePlace; title: string };

const drawnEffects = computed<DrawnEffect[]>(() => {
  const drawn: DrawnEffect[] = [];
  for (const effect of heidrunCodeDashboardAnimationState.effects) {
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
      drawn.push({ effect, kind: "travel", message, path: HeidrunCodeDashboardMessageArcs.path(from, to), to, title });
      continue;
    }
    const place = from ?? to;
    if (place !== undefined) {
      drawn.push({ effect, kind: "end", message, place, title });
    }
  }
  return drawn;
});

function placeOf(nodeId: string | null): HeidrunCodeDashboardNodePlace | undefined {
  return nodeId === null ? undefined : props.places.get(nodeId);
}

function messageTitle(message: HeidrunCodeDashboardMessage): string {
  return t("heidrunCodeDashboard.animation.messageTitle", {
    from: HeidrunCodeDashboardViewTexts.endpointName(message.from, heidrunCodeDashboardIndex.value),
    to: HeidrunCodeDashboardViewTexts.endpointName(message.to, heidrunCodeDashboardIndex.value),
    delivery: t(`heidrunCodeDashboard.messages.delivery.${message.delivery}`),
    text: HeidrunCodeDashboardViewTexts.messageText(message),
  });
}

function onAnimationEnd(effectId: string) {
  HeidrunCodeDashboardAnimations.removeEffect(effectId);
}
</script>

<template>
  <g class="heidrun-code-dashboard-effects">
    <template v-for="drawn in drawnEffects" :key="drawn.effect.id">
      <g
        v-if="drawn.kind === 'burst' || drawn.kind === 'flash'"
        class="heidrun-code-dashboard-effect"
        :class="drawn.kind === 'burst' ? 'heidrun-code-dashboard-burst' : 'heidrun-code-dashboard-flash'"
        :transform="`translate(${drawn.place.x} ${drawn.place.y})`"
        :data-effect="drawn.kind"
        :data-effect-node-id="drawn.effect.kind === 'message' ? undefined : drawn.effect.nodeId"
        aria-hidden="true"
        @animationend.self="onAnimationEnd(drawn.effect.id)"
      >
        <circle class="heidrun-code-dashboard-effect-ring" r="12" />
        <g v-if="drawn.kind === 'burst'" class="heidrun-code-dashboard-burst-sparks">
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
        class="heidrun-code-dashboard-effect heidrun-code-dashboard-message"
        :class="`heidrun-code-dashboard-delivery-${drawn.message.delivery}`"
        data-effect="travel"
        :data-delivery="drawn.message.delivery"
        @animationend.self="onAnimationEnd(drawn.effect.id)"
      >
        <title>{{ drawn.title }}</title>
        <path class="heidrun-code-dashboard-message-arc" :d="drawn.path" />
        <path class="heidrun-code-dashboard-message-comet" :d="drawn.path" pathLength="100" />
        <circle
          v-if="drawn.message.delivery === 'received'"
          class="heidrun-code-dashboard-message-arrival"
          :cx="drawn.to.x"
          :cy="drawn.to.y"
          r="16"
          data-arrival
        />
      </g>
      <g
        v-else-if="drawn.kind === 'end'"
        class="heidrun-code-dashboard-effect heidrun-code-dashboard-message heidrun-code-dashboard-message-end"
        :class="`heidrun-code-dashboard-delivery-${drawn.message.delivery}`"
        :transform="`translate(${drawn.place.x} ${drawn.place.y})`"
        data-effect="end"
        :data-delivery="drawn.message.delivery"
        @animationend.self="onAnimationEnd(drawn.effect.id)"
      >
        <title>{{ drawn.title }}</title>
        <circle class="heidrun-code-dashboard-message-end-ring" r="18" />
        <text class="heidrun-code-dashboard-message-end-sign" font-size="11" x="0" y="-22" text-anchor="middle">?</text>
      </g>
    </template>
  </g>
</template>

<style scoped>
/* The colors come from the theme variables of styles.css. A message is not a status, so it uses the color of the
   focus, not one of the four status colors. */
.heidrun-code-dashboard-effects { pointer-events: none; }
.heidrun-code-dashboard-effects .heidrun-code-dashboard-message { pointer-events: visiblePainted; }
.heidrun-code-dashboard-effect { animation: heidrun-code-dashboard-effect-life 1.4s ease-out forwards; }
.heidrun-code-dashboard-message { animation-duration: 2.6s; }

.heidrun-code-dashboard-effect-ring {
  fill: none;
  stroke-width: 3;
  transform-box: fill-box;
  transform-origin: center;
  animation: heidrun-code-dashboard-effect-grow 1.4s ease-out forwards;
}
.heidrun-code-dashboard-burst .heidrun-code-dashboard-effect-ring { stroke: var(--done); }
.heidrun-code-dashboard-flash .heidrun-code-dashboard-effect-ring { stroke: var(--blocked); }
.heidrun-code-dashboard-burst-sparks {
  transform-box: fill-box;
  transform-origin: center;
  animation: heidrun-code-dashboard-effect-grow 1.4s ease-out forwards;
}
.heidrun-code-dashboard-burst-sparks line { stroke: var(--done); stroke-width: 2.5; stroke-linecap: round; }

.heidrun-code-dashboard-message-arc { fill: none; stroke: var(--focus); stroke-width: 1.5; stroke-opacity: 0.75; }
.heidrun-code-dashboard-delivery-queued .heidrun-code-dashboard-message-arc { stroke-dasharray: 6 5; }
.heidrun-code-dashboard-delivery-failed .heidrun-code-dashboard-message-arc,
.heidrun-code-dashboard-delivery-unknown .heidrun-code-dashboard-message-arc { stroke-dasharray: 1 5; stroke-linecap: round; }
.heidrun-code-dashboard-message-comet {
  fill: none;
  stroke: var(--focus);
  stroke-width: 5;
  stroke-linecap: round;
  stroke-dasharray: 6 194;
  stroke-dashoffset: 6;
  animation: heidrun-code-dashboard-comet 1.6s ease-in-out forwards;
}
.heidrun-code-dashboard-delivery-failed .heidrun-code-dashboard-message-comet { stroke: var(--muted); animation-name: heidrun-code-dashboard-comet-stops; }
.heidrun-code-dashboard-message-arrival {
  fill: none;
  stroke: var(--focus);
  stroke-width: 3;
  opacity: 0;
  transform-box: fill-box;
  transform-origin: center;
  animation: heidrun-code-dashboard-arrival 0.9s ease-out 1.5s forwards;
}
.heidrun-code-dashboard-message-end-ring {
  fill: none;
  stroke: var(--focus);
  stroke-width: 2;
  stroke-dasharray: 3 3;
  transform-box: fill-box;
  transform-origin: center;
  animation: heidrun-code-dashboard-effect-grow 2.6s ease-out forwards;
}
.heidrun-code-dashboard-message-end-sign { fill: var(--focus); font-weight: 700; paint-order: stroke; stroke: var(--bg); stroke-width: 3px; }

@keyframes heidrun-code-dashboard-effect-life {
  0%, 70% { opacity: 1; }
  100% { opacity: 0; }
}
@keyframes heidrun-code-dashboard-effect-grow {
  from { transform: scale(0.5); }
  to { transform: scale(1.7); }
}
@keyframes heidrun-code-dashboard-comet {
  from { stroke-dashoffset: 6; }
  to { stroke-dashoffset: -100; }
}
@keyframes heidrun-code-dashboard-comet-stops {
  from { stroke-dashoffset: 6; }
  to { stroke-dashoffset: -50; }
}
@keyframes heidrun-code-dashboard-arrival {
  0% { opacity: 1; transform: scale(0.6); }
  100% { opacity: 0; transform: scale(1.6); }
}
</style>
