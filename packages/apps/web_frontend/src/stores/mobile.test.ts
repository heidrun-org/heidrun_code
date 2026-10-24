import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../lib/api";
import { guardHit } from "./guards";
import { macros } from "./macros";
import { handleMobileCall } from "./mobile";
import { project, runLauncher, stopLauncher } from "./project";
import { state } from "./session";
import { settings } from "./settings";
import { userLaunchers } from "./user_launchers";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => undefined) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock("../lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/api")>()),
  prompt: vi.fn(async () => undefined),
  read: vi.fn(async () => "terminal output"),
  run: vi.fn(async () => undefined),
  sendKeys: vi.fn(async () => undefined),
}));
vi.mock("./guards", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./guards")>()),
  guardHit: vi.fn(async () => null),
}));
vi.mock("./project", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./project")>()),
  runLauncher: vi.fn(async () => undefined),
  stopLauncher: vi.fn(async () => undefined),
}));
vi.mock("./session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./session")>()),
  toast: vi.fn(),
}));

const LAUNCHER = { id: "dev", label: "Dev server", command: "pnpm dev" };
const USER_LAUNCHER = { id: "everywhere", label: "In every workspace", command: "make everywhere" };

beforeEach(() => {
  userLaunchers.list = [];
  settings.mobileTerminalTyping = true;
  vi.mocked(api.prompt).mockClear();
  vi.mocked(api.run).mockClear();
  vi.mocked(api.sendKeys).mockClear();
  vi.mocked(guardHit).mockReset();
  vi.mocked(guardHit).mockResolvedValue(null);
  vi.mocked(runLauncher).mockClear();
  vi.mocked(stopLauncher).mockClear();
  state.snapshot = {
    workspaces: [
      { workspace_id: "w1", label: "heidrun", number: 1 },
      { workspace_id: "w2", label: "website", number: 2 },
    ],
    tabs: [{ tab_id: "t1", workspace_id: "w1", label: "fix-35" }],
    panes: [
      { pane_id: "p1", tab_id: "t1", workspace_id: "w1", cwd: "/work/heidrun", agent: "claude", agent_status: "idle" },
      { pane_id: "p2", tab_id: "t1", workspace_id: "w1", cwd: "/work/heidrun", agent: null, agent_status: "unknown", label: "shell" },
    ],
  } as never;
  macros.personal = [{ id: "progress", label: "Progress", description: "Where are you?", text: "Where are you? {agent}" }];
  project.byWorkspace.w1 = {
    root: "/work/heidrun",
    config: { version: 1, launchers: [LAUNCHER], prompts: [{ id: "review", label: "Review", text: "Review the branch" }] },
  } as never;
  project.byWorkspace.w2 = { root: "/work/website", config: { version: 1, launchers: [] } } as never;
  project.errors.w1 = undefined;
  project.errors.w2 = undefined;
});

describe("a plain terminal", () => {
  it("is in the state, with hasCodingAgent false, next to the pane of a coding agent", async () => {
    const answer = (await handleMobileCall("state", {})) as { workspaces: { agents: { paneId: string; hasCodingAgent: boolean }[] }[] };
    const panes = answer.workspaces.flatMap((w) => w.agents);
    expect(panes.map((p) => [p.paneId, p.hasCodingAgent])).toEqual([
      ["p1", true],
      ["p2", false],
    ]);
  });

  it("can be read", async () => {
    expect(await handleMobileCall("read", { paneId: "p2", lines: 60 })).toEqual({ text: "terminal output" });
  });

  it("refuses the calls other than read and prompt: an answer, a key, and the macros", async () => {
    for (const method of ["answer", "keys", "macros"]) {
      const answer = await handleMobileCall(method, { paneId: "p2", text: "ls", action: "interrupt", n: 1 });
      expect(answer, method).toHaveProperty("error");
    }
    expect(api.sendKeys).not.toHaveBeenCalled();
  });

  it("types a command that the guards let through, with the same function as a launcher", async () => {
    expect(await handleMobileCall("prompt", { paneId: "p2", text: "git status" })).toEqual({ ok: true });
    expect(guardHit).toHaveBeenCalledWith("git status", "/work/heidrun");
    expect(api.run).toHaveBeenCalledWith("p2", "git status");
    expect(api.prompt).not.toHaveBeenCalled();
  });

  it("asks the phone to confirm a command that the guards stop, then types it once confirmed", async () => {
    vi.mocked(guardHit).mockResolvedValue({ level: "confirm", why: "deletes files" } as never);
    expect(await handleMobileCall("prompt", { paneId: "p2", text: "rm -rf build" })).toEqual({
      confirm: { command: "rm -rf build", why: "deletes files" },
    });
    expect(api.run).not.toHaveBeenCalled();
    await handleMobileCall("prompt", { paneId: "p2", text: "rm -rf build", confirmed: true, command: "rm -rf build" });
    expect(api.run).toHaveBeenCalledWith("p2", "rm -rf build");
  });

  it("never types a command that the project blocks, even when the phone confirmed", async () => {
    vi.mocked(guardHit).mockResolvedValue({ level: "block", why: "forbidden" } as never);
    const answer = await handleMobileCall("prompt", { paneId: "p2", text: "git push main", confirmed: true, command: "git push main" });
    expect(answer).toHaveProperty("error");
    expect(api.run).not.toHaveBeenCalled();
  });

  it("never types when the setting Allow typing in terminals from the phone is off, and says how to turn it on", async () => {
    settings.mobileTerminalTyping = false;
    const answer = (await handleMobileCall("prompt", { paneId: "p2", text: "git status" })) as { error: string };
    expect(answer.error).toContain("Settings");
    expect(api.run).not.toHaveBeenCalled();
    expect(guardHit).not.toHaveBeenCalled();
  });

  it("tells the phone, in the state, whether typing in terminals is allowed", async () => {
    expect(await handleMobileCall("state", {})).toHaveProperty("terminalTypingAllowed", true);
    settings.mobileTerminalTyping = false;
    expect(await handleMobileCall("state", {})).toHaveProperty("terminalTypingAllowed", false);
  });

  it("refuses an empty command", async () => {
    expect(await handleMobileCall("prompt", { paneId: "p2", text: "  " })).toHaveProperty("error");
    expect(api.run).not.toHaveBeenCalled();
  });
});

