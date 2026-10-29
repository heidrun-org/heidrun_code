import { computed, reactive } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { settings } from "./settings";
import { ApplicationLog } from "../lib/application_log";
import { chatFiles } from "../lib/chat_files";

/** A coding agent that saves its conversations on this Mac. */
export type ChatAgent = "claude" | "codex";

/** The coding agents that save their conversations on this Mac, in the order of the selector. */
export const CHAT_AGENTS: readonly ChatAgent[] = ["claude", "codex"];

/**
 * The coding agents that the developer checked in the selector of the Past chats sidebar section, as the settings save
 * them: "both", one coding agent, or "none" (issue #959).
 */
export type ChatAgentSelection = "both" | ChatAgent | "none";

/** The values of `ChatAgentSelection`. */
export const CHAT_AGENT_SELECTIONS: readonly ChatAgentSelection[] = ["both", ...CHAT_AGENTS, "none"];

/**
 * What the list of chats is sorted by, in the order of the dropdown menu. The names are the ones that the Tauri command
 * `chats_list` reads.
 */
export const CHAT_SORT_KEYS = [
  "created_on",
  "last_updated",
  "messages",
  "issues",
  "pull_requests",
  "files_written",
] as const;

/** One way to sort the list of chats. */
export type ChatSortKey = (typeof CHAT_SORT_KEYS)[number];

/** The two orders of the dropdown menu, in this order. "descending" puts the largest value of the sort key first. */
export const CHAT_SORT_ORDERS = ["ascending", "descending"] as const;

/** One order of the list of chats. */
export type ChatSortOrder = (typeof CHAT_SORT_ORDERS)[number];

/** The coding agents that the developer checked the last time, or "both" when the saved value is not valid. */
function savedChatAgents(): ChatAgentSelection {
  return CHAT_AGENT_SELECTIONS.find((selection) => selection === settings.chatsAgent) ?? "both";
}

/**
 * The coding agents of a selection, in the order of the selector.
 * @param selection - the saved selection
 * @returns the checked coding agents
 */
export function chatAgentsOf(selection: ChatAgentSelection): ChatAgent[] {
  return CHAT_AGENTS.filter((agent) => selection === "both" || selection === agent);
}

/**
 * The selection of a list of checked coding agents.
 * @param agents - the checked coding agents
 * @returns "both", the one coding agent, or "none"
 */
function chatAgentSelectionOf(agents: ChatAgent[]): ChatAgentSelection {
  if (CHAT_AGENTS.every((agent) => agents.includes(agent))) {
    return "both";
  }
  return CHAT_AGENTS.find((agent) => agents.includes(agent)) ?? "none";
}

/** What the scan of the file of a chat found, without a model. The Rust side computes it and keeps it on the disk. */
export interface ChatMeta {
  /** The date of the first record that has a date, in milliseconds since 1970, or null. */
  first_at: number | null;
  /** The date of the last record that has a date, in milliseconds since 1970, or null. */
  last_at: number | null;
  /** The number of messages that the developer typed. */
  user_messages: number;
  /** The text of the first messages that the developer typed, at most three, each one on one line. */
  first_messages: string[];
  /** The folders where the coding agent ran during the chat. */
  folders: string[];
  /** The numbers of the issues that the chat mentions, in increasing order. */
  issues: number[];
  /** The numbers of the pull requests that the chat mentions, in increasing order. */
  pull_requests: number[];
  /** The files that the coding agent wrote. */
  files_written: string[];
}

/** The tokens that a chat used, and what they cost. The Rust side adds the tokens of the lines of the file of the chat. */
export interface ChatUsage {
  /** Every input token that was sent, with the ones that the provider read from its cache and wrote to it. */
  input_tokens: number;
  /** The input tokens that the provider read from its cache. They are a part of `input_tokens`. */
  cached_input_tokens: number;
  /** The output tokens, with the tokens of the reasoning. */
  output_tokens: number;
  /** The estimated cost in US dollars, at the public price of each model, or null when a model of the chat has no known price. */
  cost_usd: number | null;
}

