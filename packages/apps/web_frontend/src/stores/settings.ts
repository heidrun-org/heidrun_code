import { reactive, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { CUSTOM_LAUNCHER_CODING_AGENT_IDS } from "../lib/coding_agents";
import { AGENTS } from "../lib/agents";
import { DetectionFamilies } from "../lib/detection_families";
import { NotificationChannels } from "../lib/notification_channels";
import { PERSON_WORK_PERIODS, type PersonWorkPeriodId, type PersonWorkSlotHours } from "../lib/person_work";
import {
  USER_ACTIVITY_RANGE_IDS,
  USER_ACTIVITY_RANGES,
  USER_ACTIVITY_SLOT_LENGTHS,
  type UserActivityRangeId,
  type UserActivitySlotLengthId,
} from "../lib/user_activity_slots";

export interface FontOption {
  id: string;
  label: string;
  /** CSS font-family stack given to xterm. */
  stack: string;
}

// Geist Mono, JetBrains Mono, Fira Code and Inconsolata are loaded from Google Fonts
// (index.html); the others ship with macOS or are installed by the user.
export const FONTS: FontOption[] = [
  { id: "geist", label: "Geist Mono", stack: '"Geist Mono", ui-monospace, Menlo, monospace' },
  { id: "sf", label: "SF Mono", stack: 'ui-monospace, "SF Mono", Menlo, monospace' },
  { id: "jetbrains", label: "JetBrains Mono", stack: '"JetBrains Mono", ui-monospace, Menlo, monospace' },
  { id: "fira", label: "Fira Code", stack: '"Fira Code", ui-monospace, Menlo, monospace' },
  // Installed locally (powerline/fonts or Nerd Fonts); Google's Inconsolata as a
  // fallback, without the powerline glyphs.
  {
    id: "inconsolata-powerline",
    label: "Inconsolata for Powerline",
    stack: '"Inconsolata for Powerline", "Inconsolata Nerd Font Mono", "Inconsolata Nerd Font", "InconsolataGo Nerd Font", Inconsolata, ui-monospace, monospace',
  },
  { id: "menlo", label: "Menlo", stack: "Menlo, monospace" },
  { id: "monaco", label: "Monaco", stack: "Monaco, Menlo, monospace" },
];

export const FONT_MIN = 9;
export const FONT_MAX = 24;
export const FONT_DEFAULT = 16;

// The one place of the text size: every font size of the window reads this CSS variable.
document.documentElement.style.setProperty("--font-size", `${FONT_DEFAULT}px`);

const KEY = "heidrun.settings";

/**
 * The sidebar sections of the left sidebar: "launchers" is the Launchers sidebar section, "files" is the Files one, and
 * "codeHosting" is the Code hosting one.
 */
export type LeftSidebarSection = "launchers" | "sourceControl" | "files" | "codeHosting";

/** The sidebar sections of the right sidebar: "toHandle" is the Needs you sidebar section. */
export type RightSidebarSection = "toHandle" | "notes" | "chats" | "userActivity";

/** A saved search of the Code hosting sidebar section (issue #374): a search under a name. */
export type SavedSearch = {
  /** The name that the button of the saved search shows. Two saved searches never have the same name. */
  name: string;
  /** The search, written in the search language of GitHub. */
  query: string;
};

/** The saved searches of the two lists of the Code hosting sidebar section (issue #607): each list has its own. */
export type SavedSearches = {
  /** The saved searches of the list "Issues", in the order of their buttons. */
  issues: SavedSearch[];
  /** The saved searches of the list "Pull requests" or "Merge requests", in the order of their buttons. */
  requests: SavedSearch[];
};

/**
 * The level of a saved search (issue #822): "user" shows in every workspace, and "workspace" shows only in the workspace
 * where the developer saved it.
 */
export type SavedSearchLevel = "user" | "workspace";

/**
 * The choice of the workspace selector of the tab "User activity" of the Statistics window (issue 707). The choice is saved by the
 * folder of each workspace, because a folder is the same at every run of Heidrun Code.
 */
export type StatisticsUserActivityWorkspaces = {
  /** True when every workspace was chosen: a workspace that opens later is then chosen too. `folders` is then not read. */
  isEveryWorkspaceChosen: boolean;
  /** The folders of the workspaces that were chosen. Empty with `isEveryWorkspaceChosen` false: no workspace was chosen. */
  folders: string[];
};

/** The choice of the workspace selector of the tab "Work of one person" of the Statistics window (issue 707). */
export type StatisticsPersonWorkWorkspaces = {
  /** True once the developer has chosen the workspaces. False: the tab starts with the selected workspace alone. */
  isSaved: boolean;
  /** The identifiers of the workspaces that were chosen. Empty with `isSaved` true: no workspace was chosen. */
  workspaceIds: string[];
};

const defaults = {
  fontId: "geist",
  fontSize: FONT_DEFAULT,
  /** The left sidebar is collapsed to the sidebar icon bar: a narrow vertical bar with one icon for each sidebar section. */
  leftCollapsed: false,
  /** The right sidebar is collapsed to the sidebar icon bar: a narrow vertical bar with one icon for each sidebar section. */
  rightCollapsed: false,
  /**
   * "select": dragging selects text in the terminal (⌘C to copy).
   * "app": mouse goes to Herdr / the program in the pane (scroll, clicks); ⌥ + drag still selects.
   */
  mouseMode: "select" as "select" | "app",
  /**
   * Settings window, section Terminal: the automatic detection in the text of the terminals is on (issue #638). Off: Heidrun Code
   * colors nothing, adds no hover button, and gives no action to the text of any terminal.
   */
  terminalTextDetection: true,
  /**
   * Settings window, section Terminal: the identifiers of the detection families that the developer turned off (issue #638).
   * A family that is not in the list is on. The list is read only while `terminalTextDetection` is on.
   */
  disabledDetectionFamilies: [] as string[],
  /** Sidebar section that the left sidebar shows. */
  leftSidebarSection: "launchers" as LeftSidebarSection,
  /** Sidebar section that the right sidebar shows. */
  rightSidebarSection: "toHandle" as RightSidebarSection,
  /** Sidebar section Past chats: the coding agent whose chats the list shows. */
  chatsAgent: "claude" as "claude" | "codex",
  /** Sidebar section Past chats: "compact" keeps the rows tight, and "expanded" gives them more air. */
  chatsView: "compact" as "compact" | "expanded",
  /**
   * Settings window, section Past chats: how often the Past chats sidebar section reads the files of the chats again while it
   * is on the screen, in seconds (issue #442).
   */
  chatsRefreshSeconds: 10,
  /**
   * Settings window, section Dynamic topics: the dynamic topics are on. Off: the Past chats sidebar section shows no dynamic
   * topic bar and no dynamic topic label, and Heidrun Code computes no dynamic topic and calls no coding agent for them (issue #422).
   */
  dynamicTopics: true,
  /** Settings window, section Dynamic topics: the method that computes the dynamic topics of each chat, "keyword" or "languageModel". */
  dynamicTopicExtraction: "keyword" as "keyword" | "languageModel",
  /** Settings window, section Dynamic topics: the topics show clustered dynamic topics (names of clusters) instead of raw dynamic topics. */
  clusteredDynamicTopics: false,
  /** Sidebar section Past chats: what the list is sorted by. */
  chatsSortKey: "last_updated" as "created_on" | "last_updated" | "messages" | "issues" | "pull_requests" | "files_written",
  /** Sidebar section Past chats: "descending" puts the largest value of the sort key first, and "ascending" puts the smallest value first. */
  chatsOrder: "descending" as "ascending" | "descending",
  /** Last size of the note window, in px. */
  noteWidth: 760,
  /** Side columns, in px (drag the borders; double-click resets). */
  leftWidth: 280,
  /** Start the Herdr server in the background when it is not running. */
  autoStartHerdr: true,
  /** True when the notice of the missing programs already named the missing ngrok once: it does not name it again (issue 546). */
  ngrokMissingNoticeShown: false,
  /** Quitting Heidrun Code does not stop the Herdr session of Heidrun Code: the agents continue to run. Off: quitting stops it. */
  keepAgentsRunningAfterQuit: true,
  /** A click on the cross of a workspace in the information card of the Workspace status bar section opens the confirmation dialog "Close the workspace". Off: the workspace closes at once. */
  confirmWorkspaceClose: true,
  /** A click on the close button of a tab opens the confirmation dialog "Close the tab". Off: the tab closes at once. */
  confirmTabClose: true,
  /** A click on the close button in the header of a pane opens the confirmation dialog "Close the pane". Off: the pane closes at once. */
  confirmPaneClose: true,
  /** Window "Edit the saved search": the button "Delete" opens the confirmation dialog "Delete the saved search". Off: the saved search is deleted at once. */
  confirmSavedSearchDelete: true,
  /**
   * Settings window, section General: how often Heidrun Code runs `git fetch` in the background for the repository of the
   * selected workspace, in minutes. 0 is off (issue #432).
   */
  gitFetchMinutes: 5,
  /** Settings window, section New tab: the command that the pane of a new tab runs. */
  newTabCommand: "terminal" as "terminal" | "claude" | "codex" | "agy",
	/** Show the composition bar initially when a new pane starts directly with a coding agent. */
	isCompositionBarShownOnAgentStart: false,
  /** Window Create a custom launcher: the last kind, "commandLine" or "codingAgent". */
  customLauncherKind: "commandLine" as "commandLine" | "codingAgent",
  /** Window Create a custom launcher: the identifier of the last coding agent. */
  customLauncherAgent: CUSTOM_LAUNCHER_CODING_AGENT_IDS[0] as string,
  /** Window Create a custom launcher: the last model. An empty text is the default model. */
  customLauncherModel: "",
  /** Window Create a custom launcher: the last effort. An empty text is the default effort. */
  customLauncherEffort: "",
  /** Finished items (Activité, « À traiter » terminé) disappear after this many minutes; 0 = never. */
  finishedTtl: 15,
  /**
   * Settings window, section General: the goat sound is on, so the sound buttons and the smiley play a goat bleat (issue #620).
   * Off: no goat bleat plays, and a bleat that is playing stops.
   */
  goatSound: false,
  /** Settings window, section Mobile access: the phone may type a command in a plain terminal. Off: the phone only reads the terminals. */
  mobileTerminalTyping: false,
  /**
   * Settings window, section Voice input: the voice input is on (issue 662). Off: Heidrun Code shows no push-to-talk button, downloads
   * no model, and never opens the microphone.
   */
  voiceInput: false,
  /** Settings window, section Voice input: the language of the speech, "auto" (Whisper finds it) or a two-letter code. */
  voiceInputLanguage: "auto",
  /** Settings window, section Voice input: the identifier of the Whisper model. */
  voiceInputModel: "base",
  /** Settings window, section Needs you: the Needs you sidebar section shows the list of workspaces at its bottom. Off: it shows only the cards. */
  showWorkspacesInNeedsYou: true,
  /**
   * The height of the list of workspaces of the Needs you sidebar section, in pixels, chosen by dragging the line above the list
   * (issue 807). 0: the default, the height of the rows, up to 40 percent of the sidebar section. A number, not null, because
   * `dropCorruptedValues` replaces a saved value whose type is not the type of the default.
   */
  needsYouWorkspacesHeight: 0,
  /** Notifications. */
  notifBlockedMin: 5, // remind once when an agent stays blocked this long (0 = off)
  notifContext: true, // an agent's context goes past 80 %
  notifQuota: true, // Claude 5 h / week quota past 80 % then 95 %
  notifEvening: "", // "18:30": summary of the day's finished work ("" = off)
  quietFrom: "", // "20:00" … "08:00": no notification in between ("" = never quiet)
  quietTo: "",
  /** Notifications: for each kind of notification, the system notification, the sound, and the name of the sound (issue #857). */
  notificationChannels: NotificationChannels.createDefaults(),
  /** The status item (the dots) is shown in the macOS menu bar. */
  showStatusItem: true,
  /** Git viewer: "unified" | "split" diff, the whole "file", or the "preview" of a Markdown file. */
  diffMode: "unified" as "unified" | "split" | "file" | "preview",
  /** Side-by-side diff: share of the width for the old version (0.5 = middle). */
  splitRatio: 0.5,
  /** Markdown reading: centred column, or the whole width. */
  mdWidth: "center" as "center" | "full",
  /** Git window: file list hidden (the viewer takes the whole window). */
  gitListHidden: false,
  gitListWidth: 340,
  /** Language of the user interface. */
  language: "en" as "en" | "fr",
  /** Clock display: "auto" follows the language, "12h" shows AM and PM, "24h" shows the hour from 0 to 23. */
  timeFormat: "auto" as "auto" | "12h" | "24h",
  /** Days of the week you work, numbered like `Date.getDay()` (0 is Sunday). The weekly quota pace counts only these days. */
  workingDays: [0, 1, 2, 3, 4, 5, 6] as number[],
  /** Application theme: "system" follows the operating system. */
  theme: "system" as "system" | "light" | "dark",
  /** Code views (diff, file): long lines wrap instead of scrolling sideways. */
  codeWrap: false,
  rightWidth: 320,
  noteHeight: 520,
  /** Pinned panes (pane ids), stacked in the column of pinned panes on the right of the panes of the selected tab. */
  pinnedPanes: [] as string[],
  /** History estimates: 1 h of agent work ≈ this many hours of a developer. */
  histHumanFactor: 4,
  /** Your own time: minutes per consigne written, per decision answered. */
  histPromptMin: 3,
  histDecisionMin: 0.5,
  /** File explorer: tree width, Markdown shown rendered. */
  filesListWidth: 300,
  filesMdRead: true,
  /** Show the diff before each save in the editor. */
  filesDiffBeforeSave: false,
  /** Mosaic: only the agents at work (main, recent journal, or in Claude's list). */
  mosaicActiveOnly: true,
  /** Monthly budget per workspace (label → USD); alert at 80 % and 100 %. */
  budgets: {} as Record<string, number>,
  /** Width of the column of pinned panes, in px. */
  columnOfPinnedPanesWidth: 560,
  /** The coding agents (ids of `lib/agents.ts`) that the user has a valid subscription or access for. */
  ownedAgents: [] as string[],
  /** Whether the coding agents were checked once or the developer has chosen them. */
  ownedAgentsConfigured: false,
  /** Settings window, section Coding agents: show account quota data and collect Claude Code quota data. */
  quotaMonitoring: true,
  /** Window Find new skills: where a skill is installed, "workspace" (the folder of the workspace) or "user". */
  skillsLevel: "workspace" as "workspace" | "user",
  /** The window of a SKILL.md file shows the rendered Markdown (true) or the highlighted source (false). */
  skillsViewRendered: true,
  /** Window Files: the side column shows the file tree ("tree") or the search in the files ("grep"). */
  filesSideMode: "tree" as "tree" | "grep",
  /** Window Files, search in the files: the query is a regular expression. */
  filesGrepRegex: false,
  /** Window Files, search in the files: the case of the letters counts. */
  filesGrepCase: false,
  /** Window Files and sidebar section File explorer: the file tree shows the files that Git ignores. */
  filesShowIgnored: false,
  /** Sidebar section File explorer: the space that each level of a folder adds at the left of a row. */
  filesPanelIndent: "medium" as "small" | "medium" | "large",
  /** Sidebar section File explorer: the height of a row. */
  filesPanelRowHeight: "comfortable" as "compact" | "comfortable",
  /** Sidebar section File explorer: a thin vertical line under each unfolded folder links its rows. */
  filesPanelIndentGuides: true,
  /** Window Agents information: the activity list shows all the panes ("all") or only the selected pane ("pane"). */
  agentsActivityScope: "all" as "all" | "pane",
  /** Window History: the period of the runs. */
  historyPeriod: "today" as "today" | "7" | "30" | "90" | "365",
  /** Window History: the left column groups the runs by workspace ("ws") or by feature ("feature"). */
  historyGroupBy: "ws" as "ws" | "feature",
  /** Window History: the panel of the assumptions is open. */
  historyShowAssumptions: false,
  /** Window Search: the query is a regular expression. */
  searchRegex: false,
  /** Window Search: look only in the panes of the coding agents. */
  searchAgentsOnly: false,
  /** Window Search: look only in the selected workspace. */
  searchThisWorkspace: false,
  /** Clipboard sidebar section: the list shows the notes of every workspace, not only of the selected workspace. */
  notesShowAll: false,
  /** Sidebar section Code hosting: the saved searches of the user level, shown in every workspace, in the order of their buttons. */
  codeHostingSavedSearches: { issues: [], requests: [] } as SavedSearches,
  /**
   * Sidebar section Code hosting: the saved searches of the workspace level (issue #822). The key is the workspace folder,
   * because a folder is the same at every run of Heidrun Code. Each value has the saved searches of each list, in the order of
   * their buttons.
   */
  codeHostingWorkspaceSavedSearches: {} as Record<string, SavedSearches>,
  /**
   * Window Statistics, bar charts of the tab "Work of one person": the color that the legend filter keeps, for each chart. The
   * name of a chart points to the identifier of the only color that the chart shows. A chart with no name shows every color.
   */
  statisticsLegendFilters: {} as Record<string, string>,
  /** Window Statistics, tab "User activity": the time range of the histogram (issue 707). */
  statisticsUserActivityRange: "day" as UserActivityRangeId,
  /** Window Statistics, tab "User activity": the slot length of the histogram. It must be one of the slot lengths of the time range. */
  statisticsUserActivitySlotLength: USER_ACTIVITY_RANGES.day.defaultSlotLengthId as UserActivitySlotLengthId,
  /** Window Statistics, tab "User activity": the choice of the workspace selector. Every workspace at first. */
  statisticsUserActivityWorkspaces: { isEveryWorkspaceChosen: true, folders: [] } as StatisticsUserActivityWorkspaces,
  /** Window Statistics, tab "Work of one person": the source of the bar chart (issue 707). */
  statisticsPersonWorkSource: "git_history" as "git_history" | "ai_cost",
  /** Window Statistics, tab "Work of one person": the metric of the Git history. Kept while the source "AI cost" hides it. */
  statisticsPersonWorkMetric: "commits_and_pull_requests" as "commits_and_pull_requests" | "lines",
  /** Window Statistics, tab "Work of one person": the unit of the AI cost. Kept while the source "Git history" hides it. */
  statisticsPersonWorkUnit: "dollars" as "dollars" | "tokens",
  /**
   * Window Statistics, tab "Work of one person": the identifier of the person that the developer chose in the person chooser.
   * Kept while the source "AI cost" hides the chooser, and while the chosen workspaces do not list this person. Empty: none.
   */
  statisticsPersonWorkPerson: "",
  /** Window Statistics, tab "Work of one person": the time range of the bar chart. */
  statisticsPersonWorkRange: "seven_days" as PersonWorkPeriodId,
  /** Window Statistics, tab "Work of one person": the slot length in hours. It must be one of the slot lengths of the time range. */
  statisticsPersonWorkSlotHours: PERSON_WORK_PERIODS.seven_days.defaultSlotHours as PersonWorkSlotHours,
  /** Window Statistics, tab "Work of one person": the choice of the workspace selector. The selected workspace alone at first. */
  statisticsPersonWorkWorkspaces: { isSaved: false, workspaceIds: [] } as StatisticsPersonWorkWorkspaces,
  /** The identifier of the workspace that was selected at the last run: the next start selects it again. Empty: none. */
  selectedWorkspaceId: "",
};

/** The values that an option accepts, for the options that have a short list of values. A saved value outside the list is dropped. */
const ALLOWED_VALUES: Record<string, readonly unknown[]> = {
  rightSidebarSection: ["toHandle", "notes", "chats", "userActivity"],
  filesSideMode: ["tree", "grep"],
  filesPanelIndent: ["small", "medium", "large"],
  filesPanelRowHeight: ["compact", "comfortable"],
  agentsActivityScope: ["all", "pane"],
  historyPeriod: ["today", "7", "30", "90", "365"],
  historyGroupBy: ["ws", "feature"],
  chatsAgent: ["claude", "codex"],
  chatsView: ["compact", "expanded"],
  chatsRefreshSeconds: [5, 10, 30, 60],
  dynamicTopicExtraction: ["keyword", "languageModel"],
  gitFetchMinutes: [0, 1, 5, 10, 30],
  newTabCommand: ["terminal", "claude", "codex", "agy"],
  customLauncherKind: ["commandLine", "codingAgent"],
  customLauncherAgent: CUSTOM_LAUNCHER_CODING_AGENT_IDS,
  chatsSortKey: ["created_on", "last_updated", "messages", "issues", "pull_requests", "files_written"],
  chatsOrder: ["ascending", "descending"],
  statisticsUserActivityRange: USER_ACTIVITY_RANGE_IDS,
  statisticsUserActivitySlotLength: Object.keys(USER_ACTIVITY_SLOT_LENGTHS),
  statisticsPersonWorkSource: ["git_history", "ai_cost"],
  statisticsPersonWorkMetric: ["commits_and_pull_requests", "lines"],
  statisticsPersonWorkUnit: ["dollars", "tokens"],
  statisticsPersonWorkRange: Object.keys(PERSON_WORK_PERIODS),
  statisticsPersonWorkSlotHours: [...new Set(Object.values(PERSON_WORK_PERIODS).flatMap((period) => period.slotHoursChoices))],
};

const NEW_TAB_COMMAND_AGENT_IDS = {
  claude: 'claude',
  codex: 'codex',
  agy: 'antigravity',
} as const;

/**
 * Keeps each saved value that has the type of its default value, and that is in the list of its allowed values when the
 * option has such a list. A corrupted saved value gives the default value back.
 */
function dropCorruptedValues(saved: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...saved };
  for (const [name, defaultValue] of Object.entries(defaults)) {
    const value = result[name];
    const hasWrongType =
      value === null ||
      value === undefined ||
      typeof value !== typeof defaultValue ||
      Array.isArray(value) !== Array.isArray(defaultValue);
    const allowedValues = ALLOWED_VALUES[name];
    const isNotAllowed = allowedValues !== undefined && allowedValues.includes(value) === false;
    if (hasWrongType || isNotAllowed) {
      result[name] = structuredClone(defaultValue);
    }
  }
  return result;
}

