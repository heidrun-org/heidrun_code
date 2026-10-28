import { describe, expect, it } from "vitest";
import { isSameSkillText, skillDifferenceRows } from "./skill_difference";

describe("isSameSkillText", () => {
  it("takes the same text as the same", () => {
    expect(isSameSkillText("---\nname: pdf\n---\n# pdf\n", "---\nname: pdf\n---\n# pdf\n")).toBe(true);
  });

  it("ignores the line ends of Windows and the empty lines at the end", () => {
    expect(isSameSkillText("# pdf\r\nUse it.\r\n", "# pdf\nUse it.\n\n\n")).toBe(true);
  });

  it("takes a changed word, a changed line, or an added line as different", () => {
    expect(isSameSkillText("# pdf\nUse it.", "# pdf\nUse it well.")).toBe(false);
    expect(isSameSkillText("# pdf\nUse it.", "# pdf")).toBe(false);
  });
});

describe("skillDifferenceRows", () => {
  it("gives a deleted row for a line only in the installed text, and an added row for a line only in the other text", () => {
    const rows = skillDifferenceRows("# pdf\nold line\nend", "# pdf\nnew line\nend");
    expect(rows).toEqual([
      { kind: "ctx", text: "# pdf" },
      { kind: "del", text: "old line" },
      { kind: "add", text: "new line" },
      { kind: "ctx", text: "end" },
    ]);
  });

  it("gives only unchanged rows for the same text", () => {
    expect(skillDifferenceRows("a\nb", "a\nb").every((row) => row.kind === "ctx" || row.kind === "gap")).toBe(true);
  });

  it("folds a long unchanged stretch to one row, and keeps 3 lines around a change", () => {
    const lines = Array.from({ length: 20 }, (_, index) => `line ${index}`);
    const changed = [...lines];
    changed[10] = "line ten";
    const rows = skillDifferenceRows(lines.join("\n"), changed.join("\n"));
    expect(rows.map((row) => row.kind)).toEqual(["gap", "ctx", "ctx", "ctx", "del", "add", "ctx", "ctx", "ctx", "gap"]);
    expect(rows[1].text).toBe("line 7");
  });
});
