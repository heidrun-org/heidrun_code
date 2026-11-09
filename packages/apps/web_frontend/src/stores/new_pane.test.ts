import { beforeEach, describe, expect, it, vi } from "vitest";

const launchAgent = vi.hoisted(() => vi.fn(async () => "ok"));
const newTerminal = vi.hoisted(() => vi.fn());
const splitPane = vi.hoisted(() => vi.fn(async (): Promise<typeof splitPaneResult | undefined> => splitPaneResult));
const splitPaneResult = vi.hoisted(() => ({ pane_id: "w1:p2", tab_id: "w1:t1", workspace_id: "w1" }));
const rootPane = vi.hoisted(() => ({ pane_id: "w2:p1", tab_id: "w2:t1", workspace_id: "w2" }));
const newWorkspace = vi.hoisted(() => vi.fn(async (): Promise<typeof rootPane | undefined> => rootPane));
const selectedWorkspace = vi.hoisted(() => ({ value: { workspace_id: "w1" } as { workspace_id: string } | null }));
const selectedPane = vi.hoisted(() => ({ value: { cwd: "/work/project", foreground_cwd: "/work/project/src" } }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => []) }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));
vi.mock("./agents", () => ({ launchAgent }));
vi.mock("./session", () => ({ newTerminal, newWorkspace, selectedPane, selectedWorkspace, splitPane }));
vi.mock('./workspace_folders', () => ({ WorkspaceFolders: { get: () => '/work/project' } }));

/** A click on the plus button of the tab bar, with or without the key Shift. */
function click(isShift: boolean): MouseEvent {
  return new MouseEvent("click", { shiftKey: isShift });
}

beforeEach(() => {
  localStorage.clear();
  launchAgent.mockClear();
  newTerminal.mockClear();
  splitPane.mockClear();
  splitPane.mockResolvedValue(splitPaneResult);
  newWorkspace.mockClear();
  newWorkspace.mockResolvedValue(rootPane);
  vi.resetModules();
});

describe("the plus button of the tab bar (issue #328)", () => {
  it("starts a terminal, and opens no window, when the default command is Terminal", async () => {
    const { NewPane } = await import("./new_pane");
    NewPane.onNewPaneClick(click(false));
    expect(newTerminal).toHaveBeenCalledTimes(1);
    expect(launchAgent).not.toHaveBeenCalled();
  });

  it.each(["claude", "codex", "agy"] as const)("starts a free agent %s with the default model and no starting prompt", async (command) => {
    const { settings } = await import("./settings");
    settings.newTabCommand = command;
    const { NewPane } = await import("./new_pane");
    NewPane.onNewPaneClick(click(false));
    await vi.waitFor(() => expect(launchAgent).toHaveBeenCalledTimes(1));
    expect(launchAgent).toHaveBeenCalledWith({
      workspaceId: "w1",
      cwd: "/work/project",
      tool: command,
      agent: null,
      model: null,
      label: command,
      prompt: "",
    });
    expect(newTerminal).not.toHaveBeenCalled();
  });

  it("starts the default command even when a previous pane was saved, without the key Shift", async () => {
    const { settings } = await import("./settings");
    settings.newTabCommand = "claude";
    const { NewPane } = await import("./new_pane");
    localStorage.setItem("heidrun.newPane", JSON.stringify({ tool: "codex", text: "old prompt" }));
    NewPane.onNewPaneClick(click(false));
    await vi.waitFor(() => expect(launchAgent).toHaveBeenCalledTimes(1));
    expect(launchAgent.mock.calls[0]).toMatchObject([{ tool: "claude" }]);
    expect(newTerminal).not.toHaveBeenCalled();
  });

  it.each(["claude", "codex", "agy"] as const)("starts a terminal with the key Shift when the default command is %s (issue #465)", async (command) => {
    const { settings } = await import("./settings");
    settings.newTabCommand = command;
    const { NewPane } = await import("./new_pane");
    NewPane.onNewPaneClick(click(true));
    expect(newTerminal).toHaveBeenCalledTimes(1);
    expect(launchAgent).not.toHaveBeenCalled();
  });

  it("starts a terminal with the key Shift, also when a previous pane was saved (issue #465)", async () => {
    const { settings } = await import("./settings");
    settings.newTabCommand = "claude";
    const { NewPane } = await import("./new_pane");
    localStorage.setItem("heidrun.newPane", JSON.stringify({ tool: "codex", text: "old prompt" }));
    NewPane.onNewPaneClick(click(true));
    expect(newTerminal).toHaveBeenCalledTimes(1);
    expect(launchAgent).not.toHaveBeenCalled();
  });
});

