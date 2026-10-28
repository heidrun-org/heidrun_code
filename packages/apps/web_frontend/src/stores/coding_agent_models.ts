// The models of each coding agent, as the window Create a custom launcher offers them. A coding agent whose tool can list
// its models gives them through the Tauri command `coding_agent_models_run`. Until the tool answers, and when it fails
// (not installed, not signed in, no answer), the window keeps the fixed list of the coding agent. Nothing is saved: the
// tool is asked again each time that the window opens, so a new model of the tool shows up without an update of Heidrun Code.
import { invoke } from "@tauri-apps/api/core";
import { reactive } from "vue";
import type { CodingAgentModel } from "../lib/coding_agent_models";
import { findCodingAgent } from "../lib/coding_agents";

/** The models that the tools listed, by identifier of coding agent, and the coding agents that the window still asks. */
export const codingAgentModels = reactive({
  byAgent: {} as Record<string, CodingAgentModel[]>,
  loading: {} as Record<string, boolean>,
});

/** The models that the window offers for the coding agent `agentId`: the list of the tool, or else the fixed list. */
export function modelsOf(agentId: string): CodingAgentModel[] {
  return codingAgentModels.byAgent[agentId] ?? findCodingAgent(agentId)?.models ?? [];
}

/** True while the window waits for the tool of the coding agent `agentId` to list its models. */
export function isLoadingModels(agentId: string): boolean {
  return codingAgentModels.loading[agentId] === true;
}

/**
 * Asks the tool of the coding agent `agentId` for its models. Does nothing when the tool has no command that lists them.
 * An error leaves the fixed list in place.
 */
export async function loadCodingAgentModels(agentId: string): Promise<void> {
  const agent = findCodingAgent(agentId);
  if (agent === undefined || agent.modelsFromTool === undefined || isLoadingModels(agentId)) {
    return;
  }
  codingAgentModels.loading[agentId] = true;
  try {
    const output = await invoke<string>("coding_agent_models_run", {
      executable: agent.executable,
      arguments: agent.modelsFromTool.arguments,
    });
    const models = agent.modelsFromTool.read(output);
    if (models.length > 0) {
      codingAgentModels.byAgent[agentId] = models;
    }
  } catch {
    // The fixed list of the coding agent stays.
  } finally {
    codingAgentModels.loading[agentId] = false;
  }
}
