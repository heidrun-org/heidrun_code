<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, type WatchStopHandle } from "vue";
import babyGoatImage from "../../assets/baby_goat.webp";
import {
  MIRE_HEIDRUN_RADIUS,
  MIRE_HEXAGON_RADIUS,
  MIRE_WORKSPACE_LABEL_FONT_SIZE,
  MIRE_WORKSPACE_LABEL_HEIGHT,
  MireLayout,
} from "../../lib/mire/mire_layout";
import type {
  MireCodingAgentNode,
  MireFreshness,
  MireSubagentNode,
  MireVisibleStatus,
  MireWorkspaceNode,
} from "../../lib/mire/mire_model_types";
import { MireTransitions } from "../../lib/mire/mire_transitions";
import { MireAnimations, mireAnimationState } from "../../stores/mire/mire_animations";
import { MireNavigation, type MireNavigationKey } from "../../stores/mire/mire_navigation";
import { MireStore, mireIndex, mireModel, mireSelectedEntry, mireVisibility } from "../../stores/mire/mire_store";
import Icon from "../Icon.vue";
import MireGraphEffects from "./MireGraphEffects.vue";
import type { MireNodePlace } from "./mire_message_arcs";
import { MireViewTexts } from "./mire_view_texts";
import { t } from "../../i18n/index";

// The static radial graph of the Mire: Heidrun at the centre, the workspace hexagons on the first ring, one satellite
// for each coding agent on the second ring, and the subagents on the third ring. The positions come from
// `MireLayout`, which reads only the hierarchy: a status change never moves a node. A click on a node, on its label,
// or in the sector of a workspace selects it. Tab and the arrow keys move the keyboard focus, Enter selects, and
// Escape selects Heidrun again.
//
// The animations are CSS animations on the static drawing, so they never move a node and never rebuild the graph:
// Working breathes, with a small dot in orbit and drops of mead that climb the line to the parent; Blocked sends waves
// and gives a red glow to the workspace hexagon; Finished and Idle are still. Heidrun has a golden glow, a golden
// sight ring that turns slowly, and a keyboard whose keys light up faster when more coding agents work. Heidrun shows
// no status of its own: the lines and the nodes show the statuses. The short effects of the real transitions are in `MireGraphEffects.vue`. The pause button stops every
// animation, the Mire starts paused when the system asks for reduced motion, and nothing runs after the unmount.

const layout = computed(() => MireLayout.compute(mireModel.value));
const svg = ref<SVGSVGElement>();

/** The number of keys in one row of the keyboard of Heidrun. */
const KEYS_IN_A_ROW = 12;

/** The number of rows of keys of the keyboard of Heidrun. */
const KEY_ROWS = 3;

/**
 * The keyboard of Heidrun lies on a table, seen from the front: its back edge is narrower than its front edge, as in
 * the proposal of issue 955. The goat stands on its back edge.
 */
const KEYBOARD = {
  backY: 34,
  frontY: 54,
  backHalfWidth: 38,
  frontHalfWidth: 50,
  thickness: 4,
};

/** A point of the keyboard: `across` goes from 0 (left) to 1 (right), `depth` from 0 (back) to 1 (front). */
function keyboardPoint(across: number, depth: number): string {
  const halfWidth = KEYBOARD.backHalfWidth + (KEYBOARD.frontHalfWidth - KEYBOARD.backHalfWidth) * depth;
  const x = -halfWidth + 2 * halfWidth * across;
  const y = KEYBOARD.backY + (KEYBOARD.frontY - KEYBOARD.backY) * depth;
  return `${x.toFixed(2)},${y.toFixed(2)}`;
}

/** The four corners of a part of the keyboard, from the back left corner, clockwise. */
function keyboardQuad(acrossStart: number, acrossEnd: number, depthStart: number, depthEnd: number): string {
  return [
    keyboardPoint(acrossStart, depthStart),
    keyboardPoint(acrossEnd, depthStart),
    keyboardPoint(acrossEnd, depthEnd),
    keyboardPoint(acrossStart, depthEnd),
  ].join(" ");
}

