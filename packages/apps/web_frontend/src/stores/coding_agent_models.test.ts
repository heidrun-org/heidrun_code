// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

import { codingAgentModels, isLoadingModels, loadCodingAgentModels, modelsOf } from "./coding_agent_models";
import { findCodingAgent } from "../lib/coding_agents";

const catalog = JSON.stringify({
  models: [
    { slug: "new-model", display_name: "New Model", visibility: "list", supported_reasoning_levels: [{ effort: "low" }] },
    { slug: "old-model", display_name: "Old Model", visibility: "hide", supported_reasoning_levels: [{ effort: "low" }] },
  ],
});

beforeEach(() => {
  invokeMock.mockReset();
  codingAgentModels.byAgent = {};
  codingAgentModels.loading = {};
});

describe("modelsOf", () => {
  it("gives the fixed list of the coding agent until the tool has answered", () => {
    expect(modelsOf("codex")).toBe(findCodingAgent("codex")?.models);
  });

  it("gives an empty list for an unknown coding agent", () => {
    expect(modelsOf("unknown")).toEqual([]);
  });
});

describe("loadCodingAgentModels", () => {
  it("runs the command of the tool and keeps the models that it lists", async () => {
    invokeMock.mockResolvedValue(catalog);
    const loading = loadCodingAgentModels("codex");
    expect(isLoadingModels("codex")).toBe(true);
    await loading;
    expect(invokeMock).toHaveBeenCalledWith("coding_agent_models_run", { executable: "codex", arguments: ["debug", "models"] });
    expect(modelsOf("codex")).toEqual([{ id: "new-model", label: "New Model", efforts: ["low"] }]);
    expect(isLoadingModels("codex")).toBe(false);
  });

  it("keeps the fixed list when the command fails", async () => {
    invokeMock.mockRejectedValue("codex : not signed in");
    await loadCodingAgentModels("codex");
    expect(modelsOf("codex")).toBe(findCodingAgent("codex")?.models);
    expect(isLoadingModels("codex")).toBe(false);
  });

  it("keeps the fixed list when the output is not the catalog, or lists no model", async () => {
    invokeMock.mockResolvedValue("not json");
    await loadCodingAgentModels("codex");
    expect(modelsOf("codex")).toBe(findCodingAgent("codex")?.models);
    invokeMock.mockResolvedValue(`{"models":[]}`);
    await loadCodingAgentModels("codex");
    expect(modelsOf("codex")).toBe(findCodingAgent("codex")?.models);
  });

  it("does not run a command for a coding agent whose tool cannot list its models", async () => {
    await loadCodingAgentModels("claude");
    expect(invokeMock).not.toHaveBeenCalled();
    expect(modelsOf("claude")).toBe(findCodingAgent("claude")?.models);
  });
});
