import { z } from "zod";

/** One model that a coding agent accepts. */
export type CodingAgentModel = {
  /** The value that the command line of the coding agent takes after its option for the model. */
  id: string;
  /** The name that the person reads. */
  label: string;
  /** The efforts that this model accepts, from the weakest to the strongest. Empty when the tool does not say. */
  efforts: string[];
};

/** The part of the output of the command `codex debug models` that Heidrun Code reads. The other fields are dropped. */
const codexModelCatalogSchema = z.object({
  models: z.array(
    z.object({
      slug: z.string().min(1),
      display_name: z.string().min(1),
      visibility: z.string(),
      supported_reasoning_levels: z.array(z.object({ effort: z.string().min(1) })),
    }),
  ),
});

/**
 * Reads the output of the command `codex debug models`: the models that Codex itself shows, with the efforts of each one.
 * A model whose visibility is not `list` is for the tool only, so it is left out.
 *
 * @param output - What the command printed on its standard output.
 * @returns The models, in the order of Codex.
 * @throws When the output is not the JSON catalog of Codex.
 */
export function readCodexModels(output: string): CodingAgentModel[] {
  const catalog = codexModelCatalogSchema.parse(JSON.parse(output));
  return catalog.models
    .filter((model) => model.visibility === "list")
    .map((model) => ({
      id: model.slug,
      label: model.display_name,
      efforts: model.supported_reasoning_levels.map((level) => level.effort),
    }));
}

/**
 * Reads the output of the command `agy models`: one model on each line, the identifier, a tab, then the name that the
 * person reads. A line without a tab, such as a message of progress, is not a model, so it is left out. The tool does not
 * say the efforts of each model, so the efforts of the coding agent apply.
 *
 * @param output - What the command printed on its standard output.
 * @returns The models, in the order of Antigravity.
 * @throws When no line of the output holds a model.
 */
export function readAntigravityModels(output: string): CodingAgentModel[] {
  const models: CodingAgentModel[] = [];
  for (const line of output.split("\n")) {
    const [id, label] = line.split("\t").map((part) => part.trim());
    if (id !== undefined && id !== "" && label !== undefined && label !== "") {
      models.push({ id, label, efforts: [] });
    }
  }
  if (models.length === 0) {
    throw new Error("The output of agy models holds no model.");
  }
  return models;
}

/**
 * The efforts that the window offers for the chosen model.
 *
 * - A model that lists its own efforts gives them.
 * - The default model (an empty `modelId`) gives the efforts that every listed model accepts, because the tool picks the
 *   default model itself.
 * - Otherwise the efforts of the coding agent are used.
 *
 * @param agentEfforts - The efforts that the coding agent lists for all its models.
 * @param models - The models that the window offers.
 * @param modelId - The identifier of the chosen model, or an empty string for the default model.
 * @returns The efforts, from the weakest to the strongest.
 */
export function effortsOf(agentEfforts: string[], models: CodingAgentModel[], modelId: string): string[] {
  const model = models.find((candidate) => candidate.id === modelId);
  if (model !== undefined && model.efforts.length > 0) {
    return model.efforts;
  }
  if (modelId !== "" || models.length === 0 || models.some((candidate) => candidate.efforts.length === 0)) {
    return agentEfforts;
  }
  const common = models[0].efforts.filter((effort) => models.every((candidate) => candidate.efforts.includes(effort)));
  return common.length > 0 ? common : agentEfforts;
}
