import { beforeEach, describe, expect, it, vi } from "vitest";
import { FONT_DEFAULT, FONT_MAX, FONT_MIN, FONTS, fontStack, resetZoom, settings, zoom, zoomFactor } from "./settings";

const setZoom = vi.hoisted(() => vi.fn(async () => {}));
const invoke = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom }) }));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

beforeEach(() => {
  settings.fontId = "geist";
  resetZoom();
});

describe("zoom", () => {
  it("changes the font size by the given step", () => {
    zoom(1);
    expect(settings.fontSize).toBe(FONT_DEFAULT + 1);
  });

  it("rounds to half a point", () => {
    zoom(0.3);
    expect(settings.fontSize).toBe(FONT_DEFAULT + 0.5);
  });

  it("never goes under the minimum", () => {
    zoom(-100);
    expect(settings.fontSize).toBe(FONT_MIN);
  });

  it("never goes over the maximum", () => {
    zoom(100);
    expect(settings.fontSize).toBe(FONT_MAX);
  });

  it("returns to the default size on reset", () => {
    zoom(5);
    resetZoom();
    expect(settings.fontSize).toBe(FONT_DEFAULT);
  });
});

describe("fontStack", () => {
  it("returns the stack of the chosen font", () => {
    settings.fontId = "menlo";
    expect(fontStack()).toBe("Menlo, monospace");
  });

  it("falls back to the first font for an unknown id", () => {
    settings.fontId = "nope";
    expect(fontStack()).toBe(FONTS[0].stack);
  });

  it("gives every font a unique id", () => {
    const ids = FONTS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("settings", () => {
  it("has the documented defaults", () => {
    expect(settings.language).toBe("en");
    expect(settings.mouseMode).toBe("select");
  });

  it("does not let the phone type in a terminal by default", () => {
    expect(settings.mobileTerminalTyping).toBe(false);
  });

  it("shows the status item in the macOS menu bar by default", () => {
    expect(settings.showStatusItem).toBe(true);
  });
});

describe("keep agents running after quit", () => {
  it("is on by default, so quitting Heidrun Code keeps its Herdr session running", () => {
    expect(settings.keepAgentsRunningAfterQuit).toBe(true);
  });

  it("is given to the Rust side at the start and at each change", async () => {
    expect(invoke).toHaveBeenCalledWith('set_keep_agents_running', {
      isKeeping: true,
    });
    invoke.mockClear();
    settings.keepAgentsRunningAfterQuit = false;
    await vi.waitFor(() => expect(invoke).toHaveBeenLastCalledWith("set_keep_agents_running", { isKeeping: false }));
    settings.keepAgentsRunningAfterQuit = true;
    await vi.waitFor(() => expect(invoke).toHaveBeenLastCalledWith('set_keep_agents_running', {
      isKeeping: true,
    }));
  });

	it.each([true, false])('restores the saved choice %s and gives that choice to Rust at startup', async (isKeeping) => {
		settings.keepAgentsRunningAfterQuit = isKeeping;
		await vi.waitFor(() => expect(
			JSON.parse(localStorage.getItem('heidrun.settings') ?? '{}').keepAgentsRunningAfterQuit,
		).toBe(isKeeping));
		invoke.mockClear();
		vi.resetModules();
		const reloaded = await import('./settings');
		expect(reloaded.settings.keepAgentsRunningAfterQuit).toBe(isKeeping);
		await vi.waitFor(() => expect(invoke).toHaveBeenCalledWith('set_keep_agents_running', {
			isKeeping,
		}));
	});

	it('uses the on default when existing saved settings contain no choice for quitting', async () => {
		localStorage.setItem('heidrun.settings', JSON.stringify({
			fontSize: 18,
		}));
		invoke.mockClear();
		vi.resetModules();
		const reloaded = await import('./settings');
		expect(reloaded.settings.fontSize).toBe(18);
		expect(reloaded.settings.keepAgentsRunningAfterQuit).toBe(true);
		await vi.waitFor(() => expect(invoke).toHaveBeenCalledWith('set_keep_agents_running', {
			isKeeping: true,
		}));
	});
});

describe("ask before deleting a saved search", () => {
  it("is on by default, so the button Delete asks for a confirmation", () => {
    expect(settings.confirmSavedSearchDelete).toBe(true);
  });
});

describe("saved searches of the Code hosting sidebar section", () => {
  /** The settings, as a new run of Heidrun Code reads them from what `localStorage` holds. */
  async function settingsFrom(saved: unknown) {
    localStorage.setItem("heidrun.settings", JSON.stringify(saved));
    vi.resetModules();
    return (await import("./settings")).settings;
  }

  it("are none by default, in each of the two lists", () => {
    expect(settings.codeHostingSavedSearches).toEqual({ issues: [], requests: [] });
  });

  it("are read again when the application starts again, for each list", async () => {
    const reloaded = await settingsFrom({
      codeHostingSavedSearches: {
        issues: [{ name: "Mine", query: "author:@me" }],
        requests: [{ name: "To review", query: "review-requested:@me" }],
      },
    });
    expect(reloaded.codeHostingSavedSearches).toEqual({
      issues: [{ name: "Mine", query: "author:@me" }],
      requests: [{ name: "To review", query: "review-requested:@me" }],
    });
  });

  it("are copied into both lists once, when the saved value is the old single list", async () => {
    const reloaded = await settingsFrom({
      codeHostingSavedSearches: [
        { name: "Mine", query: "author:@me" },
        { name: "Bugs", query: "label:bug" },
      ],
    });
    expect(reloaded.codeHostingSavedSearches).toEqual({
      issues: [
        { name: "Mine", query: "author:@me" },
        { name: "Bugs", query: "label:bug" },
      ],
      requests: [
        { name: "Mine", query: "author:@me" },
        { name: "Bugs", query: "label:bug" },
      ],
    });
    expect(reloaded.codeHostingSavedSearches.issues).not.toBe(reloaded.codeHostingSavedSearches.requests);
  });

  it("do not change one list when the other list changes after the copy", async () => {
    const reloaded = await settingsFrom({ codeHostingSavedSearches: [{ name: "Mine", query: "author:@me" }] });
    reloaded.codeHostingSavedSearches.issues.push({ name: "Bugs", query: "label:bug" });
    expect(reloaded.codeHostingSavedSearches.requests).toEqual([{ name: "Mine", query: "author:@me" }]);
  });

  it("drop an entry without a name or a search as text, and keep the others, in each list", async () => {
    const entries = [
      { name: "Mine", query: "author:@me" },
      { name: "", query: "label:bug" },
      { name: "No search" },
      { name: 4, query: "x" },
      null,
      "text",
      { name: "Mentions me", query: "mentions:@me", extra: true },
    ];
    const reloaded = await settingsFrom({ codeHostingSavedSearches: { issues: entries, requests: entries } });
    const kept = [
      { name: "Mine", query: "author:@me" },
      { name: "Mentions me", query: "mentions:@me" },
    ];
    expect(reloaded.codeHostingSavedSearches).toEqual({ issues: kept, requests: kept });
  });

  it("are none in a list that is missing or is not a list", async () => {
    const reloaded = await settingsFrom({
      codeHostingSavedSearches: { issues: [{ name: "Mine", query: "author:@me" }], requests: "To review" },
    });
    expect(reloaded.codeHostingSavedSearches).toEqual({ issues: [{ name: "Mine", query: "author:@me" }], requests: [] });
  });

  it("are none when the saved value is not a list or an object", async () => {
    const reloaded = await settingsFrom({ codeHostingSavedSearches: "Mine" });
    expect(reloaded.codeHostingSavedSearches).toEqual({ issues: [], requests: [] });
  });

  it("are none at the workspace level by default", () => {
    expect(settings.codeHostingWorkspaceSavedSearches).toEqual({});
  });

  it("are read again at the workspace level, for each workspace folder and each list", async () => {
    const saved = {
      "/work/heidrun": {
        issues: [{ name: "Bugs", query: "label:bug" }],
        requests: [{ name: "Drafts", query: "is:draft" }],
      },
      "/work/other": { issues: [{ name: "Mine", query: "author:@me" }], requests: [] },
    };
    const reloaded = await settingsFrom({ codeHostingWorkspaceSavedSearches: saved });
    expect(reloaded.codeHostingWorkspaceSavedSearches).toEqual(saved);
  });

  it("keep the user level as it was when a saved search of the workspace level exists", async () => {
    const reloaded = await settingsFrom({
      codeHostingSavedSearches: { issues: [{ name: "Mine", query: "author:@me" }], requests: [] },
      codeHostingWorkspaceSavedSearches: { "/work/heidrun": { issues: [{ name: "Bugs", query: "label:bug" }], requests: [] } },
    });
    expect(reloaded.codeHostingSavedSearches).toEqual({ issues: [{ name: "Mine", query: "author:@me" }], requests: [] });
  });

  it("drop the entries of the workspace level that have no name or no text, and the workspaces that keep nothing", async () => {
    const reloaded = await settingsFrom({
      codeHostingWorkspaceSavedSearches: {
        "/work/heidrun": { issues: [{ name: "", query: "label:bug" }, { name: "Bugs", query: 3 }, { name: "Ok", query: "a" }], requests: "x" },
        "/work/empty": { issues: [], requests: [] },
        "/work/broken": "Mine",
        "": { issues: [{ name: "Ok", query: "a" }], requests: [] },
      },
    });
    expect(reloaded.codeHostingWorkspaceSavedSearches).toEqual({
      "/work/heidrun": { issues: [{ name: "Ok", query: "a" }], requests: [] },
    });
  });

  it("are none at the workspace level when the saved value is not an object", async () => {
    for (const value of ["Mine", ["Mine"], 3, null]) {
      const reloaded = await settingsFrom({ codeHostingWorkspaceSavedSearches: value });
      expect(reloaded.codeHostingWorkspaceSavedSearches).toEqual({});
    }
  });
});

describe("goat sound", () => {
  /** The settings, as a new run of Heidrun Code reads them from what `localStorage` holds. */
  async function settingsFrom(savedText: string) {
    localStorage.setItem("heidrun.settings", savedText);
    vi.resetModules();
    return (await import("./settings")).settings;
  }

  it("is off by default", () => {
    expect(settings.goatSound).toBe(false);
  });

  it("is off for an existing installation whose saved settings have no goat sound option", async () => {
    const reloaded = await settingsFrom(JSON.stringify({ language: "fr", workingDays: [1, 2, 3] }));
    expect(reloaded.language).toBe("fr");
    expect(reloaded.goatSound).toBe(false);
  });

  it("is on after a restart when it was saved on", async () => {
    const reloaded = await settingsFrom(JSON.stringify({ goatSound: true }));
    expect(reloaded.goatSound).toBe(true);
  });

  it("is off when the saved value is not true or false", async () => {
    const reloaded = await settingsFrom(JSON.stringify({ goatSound: "yes" }));
    expect(reloaded.goatSound).toBe(false);
  });
});

describe("terminal text detection", () => {
  /** The settings, as a new run of Heidrun Code reads them from what `localStorage` holds. */
  async function settingsFrom(savedText: string) {
    localStorage.setItem("heidrun.settings", savedText);
    vi.resetModules();
    return (await import("./settings")).settings;
  }

  it("is on, with every family on, by default", () => {
    expect(settings.terminalTextDetection).toBe(true);
    expect(settings.disabledDetectionFamilies).toEqual([]);
  });

  it("keeps the families that were saved off, and the switch of the whole detection", async () => {
    const reloaded = await settingsFrom(JSON.stringify({ terminalTextDetection: false, disabledDetectionFamilies: ["filePaths", "tickets"] }));
    expect(reloaded.terminalTextDetection).toBe(false);
    expect(reloaded.disabledDetectionFamilies).toEqual(["filePaths", "tickets"]);
  });

  it("is on for an existing installation whose saved settings have no detection option", async () => {
    const reloaded = await settingsFrom(JSON.stringify({ language: "fr" }));
    expect(reloaded.terminalTextDetection).toBe(true);
    expect(reloaded.disabledDetectionFamilies).toEqual([]);
  });

  it("drops a saved family that does not exist any more, and a saved value of the wrong type", async () => {
    const reloaded = await settingsFrom(JSON.stringify({ terminalTextDetection: "no", disabledDetectionFamilies: ["filePaths", "oldFamily", 7] }));
    expect(reloaded.terminalTextDetection).toBe(true);
    expect(reloaded.disabledDetectionFamilies).toEqual(["filePaths"]);
    const notAList = await settingsFrom(JSON.stringify({ disabledDetectionFamilies: "filePaths" }));
    expect(notAList.disabledDetectionFamilies).toEqual([]);
  });

  it("saves a change of a switch at once", async () => {
    settings.terminalTextDetection = false;
    settings.disabledDetectionFamilies = ["commits"];
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const saved = JSON.parse(localStorage.getItem("heidrun.settings") ?? "{}");
    expect(saved.terminalTextDetection).toBe(false);
    expect(saved.disabledDetectionFamilies).toEqual(["commits"]);
    settings.terminalTextDetection = true;
    settings.disabledDetectionFamilies = [];
  });
});

describe("time format", () => {
  it("follows the language by default", () => {
    expect(settings.timeFormat).toBe("auto");
  });
});

describe("working days", () => {
  it("are all the days of the week by default", () => {
    expect(settings.workingDays).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

describe("zoom of the whole window", () => {
  it("is 1 at the default font size", () => {
    expect(zoomFactor()).toBe(1);
  });

  it("is the font size divided by the default font size", () => {
    zoom(2.5);
    expect(zoomFactor()).toBe((FONT_DEFAULT + 2.5) / FONT_DEFAULT);
  });

  it("is given to the web view, so the sidebar, the menus, the dialogs and the middle area change size together", async () => {
    setZoom.mockClear();
    zoom(2.5);
    await vi.waitFor(() => expect(setZoom).toHaveBeenLastCalledWith((FONT_DEFAULT + 2.5) / FONT_DEFAULT));
    resetZoom();
    await vi.waitFor(() => expect(setZoom).toHaveBeenLastCalledWith(1));
  });

  it("is saved and applied again after the application restarts", async () => {
    zoom(3);
    await vi.waitFor(() => expect(JSON.parse(localStorage.getItem("heidrun.settings") ?? "{}").fontSize).toBe(FONT_DEFAULT + 3));
    setZoom.mockClear();
    vi.resetModules();
    const restarted = await import("./settings");
    expect(restarted.settings.fontSize).toBe(FONT_DEFAULT + 3);
    await vi.waitFor(() => expect(setZoom).toHaveBeenLastCalledWith((FONT_DEFAULT + 3) / FONT_DEFAULT));
  });
});

describe("settings that got a new name to follow the glossary", () => {
  it("keeps the pinned panes, the width of the column of pinned panes, and the sidebar section of the right sidebar that an older version saved", async () => {
    localStorage.setItem(
      "heidrun.settings",
      JSON.stringify({ dockedPanes: ["p1", "p2"], dockWidth: 700, rightTab: "notes" }),
    );
    vi.resetModules();
    const restarted = await import("./settings");
    expect(restarted.settings.pinnedPanes).toEqual(["p1", "p2"]);
    expect(restarted.settings.columnOfPinnedPanesWidth).toBe(700);
    expect(restarted.settings.rightSidebarSection).toBe("notes");
  });

  it("forgets the old names, so that the saved value does not keep both names", async () => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ dockedPanes: ["p1"], dockWidth: 700, rightTab: "git" }));
    vi.resetModules();
    const restarted = await import("./settings");
    expect(Object.keys(restarted.settings)).not.toEqual(expect.arrayContaining(["dockedPanes"]));
    expect(Object.keys(restarted.settings)).not.toEqual(expect.arrayContaining(["dockWidth"]));
    expect(Object.keys(restarted.settings)).not.toEqual(expect.arrayContaining(["rightTab"]));
  });

  it("prefers the new name when the saved value has both names", async () => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ dockedPanes: ["old"], pinnedPanes: ["new"] }));
    vi.resetModules();
    const restarted = await import("./settings");
    expect(restarted.settings.pinnedPanes).toEqual(["new"]);
  });
});