/** One saved conversation between the developer and a coding agent. */
export interface Chat {
  /** The identifier that the coding agent gave to the conversation. */
  id: string;
  /** The title of the conversation, or its first message when the conversation has no title. */
  title: string;
  /** When the file of the conversation changed, in milliseconds since 1970. */
  updated_at: number;
  /** What the scan of the file found. */
  meta: ChatMeta;
  /** The tokens and the cost of the chat, or null when the chat used no token. */
  usage?: ChatUsage | null;
}

/** A chat that the list shows, with the coding agent that made it. */
export type ShownChat = Chat & {
  /** The coding agent that made the chat. The button of the row that opens the chat shows its icon. */
  agent: ChatAgent;
};

/** The number of chats that the list shows at the start, then after each click on "Show more". The next clicks add 50. */
export const CHAT_LIMITS = [5, 10, 20, 50] as const;

/** The number of chats that a click on "Show more" adds after the last number of `CHAT_LIMITS`. */
const CHAT_LIMIT_STEP = 50;

/** What the Tauri command `chats_list` answers for one coding agent. */
interface AgentChats {
  /** The newest chats first, at most the limit that was asked. */
  chats: Chat[];
  /** True when the folder holds more chats than the ones in `chats`. */
  has_more: boolean;
}

/**
 * What the Tauri command `chats_list` answers: the root of the repository that holds the folder, and the newest chats of
 * that repository for each coding agent.
 */
type ChatsOfFolder = Record<ChatAgent, AgentChats> & { root: string };

/**
 * The conversations of the folder of the selected workspace. `folder` is the folder whose conversations the lists hold.
 * `agents` is the coding agents that the developer checked in the selector: both, one, or none. `limit` is the number of chats that the lists ask
 * for, and `hasMore` tells for each coding agent whether the folder holds more chats than the list shows.
 */
export const chats = reactive({
  folder: null as string | null,
  /** The root of the repository that holds `folder`. The files that the chats wrote are below it. Null until the first answer. */
  root: null as string | null,
  claude: [] as Chat[],
  codex: [] as Chat[],
  hasMore: { claude: false, codex: false } as Record<ChatAgent, boolean>,
  limit: CHAT_LIMITS[0] as number,
  agents: savedChatAgents(),
  /** True while a click on "Show more" waits for its answer. */
  isShowingMore: false,
  /** True until the first answer for the folder arrives. */
  isLoading: false,
  /** The reason why the conversations could not be read, or null. */
  error: null as string | null,
});

/**
 * Checks or unchecks a coding agent in the selector, and saves the checked coding agents for the next start.
 * @param agent - the coding agent of the button
 * @param isChecked - true to show the chats of the coding agent, false to hide them
 */
export function checkChatAgent(agent: ChatAgent, isChecked: boolean) {
  const others = chatAgentsOf(chats.agents).filter((checked) => checked !== agent);
  const selection = chatAgentSelectionOf(isChecked ? [...others, agent] : others);
  chats.agents = selection;
  settings.chatsAgent = selection;
}

/**
 * Saves the sort key that the developer chose in the dropdown menu, for the next start, and reads the chats again in the
 * new order.
 */
export async function chooseChatSortKey(key: ChatSortKey): Promise<void> {
  settings.chatsSortKey = key;
  await readChats(chats.folder);
}

/** Saves the order that the developer chose in the dropdown menu, for the next start, and reads the chats again. */
export async function chooseChatSortOrder(order: ChatSortOrder): Promise<void> {
  settings.chatsOrder = order;
  await readChats(chats.folder);
}

/** The coding agents that have at least one conversation in the folder, in the order of the selector. */
export const availableChatAgents = computed(() => CHAT_AGENTS.filter((agent) => chats[agent].length > 0));

/** The coding agents that the developer checked in the selector, in the order of the selector. */
export const checkedChatAgents = computed(() => chatAgentsOf(chats.agents));