/** The plate of the keyboard. */
const KEYBOARD_PLATE_POINTS = keyboardQuad(0, 1, 0, 1);

/** The front edge of the keyboard, which gives the plate its thickness. */
const KEYBOARD_EDGE_POINTS = [
  `${-KEYBOARD.frontHalfWidth},${KEYBOARD.frontY}`,
  `${KEYBOARD.frontHalfWidth},${KEYBOARD.frontY}`,
  `${KEYBOARD.frontHalfWidth - 1},${KEYBOARD.frontY + KEYBOARD.thickness}`,
  `${-(KEYBOARD.frontHalfWidth - 1)},${KEYBOARD.frontY + KEYBOARD.thickness}`,
].join(" ");

/** The share of the plate around the keys and between two keys. */
const KEY_MARGIN = 0.04;
const KEY_GAP = 0.14;

/** The keys of the keyboard of Heidrun, with the share of the period by which each key is late. */
const KEYBOARD_KEYS = Array.from({ length: KEY_ROWS * KEYS_IN_A_ROW }, (_, index) => {
  const column = index % KEYS_IN_A_ROW;
  const row = Math.floor(index / KEYS_IN_A_ROW);
  const keyWidth = (1 - 2 * KEY_MARGIN) / KEYS_IN_A_ROW;
  const keyDepth = (1 - 2 * KEY_MARGIN * 3) / KEY_ROWS;
  const across = KEY_MARGIN + column * keyWidth;
  const depth = KEY_MARGIN * 3 + row * keyDepth;
  return {
    points: keyboardQuad(
      across + keyWidth * KEY_GAP,
      across + keyWidth * (1 - KEY_GAP),
      depth + keyDepth * KEY_GAP,
      depth + keyDepth * (1 - KEY_GAP),
    ),
    lateShare: (index * 0.618) % 1,
  };
});

/** The size of the image of the goat. Her hooves stand on the back edge of the keyboard. */
const GOAT_SIZE = 110;
const GOAT_TOP = -70;

/** The radius of the sight ring around Heidrun. */
const SIGHT_RING_RADIUS = MIRE_HEIDRUN_RADIUS + 7;

/** The marks of the sight ring, like the marks of a dial: one mark every 6 degrees, and a longer mark every 30 degrees. */
const SIGHT_MARKS = Array.from({ length: 60 }, (_, index) => {
  const angle = (index * 6 * Math.PI) / 180;
  const length = index % 5 === 0 ? 6 : 3;
  return {
    x1: Math.cos(angle) * SIGHT_RING_RADIUS,
    y1: Math.sin(angle) * SIGHT_RING_RADIUS,
    x2: Math.cos(angle) * (SIGHT_RING_RADIUS + length),
    y2: Math.sin(angle) * (SIGHT_RING_RADIUS + length),
  };
});

/** The radius of the white dashed circle around a selected coding agent. */
const CODING_AGENT_SELECTION_RADIUS = 15.5;

/** The radius of the white dashed circle around a selected subagent. */
const SUBAGENT_SELECTION_RADIUS = 10.5;

/** The time of one turn of the white dashed circle around a selected coding agent. */
const CODING_AGENT_SELECTION_TURN_SECONDS = 8;

/**
 * Gives the time of one turn of a white dashed circle, so that its dashes move at the same speed on every circle: the
 * speed of the circle around a selected coding agent. A larger circle turns more slowly.
 * @param radius The radius of the circle.
 * @returns The style that sets the time of one turn.
 */
function selectionTurnStyle(radius: number): Record<string, string> {
  return {
    "--mire-selection-turn": `${(radius / CODING_AGENT_SELECTION_RADIUS) * CODING_AGENT_SELECTION_TURN_SECONDS}s`,
  };
}

/** The radius of the white dashed circle around Heidrun when Heidrun is selected. */
const HEIDRUN_SELECTION_RADIUS = SIGHT_RING_RADIUS + 9;

const isAnimated = computed(() => mireAnimationState.isPaused === false);

/** The time between two light-ups of one key, or null when no coding agent works. */
const keyboardPeriodMs = computed(() => MireTransitions.keyboardPeriodMs(mireModel.value.counters.codingAgents.working));

