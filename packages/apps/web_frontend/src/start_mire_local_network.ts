// Starts the Mire page of a phone or a tablet of the local network. main.ts imports this file instead of
// `start_application.ts` when the Mire server of the desktop application serves the page at the address `/mire`. The page
// has no Tauri bridge: it only reads the state of the Mire from the Mire server, and mounts only the Mire view (issue 978).

import { createApp } from "vue";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./bootstrap_parts.scss";
import "./styles.css";
import MireLocalNetworkRoot from "./components/mire/MireLocalNetworkRoot.vue";
import { MireLocalNetworkSession } from "./stores/mire/mire_local_network_session";
import { MireStore } from "./stores/mire/mire_store";
import "./stores/theme";
import "./i18n/index";

MireStore.useDisplayMode("localNetwork");
void MireLocalNetworkSession.start();
createApp(MireLocalNetworkRoot).mount("#app");
