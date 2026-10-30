// Starts the separate Mire window. main.ts imports this file instead of `start_application.ts` when the page has the
// query `window=mire`. It mounts only the Mire view: no second mobile server, no second status item, no second voice
// input, no notification, and no reading of the Herdr session other than the snapshot that the Mire needs (issue 973).

import { createApp } from "vue";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./bootstrap_parts.scss";
import "./styles.css";
import MireWindowRoot from "./components/mire/MireWindowRoot.vue";
import { MireStore } from "./stores/mire/mire_store";
import { MireWindowSession } from "./stores/mire/mire_window_session";
import "./stores/theme";
import "./i18n/index";

MireStore.useDisplayMode("window");
void MireWindowSession.start();
createApp(MireWindowRoot).mount("#app");
