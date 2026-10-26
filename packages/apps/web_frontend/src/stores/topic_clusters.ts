// The clustered dynamic topics. The translation table is kept on the disk by the Tauri commands `topic_clusters_read` and
// `topic_clusters_write`. A coding agent, `codex` or `claude`, fills it through the Tauri command `coding_agent_ask`.
// The method is in the lib `../lib/topic_clusters.ts`.
import { invoke } from "@tauri-apps/api/core";
import { reactive, shallowRef, watch } from "vue";
import {
  clusterNames,
  clusterPrompt,
  newRawTopics,
  parseClusterAnswer,
  type TranslationTable,
} from "../lib/topic_clusters";
import { settings } from "./settings";

/** What the Tauri command `coding_agent_ask` gives. */
type CodingAgentAnswer = {
  /** The coding agent that answered: `codex` or `claude`. */
  agent: string;
  /** What the coding agent printed. */
  text: string;
};

/** The reasons why a call gives no cluster. The Settings window shows a text for each reason. */
export type TopicClusterError = "noCodingAgent" | "failed" | "wrongAnswer";

/** The translation table: the cluster of each raw dynamic topic. A replaced table is a new object. */
export const topicClusterTable = shallowRef<TranslationTable>(new Map());

/** What the Settings window shows about the clustering. */
export const topicClusterStatus = reactive<{
  /** True while a call to a coding agent runs. */
  isRunning: boolean;
  /** Why the last call gave no cluster, or null when the last call gave clusters or no call happened. */
  error: TopicClusterError | null;
}>({ isRunning: false, error: null });

/** The error that the Tauri command gives when neither `codex` nor `claude` is installed. */
const NO_CODING_AGENT = "no_coding_agent";

/** The raw dynamic topics of the chats that the list showed at the last run. */
let lastRawTopics: string[] = [];

/** True when the translation table was read from the disk. */
let isTableRead = false;

/** True while a run asks a coding agent. */
let isBusy = false;

/** True when a run was asked while another run was busy: the busy run starts again when it ends. */
let isRunAgain = false;

/** The number of rebuilds. A call that started before a rebuild does not save its answer. */
let generation = 0;

/** The sets of new raw dynamic topics whose call failed in this run of Heidrun Code, so a failure does not call again at once. */
const failedAttempts = new Set<string>();

/** Reads the translation table from the disk, once. A table that cannot be read is empty. */
async function readTable(): Promise<void> {
  if (isTableRead) {
    return;
  }
  isTableRead = true;
  try {
    const rows = await invoke<Record<string, string>>("topic_clusters_read");
    topicClusterTable.value = new Map(Object.entries(rows));
  } catch {
    topicClusterTable.value = new Map();
  }
}

/** The kind of error that a failed call gives. */
function errorOf(failure: unknown): TopicClusterError {
  return String(failure) === NO_CODING_AGENT ? "noCodingAgent" : "failed";
}

/** Makes one call for the new raw dynamic topics, when there are some, and saves the answer when it is right. */
async function clusterOnce(): Promise<void> {
  if (settings.dynamicTopics === false || settings.clusteredDynamicTopics === false) {
    return;
  }
  await readTable();
  const newTopics = newRawTopics(lastRawTopics, topicClusterTable.value);
  if (newTopics.length === 0) {
    return;
  }
  const attempt = newTopics.join("\n");
  if (failedAttempts.has(attempt)) {
    return;
  }
  const startGeneration = generation;
  let answer: CodingAgentAnswer;
  try {
    answer = await invoke<CodingAgentAnswer>("coding_agent_ask", {
      prompt: clusterPrompt(clusterNames(topicClusterTable.value), newTopics),
    });
  } catch (failure) {
    failedAttempts.add(attempt);
    topicClusterStatus.error = errorOf(failure);
    return;
  }
  if (generation !== startGeneration) {
    return;
  }
  const clusters = parseClusterAnswer(answer.text, newTopics);
  if (clusters === null) {
    failedAttempts.add(attempt);
    topicClusterStatus.error = "wrongAnswer";
    return;
  }
  const table = new Map(topicClusterTable.value);
  for (const [topic, cluster] of clusters) {
    if (table.has(topic) === false) {
      table.set(topic, cluster);
    }
  }
  try {
    await invoke("topic_clusters_write", { rows: Object.fromEntries(table) });
  } catch {
    /* the table stays in memory: the next run of Heidrun Code asks again */
  }
  topicClusterTable.value = table;
  topicClusterStatus.error = null;
}

/** Runs `clusterOnce`, one run at a time. A run asked during a run starts again when the run ends. */
async function run(): Promise<void> {
  if (isBusy) {
    isRunAgain = true;
    return;
  }
  isBusy = true;
  topicClusterStatus.isRunning = true;
  try {
    do {
      isRunAgain = false;
      await clusterOnce();
    } while (isRunAgain);
  } finally {
    isBusy = false;
    topicClusterStatus.isRunning = false;
  }
}

/**
 * Remembers the raw dynamic topics of the chats that the list shows, and asks a coding agent for the clusters of the new
 * ones, in one single call. It makes no call when the option "Dynamic topics" is off, when the option "Clustered dynamic
 * topics" is off, and when the translation table already knows every raw dynamic topic.
 * @param rawTopics - the raw dynamic topics of the chats that the list shows, with repeats
 */
export async function prepareTopicClusters(rawTopics: Iterable<string>): Promise<void> {
  lastRawTopics = [...rawTopics];
  if (settings.dynamicTopics === false || settings.clusteredDynamicTopics === false) {
    return;
  }
  await run();
}

/**
 * Empties the translation table, on the disk too, and asks a coding agent for the clusters of all the raw dynamic topics
 * of the chats that the list shows, in one single call.
 */
export async function rebuildTopicClusters(): Promise<void> {
  generation += 1;
  failedAttempts.clear();
  isTableRead = true;
  topicClusterTable.value = new Map();
  topicClusterStatus.error = null;
  try {
    await invoke("topic_clusters_write", { rows: {} });
  } catch {
    /* an old table on the disk is read again at the next run of Heidrun Code */
  }
  await run();
}

// Switching the option on again is a new start: a set of raw dynamic topics whose call failed is tried again.
watch(
  () => settings.clusteredDynamicTopics,
  (isOn) => {
    if (isOn) {
      failedAttempts.clear();
      topicClusterStatus.error = null;
    }
  },
);
