import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());
const open = vi.hoisted(() => vi.fn(async () => true));
const toast = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("./file_view_panes", () => ({ FileViewPanes: { open } }));
vi.mock("./session", () => ({ toast }));
vi.mock("../i18n/index", () => ({ t: (key: string) => key }));

import { openFileRef } from "./files";
import { answerChoice, answerConfirm, confirmDialog } from "./confirm";
import { settings } from "./settings";

const SHOT = "/var/folders/h2/T/claude-chrome-screenshots/screenshot-1.png";

/** `files_resolve` for a project file, and for the screenshot outside the project. */
function resolveLikeTheBackend(command: string, args: { path: string }) {
  if (command === "file_open_default") return Promise.resolve();
  if (args.path === "src/app.ts") return Promise.resolve({ root: "/work/project", path: "src/app.ts", outside: false });
  return Promise.resolve({ root: "/var/folders/h2/T/claude-chrome-screenshots", path: "screenshot-1.png", outside: true });
}

/** Waits until the confirmation modal is open. */
async function modalOpened() {
  await vi.waitFor(() => expect(confirmDialog.open).toBe(true));
}

beforeEach(() => {
  answerConfirm(false);
  invoke.mockReset();
  invoke.mockImplementation(resolveLikeTheBackend);
  open.mockClear();
  toast.mockReset();
  settings.filesOutsideWorkspace = "ask";
});

describe("openFileRef, a file outside the project (issue #956)", () => {
  it("opens a file of the project at once, without a question", async () => {
    await openFileRef("/work/project", "src/app.ts", 42);
    expect(confirmDialog.open).toBe(false);
    expect(open).toHaveBeenCalledWith("/work/project/src/app.ts", 42);
  });

  it("opens the file in a file view pane after Open in Heidrun Code, and shows no toast", async () => {
    const opening = openFileRef("/work/project", SHOT);
    await modalOpened();
    expect(confirmDialog.rememberLabel).toBe("filesStore.outsideRemember");
    answerConfirm(true);
    await opening;
    expect(invoke).toHaveBeenLastCalledWith("files_resolve", { cwd: "/work/project", path: SHOT, allowOutside: true });
    expect(open).toHaveBeenCalledWith(SHOT, null);
    expect(toast).not.toHaveBeenCalled();
    expect(settings.filesOutsideWorkspace).toBe("ask");
  });

  it("opens nothing after No", async () => {
    const opening = openFileRef("/work/project", SHOT);
    await modalOpened();
    answerConfirm(false);
    await opening;
    expect(open).not.toHaveBeenCalled();
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(settings.filesOutsideWorkspace).toBe("ask");
  });

  it("opens the file in the default app of macOS after Open in the default app, and opens no pane", async () => {
    const opening = openFileRef("/work/project", SHOT);
    await modalOpened();
    answerChoice("openDefault");
    await opening;
    expect(invoke).toHaveBeenCalledWith("files_resolve", { cwd: "/work/project", path: SHOT, allowOutside: true });
    expect(invoke).toHaveBeenLastCalledWith("file_open_default", { root: "/var/folders/h2/T/claude-chrome-screenshots", path: "screenshot-1.png" });
    expect(open).not.toHaveBeenCalled();
    expect(settings.filesOutsideWorkspace).toBe("ask");
  });

  it("remembers Open in the default app: the next file opens there without the modal", async () => {
    const first = openFileRef("/work/project", SHOT);
    await modalOpened();
    confirmDialog.isRemembered = true;
    answerChoice("openDefault");
    await first;
    expect(settings.filesOutsideWorkspace).toBe("openDefault");
    invoke.mockClear();
    await openFileRef("/work/project", SHOT);
    expect(confirmDialog.open).toBe(false);
    expect(invoke).toHaveBeenLastCalledWith("file_open_default", { root: "/var/folders/h2/T/claude-chrome-screenshots", path: "screenshot-1.png" });
    expect(open).not.toHaveBeenCalled();
  });

  it("remembers Open in Heidrun Code: the next file outside the project opens without the modal", async () => {
    const first = openFileRef("/work/project", SHOT);
    await modalOpened();
    confirmDialog.isRemembered = true;
    answerConfirm(true);
    await first;
    expect(settings.filesOutsideWorkspace).toBe("open");
    open.mockClear();
    await openFileRef("/work/project", SHOT);
    expect(confirmDialog.open).toBe(false);
    expect(open).toHaveBeenCalledWith(SHOT, null);
  });

  it("remembers No: the next file outside the project never opens, shows no modal, and a toast says why", async () => {
    const first = openFileRef("/work/project", SHOT);
    await modalOpened();
    confirmDialog.isRemembered = true;
    answerConfirm(false);
    await first;
    expect(settings.filesOutsideWorkspace).toBe("never");
    await openFileRef("/work/project", SHOT);
    expect(confirmDialog.open).toBe(false);
    expect(open).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith("filesStore.outsideNever");
  });

  it("asks again when the setting is back to Ask", async () => {
    settings.filesOutsideWorkspace = "never";
    settings.filesOutsideWorkspace = "ask";
    const opening = openFileRef("/work/project", SHOT);
    await modalOpened();
    answerConfirm(false);
    await opening;
  });

  it("keeps the toast of a path that does not exist", async () => {
    invoke.mockRejectedValueOnce("missing.txt not found from /work/project");
    await openFileRef("/work/project", "missing.txt");
    expect(toast).toHaveBeenCalledWith("missing.txt not found from /work/project");
    expect(confirmDialog.open).toBe(false);
  });
});