/**
 * The conversations that the list shows: the chats of the checked coding agents in one list, in the order that the
 * settings say, at most the limit. No chat when no coding agent is checked.
 */
export const shownChats = computed<ShownChat[]>(() => {
  const list = checkedChatAgents.value.flatMap((agent) => chats[agent].map((chat): ShownChat => ({ ...chat, agent })));
  return sortChats(list, settings.chatsSortKey, settings.chatsOrder, chats.root).slice(0, chats.limit);
});

/** True when the folder holds more chats of the checked coding agents than the list shows. */
export const canShowMoreChats = computed(() => {
  const agents = checkedChatAgents.value;
  const count = agents.reduce((total, agent) => total + chats[agent].length, 0);
  return agents.some((agent) => chats.hasMore[agent]) || count > shownChats.value.length;
});

/**
 * The number that a chat is sorted by, as the Tauri command `chats_list` computes it: a date in milliseconds since 1970,
 * or a count.
 * @param chat - the chat
 * @param key - the sort key
 * @param root - the root of the repository, or null when it is not known: a file of a worktree and the same file at the
 * root count as one
 * @returns the number
 */
export function chatSortValue(chat: Chat, key: ChatSortKey, root: string | null): number {
  switch (key) {
    case "created_on":
      return chat.meta.first_at ?? chat.updated_at;
    case "last_updated":
      return chat.updated_at;
    case "messages":
      return chat.meta.user_messages;
    case "issues":
      return chat.meta.issues.length;
    case "pull_requests":
      return chat.meta.pull_requests.length;
    case "files_written":
      return chatFiles(root, chat.meta.files_written).length;
  }
}

/**
 * Sorts chats as the Tauri command `chats_list` sorts them: by the value of the sort key in the order, then the chat with
 * the most recent activity first, then by identifier.
 * @param list - the chats, not changed
 * @param key - the sort key
 * @param order - the order of the sort key
 * @param root - the root of the repository, or null when it is not known
 * @returns a new sorted list
 */
export function sortChats<T extends Chat>(list: T[], key: ChatSortKey, order: ChatSortOrder, root: string | null): T[] {
  const direction = order === "descending" ? -1 : 1;
  return list
    .map((chat) => ({ chat, value: chatSortValue(chat, key, root) }))
    .sort(
      (a, b) =>
        direction * (a.value - b.value) ||
        b.chat.updated_at - a.chat.updated_at ||
        (a.chat.id < b.chat.id ? -1 : a.chat.id > b.chat.id ? 1 : 0),
    )
    .map((entry) => entry.chat);
}

/** True when the list shows more chats than the next lower number of chats allows, so a click on "Show less" changes the list. */
export const canShowLessChats = computed(() => shownChats.value.length > previousChatLimit(chats.limit));

/** The number of chats to ask for after a click on "Show more". */
export function nextChatLimit(limit: number): number {
  return CHAT_LIMITS.find((step) => step > limit) ?? limit + CHAT_LIMIT_STEP;
}

/** The number of chats to ask for after a click on "Show less": the step before `limit`, and never less than the first step. */
export function previousChatLimit(limit: number): number {
  const lastStep = CHAT_LIMITS[CHAT_LIMITS.length - 1];
  if (limit > lastStep) {
    return Math.max(lastStep, limit - CHAT_LIMIT_STEP);
  }
  return [...CHAT_LIMITS].reverse().find((step) => step < limit) ?? CHAT_LIMITS[0];
}

/**
 * Lowers the number of chats that the list asks for, and cuts the lists to it at once, without asking the Tauri command.
 * A coding agent whose list is cut now has more chats than the list shows.
 */
export function showLessChats(): void {
  if (chats.isShowingMore || canShowLessChats.value === false) {
    return;
  }
  const limit = previousChatLimit(chats.limit);
  chats.limit = limit;
  for (const agent of CHAT_AGENTS) {
    chats.hasMore[agent] = chats.hasMore[agent] || chats[agent].length > limit;
    chats[agent] = chats[agent].slice(0, limit);
  }
}

