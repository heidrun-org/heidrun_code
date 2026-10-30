import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../lib/api";
import { launchAgent } from "./agents";
import { prepareAgentCommand } from "./coding_agent_start";
import { project, runLauncher } from "./project";
import { settings } from "./settings";
import type { Launcher } from "../lib/project_config";
import type { PaneInfo } from "../lib/types";

vi.mock("./workspace_folders", () => ({ WorkspaceFolders: { require: () => "/work/app" } }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => undefined) }));
vi.mock("../lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/api")>()),
  newTab: vi.fn(async () => ({ pane_id: "p1", tab_id: "t1" })),
  run: vi.fn(async () => undefined),
  request: vi.fn(async () => undefined),
  codexPrepareChat: vi.fn(async () => null),
  mireClaudeObserverModPath: vi.fn(async () => null),
  mireClaudeObservationFolder: vi.fn(async () => "/data/mire_claude_observations"),
}));
vi.mock("./session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./session")>()),
  refresh: vi.fn(async () => undefined),
  selectPane: vi.fn(),
  tabLabel: vi.fn(() => "Current tab"),
  toast: vi.fn(),
}));
vi.mock("./guards", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./guards")>()),
  allowCommand: vi.fn(async () => true),
}));

const CHAT_ID = "01a18b90-ca10-7083-b5e0-1bd76b17f8d8";
const MOD = "/data/mire_claude_observer";
const FOLDER = "/data/mire_claude_observations";

/** Launches a free agent in a new tab named `label`, and waits for the pause before the command is typed. */
async function launch(tool: "claude" | "codex", model: string | null = null, resumeId?: string, label: string = tool) {
  const launched = launchAgent({
    workspaceId: "w1",
    cwd: "/work/app",
    tool,
    agent: null,
    model,
    label,
    prompt: "",
    resumeId,
  });
  await vi.advanceTimersByTimeAsync(1_000);
  return launched;
}

/** Runs a launcher of the Launchers sidebar section, and waits for the pause before the command is typed. */
async function runAgentLauncher(launcher: Launcher) {
  project.byWorkspace.w1 = {
    root: "/work/app",
    config_path: "/work/app/.heidrun/config.json",
    config: { launchers: [launcher] } as never,
    detected: [],
  };
  const running = runLauncher("w1", launcher);
  await vi.advanceTimersByTimeAsync(1_000);
  await running;
}

