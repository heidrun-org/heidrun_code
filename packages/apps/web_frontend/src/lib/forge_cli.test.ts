// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => "[]") }));

import { invoke } from "@tauri-apps/api/core";
import { runForgeCli } from "./forge_cli";

describe("runForgeCli", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockClear();
  });

  it("goes through the cache, and keeps an answer for ten minutes by default", async () => {
    await expect(runForgeCli("code_hosting_list", "/work/app", "gh", ["pr", "list"])).resolves.toBe("[]");
    expect(invoke).toHaveBeenCalledWith("forge_cli_cached", {
      cwd: "/work/app",
      tool: "gh",
      args: ["pr", "list"],
      refresh: false,
      keepUntilRefresh: false,
      caller: "code_hosting_list",
    });
  });

  it("gives the refresh and the keep until refresh to the cache", async () => {
    await runForgeCli("issue_preview", "/work/app", "glab", ["api", "user"], {
      isRefresh: true,
      isKeptUntilRefresh: true,
    });
    expect(vi.mocked(invoke).mock.lastCall?.[1]).toMatchObject({
      refresh: true,
      keepUntilRefresh: true,
    });
  });
});
