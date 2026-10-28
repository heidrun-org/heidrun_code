// @vitest-environment node
import { describe, expect, it } from "vitest";
import { CODING_AGENTS, CODING_AGENT_IDS, CUSTOM_LAUNCHER_CODING_AGENTS, CUSTOM_LAUNCHER_CODING_AGENT_IDS, findCodingAgent } from "./coding_agents";
import { launcherAgentCommand } from "./launcher_agent_command";

describe("CODING_AGENTS", () => {
  it("gives each coding agent a different identifier, and an executable", () => {
    expect(new Set(CODING_AGENT_IDS).size).toBe(CODING_AGENTS.length);
    for (const agent of CODING_AGENTS) {
      expect(agent.executable).not.toBe("");
    }
  });

  it("starts the command line of each coding agent with its executable", () => {
    for (const agent of CODING_AGENTS) {
      expect(launcherAgentCommand({ name: agent.id, prompt: "Hi" })).toMatch(new RegExp(`^${agent.executable} `));
    }
  });

  it("builds the command line of each coding agent with each of its models and each of its efforts", () => {
    for (const agent of CODING_AGENTS) {
      for (const model of agent.models) {
        expect(launcherAgentCommand({ name: agent.id, model: model.id, prompt: "Hi" })).toContain(`'${model.id}'`);
      }
      for (const effort of agent.efforts) {
        expect(launcherAgentCommand({ name: agent.id, effort, prompt: "Hi" })).toContain(effort);
      }
    }
  });
});

describe("the models of the coding agents", () => {
  it("gives each coding agent a different identifier for each fixed model, and no effort that the tool does not accept", () => {
    for (const agent of CODING_AGENTS) {
      expect(new Set(agent.models.map((model) => model.id)).size).toBe(agent.models.length);
      expect(agent.efforts).not.toContain("minimal");
    }
  });

  it("reads the models of Codex from the command codex debug models", () => {
    const codex = findCodingAgent("codex");
    expect(codex?.modelsFromTool?.arguments).toEqual(["debug", "models"]);
  });

  it("reads the models of Antigravity from the command agy models", () => {
    const antigravity = findCodingAgent("agy");
    expect(antigravity?.modelsFromTool?.arguments).toEqual(["models"]);
  });
});

describe("the coding agent Antigravity", () => {
  it("runs the executable agy, and starts interactive with a prompt", () => {
    const antigravity = findCodingAgent("agy");
    expect(antigravity?.executable).toBe("agy");
    expect(antigravity?.canStartInteractiveWithPrompt).toBe(true);
    expect(CUSTOM_LAUNCHER_CODING_AGENT_IDS).toContain("agy");
  });
});

describe("CUSTOM_LAUNCHER_CODING_AGENTS", () => {
  it("keeps only the coding agents that start interactive with a prompt", () => {
    expect(CUSTOM_LAUNCHER_CODING_AGENTS.every((agent) => agent.canStartInteractiveWithPrompt)).toBe(true);
    expect(CUSTOM_LAUNCHER_CODING_AGENT_IDS).toEqual(CUSTOM_LAUNCHER_CODING_AGENTS.map((agent) => agent.id));
  });

  it("is not empty, so that the window always has a default coding agent", () => {
    expect(CUSTOM_LAUNCHER_CODING_AGENTS.length).toBeGreaterThan(0);
  });
});

describe("findCodingAgent", () => {
  it("finds a coding agent by its identifier, and gives undefined for an unknown identifier", () => {
    expect(findCodingAgent("claude")?.executable).toBe("claude");
    expect(findCodingAgent("unknown")).toBeUndefined();
  });
});