/** Raises the number of chats that the list asks for, and reads the stored chats again. It does not synchronize. */
export async function showMoreChats(): Promise<void> {
  if (chats.isShowingMore) {
    return;
  }
  chats.isShowingMore = true;
  chats.limit = nextChatLimit(chats.limit);
  try {
    await readChats(chats.folder);
  } finally {
    chats.isShowingMore = false;
  }
}

/** The synchronization that runs now, so that two refreshes of the same folder share one synchronization. */
let runningSynchronization: { folder: string; promise: Promise<string | null> } | null = null;

/**
 * Refreshes the conversations of a folder: shows the stored conversations at once when the lists are empty, asks the Tauri
 * command `chats_synchronize` to copy the new and changed chat files into the SQLite file of the data layer, then reads the
 * stored conversations again. A failure of the synchronization is kept in `chats.error`, and the stored conversations stay. A
 * change of folder empties the lists first, and starts again with the first limit, so that the Past chats sidebar section
 * never shows the conversations of another workspace.
 * @param folder - the folder of the selected workspace, or null when no workspace is selected
 */
export async function loadChats(folder: string | null): Promise<void> {
  if (chats.folder !== folder) {
    chats.folder = folder;
    chats.root = null;
    chats.claude = [];
    chats.codex = [];
    chats.hasMore = { claude: false, codex: false };
    chats.limit = CHAT_LIMITS[0];
    chats.error = null;
  }
  if (folder === null) {
    chats.isLoading = false;
    return;
  }
  chats.isLoading = chats.claude.length === 0 && chats.codex.length === 0;
  const startedAt = performance.now();
  if (chats.root === null) {
    await readChats(folder);
  }
  if (chats.folder !== folder) {
    return;
  }
  const synchronizationError = await synchronizeChats(folder);
  await readChats(folder);
  if (chats.folder !== folder) {
    return;
  }
  if (synchronizationError !== null) {
    chats.error = synchronizationError;
  }
  void ApplicationLog.recordLoadTime("past_chats", startedAt, chats.error);
}

/** Copies the chat files of the folder into the SQLite file. Gives the reason of a failure, or null. */
function synchronizeChats(folder: string): Promise<string | null> {
  if (runningSynchronization === null || runningSynchronization.folder !== folder) {
    const promise = invoke("chats_synchronize", { folder })
      .then(() => null)
      .catch((reason: unknown) => String(reason instanceof Error ? reason.message : reason))
      .finally(() => {
        runningSynchronization = null;
      });
    runningSynchronization = { folder, promise };
  }
  return runningSynchronization.promise;
}

/**
 * Reads the stored conversations of a folder, in the order that the settings say. It does not synchronize. An answer for a
 * folder, a limit, a sort key, or an order that is no longer the current one is dropped.
 * @param folder - the folder of the selected workspace, or null when no workspace is selected
 */
async function readChats(folder: string | null): Promise<void> {
  if (folder === null) {
    return;
  }
  const limit = chats.limit;
  const sortKey = settings.chatsSortKey;
  const order = settings.chatsOrder;
  try {
    const found = await invoke<ChatsOfFolder>("chats_list", { folder, limit, sortKey, order });
    const isSortChanged = settings.chatsSortKey !== sortKey || settings.chatsOrder !== order;
    if (chats.folder !== folder || chats.limit !== limit || isSortChanged) {
      return;
    }
    chats.root = found.root;
    chats.claude = found.claude.chats;
    chats.codex = found.codex.chats;
    chats.hasMore = { claude: found.claude.has_more, codex: found.codex.has_more };
    chats.error = null;
  } catch (reason) {
    if (chats.folder === folder) {
      chats.error = String(reason instanceof Error ? reason.message : reason);
    }
  } finally {
    if (chats.folder === folder) {
      chats.isLoading = false;
    }
  }
}
