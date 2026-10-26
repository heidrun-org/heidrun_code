<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { Channel, invoke } from "@tauri-apps/api/core";
import PersonWorkUpdateStages from "./PersonWorkUpdateStages.vue";
import StackedBarChart from "./StackedBarChart.vue";
import {
  AI_COST_AGENT_IDS,
  AiCost,
  type AiCostAgentId,
  type AiCostAnswer,
  type AiCostByAgent,
  type AiCostSynchronization,
  type AiTokensByAgent,
} from "../lib/ai_cost";
import { AveragePerDay } from "../lib/average_per_day";
import { CalendarDays } from "../lib/calendar_days";
import { SLOT_HOURS_OF_A_DAY } from "../lib/calendar_slots";
import { costText, tokenCountText } from "../lib/chat_usage";
import { findCodingAgent } from "../lib/coding_agents";
import { SlotText } from "../lib/slot_text";
import { UserActivity } from "../lib/user_activity";
import {
  PERSON_WORK_LONGEST_DAY_COUNT,
  PERSON_WORK_PERIODS,
  PersonWork,
  type PersonWorkItems,
  type PersonWorkSynchronization,
  type PersonWorkPeriodId,
  type PersonWorkSlotHours,
} from "../lib/person_work";
import {
  PersonWorkUpdateStages as UpdateStages,
  type PersonWorkProgress,
  type PersonWorkUpdateReports,
} from "../lib/person_work_update_stages";
import type { StackedBarChartContent } from "../lib/stacked_bar_chart";
import { settings } from "../stores/settings";
import { openWorkspaces, selectedWorkspaceId } from "../stores/user_activity";
import { locale, t } from "../i18n/index";

// The tab "Work of one person" of the Statistics window. Checkboxes in the shape of buttons choose the workspaces that the tab
// reads: one workspace, several, or all. A radio button group chooses the source of the bar chart: the Git history (the
// commits and the pull requests of one person, with the number of issues and the lines), or the AI cost (the chats of each
// coding agent). For the Git history, a second radio button group chooses the metric of the bar chart: the commits and the
// pull requests, or the lines added and the lines deleted. For the AI cost, a second radio button group chooses the unit: US
// dollars or tokens. Each total has its
// average per day under it. A third radio button group chooses the slot length (1 hour, 6 hours, or 1 day), which cuts each
// day into the bars of the chart. The Git history reads the data of each folder once, for the longest time range, the first time that
// a chosen workspace needs it, joins the data of the chosen workspaces, and cuts it again when the workspaces, the person, the
// time range, the slot length, the metric, or the unit changes. The AI cost reads the token usage that the data layer stored, for the chosen workspaces
// together, so that a chat that two workspaces list counts once. It updates the stored token usage first, which opens only the
// chat files that changed. It imports the whole history of a workspace, which opens every chat file, only when the developer
// presses the button "Import the history". Each choice is saved in the settings as soon as the developer changes it, and the
// tab starts with the saved choices (issue 707). A choice that the source hides stays saved.

/** The choices of the radio button group of the source, from left to right. */
const SOURCE_CHOICES = [
  { id: "git_history", labelKey: "statisticsModal.personWorkSourceGitHistory", titleKey: "statisticsModal.personWorkSourceGitHistoryTitle" },
  { id: "ai_cost", labelKey: "statisticsModal.personWorkSourceAiCost", titleKey: "statisticsModal.personWorkSourceAiCostTitle" },
] as const satisfies readonly { id: SourceId; labelKey: string; titleKey: string }[];

/** The choices of the radio button group of the time range, from left to right. */
const PERIOD_CHOICES = [
  { id: "three_days", labelKey: "statisticsModal.personWorkThreeDays", titleKey: "statisticsModal.personWorkThreeDaysTitle" },
  { id: "seven_days", labelKey: "statisticsModal.personWorkSevenDays", titleKey: "statisticsModal.personWorkSevenDaysTitle" },
  { id: "fourteen_days", labelKey: "statisticsModal.personWorkFourteenDays", titleKey: "statisticsModal.personWorkFourteenDaysTitle" },
  { id: "thirty_days", labelKey: "statisticsModal.personWorkThirtyDays", titleKey: "statisticsModal.personWorkThirtyDaysTitle" },
] as const satisfies readonly { id: PersonWorkPeriodId; labelKey: string; titleKey: string }[];

/** The choices of the radio button group of the metric of the Git history, from left to right. */
const METRIC_CHOICES = [
  {
    id: "commits_and_pull_requests",
    labelKey: "statisticsModal.personWorkMetricCommitsAndPullRequests",
    titleKey: "statisticsModal.personWorkMetricCommitsAndPullRequestsTitle",
  },
  { id: "lines", labelKey: "statisticsModal.personWorkMetricLines", titleKey: "statisticsModal.personWorkMetricLinesTitle" },
] as const satisfies readonly { id: MetricId; labelKey: string; titleKey: string }[];

/** The choices of the radio button group of the unit of the AI cost, from left to right. */
const UNIT_CHOICES = [
  { id: "dollars", labelKey: "statisticsModal.personWorkUnitDollars", titleKey: "statisticsModal.personWorkUnitDollarsTitle" },
  { id: "tokens", labelKey: "statisticsModal.personWorkUnitTokens", titleKey: "statisticsModal.personWorkUnitTokensTitle" },
] as const satisfies readonly { id: UnitId; labelKey: string; titleKey: string }[];

/** The color of each coding agent in the chart of the AI cost, as the name of a CSS variable of the theme. */
const AI_COST_COLOR_TOKENS: Record<AiCostAgentId, string> = {
  claude: "--accent",
  codex: "--primary-bg",
};

