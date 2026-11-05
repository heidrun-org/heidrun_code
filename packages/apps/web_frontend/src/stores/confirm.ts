import { reactive } from "vue";

/** The confirmation modal dialog shown before a destructive action. */
export const confirmDialog = reactive({
  open: false,
  title: "",
  confirmLabel: "",
  /** The label of the button that cancels, or "" for the default label "Cancel". */
  cancelLabel: "",
  /** The label of the checkbox "Remember my choice", or "" when the dialog has no checkbox (issue #956). */
  rememberLabel: "",
  /** Whether the checkbox "Remember my choice" is checked. */
  isRemembered: false,
  /** Whether the main button shows a destructive action, in red. */
  isDanger: true,
  /** The other choices, each one a button before the main button, or [] for a dialog with one choice (issue #956). */
  otherChoices: [] as DialogChoice[],
  /** The identifier of the choice that the developer clicked, or "" for the main button. */
  chosenId: "",
  resolve: null as ((ok: boolean) => void) | null,
});

/** One choice of a dialog with several choices: one button. */
export type DialogChoice = {
  /** The identifier that the caller receives. */
  id: string;
  /** The label of the button. */
  label: string;
};

/** The answer of the developer to a question with the checkbox "Remember my choice". */
export type RememberedChoice = {
  /** The identifier of the chosen choice, or null when the developer cancelled. */
  choiceId: string | null;
  /** True when the developer checked "Remember my choice". */
  isRemembered: boolean;
};

/**
 * Opens the confirmation modal dialog and resolves to true when the user confirms.
 * The dialog has no timer: it stays open until the user confirms or cancels.
 */
export function askConfirm(title: string, confirmLabel: string): Promise<boolean> {
  // Only one dialog at a time: a second request cancels the first one.
  if (confirmDialog.open) {
    confirmDialog.isRemembered = false;
    confirmDialog.resolve?.(false);
  }
  return new Promise((resolve) => {
    Object.assign(confirmDialog, { open: true, title, confirmLabel, cancelLabel: "", rememberLabel: "", isRemembered: false, isDanger: true, otherChoices: [], chosenId: "", resolve });
  });
}

/**
 * Opens the confirmation modal dialog with several choices and the checkbox "Remember my choice", unchecked, for a question
 * that is not destructive (issue #956).
 * @param title - The question.
 * @param choices - The choices, one button each, in the order of the buttons. The last one is the main button, which the key
 * Enter clicks.
 * @param cancelLabel - The label of the button that cancels.
 * @param rememberLabel - The label of the checkbox.
 * @returns The chosen choice and the state of the checkbox. The key Escape and a click outside cancel, as the button does. A
 * second dialog cancels this one, and the cancel is never remembered.
 */
export async function askChoiceWithRemember(title: string, choices: DialogChoice[], cancelLabel: string, rememberLabel: string): Promise<RememberedChoice> {
  const main = choices[choices.length - 1];
  const ok = askConfirm(title, main.label);
  Object.assign(confirmDialog, { cancelLabel, rememberLabel, isDanger: false, otherChoices: choices.slice(0, -1) });
  const resolve = confirmDialog.resolve;
  let isRemembered = false;
  let chosenId = "";
  confirmDialog.resolve = (answer) => {
    isRemembered = confirmDialog.isRemembered;
    chosenId = confirmDialog.chosenId;
    resolve?.(answer);
  };
  const isChosen = await ok;
  return { choiceId: isChosen ? chosenId || main.id : null, isRemembered };
}

/**
 * Closes the dialog with one of its other choices.
 * @param id - The identifier of the choice.
 */
export function answerChoice(id: string): void {
  confirmDialog.chosenId = id;
  answerConfirm(true);
}

/** Closes the confirmation modal dialog and gives the answer of the user to the caller of `askConfirm`. */
export function answerConfirm(ok: boolean): void {
  const resolve = confirmDialog.resolve;
  confirmDialog.open = false;
  confirmDialog.resolve = null;
  resolve?.(ok);
  confirmDialog.isRemembered = false;
  confirmDialog.chosenId = "";
}