let stopAnimations: WatchStopHandle | null = null;

onMounted(() => {
  stopAnimations = MireAnimations.start();
});

onBeforeUnmount(() => {
  stopAnimations?.();
  stopAnimations = null;
});

/** The workspaces of the model, by node identifier. */
const workspaceNodes = computed(() => {
  const nodes = new Map<string, MireWorkspaceNode>();
  for (const workspace of mireModel.value.workspaces) {
    nodes.set(workspace.nodeId, workspace);
  }
  return nodes;
});

/** The coding agents and the subagents of the model, by node identifier. */
const itemNodes = computed(() => {
  const nodes = new Map<string, MireCodingAgentNode | MireSubagentNode>();
  for (const item of MireViewTexts.items(mireModel.value)) {
    nodes.set(item.nodeId, item);
  }
  return nodes;
});

/** The workspaces that show under the filter, with their layout. */
const shownWorkspaces = computed(() =>
  layout.value.workspaces
    .filter((place) => isShown(place.nodeId))
    .map((place) => ({ place, node: workspaceNodes.value.get(place.nodeId) as MireWorkspaceNode })),
);

/** The coding agents that show under the filter, with their layout. */
const shownCodingAgents = computed(() =>
  layout.value.codingAgents
    .filter((place) => isShown(place.nodeId))
    .map((place) => ({ place, node: itemNodes.value.get(place.nodeId) as MireCodingAgentNode })),
);

/** The subagents that show under the filter, with their layout. */
const shownSubagents = computed(() =>
  layout.value.subagents
    .filter((place) => isShown(place.nodeId))
    .map((place) => ({ place, node: itemNodes.value.get(place.nodeId) as MireSubagentNode })),
);

/** The lines whose two ends show. Each line takes the status of its child. */
const shownLinks = computed(() =>
  layout.value.links
    .filter((link) => isShown(link.fromNodeId) && isShown(link.toNodeId))
    .map((link) => ({ link, status: statusOf(link.toNodeId) })),
);

/** The drawn coding agents and subagents, by node identifier: the places where an effect can show. */
const drawnPlaces = computed(() => {
  const places = new Map<string, MireNodePlace>();
  for (const { place } of shownCodingAgents.value) {
    places.set(place.nodeId, { x: place.x, y: place.y, workspaceNodeId: place.workspaceNodeId });
  }
  for (const { place } of shownSubagents.value) {
    places.set(place.nodeId, { x: place.x, y: place.y, workspaceNodeId: place.workspaceNodeId });
  }
  return places;
});

const selectedNodeId = computed(() => mireSelectedEntry.value.nodeId);

/** The node whose part of the graph is selected: a selected tab highlights its workspace. */
const highlightedWorkspaceNodeId = computed(() => {
  const path = MireNavigation.path(mireIndex.value, selectedNodeId.value);
  return path.find((entry) => entry.node.kind === "workspace")?.nodeId ?? null;
});

/**
 * The look of every sector, as one text. The sectors are drawn again as new elements each time that this text changes,
 * because the web view of macOS repainted only a part of a sector after a change of selection, and left a part of the
 * old outline on the screen (issue 973).
 */
const sectorsDrawKey = computed(() =>
  shownWorkspaces.value
    .map(({ place, node }) => `${place.nodeId}:${node.status}:${place.nodeId === highlightedWorkspaceNodeId.value}:${isFaint(place.nodeId)}`)
    .join("|"),
);

function isShown(nodeId: string): boolean {
  return mireVisibility.value.get(nodeId) !== "hidden";
}

function isFaint(nodeId: string): boolean {
  return mireVisibility.value.get(nodeId) === "faint";
}

function statusOf(nodeId: string): MireVisibleStatus {
  return workspaceNodes.value.get(nodeId)?.status ?? itemNodes.value.get(nodeId)?.status ?? "idle";
}

function nodeClasses(nodeId: string, status: MireVisibleStatus, freshness: MireFreshness | null): string[] {
  const classes = [`mire-status-${status}`];
  if (freshness !== null && freshness !== "fresh") {
    classes.push("mire-incomplete", `mire-freshness-${freshness}`);
  }
  if (isFaint(nodeId)) {
    classes.push("mire-faint");
  }
  if (nodeId === selectedNodeId.value) {
    classes.push("mire-selected");
  }
  return classes;
}

