// @vitest-environment node
import { describe, expect, it } from "vitest";
import { claudeObserverCommandFor, codexResumeCommandFor, launcherAgentCommand, shellQuote } from "./launcher_agent_command";

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

const CHAT_ID = "01a18b90-ca10-7083-b5e0-1bd76b17f8d8";

describe("codexResumeCommandFor", () => {
  it("starts the prepared chat of a plain codex", () => {
    expect(codexResumeCommandFor("codex", CHAT_ID)).toBe(`codex resume '${CHAT_ID}'`);
  });

  it("keeps the model, the effort, and the prompt after the chat identifier", () => {
    const command = launcherAgentCommand({ name: "codex", model: "gpt-6-luna", effort: "low", prompt: "Hi" });
    expect(codexResumeCommandFor(command, CHAT_ID)).toBe(
      `codex resume '${CHAT_ID}' -m 'gpt-6-luna' -c 'model_reasoning_effort="low"' 'Hi'`,
    );
    expect(codexResumeCommandFor("codex 'Hi'", CHAT_ID)).toBe(`codex resume '${CHAT_ID}' 'Hi'`);
  });

  it("changes no subcommand, no other coding agent, and refuses an identifier that a shell could misread", () => {
    expect(codexResumeCommandFor(`codex resume '${CHAT_ID}'`, CHAT_ID)).toBeNull();
    expect(codexResumeCommandFor("codex exec 'Hi'", CHAT_ID)).toBeNull();
    expect(codexResumeCommandFor("claude", CHAT_ID)).toBeNull();
    expect(codexResumeCommandFor("codex", "x'; rm -rf ~")).toBeNull();
  });
});

describe("claudeObserverCommandFor", () => {
  const MOD = "/Users/me/.config/heidrun_code/heidrun_code_dashboard_claude_observer";
  const FOLDER = "/Users/me/.config/heidrun_code/heidrun_code_dashboard_claude_observations";

  it("adds the observation folder and the mod to a plain claude", () => {
    expect(claudeObserverCommandFor("claude", MOD, FOLDER)).toBe(
      `HEIDRUN_CODE_DASHBOARD_OBSERVATION_DIR='${FOLDER}' claude --plugin-dir '${MOD}'`,
    );
  });

  it("keeps the other arguments: the agent, the model, the resume identifier, and the prompt", () => {
    expect(claudeObserverCommandFor("claude --agent 'a' --model 'opus'", MOD, FOLDER)).toBe(
      `HEIDRUN_CODE_DASHBOARD_OBSERVATION_DIR='${FOLDER}' claude --plugin-dir '${MOD}' --agent 'a' --model 'opus'`,
    );
    expect(claudeObserverCommandFor(`claude --resume '${CHAT_ID}'`, MOD, FOLDER)).toBe(
      `HEIDRUN_CODE_DASHBOARD_OBSERVATION_DIR='${FOLDER}' claude --plugin-dir '${MOD}' --resume '${CHAT_ID}'`,
    );
    expect(claudeObserverCommandFor("claude 'Hi'", MOD, FOLDER)).toBe(
      `HEIDRUN_CODE_DASHBOARD_OBSERVATION_DIR='${FOLDER}' claude --plugin-dir '${MOD}' 'Hi'`,
    );
  });

  it("quotes a folder with a space and changes no subcommand and no other coding agent", () => {
    expect(claudeObserverCommandFor("claude", "/a b/mod", "/a b/obs")).toBe(
      `HEIDRUN_CODE_DASHBOARD_OBSERVATION_DIR='/a b/obs' claude --plugin-dir '/a b/mod'`,
    );
    expect(claudeObserverCommandFor("claude mcp list", MOD, FOLDER)).toBeNull();
    expect(claudeObserverCommandFor("codex", MOD, FOLDER)).toBeNull();
  });
});