describe("sidebar sections that moved from the right sidebar to the left sidebar", () => {
  it.each([
    ["actions", "launchers"],
    ["git", "sourceControl"],
  ])("shows the sidebar section %s in the left sidebar when an older version saved it for the right sidebar", async (section, leftSection) => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ rightSidebarSection: section }));
    vi.resetModules();
    const restarted = await import("./settings");
    expect(restarted.settings.leftSidebarSection).toBe(leftSection);
    expect(restarted.settings.rightSidebarSection).toBe("toHandle");
  });

  it("does the same for the name rightTab, that is older still", async () => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ rightTab: "git" }));
    vi.resetModules();
    const restarted = await import("./settings");
    expect(restarted.settings.leftSidebarSection).toBe("sourceControl");
    expect(restarted.settings.rightSidebarSection).toBe("toHandle");
  });

  it("keeps the sidebar section that the left sidebar already had", async () => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ rightSidebarSection: "git", leftSidebarSection: "launchers" }));
    vi.resetModules();
    const restarted = await import("./settings");
    expect(restarted.settings.leftSidebarSection).toBe("launchers");
    expect(restarted.settings.rightSidebarSection).toBe("toHandle");
  });

  it("keeps the sidebar sections that belong to the right sidebar", async () => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ rightSidebarSection: "notes" }));
    vi.resetModules();
    const restarted = await import("./settings");
    expect(restarted.settings.rightSidebarSection).toBe("notes");
    expect(restarted.settings.leftSidebarSection).toBe("launchers");
  });
});