function tabLabelOf(tabNodeId: string): string {
  return mireIndex.value.get(tabNodeId)?.label ?? "";
}

function codingAgentDescription(node: MireCodingAgentNode, tabNodeId: string): string {
  const name = `${tabLabelOf(tabNodeId)} (${MireViewTexts.agentName(node.agent)})`;
  return MireViewTexts.nodeDescription(name, node.status, node.facts.freshness);
}

function subagentDescription(node: MireSubagentNode): string {
  return MireViewTexts.nodeDescription(MireLayout.subagentName(node), node.status, node.facts.freshness);
}

function workspaceDescription(node: MireWorkspaceNode): string {
  return MireViewTexts.nodeDescription(node.label, node.status, null);
}

/** The path of the label shaped like a tab: rounded top corners, square bottom corners. */
function tabShapePath(x: number, y: number, width: number): string {
  const left = x - width / 2;
  const right = x + width / 2;
  const height = 18;
  const corner = 4;
  return [
    `M ${left} ${y + height}`,
    `L ${left} ${y + corner}`,
    `Q ${left} ${y} ${left + corner} ${y}`,
    `L ${right - corner} ${y}`,
    `Q ${right} ${y} ${right} ${y + corner}`,
    `L ${right} ${y + height}`,
    "Z",
  ].join(" ");
}

function select(nodeId: string) {
  MireStore.select(nodeId);
}

function focusNode(nodeId: string) {
  void nextTick(() => {
    const element = svg.value?.querySelector<SVGGElement>(`[data-node-id="${CSS.escape(nodeId)}"]`);
    element?.focus();
  });
}

function onKeyDown(event: KeyboardEvent) {
  const target = (event.target as Element | null)?.closest<SVGGElement>("[data-node-id]");
  const nodeId = target?.dataset.nodeId ?? null;
  if (event.key === "Escape") {
    if (selectedNodeId.value !== "heidrun") {
      event.preventDefault();
      event.stopPropagation();
      MireStore.clearSelection();
    }
    return;
  }
  if (nodeId === null) {
    return;
  }
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    select(nodeId);
    return;
  }
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
    event.preventDefault();
    const nextNodeId = MireNavigation.move(mireIndex.value, mireVisibility.value, nodeId, event.key as MireNavigationKey);
    if (nextNodeId !== null) {
      focusNode(nextNodeId);
    }
  }
}
</script>

