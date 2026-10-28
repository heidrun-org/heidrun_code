// Changes of the key `guards` of the file `.heidrun/config.json`, made from the Guards section of the Settings window and
// from the guard window. Every function returns a new value and never changes its argument.
import { projectGuardList, regexError, type GuardId } from "./guards";
import type { GuardAction, GuardMatch, ProjectGuard, ProjectGuardsConfig } from "./project_config";

/** The types of a line of a guard, in the order of the list of the guard window, with the key of the text of each type. */
export const GUARD_MATCH_TYPES = [
  { type: "contains", labelKey: "guards.matchContains" },
  { type: "startsWith", labelKey: "guards.matchStartsWith" },
  { type: "endsWith", labelKey: "guards.matchEndsWith" },
  { type: "regex", labelKey: "guards.matchRegex" },
] as const;

/** The two actions of a guard, in the order of the radio buttons, with the keys of the label and of the help of each action. */
export const GUARD_ACTIONS = [
  { action: "confirm", labelKey: "guards.actionConfirm", helpKey: "guardModal.actionConfirmHelp" },
  { action: "block", labelKey: "guards.actionBlock", helpKey: "guardModal.actionBlockHelp" },
] as const;

/** What the guard window holds while the developer types: the fields of a guard, before the check and the save. */
export type GuardDraft = {
  /** The text of the field "Name". */
  name: string;
  /** The text of the field "Description". */
  description: string;
  /** The choice of the radio buttons. */
  action: GuardAction;
  /** The lines, one for each row of the window. A line can still be empty. */
  matches: GuardMatch[];
};

/** The problems of a draft. `isValid` is true when the draft has no problem. */
export type GuardProblems = {
  /** The problem of the name: empty, or used by another guard of the project. */
  name: "empty" | "used" | null;
  /** True when the draft has no line at all. */
  hasNoLine: boolean;
  /** The problem of each line, in the order of the lines: empty, or a regular expression that cannot be read. */
  lines: ({ reason: "empty" } | { reason: "invalid"; detail: string } | null)[];
  /** True when the draft has no problem, so that it can be saved. */
  isValid: boolean;
};

/** A draft for the window "Add a guard": no name, no description, the action "Ask to confirm", and one empty line. */
export function emptyDraft(): GuardDraft {
  return { name: "", description: "", action: "confirm", matches: [{ type: "contains", text: "" }] };
}

/** The draft of a guard of the project, for the window "Edit the guard". */
export function draftFromGuard(guard: ProjectGuard): GuardDraft {
  return {
    name: guard.name,
    description: guard.description ?? "",
    action: guard.action,
    matches: guard.matches.map((match) => ({ ...match })),
  };
}

/** The guard that a draft makes: the spaces around the texts are removed, and an empty description is left out. */
export function toProjectGuard(draft: GuardDraft): ProjectGuard {
  const guard: ProjectGuard = {
    name: draft.name.trim(),
    action: draft.action,
    matches: draft.matches.map((match) => ({ type: match.type, text: match.text.trim() })),
  };
  if (draft.description.trim() !== "") {
    guard.description = draft.description.trim();
  }
  return guard;
}

/** Do two names write the same name? The spaces around the names and the case do not count. */
export function isSameName(first: string, second: string): boolean {
  return first.trim().toLowerCase() === second.trim().toLowerCase();
}

/**
 * Checks a draft before it is saved. `originalName` is the name of the guard that the window edits, or null in the window
 * "Add a guard": a guard may keep its own name, but no other guard of the project may have it.
 */
export function checkGuardDraft(draft: GuardDraft, guards: ProjectGuardsConfig | undefined, originalName: string | null): GuardProblems {
  let nameProblem: GuardProblems["name"] = null;
  if (draft.name.trim() === "") {
    nameProblem = "empty";
  } else if (
    projectGuardList(guards).some((guard) => isSameName(guard.name, draft.name) && (originalName === null || isSameName(guard.name, originalName) === false))
  ) {
    nameProblem = "used";
  }
  const lines = draft.matches.map((match): GuardProblems["lines"][number] => {
    if (match.text.trim() === "") {
      return { reason: "empty" };
    }
    const detail = match.type === "regex" ? regexError(match.text.trim()) : null;
    return detail === null ? null : { reason: "invalid", detail };
  });
  const hasNoLine = draft.matches.length === 0;
  const isValid = nameProblem === null && hasNoLine === false && lines.every((line) => line === null);
  return { name: nameProblem, hasNoLine, lines, isValid };
}

