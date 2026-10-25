// The one pane focus history of the window. It sits in its own file, with no import of the session store, so that the
// session store can read it when a tab closes. The store `pane_focus_history.ts` records the focus in it.
// - issue #862
import { reactive } from "vue";
import { PaneFocusHistory } from "../lib/pane_focus_history";

/** The history of the panes that had the focus, in every workspace and every tab. */
export const paneFocusHistory = reactive(new PaneFocusHistory());