/** The source of the bar chart: the Git history, or the AI cost. */
type SourceId = "git_history" | "ai_cost";

/** The metric of the bar chart of the Git history: the commits and the pull requests, or the lines added and deleted. */
type MetricId = "commits_and_pull_requests" | "lines";

/** What the read of the AI cost gave: nothing yet, it is working, it gave the token usage, or it failed. */
type AiCostRead =
  | { state: "idle" }
  | { state: "working"; isImport: boolean }
  | { state: "done"; answer: AiCostAnswer; readAt: number; priceWarning: string | null }
  | { state: "failed"; error: string };

/** The unit of the AI cost: US dollars, or tokens. */
type UnitId = "dollars" | "tokens";

/** What the read of one folder gave: it is reading, it gave the items, or it failed. */
type FolderRead<Items> =
  | { state: "reading" }
  | { state: "done"; items: Items; readAt: number }
  | { state: "failed"; error: string };

/** Gives the identifiers of the workspaces that the tab starts with: the selected workspace, or else the first open workspace. */
function firstWorkspaceIds(): string[] {
  const open = openWorkspaces.value;
  const first = open.find((workspace) => workspace.workspaceId === selectedWorkspaceId.value) ?? open[0];
  return first === undefined ? [] : [first.workspaceId];
}

/**
 * Gives the identifiers of the workspaces that the tab starts with: the saved choice when it still names an open workspace, else
 * the selected workspace alone. A saved choice of no workspace stays empty.
 */
function savedWorkspaceIds(): string[] {
  const saved = settings.statisticsPersonWorkWorkspaces;
  if (saved.isSaved === false) {
    return firstWorkspaceIds();
  }
  const stillOpen = saved.workspaceIds.filter((workspaceId) => openWorkspaces.value.some((workspace) => workspace.workspaceId === workspaceId));
  return saved.workspaceIds.length === 0 || stillOpen.length > 0 ? stillOpen : firstWorkspaceIds();
}

/** The identifiers of the workspaces that the developer chose. The saved choice at first, else the selected workspace alone. */
const chosenWorkspaceIds = ref<string[]>(savedWorkspaceIds());

/**
 * The identifiers of the chosen workspaces, for the buttons of the workspaces. A choice of the developer is saved in the settings.
 * A change that the tab makes by itself, when a workspace closes, is not saved.
 */
const chosenWorkspaceIdsChoice = computed({
  get: () => chosenWorkspaceIds.value,
  set: (workspaceIds: string[]) => {
    chosenWorkspaceIds.value = workspaceIds;
    settings.statisticsPersonWorkWorkspaces = { isSaved: true, workspaceIds: [...workspaceIds] };
  },
});

/** True when every open workspace is chosen. */
const isEveryWorkspaceChosen = computed(
  () => openWorkspaces.value.length > 0 && openWorkspaces.value.every((workspace) => chosenWorkspaceIds.value.includes(workspace.workspaceId)),
);

/** True when no workspace is chosen. */
const isNoWorkspaceChosen = computed(() => chosenWorkspaceIds.value.length === 0);

/** The folders of the chosen workspaces, each folder once, in the order of the list of workspaces. */
const chosenFolders = computed(() => [
  ...new Set(openWorkspaces.value.filter((workspace) => chosenWorkspaceIds.value.includes(workspace.workspaceId)).map((workspace) => workspace.folder)),
]);

/**
 * The chosen folders as one text. Heidrun Code makes the list of the open workspaces again after each change that Herdr reports, so
 * `chosenFolders` is a new array each time, with the same folders. A watch on the array would read again each time, and the
 * chart would blink.
 */
const chosenFoldersKey = computed(() => chosenFolders.value.join("\n"));

/** The source of the bar chart. The tab starts with the saved source, or else with the Git history. */
const sourceId = ref<SourceId>(settings.statisticsPersonWorkSource);

/** The metric of the bar chart of the Git history. The tab starts with the saved metric, or else with the commits and the pull requests. */
const metricId = ref<MetricId>(settings.statisticsPersonWorkMetric);

/** The unit of the AI cost. The tab starts with the saved unit, or else with US dollars. */
const unitId = ref<UnitId>(settings.statisticsPersonWorkUnit);

/** The time range of the chart. The tab starts with the saved time range, or else with the last seven days. */
const periodId = ref<PersonWorkPeriodId>(settings.statisticsPersonWorkRange);

/** Gives the slot length that the tab starts with: the saved slot length when the time range offers it, else the default one. */
function savedSlotHours(): PersonWorkSlotHours {
  const period = PERSON_WORK_PERIODS[periodId.value];
  return period.slotHoursChoices.includes(settings.statisticsPersonWorkSlotHours) ? settings.statisticsPersonWorkSlotHours : period.defaultSlotHours;
}

/** The length of a slot in hours: one bar of the chart. The tab starts with the saved slot length, or else with one day. */
const slotHours = ref<PersonWorkSlotHours>(savedSlotHours());

watch(sourceId, (newSourceId) => {
  settings.statisticsPersonWorkSource = newSourceId;
});

watch(metricId, (newMetricId) => {
  settings.statisticsPersonWorkMetric = newMetricId;
});

watch(unitId, (newUnitId) => {
  settings.statisticsPersonWorkUnit = newUnitId;
});

watch(periodId, (newPeriodId) => {
  settings.statisticsPersonWorkRange = newPeriodId;
});

watch(slotHours, (newSlotHours) => {
  settings.statisticsPersonWorkSlotHours = newSlotHours;
});

/** The slot lengths that the time range offers, from the shortest to the longest. */
const slotHoursChoices = computed(() => PERSON_WORK_PERIODS[periodId.value].slotHoursChoices);

