import "./dev/install_tauri_mock";
import { DurableStorage } from "./lib/durable_storage";
import { HEIDRUN_CODE_DASHBOARD_LOCAL_NETWORK_PATH } from "./lib/heidrun_code_dashboard/heidrun_code_dashboard_local_network_path";

// The stores read their saved state when their file is imported, so the restore of `localStorage` comes first (issue 772).
// The separate Heidrun Code Dashboard window loads the same page with the query `window=heidrun_code_dashboard`: it starts only the Heidrun Code Dashboard, after the main
// window restored `localStorage`, and it never copies `localStorage`, so that only the main window writes the copy
// (issue 973).
// The Heidrun Code Dashboard server of the desktop application serves the same page at the address `/heidrun_code_dashboard` to a phone or a tablet of the
// local network: it starts only the read-only Heidrun Code Dashboard, with no Tauri bridge (issue 978).
async function start(): Promise<void> {
  if (window.location.pathname === HEIDRUN_CODE_DASHBOARD_LOCAL_NETWORK_PATH) {
    await import("./start_heidrun_code_dashboard_local_network");
    return;
  }
  if (new URLSearchParams(window.location.search).get("window") === "heidrun_code_dashboard") {
    await import("./start_heidrun_code_dashboard_window");
    return;
  }
  await DurableStorage.restore();
  await import("./lib/legacy_storage");
  await import("./start_application");
  DurableStorage.startMirroring();
}

void start();
