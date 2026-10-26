// Shapes from Herdr's API schema (`herdr api schema --json`). Unknown fields are ignored.

export type AgentStatus = "idle" | "working" | "blocked" | "done" | "unknown";

export interface WorkspaceInfo {
  workspace_id: string;
  number: number;
  label: string;
  focused: boolean;
  pane_count: number;
  tab_count: number;
  active_tab_id: string;
  agent_status: AgentStatus;
  tokens?: Record<string, string>;
  /** The saved absolute workspace folder; null requires explicit folder recovery. */
  workspace_folder?: string | null;
  worktree?: { branch?: string | null; checkout_path?: string | null } | null;
}

export interface TabInfo {
  tab_id: string;
  workspace_id: string;
  number: number;
  label: string;
  focused: boolean;
  pane_count: number;
  agent_status: AgentStatus;
}

export interface AgentSessionInfo {
  source: string;
  agent: string;
  kind: string;
  value: string;
}

export interface PaneInfo {
  pane_id: string;
  terminal_id: string;
  workspace_id: string;
  tab_id: string;
  focused: boolean;
  agent_status: AgentStatus;
  revision: number;
  agent?: string | null;
  display_agent?: string | null;
  label?: string | null;
  title?: string | null;
  cwd?: string | null;
  foreground_cwd?: string | null;
  terminal_title?: string | null;
  terminal_title_stripped?: string | null;
  state_labels?: Record<string, string>;
  tokens?: Record<string, string>;
  agent_session?: AgentSessionInfo | null;
}

export interface AgentInfo extends PaneInfo {
  name?: string | null;
  state_change_seq?: number;
  /** The Herdr completion sequence, unchanged when that completion is acknowledged. */
  completion_seq?: number;
  interactive_ready?: boolean;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One cut of the layout of a tab: a line that divides a rectangle into two groups of panes. */
export interface LayoutSplit {
  /** Name of the split in Herdr, for example `split_0_root`. */
  id: string;
  /** `down`: a horizontal line, the groups sit one above the other. `right`: a vertical line, side by side. */
  direction: "down" | "right";
  /** Share of the rectangle that the first group (the top or the left one) takes, from 0 to 1. */
  ratio: number;
  /** The rectangle that the split divides, in terminal cells. */
  rect: Rect;
  /**
   * The way from the root of the layout of Herdr to the split: `false` goes to the first group, `true` to the second.
   * Herdr does not send it. Heidrun Code sets it when it removes panes from a layout, because the way in the smaller layout
   * is not the way that Herdr needs to change the share of the split.
   */
  path?: boolean[];
}

export interface PaneLayoutSnapshot {
  workspace_id: string;
  tab_id: string;
  zoomed: boolean;
  area: Rect;
  focused_pane_id: string;
  panes: { pane_id: string; focused: boolean; rect: Rect }[];
  /** The splits of the tab. A Herdr server that is too old does not send them. */
  splits?: LayoutSplit[];
}

export interface SessionSnapshot {
  version: string;
  protocol: number;
  focused_workspace_id?: string | null;
  focused_tab_id?: string | null;
  focused_pane_id?: string | null;
  workspaces: WorkspaceInfo[];
  tabs: TabInfo[];
  panes: PaneInfo[];
  layouts: PaneLayoutSnapshot[];
  agents: AgentInfo[];
}

export interface LimitWindow {
  used_percent: number;
  window_minutes?: number | null;
  resets_at?: number | null;
}

export interface CodexUsage {
  available: boolean;
  primary?: LimitWindow | null;
  secondary?: LimitWindow | null;
  plan?: string | null;
  updated_at?: number | null;
  sessions: Record<string, { context_used?: number | null; context_window?: number | null; updated_at?: number | null }>;
}

/** Context gauge shown on a pane, whatever the agent. */
export interface ContextUsage {
  percent: number;
  used?: number;
  size?: number;
}

/** Quota block in the status bar. */
export interface QuotaBlock {
  provider: "claude" | "codex" | "antigravity";
  label: string;
  /** `id` distinguishes windows from one account, `name` is the text shown, and `period` sets their time behaviour. */
  windows: { id: string; name: string; percent: number; resetsAt?: number; period?: "session" | "week"; windowMinutes?: number }[];
  cost?: number;
  updatedAt?: number;
}
