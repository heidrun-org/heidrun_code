import type { AgentStatus, PaneInfo } from "./types";

/** The Bootstrap Icons name of the icon of a tab. */
export type TabIconName = "claude" | "openai" | "google" | "terminal";

/** The fields of a pane that choose the icon of its tab. */
export type PaneForTabIcon = Pick<PaneInfo, "pane_id" | "agent" | "agent_status" | "focused">;

/** The order of the statuses of the tab dot: the status with the lowest number wins. */
const STATUS_RANK: Record<AgentStatus, number> = {
  blocked: 0,
  working: 1,
  done: 2,
  idle: 3,
  unknown: 4,
};

/** The icon of a pane that runs an agent, or null for a pane without an agent that Heidrun Code knows. Bootstrap Icons has no icon of its own for Codex, and OpenAI makes Codex. */
function agentIconName(pane: PaneForTabIcon): TabIconName | null {
  const agent = (pane.agent ?? "").toLowerCase();
  if (agent.includes("claude")) {
    return "claude";
  }
  if (agent.includes("codex")) {
    return "openai";
  }
  if (agent.includes("agy") || agent.includes("antigravity")) {
    return "google";
  }
  return null;
}

/** Orders two panes with an agent: the status of the tab dot first, then the selected pane, then the focused pane. */
function comparePanes(a: PaneForTabIcon, b: PaneForTabIcon, selectedPaneId: string | null): number {
  const byStatus = STATUS_RANK[a.agent_status] - STATUS_RANK[b.agent_status];
  if (byStatus !== 0) {
    return byStatus;
  }
  const bySelected = Number(b.pane_id === selectedPaneId) - Number(a.pane_id === selectedPaneId);
  if (bySelected !== 0) {
    return bySelected;
  }
  return Number(b.focused === true) - Number(a.focused === true);
}

/**
 * The icon of a tab, chosen from its panes: a pane with an agent always beats a terminal. Among the panes with an agent, the
 * pane that decides the color of the tab dot wins (blocked, working, done, idle). When two panes have the same status, the
 * selected pane wins, then the focused pane, then the first pane.
 */
export function tabIconName(panes: PaneForTabIcon[], selectedPaneId: string | null): TabIconName {
  const agentPanes = panes.filter((pane) => agentIconName(pane) !== null);
  if (agentPanes.length === 0) {
    return "terminal";
  }
  const winner = [...agentPanes].sort((a, b) => comparePanes(a, b, selectedPaneId))[0];
  return agentIconName(winner) ?? "terminal";
}