<template>
  <div class="mire-graph d-flex flex-fill position-relative" data-mire-graph>
    <p v-if="mireModel.workspaces.length === 0" class="m-0 p-2 text-body-secondary" data-mire-empty>
      {{ t("mire.graph.noWorkspace") }}
    </p>
    <button
      v-else
      type="button"
      class="btn small mire-pause position-absolute top-0 start-0 m-2"
      :title="isAnimated ? t('mire.animation.pauseTitle') : t('mire.animation.resumeTitle')"
      data-mire-pause
      @click="MireAnimations.togglePause()"
    >
      <Icon :name="isAnimated ? 'pause-fill' : 'play-fill'" />
      <span class="ms-1">{{ isAnimated ? t("mire.animation.pause") : t("mire.animation.resume") }}</span>
    </button>
    <svg
      v-if="mireModel.workspaces.length > 0"
      ref="svg"
      class="mire-graph-svg"
      :class="{ 'mire-animated': isAnimated }"
      :viewBox="layout.viewBox"
      preserveAspectRatio="xMidYMid meet"
      role="group"
      :aria-label="t('mire.graph.label')"
      @keydown="onKeyDown"
    >
      <defs>
        <radialGradient id="mire-heidrun-glow-gradient">
          <stop offset="0%" class="mire-heidrun-glow-centre" />
          <stop offset="100%" class="mire-heidrun-glow-edge" />
        </radialGradient>
      </defs>
      <g :key="sectorsDrawKey" class="mire-sectors">
        <path
          v-for="{ place, node } in shownWorkspaces"
          :key="`sector-${place.nodeId}`"
          class="mire-sector"
          :class="[
            `mire-status-${node.status}`,
            {
              'mire-selected': place.nodeId === highlightedWorkspaceNodeId,
              'mire-faint': isFaint(place.nodeId),
            },
          ]"
          :d="place.sectorPath"
          :data-sector-id="place.nodeId"
          @click="select(place.nodeId)"
        >
          <title>{{ node.label }}</title>
        </path>
      </g>
      <g class="mire-links" aria-hidden="true">
        <template v-for="{ link, status } in shownLinks" :key="`link-${link.fromNodeId}-${link.toNodeId}`">
          <path
            class="mire-link"
            :class="`mire-status-${status}`"
            :data-link-from="link.fromNodeId"
            :data-link-to="link.toNodeId"
            :d="link.path"
          />
          <path
            v-if="isAnimated && status === 'working'"
            class="mire-drops"
            :d="link.climbPath"
            pathLength="100"
            data-drops
          />
        </template>
      </g>
      <g
        class="mire-node mire-heidrun"
        :class="nodeClasses('heidrun', mireModel.status, null)"
        data-node-id="heidrun"
        tabindex="0"
        role="button"
        :aria-label="MireViewTexts.nodeDescription(t('mire.heidrun'), mireModel.status, null)"
        :aria-current="selectedNodeId === 'heidrun' ? 'true' : undefined"
        @click="select('heidrun')"
      >
        <title>{{ t("mire.heidrun") }}</title>
        <circle class="mire-heidrun-ring" cx="0" cy="0" :r="SIGHT_RING_RADIUS" />
        <circle class="mire-heidrun-glow" cx="0" cy="0" :r="SIGHT_RING_RADIUS + 10" data-heidrun-glow />
        <circle v-if="selectedNodeId === 'heidrun'" class="mire-selection-ring" cx="0" cy="0" :r="HEIDRUN_SELECTION_RADIUS" :style="selectionTurnStyle(HEIDRUN_SELECTION_RADIUS)" data-selection-ring />
        <g class="mire-sight-ring" data-sight-ring>
          <circle class="mire-sight-circle" cx="0" cy="0" :r="SIGHT_RING_RADIUS" />
          <line
            v-for="(mark, index) in SIGHT_MARKS"
            :key="index"
            class="mire-sight-mark"
            :x1="mark.x1"
            :y1="mark.y1"
            :x2="mark.x2"
            :y2="mark.y2"
          />
        </g>
        <g
          class="mire-keyboard"
          :class="{ 'mire-keyboard-active': keyboardPeriodMs !== null }"
          :style="keyboardPeriodMs === null ? undefined : { '--mire-key-period': `${keyboardPeriodMs}ms` }"
          data-keyboard
          :data-key-period-ms="keyboardPeriodMs ?? undefined"
        >
          <polygon class="mire-keyboard-edge" :points="KEYBOARD_EDGE_POINTS" />
          <polygon class="mire-keyboard-plate" :points="KEYBOARD_PLATE_POINTS" />
          <polygon
            v-for="(key, index) in KEYBOARD_KEYS"
            :key="index"
            class="mire-key"
            :points="key.points"
            :style="{ '--mire-key-late-share': key.lateShare }"
          />
        </g>
        <image
          :href="babyGoatImage"
          :x="-GOAT_SIZE / 2"
          :y="GOAT_TOP"
          :width="GOAT_SIZE"
          :height="GOAT_SIZE"
          data-goat
        />
        <text class="mire-heidrun-name" font-size="13" x="0" :y="MIRE_HEIDRUN_RADIUS + 16" text-anchor="middle">{{ t("mire.heidrun") }}</text>
      </g>
      <g
        v-for="{ place, node } in shownWorkspaces"
        :key="place.nodeId"
        class="mire-node mire-workspace"
        :class="nodeClasses(place.nodeId, node.status, null)"
        :data-node-id="place.nodeId"
        tabindex="0"
        role="button"
        :aria-label="workspaceDescription(node)"
        :aria-current="selectedNodeId === place.nodeId ? 'true' : undefined"
        @click="select(place.nodeId)"
      >
        <title>{{ workspaceDescription(node) }}</title>
        <polygon v-if="isAnimated && node.status === 'blocked'" class="mire-hexagon-glow" :points="place.hexagonPoints" data-hexagon-glow />
        <circle v-if="selectedNodeId === place.nodeId" class="mire-selection-ring" :cx="place.x" :cy="place.y" :r="MIRE_HEXAGON_RADIUS + 6" :style="selectionTurnStyle(MIRE_HEXAGON_RADIUS + 6)" data-selection-ring />
        <polygon class="mire-hexagon" :points="place.hexagonPoints" />
        <text class="mire-glyph" font-size="12" :x="place.x" :y="place.y + 4" text-anchor="middle">{{ MireViewTexts.statusGlyph(node.status) }}</text>
        <rect
          class="mire-workspace-label-box"
          :x="place.labelX - place.labelWidth / 2"
          :y="place.labelY - MIRE_WORKSPACE_LABEL_HEIGHT / 2"
          :width="place.labelWidth"
          :height="MIRE_WORKSPACE_LABEL_HEIGHT"
          rx="6"
          data-label-box
        />
        <text
          class="mire-workspace-label"
          :font-size="MIRE_WORKSPACE_LABEL_FONT_SIZE"
          :x="place.labelX"
          :y="place.labelY + MIRE_WORKSPACE_LABEL_FONT_SIZE * 0.35"
          text-anchor="middle"
          data-label
        >{{ place.labelText }}</text>
      </g>
      <g
        v-for="{ place, node } in shownCodingAgents"
        :key="place.nodeId"
        class="mire-node mire-coding-agent"
        :class="nodeClasses(place.nodeId, node.status, node.facts.freshness)"
        :data-node-id="place.nodeId"
        tabindex="0"
        role="button"
        :aria-label="codingAgentDescription(node, place.tabNodeId)"
        :aria-current="selectedNodeId === place.nodeId ? 'true' : undefined"
        @click="select(place.nodeId)"
      >
        <title>{{ codingAgentDescription(node, place.tabNodeId) }}</title>
        <g v-if="isAnimated && node.status === 'blocked'" class="mire-waves" data-waves>
          <circle class="mire-wave" :cx="place.x" :cy="place.y" r="11" />
          <circle class="mire-wave mire-wave-late" :cx="place.x" :cy="place.y" r="11" />
        </g>
        <g v-if="isAnimated && node.status === 'working'" class="mire-orbit" :transform="`translate(${place.x} ${place.y})`" data-orbit>
          <g class="mire-orbit-turn">
            <circle class="mire-orbit-bounds" r="20.5" />
            <circle class="mire-orbit-dot" cx="18" cy="0" r="2.5" />
          </g>
        </g>
        <circle v-if="selectedNodeId === place.nodeId" class="mire-selection-ring" :cx="place.x" :cy="place.y" :r="CODING_AGENT_SELECTION_RADIUS" :style="selectionTurnStyle(CODING_AGENT_SELECTION_RADIUS)" data-selection-ring />
        <circle class="mire-dot" :cx="place.x" :cy="place.y" r="11" />
        <text class="mire-glyph" font-size="12" :x="place.x" :y="place.y + 4" text-anchor="middle">{{ MireViewTexts.statusGlyph(node.status) }}</text>
        <g v-if="place.isLabelShown" class="mire-tab-label" data-tab-label>
          <path class="mire-tab-shape" :d="tabShapePath(place.labelX, place.labelY, place.labelWidth)" />
          <line
            class="mire-tab-line"
            :x1="place.labelX - place.labelWidth / 2"
            :x2="place.labelX + place.labelWidth / 2"
            :y1="place.labelY + 18"
            :y2="place.labelY + 18"
          />
          <rect class="mire-badge" :x="place.labelX - place.labelWidth / 2 + 4" :y="place.labelY + 3" width="13" height="12" rx="2" />
          <text
            class="mire-badge-letter"
            :class="{ 'mire-badge-icon': MireViewTexts.agentIcon(node.agent) !== null }"
            font-size="9"
            :x="place.labelX - place.labelWidth / 2 + 10.5"
            :y="place.labelY + 12.5"
            text-anchor="middle"
            :data-badge="MireViewTexts.agentIcon(node.agent) ?? MireViewTexts.agentBadge(node.agent)"
          >{{ MireViewTexts.agentIconGlyph(node.agent) }}</text>
          <text class="mire-tab-text" font-size="11" :x="place.labelX - place.labelWidth / 2 + 22" :y="place.labelY + 13" data-label>{{ place.labelText }}</text>
        </g>
        <text
          v-if="place.isLabelShown && MireViewTexts.freshnessText(node.facts.freshness) !== null"
          class="mire-freshness-text" font-size="10"
          :x="place.labelX"
          :y="place.labelY + 31"
          text-anchor="middle"
          data-freshness
        >{{ MireViewTexts.freshnessText(node.facts.freshness) }}</text>
      </g>
      <g
        v-for="{ place, node } in shownSubagents"
        :key="place.nodeId"
        class="mire-node mire-subagent"
        :class="nodeClasses(place.nodeId, node.status, node.facts.freshness)"
        :data-node-id="place.nodeId"
        tabindex="0"
        role="button"
        :aria-label="subagentDescription(node)"
        :aria-current="selectedNodeId === place.nodeId ? 'true' : undefined"
        @click="select(place.nodeId)"
      >
        <title>{{ subagentDescription(node) }}</title>
        <g v-if="isAnimated && node.status === 'blocked'" class="mire-waves" data-waves>
          <circle class="mire-wave" :cx="place.x" :cy="place.y" r="7" />
          <circle class="mire-wave mire-wave-late" :cx="place.x" :cy="place.y" r="7" />
        </g>
        <g v-if="isAnimated && node.status === 'working'" class="mire-orbit" :transform="`translate(${place.x} ${place.y})`" data-orbit>
          <g class="mire-orbit-turn">
            <circle class="mire-orbit-bounds" r="14" />
            <circle class="mire-orbit-dot" cx="12" cy="0" r="2" />
          </g>
        </g>
        <circle v-if="selectedNodeId === place.nodeId" class="mire-selection-ring" :cx="place.x" :cy="place.y" :r="SUBAGENT_SELECTION_RADIUS" :style="selectionTurnStyle(SUBAGENT_SELECTION_RADIUS)" data-selection-ring />
        <circle class="mire-dot" :cx="place.x" :cy="place.y" r="7" />
        <text class="mire-glyph" font-size="9" :x="place.x" :y="place.y + 3" text-anchor="middle">{{ MireViewTexts.statusGlyph(node.status) }}</text>
        <text
          v-if="place.isLabelShown"
          class="mire-subagent-label" font-size="10"
          :x="place.labelX"
          :y="place.labelY"
          :text-anchor="place.labelAnchor"
          data-label
        >{{ place.labelText }}{{ MireViewTexts.freshnessText(node.facts.freshness) === null ? "" : ` · ${MireViewTexts.freshnessText(node.facts.freshness)}` }}</text>
      </g>
      <MireGraphEffects v-if="isAnimated" :places="drawnPlaces" />
    </svg>
  </div>
