// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  ARROW_ZONE,
  dynamicTopicBarTopics,
  dynamicTopicChatCounts,
  nextTopicsScrollLeft,
  previousTopicsScrollLeft,
  scrollLeftToShow,
  TOPICS_PER_CLICK,
  type TopicChipBox,
} from "./dynamic_topic_bar";

/** Ten buttons of 80 pixels, with a gap of 8 pixels between two buttons, in a strip of 700 pixels. */
function tenChips(): TopicChipBox[] {
  return Array.from({ length: 10 }, (_unused, index) => ({ left: index * 88, right: index * 88 + 80 }));
}

/** The width of the strip that holds `tenChips()`. */
const SCROLL_WIDTH = 872;

/** The visible width of the strip in the tests of the scroll. */
const VIEW_WIDTH = 400;

describe("dynamicTopicBarTopics", () => {
  it("puts the topic that more chats have first", () => {
    const topics = dynamicTopicBarTopics(
      new Map([
        ["a", ["solo", "shared"]],
        ["b", ["shared", "other"]],
      ]),
    );
    expect(topics[0]).toBe("shared");
  });

  it("puts the topic that the chats rank higher first when the number of chats is the same", () => {
    const topics = dynamicTopicBarTopics(
      new Map([
        ["a", ["first", "second"]],
        ["b", ["second", "first"]],
        ["c", ["third"]],
      ]),
    );
    expect(topics).toEqual(["first", "second", "third"]);
  });

  it("orders a topic that has the same number of chats and the same ranks by the alphabet", () => {
    const topics = dynamicTopicBarTopics(
      new Map([
        ["a", ["zebra"]],
        ["b", ["apple"]],
      ]),
    );
    expect(topics).toEqual(["apple", "zebra"]);
  });

  it("gives each topic once, and gives nothing for no chat", () => {
    expect(dynamicTopicBarTopics(new Map([["a", ["x"]], ["b", ["x"]]]))).toEqual(["x"]);
    expect(dynamicTopicBarTopics(new Map())).toEqual([]);
  });
});

describe("dynamicTopicChatCounts", () => {
  it("counts the chats that have each topic", () => {
    const counts = dynamicTopicChatCounts(
      new Map([
        ["a", ["shared", "solo"]],
        ["b", ["shared"]],
        ["c", ["shared", "other"]],
      ]),
    );
    expect([...counts.entries()]).toEqual([
      ["shared", 3],
      ["solo", 1],
      ["other", 1],
    ]);
  });

  it("counts a chat once for a topic, and gives nothing for no chat", () => {
    expect(dynamicTopicChatCounts(new Map([["a", ["x", "x"]]])).get("x")).toBe(1);
    expect(dynamicTopicChatCounts(new Map()).size).toBe(0);
  });
});

describe("scrollLeftToShow", () => {
  it("does not move when the button is fully visible", () => {
    expect(scrollLeftToShow(tenChips()[2], 0, VIEW_WIDTH, SCROLL_WIDTH)).toBe(0);
    expect(scrollLeftToShow(tenChips()[6], 400, VIEW_WIDTH, SCROLL_WIDTH)).toBe(400);
  });

  it("moves so that a button after the strip comes into view, with room for the arrow after it", () => {
    const chips = tenChips();
    expect(scrollLeftToShow(chips[5], 0, VIEW_WIDTH, SCROLL_WIDTH)).toBe(chips[5].right + ARROW_ZONE - VIEW_WIDTH);
  });

  it("moves so that a button before the strip comes into view, with room for the arrow before it", () => {
    const chips = tenChips();
    expect(scrollLeftToShow(chips[3], 400, VIEW_WIDTH, SCROLL_WIDTH)).toBe(chips[3].left - ARROW_ZONE);
  });

  it("puts the first button flush with the start and the last button flush with the end of the strip", () => {
    const chips = tenChips();
    expect(scrollLeftToShow(chips[0], 300, VIEW_WIDTH, SCROLL_WIDTH)).toBe(0);
    expect(scrollLeftToShow(chips[9], 0, VIEW_WIDTH, SCROLL_WIDTH)).toBe(SCROLL_WIDTH - VIEW_WIDTH);
  });

  it("moves a button that hides under an arrow, even though it is inside the strip", () => {
    const chips = tenChips();
    expect(scrollLeftToShow(chips[4], 330, VIEW_WIDTH, SCROLL_WIDTH)).toBe(chips[4].left - ARROW_ZONE);
  });
});

describe("nextTopicsScrollLeft", () => {
  it(`brings the first hidden button and the next ${TOPICS_PER_CLICK - 1} into view, with room for the arrow after them`, () => {
    const chips = tenChips();
    // The strip shows up to 356 pixels (400 minus the arrow): the buttons 0 to 3 end at 80, 168, 256, 344. The button 4 ends at 432.
    const scrollLeft = nextTopicsScrollLeft(chips, 0, VIEW_WIDTH, SCROLL_WIDTH);
    expect(scrollLeft).toBe(chips[6].right + ARROW_ZONE - VIEW_WIDTH);
    expect(scrollLeft + VIEW_WIDTH - ARROW_ZONE).toBeGreaterThanOrEqual(chips[6].right);
  });

  it("shows three new buttons at each click, and the last button flush with the end of the strip", () => {
    const chips = tenChips();
    let scrollLeft = 0;
    const lastFullyVisible: number[] = [];
    for (let click = 0; click < 3; click += 1) {
      scrollLeft = nextTopicsScrollLeft(chips, scrollLeft, VIEW_WIDTH, SCROLL_WIDTH);
      const limit = scrollLeft + VIEW_WIDTH - (scrollLeft >= SCROLL_WIDTH - VIEW_WIDTH ? 0 : ARROW_ZONE);
      lastFullyVisible.push(chips.filter((chip) => chip.right <= limit).length - 1);
    }
    expect(lastFullyVisible).toEqual([6, 9, 9]);
    expect(scrollLeft).toBe(SCROLL_WIDTH - VIEW_WIDTH);
  });

  it("does not move when every button is already visible", () => {
    expect(nextTopicsScrollLeft(tenChips().slice(0, 3), 0, VIEW_WIDTH, 256)).toBe(0);
  });

  it("never goes past the end of the strip", () => {
    expect(nextTopicsScrollLeft(tenChips(), SCROLL_WIDTH - VIEW_WIDTH, VIEW_WIDTH, SCROLL_WIDTH)).toBe(
      SCROLL_WIDTH - VIEW_WIDTH,
    );
  });
});

describe("previousTopicsScrollLeft", () => {
  it("brings the last hidden button and the two before it into view, with room for the arrow before them", () => {
    const chips = tenChips();
    const scrollLeft = previousTopicsScrollLeft(chips, 400, VIEW_WIDTH, SCROLL_WIDTH);
    // At 400 pixels the buttons 0 to 4 start before 444 (400 plus the arrow): the button 4 starts at 352, and the button 5 starts at 440.
    expect(scrollLeft).toBe(chips[3].left - ARROW_ZONE);
  });

  it("goes back to the start with the first button flush with the start of the strip", () => {
    const chips = tenChips();
    let scrollLeft = SCROLL_WIDTH - VIEW_WIDTH;
    for (let click = 0; click < 4; click += 1) {
      scrollLeft = previousTopicsScrollLeft(chips, scrollLeft, VIEW_WIDTH, SCROLL_WIDTH);
    }
    expect(scrollLeft).toBe(0);
  });

  it("never goes before the start of the strip", () => {
    expect(previousTopicsScrollLeft(tenChips(), 0, VIEW_WIDTH, SCROLL_WIDTH)).toBe(0);
  });
});