/**
 * Keeps the saved searches that have a name and a search that are texts, and drops the others.
 * @param value - the saved value of the option, whatever it holds
 * @returns the saved searches that can be used
 */
function keepSavedSearches(value: unknown[]): SavedSearch[] {
  const kept: SavedSearch[] = [];
  for (const entry of value) {
    const candidate = entry as Partial<SavedSearch> | null;
    if (typeof candidate?.name === "string" && candidate.name !== "" && typeof candidate.query === "string") {
      kept.push({ name: candidate.name, query: candidate.query });
    }
  }
  return kept;
}

/**
 * Keeps the saved searches of each list that have a name and a search that are texts, and drops the others.
 * @param value - the saved value of the option, whatever it holds
 * @returns the saved searches of each list that can be used
 */
function keepSavedSearchLists(value: unknown): SavedSearches {
  const candidate = value as Partial<Record<keyof SavedSearches, unknown>> | null;
  return {
    issues: keepSavedSearches(Array.isArray(candidate?.issues) ? candidate.issues : []),
    requests: keepSavedSearches(Array.isArray(candidate?.requests) ? candidate.requests : []),
  };
}

/**
 * Keeps the saved searches of the workspace level of each workspace folder, and drops the folders that have no saved search.
 * @param value - the saved value of the option, whatever it holds
 * @returns the saved searches of each workspace folder that can be used
 */
