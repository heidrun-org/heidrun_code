import { beforeEach, describe, expect, it, vi } from "vitest";
import { launchAgent } from "./agents";
import { chatAboutFile, chatAboutReference } from "./chat_open";
import { state } from "./session";
import { settings } from "./settings";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => undefined) }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn(async () => {}) }));
vi.mock("./agents", () => ({ launchAgent: vi.fn(async () => "ok") }));

const URL = "https://github.com/heidrun-org/heidrun_code/issues/851";

beforeEach(() => {
  vi.mocked(launchAgent).mockClear();
  state.selectedWorkspaceId = "w1";
  settings.newTabCommand = "terminal";
});

describe("chatAboutReference", () => {
  it("starts Claude in a new tab of the selected workspace with the first message about the web address", async () => {
    await chatAboutReference(URL, "#851", "/work/app");
    expect(launchAgent).toHaveBeenCalledWith({
      workspaceId: "w1",
      cwd: "/work/app",
      tool: "claude",
      agent: null,
      model: null,
      label: "#851",
      prompt: `Let's chat about ${URL}`,
    });
  });

  it("starts the coding agent of the setting New tab when this setting is a coding agent", async () => {
    settings.newTabCommand = "codex";
    await chatAboutReference(URL, "#851", "/work/app");
    expect(vi.mocked(launchAgent).mock.calls[0][0].tool).toBe("codex");
  });

  it("starts nothing when no workspace is selected", async () => {
    state.selectedWorkspaceId = null;
    await chatAboutReference(URL, "#851", "/work/app");
    expect(launchAgent).not.toHaveBeenCalled();
  });
});

describe("chatAboutFile", () => {
  it("starts Claude in a new tab named after the file with the first message about the absolute path", async () => {
    await chatAboutFile("/work/app/src/main.ts", "main.ts", "/work/app");
    expect(launchAgent).toHaveBeenCalledWith({
      workspaceId: "w1",
      cwd: "/work/app",
      tool: "claude",
      agent: null,
      model: null,
      label: "main.ts",
      prompt: "Let's chat about /work/app/src/main.ts",
    });
  });

  it("starts the coding agent of the setting New tab when this setting is a coding agent", async () => {
    settings.newTabCommand = "codex";
    await chatAboutFile("/work/app/src/main.ts", "main.ts", "/work/app");
    expect(vi.mocked(launchAgent).mock.calls[0][0].tool).toBe("codex");
  });

  it("starts nothing when no workspace is selected", async () => {
    state.selectedWorkspaceId = null;
    await chatAboutFile("/work/app/src/main.ts", "main.ts", "/work/app");
    expect(launchAgent).not.toHaveBeenCalled();
  });
});
