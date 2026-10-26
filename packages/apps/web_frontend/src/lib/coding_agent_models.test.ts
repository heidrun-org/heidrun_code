// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { effortsOf, readAntigravityModels, readCodexModels, type CodingAgentModel } from "./coding_agent_models";

/** The output of `codex debug models` (codex-cli 0.162.1), without the fields that Heidrun Code does not read. */
const codexOutput = readFileSync(resolve(import.meta.dirname, "codex_debug_models.fixture.json"), "utf8");

describe("readCodexModels", () => {
  it("keeps the models that Codex lists, in its order, and leaves out the hidden models", () => {
    expect(readCodexModels(codexOutput).map((model) => model.id)).toEqual([
      "gpt-6.1-sol",
      "gpt-6-astra",
      "gpt-6-sol",
      "gpt-6-luna",
      "gpt-5.6-sol",
      "gpt-5.6-terra",
      "gpt-5.6-luna",
    ]);
  });

  it("gives the name that the person reads and the efforts of each model", () => {
    const [sol, , , luna] = readCodexModels(codexOutput);
    expect(sol).toEqual({ id: "gpt-6.1-sol", label: "GPT-6.1-Sol", efforts: ["low", "medium", "high", "xhigh", "max", "ultra"] });
    expect(luna.efforts).toEqual(["low", "medium", "high", "xhigh", "max"]);
  });

  it("throws when the output is not the catalog of Codex", () => {
    expect(() => readCodexModels("not json")).toThrow();
    expect(() => readCodexModels(`{"models":[{"slug":"a"}]}`)).toThrow();
    expect(() => readCodexModels(`[]`)).toThrow();
  });
});

/** What `agy models` (agy 1.3.4) printed on its standard output: the identifier, a tab, the name that the person reads. */
const antigravityOutput = [
  "gemini-3.8-flash-high\tGemini 3.8 Flash (High)",
  "gemini-3.8-flash-medium\tGemini 3.8 Flash (Medium)",
  "claude-opus-4-6-thinking\tClaude Opus 4.6 (Thinking)",
  "",
].join("\n");

describe("readAntigravityModels", () => {
  it("gives the identifier and the name of each model, in the order of Antigravity, without efforts of their own", () => {
    expect(readAntigravityModels(antigravityOutput)).toEqual([
      { id: "gemini-3.8-flash-high", label: "Gemini 3.8 Flash (High)", efforts: [] },
      { id: "gemini-3.8-flash-medium", label: "Gemini 3.8 Flash (Medium)", efforts: [] },
      { id: "claude-opus-4-6-thinking", label: "Claude Opus 4.6 (Thinking)", efforts: [] },
    ]);
  });

  it("leaves out a line without a tab, such as the message of progress", () => {
    const output = `Fetching available models...\n${antigravityOutput}`;
    expect(readAntigravityModels(output).map((model) => model.id)).toEqual([
      "gemini-3.8-flash-high",
      "gemini-3.8-flash-medium",
      "claude-opus-4-6-thinking",
    ]);
  });

  it("throws when no line of the output holds a model", () => {
    expect(() => readAntigravityModels("")).toThrow();
    expect(() => readAntigravityModels("Fetching available models...\n")).toThrow();
  });
});

describe("effortsOf", () => {
  const models: CodingAgentModel[] = [
    { id: "big", label: "Big", efforts: ["low", "high", "ultra"] },
    { id: "small", label: "Small", efforts: ["low", "high"] },
  ];

  it("gives the efforts of the chosen model", () => {
    expect(effortsOf(["fixed"], models, "big")).toEqual(["low", "high", "ultra"]);
  });

  it("gives the efforts that every model accepts for the default model", () => {
    expect(effortsOf(["fixed"], models, "")).toEqual(["low", "high"]);
  });

  it("gives the efforts of the coding agent when a model lists no effort, or the model is unknown", () => {
    expect(effortsOf(["fixed"], [{ id: "plain", label: "Plain", efforts: [] }], "plain")).toEqual(["fixed"]);
    expect(effortsOf(["fixed"], [{ id: "plain", label: "Plain", efforts: [] }], "")).toEqual(["fixed"]);
    expect(effortsOf(["fixed"], models, "unknown")).toEqual(["fixed"]);
    expect(effortsOf(["fixed"], [], "")).toEqual(["fixed"]);
  });

  it("gives the efforts of the coding agent when no effort is common to all the models", () => {
    const apart: CodingAgentModel[] = [
      { id: "a", label: "A", efforts: ["low"] },
      { id: "b", label: "B", efforts: ["high"] },
    ];
    expect(effortsOf(["fixed"], apart, "")).toEqual(["fixed"]);
  });
});
