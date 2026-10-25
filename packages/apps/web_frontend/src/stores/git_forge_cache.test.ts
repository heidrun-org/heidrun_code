import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import type { RefContext } from "../lib/refs";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("../lib/refs", async (importOriginal) => {
  const original = await importOriginal<typeof import("../lib/refs")>();
  return { ...original, refContext: vi.fn() };
});
vi.mock("./workspace_folders", () => ({ WorkspaceFolders: { get: () => "/work/heidrun" } }));

import { refContext } from "../lib/refs";
import { refreshGit } from "./git";

/** The context of a repository on GitHub. */
const GITHUB_CONTEXT: RefContext = {
  base: "https://github.com/team/app",
  origin: "https://github.com",
  forge: "github",
  ticketUrl: null,
  ticketPrefixes: [],
  enabled: true,
};

/** The payloads of the calls to GitHub, in order. */
function forgePayloads(): { refresh: boolean; keepUntilRefresh: boolean }[] {
  return vi
    .mocked(invoke)
    .mock.calls.filter(([command]) => command !== "git_status")
    .map(([, payload]) => payload as { refresh: boolean; keepUntilRefresh: boolean });
}

describe("the pull requests of the Source control sidebar section (issue #870)", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
    vi.mocked(refContext).mockResolvedValue(GITHUB_CONTEXT);
    vi.mocked(invoke).mockImplementation(async (command: string) => {
      if (command === "git_status") {
        return { root: "/work/heidrun", branch: "main", remote: "origin" };
      }
      return "[]";
    });
  });

  it("names the Source control sidebar section as the caller, for the application log (issue #879)", async () => {
    await refreshGit("w1");
    const callers = vi.mocked(invoke).mock.calls
      .filter(([command]) => command === "forge_cli_cached")
      .map(([, payload]) => (payload as { caller: string }).caller);
    expect(new Set(callers)).toEqual(new Set(["source_control"]));
  });

  it("reads GitHub only through the cache of the answers", async () => {
    await refreshGit("w1");
    const commands = vi.mocked(invoke).mock.calls.map(([command]) => command);
    expect(commands.filter((command) => command !== "git_status")).toEqual([
      "forge_cli_cached",
      "forge_cli_cached",
      "forge_cli_cached",
      "forge_cli_cached",
    ]);
  });

  it("asks GitHub again after a click on Refresh, and uses the kept answer when the workspace changes", async () => {
    await refreshGit("w1");
    expect(forgePayloads().map((payload) => payload.refresh)).toEqual([true, true, true, true]);
    vi.mocked(invoke).mockClear();
    await refreshGit("w1", false);
    expect(forgePayloads().map((payload) => payload.refresh)).toEqual([false, false, false, false]);
    expect(forgePayloads().map((payload) => payload.keepUntilRefresh)).toEqual([false, false, false, false]);
  });
});
