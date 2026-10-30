import "./dev/install_tauri_mock";
import { DurableStorage } from "./lib/durable_storage";

// The stores read their saved state when their file is imported, so the restore of `localStorage` comes first (issue 772).
// The separate Mire window loads the same page with the query `window=mire`: it starts only the Mire, after the main
// window restored `localStorage`, and it never copies `localStorage`, so that only the main window writes the copy
// (issue 973).
async function start(): Promise<void> {
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
