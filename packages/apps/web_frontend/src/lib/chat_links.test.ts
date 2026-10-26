// @vitest-environment node
import { describe, expect, it } from "vitest";
import { chatAppUrl, chatResumeCommand } from "./chat_links";

const ID = "01a03a5e-a361-7ab2-af03-62ea1a76ce4b";

describe("chatAppUrl", () => {
  it("opens a chat of Claude with claude://code and a chat of Codex with codex://threads", () => {
    expect(chatAppUrl("claude", ID)).toBe(`claude://code/${ID}`);
    expect(chatAppUrl("codex", ID)).toBe(`codex://threads/${ID}`);
  });

  it("encodes an identifier that has a character of an address", () => {
    expect(chatAppUrl("claude", "a/b c")).toBe("claude://code/a%2Fb%20c");
  });
});

describe("chatResumeCommand", () => {
  it("resumes a chat of Claude with --resume and a chat of Codex with the command resume", () => {
    expect(chatResumeCommand("claude", ID)).toBe(`claude --resume '${ID}'`);
    expect(chatResumeCommand("codex", ID)).toBe(`codex resume '${ID}'`);
  });

  it("gives null for an identifier that a shell could read as something else", () => {
    expect(chatResumeCommand("claude", "x'; rm -rf ~; '")).toBeNull();
    expect(chatResumeCommand("codex", "a b")).toBeNull();
    expect(chatResumeCommand("claude", "")).toBeNull();
  });
});