function keepWorkspaceSavedSearchLists(value: unknown): Record<string, SavedSearches> {
  const kept: Record<string, SavedSearches> = {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return kept;
  }
  for (const [folder, lists] of Object.entries(value)) {
    const keptLists = keepSavedSearchLists(lists);
    if (folder !== "" && (keptLists.issues.length > 0 || keptLists.requests.length > 0)) {
      kept[folder] = keptLists;
    }
  }
  return kept;
}

/**
 * Keeps the legend filters that are a text for a chart that has a name, and drops the others.
 * @param value - the saved value of the option, whatever it holds
 * @returns the legend filters that can be used
 */
function keepLegendFilters(value: unknown): Record<string, string> {
  const kept: Record<string, string> = {};
  for (const [chartName, colorId] of Object.entries(value as Record<string, unknown>)) {
    if (typeof colorId === "string" && colorId !== "") {
      kept[chartName] = colorId;
    }
  }
  return kept;
}

/**
 * Keeps the texts of a saved list, and drops the other entries and the empty texts.
 * @param value - the saved value of the list, whatever it holds
 * @returns the texts of the list
 */
function keepTexts(value: unknown): string[] {
  if (Array.isArray(value) === false) {
    return [];
  }
  return (value as unknown[]).filter((entry): entry is string => typeof entry === "string" && entry !== "");
}

