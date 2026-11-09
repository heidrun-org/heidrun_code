<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId } from "vue";
import InformationCardContent from "./InformationCardContent.vue";

// A card above, below, or beside an element, with the look of an information card (a heading with the circled question mark, then blocks with
// a title and a text), that opens like a tooltip. The component draws no element of its own around the element. The slot
// gives `triggerProps`, and the element that owns the card receives them with `v-bind`: the four event handlers, and the
// attribute `aria-describedby` while the card is open. The card opens after a short delay, as the tooltip of the HTML
// attribute `title` does, when the pointer stays over the element and when the element keeps the keyboard focus. It closes
// at once when the pointer leaves and when the keyboard focus leaves, and a pointer that leaves before the delay ends opens
// nothing. The card never takes the pointer, so it never flickers, and a click on the element does what the element does.
// The card is a child of the element `body`, so it is never a sibling of the element, for example inside a button group. The
// card is placed again when the window changes its size, so that it stays inside the window. It is not the component
// `InformationCard.vue`, which opens on a click.
// - issue #629

const props = defineProps<{
  /** The heading of the card. */
  title: string;
  /** The blocks of the card, in order. Each block has a title and a text. */
  blocks: readonly { title: string; text: string }[];
  /** Where the card opens. A side card prefers the right and flips to the left when there is more room there. */
  placement?: "top" | "bottom" | "side";
  /** The delay before the card opens, in milliseconds. Defaults to the standard tooltip delay. */
  openDelay?: number;
  /** True when the card must appear above a dialog overlay and below confirmation dialogs. */
  aboveDialog?: boolean;
}>();

/** The time that the pointer or the keyboard focus must stay on the element before the card opens, in milliseconds. */
const OPEN_DELAY = 1500;

/** The space between the element and the card, and between the card and the edge of the window, in pixels. */
const GAP = 8;

/** The widest card, as a CSS length. A narrow window makes it narrower. */
const MAX_WIDTH = "26rem";

/** The identifier of the card, for the screen reader. Two cards never have the same identifier. */
const cardId = `information-card-tooltip-${useId()}`;

/** The element that owns the card, or `null` while the card is closed. */
const trigger = ref<HTMLElement | null>(null);
const card = ref<HTMLElement | null>(null);
const arrow = ref<HTMLElement | null>(null);

/** The timer that opens the card after the delay, or `null` when no timer runs. */
let openTimer: ReturnType<typeof setTimeout> | null = null;

/** True while the card is open. */
const isOpen = ref(false);

/** True from the moment that the card has its place: before that, the card is hidden, so it never jumps. */
const isPlaced = ref(false);

const cardStyle = ref<Record<string, string>>({});
const arrowStyle = ref<Record<string, string>>({});
const sidePlacement = ref<"start" | "end">("end");
const popoverPlacementClass = computed(() =>
  props.placement === "side" ? `bs-popover-${sidePlacement.value}` : `bs-popover-${props.placement === "top" ? "top" : "bottom"}`,
);

/** Places the card above, below, or beside the element, and keeps it inside the window. */
function place() {
  if (trigger.value === null || card.value === null) {
    return;
  }
  const part = trigger.value.getBoundingClientRect();
  const { height, width } = card.value.getBoundingClientRect();
  let left: number;
  let top: number;
  if (props.placement === "side") {
    const rightSpace = window.innerWidth - part.right - GAP;
    const leftSpace = part.left - GAP;
    const openOnRight = rightSpace >= width || rightSpace >= leftSpace;
    sidePlacement.value = openOnRight === true ? "end" : "start";
    left = openOnRight === true ? part.right + GAP : part.left - width - GAP;
    top = part.bottom - height;
    arrowStyle.value = { bottom: "12px" };
  } else {
    const arrowHalfWidth = arrow.value === null ? 0 : arrow.value.getBoundingClientRect().width / 2;
    left = part.left + part.width / 2 - width / 2;
    top = props.placement === "top" ? part.top - height - GAP : part.bottom + GAP;
    arrowStyle.value = { left: `${Math.max(0, part.left + part.width / 2 - left - arrowHalfWidth)}px` };
  }
  left = Math.max(GAP, Math.min(left, window.innerWidth - width - GAP));
  top = Math.max(GAP, Math.min(top, window.innerHeight - height - GAP));
  cardStyle.value = {
    top: `${top}px`,
    left: `${left}px`,
    "--popover-max-width": `min(${MAX_WIDTH}, ${Math.max(0, window.innerWidth - 2 * GAP)}px)`,
  };
  isPlaced.value = true;
}

/** Opens the card now, and places it. */
async function show() {
  openTimer = null;
  if (trigger.value === null || isOpen.value === true) {
    return;
  }
  isPlaced.value = false;
  isOpen.value = true;
  window.addEventListener("resize", place);
  await nextTick();
  place();
}

/** Starts the timer that opens the card, unless the card is open or a timer already runs. */
function open(event: Event) {
  trigger.value = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
  if (isOpen.value === true || openTimer !== null) {
    return;
  }
  openTimer = setTimeout(show, props.openDelay ?? OPEN_DELAY);
}

/** Stops the timer, and closes the card at once. */
function close() {
  if (openTimer !== null) {
    clearTimeout(openTimer);
    openTimer = null;
  }
  isOpen.value = false;
  trigger.value = null;
  window.removeEventListener("resize", place);
}

/** What the element that owns the card receives with `v-bind`. */
const triggerProps = computed(() => ({
  "aria-describedby": isOpen.value ? cardId : undefined,
  onPointerenter: open,
  onPointerleave: close,
  onFocusin: open,
  onFocusout: close,
}));

onBeforeUnmount(() => {
  if (openTimer !== null) {
    clearTimeout(openTimer);
  }
  window.removeEventListener("resize", place);
});
</script>

<template>
  <slot :triggerProps="triggerProps" />
  <Teleport to="body">
    <div
      v-if="isOpen"
      :id="cardId"
      ref="card"
      class="popover popover-instant show position-fixed"
      :class="[popoverPlacementClass, { 'side-placement': props.placement === 'side' }]"
      role="tooltip"
      :style="{ ...cardStyle, visibility: isPlaced ? 'visible' : 'hidden', '--popover-zindex': props.aboveDialog === true ? '59' : undefined }"
    >
      <div ref="arrow" class="popover-arrow position-absolute" :style="arrowStyle"></div>
      <div class="popover-body">
        <InformationCardContent :title="props.title" :blocks="props.blocks" />
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.popover { --popover-body-padding-x: 0; --popover-body-padding-y: 0; width: 26rem; pointer-events: none; }
.popover.side-placement > .popover-arrow { top: auto; bottom: 12px; }
.popover-body { overflow: hidden; border-radius: var(--popover-inner-border-radius); }
</style>
