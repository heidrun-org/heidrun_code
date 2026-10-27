// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  MOST_CLUSTER_TOPICS,
  clusterNames,
  clusterPrompt,
  clusteredTopics,
  clusteredTopicsByChat,
  newRawTopics,
  parseClusterAnswer,
  rawTopicKey,
  specificClusters,
  type TranslationTable,
} from "./topic_clusters";

describe("rawTopicKey", () => {
  it("writes a raw dynamic topic in lower case, without the spaces at its start and at its end", () => {
    expect(rawTopicKey("  Sidebar ")).toBe("sidebar");
  });
});

describe("newRawTopics", () => {
  it("gives the raw dynamic topics that the translation table does not know, each once, in the alphabetical order", () => {
    const table = new Map([["cache", "cache"]]);
    expect(newRawTopics(["tab", "cache", "Panel", "tab", "panel"], table)).toEqual(["panel", "tab"]);
  });

  it("gives nothing when the translation table knows every raw dynamic topic, and for no topic", () => {
    const table = new Map([["tab", "tab"]]);
    expect(newRawTopics(["tab", "TAB"], table)).toEqual([]);
    expect(newRawTopics([], table)).toEqual([]);
  });

  it("keeps a raw dynamic topic that is only a cluster name, because the table maps raw dynamic topics", () => {
    const table = new Map([["side bar", "sidebar"]]);
    expect(newRawTopics(["sidebar"], table)).toEqual(["sidebar"]);
  });
});

describe("clusterNames", () => {
  it("gives each name of cluster once, in the alphabetical order", () => {
    const table = new Map([
      ["side bar", "sidebar"],
      ["sidebar", "sidebar"],
      ["cache", "cache"],
    ]);
    expect(clusterNames(table)).toEqual(["cache", "sidebar"]);
  });
});

describe("clusterPrompt", () => {
  it("holds the names of the clusters and the new raw dynamic topics, and the format of the answer", () => {
    const prompt = clusterPrompt(["cache", "sidebar"], ["panel", "right panel"]);
    expect(prompt).toContain('Existing clusters: ["cache","sidebar"]');
    expect(prompt).toContain('New labels: ["panel","right panel"]');
    expect(prompt).toContain("at most 5 labels");
    expect(prompt).toContain('{"topic": "<new label>", "cluster": "<name of the cluster>"}');
    expect(prompt).toContain("exactly once");
  });

  it("holds nothing else: no text of a chat", () => {
    const prompt = clusterPrompt([], ["panel"]);
    expect(prompt).toContain("Existing clusters: []");
    expect(prompt.split("\n").filter((line) => line.startsWith("New labels") || line.startsWith("Existing clusters"))).toHaveLength(2);
  });
});

describe("parseClusterAnswer", () => {
  const asked = ["panel", "side bar"];

  it("reads one item for each new raw dynamic topic", () => {
    const answer = '[{"topic":"panel","cluster":"sidebar"},{"topic":"side bar","cluster":"Sidebar"}]';
    expect(parseClusterAnswer(answer, asked)).toEqual(
      new Map([
        ["panel", "sidebar"],
        ["side bar", "sidebar"],
      ]),
    );
  });

  it("reads an answer that has a code fence or a line of text around the array", () => {
    const answer = 'Here it is:\n```json\n[{"topic":"panel","cluster":"sidebar"},{"topic":"side bar","cluster":"sidebar"}]\n```';
    expect(parseClusterAnswer(answer, asked)?.size).toBe(2);
  });

  it("writes a cluster name in lower case, with one space between two words", () => {
    const answer = '[{"topic":"panel","cluster":"  Right   Panel "},{"topic":"side bar","cluster":"x"}]';
    expect(parseClusterAnswer(answer, asked)?.get("panel")).toBe("right panel");
  });

  it.each([
    ["an answer that is not JSON", "no cluster for you"],
    ["a JSON text that is not an array", '{"topic":"panel","cluster":"x"}'],
    ["an array that is broken", '[{"topic":"panel","cluster":"x"},'],
    ["an item that is not an object", '[1, 2]'],
    ["an item without a cluster", '[{"topic":"panel"},{"topic":"side bar","cluster":"x"}]'],
    ["a cluster that is empty", '[{"topic":"panel","cluster":" "},{"topic":"side bar","cluster":"x"}]'],
    ["a cluster of three words", '[{"topic":"panel","cluster":"the right panel"},{"topic":"side bar","cluster":"x"}]'],
    ["a topic that was not asked", '[{"topic":"panel","cluster":"x"},{"topic":"side bar","cluster":"x"},{"topic":"other","cluster":"y"}]'],
    ["a topic twice", '[{"topic":"panel","cluster":"x"},{"topic":"panel","cluster":"y"}]'],
    ["a topic that is missing", '[{"topic":"panel","cluster":"x"}]'],
    ["an empty array", "[]"],
  ])("gives null for %s", (_name, answer) => {
    expect(parseClusterAnswer(answer, asked)).toBeNull();
  });
});