</template>

<style scoped>
/* The radial graph is an SVG drawing: Bootstrap has no class for its shapes, so its colors come from the theme
   variables of styles.css here. */
.mire-graph { min-width: 0; min-height: 0; }
.mire-graph-svg { width: 100%; height: 100%; display: block; overflow: visible; font-family: var(--mono); }
.mire-node { cursor: pointer; outline: none; }
.mire-node:focus-visible .mire-dot,
.mire-node:focus-visible .mire-hexagon,
.mire-node:focus-visible .mire-heidrun-ring { stroke: var(--focus); stroke-width: 2; }
.mire-faint { opacity: 0.35; }

.mire-sector { fill: var(--raised); fill-opacity: 0.45; stroke: var(--faint); stroke-width: 1.5; stroke-dasharray: 6 5; cursor: pointer; }
.mire-sector.mire-status-blocked { fill: var(--blocked); fill-opacity: 0.08; stroke: var(--blocked); stroke-dasharray: none; }
/* The selected workspace, or the workspace of the selected item, has a solid border of the color of its status. */
.mire-sector.mire-selected { fill-opacity: 0.8; stroke: var(--idle); stroke-width: 2; stroke-dasharray: none; }
.mire-sector.mire-status-working.mire-selected { stroke: var(--working); }
.mire-sector.mire-status-blocked.mire-selected { fill-opacity: 0.16; stroke: var(--blocked); }
.mire-sector.mire-status-finished.mire-selected { stroke: var(--done); }