describe("sidebar section of the right sidebar that was called Pane", () => {
  it("shows the sidebar section Needs you when the saved sidebar section was pane, because the Pane sidebar section is gone", async () => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ rightSidebarSection: "pane" }));
    vi.resetModules();
    const restarted = await import("./settings");
    expect(restarted.settings.rightSidebarSection).toBe("toHandle");
  });

  it("shows the sidebar section Needs you when nothing was saved", async () => {
    vi.resetModules();
    const restarted = await import("./settings");
    expect(restarted.settings.rightSidebarSection).toBe("toHandle");
  });

  it.each(["toHandle", "notes", "chats", "userActivity"])("keeps the saved sidebar section %s", async (section) => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ rightSidebarSection: section }));
    vi.resetModules();
    const restarted = await import("./settings");
    expect(restarted.settings.rightSidebarSection).toBe(section);
  });
});

describe("sidebar section of the left sidebar that was called Scripts", () => {
  it("shows the sidebar section Launchers when the saved sidebar section was actions, because the Scripts sidebar section became the Launchers sidebar section", async () => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ leftSidebarSection: "actions" }));
    vi.resetModules();
    const restarted = await import("./settings");
    expect(restarted.settings.leftSidebarSection).toBe("launchers");
  });

  it("keeps the sidebar section Launchers when it was saved", async () => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ leftSidebarSection: "launchers" }));
    vi.resetModules();
    const restarted = await import("./settings");
    expect(restarted.settings.leftSidebarSection).toBe("launchers");
  });
});

