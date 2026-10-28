// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { answerConfirm, askConfirm, confirmDialog } from "./confirm";

beforeEach(() => {
  answerConfirm(false);
});

describe("askConfirm", () => {
  it("opens the dialog with the title and the label", () => {
    askConfirm("Delete?", "Delete");
    expect(confirmDialog.open).toBe(true);
    expect(confirmDialog.title).toBe("Delete?");
    expect(confirmDialog.confirmLabel).toBe("Delete");
  });

  it("resolves to true when the user confirms", async () => {
    const answer = askConfirm("Delete?", "Delete");
    answerConfirm(true);
    expect(await answer).toBe(true);
    expect(confirmDialog.open).toBe(false);
  });

  it("resolves to false when the user cancels", async () => {
    const answer = askConfirm("Delete?", "Delete");
    answerConfirm(false);
    expect(await answer).toBe(false);
  });

  it("cancels a first dialog when a second one opens", async () => {
    const first = askConfirm("First?", "Yes");
    const second = askConfirm("Second?", "Yes");
    expect(await first).toBe(false);
    expect(confirmDialog.title).toBe("Second?");
    answerConfirm(true);
    expect(await second).toBe(true);
  });
});

describe("answerConfirm", () => {
  it("is harmless when no dialog is open", () => {
    expect(() => answerConfirm(true)).not.toThrow();
    expect(confirmDialog.resolve).toBeNull();
  });
});
