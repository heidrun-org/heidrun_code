// @vitest-environment node
import { describe, expect, it } from "vitest";
import { diffStats, parseDiff, splitDiff } from "./diff";

const SAMPLE = [
  "diff --git a/a.txt b/a.txt",
  "index 111..222 100644",
  "--- a/a.txt",
  "+++ b/a.txt",
  "@@ -1,3 +1,3 @@ title",
  " one",
  "-two",
  "+TWO",
  " three",
  "\\ No newline at end of file",
].join("\n");

describe("parseDiff", () => {
  it("ignores the file headers", () => {
    const lines = parseDiff(SAMPLE);
    expect(lines.map((l) => l.kind)).toEqual(["hunk", "ctx", "del", "add", "ctx"]);
  });

  it("numbers the old and the new lines", () => {
    const [, one, two, TWO, three] = parseDiff(SAMPLE);
    expect(one).toMatchObject({ old: 1, new: 1, text: "one" });
    expect(two).toMatchObject({ old: 2, text: "two" });
    expect(two.new).toBeUndefined();
    expect(TWO).toMatchObject({ new: 2, text: "TWO" });
    expect(TWO.old).toBeUndefined();
    expect(three).toMatchObject({ old: 3, new: 3 });
  });

  it("restarts the numbers at each hunk", () => {
    const text = "@@ -10,1 +20,1 @@\n a\n@@ -50 +60 @@\n b";
    const lines = parseDiff(text);
    expect(lines[1]).toMatchObject({ old: 10, new: 20 });
    expect(lines[3]).toMatchObject({ old: 50, new: 60 });
  });

  it("accepts Windows line endings", () => {
    expect(parseDiff("@@ -1 +1 @@\r\n-a\r\n+b\r\n").map((l) => l.text)).toEqual(["@@ -1 +1 @@", "a", "b"]);
  });

  it("returns nothing for a text without hunk", () => {
    expect(parseDiff("")).toEqual([]);
    expect(parseDiff("just some text")).toEqual([]);
  });

  it("stops reading a hunk at the next file header", () => {
    const text = "@@ -1 +1 @@\n-a\n+b\ndiff --git a/x b/x\n--- a/x\n+++ b/x\n@@ -1 +1 @@\n-c\n+d";
    const kinds = parseDiff(text).map((l) => l.kind);
    expect(kinds).toEqual(["hunk", "del", "add", "hunk", "del", "add"]);
  });
});

describe("splitDiff", () => {
  it("shows a context line on both sides", () => {
    const rows = splitDiff(parseDiff("@@ -1 +1 @@\n same"));
    expect(rows[1].left).toBe(rows[1].right);
  });

  it("pairs removed and added lines block by block", () => {
    const rows = splitDiff(parseDiff("@@ -1,2 +1,2 @@\n-a\n-b\n+A\n+B"));
    expect(rows).toHaveLength(3);
    expect(rows[1].left?.text).toBe("a");
    expect(rows[1].right?.text).toBe("A");
    expect(rows[2].left?.text).toBe("b");
    expect(rows[2].right?.text).toBe("B");
  });

  it("leaves one side empty when the blocks differ in size", () => {
    const rows = splitDiff(parseDiff("@@ -1 +1,2 @@\n-a\n+A\n+B"));
    expect(rows[2].left).toBeUndefined();
    expect(rows[2].right?.text).toBe("B");
  });

  it("keeps the hunk title as its own row", () => {
    const rows = splitDiff(parseDiff("@@ -1 +1 @@ fn main\n x"));
    expect(rows[0].hunk).toBe("@@ -1 +1 @@ fn main");
  });
});

describe("diffStats", () => {
  it("counts added and removed lines", () => {
    expect(diffStats(parseDiff(SAMPLE))).toEqual({ added: 1, removed: 1 });
    expect(diffStats([])).toEqual({ added: 0, removed: 0 });
  });
});