describe("clusterPrompt asks for specific clusters (issue 270)", () => {
  const prompt = clusterPrompt([], ["modal"]);

  it("asks for a cluster name that is one of its labels, and forbids the category names", () => {
    expect(prompt).toContain("The name of a cluster is always one of its labels");
    expect(prompt).toContain('"software"');
    expect(prompt).toContain('"interface"');
  });

  it("limits the size of a cluster, and lets a label stay alone", () => {
    expect(prompt).toContain(`at most ${MOST_CLUSTER_TOPICS} labels`);
    expect(prompt).toContain("its cluster name is the label itself");
  });
});

describe("specificClusters", () => {
  it("keeps a cluster named after one of its new raw dynamic topics, or after an existing cluster", () => {
    const table: TranslationTable = new Map([["dialog", "modal"]]);
    const clusters = new Map([
      ["resize", "resize"],
      ["resized", "resize"],
      ["popup", "modal"],
    ]);
    expect(specificClusters(clusters, table)).toEqual(clusters);
  });

  it("makes each raw dynamic topic its own cluster when the answer invents a category name", () => {
    // The ten biggest clusters of issue 270 had invented names such as "interface", "dimensions", and "media".
    const clusters = new Map([
      ["dropdown", "interface"],
      ["modal", "interface"],
      ["color", "dimensions"],
      ["pixel", "dimensions"],
      ["video", "media"],
    ]);
    expect([...specificClusters(clusters, new Map()).entries()]).toEqual([
      ["dropdown", "dropdown"],
      ["modal", "modal"],
      ["color", "color"],
      ["pixel", "pixel"],
      ["video", "video"],
    ]);
  });

  it("never lets a cluster hold more than the most raw dynamic topics, the translation table counted", () => {
    const table: TranslationTable = new Map([
      ["app", "app"],
      ["application", "app"],
      ["apps", "app"],
    ]);
    const clusters = new Map([
      ["applet", "app"],
      ["webapp", "app"],
      ["program", "app"],
    ]);
    const result = specificClusters(clusters, table);
    expect(result.get("applet")).toBe("app");
    expect(result.get("webapp")).toBe("app");
    expect(result.get("program")).toBe("program");
    expect(MOST_CLUSTER_TOPICS).toBe(5);
  });
});

describe("clusteredTopics", () => {
  const table = new Map([
    ["side bar", "sidebar"],
    ["panel", "sidebar"],
    ["cache", "cache"],
  ]);

  it("gives the cluster of each raw dynamic topic, each name once, in the order of the raw dynamic topics", () => {
    expect(clusteredTopics(["panel", "cache", "side bar"], table)).toEqual(["sidebar", "cache"]);
  });

  it("shows a raw dynamic topic that the table does not know as its own cluster", () => {
    expect(clusteredTopics(["panel", "zebra"], table)).toEqual(["sidebar", "zebra"]);
  });

  it("gives nothing for a chat without a topic", () => {
    expect(clusteredTopics([], table)).toEqual([]);
  });
});

describe("clusteredTopicsByChat", () => {
  it("translates the raw dynamic topics of each chat", () => {
    const table = new Map([["panel", "sidebar"]]);
    const result = clusteredTopicsByChat(
      new Map([
        ["a", ["panel", "tab"]],
        ["b", []],
      ]),
      table,
    );
    expect([...result.entries()]).toEqual([
      ["a", ["sidebar", "tab"]],
      ["b", []],
    ]);
  });
});
