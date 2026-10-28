// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import type { AiCostAnswer, AiCostHourRow, AiCostSynchronization } from "../lib/ai_cost";
import type { PersonWorkItems } from "../lib/person_work";

const invoke = vi.fn();

/** The channel of Tauri: a test sends a progress report by calling `onmessage` of the channel that the tab gave. */
const { FakeChannel } = vi.hoisted(() => ({
  FakeChannel: class<T> {
    onmessage: (message: T) => void = () => {};
  },
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: (...args: unknown[]) => invoke(...args), Channel: FakeChannel }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

/** The calls that the chart makes to Plotly.js: jsdom cannot draw an SVG chart, so Plotly.js is replaced. */
const plotly = { react: vi.fn(), purge: vi.fn(), Plots: { resize: vi.fn() } };
vi.mock("plotly.js-basic-dist-min", () => ({ default: plotly }));

/** A workspace that is open in the test, as the store gives it. */
type TestWorkspace = { workspaceId: string; label: string; folder: string };

/** The tab reads the repository of an open workspace: the test chooses the open workspaces and the selected workspace. */
vi.mock("../stores/user_activity", async () => {
  const { ref } = await import("vue");
  return { selectedWorkspaceId: ref<string | null>(null), openWorkspaces: ref<TestWorkspace[]>([]) };
});

/** The two workspaces that are open at the start of each test. The first one is selected. */
const WORKSPACES: TestWorkspace[] = [
  { workspaceId: "workspace-heidrun", label: "heidrun", folder: "/work/heidrun" },
  { workspaceId: "workspace-mobile", label: "mobile", folder: "/work/mobile" },
];

/**
 * Chooses the workspaces that are open, and the selected workspace. The module of the store is replaced by plain references
 * that the test can set.
 *
 * @param workspaces - The workspaces that are open.
 * @param selectedId - The identifier of the selected workspace, or `null` when no workspace is selected.
 */
async function openWorkspacesAre(workspaces: TestWorkspace[], selectedId: string | null = workspaces[0]?.workspaceId ?? null): Promise<void> {
  const store = await import("../stores/user_activity");
  (store.openWorkspaces as unknown as { value: TestWorkspace[] }).value = workspaces;
  (store.selectedWorkspaceId as unknown as { value: string | null }).value = selectedId;
}

/** The functions that the chart registered for the events of Plotly.js, by the name of the event. */
const plotlyHandlers: Record<string, (event: unknown) => unknown> = {};

/** What one call to `Plotly.react` drew: the two bar traces, and the layout. */
type Drawing = {
  traces: Array<{ name: string; x: number[]; y: number[]; hoverinfo: string; visible?: boolean | string; marker: { color: string } }>;
  layout: {
    barmode: string;
    title: { text: string };
    xaxis: { type: string; title: { text: string }; range: number[]; tickmode: string; tickvals: number[]; ticktext: string[] };
    yaxis: { dtick?: number; tickprefix?: string; ticksuffix?: string };
    legend: { orientation: string; x: number; y: number };
  };
};

/** Waits until the chart has called Plotly.js this number of times: the chart loads Plotly.js after it mounts. */
async function waitForDrawings(drawingCount: number): Promise<void> {
  await vi.waitFor(() => expect(plotly.react).toHaveBeenCalledTimes(drawingCount));
}

/** The last drawing that the chart gave to Plotly.js. */
function lastDrawing(): Drawing {
  const call = plotly.react.mock.calls[plotly.react.mock.calls.length - 1];
  return { traces: call[1], layout: call[2] };
}

/**
 * Moves the pointer onto the bar of a day, as Plotly.js tells the chart, and waits for the chart information card.
 *
 * @param dayIndex - The index of the day, from the oldest day.
 */
async function hoverDay(dayIndex: number): Promise<void> {
  plotlyHandlers.plotly_hover({ points: [{ pointNumber: dayIndex }], event: { clientX: 100, clientY: 50 } });
  await flushPromises();
}

/** What the chart information card shows: the title, the total or `null`, and the name and the value of each row. */
function cardOf(wrapper: VueWrapper) {
  const card = wrapper.find('[role="tooltip"]');
  if (card.exists() === false) {
    return null;
  }
  const total = card.find('[data-field="total"] span:last-child');
  return {
    title: card.get(".fw-semibold").text(),
    total: total.exists() ? total.text() : null,
    rows: card.findAll('[data-field="row"]').map((row) => [row.element.children[0].textContent?.trim(), row.element.children[1].textContent]),
  };
}

/** A time at 12:00 of the clock of the computer, `daysAgo` days before today, as an ISO 8601 text. */
function daysAgo(daysAgo: number): string {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysAgo, 12).toISOString();
}

/**
 * Jérôme has three commits (18 lines added and 6 lines deleted), one pull request, and two issues. Eric has one commit
 * (7 lines added and no line deleted) and one issue.
 */
function sampleItems(): PersonWorkItems {
  const jerome = { authorName: "Jerome Etienne", authorEmail: "jerome@example.com" };
  return {
    repository: "heidrun-org/heidrun",
    commits: [
      { ...jerome, committedAt: daysAgo(3), insertions: 10, deletions: 2 },
      { ...jerome, committedAt: daysAgo(0), insertions: 5, deletions: 1 },
      { ...jerome, committedAt: daysAgo(0), insertions: 3, deletions: 3 },
      { authorName: "Eric", authorEmail: "eric@example.com", committedAt: daysAgo(0), insertions: 7, deletions: 0 },
    ],
    pullRequests: [{ author: "jeromeetienne", createdAt: daysAgo(0) }],
    issues: [
      { author: "jeromeetienne", createdAt: daysAgo(0) },
      { author: "jeromeetienne", createdAt: daysAgo(10) },
      { author: "eric", createdAt: daysAgo(1) },
    ],
    codeHostingError: null,
  };
}

/** One row of the answer: the tokens and the cost of a coding agent in the hour `hour` of the day `daysAgo` days before today. */
function hourRow(daysAgo: number, codingAgent: string, costUsd: number | null, tokens: number, hour = 0): AiCostHourRow {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysAgo, hour);
  const day = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
  return { startedAt: start.toISOString(), day, codingAgent, tokens, costUsd, unpricedTokens: costUsd === null ? tokens : 0 };
}

/** The state of the workspace `folder` after an import: its history is imported, with no error. */
function importedWorkspace(folder: string) {
  return { folder, repository: "heidrun-org/heidrun", synchronizedAt: new Date(2026, 9, 14, 9, 30).toISOString(), error: null };
}

/** An answer of the command `ai_cost_in_range` for the workspace `folder`, with these rows, imported and with prices. */
function aiCostAnswer(hours: AiCostHourRow[], folder = "/work/heidrun"): AiCostAnswer {
  return {
    workspaces: [importedWorkspace(folder)],
    hours,
    priceVersion: 3,
    pricesCheckedAt: new Date(2026, 9, 14, 8, 0).toISOString(),
  };
}

/**
 * Claude Code costs 3 dollars and used 30,000 tokens ten days ago, 2.5 dollars and 25,000 tokens yesterday, and 1.5 dollars
 * and 15,000 tokens today. Codex costs 0.5 dollars and used 5,000 tokens two days ago, and used 20,000 tokens yesterday with
 * no known price.
 */
function sampleAiCostAnswer(): AiCostAnswer {
  return aiCostAnswer([
    hourRow(10, "claude", 3, 30_000),
    hourRow(2, "codex", 0.5, 5_000),
    hourRow(1, "claude", 2.5, 25_000),
    hourRow(1, "codex", null, 20_000),
    hourRow(0, "claude", 1.5, 15_000),
  ]);
}

/**
 * The tabs that the tests of this file mounted. The tab watches the store of the workspaces, and the test replaces the store
 * by plain references that every test shares, so a tab that stays mounted reads again when the next test changes them.
 */
const mountedTabs: VueWrapper[] = [];

/** The text and the state of each stage of the update, in order. */
function stagesOf(wrapper: VueWrapper): [string, string | undefined][] {
  return wrapper.findAll("[data-stage]").map((stage) => [stage.get('[data-note="stage-text"]').text(), stage.attributes("data-state")]);
}

/** Gives a function that sends a progress report through the channel of the last call of the command `person_work_synchronize`. */
function progressChannel(): (stage: string, doneCount: number, totalCount: number | null, isFinished?: boolean) => void {
  const calls = personWorkCalls();
  const call = calls[calls.length - 1];
  const channel = (call?.[1] as { onProgress: InstanceType<typeof FakeChannel<unknown>> }).onProgress;
  return (stage, doneCount, totalCount, isFinished = false) => {
    channel.onmessage({ repository: "heidrun-org/heidrun_code", stage, doneCount, totalCount, isFinished });
  };
}

/** Mounts the tab with the items that the commands give, or with an error. A promise that never ends keeps a read pending. */
async function mountPersonWorkTab(
  result: PersonWorkItems | Error | Promise<PersonWorkItems> = sampleItems(),
  aiCost: AiCostAnswer | Error | Promise<AiCostAnswer> = sampleAiCostAnswer(),
) {
  invoke.mockReset();
  invoke.mockImplementation(async (command: string, parameters: { folders?: string[] }) => {
    if (command === "person_work_synchronize") {
      return result instanceof Error
        ? Promise.reject(result)
        : Promise.resolve(result).then((items) => ({ repository: items.repository, codeHostingError: items.codeHostingError }));
    }
    if (command === "person_work_in_range") {
      return result instanceof Error ? Promise.reject(result) : result;
    }
    if (command === "ai_cost_synchronize") {
      return synchronizationOf(parameters.folders ?? []);
    }
    if (command === "ai_cost_in_range") {
      return aiCost instanceof Error ? Promise.reject(aiCost) : aiCost;
    }
    return undefined;
  });
  const { default: PersonWorkTab } = await import("./PersonWorkTab.vue");
  const wrapper = mount(PersonWorkTab, { attachTo: document.body });
  mountedTabs.push(wrapper);
  await flushPromises();
  return wrapper;
}

/**
 * The calls that asked the data layer to read the work of the people of one folder: the other stores also call `invoke` when
 * they load. A read of a folder is one synchronization and one query, so the synchronizations count the reads.
 */
function personWorkCalls(): unknown[][] {
  return invoke.mock.calls.filter((call) => call[0] === "person_work_synchronize");
}

/** The calls of the query `person_work_in_range`, which reads the SQLite file only. */
function personWorkQueryCalls(): unknown[][] {
  return invoke.mock.calls.filter((call) => call[0] === "person_work_in_range");
}

/** The answer of the command `ai_cost_synchronize`: the workspaces are imported, and the prices are refreshed. */
function synchronizationOf(folders: string[]): AiCostSynchronization {
  return { workspaces: folders.map(importedWorkspace), priceWarning: null };
}

/** The calls that asked the data layer for the stored AI cost. */
function aiCostCalls(): unknown[][] {
  return invoke.mock.calls.filter((call) => call[0] === "ai_cost_in_range");
}

/** The calls that asked the data layer to update, or to import, the stored token usage. */
function synchronizeCalls(): unknown[][] {
  return invoke.mock.calls.filter((call) => call[0] === "ai_cost_synchronize");
}

/** The texts and the states of the buttons of the radio button group that has this name. */
function radioGroup(wrapper: Awaited<ReturnType<typeof mountPersonWorkTab>>, name: string) {
  const inputs = wrapper.findAll(`input[name="${name}"]`);
  return {
    texts: inputs.map((input) => input.element.closest("label")?.textContent?.trim()),
    checked: inputs.map((input) => (input.element as HTMLInputElement).checked),
    classes: inputs.map((input) => input.element.closest("label")?.className ?? ""),
  };
}

/** Chooses the source AI cost, and waits for the tab to read the chats. */
async function chooseAiCost(wrapper: Awaited<ReturnType<typeof mountPersonWorkTab>>): Promise<void> {
  await wrapper.get("#statistics-person-source-ai_cost").setValue(true);
  await flushPromises();
}

/** The totals of the AI cost under the chooser: Claude Code, Codex, and the two together. */
function aiCostTotalsOf(wrapper: Awaited<ReturnType<typeof mountPersonWorkTab>>): string[] {
  return ["claude", "codex", "total"].map((id) => wrapper.get(`[data-total="${id}"] .fs-4`).text());
}

/** The identifiers of the totals of the Git history under the chooser, from left to right. */
const GIT_HISTORY_TOTAL_IDS = ["commits", "pull-requests", "issues", "lines-added", "lines-deleted"];

/** The totals under the chooser: the commits, the pull requests, the issues, the lines added, and the lines deleted. */
function totalsOf(wrapper: Awaited<ReturnType<typeof mountPersonWorkTab>>): string[] {
  return GIT_HISTORY_TOTAL_IDS.map((id) => wrapper.get(`[data-total="${id}"] .fs-4`).text());
}

/** The average per day under each total of the Git history, from left to right. */
function perDayOf(wrapper: Awaited<ReturnType<typeof mountPersonWorkTab>>): string[] {
  return GIT_HISTORY_TOTAL_IDS.map((id) => wrapper.get(`[data-total="${id}"] [data-per-day]`).text());
}

/** The average per day under each total of the AI cost, from left to right. */
function aiCostPerDayOf(wrapper: Awaited<ReturnType<typeof mountPersonWorkTab>>): string[] {
  return ["claude", "codex", "total"].map((id) => wrapper.get(`[data-total="${id}"] [data-per-day]`).text());
}

/** The commits, the pull requests, and the issues of the second workspace, a repository that is not the first one. */
function mobileItems(): PersonWorkItems {
  return {
    repository: "heidrun-org/mobile",
    commits: [{ authorName: "Jerome Etienne", authorEmail: "jerome@example.com", committedAt: daysAgo(1), insertions: 40, deletions: 4 }],
    pullRequests: [{ author: "jeromeetienne", createdAt: daysAgo(2) }],
    issues: [],
    codeHostingError: null,
  };
}

