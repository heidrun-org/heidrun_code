// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { closeSavedSearchModal, openEditSavedSearchModal, openSaveSearchModal, savedSearchModal } from "./saved_search_modal";

beforeEach(() => {
  closeSavedSearchModal();
});

describe("savedSearchModal", () => {
  it("starts closed", () => {
    expect(savedSearchModal.open).toBe(false);
  });

  it("opens in the mode save with the list, the search to keep, and no name", () => {
    openSaveSearchModal("requests", "label:bug");
    expect(savedSearchModal).toMatchObject({ open: true, mode: "save", group: "requests", query: "label:bug", name: "" });
  });

  it("opens in the mode edit with the list, the name of the saved search, and no search to keep", () => {
    openSaveSearchModal("issues", "label:bug");
    openEditSavedSearchModal("requests", "Bugs", "workspace");
    expect(savedSearchModal).toMatchObject({
      open: true,
      mode: "edit",
      group: "requests",
      query: "",
      name: "Bugs",
      level: "workspace",
    });
  });

  it("opens in the mode save with the level user, even after a window that edited the level workspace", () => {
    openEditSavedSearchModal("requests", "Bugs", "workspace");
    openSaveSearchModal("issues", "label:bug");
    expect(savedSearchModal.level).toBe("user");
  });

  it("closes", () => {
    openSaveSearchModal("issues", "label:bug");
    closeSavedSearchModal();
    expect(savedSearchModal.open).toBe(false);
  });
});