describe("options of the window Create a custom launcher that were called customScript", () => {
  it.each([
    ["customScriptKind", "customLauncherKind", "codingAgent"],
    ["customScriptModel", "customLauncherModel", "opus"],
    ["customScriptEffort", "customLauncherEffort", "high"],
  ])("keeps the saved value of %s under the name %s", async (oldName, newName, value) => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ [oldName]: value }));
    vi.resetModules();
    const restarted = await import("./settings");
    expect((restarted.settings as Record<string, unknown>)[newName]).toBe(value);
    expect(oldName in restarted.settings).toBe(false);
  });
});

describe("sidebar section of the left sidebar that held the workspaces", () => {
  it.each(["workspaces", "workspacesAndTabs"])("shows the sidebar section Launchers when the saved sidebar section was %s, because the workspaces left the left sidebar", async (savedName) => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ leftSidebarSection: savedName }));
    vi.resetModules();
    const restarted = await import("./settings");
    expect(restarted.settings.leftSidebarSection).toBe("launchers");
  });

  it("shows the sidebar section Launchers when the saved sidebar section was Needs you, because the Needs you sidebar section moved to the right sidebar", async () => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ leftSidebarSection: "toHandle", rightSidebarSection: "notes" }));
    vi.resetModules();
    const restarted = await import("./settings");
    expect(restarted.settings.leftSidebarSection).toBe("launchers");
    expect(restarted.settings.rightSidebarSection).toBe("notes");
  });

  it("keeps the sidebar section Needs you in the right sidebar when it was saved there", async () => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ rightSidebarSection: "toHandle" }));
    vi.resetModules();
    const restarted = await import("./settings");
    expect(restarted.settings.rightSidebarSection).toBe("toHandle");
    expect(restarted.settings.leftSidebarSection).toBe("launchers");
  });

  it("keeps the sidebar section Source control when it was saved", async () => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ leftSidebarSection: "sourceControl" }));
    vi.resetModules();
    const restarted = await import("./settings");
    expect(restarted.settings.leftSidebarSection).toBe("sourceControl");
  });

  it("shows the Source control sidebar section when an older version saved the Git sidebar section", async () => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ leftSidebarSection: "git" }));
    vi.resetModules();
    const restarted = await import("./settings");
    expect(restarted.settings.leftSidebarSection).toBe("sourceControl");
  });

  it("is the sidebar section Launchers that the left sidebar shows first", async () => {
    localStorage.clear();
    vi.resetModules();
    const restarted = await import("./settings");
    expect(restarted.settings.leftSidebarSection).toBe("launchers");
  });
});

