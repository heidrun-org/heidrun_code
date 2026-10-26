// @vitest-environment node
import { describe, expect, it } from "vitest";
import { chatWorktrees, listedWorktrees, worktreeOfPath, worktreesText } from "./chat_worktrees";

describe("worktreeOfPath", () => {
  it("reads the name and the folder of a worktree of Claude from a folder", () => {
    expect(worktreeOfPath("/work/app/.claude/worktrees/fix-tab-35")).toEqual({
      name: "fix-tab-35",
      folder: "/work/app/.claude/worktrees/fix-tab-35",
    });
  });

  it("reads the same worktree from a file or a sub folder inside it", () => {
    expect(worktreeOfPath("/work/app/.claude/worktrees/fix-tab-35/src/a.ts")?.folder).toBe(
      "/work/app/.claude/worktrees/fix-tab-35",
    );
  });

  it("reads a worktree of Codex with the folder of the repository after the name", () => {
    expect(worktreeOfPath("/Users/jerome/.codex/worktrees/c41f/teamwright/packages/core/a.ts")).toEqual({
      name: "c41f",
      folder: "/Users/jerome/.codex/worktrees/c41f/teamwright",
    });
  });

  it("keeps a name of four letters and digits as it is", () => {
    expect(worktreeOfPath("/Users/jerome/.codex/worktrees/860f/webai-at-home")?.name).toBe("860f");
  });

  it("reads the first folder as the name when the name has a slash", () => {
    expect(worktreeOfPath("/work/app/.claude/worktrees/codex/documentation-experiment-375/a.md")?.name).toBe("codex");
  });

  it("finds nothing in the main checkout or in a folder of the scratchpad", () => {
    expect(worktreeOfPath("/work/app/src/a.ts")).toBeNull();
    expect(worktreeOfPath("/private/tmp/claude-501/-work-app--claude-worktrees-fix/scratchpad")).toBeNull();
  });

  it("finds nothing when no name follows the marker", () => {
    expect(worktreeOfPath("/work/app/.claude/worktrees/")).toBeNull();
    expect(worktreeOfPath("/work/app/.claude/worktrees")).toBeNull();
  });
});

describe("chatWorktrees", () => {
  it("gives each name once, from the folders first, then from the written files", () => {
    const folders = ["/work/app", "/work/app/.claude/worktrees/one", "/work/app/.claude/worktrees/one/sub"];
    const paths = ["/work/app/.claude/worktrees/two/a.ts", "/work/app/.claude/worktrees/one/b.ts", "/work/app/c.ts"];
    expect(chatWorktrees(folders, paths).map((worktree) => worktree.name)).toEqual(["one", "two"]);
  });

  it("gives nothing for a chat that ran only in the main checkout", () => {
    expect(chatWorktrees(["/work/app"], ["/work/app/a.ts"])).toEqual([]);
  });

  it("gives the worktrees of both coding agents", () => {
    const folders = ["/work/app/.claude/worktrees/one", "/Users/jerome/.codex/worktrees/c41f/app"];
    expect(chatWorktrees(folders, []).map((worktree) => worktree.name)).toEqual(["one", "c41f"]);
  });
});

describe("worktreesText", () => {
  const names = ["a", "b", "c", "d"].map((name) => ({ name, folder: `/work/.claude/worktrees/${name}` }));

  it("writes one name alone", () => {
    expect(worktreesText(names.slice(0, 1))).toBe("a");
  });

  it("writes two names without a number", () => {
    expect(worktreesText(names.slice(0, 2))).toBe("a, b");
  });

  it("writes the first two names, then how many more there are", () => {
    expect(worktreesText(names)).toBe("a, b, +2");
    expect(listedWorktrees(names).more).toBe(2);
  });

  it("writes nothing when there is no worktree", () => {
    expect(worktreesText([])).toBe("");
  });
});
