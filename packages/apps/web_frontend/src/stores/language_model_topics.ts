// The dynamic topics of the chats by the method "Language model". A coding agent, `codex` or `claude`, finds the topics
// through the Tauri command `coding_agent_ask`. The cache keeps the topics of each chat, so a chat whose last message
// did not change is never sent again. The prompt and the check of the answer are in the lib
// `../lib/language_model_topics.ts`.
import { invoke } from "@tauri-apps/api/core";
import { reactive, shallowReactive, watch } from "vue";
import {
  existingTopicsOf,
  languageModelChatOf,
  languageModelPrompt,
  MOST_CHATS_PER_CALL,
  parseLanguageModelAnswer,
} from "../lib/language_model_topics";
import type { Chat } from "./chats";
import { lastMessageAt } from "./dynamic_topics";
import { settings } from "./settings";

/** What the cache keeps for one chat. */
export type LanguageModelEntry = {
  /** The date of the last message of the chat when the entry was made, in milliseconds since 1970. */
  lastAt: number;
  /** The dynamic topics that the language model gave: one to three. */
  topics: string[];
};

/** What the Tauri command `coding_agent_ask` gives. */
type CodingAgentAnswer = {
  /** The coding agent that answered: `codex` or `claude`. */
  agent: string;
  /** What the coding agent printed. */
  text: string;
};

/** The reasons why a call gives no topic. The Settings window shows a text for each reason. */
export type LanguageModelTopicError = "noCodingAgent" | "failed" | "wrongAnswer";

/** Where the cache is saved: the `localStorage` of the web frontend. */
const KEY = "heidrun.languageModelTopicsCache";

/** The form of the saved cache. A cache of another version is dropped. */
const CACHE_VERSION = 1;

/** The most chats that the saved cache keeps. The chats with the oldest last message leave first. */
const MOST_ENTRIES = 200;

/** The error that the Tauri command gives when neither `codex` nor `claude` is installed. */
const NO_CODING_AGENT = "no_coding_agent";

/** True when a saved value has the form of an entry of the cache. */
function isEntry(value: unknown): value is LanguageModelEntry {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.lastAt === "number" &&
    Array.isArray(entry.topics) &&
    entry.topics.length > 0 &&
    entry.topics.every((topic) => typeof topic === "string")
  );
}

/** The entries that the last run saved, without the ones that are corrupted. */
function loadEntries(): Record<string, LanguageModelEntry> {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (stored === null || stored.version !== CACHE_VERSION || typeof stored.entries !== "object") {
      return {};
    }
    const entries: Record<string, LanguageModelEntry> = {};
    for (const [id, entry] of Object.entries(stored.entries ?? {})) {
      if (isEntry(entry)) {
        entries[id] = entry;
      }
    }
    return entries;
  } catch {
    return {};
  }
}

/** The cache of the method "Language model", by identifier of chat. An entry is replaced as a whole, never changed. */
export const languageModelEntries = shallowReactive<Record<string, LanguageModelEntry>>(loadEntries());

/** What the Settings window shows about the method "Language model". */
export const languageModelStatus = reactive<{
  /** True while a call to a coding agent runs. */
  isRunning: boolean;
  /** Why the last call gave no topic, or null when the last call gave topics or no call happened. */
  error: LanguageModelTopicError | null;
}>({ isRunning: false, error: null });

/** The chats that the list showed at the last run. */
let lastChatList: Chat[] = [];

/** True while a run asks a coding agent. */
let isBusy = false;

/** True when a run was asked while another run was busy: the busy run starts again when it ends. */
let isRunAgain = false;

/** The chats, with the date of their last message, whose call failed in this run of Heidrun Code, so a failure does not call again at once. */
const failedAttempts = new Set<string>();

/** Saves the cache. The chats with the oldest last message leave when the cache holds more than `MOST_ENTRIES` chats. */
function saveEntries(): void {
  const ids = Object.keys(languageModelEntries);
  if (ids.length > MOST_ENTRIES) {
    ids.sort((left, right) => languageModelEntries[right].lastAt - languageModelEntries[left].lastAt);
    for (const id of ids.slice(MOST_ENTRIES)) {
      delete languageModelEntries[id];
    }
  }
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: CACHE_VERSION, entries: languageModelEntries }));
  } catch {
    /* the cache is a convenience */
  }
}