/** What the command `person_work_in_range` gave for each folder that the tab asked for. The tab keeps it while the window is open. */
const gitHistoryReads = reactive<Record<string, FolderRead<PersonWorkItems>>>({});

/** The last progress report of each stage of the update of each folder that the tab reads, by folder. */
const gitHistoryUpdates = reactive<Record<string, PersonWorkUpdateReports>>({});

/** What the AI cost gave for the chosen folders together. */
const aiCostRead = ref<AiCostRead>({ state: "idle" });

/** The number of the last read of the AI cost. A read that is not the last one is out of date, and its answer is dropped. */
let aiCostReadNumber = 0;

/** The identifier of the person of the chart, or `null` before the people are known. The saved person at first. */
const personId = ref<string | null>(settings.statisticsPersonWorkPerson === "" ? null : settings.statisticsPersonWorkPerson);

/**
 * The identifier of the person of the chart, for the person chooser. A choice of the developer is saved in the settings. A
 * person that the tab takes by itself, because the saved person is not in the list, is not saved.
 */
const personChoice = computed({
  get: () => personId.value,
  set: (newPersonId: string | null) => {
    personId.value = newPersonId;
    settings.statisticsPersonWorkPerson = newPersonId ?? "";
  },
});

/**
 * Gives the reads of the chosen folders. A folder that the tab did not ask for yet counts as a folder that it is reading,
 * because the tab asks for it before the next drawing.
 *
 * @param reads - The reads of the source.
 * @returns The reads of the chosen folders, in the order of the folders.
 */
function readsOfChosenFolders<Items>(reads: Record<string, FolderRead<Items>>): FolderRead<Items>[] {
  return chosenFolders.value.map((folder) => reads[folder] ?? { state: "reading" });
}

/** The items of the chosen folders that were read, and the time of the last read. `null` when no chosen folder was read. */
function joinedReads<Items>(reads: Record<string, FolderRead<Items>>): { itemsOfFolders: Items[]; readAt: number } | null {
  const done = readsOfChosenFolders(reads).flatMap((read) => (read.state === "done" ? [read] : []));
  if (done.length === 0) {
    return null;
  }
  return { itemsOfFolders: done.map((read) => read.items), readAt: Math.max(...done.map((read) => read.readAt)) };
}

/** The errors of the chosen folders that could not be read, each error once, as one text. Empty when every read worked. */
function errorTextOf<Items>(reads: Record<string, FolderRead<Items>>): string {
  const errors = readsOfChosenFolders(reads).flatMap((read) => (read.state === "failed" ? [read.error] : []));
  return [...new Set(errors)].join("; ");
}

/** True while a chosen folder is read. */
function isReading<Items>(reads: Record<string, FolderRead<Items>>): boolean {
  return readsOfChosenFolders(reads).some((read) => read.state === "reading");
}

/** The commits, the pull requests, and the issues of the chosen workspaces, joined, or `null` when no chosen folder was read. */
const gitHistoryJoined = computed(() => {
  const joined = joinedReads(gitHistoryReads);
  return joined === null ? null : { items: PersonWork.merge(joined.itemsOfFolders), readAt: joined.readAt };
});

/** The commits, the pull requests, and the issues of the chosen workspaces, or `null` when no chosen folder was read. */
const items = computed(() => gitHistoryJoined.value?.items ?? null);

/** The time of the last read of the Git history, in milliseconds since 1 January 1970. The days of the chart follow it. */
const readAt = computed(() => gitHistoryJoined.value?.readAt ?? 0);

/** The errors of the Git history of the chosen workspaces. Empty when every read worked. */
const errorText = computed(() => errorTextOf(gitHistoryReads));

/** The token usage of the chosen workspaces, or `null` before it is read. */
const aiCostAnswer = computed(() => (aiCostRead.value.state === "done" ? aiCostRead.value.answer : null));

/** The time of the last read of the AI cost, in milliseconds since 1 January 1970. The days of the chart follow it. */
const aiCostReadAt = computed(() => (aiCostRead.value.state === "done" ? aiCostRead.value.readAt : 0));

/** The message of the error when the AI cost could not be read, or an empty text. */
const aiCostErrorText = computed(() => (aiCostRead.value.state === "failed" ? aiCostRead.value.error : ""));

/** The message of the error when the prices of the models could not be refreshed, or `null`. */
const aiCostPriceWarning = computed(() => (aiCostRead.value.state === "done" ? aiCostRead.value.priceWarning : null));

/** True while a chosen workspace gives its commits, its pull requests, and its issues. */
const isGitHistoryReading = computed(() => isReading(gitHistoryReads));

/** The chosen folders that are read, each one with the last progress report of each stage of its update. */
const gitHistoryUpdateList = computed(() =>
  chosenFolders.value
    .filter((folder) => (gitHistoryReads[folder]?.state ?? "reading") === "reading")
    .map((folder) => ({ folder, reports: gitHistoryUpdates[folder] ?? {} })),
);

/** True while the token usage is updated or imported, and read. */
const isAiCostReading = computed(() => aiCostRead.value.state === "working");

/** True while the whole history of a workspace is imported, which can take a few minutes. */
const isAiCostImporting = computed(() => aiCostRead.value.state === "working" && aiCostRead.value.isImport);

/** True when at least one chosen workspace has its history imported: the totals mean something only then. */
const hasImportedWorkspace = computed(
  () => aiCostAnswer.value !== null && aiCostAnswer.value.workspaces.some((workspace) => workspace.synchronizedAt !== null),
);

