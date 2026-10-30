import "./dev/install_tauri_mock";
import { DurableStorage } from "./lib/durable_storage";
import { MIRE_LOCAL_NETWORK_PATH } from "./lib/mire/mire_local_network_path";

// The stores read their saved state when their file is imported, so the restore of `localStorage` comes first (issue 772).
// The separate Mire window loads the same page with the query `window=mire`: it starts only the Mire, after the main
// window restored `localStorage`, and it never copies `localStorage`, so that only the main window writes the copy
// (issue 973).
// The Mire server of the desktop application serves the same page at the address `/mire` to a phone or a tablet of the
// local network: it starts only the read-only Mire, with no Tauri bridge (issue 978).
async function start(): Promise<void> {
  if (window.location.pathname === MIRE_LOCAL_NETWORK_PATH) {
    await import("./start_mire_local_network");
    return;
  }
  if (new URLSearchParams(window.location.search).get("window") === "mire") {
    await import("./start_mire_window");
    return;
  }
  await DurableStorage.restore();
  await import("./lib/legacy_storage");
  await import("./start_application");
  DurableStorage.startMirroring();
}

void start();
