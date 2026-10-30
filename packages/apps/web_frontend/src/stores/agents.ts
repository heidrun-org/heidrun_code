import { allowCommand } from './guards';
import { CompositionBar } from './composition_bar';
import { settings } from './settings';
import { WorkspaceFolders } from './workspace_folders';
// "Nouvel agent": a tab named after the agent, Claude (or Codex) launched in it,
// and the starting consigne sent once the agent is ready.
import * as api from "../lib/api";
import { allPanes, refresh, selectPane, sendPrompt, tabLabel, toast } from "./session";
import { resolveMacroVariables } from "./macros";
import { t } from "../i18n/index";
import { chatResumeCommand } from "../lib/chat_links";
import { shellQuote } from "../lib/launcher_agent_command";
import { prepareAgentCommand, reportPreparedCodexChat, type PreparedAgentCommand } from "./coding_agent_start";
import type { PaneInfo } from "../lib/types";

// Only plain names reach the shell command line, and quoted ("sonnet[1m]" is a glob for zsh).
const SAFE = /^[A-Za-z0-9._\-[\]]+$/;
const q = (v: string) => `'${v}'`;

export function agentCommand(
  tool: "claude" | "codex" | "agy",
  agent: string | null,
  model: string | null,
  prompt = "",
): string {
  if (agent && !SAFE.test(agent)) throw new Error(t("agentsStore.invalidAgentName", { name: agent }));
  if (model && !SAFE.test(model)) throw new Error(t("agentsStore.invalidModel", { name: model }));
  if (tool === "codex") return ["codex", model ? `-m ${q(model)}` : ""].filter(Boolean).join(" ");
  if (tool === "agy") {
    return ["agy", model ? `--model ${q(model)}` : "", prompt.trim() ? `-i ${shellQuote(prompt.trim())}` : ""]
      .filter(Boolean)
      .join(" ");
  }
  return ["claude", agent ? `--agent ${q(agent)}` : "", model ? `--model ${q(model)}` : ""].filter(Boolean).join(" ");
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Waits for Herdr to see the agent in the pane and for it to be idle (2 min max). */
async function whenReady(paneId: string): Promise<"ready" | "closed" | "timeout"> {
  let warned = false;
  for (let i = 0; i < 160; i++) {
    await wait(750);
    await refresh();
    const p = allPanes.value.find((x) => x.pane_id === paneId);
    if (!p) return "closed"; // tab closed meanwhile
    if (!p.agent) continue;
    if (p.agent_status === "blocked" && !warned) {
      // First launch in a folder: Claude asks whether to trust it.
      warned = true;
      toast(t("agentsStore.waitingConfirmation"));
    }
    if (p.agent_status === "idle" && p.interactive_ready !== false) return "ready";
  }
  return "timeout";
}

export async function launchAgent(o: {
  workspaceId: string;
  cwd: string | null;
  tool: "claude" | "codex" | "agy";
  agent: string | null;
  model: string | null;
  label: string;
  prompt: string;
  /** The session identifier of a saved chat to resume: the tab starts `claude --resume` or `codex resume` with it. */
  resumeId?: string | null;
  /** A pane that already exists, for example the first pane of a new workspace: the command runs in it, and no new tab is created. */
  existingPane?: PaneInfo | null;
}): Promise<"ok" | "failed" | "closed"> {
	const isCompositionBarShown = settings.isCompositionBarShownOnAgentStart;
  let command: string;
  try {
    if (o.resumeId !== undefined && o.resumeId !== null) {
      if (o.tool === "agy") {
        throw new Error(t("agentsStore.invalidSessionId", { name: o.resumeId }));
      }
      const resumeCommand = chatResumeCommand(o.tool, o.resumeId);
      if (resumeCommand === null) {
        throw new Error(t("agentsStore.invalidSessionId", { name: o.resumeId }));
      }
      command = resumeCommand;
    } else {
      command = agentCommand(o.tool, o.agent, o.model, o.prompt);
    }
  } catch (e) {
    toast(String((e as Error).message ?? e));
    return "failed";
  }
  let pane: PaneInfo;
  let cwd: string | null;
  try {
    cwd = o.existingPane === undefined || o.existingPane === null
      ? WorkspaceFolders.require(o.workspaceId)
      : o.existingPane.foreground_cwd || o.existingPane.cwd || null;
    if ((await allowCommand(command, cwd, o.label)) === false) {
      return 'failed';
    }
    if (o.existingPane !== undefined && o.existingPane !== null) {
      pane = o.existingPane;
      if (o.label !== "") {
        await api.renameTab(pane.tab_id, o.label);
      }
    } else {
      pane = await api.newTab(o.workspaceId, cwd, o.label || undefined);
    }
  } catch (e) {
    toast(t("agentsStore.tabNotCreated", { error: String(e) }));
    return "failed";
  }
	CompositionBar.forPane(pane.pane_id).isOpen = isCompositionBarShown;
  await refresh();
  selectPane(pane);
  // Let the shell print its prompt before typing into it.
  await wait(400);
  const isNewCodexChat = o.tool === "codex" && (o.resumeId === undefined || o.resumeId === null);
  let prepared: PreparedAgentCommand = { command, codexChatId: null };
  if (o.tool === "claude" || isNewCodexChat) {
    prepared = await prepareAgentCommand(command, {
      cwd,
      name: o.label !== "" ? o.label : tabLabel(pane.tab_id),
      model: o.model,
    });
  }
  try {
    await api.run(pane.pane_id, prepared.command);
  } catch (e) {
    toast(t("agentsStore.launchFailed", { error: String(e) }));
    return "failed";
  }
  await reportPreparedCodexChat(pane.pane_id, prepared);
  const text = o.prompt.trim();
  if (!text || o.tool === "agy") return "ok";
  const ready = await whenReady(pane.pane_id);
  if (ready === "closed") {
    toast(t("agentsStore.tabClosedBeforeReady"));
    return "closed";
  }
  if (ready === "timeout") {
    toast(t("agentsStore.notReady"));
    return "failed";
  }
  // Refused by a guard or failed: undefined, and the consigne goes back to the input.
  return (await sendPrompt(pane.pane_id, await resolveMacroVariables(text, pane.pane_id))) !== undefined ? "ok" : "failed";
}
