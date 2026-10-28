import type { Chat, ChatMeta } from "../stores/chats";
import type { ChatReferenceKind } from "./chat_references";
import { chatFiles, fileFolder } from "./chat_files";
import { topicWordsOf } from "./dynamic_topic_words";

/** The most dynamic topics that one chat has. */
export const MOST_TOPICS = 3;

/** The most issues, and the most pull requests, whose titles are read for one chat. The highest numbers are the newest. */
const MOST_REFERENCES_READ = 3;

/**
 * How much one word counts, by the part of the dynamic topic source information that holds it. The title says what the
 * chat is about, so its words count more than the words of the first messages and of the folders.
 */
const SOURCE_WEIGHTS = {
  title: 3,
  referenceTitles: 2,
  firstMessages: 1,
  fileFolders: 1,
} as const;

/** The data that Heidrun Code reads in a chat to compute its dynamic topics. */
export type DynamicTopicSourceInformation = {
  /** The title of the chat. */
  title: string;
  /** The first messages that the developer typed, at most three. */
  firstMessages: string[];
  /** The folders of the files that the coding agent wrote, below the root of the repository. */
  fileFolders: string[];
  /** The titles of the issues and of the pull requests that the chat mentioned, as far as the forge gave them. */
  referenceTitles: string[];
};

/** An issue or a pull request whose title is part of the dynamic topic source information. */
export type DynamicTopicReference = {
  /** An issue, or a pull request. */
  kind: ChatReferenceKind;
  /** The number of the issue or of the pull request. */
  number: number;
};

/** The words of a chat with their weights: a word that is in the title counts more than a word of a folder. */
export type DynamicTopicTerms = Record<string, number>;

/** The terms of one chat, for the ranking of the words against the other chats. */
export type DynamicTopicDocument = {
  /** The identifier of the chat. */
  id: string;
  /** The terms of the chat. */
  terms: DynamicTopicTerms;
};

/**
 * The issues and the pull requests whose titles are part of the dynamic topic source information of a chat: the three
 * highest issue numbers, then the three highest pull request numbers. A chat can mention many numbers by chance, and the
 * forge is read once for each number.
 * @param meta - what the scan of the file of the chat found
 * @returns the issues first, then the pull requests
 */
export function dynamicTopicReferences(meta: ChatMeta): DynamicTopicReference[] {
  return [
    ...meta.issues.slice(-MOST_REFERENCES_READ).map((number) => ({ kind: "issue" as const, number })),
    ...meta.pull_requests.slice(-MOST_REFERENCES_READ).map((number) => ({ kind: "pull_request" as const, number })),
  ];
}

/**
 * The dynamic topic source information of a chat.
 * @param chat - the chat
 * @param root - the root of the repository, or null when it is not known: the folders are found below it
 * @param referenceTitles - the titles of the issues and of the pull requests that the forge gave, possibly none
 * @returns the four parts
 */
export function dynamicTopicSourceInformation(
  chat: Chat,
  root: string | null,
  referenceTitles: string[],
): DynamicTopicSourceInformation {
  const fileFolders: string[] = [];
  for (const file of chatFiles(root, chat.meta.files_written)) {
    if (file.relativePath === null) {
      continue;
    }
    const folder = fileFolder(file.relativePath);
    if (folder !== "") {
      fileFolders.push(folder);
    }
  }
  return { title: chat.title, firstMessages: chat.meta.first_messages, fileFolders, referenceTitles };
}

/** Adds the words of a text to the terms, each occurrence counting `weight`. */
function addWords(terms: Map<string, number>, text: string, weight: number): void {
  for (const word of topicWordsOf(text)) {
    terms.set(word, (terms.get(word) ?? 0) + weight);
  }
}

/**
 * The terms of a chat: each word of its dynamic topic source information, with the sum of the weights of its occurrences.
 * @param information - the dynamic topic source information of the chat
 * @returns the words with their weights
 */
export function dynamicTopicTerms(information: DynamicTopicSourceInformation): DynamicTopicTerms {
  const terms = new Map<string, number>();
  addWords(terms, information.title, SOURCE_WEIGHTS.title);
  for (const text of information.referenceTitles) {
    addWords(terms, text, SOURCE_WEIGHTS.referenceTitles);
  }
  for (const text of information.firstMessages) {
    addWords(terms, text, SOURCE_WEIGHTS.firstMessages);
  }
  for (const text of information.fileFolders) {
    addWords(terms, text, SOURCE_WEIGHTS.fileFolders);
  }
  return Object.fromEntries(terms);
}

/**
 * The dynamic topics of each chat by the method "Keyword": the words that are frequent in the chat and rare in the other
 * chats. The score of a word is its weight in the chat (a repeat counts less each time) times how rare the word is in
 * the other chats. A word that every chat holds scores nothing. A list of one chat has no other chat, so each word of
 * the chat is as rare as any other and only its weight counts.
 * @param documents - the terms of each chat that the list shows
 * @returns for each identifier of a chat, at most `MOST_TOPICS` words, the best first, and the same words in the same
 * order for the same chats
 */
export function keywordTopics(documents: DynamicTopicDocument[]): Map<string, string[]> {
  const documentFrequency = new Map<string, number>();
  for (const document of documents) {
    for (const term of Object.keys(document.terms)) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }
  const topics = new Map<string, string[]>();
  for (const document of documents) {
    const scored: { term: string; score: number }[] = [];
    for (const [term, weight] of Object.entries(document.terms)) {
      const rarity = documents.length === 1 ? 1 : Math.log(documents.length / (documentFrequency.get(term) ?? 1));
      const score = (1 + Math.log(weight)) * rarity;
      if (score > 0) {
        scored.push({ term, score });
      }
    }
    scored.sort((left, right) => right.score - left.score || (left.term < right.term ? -1 : 1));
    topics.set(
      document.id,
      scored.slice(0, MOST_TOPICS).map((entry) => entry.term),
    );
  }
  return topics;
}