describe("the split controls of a pane (issue #465)", () => {
  it.each(["right", "down"] as const)("splits %s and starts the default command in the new pane, without the key Shift", async (direction) => {
    const { settings } = await import("./settings");
    settings.newTabCommand = "codex";
    const { NewPane } = await import("./new_pane");
    await NewPane.onSplitPaneClick(click(false), direction, "w1:p1");
    expect(splitPane).toHaveBeenCalledWith(direction, "w1:p1");
    expect(launchAgent).toHaveBeenCalledTimes(1);
    expect(launchAgent).toHaveBeenCalledWith({
      workspaceId: "w1",
      cwd: "/work/project",
      tool: "codex",
      agent: null,
      model: null,
      label: "",
      prompt: "",
      existingPane: splitPaneResult,
    });
  });

  it("keeps the name of the tab: the label of the command is empty", async () => {
    const { settings } = await import("./settings");
    settings.newTabCommand = "claude";
    const { NewPane } = await import("./new_pane");
    await NewPane.onSplitPaneClick(click(false), "right", "w1:p1");
    expect(launchAgent).toHaveBeenCalledWith(expect.objectContaining({ tool: "claude", label: "" }));
  });

  it.each(["right", "down"] as const)("splits %s and starts a terminal only, with the key Shift", async (direction) => {
    const { settings } = await import("./settings");
    settings.newTabCommand = "codex";
    const { NewPane } = await import("./new_pane");
    await NewPane.onSplitPaneClick(click(true), direction, "w1:p1");
    expect(splitPane).toHaveBeenCalledWith(direction, "w1:p1");
    expect(launchAgent).not.toHaveBeenCalled();
  });

  it.each(["right", "down"] as const)("splits %s and starts a terminal only, when the default command is Terminal", async (direction) => {
    const { NewPane } = await import("./new_pane");
    await NewPane.onSplitPaneClick(click(false), direction, "w1:p1");
    expect(splitPane).toHaveBeenCalledWith(direction, "w1:p1");
    expect(launchAgent).not.toHaveBeenCalled();
  });

  it("starts no command when the pane was not split", async () => {
    const { settings } = await import("./settings");
    settings.newTabCommand = "codex";
    splitPane.mockResolvedValue(undefined);
    const { NewPane } = await import("./new_pane");
    await NewPane.onSplitPaneClick(click(false), "right", "w1:p1");
    expect(launchAgent).not.toHaveBeenCalled();
  });

  it("starts the default command for the shortcut Command+D, for the selected pane", async () => {
    const { settings } = await import("./settings");
    settings.newTabCommand = "codex";
    const { NewPane } = await import("./new_pane");
    await NewPane.startDefaultSplit("right");
    expect(splitPane).toHaveBeenCalledWith("right", undefined);
    expect(launchAgent).toHaveBeenCalledWith(expect.objectContaining({ tool: "codex", existingPane: splitPaneResult }));
  });
});

describe("the shortcut Command+T (issue #340)", () => {
  it("starts the default command of a new tab, the same command as the plus button", async () => {
    const { settings } = await import("./settings");
    settings.newTabCommand = "codex";
    const { NewPane } = await import("./new_pane");
    await NewPane.startDefaultNewTab();
    expect(launchAgent).toHaveBeenCalledTimes(1);
    expect(launchAgent).toHaveBeenCalledWith(expect.objectContaining({ tool: "codex", agent: null, prompt: "" }));
    expect(newTerminal).not.toHaveBeenCalled();
  });
});

describe("the list of the commands of the plus button (issue #980)", () => {
  it.each(["claude", "codex", "agy"] as const)("starts %s in a new tab, whatever the default command is", async (command) => {
    const { settings } = await import("./settings");
    settings.newTabCommand = "terminal";
    const { NewPane } = await import("./new_pane");
    await NewPane.startNewTab(command);
    expect(launchAgent).toHaveBeenCalledTimes(1);
    expect(launchAgent).toHaveBeenCalledWith(expect.objectContaining({ tool: command, label: command, agent: null, prompt: "" }));
    expect(newTerminal).not.toHaveBeenCalled();
  });

  it("starts a terminal in a new tab when the default command is a coding agent", async () => {
    const { settings } = await import("./settings");
    settings.newTabCommand = "claude";
    const { NewPane } = await import("./new_pane");
    await NewPane.startNewTab("terminal");
    expect(newTerminal).toHaveBeenCalledTimes(1);
    expect(launchAgent).not.toHaveBeenCalled();
  });

  it("gives the terminal and only the coding agents switched on in the Settings window", async () => {
    const { settings } = await import("./settings");
    const { NewTabCommands } = await import("./new_tab_commands");
    settings.ownedAgents = ["codex"];
    expect(NewTabCommands.available().map((command) => command.id)).toEqual(["terminal", "codex"]);
    settings.ownedAgents = ["claude", "codex", "antigravity"];
    expect(NewTabCommands.available().map((command) => command.id)).toEqual(["terminal", "claude", "codex", "agy"]);
  });
});

describe("the entry New workspace (issue #379)", () => {
  it("creates the workspace and opens no other tab when the default command is Terminal", async () => {
    const { NewPane } = await import("./new_pane");
    await NewPane.openNewWorkspace("/work/app", "app");
    expect(newWorkspace).toHaveBeenCalledWith("/work/app", "app");
    expect(newTerminal).not.toHaveBeenCalled();
    expect(launchAgent).not.toHaveBeenCalled();
  });

  it.each(["claude", "codex", "agy"] as const)(
    "starts a free agent %s in the first pane of the new workspace, and creates no other tab",
    async (command) => {
      const { settings } = await import("./settings");
      settings.newTabCommand = command;
      const { NewPane } = await import("./new_pane");
      await NewPane.openNewWorkspace("/work/app", "app");
      expect(launchAgent).toHaveBeenCalledTimes(1);
      expect(launchAgent).toHaveBeenCalledWith(
        expect.objectContaining({ tool: command, agent: null, prompt: "", label: command, existingPane: rootPane }),
      );
      expect(newTerminal).not.toHaveBeenCalled();
    },
  );

  it("starts no command when Herdr did not create the workspace", async () => {
    const { settings } = await import("./settings");
    settings.newTabCommand = "claude";
    newWorkspace.mockResolvedValue(undefined);
    const { NewPane } = await import("./new_pane");
    await NewPane.openNewWorkspace("/work/app", "app");
    expect(launchAgent).not.toHaveBeenCalled();
  });
});
