// @vitest-environment node
import { describe, expect, it } from "vitest";
import { gapAt, moveId, reorderSubset, type Box } from "./reorder";

describe("moveId", () => {
  it("moves an item forward and backward", () => {
    expect(moveId(["a", "b", "c"], "a", 3)).toEqual(["b", "c", "a"]);
    expect(moveId(["a", "b", "c"], "c", 0)).toEqual(["c", "a", "b"]);
  });

  it("keeps the order when the id is unknown", () => {
    expect(moveId(["a", "b"], "x", 0)).toEqual(["a", "b"]);
  });
});

describe("reorderSubset", () => {
  it("leaves the hidden items where they were", () => {
    const list = ["a", "x", "b", "y", "c"];
    const result = reorderSubset(list, (item) => item, ["a", "b", "c"], "c", 0);
    expect(result).toEqual(["c", "x", "a", "y", "b"]);
  });
});

describe("gapAt", () => {
  const row: Box[] = [
    { left: 0, top: 0, right: 100, bottom: 40 },
    { left: 100, top: 0, right: 200, bottom: 40 },
    { left: 200, top: 0, right: 300, bottom: 40 },
  ];

  it("gives the gap before the first item, between two items, and after the last item", () => {
    expect(gapAt(row, "x", -50, 20)).toBe(0);
    expect(gapAt(row, "x", 60, 20)).toBe(1);
    expect(gapAt(row, "x", 140, 20)).toBe(1);
    expect(gapAt(row, "x", 160, 20)).toBe(2);
    expect(gapAt(row, "x", 900, 20)).toBe(3);
  });

  it("gives the gap of a column along the vertical axis", () => {
    const column: Box[] = [
      { left: 0, top: 0, right: 200, bottom: 32 },
      { left: 0, top: 32, right: 200, bottom: 64 },
    ];
    expect(gapAt(column, "y", 100, 10)).toBe(0);
    expect(gapAt(column, "y", 100, 50)).toBe(2);
  });

  it("gives null when the pointer is too far from the list across the axis of the list", () => {
    expect(gapAt(row, "x", 150, 20 + 100)).toBeNull();
    expect(gapAt(row, "x", 150, -100)).toBeNull();
  });

  it("gives null for an empty list", () => {
    expect(gapAt([], "x", 0, 0)).toBeNull();
  });
});