/** The options of the windows and of the sidebar sections that the application saves: name, default value, other value. */
const SAVED_OPTIONS: [string, unknown, unknown][] = [
  ["filesSideMode", "tree", "grep"],
  ["filesGrepRegex", false, true],
  ["filesGrepCase", false, true],
  ["filesShowIgnored", false, true],
  ["agentsActivityScope", "all", "pane"],
  ["historyPeriod", "today", "90"],
  ["historyGroupBy", "ws", "feature"],
  ["historyShowAssumptions", false, true],
  ["searchRegex", false, true],
  ["searchAgentsOnly", false, true],
  ["searchThisWorkspace", false, true],
  ["notesShowAll", false, true],
  ["chatsAgent", "claude", "codex"],
  ["chatsView", "compact", "expanded"],
  ["chatsRefreshSeconds", 10, 30],
  ["dynamicTopics", true, false],
  ["gitFetchMinutes", 5, 0],
  ["dynamicTopicExtraction", "keyword", "languageModel"],
  ["clusteredDynamicTopics", false, true],
  ["goatSound", false, true],
  ["chatsSortKey", "last_updated", "files_written"],
  ["chatsOrder", "descending", "ascending"],
];

describe("the last state of each option", () => {
  it.each(SAVED_OPTIONS)("gives the default value of the option %s when nothing is saved", async (name, defaultValue) => {
    localStorage.clear();
    vi.resetModules();
    const restarted = await import("./settings");
    expect((restarted.settings as Record<string, unknown>)[name]).toEqual(defaultValue);
  });

  it.each(SAVED_OPTIONS)("saves the option %s when it changes, and gives it back after the application restarts", async (name, _defaultValue, otherValue) => {
    localStorage.clear();
    (settings as Record<string, unknown>)[name] = otherValue;
    await vi.waitFor(() => expect(JSON.parse(localStorage.getItem("heidrun.settings") ?? "{}")[name]).toEqual(otherValue));
    vi.resetModules();
    const restarted = await import("./settings");
    expect((restarted.settings as Record<string, unknown>)[name]).toEqual(otherValue);
    (settings as Record<string, unknown>)[name] = SAVED_OPTIONS.find((option) => option[0] === name)?.[1];
  });

  it("keeps the other options when the saved value holds only some of them", async () => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ searchRegex: true }));
    vi.resetModules();
    const restarted = await import("./settings");
    expect(restarted.settings.searchRegex).toBe(true);
    expect(restarted.settings.searchAgentsOnly).toBe(false);
    expect(restarted.settings.mouseMode).toBe("select");
  });
});