/**
 * Keeps the choice of the workspace selector of the tab "User activity" when it has the right shape.
 * @param value - the saved value of the option, whatever it holds
 * @returns the choice that can be used
 */
function keepUserActivityWorkspaces(value: unknown): StatisticsUserActivityWorkspaces {
  const candidate = value as Partial<StatisticsUserActivityWorkspaces> | null;
  return {
    isEveryWorkspaceChosen: typeof candidate?.isEveryWorkspaceChosen === "boolean" ? candidate.isEveryWorkspaceChosen : true,
    folders: keepTexts(candidate?.folders),
  };
}

/**
 * Keeps the choice of the workspace selector of the tab "Work of one person" when it has the right shape.
 * @param value - the saved value of the option, whatever it holds
 * @returns the choice that can be used
 */
function keepPersonWorkWorkspaces(value: unknown): StatisticsPersonWorkWorkspaces {
  const candidate = value as Partial<StatisticsPersonWorkWorkspaces> | null;
  return {
    isSaved: candidate?.isSaved === true,
    workspaceIds: keepTexts(candidate?.workspaceIds),
  };
}

/** Settings that got a new name to follow the glossary: the old name in the saved value, then the new name. */
const RENAMED_SETTINGS: Record<string, string> = {
  dockedPanes: "pinnedPanes",
  dockWidth: "columnOfPinnedPanesWidth",
  rightTab: "rightSidebarSection",
  customScriptKind: "customLauncherKind",
  customScriptAgent: "customLauncherAgent",
  customScriptModel: "customLauncherModel",
  customScriptEffort: "customLauncherEffort",
};

