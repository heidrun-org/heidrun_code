import { beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import { invoke } from "@tauri-apps/api/core";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

/** What the fake Rust side keeps and answers in a test. */
type Backend = {
  /** The translation table that the file on the disk holds. */
  rows: Record<string, string>;
  /** The tables that the command `topic_clusters_write` received, in order. */
  written: Record<string, string>[];
  /** The prompts that the command `coding_agent_ask` received, in order. */
  prompts: string[];
};

/**
 * Makes the Tauri commands of the clusters answer.
 * @param rows - the translation table that the disk holds at the start
 * @param ask - what the coding agent answers to a prompt: its text, or a failure
 */
function installBackend(rows: Record<string, string>, ask: (prompt: string) => Promise<string>): Backend {
  const backend: Backend = { rows: { ...rows }, written: [], prompts: [] };
  vi.mocked(invoke).mockImplementation(async (command, args) => {
    if (command === "topic_clusters_read") {
      return { ...backend.rows };
    }
    if (command === "topic_clusters_write") {
      backend.rows = { ...(args as { rows: Record<string, string> }).rows };
      backend.written.push({ ...backend.rows });
      return null;
    }
    if (command === "coding_agent_ask") {
      const prompt = (args as { prompt: string }).prompt;
      backend.prompts.push(prompt);
      return { agent: "codex", text: await ask(prompt) };
    }
    throw new Error(`not mocked: ${String(command)}`);
  });
  return backend;
}

/** The answer of a coding agent that puts each new label in the cluster that `clusterOf` gives. */
function answerWith(clusterOf: (topic: string) => string): (prompt: string) => Promise<string> {
  return async (prompt) => {
    const line = prompt.split("\n").find((candidate) => candidate.startsWith("New labels: ")) ?? "New labels: []";
    const topics = JSON.parse(line.slice("New labels: ".length)) as string[];
    return JSON.stringify(topics.map((topic) => ({ topic, cluster: clusterOf(topic) })));
  };
}

/** How many times the Tauri command `name` ran. */
function callsOf(name: string): number {
  return vi.mocked(invoke).mock.calls.filter(([command]) => command === name).length;
}

/** The stores, as a new run of Heidrun Code sees them: the modules are loaded again. */
async function startRun(isClusteredOn: boolean) {
  vi.resetModules();
  const { settings } = await import("./settings");
  settings.clusteredDynamicTopics = isClusteredOn;
  const clusters = await import("./topic_clusters");
  return { settings, ...clusters };
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(invoke).mockReset();
});

