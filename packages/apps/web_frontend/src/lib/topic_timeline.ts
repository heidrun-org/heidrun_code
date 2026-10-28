// The topic timeline: a picture of the dynamic topics of the chats that the list shows. Each row is one dynamic topic,
// the horizontal axis is time, and each dot is one chat at the date of its last message. A chat with several topics has
// one dot in each of its rows, and a vertical line joins these dots. This file holds the order of the rows and the place of
// each dot, and needs no component (issue 264).

/** One chat of the topic timeline. */
export type TimelineChat = {
  /** The identifier of the chat. */
  id: string;
  /** The date of the last message of the chat, in milliseconds since 1970. */
  lastAt: number;
};

/** One dot of the topic timeline: one chat in one row. */
export type TimelineDot = {
  /** The identifier of the chat. */
  chatId: string;
  /** The place of the row of the topic, from 0 for the top row. */
  row: number;
  /** The horizontal place of the dot, from 0 for the oldest chat to 1 for the newest chat. */
  x: number;
};

/** One vertical line of the topic timeline: it joins the dots of one chat that has several topics. */
export type TimelineLine = {
  /** The identifier of the chat. */
  chatId: string;
  /** The row of the highest dot of the chat. */
  topRow: number;
  /** The row of the lowest dot of the chat. */
  bottomRow: number;
  /** The horizontal place of the line, from 0 to 1, as the dots of the chat. */
  x: number;
};

/** The rows, the dots, and the lines of the topic timeline. */
export type TimelineLayout = {
  /** The topics, one for each row, the top row first. */
  topics: string[];
  /** The number of chats that have each topic, in the order of `topics`. */
  chatCounts: number[];
  /** One dot for each topic of each chat. */
  dots: TimelineDot[];
  /** One line for each chat that has two topics or more. */
  lines: TimelineLine[];
  /** The date of the oldest chat that has a topic, in milliseconds since 1970, or null when no chat has a topic. */
  firstAt: number | null;
  /** The date of the newest chat that has a topic, in milliseconds since 1970, or null when no chat has a topic. */
  lastAt: number | null;
};

/** A topic that can be the next row, with what decides between two topics. */
type Candidate = {
  /** The topic. */
  topic: string;
  /** The number of chats that the topic shares with the last topic placed. */
  sharedWithLast: number;
  /** The number of chats that the topic shares with all the topics already placed. */
  sharedWithPlaced: number;
  /** The number of chats that have the topic. */
  chatCount: number;
};

/**
 * The topics in the order "related topics together". The first topic is the one that the most chats have. Then each next
 * topic is the one that shares the most chats with the last topic placed, so the topics that go together form a block and
 * the vertical lines stay short. A tie goes to the topic that shares the most chats with all the topics already placed,
 * then to the topic that more chats have, then to the alphabetical order, so the order never changes between two reads of
 * the same chats.
 * @param topicsByChat - the topics of each chat
 * @returns each different topic once, in the order of the rows
 */
export function relatedTopicOrder(topicsByChat: Map<string, string[]>): string[] {
  const chatsOfTopic = new Map<string, Set<string>>();
  for (const [chatId, topics] of topicsByChat) {
    for (const topic of topics) {
      const chatIds = chatsOfTopic.get(topic) ?? new Set<string>();
      chatIds.add(chatId);
      chatsOfTopic.set(topic, chatIds);
    }
  }
  const remaining = new Set(chatsOfTopic.keys());
  const order: string[] = [];
  const placedChats = new Set<string>();
  let last: string | null = null;
  while (remaining.size > 0) {
    let best: Candidate | null = null;
    for (const topic of remaining) {
      const chatIds = chatsOfTopic.get(topic)!;
      const candidate: Candidate = {
        topic,
        sharedWithLast: last === null ? 0 : sharedChatCount(chatsOfTopic.get(last)!, chatIds),
        sharedWithPlaced: sharedChatCount(placedChats, chatIds),
        chatCount: chatIds.size,
      };
      if (best === null || isBetter(candidate, best)) {
        best = candidate;
      }
    }
    order.push(best!.topic);
    remaining.delete(best!.topic);
    for (const chatId of chatsOfTopic.get(best!.topic)!) {
      placedChats.add(chatId);
    }
    last = best!.topic;
  }
  return order;
}