function load(): typeof defaults {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    for (const [oldName, newName] of Object.entries(RENAMED_SETTINGS)) {
      if (oldName in stored) {
        if (!(newName in stored)) {
          stored[newName] = stored[oldName];
        }
        delete stored[oldName];
      }
    }
    // The Scripts and Git sidebar sections moved from the right sidebar to the left sidebar. The saved value "actions" of
    // the Scripts sidebar section becomes "launchers" below.
    if (stored.rightSidebarSection === "actions" || stored.rightSidebarSection === "git") {
      if (!("leftSidebarSection" in stored)) {
        stored.leftSidebarSection = stored.rightSidebarSection;
      }
      stored.rightSidebarSection = "toHandle";
    }
    // The workspaces and the tabs left the left sidebar for the tab bar: its Workspaces sidebar section is gone.
    if (stored.leftSidebarSection === "workspacesAndTabs" || stored.leftSidebarSection === "workspaces") {
      stored.leftSidebarSection = "launchers";
    }
    // The Needs you sidebar section moved from the left sidebar to the right sidebar.
    if (stored.leftSidebarSection === "toHandle") {
      stored.leftSidebarSection = "launchers";
    }
    // The Source control sidebar section replaced the Git sidebar section (issue #305).
    if (stored.leftSidebarSection === "git") {
      stored.leftSidebarSection = "sourceControl";
    }
    // The Scripts sidebar section became the Launchers sidebar section (issue #425): the saved value "actions" is now "launchers".
    if (stored.leftSidebarSection === "actions") {
      stored.leftSidebarSection = "launchers";
    }
    // The choice of the code theme is gone (issue #446): the code colors follow the theme of the application.
    delete stored.codeTheme;
    // The button "Reading" of the large Git window became the button "Preview" (issue #446): the saved value "read" is now "preview".
    if (stored.diffMode === "read") {
      stored.diffMode = "preview";
    }
    // The hide buttons of the sidebars are gone (issue #315): a sidebar that was hidden is now collapsed.
    if (stored.leftOpen === false) {
      stored.leftCollapsed = true;
    }
    if (stored.rightOpen === false) {
      stored.rightCollapsed = true;
    }
    delete stored.leftOpen;
    delete stored.rightOpen;
    // The saved searches were one list for the two lists of the Code hosting sidebar section. Each list has its own
    // saved searches now (issue #607): the old list is copied into both lists, so that nothing is lost.
    if (Array.isArray(stored.codeHostingSavedSearches)) {
      const oldList = stored.codeHostingSavedSearches;
      stored.codeHostingSavedSearches = { issues: oldList, requests: structuredClone(oldList) };
    }
    const saved = dropCorruptedValues({ ...defaults, ...stored }) as typeof defaults;
    const commandAgentId = saved.newTabCommand === 'terminal' ? null : NEW_TAB_COMMAND_AGENT_IDS[saved.newTabCommand];
    if (commandAgentId !== null && saved.ownedAgents.includes(commandAgentId) === false) {
      saved.newTabCommand = 'terminal';
    }
    saved.codeHostingSavedSearches = keepSavedSearchLists(saved.codeHostingSavedSearches);
    saved.codeHostingWorkspaceSavedSearches = keepWorkspaceSavedSearchLists(saved.codeHostingWorkspaceSavedSearches);
    saved.statisticsLegendFilters = keepLegendFilters(saved.statisticsLegendFilters);
    saved.statisticsUserActivityWorkspaces = keepUserActivityWorkspaces(saved.statisticsUserActivityWorkspaces);
    saved.statisticsPersonWorkWorkspaces = keepPersonWorkWorkspaces(saved.statisticsPersonWorkWorkspaces);
    saved.disabledDetectionFamilies = DetectionFamilies.keepKnownIds(saved.disabledDetectionFamilies);
    saved.notificationChannels = NotificationChannels.keep(saved.notificationChannels);
    return saved;
  } catch {
    return { ...defaults };
  }
}