describe("prepareTopicClusters", () => {
  it("makes no call, and reads nothing, when the option is off", async () => {
    installBackend({}, answerWith((topic) => topic));
    const { prepareTopicClusters, topicClusterTable } = await startRun(false);
    await prepareTopicClusters(["panel", "tab"]);
    for (const command of ["topic_clusters_read", "topic_clusters_write", "coding_agent_ask"]) {
      expect(callsOf(command)).toBe(0);
    }
    expect(topicClusterTable.value.size).toBe(0);
  });

  it("makes no call, and reads nothing, when the option Dynamic topics is off, even when the option Clustered dynamic topics is on", async () => {
    installBackend({}, answerWith((topic) => topic));
    const { settings, prepareTopicClusters, topicClusterTable } = await startRun(true);
    settings.dynamicTopics = false;
    await prepareTopicClusters(["panel", "tab"]);
    for (const command of ["topic_clusters_read", "topic_clusters_write", "coding_agent_ask"]) {
      expect(callsOf(command)).toBe(0);
    }
    expect(topicClusterTable.value.size).toBe(0);
  });

  it("makes one single call for all the new raw dynamic topics, and saves the answer on the disk", async () => {
    const backend = installBackend({}, answerWith((topic) => (topic === "tab" ? "tab" : "sidebar")));
    const { prepareTopicClusters, topicClusterTable, topicClusterStatus } = await startRun(true);
    await prepareTopicClusters(["tab", "panel", "side bar", "tab"]);
    expect(callsOf("coding_agent_ask")).toBe(1);
    expect(backend.prompts[0]).toContain('New labels: ["panel","side bar","tab"]');
    expect(backend.prompts[0]).toContain("Existing clusters: []");
    expect(Object.fromEntries(topicClusterTable.value)).toEqual({ panel: "sidebar", "side bar": "sidebar", tab: "tab" });
    expect(backend.rows).toEqual({ panel: "sidebar", "side bar": "sidebar", tab: "tab" });
    expect(topicClusterStatus.error).toBeNull();
    expect(topicClusterStatus.isRunning).toBe(false);
  });

  it("makes no call when every raw dynamic topic is already in the translation table that the disk holds", async () => {
    installBackend({ panel: "sidebar", tab: "tab" }, answerWith((topic) => topic));
    const { prepareTopicClusters, topicClusterTable } = await startRun(true);
    await prepareTopicClusters(["panel", "tab"]);
    expect(callsOf("coding_agent_ask")).toBe(0);
    expect(callsOf("topic_clusters_write")).toBe(0);
    expect(Object.fromEntries(topicClusterTable.value)).toEqual({ panel: "sidebar", tab: "tab" });
  });

  it("makes no call for a raw dynamic topic that an earlier call already clustered", async () => {
    installBackend({}, answerWith((topic) => topic));
    const { prepareTopicClusters } = await startRun(true);
    await prepareTopicClusters(["panel"]);
    await prepareTopicClusters(["panel"]);
    expect(callsOf("coding_agent_ask")).toBe(1);
  });

  it("asks only about the new raw dynamic topics, and gives the names of the existing clusters in the prompt", async () => {
    const backend = installBackend({ panel: "sidebar" }, answerWith(() => "sidebar"));
    const { prepareTopicClusters } = await startRun(true);
    await prepareTopicClusters(["panel", "right panel"]);
    expect(backend.prompts).toHaveLength(1);
    expect(backend.prompts[0]).toContain('Existing clusters: ["sidebar"]');
    expect(backend.prompts[0]).toContain('New labels: ["right panel"]');
  });

  it("never changes a row that is saved", async () => {
    const backend = installBackend({ panel: "sidebar" }, answerWith(() => "tabs"));
    const { prepareTopicClusters, topicClusterTable } = await startRun(true);
    await prepareTopicClusters(["panel", "tab"]);
    expect(topicClusterTable.value.get("panel")).toBe("sidebar");
    expect(backend.rows.panel).toBe("sidebar");
    expect(backend.rows.tab).toBe("tabs");
  });

  it("saves nothing when the answer is wrong, and does not call again for the same raw dynamic topics", async () => {
    const backend = installBackend({ cache: "cache" }, async () => '[{"topic":"panel","cluster":"sidebar"}]');
    const { prepareTopicClusters, topicClusterTable, topicClusterStatus } = await startRun(true);
    await prepareTopicClusters(["cache", "panel", "tab"]);
    expect(topicClusterStatus.error).toBe("wrongAnswer");
    expect(backend.written).toEqual([]);
    expect(Object.fromEntries(topicClusterTable.value)).toEqual({ cache: "cache" });
    await prepareTopicClusters(["cache", "panel", "tab"]);
    expect(callsOf("coding_agent_ask")).toBe(1);
  });

  it("tries again at the next run of Heidrun Code after a wrong answer, and when the new raw dynamic topics are not the same", async () => {
    const backend = installBackend({}, async () => "I cannot do that");
    const first = await startRun(true);
    await first.prepareTopicClusters(["panel"]);
    await first.prepareTopicClusters(["panel", "tab"]);
    expect(callsOf("coding_agent_ask")).toBe(2);
    expect(backend.written).toEqual([]);
    const second = await startRun(true);
    await second.prepareTopicClusters(["panel"]);
    expect(callsOf("coding_agent_ask")).toBe(3);
  });

  it("saves nothing, and says why, when the coding agent fails", async () => {
    const backend = installBackend({}, async () => {
      throw "codex : not signed in";
    });
    const { prepareTopicClusters, topicClusterStatus, topicClusterTable } = await startRun(true);
    await prepareTopicClusters(["panel"]);
    expect(topicClusterStatus.error).toBe("failed");
    expect(backend.written).toEqual([]);
    expect(topicClusterTable.value.size).toBe(0);
    expect(topicClusterStatus.isRunning).toBe(false);
  });

  it("says that no coding agent exists when neither codex nor claude is installed", async () => {
    installBackend({}, async () => {
      throw "no_coding_agent";
    });
    const { prepareTopicClusters, topicClusterStatus } = await startRun(true);
    await prepareTopicClusters(["panel"]);
    expect(topicClusterStatus.error).toBe("noCodingAgent");
  });

  it("tries again after the developer switches the option off and on", async () => {
    installBackend({}, async () => {
      throw "boom";
    });
    const { prepareTopicClusters, settings, topicClusterStatus } = await startRun(true);
    await prepareTopicClusters(["panel"]);
    await prepareTopicClusters(["panel"]);
    expect(callsOf("coding_agent_ask")).toBe(1);
    settings.clusteredDynamicTopics = false;
    await nextTick();
    settings.clusteredDynamicTopics = true;
    await nextTick();
    expect(topicClusterStatus.error).toBeNull();
    await prepareTopicClusters(["panel"]);
    expect(callsOf("coding_agent_ask")).toBe(2);
  });

  it("makes one run at a time: the topics that come during a call are clustered by one more call after it", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const answers = answerWith((topic) => topic);
    const backend = installBackend({}, async (prompt) => {
      if (backend.prompts.length === 1) {
        await gate;
      }
      return answers(prompt);
    });
    const { prepareTopicClusters, topicClusterStatus, topicClusterTable } = await startRun(true);
    const first = prepareTopicClusters(["panel"]);
    await vi.waitFor(() => expect(backend.prompts).toHaveLength(1));
    expect(topicClusterStatus.isRunning).toBe(true);
    await prepareTopicClusters(["panel", "tab"]);
    expect(backend.prompts).toHaveLength(1);
    release();
    await first;
    expect(backend.prompts).toHaveLength(2);
    expect(backend.prompts[1]).toContain('New labels: ["tab"]');
    expect(Object.fromEntries(topicClusterTable.value)).toEqual({ panel: "panel", tab: "tab" });
  });
});