.mire-link { fill: none; stroke: var(--line-strong); stroke-width: 1.5; }
.mire-link.mire-status-working { stroke: var(--working); }
.mire-link.mire-status-blocked { stroke: var(--blocked); }
.mire-link.mire-status-finished { stroke: var(--done); }

/* Heidrun shows no status: the lines to the workspaces start at the centre, behind the goat, and the ring is only the
   area that a click selects. */
.mire-heidrun-ring { fill: transparent; stroke: none; }
.mire-heidrun-glow { fill: url(#mire-heidrun-glow-gradient); pointer-events: none; }
.mire-heidrun-glow-centre { stop-color: var(--heidrun-gold); stop-opacity: 0.35; }
.mire-heidrun-glow-edge { stop-color: var(--heidrun-gold); stop-opacity: 0; }
.mire-heidrun-name { fill: var(--heidrun-gold); font-weight: 600; paint-order: stroke; stroke: var(--bg); stroke-width: 4px; }
.mire-selection-ring { fill: none; stroke: var(--text); stroke-width: 1.5; stroke-dasharray: 4 4; pointer-events: none; }

.mire-hexagon { fill: var(--idle); stroke: var(--bg); stroke-width: 2; }
.mire-workspace-label-box { fill: var(--bg); stroke: var(--line-strong); stroke-width: 1.5; }
.mire-workspace.mire-status-working .mire-workspace-label-box { stroke: var(--working); }
.mire-workspace.mire-status-blocked .mire-workspace-label-box { stroke: var(--blocked); }
.mire-workspace.mire-status-finished .mire-workspace-label-box { stroke: var(--done); }
.mire-workspace-label { fill: var(--text); font-weight: 700; }

.mire-dot { fill: var(--idle); stroke: var(--bg); stroke-width: 2; }
.mire-status-working .mire-dot, .mire-status-working .mire-hexagon { fill: var(--working); }
.mire-status-blocked .mire-dot, .mire-status-blocked .mire-hexagon { fill: var(--blocked); filter: drop-shadow(0 0 6px var(--blocked)); }
.mire-status-finished .mire-dot, .mire-status-finished .mire-hexagon { fill: var(--done); }
.mire-status-unknown .mire-dot, .mire-status-unknown .mire-hexagon { fill: var(--bg); stroke: var(--idle); stroke-dasharray: 3 2; }
.mire-incomplete .mire-dot { stroke: var(--muted); stroke-width: 2; stroke-dasharray: 3 2; }
.mire-glyph { fill: var(--on-solid); font-weight: 700; pointer-events: none; }
.mire-status-unknown .mire-glyph { fill: var(--text); }

.mire-tab-shape { fill: var(--raised); stroke: var(--line-strong); }
.mire-tab-line { stroke: var(--idle); stroke-width: 2.5; }
.mire-status-working .mire-tab-line { stroke: var(--working); }
.mire-status-blocked .mire-tab-line { stroke: var(--blocked); }
.mire-status-finished .mire-tab-line { stroke: var(--done); }
.mire-incomplete .mire-tab-shape { stroke-dasharray: 3 2; }
.mire-badge { fill: var(--line-strong); }
.mire-badge-letter { fill: var(--text); font-weight: 700; }
.mire-badge-icon { font-family: "bootstrap-icons"; font-weight: 400; }
.mire-tab-text { fill: var(--text); }
.mire-freshness-text { fill: var(--muted); font-style: italic; }
.mire-subagent-label { fill: var(--text-2); paint-order: stroke; stroke: var(--bg); stroke-width: 3px; }
</style>

<style scoped src="./mire_graph_animations.css"></style>
