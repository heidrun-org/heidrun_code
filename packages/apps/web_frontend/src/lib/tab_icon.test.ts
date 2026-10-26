// @vitest-environment node
import { describe, expect, it } from "vitest";
import { tabIconName, type PaneForTabIcon } from "./tab_icon";

/** A pane for the tests: the status is idle, and no agent runs, unless the test says otherwise. */
function makePane(paneId: string, fields: Partial<PaneForTabIcon> = {}): PaneForTabIcon {
  return { pane_id: paneId, agent: null, agent_status: "idle", focused: false, ...fields };
}

describe("tabIconName", () => {
  it("gives the terminal icon to a tab without panes, and to a tab with only terminals", () => {
    expect(tabIconName([], null)).toBe("terminal");
    expect(tabIconName([makePane("p1"), makePane("p2")], null)).toBe("terminal");
  });

  it("gives each coding agent its icon", () => {
    expect(tabIconName([makePane("p1", { agent: "claude" })], null)).toBe("claude");
    expect(tabIconName([makePane("p1", { agent: "codex" })], null)).toBe("openai");
    expect(tabIconName([makePane("p1", { agent: "agy" })], null)).toBe("google");
    expect(tabIconName([makePane("p1", { agent: "antigravity" })], null)).toBe("google");
  });

  it("gives the terminal icon to an agent that Heidrun Code does not know", () => {
    expect(tabIconName([makePane("p1", { agent: "gemini" })], null)).toBe("terminal");
  });

  it("lets a pane with an agent beat a terminal, in any order of the panes", () => {
    const terminal = makePane("p1");
    const claude = makePane("p2", { agent: "claude" });
    expect(tabIconName([terminal, claude], null)).toBe("claude");
    expect(tabIconName([claude, terminal], null)).toBe("claude");
  });

  it("lets the pane with the highest status win: blocked, then working, then done, then idle", () => {
    const claude = (status: PaneForTabIcon["agent_status"]) => makePane("p1", { agent: "claude", agent_status: status });
    const codex = (status: PaneForTabIcon["agent_status"]) => makePane("p2", { agent: "codex", agent_status: status });
    expect(tabIconName([claude("working"), codex("blocked")], null)).toBe("openai");
    expect(tabIconName([claude("done"), codex("working")], null)).toBe("openai");
    expect(tabIconName([claude("idle"), codex("done")], null)).toBe("openai");
    expect(tabIconName([claude("blocked"), codex("working")], null)).toBe("claude");
    expect(tabIconName([claude("unknown"), codex("idle")], null)).toBe("openai");
  });

  it("lets the selected pane win when the statuses are the same", () => {
    const claude = makePane("p1", { agent: "claude", agent_status: "working" });
    const codex = makePane("p2", { agent: "codex", agent_status: "working" });
    expect(tabIconName([claude, codex], "p2")).toBe("openai");
    expect(tabIconName([claude, codex], "p1")).toBe("claude");
  });

  it("lets the focused pane win when the statuses are the same and no pane of the tab is selected", () => {
    const claude = makePane("p1", { agent: "claude" });
    const codex = makePane("p2", { agent: "codex", focused: true });
    expect(tabIconName([claude, codex], "p9")).toBe("openai");
  });

  it("lets the first pane win when nothing else decides", () => {
    const claude = makePane("p1", { agent: "claude" });
    const codex = makePane("p2", { agent: "codex" });
    expect(tabIconName([claude, codex], null)).toBe("claude");
    expect(tabIconName([codex, claude], null)).toBe("openai");
  });

  it("lets the status win over the selected pane", () => {
    const claude = makePane("p1", { agent: "claude", agent_status: "blocked" });
    const codex = makePane("p2", { agent: "codex", agent_status: "idle" });
    expect(tabIconName([claude, codex], "p2")).toBe("claude");
  });
});
