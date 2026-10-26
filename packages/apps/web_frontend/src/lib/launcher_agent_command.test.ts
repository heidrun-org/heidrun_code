// @vitest-environment node
import { describe, expect, it } from "vitest";
import { launcherAgentCommand, shellQuote } from "./launcher_agent_command";

describe("shellQuote", () => {
  it("puts the text in single quotes and protects a single quote inside", () => {
    expect(shellQuote("it's here")).toBe(`'it'\\''s here'`);
  });
});

describe("launcherAgentCommand", () => {
  it("starts claude with the prompt only", () => {
    expect(launcherAgentCommand({ name: "claude", prompt: " Review the last commit. " })).toBe("claude 'Review the last commit.'");
  });

  it("starts claude with the model and the effort", () => {
    expect(launcherAgentCommand({ name: "claude", model: "opus", effort: "high", prompt: "Hi" })).toBe(
      "claude --model 'opus' --effort 'high' 'Hi'",
    );
  });

  it("starts codex with the model and the effort", () => {
    expect(launcherAgentCommand({ name: "codex", model: "gpt-6-luna", effort: "low", prompt: "Hi" })).toBe(
      `codex -m 'gpt-6-luna' -c 'model_reasoning_effort="low"' 'Hi'`,
    );
  });

  it("starts agy with the option -i before the prompt, so that the session stays interactive", () => {
    expect(launcherAgentCommand({ name: "agy", prompt: " Review the last commit. " })).toBe("agy -i 'Review the last commit.'");
  });

  it("starts agy with the model and the effort before the option -i", () => {
    expect(launcherAgentCommand({ name: "agy", model: "claude-sonnet-4-6", effort: "high", prompt: "Hi" })).toBe(
      "agy --model 'claude-sonnet-4-6' --effort 'high' -i 'Hi'",
    );
  });

  it("keeps the lines of a prompt of several lines inside one word", () => {
    expect(launcherAgentCommand({ name: "codex", prompt: "a\nb" })).toBe("codex 'a\nb'");
  });
});
