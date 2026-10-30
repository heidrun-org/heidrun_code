import * as api from "../lib/api";
import { claudeObserverCommandFor, codexResumeCommandFor, startsNewInteractiveSession } from "../lib/launcher_agent_command";
import { settings } from "./settings";

// The start of a coding agent that Heidrun Code types in a pane: the observer mod of the Mire for Claude Code, and the
// chat prepared on the shared Codex server for Codex (issue 969). Each free agent pane, each new tab or split that starts
// a coding agent, and each launcher that starts a coding agent goes through `prepareAgentCommand`, then, after the command
// is typed, through `reportPreparedCodexChat`.

/** The command line to type, and the chat that Heidrun Code prepared for a new Codex, or null. */
export type PreparedAgentCommand = {
  /** The command line to type in the pane. */
  command: string;
  /** The identifier of the chat prepared on the shared Codex server, or null when no chat was prepared. */
  codexChatId: string | null;
};

/** The source that Herdr accepts for a Codex chat identifier. Herdr ignores another source, for example `heidrun:codex`. */
export const CODEX_AGENT_SESSION_SOURCE = "herdr:codex";

/**
 * The smallest step between two sequence numbers. A sequence number is a time in nanoseconds, larger than the largest
 * exact integer of JavaScript, so a step of 1 would be lost: near 2^61 the numbers are 256 apart.
 */
const REPORT_SEQUENCE_STEP = 1024;

/** The last sequence number of a report, so that two reports in the same millisecond still increase. */
let lastReportSequence = 0;

/**
 * Prepares the command line of a coding agent that Heidrun Code starts in a pane, just before it is typed.
 * - Claude Code: when the Settings option "Observe Claude Code for the Mire" is on, the command loads the observer mod.
 *   When the mod is missing, Claude Code starts without it.
 * - Codex: Heidrun Code creates and names the chat on the shared Codex server, then the command is
 *   `codex resume '<chat identifier>'` with the other arguments. When the server is not available, the command stays
 *   plain `codex`, and the Mire shows the pane as unmatched.
 * Every other command, and every subcommand such as `codex resume`, stays as it is.
 * @param command - The command line, already checked by the guards.
 * @param o - The folder of the pane, the tab name, and the model, or null for the default model.
 * @returns The command line to type, and the identifier of the prepared Codex chat, or null.
 */
export async function prepareAgentCommand(
  command: string,
  o: { cwd: string | null; name: string; model: string | null },
): Promise<PreparedAgentCommand> {
  const plain = { command, codexChatId: null };
  if (settings.mireClaudeObserver === true && startsNewInteractiveSession(command, "claude")) {
    try {
      const [modFolder, observationFolder] = await Promise.all([
        api.mireClaudeObserverModPath(),
        api.mireClaudeObservationFolder(),
      ]);
      if (typeof modFolder === "string" && typeof observationFolder === "string") {
        return { command: claudeObserverCommandFor(command, modFolder, observationFolder) ?? command, codexChatId: null };
      }
    } catch {
      // Claude Code starts without the observer mod.
    }
    return plain;
  }
  if (o.cwd !== null && o.cwd !== "" && startsNewInteractiveSession(command, "codex")) {
    const chatId = await api.codexPrepareChat(o.cwd, o.name, o.model === "" ? null : o.model).catch(() => null);
    if (typeof chatId === "string") {
      const resumeCommand = codexResumeCommandFor(command, chatId);
      if (resumeCommand !== null) {
        return { command: resumeCommand, codexChatId: chatId };
      }
    }
  }
  return plain;
}

/**
 * Tells Herdr the chat of a pane that started a prepared Codex. Herdr reads the chat identifier from the command line
 * only for a coding agent that Herdr starts itself, and Heidrun Code types the command into the shell of the pane, so
 * Herdr needs this report to give the pane its `agent_session`. A failure of the report never fails the start: the pane
 * then stays unmatched in the Mire.
 * @param paneId - The pane where the command was typed.
 * @param prepared - What `prepareAgentCommand` gave.
 * @returns A promise that ends when the report is sent or has failed.
 */
export async function reportPreparedCodexChat(paneId: string, prepared: PreparedAgentCommand): Promise<void> {
  if (prepared.codexChatId === null) {
    return;
  }
  lastReportSequence = Math.max(Date.now() * 1_000_000, lastReportSequence + REPORT_SEQUENCE_STEP);
  try {
    await api.request("pane.report_agent_session", {
      pane_id: paneId,
      source: CODEX_AGENT_SESSION_SOURCE,
      agent: "codex",
      seq: lastReportSequence,
      agent_session_id: prepared.codexChatId,
    });
  } catch (error) {
    console.warn(`Heidrun Code: Herdr did not record the Codex chat of the pane ${paneId}`, error);
  }
}
