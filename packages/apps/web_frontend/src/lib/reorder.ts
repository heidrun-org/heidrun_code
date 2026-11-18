import { onBeforeUnmount, ref } from "vue";

/** The distance in pixels that the pointer must move before a press becomes a drag. A shorter move is a click. */
const DRAG_THRESHOLD = 5;

/** The distance in pixels from the list, across the axis of the list, where the pointer still reorders. */
const CROSS_AXIS_TOLERANCE = 24;

/** The box of one item of a list, in the pixels of the window. */
export type Box = { left: number; top: number; right: number; bottom: number };

/** One press on an item, from the press until the release. */
type Press = {
  id: string;
  ids: string[];
  elements: HTMLElement[];
  startX: number;
  startY: number;
  isDrag: boolean;
};

/**
 * The gap where an item would land when the pointer is at (`x`, `y`): 0 is before the first item, and the number of items is
 * after the last item. Returns null when the pointer is too far from the list across its axis, so that a release there moves nothing.
 * With `alongTolerance`, it also returns null when the pointer is more than this distance before the first item or after the
 * last item along the axis: a list that sits next to another list (the two levels of the launchers) then never takes a drop
 * made over the other list.
 */
export function gapAt(boxes: Box[], axis: "x" | "y", x: number, y: number, alongTolerance?: number): number | null {
  if (boxes.length === 0) return null;
  const spans = boxes.map((box) =>
    axis === "x"
      ? { from: box.left, to: box.right, crossFrom: box.top, crossTo: box.bottom }
      : { from: box.top, to: box.bottom, crossFrom: box.left, crossTo: box.right },
  );
  const along = axis === "x" ? x : y;
  const across = axis === "x" ? y : x;
  const crossFrom = Math.min(...spans.map((span) => span.crossFrom));
  const crossTo = Math.max(...spans.map((span) => span.crossTo));
  if (across < crossFrom - CROSS_AXIS_TOLERANCE || across > crossTo + CROSS_AXIS_TOLERANCE) return null;
  if (alongTolerance !== undefined) {
    const alongFrom = Math.min(...spans.map((span) => span.from));
    const alongTo = Math.max(...spans.map((span) => span.to));
    if (along < alongFrom - alongTolerance || along > alongTo + alongTolerance) return null;
  }
  return spans.filter((span) => along > (span.from + span.to) / 2).length;
}

/**
 * Finds the element of every id, in the nearest ancestor of `item` that holds all of them.
 * Each element has the attribute `data-reorder-id`.
 */
function findElements(item: HTMLElement, ids: string[]): HTMLElement[] | null {
  let scope = item.parentElement;
  while (scope !== null) {
    const byId = new Map<string, HTMLElement>();
    for (const element of scope.querySelectorAll<HTMLElement>("[data-reorder-id]")) {
      byId.set(element.dataset.reorderId ?? "", element);
    }
    if (ids.every((id) => byId.has(id))) return ids.map((id) => byId.get(id)!);
    scope = scope.parentElement;
  }
  return null;
}

/**
 * Reorders a list (workspaces, tabs, notes) with the pointer of the mouse.
 * The reorder does not use the drag and drop of the browser: the native window of Tauri takes the drag and drop of the window
 * (to receive the image files from Finder), and the page then gets no drag event.
 * `drop` receives the dragged id and the insertion gap in the original list
 * (0 = before the first item, length = after the last), which is exactly
 * Herdr's `insert_index`.
 * Every item has the attribute `data-reorder-id`, and the element that starts the drag calls `onPointerDown`.
 * `options.alongTolerance` is given to `gapAt`: without it, a release before or after the list along its axis still lands at
 * the first or the last gap.
 */
export function useReorder(axis: "x" | "y", drop: (id: string, insertIndex: number) => void, options: { alongTolerance?: number } = {}) {
  const dragging = ref<string | null>(null);
  /** Gap where the item would land, for the insertion marker. */
  const gap = ref<number | null>(null);
  let press: Press | null = null;

  function onPointerDown(e: PointerEvent, ids: string[]) {
    if (e.button !== 0 || press !== null) return;
    const item = (e.currentTarget as HTMLElement).closest<HTMLElement>("[data-reorder-id]");
    const id = item?.dataset.reorderId;
    if (item === null || id === undefined) return;
    const elements = findElements(item, ids);
    if (elements === null) return;
    press = { id, ids, elements, startX: e.clientX, startY: e.clientY, isDrag: false };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", cancel);
    window.addEventListener("keydown", onKeyDown, true);
  }

  function onPointerMove(e: PointerEvent) {
    if (press === null) return;
    if (press.isDrag === false) {
      if (Math.hypot(e.clientX - press.startX, e.clientY - press.startY) < DRAG_THRESHOLD) return;
      press.isDrag = true;
      dragging.value = press.id;
      window.getSelection()?.removeAllRanges();
      document.body.style.userSelect = "none";
      document.body.style.cursor = "grabbing";
    }
    gap.value = gapAt(press.elements.map((element) => element.getBoundingClientRect()), axis, e.clientX, e.clientY, options.alongTolerance);
  }

  function onPointerUp() {
    const finished = press;
    const at = gap.value;
    cancel();
    if (finished === null || finished.isDrag === false || at === null) return;
    const from = finished.ids.indexOf(finished.id);
    // Dropping on either side of itself changes nothing.
    if (from === -1 || at === from || at === from + 1) return;
    drop(finished.id, at);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") cancel();
  }

  /** Ends the press without a move. The click that follows a drag is ignored: the drag is not a click on the item. */
  function cancel() {
    const wasDrag = press?.isDrag === true;
    press = null;
    dragging.value = null;
    gap.value = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", cancel);
    window.removeEventListener("blur", cancel);
    window.removeEventListener("keydown", onKeyDown, true);
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
    if (wasDrag) ignoreNextClick();
  }

  onBeforeUnmount(cancel);

  return { dragging, gap, onPointerDown };
}

/** Stops the click that the browser sends after the release of a drag, so that the drag does not select or rename an item. */
export function ignoreNextClick() {
  const stop = (e: Event) => {
    e.stopPropagation();
    e.preventDefault();
  };
  window.addEventListener("click", stop, { capture: true, once: true });
  setTimeout(() => window.removeEventListener("click", stop, true), 0);
}

/** Moves `id` to the gap `at` (0…length) of `ids`; returns the new order. */
export function moveId(ids: string[], id: string, at: number): string[] {
  const from = ids.indexOf(id);
  if (from === -1) return ids;
  const out = ids.filter((x) => x !== id);
  out.splice(from < at ? at - 1 : at, 0, id);
  return out;
}

/**
 * Reorders the items of `list` whose keys are in `visible` (a filtered view) and
 * leaves the others where they were.
 */
export function reorderSubset<T>(list: T[], key: (t: T) => string, visible: string[], id: string, at: number): T[] {
  const order = moveId(visible, id, at);
  const visibleSet = new Set(visible);
  const byKey = new Map(list.map((t) => [key(t), t]));
  let i = 0;
  return list.map((t) => (visibleSet.has(key(t)) ? byKey.get(order[i++])! : t));
}