describe("the method macros", () => {
  it("lists the personal macros, then the macros of the project of the workspace of the pane, with the variables replaced", async () => {
    const answer = (await handleMobileCall("macros", { paneId: "p1" })) as { macros: Record<string, unknown>[] };
    expect(answer.macros.map((m) => [m.id, m.source])).toEqual([
      ["progress", "personal"],
      ["review", "project"],
    ]);
    expect(answer.macros[0].text).toMatch(/^Where are you\? \S/);
    expect(answer.macros[0].text).not.toContain("{agent}");
    expect(answer.macros[1]).toEqual({ id: "review", label: "Review", description: "", source: "project", text: "Review the branch" });
  });

  it("refuses a pane that does not exist", async () => {
    expect(await handleMobileCall("macros", { paneId: "gone" })).toHaveProperty("error");
  });

  it("sends nothing: the phone writes the text into the field for a prompt", async () => {
    await handleMobileCall("macros", { paneId: "p1" });
    expect(api.prompt).not.toHaveBeenCalled();
  });
});

describe("the method launchers", () => {
  it("lists the launchers of each workspace whose project has one, with the status of each launcher", async () => {
    expect(await handleMobileCall("launchers", {})).toEqual({
      workspaces: [
        {
          id: "w1",
          label: "heidrun",
          error: null,
          launchers: [{ id: "dev", label: "Dev server", description: null, command: "pnpm dev", status: "idle" }],
        },
      ],
    });
  });
});

describe("the method launchers, with launchers of the user level", () => {
  it("lists the launchers of the user level first in every workspace whose project is loaded, even a workspace with no launcher of its own", async () => {
    userLaunchers.list = [USER_LAUNCHER];
    const answer = (await handleMobileCall("launchers", {})) as { workspaces: { id: string; launchers: { id: string }[] }[] };
    expect(answer.workspaces.map((workspace) => workspace.id)).toEqual(["w1", "w2"]);
    expect(answer.workspaces[0].launchers.map((launcher) => launcher.id)).toEqual(["everywhere", "dev"]);
    expect(answer.workspaces[1].launchers.map((launcher) => launcher.id)).toEqual(["everywhere"]);
  });

  it("runs a launcher of the user level in the workspace that the phone names", async () => {
    userLaunchers.list = [USER_LAUNCHER];
    expect(await handleMobileCall("launch", { workspaceId: "w2", launcherId: "everywhere", action: "run" })).toEqual({ ok: true });
    expect(guardHit).toHaveBeenCalledWith("make everywhere", "/work/website");
    expect(runLauncher).toHaveBeenCalledWith("w2", USER_LAUNCHER, true, true);
  });
});

describe("the method launch", () => {
  it("runs a launcher that the guards let through, and does not ask the guards of the desktop again", async () => {
    expect(await handleMobileCall("launch", { workspaceId: "w1", launcherId: "dev", action: "run" })).toEqual({ ok: true });
    expect(guardHit).toHaveBeenCalledWith("pnpm dev", "/work/heidrun");
    expect(runLauncher).toHaveBeenCalledWith("w1", LAUNCHER, true, true);
  });

  it("asks the phone to confirm a command that the guards stop, then runs it once confirmed", async () => {
    vi.mocked(guardHit).mockResolvedValue({ level: "confirm", why: "starts a server" } as never);
    expect(await handleMobileCall("launch", { workspaceId: "w1", launcherId: "dev", action: "run" })).toEqual({
      confirm: { command: "pnpm dev", why: "starts a server" },
    });
    expect(runLauncher).not.toHaveBeenCalled();
    await handleMobileCall("launch", { workspaceId: "w1", launcherId: "dev", action: "run", confirmed: true, command: "pnpm dev" });
    expect(runLauncher).toHaveBeenCalledWith("w1", LAUNCHER, true, true);
  });

  it("never runs a command that the project blocks", async () => {
    vi.mocked(guardHit).mockResolvedValue({ level: "block", why: "forbidden" } as never);
    const answer = await handleMobileCall("launch", { workspaceId: "w1", launcherId: "dev", action: "run", confirmed: true, command: "pnpm dev" });
    expect(answer).toHaveProperty("error");
    expect(runLauncher).not.toHaveBeenCalled();
  });

  it("stops a launcher", async () => {
    expect(await handleMobileCall("launch", { workspaceId: "w1", launcherId: "dev", action: "stop" })).toEqual({ ok: true });
    expect(stopLauncher).toHaveBeenCalledWith("w1", LAUNCHER);
  });

  it("refuses a launcher that does not exist", async () => {
    expect(await handleMobileCall("launch", { workspaceId: "w1", launcherId: "gone", action: "run" })).toHaveProperty("error");
    expect(runLauncher).not.toHaveBeenCalled();
  });
});