beforeEach(() => {
  vi.useFakeTimers();
  settings.mireClaudeObserver = false;
  vi.mocked(api.run).mockClear();
  vi.mocked(api.request).mockReset().mockResolvedValue(undefined);
  vi.mocked(api.codexPrepareChat).mockReset().mockResolvedValue(null);
  vi.mocked(api.mireClaudeObserverModPath).mockReset().mockResolvedValue(null);
  project.panes = {};
  project.busy = {};
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Codex starts in the chat that Heidrun Code prepared (issue 969)", () => {
  it("starts codex resume with the chat identifier, named after the tab", async () => {
    vi.mocked(api.codexPrepareChat).mockResolvedValue(CHAT_ID);
    expect(await launch("codex", null, undefined, "Fix the tab bar")).toBe("ok");
    expect(api.codexPrepareChat).toHaveBeenCalledWith("/work/app", "Fix the tab bar", null);
    expect(api.run).toHaveBeenCalledWith("p1", `codex resume '${CHAT_ID}'`);
  });

  it("keeps the model after the chat identifier and gives it to the shared Codex server", async () => {
    vi.mocked(api.codexPrepareChat).mockResolvedValue(CHAT_ID);
    await launch("codex", "gpt-6-luna");
    expect(api.codexPrepareChat).toHaveBeenCalledWith("/work/app", "codex", "gpt-6-luna");
    expect(api.run).toHaveBeenCalledWith("p1", `codex resume '${CHAT_ID}' -m 'gpt-6-luna'`);
  });

  it("names the chat of a split pane after the current tab name, and creates it in the folder of the pane", async () => {
    vi.mocked(api.codexPrepareChat).mockResolvedValue(CHAT_ID);
    const pane = { pane_id: "p9", tab_id: "t9", workspace_id: "w1", cwd: "/work/other" } as PaneInfo;
    const launched = launchAgent({
      workspaceId: "w1",
      cwd: "/work/app",
      tool: "codex",
      agent: null,
      model: null,
      label: "",
      prompt: "",
      existingPane: pane,
    });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(await launched).toBe("ok");
    expect(api.codexPrepareChat).toHaveBeenCalledWith("/work/other", "Current tab", null);
    expect(api.run).toHaveBeenCalledWith("p9", `codex resume '${CHAT_ID}'`);
  });

  it("starts plain codex when the shared Codex server is not available", async () => {
    await launch("codex", "gpt-6-luna");
    expect(api.run).toHaveBeenCalledWith("p1", "codex -m 'gpt-6-luna'");
  });

  it("starts plain codex when the preparation fails", async () => {
    vi.mocked(api.codexPrepareChat).mockRejectedValue(new Error("no server"));
    await launch("codex");
    expect(api.run).toHaveBeenCalledWith("p1", "codex");
  });

  it("prepares no chat to resume a saved chat", async () => {
    await launch("codex", null, CHAT_ID);
    expect(api.codexPrepareChat).not.toHaveBeenCalled();
    expect(api.run).toHaveBeenCalledWith("p1", `codex resume '${CHAT_ID}'`);
  });

  it("starts a launcher of the kind Coding agent in its prepared chat, with its model, its effort, and its prompt", async () => {
    vi.mocked(api.codexPrepareChat).mockResolvedValue(CHAT_ID);
    await runAgentLauncher({
      id: "review",
      label: "Review",
      command: "codex -m 'gpt-6-luna' 'Review the diff'",
      agent: { name: "codex", model: "gpt-6-luna", prompt: "Review the diff" },
    });
    expect(api.codexPrepareChat).toHaveBeenCalledWith("/work/app", "Review", "gpt-6-luna");
    expect(api.run).toHaveBeenCalledWith("p1", `codex resume '${CHAT_ID}' -m 'gpt-6-luna' 'Review the diff'`);
  });

  it("types a launcher that does not start a coding agent as it is", async () => {
    vi.mocked(api.codexPrepareChat).mockResolvedValue(CHAT_ID);
    await runAgentLauncher({ id: "dev", label: "Dev", command: "pnpm dev" });
    expect(api.codexPrepareChat).not.toHaveBeenCalled();
    expect(api.run).toHaveBeenCalledWith("p1", "pnpm dev");
  });
});

describe("Claude Code loads the observer mod of the Mire when the Settings option is on (issue 969)", () => {
  it("starts plain claude when the option is off, which is the default", async () => {
    vi.mocked(api.mireClaudeObserverModPath).mockResolvedValue(MOD);
    await launch("claude");
    expect(api.mireClaudeObserverModPath).not.toHaveBeenCalled();
    expect(api.run).toHaveBeenCalledWith("p1", "claude");
  });

  it("adds the observation folder and the mod folder when the option is on", async () => {
    settings.mireClaudeObserver = true;
    vi.mocked(api.mireClaudeObserverModPath).mockResolvedValue(MOD);
    await launch("claude", "opus");
    expect(api.run).toHaveBeenCalledWith(
      "p1",
      `HEIDRUN_MIRE_OBSERVATION_DIR='${FOLDER}' claude --plugin-dir '${MOD}' --model 'opus'`,
    );
  });

  it("adds the mod to a resumed chat too", async () => {
    settings.mireClaudeObserver = true;
    vi.mocked(api.mireClaudeObserverModPath).mockResolvedValue(MOD);
    await launch("claude", null, CHAT_ID);
    expect(api.run).toHaveBeenCalledWith(
      "p1",
      `HEIDRUN_MIRE_OBSERVATION_DIR='${FOLDER}' claude --plugin-dir '${MOD}' --resume '${CHAT_ID}'`,
    );
  });

  it("starts claude without the mod when the application has no mod", async () => {
    settings.mireClaudeObserver = true;
    await launch("claude");
    expect(api.run).toHaveBeenCalledWith("p1", "claude");
  });

  it("starts a launcher that starts Claude Code with the mod", async () => {
    settings.mireClaudeObserver = true;
    vi.mocked(api.mireClaudeObserverModPath).mockResolvedValue(MOD);
    await runAgentLauncher({
      id: "plan",
      label: "Plan",
      command: "claude 'Plan the work'",
      agent: { name: "claude", prompt: "Plan the work" },
    });
    expect(api.run).toHaveBeenCalledWith(
      "p1",
      `HEIDRUN_MIRE_OBSERVATION_DIR='${FOLDER}' claude --plugin-dir '${MOD}' 'Plan the work'`,
    );
  });
});

