// The one way that the application reads an issue, a pull request, a merge request, or a list of them from GitHub or
// GitLab: `gh` or `glab` through the Tauri command `forge_cli_cached`, which keeps each answer on the disk. Each call to
// GitHub takes points of the GitHub rate limit, which every project and every coding agent of the account share, so no
// read goes around the cache.
// Each call writes one line in the application log, `application_log.jsonl`, with the part of the application that asked.
// - issue #870
// - issue #879
// - issue #890
import { invoke } from "@tauri-apps/api/core";

/** The command line tool of a hosting service: `gh` for GitHub, `glab` for GitLab. */
export type ForgeTool = "gh" | "glab";

/**
 * The part of the application that asks, written in the application log: the lists of the Code hosting sidebar section,
 * the card of an issue or of a pull request, the issue preview window, or the pull requests of the Source control sidebar
 * section.
 */
export type ForgeCaller = "code_hosting_list" | "reference_card" | "issue_preview" | "source_control";

/** How a call uses the answer that the cache keeps. */
export type ForgeCliOptions = {
  /** True to ask the hosting service again, whatever the age of the kept answer. */
  isRefresh?: boolean;
  /** True to use the kept answer whatever its age, until a refresh. False: the kept answer is used for ten minutes. */
  isKeptUntilRefresh?: boolean;
};

/** An answer of the cache, with the failure that the kept answer replaced. */
export type ForgeAnswer = {
  /** What the tool printed, or the kept answer. */
  output: string;
  /** The failure of the call when the kept answer replaces it, or null when the answer is not a replacement. */
  failure: string | null;
  /** When the hosting service gave the kept answer that replaces the failure, in milliseconds since 1970, or null. */
  keptAt: number | null;
};

/**
 * Runs a read-only `gh` or `glab` call in a folder of the repository, through the cache of the answers.
 * @param caller - the part of the application that asks, for the application log
 * @param folder - the folder of the repository, where the tool runs
 * @param tool - the command line tool of the hosting service
 * @param args - the arguments of the tool
 * @param options - how the call uses the kept answer
 * @returns what the tool printed, or the kept answer
 */
export function runForgeCli(
  caller: ForgeCaller,
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
    caller,
  });
}

/**
 * Runs a call as `runForgeCli` does, and also says when the kept answer replaced a failure of the tool, with the failure
 * and the time of the kept answer.
 * @param caller - the part of the application that asks, for the application log
 * @param folder - the folder of the repository, where the tool runs
 * @param tool - the command line tool of the hosting service
 * @param args - the arguments of the tool
 * @param options - how the call uses the kept answer
 * @returns the answer, with the failure that it replaced
 */
export function runForgeCliWithSource(
  caller: ForgeCaller,
  folder: string,
  tool: ForgeTool,
  args: string[],
  options: ForgeCliOptions = {},
): Promise<ForgeAnswer> {
  return invoke<ForgeAnswer>("forge_cli_cached_with_source", {
    cwd: folder,
    tool,
    args,
    refresh: options.isRefresh === true,
    keepUntilRefresh: options.isKeptUntilRefresh === true,
    caller,
  });
}