export const settings = reactive(load());

async function switchOnInstalledCodingAgents(): Promise<void> {
  try {
    const availableAgentIds = await invoke<string[]>("coding_agents_available");
    if (
      Array.isArray(availableAgentIds) === false ||
      settings.ownedAgentsConfigured === true ||
      settings.ownedAgents.length > 0
    ) {
      return;
    }
    const availableAgents = new Set(availableAgentIds);
    settings.ownedAgents = AGENTS.filter((agent) => availableAgents.has(agent.id)).map((agent) => agent.id);
    settings.ownedAgentsConfigured = true;
  } catch {
    /* the choice stays empty until the developer makes it */
  }
}

if (settings.ownedAgentsConfigured === false && settings.ownedAgents.length === 0) {
  void switchOnInstalledCodingAgents();
}

watch(
  () => ({ ...settings }),
  (value) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(value));
    } catch {
      /* preferences are a convenience */
    }
  },
  { deep: true },
);

export function fontStack(): string {
  return (FONTS.find((f) => f.id === settings.fontId) ?? FONTS[0]).stack;
}

/** The zoom factor of the whole window: the chosen font size divided by the default font size. */
export function zoomFactor(): number {
  return settings.fontSize / FONT_DEFAULT;
}

/** Applies the zoom factor to the whole web view of the window, not only to the terminal. */
export async function applyWindowZoom() {
  try {
    await getCurrentWebview().setZoom(zoomFactor());
  } catch {
    /* outside the Heidrun Code window (a test, a plain browser) there is no web view to zoom */
  }
}