/** The AI cost of the second workspace: Codex costs 9 dollars and used 90,000 tokens today. */
function mobileAiCostAnswer(): AiCostAnswer {
  return aiCostAnswer([hourRow(0, "codex", 9, 90_000)], "/work/mobile");
}

/**
 * Makes the commands answer with the data of each folder. A folder that the answers do not hold gives an error. The data layer
 * adds up the workspaces that one call asks for, so the answer to the AI cost is the answers of the folders put together.
 */
function answerByFolder(given: Record<string, { gitHistory: PersonWorkItems | Error; aiCost: AiCostAnswer | Error }>): void {
  const answers: Record<string, { gitHistory: PersonWorkItems | Error; aiCost: AiCostAnswer | Error }> = {
    "/work/heidrun": { gitHistory: sampleItems(), aiCost: sampleAiCostAnswer() },
    ...given,
  };
  invoke.mockImplementation(async (command: string, parameters: { folder?: string; folders?: string[]; repository?: string }) => {
    if (command === "person_work_synchronize") {
      const answer = answers[parameters.folder ?? ""]?.gitHistory;
      if (answer === undefined) {
        throw new Error(`no answer for ${parameters.folder}`);
      }
      return answer instanceof Error
        ? Promise.reject(answer)
        : { repository: `of:${parameters.folder}`, codeHostingError: answer.codeHostingError };
    }
    if (command === "person_work_in_range") {
      return answers[(parameters.repository ?? "").replace("of:", "")]?.gitHistory;
    }
    if (command === "ai_cost_synchronize") {
      return synchronizationOf(parameters.folders ?? []);
    }
    if (command === "ai_cost_in_range") {
      const parts = (parameters.folders ?? []).map((folder) => answers[folder]?.aiCost);
      const failure = parts.find((part) => part === undefined || part instanceof Error);
      if (failure !== undefined) {
        throw failure instanceof Error ? failure : new Error(`no answer for ${parameters.folders}`);
      }
      const answered = parts as AiCostAnswer[];
      return { ...answered[0], workspaces: answered.flatMap((part) => part.workspaces), hours: answered.flatMap((part) => part.hours) };
    }
    return undefined;
  });
}

/** The checkbox of a workspace, in the buttons of the workspaces. */
function workspaceBox(wrapper: Awaited<ReturnType<typeof mountPersonWorkTab>>, workspaceId: string) {
  return wrapper.get(`#statistics-person-workspace-${workspaceId}`);
}

/** Chooses or drops a workspace, and waits for the reads. */
async function chooseWorkspace(wrapper: Awaited<ReturnType<typeof mountPersonWorkTab>>, workspaceId: string, isChosen: boolean): Promise<void> {
  await workspaceBox(wrapper, workspaceId).setValue(isChosen);
  await flushPromises();
}

/** The names of the workspaces that are chosen, in the order of the buttons. */
function chosenWorkspaceNames(wrapper: Awaited<ReturnType<typeof mountPersonWorkTab>>): string[] {
  return wrapper
    .findAll('input[id^="statistics-person-workspace-workspace-"]')
    .filter((input) => (input.element as HTMLInputElement).checked)
    .map((input) => input.element.closest("label")?.textContent?.trim() ?? "");
}

/**
 * The time zone of every test. It changes the clock for summer time, so a test can check the days of 23 and 25 hours, and the
 * fixed date of the tests gives the same slots on every computer (issue 873).
 */
const TEST_TIME_ZONE = "Europe/Paris";

/** The time zone of the computer before the test, given back after the test. */
let computerTimeZone: string | undefined;

/**
 * Fixes the date of the tests at 15:00 of the day `day` of the month `monthIndex` 2026, in the time zone of the tests. Only
 * the date is fake: the timers stay real, so that `vi.waitFor` still checks again.
 *
 * @param monthIndex - The month, from 0 for January.
 * @param day - The day of the month.
 */
function setToday(monthIndex: number, day: number): void {
  vi.setSystemTime(new Date(2026, monthIndex, day, 15));
}

beforeEach(async () => {
  computerTimeZone = process.env.TZ;
  process.env.TZ = TEST_TIME_ZONE;
  vi.useFakeTimers({ toFake: ["Date"] });
  setToday(9, 14);
  localStorage.clear();
  vi.resetModules();
  await openWorkspacesAre(WORKSPACES);
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: () => {} }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  for (const name of Object.keys(plotlyHandlers)) {
    delete plotlyHandlers[name];
  }
  plotly.react.mockReset();
  plotly.react.mockImplementation((element: { on?: unknown }) => {
    element.on = (name: string, callback: (event: unknown) => void) => {
      plotlyHandlers[name] = callback;
    };
  });
  plotly.purge.mockReset();
  document.body.innerHTML = "";
});

afterEach(() => {
  for (const wrapper of mountedTabs.splice(0)) {
    wrapper.unmount();
  }
  vi.useRealTimers();
  if (computerTimeZone === undefined) {
    delete process.env.TZ;
  } else {
    process.env.TZ = computerTimeZone;
  }
});

