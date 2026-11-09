// @vitest-environment node
import Fs from "node:fs";
import Path from "node:path";
import { describe, expect, it } from "vitest";

const entryText = Fs.readFileSync(Path.join(import.meta.dirname, "start_heidrun_code_dashboard_window.ts"), "utf8");
const mainText = Fs.readFileSync(Path.join(import.meta.dirname, "main.ts"), "utf8");

/** The import lines of the entry of the separate Heidrun Code Dashboard window. */
const importLines = entryText.match(/^import\s.*$/gm) ?? [];

describe("the entry of the separate Heidrun Code Dashboard window (issue 973)", () => {
  it("is chosen by main.ts from the query window=heidrun_code_dashboard, before the restore and the copy of localStorage", () => {
    const choice = mainText.indexOf("get(\"window\") === \"heidrun_code_dashboard\"");
    const entry = mainText.indexOf("await import(\"./start_heidrun_code_dashboard_window\")");
    const restore = mainText.indexOf("await DurableStorage.restore()");
    expect(choice).toBeGreaterThan(0);
    expect(entry).toBeGreaterThan(choice);
    expect(entry).toBeLessThan(restore);
    expect(mainText.slice(entry, restore)).toContain("return;");
  });

  it("mounts only the Heidrun Code Dashboard view, with the Herdr snapshot of the window and the display mode window", () => {
    expect(importLines).toContain("import HeidrunCodeDashboardWindowRoot from \"./components/heidrun_code_dashboard/HeidrunCodeDashboardWindowRoot.vue\";");
    expect(entryText).toContain("HeidrunCodeDashboardStore.useDisplayMode(\"window\");");
    expect(entryText).toContain("void HeidrunCodeDashboardWindowSession.start();");
    expect(entryText).toContain("createApp(HeidrunCodeDashboardWindowRoot).mount(\"#app\");");
  });

  it.each([
    "App.vue",
    "start_application",
    "legacy_storage",
    "durable_storage",
    "stores/mobile",
    "status_item",
    "voice_input",
    "stores/alerts",
    "stores/git",
    "user_activity",
  ])("starts nothing of the main window: no import of %s", (name) => {
    expect(importLines.filter((line) => line.includes(name))).toEqual([]);
  });

  it("never starts the session store of the main window, which notifies and pushes to the phone", () => {
    expect(importLines.filter((line) => line.includes("stores/session"))).toEqual([]);
    expect(entryText).not.toMatch(/(^|[^.\w])start\(\)/m);
    expect(entryText).not.toContain("refresh(");
    expect(entryText).not.toContain("startHerdr");
  });
});
