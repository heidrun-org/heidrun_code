import { readAntigravityModels, readCodexModels, type CodingAgentModel } from "./coding_agent_models";

/** What the window Create a custom launcher needs to know to start one coding agent with a prompt. */
export type CodingAgentDefinition = {
  /** The identifier saved in the file `.heidrun/config.json`. */
  id: string;
  /** The name that the person reads. */
  label: string;
  /** The name of the Bootstrap Icons glyph, or of one of the icons of the application, shown before the label. */
  icon: string;
  /** The name of the program that the shell runs, the first word of the command line. */
  executable: string;
  /**
   * True when the coding agent can start with a prompt and stay interactive, so that the developer can answer in the
   * pane. The window Create a custom launcher offers only the coding agents for which this is true.
   */
  canStartInteractiveWithPrompt: boolean;
  /**
   * The models that the window offers when the tool cannot list them, or before it has listed them. Empty when the
   * coding agent has no option to choose the model.
   */
  models: CodingAgentModel[];
  /**
   * The command line that makes the tool print its own list of models. Absent when the tool has no such command: the
   * fixed `models` are then the list. The tool says better than a hand-written list which models exist now.
   */
  modelsFromTool?: {
    /** The words after the executable, for example `debug` and `models`. */
    arguments: string[];
    /** Reads what the command printed. Throws when the output is not what the tool prints. */
    read: (output: string) => CodingAgentModel[];
  };
  /**
   * The efforts that the coding agent accepts for any model, from the weakest to the strongest. Empty when it has no
   * effort. A model that lists its own efforts overrides them.
   */
  efforts: string[];
  /**
   * Builds the words of the command line after the executable: the options, and the prompt where the coding agent
   * wants it.
   *
   * @param model - The model, or an empty string for the default model.
   * @param effort - The effort, or an empty string for the default effort.
   * @param quote - Puts a text in single quotes for the shell.
   * @param prompt - The prompt, already quoted for the shell.
   * @returns The words after the executable, the prompt included.
   */
  buildArguments: (model: string, effort: string, quote: (text: string) => string, prompt: string) => string[];
};

/** The coding agents that Heidrun Code supports. Each one lists its own models and efforts: they differ. */
export const CODING_AGENTS: CodingAgentDefinition[] = [
  {
    id: "claude",
    label: "Claude Code",
    icon: "claude",
    executable: "claude",
    canStartInteractiveWithPrompt: true,
    // The command `claude` has no command that lists the models: the aliases come from the text of `claude --help`.
    models: [
      { id: "fable", label: "Fable", efforts: [] },
      { id: "opus", label: "Opus", efforts: [] },
      { id: "sonnet", label: "Sonnet", efforts: [] },
      { id: "haiku", label: "Haiku", efforts: [] },
    ],
    efforts: ["low", "medium", "high", "xhigh", "max"],
    buildArguments: (model, effort, quote, prompt) => {
      const words: string[] = [];
      if (model !== "") {
        words.push("--model", quote(model));
      }
      if (effort !== "") {
        words.push("--effort", quote(effort));
      }
      return [...words, prompt];
    },
  },
  {
    id: "codex",
    label: "Codex",
    icon: "openai",
    executable: "codex",
    canStartInteractiveWithPrompt: true,
    models: [
      { id: "gpt-6.1-sol", label: "GPT-6.1-Sol", efforts: [] },
      { id: "gpt-6-astra", label: "GPT-6-Astra", efforts: [] },
      { id: "gpt-6-sol", label: "GPT-6-Sol", efforts: [] },
      { id: "gpt-6-luna", label: "GPT-6-Luna", efforts: [] },
      { id: "gpt-5.6-sol", label: "GPT-5.6-Sol", efforts: [] },
      { id: "gpt-5.6-terra", label: "GPT-5.6-Terra", efforts: [] },
      { id: "gpt-5.6-luna", label: "GPT-5.6-Luna", efforts: [] },
    ],
    modelsFromTool: { arguments: ["debug", "models"], read: readCodexModels },
    efforts: ["low", "medium", "high", "xhigh", "max"],
    buildArguments: (model, effort, quote, prompt) => {
      const words: string[] = [];
      if (model !== "") {
        words.push("-m", quote(model));
      }
      if (effort !== "") {
        words.push("-c", quote(`model_reasoning_effort="${effort}"`));
      }
      return [...words, prompt];
    },
  },
  {
    id: "agy",
    label: "Antigravity",
    // Bootstrap Icons has no icon of its own for Antigravity, and Google makes Antigravity.
    icon: "google",
    executable: "agy",
    canStartInteractiveWithPrompt: true,
    // The models that `agy models` printed for one account. The list depends on the account, so the tool gives the real one.
    models: [
      { id: "gemini-3.8-flash-high", label: "Gemini 3.8 Flash (High)", efforts: [] },
      { id: "gemini-3.8-flash-medium", label: "Gemini 3.8 Flash (Medium)", efforts: [] },
      { id: "gemini-3.8-flash-low", label: "Gemini 3.8 Flash (Low)", efforts: [] },
      { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 (Thinking)", efforts: [] },
      { id: "claude-opus-4-6-thinking", label: "Claude Opus 4.6 (Thinking)", efforts: [] },
      { id: "gpt-oss-120b-medium", label: "GPT-OSS 120B (Medium)", efforts: [] },
    ],
    modelsFromTool: { arguments: ["models"], read: readAntigravityModels },
    efforts: ["low", "medium", "high", "xhigh", "max"],
    // The option `-i` takes the prompt as its value: it runs the prompt, then stays interactive. The option `-p` runs once.
    buildArguments: (model, effort, quote, prompt) => {
      const words: string[] = [];
      if (model !== "") {
        words.push("--model", quote(model));
      }
      if (effort !== "") {
        words.push("--effort", quote(effort));
      }
      return [...words, "-i", prompt];
    },
  },
];

/** The identifiers of the coding agents, in the order of the list. */
export const CODING_AGENT_IDS = CODING_AGENTS.map((agent) => agent.id) as [string, ...string[]];

/** The coding agents that the window Create a custom launcher offers: the ones that start interactive with a prompt. */
export const CUSTOM_LAUNCHER_CODING_AGENTS = CODING_AGENTS.filter((agent) => agent.canStartInteractiveWithPrompt);

/** The identifiers of the coding agents that the window Create a custom launcher offers, in the order of the list. */
export const CUSTOM_LAUNCHER_CODING_AGENT_IDS = CUSTOM_LAUNCHER_CODING_AGENTS.map((agent) => agent.id) as [string, ...string[]];

/** Finds the coding agent with the identifier `id`, or `undefined` when no coding agent has it. */
export function findCodingAgent(id: string): CodingAgentDefinition | undefined {
  return CODING_AGENTS.find((agent) => agent.id === id);
}