/** The chosen workspaces whose history was never imported. */
const notImportedWorkspaces = computed(() => (aiCostAnswer.value === null ? [] : AiCost.findNotImported(aiCostAnswer.value.workspaces)));

/** The chosen workspaces that cannot be read, each with its error. */
const failedWorkspaces = computed(() => (aiCostAnswer.value === null ? [] : aiCostAnswer.value.workspaces.filter((workspace) => workspace.error !== null)));

/** The date when the oldest of the imported workspaces was updated, written for the interface, or an empty text. */
const synchronizedAtText = computed(() => {
  const oldest = aiCostAnswer.value === null ? null : AiCost.findOldestSynchronizedAt(aiCostAnswer.value.workspaces);
  return oldest === null ? "" : dateTimeText(oldest);
});

/** The date when the price list was checked, written for the interface, or an empty text when no price is stored. */
const pricesCheckedAtText = computed(() => {
  const checkedAt = aiCostAnswer.value?.pricesCheckedAt ?? null;
  return checkedAt === null ? "" : dateTimeText(checkedAt);
});

/** Writes a date and a time, an ISO 8601 text, as the language of the interface writes them. */
function dateTimeText(isoText: string): string {
  return new Date(isoText).toLocaleString(locale.value, { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Writes a cost in US dollars. A cost of exactly zero is "$0.00": the text "Less than $0.01" of `costText` is for a small
 * cost that is not zero.
 */
function dollarsText(dollars: number): string {
  if (dollars === 0) {
    return (0).toLocaleString(locale.value, { style: "currency", currency: "USD" });
  }
  return costText(dollars);
}

/** Writes a number of tokens as the card of a chat writes it, for example "20.61 KT". An average is rounded to whole tokens. */
function tokensText(tokens: number): string {
  return tokenCountText(Math.round(tokens)).text;
}

/** Writes an amount of the AI cost in the unit that the developer chose: US dollars, or tokens. */
function amountText(amount: number): string {
  return unitId.value === "tokens" ? tokensText(amount) : dollarsText(amount);
}

/** The number of days of the chart. */
const dayCount = computed(() => PERSON_WORK_PERIODS[periodId.value].dayCount);

/** The people of the repository, the person with the most items first. */
const persons = computed(() => (items.value === null ? [] : PersonWork.findPersons(items.value)));

/** The person of the chart. */
const person = computed(() => persons.value.find((candidate) => candidate.id === personId.value) ?? null);

/** The days and the totals of the person in the time range, or `null` when there is no person. */
const result = computed(() => {
  if (items.value === null || person.value === null) {
    return null;
  }
  return PersonWork.compute(items.value, person.value.id, readAt.value, dayCount.value, slotHours.value);
});

/** Writes a number of items or of lines as the language of the interface writes a number. */
function countText(count: number): string {
  return count.toLocaleString(locale.value);
}

/** Writes the average per day of a total of items or of lines, for the time range of the chart. */
function averageCountText(total: number): string {
  return t("statisticsModal.personWorkPerDay", { value: AveragePerDay.countText(AveragePerDay.of(total, dayCount.value), locale.value) });
}

/** The totals under the chooser, from left to right, each with its average per day. */
const totals = computed(() =>
  [
    { id: "commits", labelKey: "statisticsModal.personWorkCommits", value: result.value?.commitCount ?? 0 },
    { id: "pull-requests", labelKey: "statisticsModal.personWorkPullRequests", value: result.value?.pullRequestCount ?? 0 },
    { id: "issues", labelKey: "statisticsModal.personWorkIssues", value: result.value?.issueCount ?? 0 },
    { id: "lines-added", labelKey: "statisticsModal.personWorkLinesAdded", value: result.value?.insertionCount ?? 0 },
    { id: "lines-deleted", labelKey: "statisticsModal.personWorkLinesDeleted", value: result.value?.deletionCount ?? 0 },
  ].map((total) => ({
    id: total.id,
    labelKey: total.labelKey,
    valueText: countText(total.value),
    perDayText: averageCountText(total.value),
  })),
);

/** The days and the totals of the AI cost in the time range, or `null` before the token usage is read. */
const aiCostResult = computed(() => {
  if (aiCostAnswer.value === null) {
    return null;
  }
  return AiCost.compute(aiCostAnswer.value, aiCostReadAt.value, dayCount.value, slotHours.value);
});

/** The amount of a coding agent on a day, or in the whole time range, in the unit that the developer chose. */
function agentAmount(byAgentCost: AiCostByAgent, byAgentTokens: AiTokensByAgent, agentId: AiCostAgentId): number {
  return unitId.value === "tokens" ? byAgentTokens[agentId] : byAgentCost[agentId];
}

/** The totals of the AI cost under the chooser, from left to right: each coding agent, then the two together. */
const aiCostTotals = computed(() =>
  [
    ...AI_COST_AGENT_IDS.map((agentId) => ({
      id: agentId,
      label: findCodingAgent(agentId)?.label ?? agentId,
      amount: aiCostResult.value === null ? 0 : agentAmount(aiCostResult.value.totalByAgent, aiCostResult.value.totalTokensByAgent, agentId),
    })),
    {
      id: "total",
      label: t("statisticsModal.personWorkAiCostTotal"),
      amount: (unitId.value === "tokens" ? aiCostResult.value?.totalTokens : aiCostResult.value?.totalCost) ?? 0,
    },
  ].map((total) => ({
    id: total.id,
    label: total.label,
    valueText: amountText(total.amount),
    perDayText: t("statisticsModal.personWorkPerDay", { value: amountText(AveragePerDay.of(total.amount, dayCount.value)) }),
  })),
);

/** The title of the horizontal axis: "Day" for a slot of one day, else "Start of the slot". */
function horizontalAxisTitle(): string {
  return t(slotHours.value === SLOT_HOURS_OF_A_DAY ? "statisticsModal.dayAxis" : "statisticsModal.slotStartAxis");
}

/** The bar chart of the commits and of the pull requests of the Git history, or `null` when there is no person. */
const commitsChart = computed<StackedBarChartContent | null>(() => {
  if (result.value === null || person.value === null) {
    return null;
  }
  const slots = result.value.slots;
  const slotLength = SlotText.length(slotHours.value);
  return {
    memoryKey: "git_history_commits_and_pull_requests",
    labels: SlotText.labels(slots, dayCount.value, slotHours.value),
    series: [
      {
        id: "commits",
        name: t("statisticsModal.personWorkCommitsTrace"),
        colorToken: "--primary-bg",
        values: slots.map((slot) => slot.commitCount),
        valueTexts: slots.map((slot) => String(slot.commitCount)),
      },
      {
        id: "pull_requests",
        name: t("statisticsModal.personWorkPullRequestsTrace"),
        colorToken: "--success-bg",
        values: slots.map((slot) => slot.pullRequestCount),
        valueTexts: slots.map((slot) => String(slot.pullRequestCount)),
      },
    ],
    titles: slots.map((slot) => SlotText.cardTitle(slot, slotHours.value)),
    totals: null,
    title: t("statisticsModal.personWorkChartTitle", { person: person.value.name, slotLength }),
    horizontalAxisTitle: horizontalAxisTitle(),
    verticalAxisTitle: t("statisticsModal.personWorkVerticalAxis"),
    verticalAxisUnit: "count",
    chartLabel: t("statisticsModal.personWorkChartLabel", { slotLength }),
  };
});

/** The bar chart of the lines added and of the lines deleted of the Git history, or `null` when there is no person. */
const linesChart = computed<StackedBarChartContent | null>(() => {
  if (result.value === null || person.value === null) {
    return null;
  }
  const slots = result.value.slots;
  const slotLength = SlotText.length(slotHours.value);
  return {
    memoryKey: "git_history_lines",
    labels: SlotText.labels(slots, dayCount.value, slotHours.value),
    series: [
      {
        id: "lines_added",
        name: t("statisticsModal.personWorkLinesAdded"),
        colorToken: "--success-bg",
        values: slots.map((slot) => slot.insertionCount),
        valueTexts: slots.map((slot) => countText(slot.insertionCount)),
      },
      {
        id: "lines_deleted",
        name: t("statisticsModal.personWorkLinesDeleted"),
        colorToken: "--danger-bg",
        values: slots.map((slot) => slot.deletionCount),
        valueTexts: slots.map((slot) => countText(slot.deletionCount)),
      },
    ],
    titles: slots.map((slot) => SlotText.cardTitle(slot, slotHours.value)),
    totals: null,
    title: t("statisticsModal.personWorkLinesChartTitle", { person: person.value.name, slotLength }),
    horizontalAxisTitle: horizontalAxisTitle(),
    verticalAxisTitle: t("statisticsModal.personWorkLinesVerticalAxis"),
    verticalAxisUnit: "count",
    chartLabel: t("statisticsModal.personWorkLinesChartLabel", { slotLength }),
  };
});

/** The bar chart of the Git history that the developer chose with the metric, or `null` when there is no person. */
const gitHistoryChart = computed(() => (metricId.value === "lines" ? linesChart.value : commitsChart.value));

/** The bar chart of the AI cost or of the tokens, or `null` before the token usage is read, or when no token is in the time range. */
const aiCostChart = computed<StackedBarChartContent | null>(() => {
  if (aiCostResult.value === null || aiCostResult.value.totalTokens === 0) {
    return null;
  }
  const slots = aiCostResult.value.slots;
  const isTokens = unitId.value === "tokens";
  const slotLength = SlotText.length(slotHours.value);
  return {
    memoryKey: "ai_cost",
    labels: SlotText.labels(slots, dayCount.value, slotHours.value),
    series: AI_COST_AGENT_IDS.map((agentId) => ({
      id: agentId,
      name: findCodingAgent(agentId)?.label ?? agentId,
      colorToken: AI_COST_COLOR_TOKENS[agentId],
      values: slots.map((slot) => agentAmount(slot.costByAgent, slot.tokensByAgent, agentId)),
      valueTexts: slots.map((slot) => amountText(agentAmount(slot.costByAgent, slot.tokensByAgent, agentId))),
    })),
    titles: slots.map((slot) => SlotText.cardTitle(slot, slotHours.value)),
    totals: slots.map((slot) =>
      amountText(AI_COST_AGENT_IDS.reduce((sum, agentId) => sum + agentAmount(slot.costByAgent, slot.tokensByAgent, agentId), 0)),
    ),
    title: t(isTokens ? "statisticsModal.personWorkAiTokensChartTitle" : "statisticsModal.personWorkAiCostChartTitle", { slotLength }),
    horizontalAxisTitle: horizontalAxisTitle(),
    verticalAxisTitle: t(isTokens ? "statisticsModal.personWorkAiTokensVerticalAxis" : "statisticsModal.personWorkAiCostVerticalAxis"),
    verticalAxisUnit: isTokens ? "tokens" : "dollars",
    chartLabel: t(isTokens ? "statisticsModal.personWorkAiTokensChartLabel" : "statisticsModal.personWorkAiCostChartLabel", { slotLength }),
  };
});

/** Gives the time range that both reads use: the longest time range, ending at the end of today. */
function longestRange(now: number): { since: string; until: string } {
  return {
    since: UserActivity.formatTime(CalendarDays.firstDayStartedAt(now, PERSON_WORK_LONGEST_DAY_COUNT)),
    until: UserActivity.formatTime(CalendarDays.endOfTodayAt(now)),
  };
}

/**
 * Reads the data of one folder through the data layer, and keeps the answer, or the error, for the folder. A read that is
 * already asked for, or done, is not asked for again.
 *
 * @param folderToRead - The folder of a chosen workspace.
 */
async function readGitHistory(folderToRead: string): Promise<void> {
  if (gitHistoryReads[folderToRead] !== undefined) {
    return;
  }
  gitHistoryReads[folderToRead] = { state: "reading" };
  gitHistoryUpdates[folderToRead] = {};
  const onProgress = new Channel<PersonWorkProgress>();
  onProgress.onmessage = (report) => {
    gitHistoryUpdates[folderToRead] = UpdateStages.withReport(gitHistoryUpdates[folderToRead] ?? {}, report);
  };
  const now = Date.now();
  try {
    const synchronization = await invoke<PersonWorkSynchronization>("person_work_synchronize", { folder: folderToRead, onProgress });
    const items = await invoke<Omit<PersonWorkItems, "codeHostingError">>("person_work_in_range", {
      repository: synchronization.repository,
      ...longestRange(now),
    });
    gitHistoryReads[folderToRead] = {
      state: "done",
      items: { ...items, codeHostingError: synchronization.codeHostingError },
      readAt: now,
    };
  } catch (error) {
    gitHistoryReads[folderToRead] = { state: "failed", error: String(error) };
  }
}

/**
 * Updates the stored token usage of the chosen workspaces, then reads it. The update opens only the chat files that changed
 * since the last read of a workspace. A workspace whose history was never imported is imported only when `isImportAllowed` is
 * true, because the import opens every chat file of the workspace. An answer of a read that is not the last one is dropped.
 *
 * @param isImportAllowed - True when the developer pressed the button "Import the history".
 */
async function readAiCost(isImportAllowed: boolean): Promise<void> {
  aiCostReadNumber += 1;
  const readNumber = aiCostReadNumber;
  aiCostRead.value = { state: "working", isImport: isImportAllowed };
  const folders = chosenFolders.value;
  try {
    const synchronization = await invoke<AiCostSynchronization>("ai_cost_synchronize", { folders, isImportAllowed });
    const now = Date.now();
    const answer = await invoke<AiCostAnswer>("ai_cost_in_range", { folders, ...longestRange(now), timeZone: AiCost.timeZone() });
    if (readNumber === aiCostReadNumber) {
      aiCostRead.value = {
        state: "done",
        answer: AiCost.mergeSynchronizationErrors(answer, synchronization),
        readAt: now,
        priceWarning: synchronization.priceWarning,
      };
    }
  } catch (error) {
    if (readNumber === aiCostReadNumber) {
      aiCostRead.value = { state: "failed", error: String(error) };
    }
  }
}

// The saved person is chosen when the list holds this person. Else the person with the most items is chosen when the people are
// known, and a person that the list does not hold cannot stay chosen. The list can grow while the folders are read one by one, so
// the saved person comes back as soon as the list holds this person.
watch(persons, (list) => {
  const savedPerson = list.find((candidate) => candidate.id === settings.statisticsPersonWorkPerson);
  if (savedPerson !== undefined) {
    personId.value = savedPerson.id;
    return;
  }
  if (list.some((candidate) => candidate.id === personId.value) === false) {
    personId.value = list[0]?.id ?? null;
  }
});

// A time range that does not offer the slot length in use goes back to the slot length that it starts with. A slot length that
// the new time range offers stays.
watch(periodId, (newPeriodId) => {
  const period = PERSON_WORK_PERIODS[newPeriodId];
  if (period.slotHoursChoices.includes(slotHours.value) === false) {
    slotHours.value = period.defaultSlotHours;
  }
});

// A workspace that closes cannot stay chosen. When no chosen workspace stays open, the first open workspace takes its place.
watch(openWorkspaces, (list) => {
  const stillOpen = chosenWorkspaceIds.value.filter((workspaceId) => list.some((workspace) => workspace.workspaceId === workspaceId));
  if (stillOpen.length === chosenWorkspaceIds.value.length) {
    return;
  }
  chosenWorkspaceIds.value = stillOpen.length > 0 ? stillOpen : firstWorkspaceIds();
});

/** Chooses every open workspace. */
function chooseEveryWorkspace(): void {
  chosenWorkspaceIdsChoice.value = openWorkspaces.value.map((workspace) => workspace.workspaceId);
}

/** Chooses no workspace. */
function chooseNoWorkspace(): void {
  chosenWorkspaceIdsChoice.value = [];
}

// A source reads its data only when it is shown. The Git history reads only the chosen folders that it did not read yet. The AI
// cost updates and reads the token usage of the chosen folders each time the source or the folders change. The window does not
// touch the chat files before the developer asks for the AI cost, and it never imports a whole history by itself.
watch(
  [chosenFoldersKey, sourceId],
  ([, source]) => {
    const folders = chosenFolders.value;
    if (source === "git_history") {
      for (const folder of folders) {
        void readGitHistory(folder);
      }
    } else if (folders.length > 0) {
      void readAiCost(false);
    }
  },
  { immediate: true },
);
</script>

<template>
  <div class="d-flex flex-column" style="height: 100%">
    <span v-if="openWorkspaces.length === 0" class="form-text">{{ t("statisticsModal.personWorkNoWorkspace") }}</span>
    <template v-else>
      <div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
        <div class="d-flex flex-column align-items-start gap-2">
          <div class="d-flex flex-wrap align-items-center gap-3">
            <div class="d-flex align-items-center gap-2">
              <span class="form-text">{{ t("statisticsModal.personWorkSourceLabel") }}</span>
              <div class="btn-group btn-group-sm" role="group" :aria-label="t('statisticsModal.personWorkSourceLabel')">
                <label v-for="choice in SOURCE_CHOICES" :key="choice.id" class="btn btn-check btn-outline theme-secondary" :title="t(choice.titleKey)">
                  <input
                    :id="`statistics-person-source-${choice.id}`"
                    v-model="sourceId"
                    type="radio"
                    name="statistics-person-source"
                    autocomplete="off"
                    :value="choice.id"
                  />
                  {{ t(choice.labelKey) }}
                </label>
              </div>
            </div>
            <label v-if="sourceId === 'git_history' && persons.length > 0" class="d-flex align-items-center gap-2" for="statistics-person">
              <span class="form-text">{{ t("statisticsModal.personWorkPersonLabel") }}</span>
              <select id="statistics-person" v-model="personChoice" class="form-control form-control-sm w-auto">
                <option v-for="candidate in persons" :key="candidate.id" :value="candidate.id">{{ candidate.name }}</option>
              </select>
            </label>
          </div>
          <div v-if="sourceId === 'git_history'" class="d-flex align-items-center gap-2">
            <span class="form-text">{{ t("statisticsModal.personWorkMetricLabel") }}</span>
            <div class="btn-group btn-group-sm" role="group" :aria-label="t('statisticsModal.personWorkMetricLabel')">
              <label v-for="choice in METRIC_CHOICES" :key="choice.id" class="btn btn-check btn-outline theme-secondary" :title="t(choice.titleKey)">
                <input
                  :id="`statistics-person-metric-${choice.id}`"
                  v-model="metricId"
                  type="radio"
                  name="statistics-person-metric"
                  autocomplete="off"
                  :value="choice.id"
                />
                {{ t(choice.labelKey) }}
              </label>
            </div>
          </div>
          <div v-if="sourceId === 'ai_cost'" class="d-flex align-items-center gap-2">
            <span class="form-text">{{ t("statisticsModal.personWorkUnitLabel") }}</span>
            <div class="btn-group btn-group-sm" role="group" :aria-label="t('statisticsModal.personWorkUnitLabel')">
              <label v-for="choice in UNIT_CHOICES" :key="choice.id" class="btn btn-check btn-outline theme-secondary" :title="t(choice.titleKey)">
                <input
                  :id="`statistics-person-unit-${choice.id}`"
                  v-model="unitId"
                  type="radio"
                  name="statistics-person-unit"
                  autocomplete="off"
                  :value="choice.id"
                />
                {{ t(choice.labelKey) }}
              </label>
            </div>
          </div>
        </div>
        <div class="d-flex flex-column gap-2">
          <div class="d-flex flex-wrap align-items-center gap-3 ms-auto">
            <div class="d-flex align-items-center gap-2">
              <span class="form-text">{{ t("statisticsModal.slotLabel") }}</span>
              <div class="btn-group btn-group-sm" role="group" :aria-label="t('statisticsModal.slotLabel')">
                <label
                  v-for="hours in slotHoursChoices"
                  :key="hours"
                  class="btn btn-check btn-outline theme-secondary"
                  :title="t('statisticsModal.slotTitle', { slotLength: SlotText.length(hours) })"
                >
                  <input
                    :id="`statistics-person-slot-${hours}`"
                    v-model="slotHours"
                    type="radio"
                    name="statistics-person-slot"
                    autocomplete="off"
                    :value="hours"
                  />
                  {{ SlotText.length(hours) }}
                </label>
              </div>
            </div>
            <div class="d-flex align-items-center gap-2">
              <span class="form-text">{{ t("statisticsModal.rangeLabel") }}</span>
              <div class="btn-group btn-group-sm" role="group" :aria-label="t('statisticsModal.rangeLabel')">
                <label v-for="choice in PERIOD_CHOICES" :key="choice.id" class="btn btn-check btn-outline theme-secondary" :title="t(choice.titleKey)">
                  <input
                    :id="`statistics-person-period-${choice.id}`"
                    v-model="periodId"
                    type="radio"
                    name="statistics-person-period"
                    autocomplete="off"
                    :value="choice.id"
                  />
                  {{ t(choice.labelKey) }}
                </label>
              </div>
            </div>
          </div>
          <div class="d-flex flex-wrap align-items-center gap-2 ms-auto">
            <span class="form-text">{{ t("statisticsModal.workspacesLabel") }}</span>
            <div class="btn-group btn-group-sm" role="group" :aria-label="t('statisticsModal.personWorkWorkspacesEveryLabel')">
              <label class="btn btn-check btn-outline theme-secondary" :title="t('statisticsModal.personWorkWorkspacesAllTitle')">
                <input
                  id="statistics-person-workspace-all"
                  type="radio"
                  name="statistics-person-workspace-every"
                  autocomplete="off"
                  :checked="isEveryWorkspaceChosen"
                  @change="chooseEveryWorkspace"
                />
                {{ t("statisticsModal.personWorkWorkspacesAllButton") }}
              </label>
              <label class="btn btn-check btn-outline theme-secondary" :title="t('statisticsModal.personWorkWorkspacesNoneTitle')">
                <input
                  id="statistics-person-workspace-none"
                  type="radio"
                  name="statistics-person-workspace-every"
                  autocomplete="off"
                  :checked="isNoWorkspaceChosen"
                  @change="chooseNoWorkspace"
                />
                {{ t("statisticsModal.personWorkWorkspacesNoneButton") }}
              </label>
            </div>
            <div class="btn-group btn-group-sm flex-wrap" role="group" :aria-label="t('statisticsModal.workspacesLabel')">
              <label
                v-for="workspace in openWorkspaces"
                :key="workspace.workspaceId"
                class="btn btn-check btn-outline theme-secondary"
                :title="t('statisticsModal.personWorkWorkspaceTitle', { folder: workspace.folder })"
              >
                <input
                  :id="`statistics-person-workspace-${workspace.workspaceId}`"
                  v-model="chosenWorkspaceIdsChoice"
                  type="checkbox"
                  autocomplete="off"
                  :value="workspace.workspaceId"
                />
                {{ workspace.label }}
              </label>
            </div>
          </div>
        </div>
      </div>
      <span v-if="chosenFolders.length === 0" class="form-text">{{ t("statisticsModal.personWorkWorkspacesNone") }}</span>
      <template v-else-if="sourceId === 'git_history'">
        <div v-if="errorText !== ''" class="alert theme-danger" role="alert">{{ t("statisticsModal.personWorkLoadError", { error: errorText }) }}</div>
        <PersonWorkUpdateStages v-if="isGitHistoryReading" :updates="gitHistoryUpdateList" />
        <template v-else-if="items !== null">
          <div v-if="items.codeHostingError !== null" class="alert theme-warning" role="alert">
            {{ t("statisticsModal.personWorkCodeHostingError", { error: items.codeHostingError }) }}
          </div>
          <span v-if="persons.length === 0" class="form-text">{{ t("statisticsModal.personWorkNoPerson") }}</span>
          <template v-else>
            <div class="d-flex flex-wrap gap-3 mb-3">
              <div v-for="total in totals" :key="total.id" :data-total="total.id" class="d-flex flex-column">
                <div class="d-flex align-items-center gap-2">
                  <span class="fs-4 fw-semibold">{{ total.valueText }}</span>
                  <span class="form-text">{{ t(total.labelKey) }}</span>
                </div>
                <span class="form-text" data-per-day>{{ total.perDayText }}</span>
              </div>
            </div>
            <div v-if="gitHistoryChart !== null" style="flex: 1 1 0; min-height: 240px">
              <StackedBarChart v-bind="gitHistoryChart" />
            </div>
          </template>
        </template>
      </template>
      <template v-else>
        <div v-if="aiCostErrorText !== ''" class="alert theme-danger" role="alert">
          {{ t("statisticsModal.personWorkAiCostLoadError", { error: aiCostErrorText }) }}
        </div>
        <span v-if="isAiCostReading" class="form-text" role="status">
          <span class="spinner-border spinner-sm me-2" aria-hidden="true"></span
          >{{ t(isAiCostImporting ? "statisticsModal.personWorkAiCostImporting" : "statisticsModal.personWorkAiCostLoading") }}
        </span>
        <template v-else-if="aiCostResult !== null">
          <div v-if="aiCostPriceWarning !== null" class="alert theme-warning" role="alert" data-note="price-warning">
            {{ t("statisticsModal.personWorkAiCostPriceWarning", { error: aiCostPriceWarning }) }}
          </div>
          <div v-for="workspace in failedWorkspaces" :key="workspace.folder" class="alert theme-danger" role="alert" data-note="workspace-error">
            {{ t("statisticsModal.personWorkAiCostWorkspaceError", { folder: workspace.folder, error: workspace.error ?? "" }) }}
          </div>
          <div v-if="notImportedWorkspaces.length > 0" class="d-flex flex-wrap align-items-center gap-3 mb-3" data-note="not-imported">
            <span class="form-text">{{ t("statisticsModal.personWorkAiCostNotImported", { count: notImportedWorkspaces.length }) }}</span>
            <button
              id="statistics-person-import"
              type="button"
              class="btn theme-primary"
              :title="t('statisticsModal.personWorkAiCostImportTitle')"
              @click="readAiCost(true)"
            >
              {{ t("statisticsModal.personWorkAiCostImport") }}
            </button>
          </div>
          <div v-if="hasImportedWorkspace" class="d-flex flex-wrap gap-3 mb-3">
            <div v-for="total in aiCostTotals" :key="total.id" :data-total="total.id" class="d-flex flex-column">
              <div class="d-flex align-items-center gap-2">
                <span class="fs-4 fw-semibold">{{ total.valueText }}</span>
                <span class="form-text">{{ total.label }}</span>
              </div>
              <span class="form-text" data-per-day>{{ total.perDayText }}</span>
            </div>
          </div>
          <span v-if="hasImportedWorkspace && aiCostResult.totalTokens === 0" class="form-text">{{ t("statisticsModal.personWorkAiCostNone") }}</span>
          <div v-if="aiCostChart !== null" style="flex: 1 1 0; min-height: 240px">
            <StackedBarChart v-bind="aiCostChart" />
          </div>
          <span v-if="unitId === 'dollars' && aiCostResult.unpricedTokens > 0" class="form-text" data-note="partial-cost">
            {{ t("statisticsModal.personWorkAiCostPartial", { tokens: tokensText(aiCostResult.unpricedTokens) }) }}
          </span>
          <span v-if="synchronizedAtText !== ''" class="form-text" data-note="freshness">
            {{ t("statisticsModal.personWorkAiCostFreshness", { time: synchronizedAtText }) }}
            {{
              aiCostAnswer !== null && aiCostAnswer.priceVersion !== null
                ? t("statisticsModal.personWorkAiCostPrices", { version: aiCostAnswer.priceVersion, time: pricesCheckedAtText })
                : t("statisticsModal.personWorkAiCostNoPrices")
            }}
          </span>
        </template>
      </template>
    </template>
  </div>
</template>
