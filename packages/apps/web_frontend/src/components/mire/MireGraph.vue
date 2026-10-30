<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import babyGoatImage from "../../assets/baby_goat.webp";
import { MIRE_HEIDRUN_RADIUS, MireLayout } from "../../lib/mire/mire_layout";
import type {
  MireCodingAgentNode,
  MireFreshness,
  MireSubagentNode,
  MireVisibleStatus,
  MireWorkspaceNode,
} from "../../lib/mire/mire_model_types";
import { MireNavigation, type MireNavigationKey } from "../../stores/mire/mire_navigation";
import { MireStore, mireIndex, mireModel, mireSelectedEntry, mireVisibility } from "../../stores/mire/mire_store";
import { MireViewTexts } from "./mire_view_texts";
import { t } from "../../i18n/index";

// The static radial graph of the Mire: Heidrun at the centre, the workspace hexagons on the first ring, one satellite
// for each coding agent on the second ring, and the subagents on the third ring. The positions come from
// `MireLayout`, which reads only the hierarchy: a status change never moves a node. A click on a node, on its label,
// or in the sector of a workspace selects it. Tab and the arrow keys move the keyboard focus, Enter selects, and
// Escape selects Heidrun again.

const layout = computed(() => MireLayout.compute(mireModel.value));
const svg = ref<SVGSVGElement>();

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

const selectedNodeId = computed(() => mireSelectedEntry.value.nodeId);

/** The node whose part of the graph is selected: a selected tab highlights its workspace. */
const highlightedWorkspaceNodeId = computed(() => {
  const path = MireNavigation.path(mireIndex.value, selectedNodeId.value);
  return path.find((entry) => entry.node.kind === "workspace")?.nodeId ?? null;
});

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
  <div class="mire-graph d-flex flex-fill" data-mire-graph>
    <p v-if="mireModel.workspaces.length === 0" class="m-0 p-2 text-body-secondary" data-mire-empty>
      {{ t("mire.graph.noWorkspace") }}
    </p>
    <svg
      v-else
      ref="svg"
      class="mire-graph-svg"
      :viewBox="layout.viewBox"
      preserveAspectRatio="xMidYMid meet"
      role="group"
      :aria-label="t('mire.graph.label')"
      @keydown="onKeyDown"
    >
      <defs>
        <clipPath id="mire-heidrun-clip">
          <circle cx="0" cy="0" :r="MIRE_HEIDRUN_RADIUS - 6" />
        </clipPath>
      </defs>
      <g class="mire-sectors">
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
        <line
          v-for="{ link, status } in shownLinks"
          :key="`link-${link.fromNodeId}-${link.toNodeId}`"
          class="mire-link"
          :class="`mire-status-${status}`"
          :x1="link.x1"
          :y1="link.y1"
          :x2="link.x2"
          :y2="link.y2"
        />
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
        <circle class="mire-heidrun-ring" cx="0" cy="0" :r="MIRE_HEIDRUN_RADIUS" />
        <image
          :href="babyGoatImage"
          :x="-(MIRE_HEIDRUN_RADIUS - 6)"
          :y="-(MIRE_HEIDRUN_RADIUS - 6)"
          :width="2 * (MIRE_HEIDRUN_RADIUS - 6)"
          :height="2 * (MIRE_HEIDRUN_RADIUS - 6)"
          clip-path="url(#mire-heidrun-clip)"
          preserveAspectRatio="xMidYMid slice"
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
        <polygon class="mire-hexagon" :points="place.hexagonPoints" />
        <text class="mire-glyph" font-size="12" :x="place.x" :y="place.y + 4" text-anchor="middle">{{ MireViewTexts.statusGlyph(node.status) }}</text>
        <text class="mire-workspace-label" font-size="12" :x="place.labelX" :y="place.labelY" text-anchor="middle" data-label>{{ place.labelText }}</text>
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
          <text class="mire-badge-letter" font-size="9" :x="place.labelX - place.labelWidth / 2 + 10.5" :y="place.labelY + 12.5" text-anchor="middle" data-badge>{{
            MireViewTexts.agentBadge(node.agent)
          }}</text>
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
    </svg>
  </div>
</template>

<style scoped>
/* The radial graph is an SVG drawing: Bootstrap has no class for its shapes, so its colors come from the theme
   variables of styles.css here. */
.mire-graph { min-width: 0; min-height: 0; }
.mire-graph-svg { width: 100%; height: 100%; display: block; font-family: var(--mono); }
.mire-node { cursor: pointer; outline: none; }
.mire-node:focus-visible .mire-dot,
.mire-node:focus-visible .mire-hexagon,
.mire-node:focus-visible .mire-heidrun-ring { stroke: var(--focus); stroke-width: 3; }
.mire-faint { opacity: 0.35; }

.mire-sector { fill: var(--raised); fill-opacity: 0.45; stroke: var(--line-strong); stroke-dasharray: 4 4; cursor: pointer; }
.mire-sector.mire-status-blocked { fill: var(--blocked); fill-opacity: 0.08; stroke: var(--blocked); stroke-dasharray: none; }
.mire-sector.mire-selected { stroke: var(--focus); stroke-width: 2; stroke-dasharray: none; }

.mire-link { stroke: var(--line-strong); stroke-width: 1.5; }
.mire-link.mire-status-working { stroke: var(--working); }
.mire-link.mire-status-blocked { stroke: var(--blocked); }
.mire-link.mire-status-finished { stroke: var(--done); }

.mire-heidrun-ring { fill: var(--bg); stroke: var(--line-strong); stroke-width: 2; }
.mire-heidrun.mire-status-working .mire-heidrun-ring { stroke: var(--working); }
.mire-heidrun.mire-status-blocked .mire-heidrun-ring { stroke: var(--blocked); filter: drop-shadow(0 0 8px var(--blocked)); }
.mire-heidrun.mire-status-finished .mire-heidrun-ring { stroke: var(--done); }
.mire-heidrun-name { fill: var(--text); font-weight: 600; }
.mire-selected .mire-heidrun-ring,
.mire-selected .mire-dot,
.mire-selected .mire-hexagon { stroke: var(--focus); stroke-width: 3; }

.mire-hexagon { fill: var(--idle); stroke: var(--bg); stroke-width: 2; }
.mire-workspace-label { fill: var(--text); font-weight: 600; paint-order: stroke; stroke: var(--bg); stroke-width: 4px; }

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
.mire-tab-text { fill: var(--text); }
.mire-freshness-text { fill: var(--muted); font-style: italic; }
.mire-subagent-label { fill: var(--text-2); paint-order: stroke; stroke: var(--bg); stroke-width: 3px; }
</style>
