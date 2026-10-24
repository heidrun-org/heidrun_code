import { z } from "zod";
import { CODING_AGENT_IDS } from "./coding_agents";

// Schema of the project configuration file `.heidrun/config.json`, at the root of the repository.
// Every object is strict: an unknown field is a typo, and the file is rejected with its path.

/** The coding agent of a custom launcher of the kind Coding agent. The launcher keeps the command line that starts it. */
export const launcherAgentSchema = z.strictObject({
  name: z.enum(CODING_AGENT_IDS),
  model: z.string().optional(),
  effort: z.string().optional(),
  prompt: z.string().min(1),
});

/** A launcher of the Launchers sidebar section. It is stored in the list under the key `launchers`. */
export const launcherSchema = z.strictObject({
  id: z.string().min(1),
  label: z.string().min(1),
  command: z.string().min(1),
  /** Optional description of the launcher, on several lines. */
  description: z.string().optional(),
  /** Present only for a custom launcher of the kind Coding agent. `command` then holds the generated command line. */
  agent: launcherAgentSchema.optional(),
  /** Optional sub-folder, relative to the project root. */
  cwd: z.string().optional(),
});

/** The `references` section: how `#12`, `!34` and `ABC-123` become links. */
export const referencesSchema = z.strictObject({
  forge: z.enum(["github", "gitlab"]).optional(),
  repo: z.string().min(1).optional(),
  tickets: z
    .union([
      z.string().min(1),
      z.strictObject({
        url: z.string().min(1).optional(),
        prefixes: z.array(z.string().min(1)).optional(),
      }),
    ])
    .optional(),
  enabled: z.boolean().optional(),
});

/** How a line of a project guard compares itself with a command. */
export const guardMatchTypeSchema = z.enum(["contains", "startsWith", "endsWith", "regex"]);

/** What Heidrun Code does with a command that a project guard matches: ask the developer to confirm, or forbid the command. */
export const guardActionSchema = z.enum(["confirm", "block"]);

/** One line of a project guard: a type, and the text that the type compares with the command. */
export const guardMatchSchema = z.strictObject({
  type: guardMatchTypeSchema,
  text: z.string().min(1),
});

/**
 * A guard of the project. A command matches the guard when it matches at least one line. The name is unique in the
 * project, and the description is shown in the confirmation window.
 */
export const projectGuardSchema = z.strictObject({
  name: z.string().min(1),
  description: z.string().optional(),
  action: guardActionSchema,
  matches: z.array(guardMatchSchema).min(1),
});

/**
 * The `guards` section: the guards of the project, and the built-in guards that are turned off for the project. Each
 * item of `disabled` is the key of a built-in guard, for example `guards.why.gitClean`. The lists `confirm` and
 * `block` are the lists of the files written before the key `projectGuards`: each item is a regular expression, and
 * Heidrun Code reads it as a project guard named after the item.
 */
export const guardsSchema = z.strictObject({
  projectGuards: z.array(projectGuardSchema).optional(),
  confirm: z.array(z.string()).optional(),
  block: z.array(z.string()).optional(),
  disabled: z.array(z.string()).optional(),
});

/** A macro of the project. */
export const macroSchema = z.strictObject({
  id: z.string().min(1).optional(),
  label: z.string().min(1).optional(),
  description: z.string().optional(),
  text: z.string().min(1),
});

/** The whole content of `.heidrun/config.json`. */
export const projectConfigSchema = z.strictObject({
  version: z.literal(1),
  launchers: z.array(launcherSchema).default([]),
  references: referencesSchema.optional(),
  guards: guardsSchema.optional(),
  // The key keeps the old name of the feature, because other people already have the file.
  prompts: z.array(macroSchema).optional(),
});

export type LauncherAgent = z.infer<typeof launcherAgentSchema>;
export type Launcher = z.infer<typeof launcherSchema>;
export type ProjectReferences = z.infer<typeof referencesSchema>;
export type ProjectGuardsConfig = z.infer<typeof guardsSchema>;
export type GuardMatchType = z.infer<typeof guardMatchTypeSchema>;
export type GuardAction = z.infer<typeof guardActionSchema>;
export type GuardMatch = z.infer<typeof guardMatchSchema>;
export type ProjectGuard = z.infer<typeof projectGuardSchema>;
export type ProjectMacro = z.infer<typeof macroSchema>;
export type ProjectConfig = z.infer<typeof projectConfigSchema>;

/** The key of the list of launchers in the files written before the rename, when a launcher was called an action. */
const LEGACY_LAUNCHERS_KEY = "actions";

/**
 * Moves the list under the old key `actions` to the key `launchers`, so that a file written before the rename is still
 * read. The program writes only the key `launchers`. A file that has both keys is not changed, so the strict schema
 * rejects the old key and names it.
 */
function moveLegacyLaunchersKey(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return value;
  }
  const record = value as Record<string, unknown>;
  if (LEGACY_LAUNCHERS_KEY in record === false || "launchers" in record) {
    return value;
  }
  const { [LEGACY_LAUNCHERS_KEY]: legacyLaunchers, ...rest } = record;
  return { ...rest, launchers: legacyLaunchers };
}

/** One line per problem, each starting with the path of the field: `launchers.0.command: Too small…`. */
function describeIssues(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.length > 0 ? issue.path.join(".") : "(root)"}: ${issue.message}`).join("; ");
}

/**
 * Validates a configuration read from the file, or about to be written to it. The old key `actions` is read as the key
 * `launchers`. Throws an Error that names the fields.
 */
export function parseProjectConfig(value: unknown): ProjectConfig {
  const result = projectConfigSchema.safeParse(moveLegacyLaunchersKey(value));
  if (result.success === false) {
    throw new Error(describeIssues(result.error));
  }
  return result.data;
}

/**
 * Validates the list of the user level launchers, read from the file `launchers.json`. Each launcher has the fields of a
 * launcher of the key `launchers`. Throws an Error that names the fields.
 */
export function parseLauncherList(value: unknown): Launcher[] {
  const result = z.array(launcherSchema).safeParse(value);
  if (result.success === false) {
    throw new Error(describeIssues(result.error));
  }
  return result.data;
}

/** Validates the `references` section alone. Throws an Error that names the fields. */
export function parseReferences(value: unknown): ProjectReferences {
  const result = referencesSchema.safeParse(value);
  if (result.success === false) {
    throw new Error(describeIssues(result.error));
  }
  return result.data;
}
