// The difference between the SKILL.md text of an installed skill and the SKILL.md text of another skill with the same name,
// as the windows Find new skills and Inspect show it. This file reads two texts. It makes no call to the backend.
// - issue #849

import { diffLines } from "diff";

/** How many unchanged lines stay around a changed line. A longer unchanged stretch is folded to one row. */
const CONTEXT_LINES = 3;

/** One row of the difference. */
export type DifferenceRow = {
  /** "del" for a line only in the installed text, "add" for a line only in the other text, "ctx" for a line in both, "gap" for folded lines. */
  kind: "add" | "del" | "ctx" | "gap";
  /** The text of the line. */
  text: string;
};

/** The text with Windows line ends changed to line ends of macOS, and with no space or empty line at its end. */
function normalized(text: string): string {
  return text.replace(/\r\n/g, "\n").trimEnd();
}

/** True when the two SKILL.md texts are the same, whatever their line ends and the empty lines at their end. */
export function isSameSkillText(installed: string, other: string): boolean {
  return normalized(installed) === normalized(other);
}

/**
 * The rows of the difference from the installed text to the other text: a line only in the installed text is "del", a
 * line only in the other text is "add". An unchanged stretch longer than the context around the changes is one "gap" row.
 */
export function skillDifferenceRows(installed: string, other: string): DifferenceRow[] {
  const rows: DifferenceRow[] = [];
  for (const part of diffLines(normalized(installed), normalized(other))) {
    const kind = part.added === true ? "add" : part.removed === true ? "del" : "ctx";
    for (const text of part.value.replace(/\n$/, "").split("\n")) {
      rows.push({ kind, text });
    }
  }
  const kept = new Set<number>();
  rows.forEach((row, index) => {
    if (row.kind === "ctx") {
      return;
    }
    for (let near = index - CONTEXT_LINES; near <= index + CONTEXT_LINES; near++) {
      kept.add(near);
    }
  });
  const folded: DifferenceRow[] = [];
  rows.forEach((row, index) => {
    if (kept.has(index)) {
      folded.push(row);
    } else if (folded[folded.length - 1]?.kind !== "gap") {
      folded.push({ kind: "gap", text: "…" });
    }
  });
  return folded;
}
