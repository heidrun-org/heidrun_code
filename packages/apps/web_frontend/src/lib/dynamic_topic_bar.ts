/** How many topics one click on an arrow of the dynamic topic bar shows. */
export const TOPICS_PER_CLICK = 3;

/** The width, in pixels, of the part of the bar that an arrow and its fade cover. A topic under it counts as hidden. */
export const ARROW_ZONE = 44;

/** The place of one button of the dynamic topic bar inside the strip that holds the buttons, in pixels. */
export type TopicChipBox = {
  /** The distance from the start of the strip to the start of the button. */
  left: number;
  /** The distance from the start of the strip to the end of the button. */
  right: number;
};

/** The number of chats that hold a topic, and how well the chats rank it. */
type TopicStrength = {
  /** The number of chats that have the topic. */
  chatCount: number;
  /** The sum of the places of the topic in the chats, where the first place is 0. A low sum means a strong topic. */
  rankSum: number;
};

/**
 * The topics of the dynamic topic bar, the strongest first. A topic that more chats have is stronger. For the same number
 * of chats, a topic that the chats rank higher is stronger. For the same rank, the alphabetical order decides, so the
 * order never changes between two reads of the same chats.
 * @param topicsByChat - the topics of each chat that the list shows, the best topic of a chat first
 * @returns each different topic once, the strongest first
 */
export function dynamicTopicBarTopics(topicsByChat: Map<string, string[]>): string[] {
  const strengths = new Map<string, TopicStrength>();
  for (const topics of topicsByChat.values()) {
    topics.forEach((topic, place) => {
      const strength = strengths.get(topic) ?? { chatCount: 0, rankSum: 0 };
      strength.chatCount += 1;
      strength.rankSum += place;
      strengths.set(topic, strength);
    });
  }
  return [...strengths.entries()]
    .sort(
      ([leftTopic, left], [rightTopic, right]) =>
        right.chatCount - left.chatCount ||
        left.rankSum - right.rankSum ||
        (leftTopic < rightTopic ? -1 : 1),
    )
    .map(([topic]) => topic);
}

/**
 * The number of chats that have each topic, for the title of each button of the dynamic topic bar.
 * @param topicsByChat - the topics of each chat that the list shows
 * @returns for each topic, the number of chats that have it
 */
export function dynamicTopicChatCounts(topicsByChat: Map<string, string[]>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const topics of topicsByChat.values()) {
    for (const topic of new Set(topics)) {
      counts.set(topic, (counts.get(topic) ?? 0) + 1);
    }
  }
  return counts;
}

/** The fewest chats in the list for which a topic that most chats have is hidden. A short list has too few chats to judge. */
export const FEWEST_CHATS_TO_HIDE_COMMON_TOPICS = 6;

/**
 * The topics of each chat without the topics that more than half of the chats have. Such a topic cannot separate the
 * chats, so it does not help the developer to find a chat (issue 270). A list of fewer than
 * `FEWEST_CHATS_TO_HIDE_COMMON_TOPICS` chats keeps every topic.
 * @param topicsByChat - the topics of each chat that the list shows
 * @returns the topics of each chat, in the same order, without the common topics
 */
export function withoutCommonTopics(topicsByChat: Map<string, string[]>): Map<string, string[]> {
  if (topicsByChat.size < FEWEST_CHATS_TO_HIDE_COMMON_TOPICS) {
    return topicsByChat;
  }
  const counts = dynamicTopicChatCounts(topicsByChat);
  const result = new Map<string, string[]>();
  for (const [id, topics] of topicsByChat) {
    result.set(id, topics.filter((topic) => (counts.get(topic) ?? 0) * 2 <= topicsByChat.size));
  }
  return result;
}

/** A number kept between a lowest and a highest value. */
function clamp(value: number, lowest: number, highest: number): number {
  return Math.min(Math.max(value, lowest), highest);
}

/**
 * Where the strip scrolls so that one button is fully visible, with no arrow over it. The button is left where it is when it
 * is already fully visible.
 * @param chip - the place of the button
 * @param scrollLeft - how far the strip is scrolled now
 * @param viewWidth - the visible width of the strip
 * @param scrollWidth - the full width of the strip
 * @returns the new `scrollLeft`, the same as now when the button is already fully visible
 */
export function scrollLeftToShow(chip: TopicChipBox, scrollLeft: number, viewWidth: number, scrollWidth: number): number {
  const highest = Math.max(0, scrollWidth - viewWidth);
  const leftLimit = scrollLeft + (scrollLeft > 0 ? ARROW_ZONE : 0);
  const rightLimit = scrollLeft + viewWidth - (scrollLeft < highest ? ARROW_ZONE : 0);
  if (chip.left < leftLimit) {
    return clamp(chip.left - ARROW_ZONE, 0, highest);
  }
  if (chip.right > rightLimit) {
    return clamp(chip.right + ARROW_ZONE - viewWidth, 0, highest);
  }
  return scrollLeft;
}

/**
 * Where the strip scrolls after a click on the arrow at its end: the first button that is not fully visible, and the two
 * after it, come into view. The last button comes flush with the end of the strip, because no arrow covers it then.
 * @param chips - the place of each button, in the order of the strip
 * @param scrollLeft - how far the strip is scrolled now
 * @param viewWidth - the visible width of the strip
 * @param scrollWidth - the full width of the strip
 * @returns the new `scrollLeft`, the same as now when every button is already visible
 */
export function nextTopicsScrollLeft(
  chips: TopicChipBox[],
  scrollLeft: number,
  viewWidth: number,
  scrollWidth: number,
): number {
  const highest = Math.max(0, scrollWidth - viewWidth);
  const rightLimit = scrollLeft + viewWidth - ARROW_ZONE;
  const hiddenIndex = chips.findIndex((chip) => chip.right > rightLimit);
  if (hiddenIndex === -1) {
    return clamp(scrollLeft, 0, highest);
  }
  const lastIndex = chips.length - 1;
  const targetIndex = Math.min(hiddenIndex + TOPICS_PER_CLICK - 1, lastIndex);
  const zone = targetIndex === lastIndex ? 0 : ARROW_ZONE;
  return clamp(chips[targetIndex].right + zone - viewWidth, 0, highest);
}

/**
 * Where the strip scrolls after a click on the arrow at its start: the last button that is not fully visible, and the two
 * before it, come into view. The first button comes flush with the start of the strip, because no arrow covers it then.
 * @param chips - the place of each button, in the order of the strip
 * @param scrollLeft - how far the strip is scrolled now
 * @param viewWidth - the visible width of the strip
 * @param scrollWidth - the full width of the strip
 * @returns the new `scrollLeft`, the same as now when every button is already visible
 */
export function previousTopicsScrollLeft(
  chips: TopicChipBox[],
  scrollLeft: number,
  viewWidth: number,
  scrollWidth: number,
): number {
  const highest = Math.max(0, scrollWidth - viewWidth);
  const leftLimit = scrollLeft + ARROW_ZONE;
  let hiddenIndex = -1;
  for (let index = 0; index < chips.length && chips[index].left < leftLimit; index += 1) {
    hiddenIndex = index;
  }
  if (hiddenIndex === -1) {
    return clamp(scrollLeft, 0, highest);
  }
  const targetIndex = Math.max(hiddenIndex - (TOPICS_PER_CLICK - 1), 0);
  const zone = targetIndex === 0 ? 0 : ARROW_ZONE;
  return clamp(chips[targetIndex].left - zone, 0, highest);
}