/**
 * The total length of the vertical lines, counted in rows: the sum, for each chat, of the distance between its highest
 * and its lowest row. A smaller number means that the topics of a chat are closer, and the picture is easier to read.
 * @param order - the topics in the order of the rows
 * @param topicsByChat - the topics of each chat
 * @returns the total length of the vertical lines, in rows
 */
export function verticalLineLength(order: string[], topicsByChat: Map<string, string[]>): number {
  const rowOf = new Map(order.map((topic, row) => [topic, row]));
  let total = 0;
  for (const topics of topicsByChat.values()) {
    const rows = topics.map((topic) => rowOf.get(topic)).filter((row): row is number => row !== undefined);
    if (rows.length > 1) {
      total += Math.max(...rows) - Math.min(...rows);
    }
  }
  return total;
}

/**
 * The rows, the dots, and the lines of the topic timeline. A chat without a topic has no dot. When all the chats have the
 * same date, every dot is in the middle.
 * @param chats - the chats that the list shows
 * @param topicsByChat - the topics of each chat, by identifier of chat
 * @returns the layout of the picture
 */
export function topicTimelineLayout(chats: TimelineChat[], topicsByChat: Map<string, string[]>): TimelineLayout {
  const withTopics = chats.filter((chat) => (topicsByChat.get(chat.id) ?? []).length > 0);
  const shownTopics = new Map(withTopics.map((chat) => [chat.id, [...new Set(topicsByChat.get(chat.id))]]));
  const topics = relatedTopicOrder(shownTopics);
  const rowOf = new Map(topics.map((topic, row) => [topic, row]));
  const chatCounts = topics.map(() => 0);
  if (withTopics.length === 0) {
    return { topics, chatCounts, dots: [], lines: [], firstAt: null, lastAt: null };
  }
  const firstAt = Math.min(...withTopics.map((chat) => chat.lastAt));
  const lastAt = Math.max(...withTopics.map((chat) => chat.lastAt));
  const dots: TimelineDot[] = [];
  const lines: TimelineLine[] = [];
  for (const chat of withTopics) {
    const x = lastAt === firstAt ? 0.5 : (chat.lastAt - firstAt) / (lastAt - firstAt);
    const rows = shownTopics.get(chat.id)!.map((topic) => rowOf.get(topic)!);
    for (const row of rows) {
      dots.push({ chatId: chat.id, row, x });
      chatCounts[row] += 1;
    }
    if (rows.length > 1) {
      lines.push({ chatId: chat.id, topRow: Math.min(...rows), bottomRow: Math.max(...rows), x });
    }
  }
  return { topics, chatCounts, dots, lines, firstAt, lastAt };
}

/** The number of chats that two topics share. */
function sharedChatCount(left: Set<string>, right: Set<string>): number {
  let count = 0;
  for (const chatId of left) {
    if (right.has(chatId)) {
      count += 1;
    }
  }
  return count;
}

/** True when `candidate` is a better next row than `best`. */
function isBetter(candidate: Candidate, best: Candidate): boolean {
  if (candidate.sharedWithLast !== best.sharedWithLast) {
    return candidate.sharedWithLast > best.sharedWithLast;
  }
  if (candidate.sharedWithPlaced !== best.sharedWithPlaced) {
    return candidate.sharedWithPlaced > best.sharedWithPlaced;
  }
  if (candidate.chatCount !== best.chatCount) {
    return candidate.chatCount > best.chatCount;
  }
  return candidate.topic < best.topic;
}
