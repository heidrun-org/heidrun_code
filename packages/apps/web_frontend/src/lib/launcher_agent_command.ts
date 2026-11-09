import { findCodingAgent } from "./coding_agents";
import type { LauncherAgent } from "./project_config";

/** Puts `text` in single quotes, so that a shell reads it as one word, whatever it contains. */
export function shellQuote(text: string): string {
  return `'${text.replace(/'/g, `'\\''`)}'`;
}

/** Command line that starts the coding agent of a custom launcher of the kind Coding agent, with its prompt. */
export function launcherAgentCommand(agent: LauncherAgent): string {
  const definition = findCodingAgent(agent.name);
  if (definition === undefined) {
    throw new Error(`Unknown coding agent: ${agent.name}`);
  }
  const words = definition.buildArguments(agent.model ?? "", agent.effort ?? "", shellQuote, shellQuote(agent.prompt.trim()));
  return [definition.executable, ...words].join(" ");
}

/** The environment variable that gives the Claude Code observer mod the folder of its snapshot files. */
export const HEIDRUN_CODE_DASHBOARD_OBSERVATION_FOLDER_VARIABLE = "HEIDRUN_CODE_DASHBOARD_OBSERVATION_DIR";

/**
 * Splits a command line into its executable and the text after it.
 * @param command - The command line.
 * @returns The first word and the rest, without the spaces between them.
 */
function splitExecutable(command: string): { executable: string; rest: string } {
  const trimmed = command.trim();
  const match = /^(\S+)\s*([\s\S]*)$/.exec(trimmed);
  if (match === null) {
    return { executable: "", rest: "" };
  }
  return { executable: match[1], rest: match[2] };
}

/**
 * True when the text after the executable starts a new interactive session: nothing, an option, or a quoted prompt.
 * A bare word is a subcommand, for example `codex exec` or `claude mcp`, and starts no new interactive session.
 * @param rest - The text after the executable.
 * @returns True for a new interactive session.
 */
function startsInteractiveSession(rest: string): boolean {
  return rest === "" || rest.startsWith("-") || rest.startsWith("'");
}

/**
 * True when a command line starts a new interactive session of the coding agent `executable`, so that Heidrun Code can
 * add the observer mod of Claude Code or the prepared chat of Codex.
 * @param command - The command line.
 * @param executable - The program of the coding agent.
 * @returns True for `<executable>` alone, followed by an option, or followed by a quoted prompt.
 */
export function startsNewInteractiveSession(command: string, executable: "claude" | "codex"): boolean {
  const split = splitExecutable(command);
  return split.executable === executable && startsInteractiveSession(split.rest);
}

/**
 * The command line that starts Codex in the chat that Heidrun Code prepared: `codex resume '<chat identifier>'` followed by
 * the other arguments of the command, the model and the prompt included.
 * @param command - A command line that starts Codex, for example `codex -m 'gpt-6-luna'`.
 * @param chatId - The identifier that the command `codex_prepare_chat` gave.
 * @returns The new command line, or null when the command is not a new interactive Codex, or when the identifier has a
 * character that a shell could read as something else.
 */
export function codexResumeCommandFor(command: string, chatId: string): string | null {
  const { executable, rest } = splitExecutable(command);
  if (executable !== "codex" || startsInteractiveSession(rest) === false || /^[A-Za-z0-9-]+$/.test(chatId) === false) {
    return null;
  }
  return ["codex", "resume", shellQuote(chatId), rest].filter((word) => word !== "").join(" ");
}

/**
 * The command line that starts Claude Code with the observer mod of the Heidrun Code Dashboard:
 * `HEIDRUN_CODE_DASHBOARD_OBSERVATION_DIR='<folder>' claude --plugin-dir '<mod folder>'` followed by the other arguments.
 * @param command - A command line that starts Claude Code, for example `claude --resume '<id>'`.
 * @param modFolder - The folder that the command `heidrun_code_dashboard_claude_observer_mod_path` gave.
 * @param observationFolder - The folder that the command `heidrun_code_dashboard_claude_observation_folder` gave.
 * @returns The new command line, or null when the command is not an interactive Claude Code.
 */
export function claudeObserverCommandFor(command: string, modFolder: string, observationFolder: string): string | null {
  const { executable, rest } = splitExecutable(command);
  if (executable !== "claude" || startsInteractiveSession(rest) === false) {
    return null;
  }
  return [
    `${HEIDRUN_CODE_DASHBOARD_OBSERVATION_FOLDER_VARIABLE}=${shellQuote(observationFolder)}`,
    "claude",
    "--plugin-dir",
    shellQuote(modFolder),
    rest,
  ]
    .filter((word) => word !== "")
    .join(" ");
}
