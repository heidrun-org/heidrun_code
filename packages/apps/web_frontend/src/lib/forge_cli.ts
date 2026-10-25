// The one way that the application reads an issue, a pull request, a merge request, or a list of them from GitHub or
// GitLab: `gh` or `glab` through the Tauri command `forge_cli_cached`, which keeps each answer on the disk. Each call to
// GitHub takes points of the GitHub rate limit, which every project and every coding agent of the account share, so no
// read goes around the cache.
// - issue #870
import { invoke } from "@tauri-apps/api/core";

/** The command line tool of a hosting service: `gh` for GitHub, `glab` for GitLab. */
export type ForgeTool = "gh" | "glab";

/** How a call uses the answer that the cache keeps. */
export type ForgeCliOptions = {
  /** True to ask the hosting service again, whatever the age of the kept answer. */
  isRefresh?: boolean;
  /** True to use the kept answer whatever its age, until a refresh. False: the kept answer is used for ten minutes. */
  isKeptUntilRefresh?: boolean;
};

/**
 * Runs a read-only `gh` or `glab` call in a folder of the repository, through the cache of the answers.
 * @param folder - the folder of the repository, where the tool runs
 * @param tool - the command line tool of the hosting service
 * @param args - the arguments of the tool
 * @param options - how the call uses the kept answer
 * @returns what the tool printed, or the kept answer
 */
export function runForgeCli(
  folder: string,
  tool: ForgeTool,
  args: string[],
  options: ForgeCliOptions = {},
): Promise<string> {
  return invoke<string>("forge_cli_cached", {
    cwd: folder,
    tool,
    args,
    refresh: options.isRefresh === true,
    keepUntilRefresh: options.isKeptUntilRefresh === true,
  });
}