describe("a corrupted saved value", () => {
  it.each(["{not json", "", "null", "42", '"text"', "[]"])("gives the default values when the saved text is %j", async (savedText) => {
    localStorage.setItem("heidrun.settings", savedText);
    vi.resetModules();
    const restarted = await import("./settings");
    expect(restarted.settings.filesSideMode).toBe("tree");
    expect(restarted.settings.historyPeriod).toBe("today");
    expect(restarted.settings.fontSize).toBe(FONT_DEFAULT);
  });

  it("gives the default value for each option whose saved value has the wrong type, and keeps the other options", async () => {
    localStorage.setItem(
      "heidrun.settings",
      JSON.stringify({
        filesGrepRegex: "yes",
        historyPeriod: 7,
        workingDays: "monday",
        budgets: null,
        fontSize: "big",
        searchAgentsOnly: null,
        dynamicTopics: "no",
        gitFetchMinutes: "5",
        chatsRefreshSeconds: "10",
        theme: "dark",
      }),
    );
    vi.resetModules();
    const restarted = await import("./settings");
    expect(restarted.settings.dynamicTopics).toBe(true);
    expect(restarted.settings.gitFetchMinutes).toBe(5);
    expect(restarted.settings.chatsRefreshSeconds).toBe(10);
    expect(restarted.settings.filesGrepRegex).toBe(false);
    expect(restarted.settings.historyPeriod).toBe("today");
    expect(restarted.settings.workingDays).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(restarted.settings.budgets).toEqual({});
    expect(restarted.settings.fontSize).toBe(FONT_DEFAULT);
    expect(restarted.settings.searchAgentsOnly).toBe(false);
    expect(restarted.settings.theme).toBe("dark");
  });

  it("gives the default value for each option whose saved value is not in the list of its values, and keeps the other options", async () => {
    localStorage.setItem(
      "heidrun.settings",
      JSON.stringify({
        filesSideMode: "sideways",
        agentsActivityScope: "none",
        historyPeriod: "12",
        historyGroupBy: "year",
        chatsAgent: "gemini",
        chatsView: "wide",
        dynamicTopicExtraction: "oracle",
        gitFetchMinutes: 2,
        chatsSortKey: "best_match",
        chatsOrder: "random",
        newTabCommand: "emacs",
        searchRegex: true,
      }),
    );
    vi.resetModules();
    const restarted = await import("./settings");
    expect(restarted.settings.filesSideMode).toBe("tree");
    expect(restarted.settings.agentsActivityScope).toBe("all");
    expect(restarted.settings.historyPeriod).toBe("today");
    expect(restarted.settings.historyGroupBy).toBe("ws");
    expect(restarted.settings.chatsAgent).toBe("claude");
    expect(restarted.settings.chatsView).toBe("compact");
    expect(restarted.settings.dynamicTopicExtraction).toBe("keyword");
    expect(restarted.settings.gitFetchMinutes).toBe(5);
    expect(restarted.settings.chatsSortKey).toBe("last_updated");
    expect(restarted.settings.chatsOrder).toBe("descending");
    expect(restarted.settings.newTabCommand).toBe("terminal");
    expect(restarted.settings.searchRegex).toBe(true);
  });
});

describe("the default command of a new tab (issue #328)", () => {
  it("is a terminal when nothing is saved", async () => {
    localStorage.clear();
    vi.resetModules();
    const restarted = await import("./settings");
    expect(restarted.settings.newTabCommand).toBe("terminal");
  });

  it.each([
    { command: "terminal", ownedAgents: [] },
    { command: "claude", ownedAgents: ["claude"] },
    { command: "codex", ownedAgents: ["codex"] },
    { command: "agy", ownedAgents: ["antigravity"] },
  ] as const)("keeps the enabled saved command $command after a restart", async ({ command, ownedAgents }) => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ newTabCommand: command, ownedAgents }));
    vi.resetModules();
    const restarted = await import("./settings");
    expect(restarted.settings.newTabCommand).toBe(command);
  });

  it.each([
    ["claude", "claude"],
    ["codex", "codex"],
    ["agy", "antigravity"],
  ] as const)("uses Terminal when the saved command %s has a switched-off coding agent", async (command, agentId) => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ newTabCommand: command, ownedAgents: [] }));
    vi.resetModules();
    const disabled = await import("./settings");
    expect(disabled.settings.newTabCommand).toBe("terminal");
    expect(disabled.settings.ownedAgents).not.toContain(agentId);
  });
});