describe("PersonWorkTab", () => {
  it("synchronizes the repository of the selected workspace, then reads the last 30 days from the stored rows", async () => {
    await mountPersonWorkTab();
    expect(personWorkCalls()).toHaveLength(1);
    expect(personWorkCalls()[0][1]).toEqual({ folder: "/work/heidrun", onProgress: expect.any(FakeChannel) });
    expect(personWorkQueryCalls()).toHaveLength(1);
    const parameters = personWorkQueryCalls()[0][1] as { repository: string; since: string; until: string };
    expect(parameters.repository).toBe("heidrun-org/heidrun");
    const days = (Date.parse(parameters.until) - Date.parse(parameters.since)) / 86_400_000;
    expect(days).toBeGreaterThanOrEqual(29.9);
    expect(days).toBeLessThanOrEqual(30.1);
  });

  it("chooses the person with the most items at first, and lists every person in the chooser", async () => {
    const wrapper = await mountPersonWorkTab();
    const select = wrapper.get("#statistics-person");
    expect((select.element as HTMLSelectElement).value).toBe("jeromeetienne");
    expect(select.findAll("option").map((option) => option.text())).toEqual(["Jerome Etienne", "Eric"]);
  });

  it("has a Bootstrap radio button group of the time range, with Last 7 days chosen at first", async () => {
    const wrapper = await mountPersonWorkTab();
    const group = radioGroup(wrapper, "statistics-person-period");
    expect(group.texts).toEqual(["3 days", "7 days", "14 days", "30 days"]);
    expect(group.checked).toEqual([false, true, false, false]);
    expect(group.classes.every((name) => name.includes("btn-check") && name.includes("btn-outline") && name.includes("theme-secondary"))).toBe(true);
  });

  it("has a Bootstrap radio button group of the source, with Git history chosen at first", async () => {
    const wrapper = await mountPersonWorkTab();
    const group = radioGroup(wrapper, "statistics-person-source");
    expect(group.texts).toEqual(["Git history", "AI cost"]);
    expect(group.checked).toEqual([true, false]);
    expect(group.classes.every((name) => name.includes("btn-check") && name.includes("btn-outline") && name.includes("theme-secondary"))).toBe(true);
  });

  it("shows the number of commits, of pull requests, and of issues of the person in the time range", async () => {
    const wrapper = await mountPersonWorkTab();
    expect(totalsOf(wrapper).slice(0, 3)).toEqual(["3", "1", "1"]);
    expect(wrapper.get('[data-total="commits"]').text()).toContain("Commits");
    expect(wrapper.get('[data-total="pull-requests"]').text()).toContain("Pull requests");
    expect(wrapper.get('[data-total="issues"]').text()).toContain("Issues");
  });

  it("shows the lines added and the lines deleted by the commits of the person in the time range", async () => {
    const wrapper = await mountPersonWorkTab();
    expect(totalsOf(wrapper).slice(3)).toEqual(["18", "6"]);
    expect(wrapper.get('[data-total="lines-added"]').text()).toContain("Lines added");
    expect(wrapper.get('[data-total="lines-deleted"]').text()).toContain("Lines deleted");
  });

  it("shows the average per day under each total of the Git history, for 7 days and for 30 days", async () => {
    const wrapper = await mountPersonWorkTab();
    expect(perDayOf(wrapper)).toEqual(["0.43 per day", "0.14 per day", "0.14 per day", "2.6 per day", "0.86 per day"]);
    await wrapper.get("#statistics-person-period-thirty_days").setValue(true);
    expect(perDayOf(wrapper)).toEqual(["0.1 per day", "0.03 per day", "0.07 per day", "0.6 per day", "0.2 per day"]);
  });

  it("shows the averages per day for 3 days and for 14 days", async () => {
    const wrapper = await mountPersonWorkTab();
    await wrapper.get("#statistics-person-period-three_days").setValue(true);
    expect(totalsOf(wrapper)).toEqual(["2", "1", "1", "8", "4"]);
    expect(perDayOf(wrapper)).toEqual(["0.67 per day", "0.33 per day", "0.33 per day", "2.7 per day", "1.3 per day"]);
    await wrapper.get("#statistics-person-period-fourteen_days").setValue(true);
    expect(totalsOf(wrapper)).toEqual(["3", "1", "2", "18", "6"]);
    expect(perDayOf(wrapper)).toEqual(["0.21 per day", "0.07 per day", "0.14 per day", "1.3 per day", "0.43 per day"]);
  });

  it("draws 3 bars for Last 3 days and 14 bars for Last 14 days, without reading again", async () => {
    const wrapper = await mountPersonWorkTab();
    await waitForDrawings(1);
    await wrapper.get("#statistics-person-period-three_days").setValue(true);
    await vi.waitFor(() => expect(lastDrawing().traces[0].x).toHaveLength(3));
    expect(lastDrawing().layout.xaxis.ticktext).toHaveLength(3);
    await wrapper.get("#statistics-person-period-fourteen_days").setValue(true);
    await vi.waitFor(() => expect(lastDrawing().traces[0].x).toHaveLength(14));
    expect(lastDrawing().layout.xaxis.ticktext).toHaveLength(5);
    expect(personWorkCalls()).toHaveLength(1);
  });

  it("changes the totals and the averages when the person changes", async () => {
    const wrapper = await mountPersonWorkTab();
    await wrapper.get("#statistics-person").setValue("eric");
    expect(totalsOf(wrapper).slice(3)).toEqual(["7", "0"]);
    expect(perDayOf(wrapper)[3]).toBe("1 per day");
    expect(perDayOf(wrapper)[4]).toBe("0 per day");
  });

  it("draws one stacked bar for each day: the commits below, and the pull requests above", async () => {
    await mountPersonWorkTab();
    await waitForDrawings(1);
    const { traces, layout } = lastDrawing();
    expect(layout.barmode).toBe("stack");
    expect(layout.title.text).toBe("Jerome Etienne: commits and pull requests, in slots of 1 day");
    expect(traces.map((trace) => trace.name)).toEqual(["Commits", "Pull requests"]);
    expect(traces[0].x).toHaveLength(7);
    expect(traces[0].y).toEqual([0, 0, 0, 1, 0, 0, 2]);
    expect(traces[1].y).toEqual([0, 0, 0, 0, 0, 0, 1]);
    expect(traces[0].marker.color).not.toBe(traces[1].marker.color);
    expect(traces.every((trace) => trace.hoverinfo === "none")).toBe(true);
    expect(layout.yaxis.dtick).toBe(1);
  });

  it("has a radio button group of the metric of the Git history, with the commits and the pull requests chosen at first, for the source Git history only", async () => {
    const wrapper = await mountPersonWorkTab();
    const group = radioGroup(wrapper, "statistics-person-metric");
    expect(group.texts).toEqual(["Commits and pull requests", "Lines added and deleted"]);
    expect(group.checked).toEqual([true, false]);
    expect(group.classes.every((name) => name.includes("btn-check") && name.includes("btn-outline") && name.includes("theme-secondary"))).toBe(true);
    expect(wrapper.find('[role="group"][aria-label="Metric of the Git history"]').exists()).toBe(true);
    await chooseAiCost(wrapper);
    expect(wrapper.find('input[name="statistics-person-metric"]').exists()).toBe(false);
    await wrapper.get("#statistics-person-source-git_history").setValue(true);
    expect(radioGroup(wrapper, "statistics-person-metric").checked).toEqual([true, false]);
  });

  it("shows a visible label before every input, for both sources", async () => {
    const wrapper = await mountPersonWorkTab();
    const visibleLabelsOf = (): string[] => {
      const groups = wrapper.findAll('[role="group"][aria-label]');
      return groups.map((group) => {
        let label = group.element.previousElementSibling;
        while (label !== null && label.classList.contains("form-text") === false) {
          label = label.previousElementSibling;
        }
        expect(label).not.toBeNull();
        return label?.textContent?.trim() ?? "";
      });
    };
    expect(visibleLabelsOf()).toEqual(["Source of the chart", "Metric of the Git history", "Slot length", "Time range", "Workspaces", "Workspaces"]);
    expect(wrapper.get("label[for='statistics-person'] > .form-text").text()).toBe("Person");
    await chooseAiCost(wrapper);
    expect(visibleLabelsOf()).toEqual(["Source of the chart", "Unit of the AI cost", "Slot length", "Time range", "Workspaces", "Workspaces"]);
  });

  it("puts the slot length and the time range on the first line of the right column, the workspaces on the second line, and keeps the other inputs on the left", async () => {
    const wrapper = await mountPersonWorkTab();
    const group = (label: string, index = 0) => wrapper.findAll(`[role="group"][aria-label="${label}"]`)[index].element;
    const rightColumn = group("Time range").closest(".flex-column");
    expect(rightColumn).not.toBeNull();
    expect(rightColumn?.contains(group("Slot length"))).toBe(true);
    expect(rightColumn?.contains(group("All or none of the workspaces"))).toBe(true);
    expect(rightColumn?.contains(group("Workspaces"))).toBe(true);
    expect(rightColumn?.contains(group("Source of the chart"))).toBe(false);
    expect(rightColumn?.contains(group("Metric of the Git history"))).toBe(false);
    expect(rightColumn?.contains(wrapper.get("#statistics-person").element)).toBe(false);
    const lines = [...(rightColumn?.children ?? [])].map((line) =>
      [...line.querySelectorAll(".form-text")].map((label) => label.textContent?.trim()),
    );
    expect(lines).toEqual([["Slot length", "Time range"], ["Workspaces"]]);
    for (const line of rightColumn?.children ?? []) {
      expect(line.classList.contains("ms-auto")).toBe(true);
    }
  });

  it("puts the source and the person chooser on the first line of the left column, and the metric or the unit on the second line", async () => {
    const wrapper = await mountPersonWorkTab();
    const linesOf = (): (string | undefined)[][] => {
      const leftColumn = wrapper.get('[role="group"][aria-label="Source of the chart"]').element.closest(".align-items-start");
      expect(leftColumn?.className).toContain("flex-column");
      return [...(leftColumn?.children ?? [])].map((line) =>
        [...line.querySelectorAll(".form-text")].map((label) => label.textContent?.trim()),
      );
    };
    expect(linesOf()).toEqual([["Source of the chart", "Person"], ["Metric of the Git history"]]);
    await chooseAiCost(wrapper);
    expect(linesOf()).toEqual([["Source of the chart"], ["Unit of the AI cost"]]);
  });

  it("makes every button group and the person chooser small", async () => {
    const wrapper = await mountPersonWorkTab();
    const groups = wrapper.findAll('[role="group"][aria-label]');
    expect(groups).toHaveLength(6);
    expect(groups.every((group) => group.classes().includes("btn-group") && group.classes().includes("btn-group-sm"))).toBe(true);
    expect(wrapper.get("#statistics-person").classes()).toContain("form-control-sm");
    await chooseAiCost(wrapper);
    expect(wrapper.findAll('[role="group"][aria-label]').every((group) => group.classes().includes("btn-group-sm"))).toBe(true);
  });

  it("draws one stacked bar for each slot with the lines added below and the lines deleted above when the lines are chosen", async () => {
    const wrapper = await mountPersonWorkTab();
    await waitForDrawings(1);
    await wrapper.get("#statistics-person-metric-lines").setValue(true);
    await waitForDrawings(2);
    const { traces, layout } = lastDrawing();
    expect(layout.barmode).toBe("stack");
    expect(layout.title.text).toBe("Jerome Etienne: lines added and lines deleted, in slots of 1 day");
    expect(traces.map((trace) => trace.name)).toEqual(["Lines added", "Lines deleted"]);
    expect(traces[0].x).toHaveLength(7);
    expect(traces[0].y).toEqual([0, 0, 0, 10, 0, 0, 8]);
    expect(traces[1].y).toEqual([0, 0, 0, 2, 0, 0, 4]);
    expect(traces[0].marker.color).not.toBe(traces[1].marker.color);
    expect(traces.every((trace) => trace.hoverinfo === "none")).toBe(true);
    expect(layout.legend).toMatchObject({ orientation: "h", y: 1.1 });
  });

  it("gives the chart of the lines a title for the vertical axis and a description for a screen reader", async () => {
    const wrapper = await mountPersonWorkTab();
    await waitForDrawings(1);
    await wrapper.get("#statistics-person-metric-lines").setValue(true);
    await waitForDrawings(2);
    const chart = wrapper.get('[role="img"]');
    expect(chart.attributes("aria-label")).toBe("Bar chart of the lines added and of the lines deleted by the commits of one person, in slots of 1 day");
    expect(plotly.react.mock.calls[1][2].yaxis.title.text).toBe("Number of lines");
  });

  it("shows the lines added and the lines deleted of the day in the chart information card, with no total", async () => {
    const wrapper = await mountPersonWorkTab();
    await waitForDrawings(1);
    await wrapper.get("#statistics-person-metric-lines").setValue(true);
    await waitForDrawings(2);
    await hoverDay(6);
    const card = cardOf(wrapper);
    expect(card?.title).not.toBe("");
    expect(card?.total).toBeNull();
    expect(card?.rows).toEqual([
      ["Lines added", "8"],
      ["Lines deleted", "4"],
    ]);
    expect(wrapper.findAll('[role="tooltip"] [data-field="row"] span[aria-hidden="true"]').map((dot) => dot.attributes("style"))).toEqual([
      expect.stringContaining("var(--success-bg)"),
      expect.stringContaining("var(--danger-bg)"),
    ]);
  });

  it("leaves a color out of the chart information card of a day where it has no lines, and shows nothing for a day with no commit", async () => {
    const wrapper = await mountPersonWorkTab();
    await waitForDrawings(1);
    await wrapper.get("#statistics-person-metric-lines").setValue(true);
    await waitForDrawings(2);
    await wrapper.get("#statistics-person").setValue("eric");
    await waitForDrawings(3);
    await hoverDay(6);
    expect(cardOf(wrapper)?.rows).toEqual([["Lines added", "7"]]);
    await hoverDay(0);
    expect(cardOf(wrapper)?.rows).toEqual([]);
  });

  it("writes a number of lines with the separator of the language of the interface", async () => {
    const wrapper = await mountPersonWorkTab({
      ...sampleItems(),
      commits: [{ authorName: "Eric", authorEmail: "eric@example.com", committedAt: daysAgo(0), insertions: 12345, deletions: 1000 }],
      pullRequests: [],
      issues: [],
    });
    await waitForDrawings(1);
    await wrapper.get("#statistics-person-metric-lines").setValue(true);
    await waitForDrawings(2);
    await hoverDay(6);
    expect(cardOf(wrapper)?.rows).toEqual([
      ["Lines added", (12345).toLocaleString("en")],
      ["Lines deleted", (1000).toLocaleString("en")],
    ]);
  });

  it("does not read again, and keeps the totals, the person, and the time range, when the metric changes", async () => {
    const wrapper = await mountPersonWorkTab();
    await waitForDrawings(1);
    await wrapper.get("#statistics-person").setValue("eric");
    await wrapper.get("#statistics-person-period-thirty_days").setValue(true);
    await wrapper.get("#statistics-person-metric-lines").setValue(true);
    await flushPromises();
    expect((wrapper.get("#statistics-person").element as HTMLSelectElement).value).toBe("eric");
    expect(radioGroup(wrapper, "statistics-person-period").checked).toEqual([false, false, false, true]);
    expect(totalsOf(wrapper)).toEqual(["1", "0", "1", "7", "0"]);
    expect(lastDrawing().layout.title.text).toBe("Eric: lines added and lines deleted, in slots of 1 day");
    expect(lastDrawing().traces[0].x).toHaveLength(30);
    expect(personWorkCalls()).toHaveLength(1);
  });

  it("draws the lines of each slot of 6 hours, and keeps the metric when the slot length changes", async () => {
    const wrapper = await mountPersonWorkTab();
    await waitForDrawings(1);
    await wrapper.get("#statistics-person-metric-lines").setValue(true);
    await waitForDrawings(2);
    await wrapper.get("#statistics-person-slot-6").setValue(true);
    await waitForDrawings(3);
    const { traces, layout } = lastDrawing();
    expect(layout.title.text).toBe("Jerome Etienne: lines added and lines deleted, in slots of 6 hours");
    expect(layout.xaxis.title.text).toBe("Start of the slot");
    expect(traces.map((trace) => trace.name)).toEqual(["Lines added", "Lines deleted"]);
    expect(traces[0].x).toHaveLength(28);
    expect(traces[0].y.reduce((sum, value) => sum + value, 0)).toBe(18);
    expect(traces[1].y.reduce((sum, value) => sum + value, 0)).toBe(6);
    expect(radioGroup(wrapper, "statistics-person-metric").checked).toEqual([false, true]);
    expect(personWorkCalls()).toHaveLength(1);
  });

  it("draws the commits and the pull requests again when the commits and the pull requests are chosen again", async () => {
    const wrapper = await mountPersonWorkTab();
    await waitForDrawings(1);
    await wrapper.get("#statistics-person-metric-lines").setValue(true);
    await waitForDrawings(2);
    await wrapper.get("#statistics-person-metric-commits_and_pull_requests").setValue(true);
    await waitForDrawings(3);
    expect(lastDrawing().traces.map((trace) => trace.name)).toEqual(["Commits", "Pull requests"]);
    expect(personWorkCalls()).toHaveLength(1);
  });

  it("keeps the metric when the source changes to the AI cost and back, and does not change the AI cost", async () => {
    const wrapper = await mountPersonWorkTab();
    await wrapper.get("#statistics-person-metric-lines").setValue(true);
    await chooseAiCost(wrapper);
    await vi.waitFor(() => expect(lastDrawing().traces[0].name).toBe("Claude Code"));
    await wrapper.get("#statistics-person-source-git_history").setValue(true);
    expect(radioGroup(wrapper, "statistics-person-metric").checked).toEqual([false, true]);
    await vi.waitFor(() => expect(lastDrawing().traces[0].name).toBe("Lines added"));
  });

  it("shows a legend above the bars, and turns off the tooltip of Plotly.js", async () => {
    await mountPersonWorkTab();
    await waitForDrawings(1);
    const { layout } = lastDrawing();
    expect(layout.legend).toMatchObject({ orientation: "h", y: 1.1 });
    expect(Object.keys(plotlyHandlers).sort()).toEqual(["plotly_hover", "plotly_legendclick", "plotly_unhover"]);
  });

  it("shows no chart information card until the pointer is over a bar", async () => {
    const wrapper = await mountPersonWorkTab();
    await waitForDrawings(1);
    expect(cardOf(wrapper)).toBeNull();
  });

  it("shows the day, and the commits and the pull requests of the day, in the chart information card, with no total", async () => {
    const wrapper = await mountPersonWorkTab();
    await waitForDrawings(1);
    await hoverDay(6);
    const card = cardOf(wrapper);
    expect(card?.title).not.toBe("");
    expect(card?.total).toBeNull();
    expect(card?.rows).toEqual([
      ["Commits", "2"],
      ["Pull requests", "1"],
    ]);
    expect(wrapper.findAll('[role="tooltip"] [data-field="row"] span[aria-hidden="true"]').map((dot) => dot.attributes("style"))).toEqual([
      expect.stringContaining("var(--primary-bg)"),
      expect.stringContaining("var(--success-bg)"),
    ]);
  });

  it("leaves a color out of the chart information card of a day where it has no value, and hides the card when the pointer leaves", async () => {
    const wrapper = await mountPersonWorkTab();
    await waitForDrawings(1);
    await hoverDay(3);
    expect(cardOf(wrapper)?.rows).toEqual([["Commits", "1"]]);
    plotlyHandlers.plotly_unhover({});
    await flushPromises();
    expect(cardOf(wrapper)).toBeNull();
  });

  it("shows only the commits when Commits is clicked in the legend, only the pull requests when Pull requests is clicked, and every color when the same name is clicked twice", async () => {
    await mountPersonWorkTab();
    await waitForDrawings(1);
    const visibleAfterClick = async (curveNumber: number, drawingCount: number) => {
      expect(plotlyHandlers.plotly_legendclick({ curveNumber })).toBe(false);
      await waitForDrawings(drawingCount);
      return lastDrawing().traces.map((trace) => trace.visible);
    };
    expect(lastDrawing().traces.map((trace) => trace.visible)).toEqual([true, true]);
    expect(await visibleAfterClick(0, 2)).toEqual([true, "legendonly"]);
    expect(await visibleAfterClick(1, 3)).toEqual(["legendonly", true]);
    expect(await visibleAfterClick(1, 4)).toEqual([true, true]);
  });

  it("shows only the row of the color that the legend kept in the chart information card", async () => {
    const wrapper = await mountPersonWorkTab();
    await waitForDrawings(1);
    plotlyHandlers.plotly_legendclick({ curveNumber: 0 });
    await waitForDrawings(2);
    await hoverDay(6);
    expect(cardOf(wrapper)?.rows).toEqual([["Commits", "2"]]);
    plotlyHandlers.plotly_legendclick({ curveNumber: 1 });
    await waitForDrawings(3);
    await hoverDay(6);
    expect(cardOf(wrapper)?.rows).toEqual([["Pull requests", "1"]]);
  });

  it("keeps the filter of the legend when the time range changes, and shows the filter of each metric on its own", async () => {
    const wrapper = await mountPersonWorkTab();
    await waitForDrawings(1);
    plotlyHandlers.plotly_legendclick({ curveNumber: 0 });
    await waitForDrawings(2);
    await wrapper.get("#statistics-person-period-thirty_days").setValue(true);
    await waitForDrawings(3);
    expect(lastDrawing().traces.map((trace) => trace.visible)).toEqual([true, "legendonly"]);
    await wrapper.get("#statistics-person-metric-lines").setValue(true);
    await vi.waitFor(() => expect(lastDrawing().traces[0].name).toBe("Lines added"));
    expect(lastDrawing().traces.map((trace) => trace.visible)).toEqual([true, true]);
    await wrapper.get("#statistics-person-metric-commits_and_pull_requests").setValue(true);
    await vi.waitFor(() => expect(lastDrawing().traces[0].name).toBe("Commits"));
    expect(lastDrawing().traces.map((trace) => trace.visible)).toEqual([true, "legendonly"]);
  });

  describe("the memory of the filter of the legend", () => {
    /** Puts what a previous run of Heidrun Code saved for the legend filters into the settings, before the tab is built. */
    async function rememberFilters(filters: Record<string, string>): Promise<void> {
      const { settings } = await import("../stores/settings");
      settings.statisticsLegendFilters = filters;
    }

    /** The legend filters that the settings hold now. */
    async function rememberedFilters(): Promise<Record<string, string>> {
      const { settings } = await import("../stores/settings");
      return { ...settings.statisticsLegendFilters };
    }

    it("saves the color of the click in the settings, and removes it with a second click on the same name", async () => {
      await mountPersonWorkTab();
      await waitForDrawings(1);
      expect(await rememberedFilters()).toEqual({});
      plotlyHandlers.plotly_legendclick({ curveNumber: 1 });
      await waitForDrawings(2);
      expect(await rememberedFilters()).toEqual({ git_history_commits_and_pull_requests: "pull_requests" });
      await vi.waitFor(() => expect(localStorage.getItem("heidrun.settings")).toContain('"pull_requests"'));
      plotlyHandlers.plotly_legendclick({ curveNumber: 1 });
      await waitForDrawings(3);
      expect(await rememberedFilters()).toEqual({});
    });

    it("draws the chart of the commits and of the pull requests with the saved filter", async () => {
      await rememberFilters({ git_history_commits_and_pull_requests: "pull_requests" });
      await mountPersonWorkTab();
      await waitForDrawings(1);
      expect(lastDrawing().traces.map((trace) => trace.visible)).toEqual(["legendonly", true]);
    });

    it("draws the chart of the lines with its own saved filter, and the other chart with no filter", async () => {
      const wrapper = await mountPersonWorkTab();
      await waitForDrawings(1);
      await rememberFilters({ git_history_lines: "lines_deleted" });
      expect(lastDrawing().traces.map((trace) => trace.visible)).toEqual([true, true]);
      await wrapper.get("#statistics-person-metric-lines").setValue(true);
      await vi.waitFor(() => expect(lastDrawing().traces[0].name).toBe("Lines added"));
      expect(lastDrawing().traces.map((trace) => trace.visible)).toEqual(["legendonly", true]);
    });

    it("draws the chart of the AI cost with the saved filter, in dollars and in tokens", async () => {
      await rememberFilters({ ai_cost: "codex" });
      const wrapper = await mountPersonWorkTab();
      await chooseAiCost(wrapper);
      await vi.waitFor(() => expect(lastDrawing().traces[0].name).toBe("Claude Code"));
      expect(lastDrawing().traces.map((trace) => trace.visible)).toEqual(["legendonly", true]);
      const drawingCount = plotly.react.mock.calls.length;
      await wrapper.get("#statistics-person-unit-tokens").setValue(true);
      await waitForDrawings(drawingCount + 1);
      expect(lastDrawing().traces.map((trace) => trace.visible)).toEqual(["legendonly", true]);
    });

    it("shows every color when the saved color is not in the chart, and keeps the saved color", async () => {
      await rememberFilters({ git_history_commits_and_pull_requests: "no_such_color" });
      await mountPersonWorkTab();
      await waitForDrawings(1);
      expect(lastDrawing().traces.map((trace) => trace.visible)).toEqual([true, true]);
      expect(await rememberedFilters()).toEqual({ git_history_commits_and_pull_requests: "no_such_color" });
    });

    it("keeps the saved filter when the language changes the names of the colors", async () => {
      await rememberFilters({ git_history_lines: "lines_added" });
      const wrapper = await mountPersonWorkTab();
      await wrapper.get("#statistics-person-metric-lines").setValue(true);
      await vi.waitFor(() => expect(lastDrawing().traces[0].name).toBe("Lines added"));
      expect(lastDrawing().traces.map((trace) => trace.visible)).toEqual([true, "legendonly"]);
      const { settings } = await import("../stores/settings");
      settings.language = "fr";
      await vi.waitFor(() => expect(lastDrawing().traces[0].name).toBe("Lignes ajoutées"));
      expect(lastDrawing().traces.map((trace) => trace.visible)).toEqual([true, "legendonly"]);
    });
  });

  it("draws thirty bars and counts the older issues when Last 30 days is chosen", async () => {
    const wrapper = await mountPersonWorkTab();
    await waitForDrawings(1);
    await wrapper.get("#statistics-person-period-thirty_days").setValue(true);
    await waitForDrawings(2);
    expect(lastDrawing().traces[0].x).toHaveLength(30);
    expect(totalsOf(wrapper)).toEqual(["3", "1", "2", "18", "6"]);
    expect(personWorkCalls()).toHaveLength(1);
  });

  it("draws the work of another person when the person changes, without reading again", async () => {
    const wrapper = await mountPersonWorkTab();
    await waitForDrawings(1);
    await wrapper.get("#statistics-person").setValue("eric");
    await waitForDrawings(2);
    expect(lastDrawing().layout.title.text).toBe("Eric: commits and pull requests, in slots of 1 day");
    expect(lastDrawing().traces[0].y).toEqual([0, 0, 0, 0, 0, 0, 1]);
    expect(totalsOf(wrapper)).toEqual(["1", "0", "1", "7", "0"]);
    expect(personWorkCalls()).toHaveLength(1);
  });

  it("tells that GitHub cannot be read, and still draws the commits", async () => {
    const wrapper = await mountPersonWorkTab({ ...sampleItems(), codeHostingError: "no network" });
    await waitForDrawings(1);
    const alert = wrapper.get(".alert.theme-warning");
    expect(alert.text()).toContain("GitHub cannot be read");
    expect(alert.text()).toContain("no network");
    expect(totalsOf(wrapper)[0]).toBe("3");
  });

  it("shows an error message when the work cannot be read", async () => {
    const wrapper = await mountPersonWorkTab(new Error("git failed"));
    expect(wrapper.get(".alert.theme-danger").text()).toContain("git failed");
    expect(plotly.react).not.toHaveBeenCalled();
  });

  it("tells that no workspace is open, and reads nothing", async () => {
    await openWorkspacesAre([]);
    const wrapper = await mountPersonWorkTab();
    expect(wrapper.text()).toContain("No workspace is open");
    expect(wrapper.find("#statistics-person-workspace").exists()).toBe(false);
    expect(personWorkCalls()).toHaveLength(0);
  });

  it("tells that there is no work when the repository has no item in the time range", async () => {
    const wrapper = await mountPersonWorkTab({ ...sampleItems(), commits: [], pullRequests: [], issues: [] });
    expect(wrapper.text()).toContain("No commit, no pull request, and no issue");
    expect(wrapper.find("#statistics-person").exists()).toBe(false);
    expect(plotly.react).not.toHaveBeenCalled();
  });

  it("does not touch the chats or the stored token usage before the source AI cost is chosen", async () => {
    await mountPersonWorkTab();
    expect(aiCostCalls()).toHaveLength(0);
    expect(synchronizeCalls()).toHaveLength(0);
  });

  it("updates the stored token usage, without any import, then reads it for the last 30 days, each time that the source AI cost is chosen", async () => {
    const wrapper = await mountPersonWorkTab();
    await chooseAiCost(wrapper);
    expect(synchronizeCalls()).toHaveLength(1);
    expect(synchronizeCalls()[0][1]).toEqual({ folders: ["/work/heidrun"], isImportAllowed: false });
    expect(aiCostCalls()).toHaveLength(1);
    const parameters = aiCostCalls()[0][1] as { folders: string[]; since: string; until: string; timeZone: string };
    expect(parameters.folders).toEqual(["/work/heidrun"]);
    expect(parameters.timeZone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
    const days = (Date.parse(parameters.until) - Date.parse(parameters.since)) / 86_400_000;
    expect(days).toBeGreaterThanOrEqual(29.9);
    expect(days).toBeLessThanOrEqual(30.1);
    await wrapper.get("#statistics-person-source-git_history").setValue(true);
    await chooseAiCost(wrapper);
    expect(synchronizeCalls()).toHaveLength(2);
    expect(aiCostCalls()).toHaveLength(2);
  });

  it("shows the cost of each coding agent and the total in the time range", async () => {
    const wrapper = await mountPersonWorkTab();
    await chooseAiCost(wrapper);
    expect(aiCostTotalsOf(wrapper)).toEqual(["$4.00", "$0.50", "$4.50"]);
    expect(wrapper.get('[data-total="claude"]').text()).toContain("Claude Code");
    expect(wrapper.get('[data-total="codex"]').text()).toContain("Codex");
    expect(wrapper.get('[data-total="total"]').text()).toContain("Total");
  });

  it("shows the average cost per day under each total of the AI cost, for 7 days and for 30 days", async () => {
    const wrapper = await mountPersonWorkTab();
    await chooseAiCost(wrapper);
    expect(aiCostPerDayOf(wrapper)).toEqual(["$0.57 per day", "$0.07 per day", "$0.64 per day"]);
    await wrapper.get("#statistics-person-period-thirty_days").setValue(true);
    expect(aiCostPerDayOf(wrapper)).toEqual(["$0.23 per day", "$0.02 per day", "$0.25 per day"]);
  });

  it("draws one stacked bar for each day, with one color for each coding agent, in dollars", async () => {
    const wrapper = await mountPersonWorkTab();
    await chooseAiCost(wrapper);
    await vi.waitFor(() => expect(lastDrawing().traces[0].name).toBe("Claude Code"));
    const { traces, layout } = lastDrawing();
    expect(layout.barmode).toBe("stack");
    expect(layout.title.text).toBe("AI cost in slots of 1 day, for each coding agent");
    expect(layout.yaxis.tickprefix).toBe("$");
    expect(layout.yaxis.dtick).toBeUndefined();
    expect(traces.map((trace) => trace.name)).toEqual(["Claude Code", "Codex"]);
    expect(traces[0].x).toHaveLength(7);
    expect(traces[0].y).toEqual([0, 0, 0, 0, 0, 2.5, 1.5]);
    expect(traces[1].y).toEqual([0, 0, 0, 0, 0.5, 0, 0]);
    expect(traces[0].marker.color).not.toBe(traces[1].marker.color);
    expect(traces.every((trace) => trace.hoverinfo === "none")).toBe(true);
    expect(lastDrawing().layout.legend).toMatchObject({ orientation: "h", y: 1.1 });
  });

  it("shows the day, the total, and the cost of each coding agent that has a cost, in the chart information card", async () => {
    const wrapper = await mountPersonWorkTab();
    await chooseAiCost(wrapper);
    await vi.waitFor(() => expect(lastDrawing().traces[0].name).toBe("Claude Code"));
    await hoverDay(5);
    expect(cardOf(wrapper)?.total).toBe("$2.50");
    expect(cardOf(wrapper)?.rows).toEqual([["Claude Code", "$2.50"]]);
    await hoverDay(4);
    expect(cardOf(wrapper)?.total).toBe("$0.50");
    expect(cardOf(wrapper)?.rows).toEqual([["Codex", "$0.50"]]);
    await hoverDay(0);
    expect(cardOf(wrapper)?.total).toBe("$0.00");
    expect(cardOf(wrapper)?.rows).toEqual([]);
  });

  it("shows only one coding agent, with no total in the chart information card, when its name is clicked in the legend", async () => {
    const wrapper = await mountPersonWorkTab();
    await chooseAiCost(wrapper);
    await vi.waitFor(() => expect(lastDrawing().traces[0].name).toBe("Claude Code"));
    const drawingCount = plotly.react.mock.calls.length;
    plotlyHandlers.plotly_legendclick({ curveNumber: 1 });
    await waitForDrawings(drawingCount + 1);
    expect(lastDrawing().traces.map((trace) => trace.visible)).toEqual(["legendonly", true]);
    await hoverDay(4);
    expect(cardOf(wrapper)?.total).toBeNull();
    expect(cardOf(wrapper)?.rows).toEqual([["Codex", "$0.50"]]);
    plotlyHandlers.plotly_legendclick({ curveNumber: 0 });
    await waitForDrawings(drawingCount + 2);
    expect(lastDrawing().traces.map((trace) => trace.visible)).toEqual([true, "legendonly"]);
    await hoverDay(5);
    expect(cardOf(wrapper)?.total).toBeNull();
    expect(cardOf(wrapper)?.rows).toEqual([["Claude Code", "$2.50"]]);
    plotlyHandlers.plotly_legendclick({ curveNumber: 0 });
    await waitForDrawings(drawingCount + 3);
    await hoverDay(5);
    expect(cardOf(wrapper)?.total).toBe("$2.50");
  });

  it("draws thirty bars and counts the older chats when Last 30 days is chosen with the source AI cost", async () => {
    const wrapper = await mountPersonWorkTab();
    await chooseAiCost(wrapper);
    await vi.waitFor(() => expect(lastDrawing().traces[0].name).toBe("Claude Code"));
    await wrapper.get("#statistics-person-period-thirty_days").setValue(true);
    await vi.waitFor(() => expect(lastDrawing().traces[0].x).toHaveLength(30));
    expect(aiCostTotalsOf(wrapper)).toEqual(["$7.00", "$0.50", "$7.50"]);
    expect(aiCostCalls()).toHaveLength(1);
  });

  it("keeps the time range when the source changes, and hides the person chooser for the source AI cost", async () => {
    const wrapper = await mountPersonWorkTab();
    await wrapper.get("#statistics-person-period-thirty_days").setValue(true);
    await chooseAiCost(wrapper);
    expect(radioGroup(wrapper, "statistics-person-period").checked).toEqual([false, false, false, true]);
    expect(wrapper.find("#statistics-person").exists()).toBe(false);
    await wrapper.get("#statistics-person-source-git_history").setValue(true);
    expect(wrapper.find("#statistics-person").exists()).toBe(true);
    expect(totalsOf(wrapper)).toEqual(["3", "1", "2", "18", "6"]);
  });

  it("tells how many tokens have no known price, and that the cost does not count them", async () => {
    const wrapper = await mountPersonWorkTab();
    await chooseAiCost(wrapper);
    expect(wrapper.get('[data-note="partial-cost"]').text()).toBe(
      "The cost is not complete: the tokens of models with no known price (20.00 KT) are not counted in it.",
    );
  });

  it("does not tell about a cost that is not complete when every token has a price", async () => {
    const wrapper = await mountPersonWorkTab(sampleItems(), aiCostAnswer([hourRow(0, "claude", 1, 100)]));
    await chooseAiCost(wrapper);
    expect(wrapper.find('[data-note="partial-cost"]').exists()).toBe(false);
  });

  it("tells that no coding agent used tokens, and draws no chart, when the time range has no token", async () => {
    const wrapper = await mountPersonWorkTab(sampleItems(), aiCostAnswer([]));
    await chooseAiCost(wrapper);
    expect(wrapper.text()).toContain("No coding agent used tokens in the last 30 days.");
    expect(aiCostTotalsOf(wrapper)).toEqual(["$0.00", "$0.00", "$0.00"]);
    expect(plotly.react).toHaveBeenCalledTimes(1);
  });

  it("tells that the token usage is read while the read lasts", async () => {
    const wrapper = await mountPersonWorkTab(sampleItems(), new Promise<never>(() => {}));
    await chooseAiCost(wrapper);
    expect(wrapper.text()).toContain("Reading the stored token usage of the coding agents…");
    expect(wrapper.find('[data-total="claude"]').exists()).toBe(false);
    const message = wrapper.get('[role="status"]');
    expect(message.element.firstElementChild?.classList.contains("spinner-border")).toBe(true);
    expect(message.get(".spinner-border").attributes("aria-hidden")).toBe("true");
  });

  it("shows a big busy wheel and the six stages, all waiting, while the commits, the pull requests, and the issues are read", async () => {
    const wrapper = await mountPersonWorkTab(new Promise<never>(() => {}));
    const message = wrapper.get('[data-note="update-stages"]');
    expect(message.attributes("role")).toBe("status");
    expect(message.element.firstElementChild?.classList.contains("spinner-border")).toBe(true);
    expect(message.element.firstElementChild?.classList.contains("update-stages-spinner")).toBe(true);
    expect(message.get(".spinner-border").attributes("aria-hidden")).toBe("true");
    expect(message.text()).toContain("Reading the commits, the pull requests, and the issues…");
    expect(stagesOf(wrapper)).toEqual([
      ["Reading the commits of heidrun", "waiting"],
      ["Writing the commits of heidrun in the SQLite file", "waiting"],
      ["Reading the issues of heidrun", "waiting"],
      ["Writing the issues of heidrun in the SQLite file", "waiting"],
      ["Reading the pull requests of heidrun", "waiting"],
      ["Writing the pull requests of heidrun in the SQLite file", "waiting"],
    ]);
  });

  it("shows the done stages with a check mark, the stage in progress with its progress, and its text under the busy wheel", async () => {
    const wrapper = await mountPersonWorkTab(new Promise<never>(() => {}));
    const send = progressChannel();
    send("readCommits", 0, 1200);
    send("readCommits", 1200, 1200, true);
    send("writeCommits", 1200, 1200, true);
    send("readIssues", 100, 400);
    await flushPromises();
    expect(stagesOf(wrapper)).toEqual([
      ["Reading the commits of heidrun_code", "done"],
      ["Writing the commits of heidrun_code in the SQLite file", "done"],
      ["Reading the issues of heidrun_code", "working"],
      ["Writing the issues of heidrun_code in the SQLite file", "waiting"],
      ["Reading the pull requests of heidrun_code", "waiting"],
      ["Writing the pull requests of heidrun_code in the SQLite file", "waiting"],
    ]);
    expect(wrapper.findAll('[data-state="done"] .bi-check-circle-fill')).toHaveLength(2);
    const working = wrapper.get('[data-stage="readIssues"]');
    expect(working.get('[data-note="count"]').text()).toBe("100 of 400");
    expect(working.get('[data-note="percent"]').text()).toBe("25 %");
    expect(working.get(".progress").attributes("aria-valuenow")).toBe("25");
    expect(working.get(".progress-bar").attributes("style")).toContain("width: 25%");
    expect(wrapper.get('[data-note="current-stage"]').text()).toBe("Reading the issues of heidrun_code");
  });

  it("shows a stage in progress with no percent and no progress bar when its total is not known", async () => {
    const wrapper = await mountPersonWorkTab(new Promise<never>(() => {}));
    const send = progressChannel();
    send("readIssues", 100, null);
    await flushPromises();
    const working = wrapper.get('[data-stage="readIssues"]');
    expect(working.attributes("data-state")).toBe("working");
    expect(working.get('[data-note="count"]').text()).toBe("100 read");
    expect(working.find('[data-note="percent"]').exists()).toBe(false);
    expect(working.find(".progress").exists()).toBe(false);
  });

  it("shows an error message when the chats cannot be read, and the Git history stays available", async () => {
    const wrapper = await mountPersonWorkTab(sampleItems(), new Error("scan failed"));
    await chooseAiCost(wrapper);
    expect(wrapper.get(".alert.theme-danger").text()).toContain("scan failed");
    await wrapper.get("#statistics-person-source-git_history").setValue(true);
    expect(wrapper.find(".alert.theme-danger").exists()).toBe(false);
    expect(totalsOf(wrapper)).toEqual(["3", "1", "1", "18", "6"]);
  });

  it("has a button with a checkbox for each open workspace, and only the selected workspace is chosen at first", async () => {
    await openWorkspacesAre(WORKSPACES, "workspace-mobile");
    const wrapper = await mountPersonWorkTab();
    const boxes = wrapper.findAll('input[id^="statistics-person-workspace-workspace-"]');
    expect(boxes.map((box) => box.element.closest("label")?.textContent?.trim())).toEqual(["heidrun", "mobile"]);
    expect(boxes.every((box) => box.attributes("type") === "checkbox")).toBe(true);
    expect(boxes.every((box) => box.element.closest("label")?.className.includes("btn-check btn-outline theme-secondary"))).toBe(true);
    expect(chosenWorkspaceNames(wrapper)).toEqual(["mobile"]);
    expect(wrapper.find('[role="group"][aria-label="Workspaces"]').exists()).toBe(true);
    expect(personWorkCalls()).toHaveLength(1);
    expect((personWorkCalls()[0][1] as { folder: string }).folder).toBe("/work/mobile");
  });

  it("chooses the first open workspace at first when the selected workspace is not in the list", async () => {
    await openWorkspacesAre(WORKSPACES, null);
    const wrapper = await mountPersonWorkTab();
    expect(chosenWorkspaceNames(wrapper)).toEqual(["heidrun"]);
    expect((personWorkCalls()[0][1] as { folder: string }).folder).toBe("/work/heidrun");
  });

  it("shows the workspace buttons for the source AI cost too", async () => {
    const wrapper = await mountPersonWorkTab();
    await chooseAiCost(wrapper);
    expect(wrapper.find("#statistics-person-workspace-workspace-mobile").exists()).toBe(true);
  });

  it("reads the commits, the pull requests, and the issues of another workspace when only that workspace is chosen", async () => {
    const wrapper = await mountPersonWorkTab();
    answerByFolder({ "/work/mobile": { gitHistory: mobileItems(), aiCost: mobileAiCostAnswer() } });
    await chooseWorkspace(wrapper, "workspace-mobile", true);
    await chooseWorkspace(wrapper, "workspace-heidrun", false);
    expect(chosenWorkspaceNames(wrapper)).toEqual(["mobile"]);
    expect(personWorkCalls()).toHaveLength(2);
    expect((personWorkCalls()[1][1] as { folder: string }).folder).toBe("/work/mobile");
    expect(totalsOf(wrapper)).toEqual(["1", "1", "0", "40", "4"]);
  });

  it("adds up the work of every chosen workspace, and reads only the workspace that is new", async () => {
    const wrapper = await mountPersonWorkTab();
    answerByFolder({ "/work/mobile": { gitHistory: mobileItems(), aiCost: mobileAiCostAnswer() } });
    await chooseWorkspace(wrapper, "workspace-mobile", true);
    expect(chosenWorkspaceNames(wrapper)).toEqual(["heidrun", "mobile"]);
    expect(personWorkCalls()).toHaveLength(2);
    expect(totalsOf(wrapper)).toEqual(["4", "2", "1", "58", "10"]);
    expect(wrapper.get("#statistics-person").findAll("option").map((option) => option.text())).toEqual(["Jerome Etienne", "Eric"]);
  });

  it("counts a repository once when two chosen workspaces read the same repository", async () => {
    const wrapper = await mountPersonWorkTab();
    answerByFolder({ "/work/mobile": { gitHistory: sampleItems(), aiCost: sampleAiCostAnswer() } });
    await chooseWorkspace(wrapper, "workspace-mobile", true);
    expect(totalsOf(wrapper)).toEqual(["3", "1", "1", "18", "6"]);
  });

  it("has one radio button group with the buttons All and None, that choose every workspace or no workspace", async () => {
    const wrapper = await mountPersonWorkTab();
    answerByFolder({ "/work/mobile": { gitHistory: mobileItems(), aiCost: mobileAiCostAnswer() } });
    const all = wrapper.get("#statistics-person-workspace-all");
    const none = wrapper.get("#statistics-person-workspace-none");
    const isChecked = (input: typeof all): boolean => (input.element as HTMLInputElement).checked;
    expect(all.attributes("type")).toBe("radio");
    expect(none.attributes("type")).toBe("radio");
    expect(none.attributes("name")).toBe(all.attributes("name"));
    expect(all.element.closest('[role="group"]')).toBe(none.element.closest('[role="group"]'));
    expect(all.element.closest("label")?.textContent?.trim()).toBe("All");
    expect(none.element.closest("label")?.textContent?.trim()).toBe("None");
    expect([isChecked(all), isChecked(none)]).toEqual([false, false]);
    await all.setValue(true);
    await flushPromises();
    expect(chosenWorkspaceNames(wrapper)).toEqual(["heidrun", "mobile"]);
    expect([isChecked(all), isChecked(none)]).toEqual([true, false]);
    await none.setValue(true);
    await flushPromises();
    expect(chosenWorkspaceNames(wrapper)).toEqual([]);
    expect([isChecked(all), isChecked(none)]).toEqual([false, true]);
    await chooseWorkspace(wrapper, "workspace-mobile", true);
    expect([isChecked(all), isChecked(none)]).toEqual([false, false]);
  });

  it("puts the workspaces in a second button group, after the buttons All and None", async () => {
    const wrapper = await mountPersonWorkTab();
    const group = wrapper.get('[role="group"][aria-label="Workspaces"]');
    expect(group.findAll("label").map((label) => label.text())).toEqual(["heidrun", "mobile"]);
    expect(group.find("#statistics-person-workspace-all").exists()).toBe(false);
    expect(group.find("#statistics-person-workspace-none").exists()).toBe(false);
  });

  it("tells that no workspace is chosen, and shows no total and no chart, when every workspace is dropped", async () => {
    const wrapper = await mountPersonWorkTab();
    await waitForDrawings(1);
    await chooseWorkspace(wrapper, "workspace-heidrun", false);
    expect(wrapper.text()).toContain("No workspace is chosen. Choose a workspace to see its work.");
    expect(wrapper.find('[data-total="commits"]').exists()).toBe(false);
    expect(wrapper.find("#statistics-person").exists()).toBe(false);
    await chooseAiCost(wrapper);
    expect(wrapper.text()).toContain("No workspace is chosen");
    expect(aiCostCalls()).toHaveLength(0);
  });

  it("keeps what a workspace gave when the workspace is dropped, and does not read it again when it comes back", async () => {
    const wrapper = await mountPersonWorkTab();
    answerByFolder({ "/work/mobile": { gitHistory: mobileItems(), aiCost: mobileAiCostAnswer() } });
    await chooseWorkspace(wrapper, "workspace-mobile", true);
    await chooseWorkspace(wrapper, "workspace-mobile", false);
    expect(totalsOf(wrapper)).toEqual(["3", "1", "1", "18", "6"]);
    await chooseWorkspace(wrapper, "workspace-mobile", true);
    expect(totalsOf(wrapper)).toEqual(["4", "2", "1", "58", "10"]);
    expect(personWorkCalls()).toHaveLength(2);
  });

  it("shows the reading in progress, and not the work, while a chosen workspace is read", async () => {
    const wrapper = await mountPersonWorkTab();
    invoke.mockImplementation(async () => new Promise<never>(() => {}));
    await chooseWorkspace(wrapper, "workspace-mobile", true);
    expect(wrapper.text()).toContain("Reading the commits, the pull requests, and the issues…");
    expect(wrapper.find('[data-total="commits"]').exists()).toBe(false);
  });

  it("shows the error of a workspace, and still shows the work of the workspaces that were read", async () => {
    const wrapper = await mountPersonWorkTab();
    answerByFolder({ "/work/mobile": { gitHistory: new Error("not a repository"), aiCost: mobileAiCostAnswer() } });
    await chooseWorkspace(wrapper, "workspace-mobile", true);
    expect(wrapper.get(".alert.theme-danger").text()).toContain("not a repository");
    expect(totalsOf(wrapper)).toEqual(["3", "1", "1", "18", "6"]);
    await chooseWorkspace(wrapper, "workspace-heidrun", false);
    expect(wrapper.get(".alert.theme-danger").text()).toContain("not a repository");
    expect(wrapper.find('[data-total="commits"]').exists()).toBe(false);
  });

  it("reads the token usage of every chosen workspace in one call when a workspace is chosen with the source AI cost", async () => {
    const wrapper = await mountPersonWorkTab();
    await chooseAiCost(wrapper);
    expect(aiCostCalls()).toHaveLength(1);
    answerByFolder({ "/work/mobile": { gitHistory: mobileItems(), aiCost: mobileAiCostAnswer() } });
    await chooseWorkspace(wrapper, "workspace-mobile", true);
    expect(aiCostCalls()).toHaveLength(2);
    expect((aiCostCalls()[1][1] as { folders: string[] }).folders).toEqual(["/work/heidrun", "/work/mobile"]);
    expect(aiCostTotalsOf(wrapper)).toEqual(["$4.00", "$9.50", "$13.50"]);
    expect(personWorkCalls()).toHaveLength(1);
    await wrapper.get("#statistics-person-unit-tokens").setValue(true);
    expect(aiCostTotalsOf(wrapper)).toEqual(["40.00 KT", "115.00 KT", "155.00 KT"]);
  });

  it("asks for every chosen workspace in one call, so that the data layer counts a chat once when two workspaces list it", async () => {
    const wrapper = await mountPersonWorkTab();
    await chooseAiCost(wrapper);
    answerByFolder({ "/work/mobile": { gitHistory: sampleItems(), aiCost: sampleAiCostAnswer() } });
    await chooseWorkspace(wrapper, "workspace-mobile", true);
    expect(aiCostCalls().map((call) => (call[1] as { folders: string[] }).folders)).toEqual([
      ["/work/heidrun"],
      ["/work/heidrun", "/work/mobile"],
    ]);
  });

  it("reads the data of a workspace only for the source that is shown, and the other source the next time that it is chosen", async () => {
    const wrapper = await mountPersonWorkTab();
    answerByFolder({ "/work/mobile": { gitHistory: mobileItems(), aiCost: mobileAiCostAnswer() } });
    await chooseWorkspace(wrapper, "workspace-mobile", true);
    expect(aiCostCalls()).toHaveLength(0);
    await chooseAiCost(wrapper);
    expect(aiCostCalls().map((call) => (call[1] as { folders: string[] }).folders)).toEqual([["/work/heidrun", "/work/mobile"]]);
    await chooseWorkspace(wrapper, "workspace-mobile", false);
    expect(personWorkCalls()).toHaveLength(2);
    expect(aiCostCalls().map((call) => (call[1] as { folders: string[] }).folders)).toEqual([
      ["/work/heidrun", "/work/mobile"],
      ["/work/heidrun"],
    ]);
    await wrapper.get("#statistics-person-source-git_history").setValue(true);
    await flushPromises();
    expect(personWorkCalls()).toHaveLength(2);
    expect(aiCostCalls()).toHaveLength(2);
  });

  it("reads a folder once when two chosen workspaces have the same folder", async () => {
    await openWorkspacesAre([...WORKSPACES, { workspaceId: "workspace-copy", label: "copy", folder: "/work/heidrun" }]);
    const wrapper = await mountPersonWorkTab();
    await wrapper.get("#statistics-person-workspace-all").setValue(true);
    await flushPromises();
    expect(personWorkCalls().map((call) => (call[1] as { folder: string }).folder)).toEqual(["/work/heidrun", "/work/mobile"]);
  });

  it("keeps the source, the unit, and the time range when the workspaces change", async () => {
    const wrapper = await mountPersonWorkTab();
    await wrapper.get("#statistics-person-period-thirty_days").setValue(true);
    await chooseAiCost(wrapper);
    await wrapper.get("#statistics-person-unit-tokens").setValue(true);
    await chooseWorkspace(wrapper, "workspace-mobile", true);
    expect(radioGroup(wrapper, "statistics-person-period").checked).toEqual([false, false, false, true]);
    expect(radioGroup(wrapper, "statistics-person-source").checked).toEqual([false, true]);
    expect(radioGroup(wrapper, "statistics-person-unit").checked).toEqual([false, true]);
  });

  it("drops a workspace that closes, and chooses the first open workspace when no chosen workspace stays open", async () => {
    const wrapper = await mountPersonWorkTab();
    await chooseWorkspace(wrapper, "workspace-mobile", true);
    await openWorkspacesAre([WORKSPACES[1]], "workspace-mobile");
    await flushPromises();
    expect(chosenWorkspaceNames(wrapper)).toEqual(["mobile"]);
    await openWorkspacesAre([{ workspaceId: "workspace-new", label: "new", folder: "/work/new" }], "workspace-new");
    await flushPromises();
    expect(chosenWorkspaceNames(wrapper)).toEqual(["new"]);
  });

  it("does not read the AI cost again when the list of the open workspaces is made again with the same folders", async () => {
    const wrapper = await mountPersonWorkTab();
    await chooseAiCost(wrapper);
    const callCount = synchronizeCalls().length;
    const totals = aiCostTotalsOf(wrapper);
    await openWorkspacesAre(WORKSPACES.map((workspace) => ({ ...workspace })), WORKSPACES[0].workspaceId);
    await flushPromises();
    expect(synchronizeCalls()).toHaveLength(callCount);
    expect(wrapper.text()).not.toContain("Reading the stored token usage");
    expect(aiCostTotalsOf(wrapper)).toEqual(totals);
  });

  it("has a radio button group of the unit of the AI cost, with US dollars chosen at first, for the source AI cost only", async () => {
    const wrapper = await mountPersonWorkTab();
    expect(wrapper.find('input[name="statistics-person-unit"]').exists()).toBe(false);
    await chooseAiCost(wrapper);
    const group = radioGroup(wrapper, "statistics-person-unit");
    expect(group.texts).toEqual(["US dollars", "Tokens"]);
    expect(group.checked).toEqual([true, false]);
    expect(group.classes.every((name) => name.includes("btn-check") && name.includes("btn-outline") && name.includes("theme-secondary"))).toBe(true);
    await wrapper.get("#statistics-person-source-git_history").setValue(true);
    expect(wrapper.find('input[name="statistics-person-unit"]').exists()).toBe(false);
  });

  it("shows the tokens of each coding agent and the total in the time range when Tokens is chosen, with the tokens of a chat with no known price", async () => {
    const wrapper = await mountPersonWorkTab();
    await chooseAiCost(wrapper);
    await wrapper.get("#statistics-person-unit-tokens").setValue(true);
    expect(aiCostTotalsOf(wrapper)).toEqual(["40.00 KT", "25.00 KT", "65.00 KT"]);
    expect(wrapper.get('[data-total="claude"]').text()).toContain("Claude Code");
    expect(wrapper.get('[data-total="total"]').text()).toContain("Total");
    await wrapper.get("#statistics-person-period-thirty_days").setValue(true);
    expect(aiCostTotalsOf(wrapper)).toEqual(["70.00 KT", "25.00 KT", "95.00 KT"]);
  });

  it("shows the average of tokens per day under each total, rounded to a whole number of tokens", async () => {
    const wrapper = await mountPersonWorkTab();
    await chooseAiCost(wrapper);
    await wrapper.get("#statistics-person-unit-tokens").setValue(true);
    expect(aiCostPerDayOf(wrapper)).toEqual(["5.71 KT per day", "3.57 KT per day", "9.29 KT per day"]);
    await wrapper.get("#statistics-person-period-thirty_days").setValue(true);
    expect(aiCostPerDayOf(wrapper)).toEqual(["2.33 KT per day", "833 per day", "3.17 KT per day"]);
  });

  it("shows the cost in US dollars again when US dollars is chosen again", async () => {
    const wrapper = await mountPersonWorkTab();
    await chooseAiCost(wrapper);
    await wrapper.get("#statistics-person-unit-tokens").setValue(true);
    await wrapper.get("#statistics-person-unit-dollars").setValue(true);
    expect(aiCostTotalsOf(wrapper)).toEqual(["$4.00", "$0.50", "$4.50"]);
    expect(aiCostCalls()).toHaveLength(1);
  });

  it("draws the tokens of each day in the bars, with the same unit on every tick of the vertical axis", async () => {
    const wrapper = await mountPersonWorkTab();
    await chooseAiCost(wrapper);
    await vi.waitFor(() => expect(lastDrawing().traces[0].name).toBe("Claude Code"));
    await wrapper.get("#statistics-person-unit-tokens").setValue(true);
    await vi.waitFor(() => expect(lastDrawing().layout.title.text).toBe("Tokens in slots of 1 day, for each coding agent"));
    const { traces, layout } = lastDrawing();
    expect(traces.map((trace) => trace.name)).toEqual(["Claude Code", "Codex"]);
    expect(traces[0].y).toEqual([0, 0, 0, 0, 0, 25, 15]);
    expect(traces[1].y).toEqual([0, 0, 0, 0, 5, 20, 0]);
    expect(layout.yaxis.ticksuffix).toBe(" KT");
    expect(layout.yaxis.tickprefix).toBeUndefined();
    expect(wrapper.get('[role="img"]').attributes("aria-label")).toBe("Bar chart of the tokens of the chats of each coding agent, in slots of 1 day");
  });

  it("draws a number of tokens under one thousand as it is, and a number of millions with the unit MT", async () => {
    const small = aiCostAnswer([hourRow(0, "claude", 1, 800)]);
    const wrapper = await mountPersonWorkTab(sampleItems(), small);
    await chooseAiCost(wrapper);
    await wrapper.get("#statistics-person-unit-tokens").setValue(true);
    await vi.waitFor(() => expect(lastDrawing().layout.title.text).toBe("Tokens in slots of 1 day, for each coding agent"));
    expect(lastDrawing().traces[0].y).toEqual([0, 0, 0, 0, 0, 0, 800]);
    expect(lastDrawing().layout.yaxis.ticksuffix).toBe("");
    const large = aiCostAnswer([hourRow(0, "claude", 1, 3_000_000)]);
    const largeWrapper = await mountPersonWorkTab(sampleItems(), large);
    await chooseAiCost(largeWrapper);
    await largeWrapper.get("#statistics-person-unit-tokens").setValue(true);
    await vi.waitFor(() => expect(lastDrawing().layout.yaxis.ticksuffix).toBe(" MT"));
    expect(lastDrawing().traces[0].y).toEqual([0, 0, 0, 0, 0, 0, 3]);
  });

  it("shows the day, the total, and the tokens of each coding agent that has tokens, in the chart information card", async () => {
    const wrapper = await mountPersonWorkTab();
    await chooseAiCost(wrapper);
    await vi.waitFor(() => expect(lastDrawing().traces[0].name).toBe("Claude Code"));
    await wrapper.get("#statistics-person-unit-tokens").setValue(true);
    await vi.waitFor(() => expect(lastDrawing().layout.title.text).toBe("Tokens in slots of 1 day, for each coding agent"));
    await hoverDay(5);
    expect(cardOf(wrapper)?.total).toBe("45.00 KT");
    expect(cardOf(wrapper)?.rows).toEqual([
      ["Claude Code", "25.00 KT"],
      ["Codex", "20.00 KT"],
    ]);
    await hoverDay(4);
    expect(cardOf(wrapper)?.total).toBe("5.00 KT");
    expect(cardOf(wrapper)?.rows).toEqual([["Codex", "5.00 KT"]]);
    await hoverDay(0);
    expect(cardOf(wrapper)?.total).toBe("0");
    expect(cardOf(wrapper)?.rows).toEqual([]);
  });

  it("does not tell about a cost that is not complete when the unit is tokens, because the tokens with no known price are counted", async () => {
    const wrapper = await mountPersonWorkTab();
    await chooseAiCost(wrapper);
    expect(wrapper.find('[data-note="partial-cost"]').exists()).toBe(true);
    await wrapper.get("#statistics-person-unit-tokens").setValue(true);
    expect(wrapper.find('[data-note="partial-cost"]').exists()).toBe(false);
    await wrapper.get("#statistics-person-unit-dollars").setValue(true);
    expect(wrapper.find('[data-note="partial-cost"]').exists()).toBe(true);
  });

  it("shows zero tokens, and no chart, when the time range has no token and the unit is tokens", async () => {
    const wrapper = await mountPersonWorkTab(sampleItems(), aiCostAnswer([]));
    await chooseAiCost(wrapper);
    await wrapper.get("#statistics-person-unit-tokens").setValue(true);
    expect(wrapper.text()).toContain("No coding agent used tokens in the last 30 days.");
    expect(aiCostTotalsOf(wrapper)).toEqual(["0", "0", "0"]);
    expect(plotly.react).toHaveBeenCalledTimes(1);
  });

  it("shows the date of the last update of the token usage, and the version of the prices", async () => {
    const wrapper = await mountPersonWorkTab();
    await chooseAiCost(wrapper);
    const freshness = wrapper.get('[data-note="freshness"]').text();
    expect(freshness).toContain("Token usage updated on");
    expect(freshness).toContain("Prices: version 3, checked on");
  });

  it("tells that no price is stored when the answer has no version of the prices", async () => {
    const wrapper = await mountPersonWorkTab(sampleItems(), { ...aiCostAnswer([hourRow(0, "claude", null, 100)]), priceVersion: null, pricesCheckedAt: null });
    await chooseAiCost(wrapper);
    expect(wrapper.get('[data-note="freshness"]').text()).toContain("No price of the models is stored yet, so no cost is shown.");
    expect(wrapper.find('[data-note="partial-cost"]').exists()).toBe(true);
  });

  it("does not import the history of a workspace by itself: it offers the button Import the history", async () => {
    const notImported = { ...aiCostAnswer([]), workspaces: [{ ...importedWorkspace("/work/heidrun"), synchronizedAt: null }] };
    const wrapper = await mountPersonWorkTab(sampleItems(), notImported);
    await chooseAiCost(wrapper);
    expect(synchronizeCalls().map((call) => (call[1] as { isImportAllowed: boolean }).isImportAllowed)).toEqual([false]);
    const note = wrapper.get('[data-note="not-imported"]');
    expect(note.text()).toContain("The history of the chats of 1 workspace is not imported yet, so it is not in the chart.");
    expect(note.get("#statistics-person-import").text()).toBe("Import the history");
    expect(wrapper.text()).not.toContain("No coding agent used tokens");
    expect(wrapper.find("[data-total]").exists()).toBe(false);
  });

  it("imports the history when the button Import the history is pressed, tells that the import lasts, then shows the cost", async () => {
    const notImported = { ...aiCostAnswer([]), workspaces: [{ ...importedWorkspace("/work/heidrun"), synchronizedAt: null }] };
    const wrapper = await mountPersonWorkTab(sampleItems(), notImported);
    await chooseAiCost(wrapper);
    let finishImport: (value: AiCostSynchronization) => void = () => {};
    invoke.mockImplementation(async (command: string, parameters: { folders?: string[] }) => {
      if (command === "ai_cost_synchronize") {
        return new Promise<AiCostSynchronization>((resolve) => {
          finishImport = resolve;
        });
      }
      return command === "ai_cost_in_range" ? sampleAiCostAnswer() : parameters;
    });
    await wrapper.get("#statistics-person-import").trigger("click");
    await flushPromises();
    expect(synchronizeCalls().map((call) => (call[1] as { isImportAllowed: boolean }).isImportAllowed)).toEqual([false, true]);
    expect(wrapper.text()).toContain("Importing the history of the chats.");
    finishImport(synchronizationOf(["/work/heidrun"]));
    await flushPromises();
    expect(wrapper.find('[data-note="not-imported"]').exists()).toBe(false);
    expect(aiCostTotalsOf(wrapper)).toEqual(["$4.00", "$0.50", "$4.50"]);
  });

  it("counts the workspaces that are not imported, and draws the workspaces that are", async () => {
    const answer = {
      ...sampleAiCostAnswer(),
      workspaces: [importedWorkspace("/work/heidrun"), { ...importedWorkspace("/work/mobile"), synchronizedAt: null }],
    };
    const wrapper = await mountPersonWorkTab(sampleItems(), answer);
    await chooseAiCost(wrapper);
    expect(wrapper.get('[data-note="not-imported"]').text()).toContain("1 workspace is not imported yet");
    expect(aiCostTotalsOf(wrapper)).toEqual(["$4.00", "$0.50", "$4.50"]);
  });

  it("tells that the prices of the models could not be refreshed, and still shows the cost at the latest known prices", async () => {
    const wrapper = await mountPersonWorkTab();
    invoke.mockImplementation(async (command: string) => {
      if (command === "ai_cost_synchronize") {
        return { workspaces: [importedWorkspace("/work/heidrun")], priceWarning: "no network" };
      }
      return command === "ai_cost_in_range" ? sampleAiCostAnswer() : undefined;
    });
    await chooseAiCost(wrapper);
    const warning = wrapper.get('[data-note="price-warning"]');
    expect(warning.classes()).toContain("theme-warning");
    expect(warning.text()).toContain("The prices of the models could not be refreshed, so the latest known prices are used: no network");
    expect(aiCostTotalsOf(wrapper)).toEqual(["$4.00", "$0.50", "$4.50"]);
  });

  it("shows the error of a workspace whose token usage cannot be read", async () => {
    const answer = { ...sampleAiCostAnswer(), workspaces: [{ ...importedWorkspace("/work/heidrun"), synchronizedAt: null, error: "The folder has no remote origin." }] };
    const wrapper = await mountPersonWorkTab(sampleItems(), answer);
    await chooseAiCost(wrapper);
    expect(wrapper.get('[data-note="workspace-error"]').text()).toContain("The token usage of the workspace /work/heidrun cannot be read: The folder has no remote origin.");
    expect(wrapper.find('[data-note="not-imported"]').exists()).toBe(false);
    expect(wrapper.find("[data-total]").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("No coding agent used tokens");
  });

  it("drops the answer of a read that is not the last one", async () => {
    const wrapper = await mountPersonWorkTab();
    let answerFirst: (value: AiCostAnswer) => void = () => {};
    let readCount = 0;
    invoke.mockImplementation(async (command: string, parameters: { folders?: string[] }) => {
      if (command === "ai_cost_synchronize") {
        return synchronizationOf(parameters.folders ?? []);
      }
      if (command !== "ai_cost_in_range") {
        return undefined;
      }
      readCount += 1;
      if (readCount === 1) {
        return new Promise<AiCostAnswer>((resolve) => {
          answerFirst = resolve;
        });
      }
      return aiCostAnswer([hourRow(0, "codex", 7, 70_000)], "/work/mobile");
    });
    await chooseAiCost(wrapper);
    await chooseWorkspace(wrapper, "workspace-mobile", true);
    answerFirst(sampleAiCostAnswer());
    await flushPromises();
    expect(aiCostTotalsOf(wrapper)).toEqual(["$0.00", "$7.00", "$7.00"]);
  });

  describe("the slot length", () => {
    /** The slot lengths that the tab offers, with their state. */
    function slotLengths(wrapper: Awaited<ReturnType<typeof mountPersonWorkTab>>) {
      return radioGroup(wrapper, "statistics-person-slot");
    }

    /** The start of the day today, as the text that the chart information card shows for the day. */
    function todayText(): string {
      return new Date().toLocaleDateString("en", { weekday: "long", day: "numeric", month: "long" });
    }

    /** Puts the time format of the settings on 24 hours, so the times of the chart information card do not depend on the computer. */
    async function use24HourClock(): Promise<void> {
      const { settings } = await import("../stores/settings");
      settings.timeFormat = "24h";
    }

    /** The answer of the AI cost with two hours of Claude Code and one hour of Codex today: at 05:00, 07:00, and 07:00. */
    function hoursOfToday(): AiCostAnswer {
      return aiCostAnswer([
        hourRow(0, "claude", 1, 10_000, 5),
        hourRow(0, "claude", 2, 20_000, 7),
        hourRow(0, "codex", 0.5, 5_000, 7),
      ]);
    }

    it("offers 1 hour, 6 hours, and 1 day for the last 7 days and for the last 30 days, with 1 day chosen at first", async () => {
      const wrapper = await mountPersonWorkTab();
      expect(wrapper.text()).toContain("Slot length");
      expect(slotLengths(wrapper).texts).toEqual(["1 hour", "6 hours", "1 day"]);
      expect(slotLengths(wrapper).checked).toEqual([false, false, true]);
      expect(slotLengths(wrapper).classes.every((className) => className.includes("btn-check") && className.includes("btn-outline"))).toBe(true);
      await wrapper.get("#statistics-person-period-thirty_days").setValue(true);
      expect(slotLengths(wrapper).texts).toEqual(["1 hour", "6 hours", "1 day"]);
      expect(slotLengths(wrapper).checked).toEqual([false, false, true]);
    });

    it("gives a title to each slot length", async () => {
      const wrapper = await mountPersonWorkTab();
      const titles = wrapper.findAll('input[name="statistics-person-slot"]').map((input) => input.element.closest("label")?.title);
      expect(titles).toEqual([
        "Cut the time range into slots of 1 hour",
        "Cut the time range into slots of 6 hours",
        "Cut the time range into slots of 1 day",
      ]);
    });

    it("shows the slot length for the source Git history and for the source AI cost, and keeps the choice when the source changes", async () => {
      const wrapper = await mountPersonWorkTab();
      await wrapper.get("#statistics-person-slot-6").setValue(true);
      await chooseAiCost(wrapper);
      expect(slotLengths(wrapper).checked).toEqual([false, true, false]);
      await wrapper.get("#statistics-person-source-git_history").setValue(true);
      expect(slotLengths(wrapper).checked).toEqual([false, true, false]);
    });

    it("draws 28 bars of 6 hours for the Git history, with one label for each midnight, and reads nothing again", async () => {
      const wrapper = await mountPersonWorkTab();
      await waitForDrawings(1);
      expect(lastDrawing().layout.xaxis.title.text).toBe("Day");
      await wrapper.get("#statistics-person-slot-6").setValue(true);
      await waitForDrawings(2);
      const { traces, layout } = lastDrawing();
      expect(layout.title.text).toBe("Jerome Etienne: commits and pull requests, in slots of 6 hours");
      expect(layout.xaxis.title.text).toBe("Start of the slot");
      expect(traces[0].x).toEqual(Array.from({ length: 28 }, (_, index) => index));
      expect(layout.xaxis).toMatchObject({ type: "linear", range: [-0.5, 27.5], tickmode: "array" });
      expect(layout.xaxis.tickvals).toEqual([0, 4, 8, 12, 16, 20, 24]);
      expect(layout.xaxis.ticktext).toHaveLength(7);
      expect(traces[0].y.reduce((sum, value) => sum + value, 0)).toBe(3);
      expect(traces[0].y[3 * 4 + 2]).toBe(1);
      expect(traces[0].y[6 * 4 + 2]).toBe(2);
      expect(traces[1].y[6 * 4 + 2]).toBe(1);
      expect(personWorkCalls()).toHaveLength(1);
    });

    it("keeps the totals and the averages per day when the slot length changes", async () => {
      const wrapper = await mountPersonWorkTab();
      await wrapper.get("#statistics-person-slot-1").setValue(true);
      expect(totalsOf(wrapper)).toEqual(["3", "1", "1", "18", "6"]);
      expect(perDayOf(wrapper)).toEqual(["0.43 per day", "0.14 per day", "0.14 per day", "2.6 per day", "0.86 per day"]);
    });

    it("draws 28 bars of 6 hours for the AI cost, and adds the hours that a slot holds, without reading again", async () => {
      const wrapper = await mountPersonWorkTab(sampleItems(), hoursOfToday());
      await chooseAiCost(wrapper);
      await vi.waitFor(() => expect(lastDrawing().traces[0].name).toBe("Claude Code"));
      expect(lastDrawing().traces[0].y[6]).toBe(3);
      await wrapper.get("#statistics-person-slot-6").setValue(true);
      await vi.waitFor(() => expect(lastDrawing().traces[0].x).toHaveLength(28));
      const { traces, layout } = lastDrawing();
      expect(layout.title.text).toBe("AI cost in slots of 6 hours, for each coding agent");
      expect(layout.xaxis.title.text).toBe("Start of the slot");
      expect(traces[0].y.slice(24)).toEqual([1, 2, 0, 0]);
      expect(traces[1].y.slice(24)).toEqual([0, 0.5, 0, 0]);
      expect(aiCostTotalsOf(wrapper)).toEqual(["$3.00", "$0.50", "$3.50"]);
      expect(aiCostCalls()).toHaveLength(1);
      expect(synchronizeCalls()).toHaveLength(1);
    });

    it("draws 168 bars of 1 hour for the AI cost, in the tokens too", async () => {
      const wrapper = await mountPersonWorkTab(sampleItems(), hoursOfToday());
      await chooseAiCost(wrapper);
      await wrapper.get("#statistics-person-slot-1").setValue(true);
      await vi.waitFor(() => expect(lastDrawing().traces[0].x).toHaveLength(168));
      expect(lastDrawing().traces[0].y[6 * 24 + 5]).toBe(1);
      expect(lastDrawing().traces[0].y[6 * 24 + 7]).toBe(2);
      expect(lastDrawing().layout.xaxis.tickvals).toEqual([0, 24, 48, 72, 96, 120, 144]);
      await wrapper.get("#statistics-person-unit-tokens").setValue(true);
      await vi.waitFor(() => expect(lastDrawing().layout.title.text).toBe("Tokens in slots of 1 hour, for each coding agent"));
      expect(lastDrawing().traces[0].y[6 * 24 + 7]).toBe(20);
      expect(lastDrawing().layout.yaxis.ticksuffix).toBe(" KT");
    });

    it("shows the day, the start, and the end of the slot in the chart information card", async () => {
      await use24HourClock();
      const wrapper = await mountPersonWorkTab(sampleItems(), hoursOfToday());
      await chooseAiCost(wrapper);
      await wrapper.get("#statistics-person-slot-6").setValue(true);
      await vi.waitFor(() => expect(lastDrawing().traces[0].x).toHaveLength(28));
      await hoverDay(25);
      expect(cardOf(wrapper)?.title).toBe(`${todayText()}, 06:00 to 12:00`);
      expect(cardOf(wrapper)?.total).toBe("$2.50");
      expect(cardOf(wrapper)?.rows).toEqual([
        ["Claude Code", "$2.00"],
        ["Codex", "$0.50"],
      ]);
      await hoverDay(27);
      expect(cardOf(wrapper)?.title).toBe(`${todayText()}, 18:00 to 00:00`);
    });

    it("keeps the slot length when the time range changes, for each slot length", async () => {
      const wrapper = await mountPersonWorkTab();
      await wrapper.get("#statistics-person-slot-6").setValue(true);
      await wrapper.get("#statistics-person-period-thirty_days").setValue(true);
      expect(slotLengths(wrapper).checked).toEqual([false, true, false]);
      await wrapper.get("#statistics-person-period-seven_days").setValue(true);
      await wrapper.get("#statistics-person-slot-1").setValue(true);
      await wrapper.get("#statistics-person-period-thirty_days").setValue(true);
      expect(slotLengths(wrapper).checked).toEqual([true, false, false]);
    });

    it("draws 720 bars of 1 hour for the last 30 days, with one label for every third midnight, and reads nothing again", async () => {
      const wrapper = await mountPersonWorkTab();
      await waitForDrawings(1);
      await wrapper.get("#statistics-person-period-thirty_days").setValue(true);
      await waitForDrawings(2);
      const callsBefore = personWorkCalls().length;
      await wrapper.get("#statistics-person-slot-1").setValue(true);
      await vi.waitFor(() => expect(lastDrawing().traces[0].x).toHaveLength(720));
      expect(lastDrawing().layout.title.text).toBe("Jerome Etienne: commits and pull requests, in slots of 1 hour");
      expect(lastDrawing().layout.xaxis.tickvals).toHaveLength(10);
      expect(personWorkCalls()).toHaveLength(callsBefore);
    });

    it("draws 120 bars of 6 hours for the last 30 days, with one label for every third midnight", async () => {
      const wrapper = await mountPersonWorkTab();
      await waitForDrawings(1);
      await wrapper.get("#statistics-person-period-thirty_days").setValue(true);
      await wrapper.get("#statistics-person-slot-6").setValue(true);
      await vi.waitFor(() => expect(lastDrawing().traces[0].x).toHaveLength(120));
      expect(lastDrawing().layout.xaxis.tickvals).toHaveLength(10);
    });

    it("cuts the day of 25 hours, when summer time ends, into 4 slots of 6 hours and a fifth slot of 1 hour", async () => {
      setToday(9, 25);
      await use24HourClock();
      const hours = [1, 6, 12, 18, 23];
      const wrapper = await mountPersonWorkTab(sampleItems(), aiCostAnswer(hours.map((hour) => hourRow(0, "claude", 1, 1_000, hour))));
      await chooseAiCost(wrapper);
      await wrapper.get("#statistics-person-slot-6").setValue(true);
      await vi.waitFor(() => expect(lastDrawing().traces[0].x).toHaveLength(29));
      expect(lastDrawing().traces[0].y.slice(24)).toEqual([1, 1, 1, 1, 1]);
      const titles: (string | undefined)[] = [];
      for (const index of [24, 25, 26, 27, 28]) {
        await hoverDay(index);
        titles.push(cardOf(wrapper)?.title);
      }
      expect(titles).toEqual([
        "Sunday, October 25, 00:00 to 05:00",
        "Sunday, October 25, 05:00 to 11:00",
        "Sunday, October 25, 11:00 to 17:00",
        "Sunday, October 25, 17:00 to 23:00",
        "Sunday, October 25, 23:00 to 00:00",
      ]);
    });

    it("cuts the day of 23 hours, when summer time starts, into 3 slots of 6 hours and a last slot of 5 hours", async () => {
      setToday(2, 29);
      await use24HourClock();
      const hours = [1, 8, 14, 20];
      const wrapper = await mountPersonWorkTab(sampleItems(), aiCostAnswer(hours.map((hour) => hourRow(0, "claude", 1, 1_000, hour))));
      await chooseAiCost(wrapper);
      await wrapper.get("#statistics-person-slot-6").setValue(true);
      await vi.waitFor(() => expect(lastDrawing().traces[0].x).toHaveLength(28));
      expect(lastDrawing().traces[0].y.slice(24)).toEqual([1, 1, 1, 1]);
      const titles: (string | undefined)[] = [];
      for (const index of [24, 25, 26, 27]) {
        await hoverDay(index);
        titles.push(cardOf(wrapper)?.title);
      }
      expect(titles).toEqual([
        "Sunday, March 29, 00:00 to 07:00",
        "Sunday, March 29, 07:00 to 13:00",
        "Sunday, March 29, 13:00 to 19:00",
        "Sunday, March 29, 19:00 to 00:00",
      ]);
    });
  });
});

describe("PersonWorkTab: the memory of the choices (issue 707)", () => {
  type Tab = Awaited<ReturnType<typeof mountPersonWorkTab>>;

  /** The settings of the run, as the tab and the settings store share them. */
  async function currentSettings() {
    return (await import("../stores/settings")).settings;
  }

  /** The identifier of the checked button of a radio button group, or `null` when no button is checked. */
  function checkedId(wrapper: Tab, name: string): string | null {
    const input = wrapper.findAll(`input[name="${name}"]`).find((candidate) => (candidate.element as HTMLInputElement).checked);
    return input === undefined ? null : input.attributes("id")?.replace(`${name}-`, "") ?? null;
  }

  /** The value of the person chooser, or `null` when the tab shows no person chooser. */
  function personOf(wrapper: Tab): string | null {
    const select = wrapper.find("#statistics-person");
    return select.exists() ? (select.element as HTMLSelectElement).value : null;
  }

  /** Closes the Statistics window and opens it again: the tab is built again, and the settings store stays. */
  async function reopen(wrapper: Tab): Promise<Tab> {
    wrapper.unmount();
    return mountPersonWorkTab();
  }

  /** Starts Heidrun Code again: every module is loaded again, and the settings are read from `localStorage`. */
  async function restart(wrapper: Tab): Promise<Tab> {
    await flushPromises();
    wrapper.unmount();
    vi.resetModules();
    await openWorkspacesAre(WORKSPACES);
    return mountPersonWorkTab();
  }

  it("starts with the Git history, the commits and the pull requests, US dollars, 7 days, 1 day, and the selected workspace when nothing is saved", async () => {
    const wrapper = await mountPersonWorkTab();
    expect(checkedId(wrapper, "statistics-person-source")).toBe("git_history");
    expect(checkedId(wrapper, "statistics-person-metric")).toBe("commits_and_pull_requests");
    expect(checkedId(wrapper, "statistics-person-period")).toBe("seven_days");
    expect(checkedId(wrapper, "statistics-person-slot")).toBe("24");
    expect(chosenWorkspaceNames(wrapper)).toEqual(["heidrun"]);
    await chooseAiCost(wrapper);
    expect(checkedId(wrapper, "statistics-person-unit")).toBe("dollars");
  });

  it("saves each choice in the settings as soon as it changes", async () => {
    const wrapper = await mountPersonWorkTab();
    await wrapper.get("#statistics-person-metric-lines").setValue(true);
    await wrapper.get("#statistics-person").setValue("eric");
    await wrapper.get("#statistics-person-period-fourteen_days").setValue(true);
    await wrapper.get("#statistics-person-slot-6").setValue(true);
    await chooseAiCost(wrapper);
    await wrapper.get("#statistics-person-unit-tokens").setValue(true);
    await chooseWorkspace(wrapper, "workspace-mobile", true);
    const settings = await currentSettings();
    expect(settings.statisticsPersonWorkSource).toBe("ai_cost");
    expect(settings.statisticsPersonWorkMetric).toBe("lines");
    expect(settings.statisticsPersonWorkUnit).toBe("tokens");
    expect(settings.statisticsPersonWorkPerson).toBe("eric");
    expect(settings.statisticsPersonWorkRange).toBe("fourteen_days");
    expect(settings.statisticsPersonWorkSlotHours).toBe(6);
    expect(settings.statisticsPersonWorkWorkspaces).toEqual({ isSaved: true, workspaceIds: ["workspace-heidrun", "workspace-mobile"] });
  });

  it("starts with the saved choices when the window opens again, and keeps the choices that the source hides", async () => {
    const wrapper = await mountPersonWorkTab();
    await wrapper.get("#statistics-person-metric-lines").setValue(true);
    await wrapper.get("#statistics-person").setValue("eric");
    await wrapper.get("#statistics-person-period-thirty_days").setValue(true);
    await wrapper.get("#statistics-person-slot-1").setValue(true);
    await chooseAiCost(wrapper);
    await wrapper.get("#statistics-person-unit-tokens").setValue(true);
    const reopened = await reopen(wrapper);
    expect(checkedId(reopened, "statistics-person-source")).toBe("ai_cost");
    expect(checkedId(reopened, "statistics-person-unit")).toBe("tokens");
    expect(checkedId(reopened, "statistics-person-period")).toBe("thirty_days");
    expect(checkedId(reopened, "statistics-person-slot")).toBe("1");
    expect(personOf(reopened)).toBeNull();
    await reopened.get("#statistics-person-source-git_history").setValue(true);
    await flushPromises();
    expect(checkedId(reopened, "statistics-person-metric")).toBe("lines");
    expect(personOf(reopened)).toBe("eric");
  });

  it("reads the AI cost and not the Git history when the saved source is the AI cost", async () => {
    const wrapper = await mountPersonWorkTab();
    await chooseAiCost(wrapper);
    const reopened = await reopen(wrapper);
    expect(synchronizeCalls()).toHaveLength(1);
    expect(personWorkCalls()).toHaveLength(0);
    expect(aiCostTotalsOf(reopened)).toHaveLength(3);
  });

  it("keeps the choices after Heidrun Code starts again", async () => {
    const wrapper = await mountPersonWorkTab();
    await wrapper.get("#statistics-person-metric-lines").setValue(true);
    await wrapper.get("#statistics-person").setValue("eric");
    await wrapper.get("#statistics-person-period-three_days").setValue(true);
    await wrapper.get("#statistics-person-slot-6").setValue(true);
    await chooseWorkspace(wrapper, "workspace-mobile", true);
    const restarted = await restart(wrapper);
    expect(checkedId(restarted, "statistics-person-source")).toBe("git_history");
    expect(checkedId(restarted, "statistics-person-metric")).toBe("lines");
    expect(personOf(restarted)).toBe("eric");
    expect(checkedId(restarted, "statistics-person-period")).toBe("three_days");
    expect(checkedId(restarted, "statistics-person-slot")).toBe("6");
    expect(chosenWorkspaceNames(restarted)).toEqual(["heidrun", "mobile"]);
  });

  it("starts with the chosen workspaces of the last time, and with no workspace when the developer chose none", async () => {
    const wrapper = await mountPersonWorkTab();
    await chooseWorkspace(wrapper, "workspace-mobile", true);
    await chooseWorkspace(wrapper, "workspace-heidrun", false);
    const reopened = await reopen(wrapper);
    expect(chosenWorkspaceNames(reopened)).toEqual(["mobile"]);
    await reopened.get("#statistics-person-workspace-none").setValue(true);
    await flushPromises();
    const reopenedAgain = await reopen(reopened);
    expect(chosenWorkspaceNames(reopenedAgain)).toEqual([]);
    expect(radioGroup(reopenedAgain, "statistics-person-workspace-every").checked).toEqual([false, true]);
    expect(reopenedAgain.text()).toContain("No workspace is chosen");
  });

  it("starts with the button All when the developer chose every workspace", async () => {
    const wrapper = await mountPersonWorkTab();
    await wrapper.get("#statistics-person-workspace-all").setValue(true);
    const reopened = await reopen(wrapper);
    expect(chosenWorkspaceNames(reopened)).toEqual(["heidrun", "mobile"]);
    expect(radioGroup(reopened, "statistics-person-workspace-every").checked).toEqual([true, false]);
  });

  it("starts with the selected workspace when no saved workspace is open any more", async () => {
    localStorage.setItem(
      "heidrun.settings",
      JSON.stringify({ statisticsPersonWorkWorkspaces: { isSaved: true, workspaceIds: ["workspace-closed"] } }),
    );
    const wrapper = await mountPersonWorkTab();
    expect(chosenWorkspaceNames(wrapper)).toEqual(["heidrun"]);
  });

  it("does not save the workspace that the tab chooses by itself when a chosen workspace closes", async () => {
    const wrapper = await mountPersonWorkTab();
    await wrapper.get("#statistics-person-workspace-all").setValue(true);
    await openWorkspacesAre([WORKSPACES[0]]);
    await flushPromises();
    expect(chosenWorkspaceNames(wrapper)).toEqual(["heidrun"]);
    expect((await currentSettings()).statisticsPersonWorkWorkspaces).toEqual({
      isSaved: true,
      workspaceIds: ["workspace-heidrun", "workspace-mobile"],
    });
  });

  it("keeps the saved person when the list of the people does not hold this person, and chooses the first person", async () => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ statisticsPersonWorkPerson: "nobody@example.com" }));
    const wrapper = await mountPersonWorkTab();
    expect(personOf(wrapper)).not.toBe("nobody@example.com");
    expect(personOf(wrapper)).not.toBeNull();
    expect((await currentSettings()).statisticsPersonWorkPerson).toBe("nobody@example.com");
  });

  it("chooses the saved person as soon as a workspace read gives this person", async () => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ statisticsPersonWorkPerson: "eric" }));
    const wrapper = await mountPersonWorkTab();
    expect(personOf(wrapper)).toBe("eric");
    expect(lastDrawing().layout.title.text).toContain("Eric");
  });

  it("starts with the default choices when the saved values are corrupted", async () => {
    localStorage.setItem(
      "heidrun.settings",
      JSON.stringify({
        statisticsPersonWorkSource: "weather",
        statisticsPersonWorkMetric: 3,
        statisticsPersonWorkUnit: null,
        statisticsPersonWorkRange: "century",
        statisticsPersonWorkSlotHours: 5,
        statisticsPersonWorkWorkspaces: ["workspace-mobile"],
      }),
    );
    const wrapper = await mountPersonWorkTab();
    expect(checkedId(wrapper, "statistics-person-source")).toBe("git_history");
    expect(checkedId(wrapper, "statistics-person-metric")).toBe("commits_and_pull_requests");
    expect(checkedId(wrapper, "statistics-person-period")).toBe("seven_days");
    expect(checkedId(wrapper, "statistics-person-slot")).toBe("24");
    expect(chosenWorkspaceNames(wrapper)).toEqual(["heidrun"]);
  });

  it("does not save anything when the window opens and the developer changes nothing", async () => {
    const wrapper = await mountPersonWorkTab();
    await flushPromises();
    wrapper.unmount();
    const saved = JSON.parse(localStorage.getItem("heidrun.settings") ?? "{}");
    expect(saved.statisticsPersonWorkPerson ?? "").toBe("");
    expect(saved.statisticsPersonWorkWorkspaces?.isSaved ?? false).toBe(false);
  });
});