/** The key of a chat, at the date of its last message, in `failedAttempts`. */
function attemptKey(chat: Chat): string {
  return `${chat.id}|${lastMessageAt(chat)}`;
}

/** The chats of the list that have no entry, or an entry older than their last message, and that did not fail yet. */
function chatsToAsk(): Chat[] {
  return lastChatList.filter((chat) => {
    const entry = languageModelEntries[chat.id];
    const isFresh = entry !== undefined && entry.lastAt === lastMessageAt(chat);
    return isFresh === false && failedAttempts.has(attemptKey(chat)) === false;
  });
}

/** The kind of error that a failed call gives. */
function errorOf(failure: unknown): LanguageModelTopicError {
  return String(failure) === NO_CODING_AGENT ? "noCodingAgent" : "failed";
}

/**
 * Makes one call for the first chats that need topics, and saves the answer when it is right.
 * @returns true when the call gave topics, so that other chats may still wait for a call
 */
async function askOnce(): Promise<boolean> {
  if (settings.dynamicTopics === false || settings.dynamicTopicExtraction !== "languageModel") {
    return false;
  }
  const batch = chatsToAsk().slice(0, MOST_CHATS_PER_CALL);
  if (batch.length === 0) {
    return false;
  }
  let answer: CodingAgentAnswer;
  try {
    answer = await invoke<CodingAgentAnswer>("coding_agent_ask", {
      prompt: languageModelPrompt(existingTopicsOf(Object.values(languageModelEntries)), batch.map(languageModelChatOf)),
    });
  } catch (failure) {
    for (const chat of batch) {
      failedAttempts.add(attemptKey(chat));
    }
    languageModelStatus.error = errorOf(failure);
    return false;
  }
  const topics = parseLanguageModelAnswer(answer.text, batch.length);
  if (topics === null) {
    for (const chat of batch) {
      failedAttempts.add(attemptKey(chat));
    }
    languageModelStatus.error = "wrongAnswer";
    return false;
  }
  batch.forEach((chat, index) => {
    languageModelEntries[chat.id] = { lastAt: lastMessageAt(chat), topics: topics[index] };
  });
  saveEntries();
  languageModelStatus.error = null;
  return true;
}

/** Runs `askOnce` until no chat is left to ask, one run at a time. A run asked during a run starts again when the run ends. */
async function run(): Promise<void> {
  if (isBusy) {
    isRunAgain = true;
    return;
  }
  isBusy = true;
  languageModelStatus.isRunning = true;
  try {
    let isProgress: boolean;
    do {
      isRunAgain = false;
      isProgress = await askOnce();
    } while (isProgress || isRunAgain);
  } finally {
    isBusy = false;
    languageModelStatus.isRunning = false;
  }
}

/**
 * Remembers the chats that the list shows, and asks a coding agent for the topics of the chats that have none, or whose
 * last message is newer than their topics. It makes no call when the option "Dynamic topics" is off, when the method is
 * not "Language model", and when every chat of the list already has fresh topics. A long list is sent in several calls of at most `MOST_CHATS_PER_CALL` chats.
 * @param chatList - the chats that the list shows
 */
export async function prepareLanguageModelTopics(chatList: Chat[]): Promise<void> {
  lastChatList = chatList;
  if (settings.dynamicTopics === false || settings.dynamicTopicExtraction !== "languageModel") {
    return;
  }
  await run();
}

/**
 * The dynamic topics of the chats that the list shows, by the method "Language model". It reads the cache, so a component
 * that calls it in a computed value shows the new topics when the cache changes. A chat keeps its old topics while the
 * topics for its new last message are on the way.
 * @param chatList - the chats that the list shows
 * @returns for each identifier of a chat that has an entry, its topics
 */
export function languageModelTopicsOf(chatList: Chat[]): Map<string, string[]> {
  const topics = new Map<string, string[]>();
  for (const chat of chatList) {
    const entry = languageModelEntries[chat.id];
    if (entry !== undefined) {
      topics.set(chat.id, entry.topics);
    }
  }
  return topics;
}

// Choosing the method again is a new start: a chat whose call failed is tried again.
watch(
  () => settings.dynamicTopicExtraction,
  (method) => {
    if (method === "languageModel") {
      failedAttempts.clear();
      languageModelStatus.error = null;
    }
  },
);