describe("sidebars that an older version hid completely (issue #315)", () => {
  it.each([
    ["leftOpen", "leftCollapsed"],
    ["rightOpen", "rightCollapsed"],
  ] as const)("collapses the sidebar when the saved %s is false", async (oldName, collapsedName) => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ [oldName]: false }));
    vi.resetModules();
    const restarted = await import("./settings");
    expect(restarted.settings[collapsedName]).toBe(true);
  });

  it.each([
    ["leftOpen", "leftCollapsed"],
    ["rightOpen", "rightCollapsed"],
  ] as const)("keeps the sidebar expanded when the saved %s is true", async (oldName, collapsedName) => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ [oldName]: true }));
    vi.resetModules();
    const restarted = await import("./settings");
    expect(restarted.settings[collapsedName]).toBe(false);
  });

  it("forgets the old names leftOpen and rightOpen, so that the saved value does not keep them", async () => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ leftOpen: false, rightOpen: false }));
    vi.resetModules();
    const restarted = await import("./settings");
    expect(Object.keys(restarted.settings)).not.toContain("leftOpen");
    expect(Object.keys(restarted.settings)).not.toContain("rightOpen");
  });
});

describe("diff mode of the large Git window", () => {
  it("reads the old saved value read as preview", async () => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ diffMode: "read" }));
    vi.resetModules();
    const restarted = await import("./settings");
    expect(restarted.settings.diffMode).toBe("preview");
  });

  it("keeps the saved value preview", async () => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ diffMode: "preview" }));
    vi.resetModules();
    const restarted = await import("./settings");
    expect(restarted.settings.diffMode).toBe("preview");
  });
});

describe("code theme", () => {
  it("is not a setting any more, and a saved choice is forgotten", async () => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ codeTheme: "dracula" }));
    vi.resetModules();
    const restarted = await import("./settings");
    expect(Object.keys(restarted.settings)).not.toContain("codeTheme");
  });
});

describe("legend filters of the bar charts of the Statistics window", () => {
  /** The settings, as a new run of Heidrun Code reads them from what `localStorage` holds. */
  async function settingsFrom(saved: unknown) {
    localStorage.setItem("heidrun.settings", JSON.stringify(saved));
    vi.resetModules();
    return (await import("./settings")).settings;
  }

  it("are none by default", () => {
    expect(settings.statisticsLegendFilters).toEqual({});
  });

  it("are read again when the application starts again", async () => {
    const reloaded = await settingsFrom({ statisticsLegendFilters: { ai_cost: "codex", git_history_lines: "lines_added" } });
    expect(reloaded.statisticsLegendFilters).toEqual({ ai_cost: "codex", git_history_lines: "lines_added" });
  });

  it("drop an entry that is not a text, and keep the others", async () => {
    const reloaded = await settingsFrom({ statisticsLegendFilters: { ai_cost: "codex", a: 4, b: null, c: "", d: ["x"] } });
    expect(reloaded.statisticsLegendFilters).toEqual({ ai_cost: "codex" });
  });

  it("are none when the saved value is not an object", async () => {
    expect((await settingsFrom({ statisticsLegendFilters: "codex" })).statisticsLegendFilters).toEqual({});
    expect((await settingsFrom({ statisticsLegendFilters: ["codex"] })).statisticsLegendFilters).toEqual({});
    expect((await settingsFrom({ statisticsLegendFilters: null })).statisticsLegendFilters).toEqual({});
  });
});