watch(() => settings.fontSize, applyWindowZoom, { immediate: true });

/** Tells the Rust side whether quitting Heidrun Code leaves the Herdr session of Heidrun Code running. */
export async function applyKeepAgentsRunning() {
  try {
    await invoke("set_keep_agents_running", { isKeeping: settings.keepAgentsRunningAfterQuit });
  } catch {
    /* outside the Heidrun Code window (a test, a plain browser) there is no Rust side to tell */
  }
}

watch(() => settings.keepAgentsRunningAfterQuit, applyKeepAgentsRunning, { immediate: true });

export function zoom(delta: number) {
  const next = Math.round((settings.fontSize + delta) * 2) / 2;
  settings.fontSize = Math.min(FONT_MAX, Math.max(FONT_MIN, next));
}

export function resetZoom() {
  settings.fontSize = FONT_DEFAULT;
}

/** The sections of the Settings window. */
export type SettingsSection =
  | "general"
  | "designReview"
  | "terminal"
  | "textDetection"
  | "agents"
  | "confirmations"
  | "guards"
  | "notifications"
  | "sidebars"
  | "dynamicTopics"
  | "mobileAccess"
  | "voiceInput";

/** State of the Settings window: not saved, the window starts closed on the first section. */
export const settingsModal = reactive({
  open: false,
  section: "general" as SettingsSection,
});

/** Opens the Settings window, on `section` when given. */
export function openSettings(section?: SettingsSection) {
  if (section !== undefined) {
    settingsModal.section = section;
  }
  settingsModal.open = true;
}
