import { afterEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import ConfirmModal from "./ConfirmModal.vue";
import { askChoiceWithRemember, askConfirm, confirmDialog } from "../stores/confirm";

afterEach(() => {
  confirmDialog.resolve?.(false);
  confirmDialog.open = false;
});

describe("ConfirmModal", () => {
  it("shows the title and the confirm label", () => {
    askConfirm("Close the pane?", "Close");
    const wrapper = mount(ConfirmModal);
    expect(wrapper.get("h2").text()).toBe("Close the pane?");
    expect(wrapper.get(".danger").text()).toBe("Close");
  });

  it("confirms with the main button", async () => {
    const answer = askConfirm("Q?", "Yes");
    await mount(ConfirmModal).get(".danger").trigger("click");
    expect(await answer).toBe(true);
  });

  it("cancels with the other button", async () => {
    const answer = askConfirm("Q?", "Yes");
    await mount(ConfirmModal).findAll("button")[0].trigger("click");
    expect(await answer).toBe(false);
  });

  it("cancels with the Escape key", async () => {
    const answer = askConfirm("Q?", "Yes");
    await mount(ConfirmModal).get(".overlay").trigger("keydown.esc");
    expect(await answer).toBe(false);
  });

  it("confirms with the Enter key", async () => {
    const answer = askConfirm("Q?", "Yes");
    await mount(ConfirmModal).get(".overlay").trigger("keydown.enter");
    expect(await answer).toBe(true);
  });

  it("exposes an alert dialog role", () => {
    askConfirm("Q?", "Yes");
    expect(mount(ConfirmModal).find('[role="alertdialog"]').exists()).toBe(true);
  });

  it("shows several choices on one line in a wider window, the title on two lines, and the checkbox (issue #956)", async () => {
    const choices = [
      { id: "openDefault", label: "Open in the default app" },
      { id: "open", label: "Open in Heidrun Code" },
    ];
    const answer = askChoiceWithRemember("Outside the folder.\nHow?", choices, "No", "Remember my choice");
    const wrapper = mount(ConfirmModal);
    expect(wrapper.get(".window-box").classes()).toContain("wide");
    expect(wrapper.get("h2").element.textContent).toBe("Outside the folder.\nHow?");
    expect(wrapper.findAll(".row button").map((button) => button.text())).toEqual(["No", "Open in the default app", "Open in Heidrun Code"]);
    expect(wrapper.find(".danger").exists()).toBe(false);
    expect(wrapper.get(".primary").text()).toBe("Open in Heidrun Code");
    await wrapper.get('[data-test="confirm-remember"]').setValue(true);
    await wrapper.get('[data-choice="openDefault"]').trigger("click");
    expect(await answer).toEqual({ choiceId: "openDefault", isRemembered: true });
  });

  it("keeps the usual width for a question with one choice", () => {
    askConfirm("Close the pane?", "Close");
    expect(mount(ConfirmModal).get(".window-box").classes()).not.toContain("wide");
  });
});
