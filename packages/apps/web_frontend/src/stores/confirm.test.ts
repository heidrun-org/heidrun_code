// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { answerConfirm, askConfirm, answerChoice, askChoiceWithRemember, confirmDialog } from "./confirm";

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

describe("askChoiceWithRemember (issue #956)", () => {
  const CHOICES = [
    { id: "openDefault", label: "Open in the default app" },
    { id: "open", label: "Open in Heidrun Code" },
  ];

  it("opens the dialog with the labels, the last choice as the main button, the checkbox unchecked, and no red", () => {
    askChoiceWithRemember("How?", CHOICES, "No", "Remember my choice");
    expect(confirmDialog.title).toBe("How?");
    expect(confirmDialog.confirmLabel).toBe("Open in Heidrun Code");
    expect(confirmDialog.otherChoices).toEqual([CHOICES[0]]);
    expect(confirmDialog.cancelLabel).toBe("No");
    expect(confirmDialog.rememberLabel).toBe("Remember my choice");
    expect(confirmDialog.isRemembered).toBe(false);
    expect(confirmDialog.isDanger).toBe(false);
  });

  it("gives the chosen choice and the state of the checkbox", async () => {
    const main = askChoiceWithRemember("How?", CHOICES, "No", "Remember my choice");
    confirmDialog.isRemembered = true;
    answerConfirm(true);
    expect(await main).toEqual({ choiceId: "open", isRemembered: true });
    const other = askChoiceWithRemember("How?", CHOICES, "No", "Remember my choice");
    answerChoice("openDefault");
    expect(await other).toEqual({ choiceId: "openDefault", isRemembered: false });
    const no = askChoiceWithRemember("How?", CHOICES, "No", "Remember my choice");
    answerConfirm(false);
    expect(await no).toEqual({ choiceId: null, isRemembered: false });
  });

  it("never remembers a dialog that a second dialog cancels, and gives the plain dialog back its usual look", async () => {
    const first = askChoiceWithRemember("How?", CHOICES, "No", "Remember my choice");
    confirmDialog.isRemembered = true;
    askConfirm("Delete?", "Delete");
    expect(await first).toEqual({ choiceId: null, isRemembered: false });
    expect(confirmDialog.rememberLabel).toBe("");
    expect(confirmDialog.cancelLabel).toBe("");
    expect(confirmDialog.otherChoices).toEqual([]);
    expect(confirmDialog.isDanger).toBe(true);
  });
});
