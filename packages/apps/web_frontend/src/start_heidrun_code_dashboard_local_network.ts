// Starts the Heidrun Code Dashboard page of a phone or a tablet of the local network. main.ts imports this file instead of
// `start_application.ts` when the Heidrun Code Dashboard server of the desktop application serves the page at the address `/heidrun_code_dashboard`. The page
// has no Tauri bridge: it only reads the state of the Heidrun Code Dashboard from the Heidrun Code Dashboard server, and mounts only the Heidrun Code Dashboard view (issue 978).

import { createApp } from "vue";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./bootstrap_parts.scss";
import "./styles.css";
import HeidrunCodeDashboardLocalNetworkRoot from "./components/heidrun_code_dashboard/HeidrunCodeDashboardLocalNetworkRoot.vue";
import { HeidrunCodeDashboardLocalNetworkSession } from "./stores/heidrun_code_dashboard/heidrun_code_dashboard_local_network_session";
import { HeidrunCodeDashboardStore } from "./stores/heidrun_code_dashboard/heidrun_code_dashboard_store";
import "./stores/theme";
import "./i18n/index";

HeidrunCodeDashboardStore.useDisplayMode("localNetwork");
void HeidrunCodeDashboardLocalNetworkSession.start();
createApp(HeidrunCodeDashboardLocalNetworkRoot).mount("#app");
