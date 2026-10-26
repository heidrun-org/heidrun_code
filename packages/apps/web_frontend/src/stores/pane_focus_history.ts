// The history of the focus between panes: Heidrun Code records each pane that gets the focus, and the "Back" button and the
// "Forward" button of the top bar move through the history. The history lives in memory, until Heidrun Code quits.
// - issue #380
import { watch } from "vue";
import { allPanes, selectPane, state } from "./session";
import { activePaneId, isPinned, pinnedPaneState } from "./pinned_panes";
import { trailingDebounce } from "../lib/trailing_debounce";
import { paneFocusHistory } from "./pane_focus_history_state";
import { ZenMode } from "./zen_mode";

export { paneFocusHistory };

/** A pane must keep the focus this long, in milliseconds, before the history records it. A quick pass is noise. */
export const PANE_FOCUS_STAY_MS = 500;

/** Records the pane that has the focus now. */
function recordActivePane() {
  const paneId = activePaneId();
  if (paneId === null) {
    return;
  }
  paneFocusHistory.record(paneId);
}

const recordLater = trailingDebounce(recordActivePane, PANE_FOCUS_STAY_MS);

/** Removes the entries of the panes that Herdr does not list any more. */
function removeClosedPanes() {
  const snapshot = state.snapshot;
  if (snapshot === null) {
    return;
  }
  const alivePaneIds = new Set(snapshot.panes.map((pane) => pane.pane_id));
  const closedPaneIds = paneFocusHistory.paneIds.filter((paneId) => alivePaneIds.has(paneId) === false);
  if (closedPaneIds.length > 0) {
    paneFocusHistory.remove(closedPaneIds);
  }
}

/**
 * Gives the focus to a pane, as a click on the pane does: a pinned pane takes the focus where it is, and any other pane
 * takes the focus in its own tab and its own workspace.
 * Nothing happens when the pane does not exist any more.
 * @param paneId - the name of the pane in Herdr
 */
function focusPane(paneId: string) {
  const pane = allPanes.value.find((candidate) => candidate.pane_id === paneId);
  if (pane === undefined) {
    return;
  }
  if (isPinned(paneId)) {
    pinnedPaneState.focus = paneId;
    ZenMode.focusPane(pane.pane_id, pane.tab_id);
    return;
  }
  selectPane(pane);
  pinnedPaneState.focus = null;
}

/**
 * Prepares a move through the history. The panes that were closed leave the history, and the focus that the developer
 * has now but that is not yet recorded goes into the history, so that "Back" returns to it.
 */
function prepareMove() {
  recordLater.cancel();
  removeClosedPanes();
  recordActivePane();
}

/** Returns the focus to the pane of the entry before the current entry. Nothing happens without such an entry. */
export function goBackInPaneFocusHistory() {
  prepareMove();
  const paneId = paneFocusHistory.goBack();
  if (paneId !== null) {
    focusPane(paneId);
  }
}

/** Gives the focus to the pane of the entry after the current entry. Nothing happens without such an entry. */
export function goForwardInPaneFocusHistory() {
  prepareMove();
  const paneId = paneFocusHistory.goForward();
  if (paneId !== null) {
    focusPane(paneId);
  }
}

/**
 * Gives the focus to the pane of one entry of the history, for example the entry that the developer chose in a list.
 * @param index - the place of the entry in the history
 */
export function goToPaneFocusHistoryEntry(index: number) {
  prepareMove();
  const paneId = paneFocusHistory.goTo(index);
  if (paneId !== null) {
    focusPane(paneId);
  }
}

// A change of focus is recorded once the pane has kept the focus for a short time. The "Back" button and the "Forward"
// button give the focus to the pane of the current entry, so recording that focus changes nothing.
watch(
  () => activePaneId(),
  () => recordLater.call(),
  { immediate: true },
);

// Closed panes leave the history (only once Herdr has answered: not at startup).
watch(
  () => state.snapshot,
  () => removeClosedPanes(),
);
