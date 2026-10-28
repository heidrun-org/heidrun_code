// The clustered dynamic topics. A cluster is a group of raw dynamic topics that have a close meaning, and its name is the
// clustered dynamic topic. The translation table maps each raw dynamic topic, in lower case, to the name of its cluster.
// A coding agent fills the table. This file holds the parts that need no program of the computer: it finds the new raw
// dynamic topics, writes the prompt, checks the answer, and translates the topics of the chats.

/** The most words in the name of a cluster. */
const MOST_CLUSTER_WORDS = 2;

/** The most raw dynamic topics in one cluster. A wider cluster hides the precise words behind one name (issue 270). */
export const MOST_CLUSTER_TOPICS = 5;

/** The category names that fit every project, so they never help the developer to find a chat (issue 270). */
const GENERIC_NAMES = ["software", "interface", "changes", "state", "actions", "dimensions", "media", "organization", "subjects", "unclear", "misc"];

/** The translation table: the name of the cluster of each raw dynamic topic, by raw dynamic topic in lower case. */
export type TranslationTable = Map<string, string>;

/**
 * The key of a raw dynamic topic in the translation table.
 * @param topic - a raw dynamic topic
 * @returns the topic in lower case, without the spaces at its start and at its end
 */
export function rawTopicKey(topic: string): string {
  return topic.trim().toLowerCase();
}

/**
 * The raw dynamic topics that the translation table does not know yet.
 * @param rawTopics - the raw dynamic topics of the chats that the list shows, with repeats
 * @param table - the translation table
 * @returns each new raw dynamic topic once, in lower case, in the alphabetical order, so the same chats give the same prompt
 */
export function newRawTopics(rawTopics: Iterable<string>, table: TranslationTable): string[] {
  const keys = new Set<string>();
  for (const topic of rawTopics) {
    const key = rawTopicKey(topic);
    if (key !== "" && table.has(key) === false) {
      keys.add(key);
    }
  }
  return [...keys].sort();
}

/**
 * The names of the clusters that the translation table holds.
 * @param table - the translation table
 * @returns each name once, in the alphabetical order
 */
export function clusterNames(table: TranslationTable): string[] {
  return [...new Set(table.values())].sort();
}

/**
 * The prompt that asks a coding agent to put each new raw dynamic topic in a cluster. It holds the names of the clusters
 * and the new raw dynamic topics, and nothing else: no text of a chat leaves the computer.
 * @param existingClusters - the names of the clusters that exist
 * @param newTopics - the new raw dynamic topics
 * @returns the prompt
 */
export function clusterPrompt(existingClusters: string[], newTopics: string[]): string {
  return [
    "You group short labels that are near-synonyms. Each label names a subject of a conversation about one software project. A developer clicks a cluster name to find the conversations about one precise subject, so a cluster name must be precise.",
    "",
    "Rules:",
    `- A cluster holds only labels that name the same precise thing, for example "resize" and "resized", or "merge" and "merged", or "modal" and "dialog". Two labels that are only in the same broad area ("button" and "menu", "color" and "pixel") stay in separate clusters.`,
    "- The name of a cluster is always one of its labels, written exactly as it is. Never invent a new name.",
    `- Never use a category name such as ${GENERIC_NAMES.map((name) => `"${name}"`).join(", ")}.`,
    `- A cluster holds at most ${MOST_CLUSTER_TOPICS} labels.`,
    "- A label with no near-synonym is its own cluster: its cluster name is the label itself. This is the normal case.",
    "- Existing clusters: put a new label in an existing cluster only when it is a near-synonym of the existing cluster name.",
    "",
    `Answer with only a JSON array and no other text. The array has one item for each new label, in this form: {"topic": "<new label>", "cluster": "<name of the cluster>"}. Each new label appears exactly once, written as it is below.`,
    "",
    `Existing clusters: ${JSON.stringify(existingClusters)}`,
    `New labels: ${JSON.stringify(newTopics)}`,
  ].join("\n");
}