describe("selections of the tabs of the Statistics window (issue 707)", () => {
  /** The settings, as a new run of Heidrun Code reads them from what `localStorage` holds. */
  async function settingsFrom(saved: unknown) {
    localStorage.setItem("heidrun.settings", JSON.stringify(saved));
    vi.resetModules();
    return (await import("./settings")).settings;
  }

  it("are the existing choices by default", async () => {
    const reloaded = await settingsFrom({});
    expect(reloaded.statisticsUserActivityRange).toBe("day");
    expect(reloaded.statisticsUserActivitySlotLength).toBe("one_hour");
    expect(reloaded.statisticsUserActivityWorkspaces).toEqual({ isEveryWorkspaceChosen: true, folders: [] });
    expect(reloaded.statisticsPersonWorkSource).toBe("git_history");
    expect(reloaded.statisticsPersonWorkMetric).toBe("commits_and_pull_requests");
    expect(reloaded.statisticsPersonWorkUnit).toBe("dollars");
    expect(reloaded.statisticsPersonWorkPerson).toBe("");
    expect(reloaded.statisticsPersonWorkRange).toBe("seven_days");
    expect(reloaded.statisticsPersonWorkSlotHours).toBe(24);
    expect(reloaded.statisticsPersonWorkWorkspaces).toEqual({ isSaved: false, workspaceIds: [] });
  });

  it("are read again when the application starts again", async () => {
    const saved = {
      statisticsUserActivityRange: "month",
      statisticsUserActivitySlotLength: "six_hours",
      statisticsUserActivityWorkspaces: { isEveryWorkspaceChosen: false, folders: ["/work/heidrun"] },
      statisticsPersonWorkSource: "ai_cost",
      statisticsPersonWorkMetric: "lines",
      statisticsPersonWorkUnit: "tokens",
      statisticsPersonWorkPerson: "eric",
      statisticsPersonWorkRange: "thirty_days",
      statisticsPersonWorkSlotHours: 6,
      statisticsPersonWorkWorkspaces: { isSaved: true, workspaceIds: ["workspace-1", "workspace-2"] },
    };
    expect({ ...(await settingsFrom(saved)) }).toMatchObject(saved);
  });

  it("go back to the existing choice when a saved value is not in the list of its values", async () => {
    const reloaded = await settingsFrom({
      statisticsUserActivityRange: "year",
      statisticsUserActivitySlotLength: "ten_seconds",
      statisticsPersonWorkSource: "weather",
      statisticsPersonWorkMetric: "words",
      statisticsPersonWorkUnit: "euros",
      statisticsPersonWorkRange: "century",
      statisticsPersonWorkSlotHours: 5,
    });
    expect(reloaded.statisticsUserActivityRange).toBe("day");
    expect(reloaded.statisticsUserActivitySlotLength).toBe("one_hour");
    expect(reloaded.statisticsPersonWorkSource).toBe("git_history");
    expect(reloaded.statisticsPersonWorkMetric).toBe("commits_and_pull_requests");
    expect(reloaded.statisticsPersonWorkUnit).toBe("dollars");
    expect(reloaded.statisticsPersonWorkRange).toBe("seven_days");
    expect(reloaded.statisticsPersonWorkSlotHours).toBe(24);
  });

  it("go back to the existing choice when a saved value has the wrong type", async () => {
    const reloaded = await settingsFrom({
      statisticsUserActivityRange: 3,
      statisticsPersonWorkSource: null,
      statisticsPersonWorkPerson: 12,
      statisticsPersonWorkSlotHours: "6",
      statisticsUserActivityWorkspaces: "all",
      statisticsPersonWorkWorkspaces: ["workspace-1"],
    });
    expect(reloaded.statisticsUserActivityRange).toBe("day");
    expect(reloaded.statisticsPersonWorkSource).toBe("git_history");
    expect(reloaded.statisticsPersonWorkPerson).toBe("");
    expect(reloaded.statisticsPersonWorkSlotHours).toBe(24);
    expect(reloaded.statisticsUserActivityWorkspaces).toEqual({ isEveryWorkspaceChosen: true, folders: [] });
    expect(reloaded.statisticsPersonWorkWorkspaces).toEqual({ isSaved: false, workspaceIds: [] });
  });

  it("keep the texts of a saved list of workspaces, and drop the other entries", async () => {
    const reloaded = await settingsFrom({
      statisticsUserActivityWorkspaces: { isEveryWorkspaceChosen: false, folders: ["/work/heidrun", 4, null, "", ["x"]] },
      statisticsPersonWorkWorkspaces: { isSaved: true, workspaceIds: ["workspace-1", 4, null, "", { a: 1 }] },
    });
    expect(reloaded.statisticsUserActivityWorkspaces).toEqual({ isEveryWorkspaceChosen: false, folders: ["/work/heidrun"] });
    expect(reloaded.statisticsPersonWorkWorkspaces).toEqual({ isSaved: true, workspaceIds: ["workspace-1"] });
  });

  it("repair a choice of workspaces that lacks a field or holds a field of the wrong type", async () => {
    const reloaded = await settingsFrom({
      statisticsUserActivityWorkspaces: { isEveryWorkspaceChosen: "yes", folders: "/work/heidrun" },
      statisticsPersonWorkWorkspaces: { isSaved: "yes" },
    });
    expect(reloaded.statisticsUserActivityWorkspaces).toEqual({ isEveryWorkspaceChosen: true, folders: [] });
    expect(reloaded.statisticsPersonWorkWorkspaces).toEqual({ isSaved: false, workspaceIds: [] });
  });
});

describe("channels of the notifications (issue #857)", () => {
  /** The settings, as a new run of Heidrun Code reads them from what `localStorage` holds. */
  async function settingsFrom(savedText: string) {
    localStorage.setItem("heidrun.settings", savedText);
    vi.resetModules();
    return (await import("./settings")).settings;
  }

  it("turns the system notification on and the sound off for every kind in an existing installation", async () => {
    const reloaded = await settingsFrom(JSON.stringify({ language: "fr" }));
    for (const channel of Object.values(reloaded.notificationChannels)) {
      expect(channel).toEqual({ isSystemEnabled: true, isSoundEnabled: false, soundName: "Ping" });
    }
  });

  it("keeps a saved channel after a restart", async () => {
    const reloaded = await settingsFrom(
      JSON.stringify({ notificationChannels: { blocked: { isSystemEnabled: true, isSoundEnabled: true, soundName: "Funk" } } }),
    );
    expect(reloaded.notificationChannels.blocked).toEqual({ isSystemEnabled: true, isSoundEnabled: true, soundName: "Funk" });
    expect(reloaded.notificationChannels.done.isSoundEnabled).toBe(false);
  });

  it("gives the defaults back when the saved value is corrupted", async () => {
    const reloaded = await settingsFrom(JSON.stringify({ notificationChannels: "loud" }));
    expect(reloaded.notificationChannels.blocked.isSoundEnabled).toBe(false);
  });
});