describe("rebuildTopicClusters", () => {
  it("empties the translation table on the disk, then clusters all the raw dynamic topics again in one call", async () => {
    const backend = installBackend({ panel: "sidebar", tab: "sidebar" }, answerWith(() => "tabs"));
    const { prepareTopicClusters, rebuildTopicClusters, topicClusterTable } = await startRun(true);
    await prepareTopicClusters(["panel", "tab"]);
    expect(callsOf("coding_agent_ask")).toBe(0);
    await rebuildTopicClusters();
    expect(backend.written[0]).toEqual({});
    expect(callsOf("coding_agent_ask")).toBe(1);
    expect(backend.prompts[0]).toContain("Existing clusters: []");
    expect(backend.prompts[0]).toContain('New labels: ["panel","tab"]');
    expect(Object.fromEntries(topicClusterTable.value)).toEqual({ panel: "tabs", tab: "tabs" });
    expect(backend.rows).toEqual({ panel: "tabs", tab: "tabs" });
  });

  it("forgets a failure, so a rebuild tries again", async () => {
    installBackend({}, async () => "nothing useful");
    const { prepareTopicClusters, rebuildTopicClusters, topicClusterStatus } = await startRun(true);
    await prepareTopicClusters(["panel"]);
    expect(topicClusterStatus.error).toBe("wrongAnswer");
    await rebuildTopicClusters();
    expect(callsOf("coding_agent_ask")).toBe(2);
  });

  it("drops the answer of a call that started before the rebuild", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const backend = installBackend({}, async (prompt) => {
      if (backend.prompts.length === 1) {
        await gate;
        return '[{"topic":"panel","cluster":"old cluster"}]';
      }
      return answerWith(() => "new cluster")(prompt);
    });
    const { prepareTopicClusters, rebuildTopicClusters, topicClusterTable } = await startRun(true);
    const first = prepareTopicClusters(["panel"]);
    await vi.waitFor(() => expect(backend.prompts).toHaveLength(1));
    await rebuildTopicClusters();
    release();
    await first;
    await vi.waitFor(() => expect(topicClusterTable.value.get("panel")).toBe("new cluster"));
    expect(backend.rows).toEqual({ panel: "new cluster" });
  });
});