/** The words of the name of a cluster, in lower case, with one space between two words. */
function clusterNameOf(value: string): string {
  return value.trim().toLowerCase().split(/\s+/).join(" ");
}

/**
 * Checks the answer of a coding agent, and reads it.
 * @param answer - the text that the coding agent printed
 * @param newTopics - the new raw dynamic topics that the prompt asked about
 * @returns the cluster of each new raw dynamic topic, or null when the answer is wrong: not a JSON array, a cluster
 * without a name or with more than two words, a topic that was not asked, a topic twice, or a topic that is missing
 */
export function parseClusterAnswer(answer: string, newTopics: string[]): Map<string, string> | null {
  const start = answer.indexOf("[");
  const end = answer.lastIndexOf("]");
  if (start === -1 || end < start) {
    return null;
  }
  let items: unknown;
  try {
    items = JSON.parse(answer.slice(start, end + 1));
  } catch {
    return null;
  }
  if (Array.isArray(items) === false) {
    return null;
  }
  const asked = new Set(newTopics.map(rawTopicKey));
  const clusters = new Map<string, string>();
  for (const item of items as unknown[]) {
    if (typeof item !== "object" || item === null) {
      return null;
    }
    const { topic, cluster } = item as Record<string, unknown>;
    if (typeof topic !== "string" || typeof cluster !== "string") {
      return null;
    }
    const key = rawTopicKey(topic);
    const name = clusterNameOf(cluster);
    const isNameWrong = name === "" || name.split(" ").length > MOST_CLUSTER_WORDS;
    if (isNameWrong || asked.has(key) === false || clusters.has(key)) {
      return null;
    }
    clusters.set(key, name);
  }
  return clusters.size === asked.size ? clusters : null;
}

/**
 * Keeps only the specific clusters of an answer. The name of a cluster must be a new raw dynamic topic of the answer or an
 * existing cluster, never an invented category, and a cluster holds at most `MOST_CLUSTER_TOPICS` raw dynamic topics, the
 * rows of the translation table counted. A raw dynamic topic that breaks a rule is its own cluster.
 * @param clusters - the cluster of each new raw dynamic topic, as `parseClusterAnswer` gives it
 * @param table - the translation table
 * @returns the cluster of each new raw dynamic topic, in the same order
 */
export function specificClusters(clusters: Map<string, string>, table: TranslationTable): Map<string, string> {
  const allowedNames = new Set([...clusters.keys(), ...table.values()]);
  const sizes = new Map<string, number>();
  for (const name of table.values()) {
    sizes.set(name, (sizes.get(name) ?? 0) + 1);
  }
  const result = new Map<string, string>();
  for (const [topic, name] of clusters) {
    const size = sizes.get(name) ?? 0;
    const cluster = allowedNames.has(name) && size < MOST_CLUSTER_TOPICS ? name : topic;
    sizes.set(cluster, (sizes.get(cluster) ?? 0) + 1);
    result.set(topic, cluster);
  }
  return result;
}

/**
 * The clustered dynamic topics of one chat.
 * @param rawTopics - the raw dynamic topics of the chat
 * @param table - the translation table
 * @returns the cluster of each raw dynamic topic, each name once, in the order of the raw dynamic topics. A raw dynamic
 * topic that the table does not know yet is its own cluster.
 */
export function clusteredTopics(rawTopics: string[], table: TranslationTable): string[] {
  const names = new Set<string>();
  for (const topic of rawTopics) {
    names.add(table.get(rawTopicKey(topic)) ?? topic);
  }
  return [...names];
}

/**
 * The clustered dynamic topics of many chats.
 * @param rawTopicsByChat - the raw dynamic topics of each chat, by identifier of chat
 * @param table - the translation table
 * @returns the clustered dynamic topics of each chat, by identifier of chat
 */
export function clusteredTopicsByChat(
  rawTopicsByChat: Map<string, string[]>,
  table: TranslationTable,
): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const [id, rawTopics] of rawTopicsByChat) {
    result.set(id, clusteredTopics(rawTopics, table));
  }
  return result;
}