describe("prepareAgentCommand", () => {
  it("changes no other command and no subcommand", async () => {
    settings.mireClaudeObserver = true;
    vi.mocked(api.mireClaudeObserverModPath).mockResolvedValue(MOD);
    vi.mocked(api.codexPrepareChat).mockResolvedValue(CHAT_ID);
    const options = { cwd: "/work/app", name: "Tab", model: null };
    expect((await prepareAgentCommand("agy -i 'Hi'", options)).command).toBe("agy -i 'Hi'");
    expect((await prepareAgentCommand("codex exec 'Hi'", options)).command).toBe("codex exec 'Hi'");
    expect((await prepareAgentCommand("claude mcp list", options)).command).toBe("claude mcp list");
    expect(api.codexPrepareChat).not.toHaveBeenCalled();
  });

  it("prepares no Codex chat without a folder", async () => {
    vi.mocked(api.codexPrepareChat).mockResolvedValue(CHAT_ID);
    expect(await prepareAgentCommand("codex", { cwd: null, name: "Tab", model: null })).toEqual({ command: "codex", codexChatId: null });
    expect(api.codexPrepareChat).not.toHaveBeenCalled();
  });
});

/** The calls of `pane.report_agent_session` that the frontend sent to Herdr. */
function agentSessionReports() {
  return vi.mocked(api.request).mock.calls.filter((call) => call[0] === "pane.report_agent_session");
}

describe("Herdr learns the chat of a prepared Codex pane", () => {
  it("reports the chat identifier for the exact pane after the command is typed, with the source herdr:codex", async () => {
    vi.mocked(api.codexPrepareChat).mockResolvedValue(CHAT_ID);
    await launch("codex");
    const reports = agentSessionReports();
    expect(reports).toHaveLength(1);
    expect(reports[0][1]).toEqual({
      pane_id: "p1",
      source: "herdr:codex",
      agent: "codex",
      seq: expect.any(Number),
      agent_session_id: CHAT_ID,
    });
    expect(vi.mocked(api.run).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(api.request).mock.invocationCallOrder[0]);
  });

  it("reports the chat of a launcher for its pane", async () => {
    vi.mocked(api.codexPrepareChat).mockResolvedValue(CHAT_ID);
    await runAgentLauncher({ id: "codex", label: "Codex", command: "codex" });
    expect(agentSessionReports().map((call) => call[1])).toEqual([
      expect.objectContaining({ pane_id: "p1", agent_session_id: CHAT_ID }),
    ]);
  });

  it("gives increasing sequence numbers", async () => {
    vi.mocked(api.codexPrepareChat).mockResolvedValue(CHAT_ID);
    await launch("codex");
    await launch("codex");
    const sequences = agentSessionReports().map((call) => (call[1] as { seq: number }).seq);
    expect(sequences[1]).toBeGreaterThan(sequences[0]);
    expect(JSON.stringify(sequences[1])).toMatch(/^\d+$/);
  });

  it("sends no report for a plain codex, for a resumed chat, and for Claude Code", async () => {
    await launch("codex");
    await launch("codex", null, CHAT_ID);
    settings.mireClaudeObserver = true;
    vi.mocked(api.mireClaudeObserverModPath).mockResolvedValue(MOD);
    await launch("claude");
    expect(agentSessionReports()).toHaveLength(0);
  });

  it("starts the pane even when the report fails", async () => {
    vi.mocked(api.codexPrepareChat).mockResolvedValue(CHAT_ID);
    vi.mocked(api.request).mockRejectedValue(new Error("herdr_unreachable"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await launch("codex")).toBe("ok");
    expect(api.run).toHaveBeenCalledWith("p1", `codex resume '${CHAT_ID}'`);
    warn.mockRestore();
  });
});