/** Is the built-in guard `key` on for the project? A guard is on unless its key is in the list `disabled`. */
export function isBuiltInGuardEnabled(guards: ProjectGuardsConfig | undefined, key: string): boolean {
  return (guards?.disabled ?? []).includes(key) === false;
}

/**
 * The guards in the new format: the old lists `block` and `confirm` become guards of the key `projectGuards`, and the two old
 * keys are left out. A guard from an old list keeps the name that Heidrun Code gave it, with " (2)" added when the name is used.
 */
export function migrateGuards(guards: ProjectGuardsConfig | undefined): ProjectGuardsConfig {
  const migrated: ProjectGuard[] = [];
  for (const guard of projectGuardList(guards)) {
    let name = guard.name;
    for (let number = 2; migrated.some((other) => isSameName(other.name, name)); number += 1) {
      name = `${guard.name} (${number})`;
    }
    migrated.push({ ...guard, name });
  }
  return normalizeGuards({ projectGuards: migrated, disabled: guards?.disabled }) ?? {};
}

/**
 * The guards with `guard` saved. `originalName` is the name of the guard that the window edited, or null for a new guard. A
 * new guard goes at the end of the list, and an edited guard keeps its place.
 */
export function withProjectGuard(guards: ProjectGuardsConfig | undefined, guard: ProjectGuard, originalName: string | null): ProjectGuardsConfig {
  const migrated = migrateGuards(guards);
  const list = [...(migrated.projectGuards ?? [])];
  const index = originalName === null ? -1 : list.findIndex((other) => isSameName(other.name, originalName));
  if (index === -1) {
    list.push(guard);
  } else {
    list[index] = guard;
  }
  return normalizeGuards({ ...migrated, projectGuards: list }) ?? {};
}

/** The guards without the guard of the project that has this name. Undefined when nothing is left, so the key can be removed. */
export function withoutProjectGuard(guards: ProjectGuardsConfig | undefined, name: string): ProjectGuardsConfig | undefined {
  const migrated = migrateGuards(guards);
  return normalizeGuards({ ...migrated, projectGuards: (migrated.projectGuards ?? []).filter((guard) => isSameName(guard.name, name) === false) });
}

/**
 * The guards with the built-in guard `key` turned on or off. Turning a guard off adds its key to the list `disabled`.
 * Undefined when nothing is left, so the key `guards` can be removed.
 */
export function withBuiltInGuard(guards: ProjectGuardsConfig | undefined, key: string, isEnabled: boolean): ProjectGuardsConfig | undefined {
  const others = (guards?.disabled ?? []).filter((item) => item !== key);
  return normalizeGuards({ ...guards, disabled: isEnabled ? others : [...others, key] });
}

/** The same guards without the empty lists, in the order `projectGuards`, `confirm`, `block`, `disabled`. Undefined when nothing is left. */
export function normalizeGuards(guards: ProjectGuardsConfig): ProjectGuardsConfig | undefined {
  const result: ProjectGuardsConfig = {};
  for (const key of ["projectGuards", "confirm", "block", "disabled"] as const) {
    const list = guards[key];
    if (list !== undefined && list.length > 0) {
      Object.assign(result, { [key]: list });
    }
  }
  return Object.keys(result).length === 0 ? undefined : result;
}

/** A text that names a guard, to find its row on the screen: `builtin:guards.why.gitClean` or `project:Publish to npm`. */
export function guardIdText(guard: GuardId): string {
  return guard.kind === "builtin" ? `builtin:${guard.key}` : `project:${guard.name}`;
}
