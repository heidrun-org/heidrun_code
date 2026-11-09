// Starts the separate Heidrun Code Dashboard window. main.ts imports this file instead of `start_application.ts` when the page has the
// query `window=heidrun_code_dashboard`. It mounts only the Heidrun Code Dashboard view: no second mobile server, no second status item, no second voice
// input, no notification, and no reading of the Herdr session other than the snapshot that the Heidrun Code Dashboard needs (issue 973).

import { createApp } from "vue";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./bootstrap_parts.scss";
import "./styles.css";
import HeidrunCodeDashboardWindowRoot from "./components/heidrun_code_dashboard/HeidrunCodeDashboardWindowRoot.vue";
import { HeidrunCodeDashboardStore } from "./stores/heidrun_code_dashboard/heidrun_code_dashboard_store";
import { HeidrunCodeDashboardWindowSession } from "./stores/heidrun_code_dashboard/heidrun_code_dashboard_window_session";
import "./stores/theme";
import "./i18n/index";

HeidrunCodeDashboardStore.useDisplayMode("window");
void HeidrunCodeDashboardWindowSession.start();
createApp(HeidrunCodeDashboardWindowRoot).mount("#app");
