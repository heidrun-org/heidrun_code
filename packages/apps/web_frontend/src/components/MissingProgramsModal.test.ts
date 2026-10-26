import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import type { VueWrapper } from "@vue/test-utils";

vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

const fake = vi.hoisted(() => ({ programs: null as unknown, isFailing: false }));
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (command: string) => {
    if (command === "required_programs_status") {
      if (fake.isFailing) {
        throw new Error("not in Heidrun Code");
      }
      return fake.programs;
    }
    return null;
  }),
}));

const openWrappers: VueWrapper[] = [];

/** Mounts the notice with a fake state of the two programs, as at the start of Heidrun Code. */
async function mountNotice(isHerdrInstalled: boolean, isNgrokInstalled: boolean, language: "en" | "fr" = "en", isHerdrTooOld = false) {
  fake.programs = {
    herdr: { isInstalled: isHerdrInstalled, isTooOld: isHerdrTooOld },
    ngrok: { isInstalled: isNgrokInstalled, isTooOld: false },
  };
  const { settings } = await import("../stores/settings");
  settings.language = language;
  const { default: MissingProgramsModal } = await import("./MissingProgramsModal.vue");
  const wrapper = mount(MissingProgramsModal, { attachTo: document.body });
  openWrappers.push(wrapper);
  await flushPromises();
  return { wrapper, settings };
}

beforeEach(() => {
  fake.isFailing = false;
  localStorage.clear();
  vi.resetModules();
});

afterEach(() => {
  while (openWrappers.length > 0) {
    openWrappers.pop()?.unmount();
  }
});

describe("MissingProgramsModal", () => {
  it("shows nothing when both programs are installed", async () => {
    const { wrapper } = await mountNotice(true, true);
    expect(wrapper.find(".window-box").exists()).toBe(false);
  });

  it("shows nothing outside Heidrun Code, where the test of the programs fails", async () => {
    fake.isFailing = true;
    const { wrapper } = await mountNotice(false, false);
    expect(wrapper.find(".window-box").exists()).toBe(false);
  });

  it("names a missing Herdr as required, with its install command", async () => {
    const { wrapper } = await mountNotice(false, true);
    const herdr = wrapper.get('[data-program="herdr"]');
    expect(herdr.text()).toContain("Required");
    expect(herdr.get(".command").text()).toBe("curl -fsSL https://herdr.dev/install.sh | sh");
    expect(wrapper.find('[data-program="ngrok"]').exists()).toBe(false);
  });

  it("asks for an update of a Herdr older than 0.9, with the install command", async () => {
    const { wrapper } = await mountNotice(true, true, "en", true);
    const herdr = wrapper.get('[data-program="herdr"]');
    expect(herdr.text()).toContain("Heidrun Code needs Herdr 0.9 or later, and the Herdr on this computer is older.");
    expect(herdr.text()).toContain("After the update, quit Heidrun Code and open it again.");
    expect(herdr.get(".command").text()).toBe("curl -fsSL https://herdr.dev/install.sh | sh");
  });

  it("names a missing ngrok as optional and only for the mobile access, with its install command", async () => {
    const { wrapper } = await mountNotice(true, false);
    const ngrok = wrapper.get('[data-program="ngrok"]');
    expect(ngrok.text()).toContain("Optional");
    expect(ngrok.text()).toContain("Only the mobile access uses ngrok.");
    expect(ngrok.get(".command").text()).toBe("brew install ngrok");
  });

  it("names both programs, Herdr first, when both are missing", async () => {
    const { wrapper } = await mountNotice(false, false);
    const programNames = wrapper.findAll("[data-program]").map((section) => section.attributes("data-program"));
    expect(programNames).toEqual(["herdr", "ngrok"]);
  });

  it("closes with the button Continue, and lets the user go into the application", async () => {
    const { wrapper } = await mountNotice(false, true);
    await wrapper.get("button.primary").trigger("click");
    expect(wrapper.find(".window-box").exists()).toBe(false);
  });

  it("closes with the key Escape", async () => {
    const { wrapper } = await mountNotice(false, true);
    await wrapper.get(".overlay").trigger("keydown", { key: "Escape" });
    expect(wrapper.find(".window-box").exists()).toBe(false);
  });

  it("remembers that it named a missing ngrok, so it does not name it again", async () => {
    const { settings } = await mountNotice(true, false);
    expect(settings.ngrokMissingNoticeShown).toBe(true);
  });

  it("does not remember anything about ngrok when ngrok is installed", async () => {
    const { settings } = await mountNotice(false, true);
    expect(settings.ngrokMissingNoticeShown).toBe(false);
  });

  it("says the same thing in French", async () => {
    const { wrapper } = await mountNotice(false, false, "fr");
    expect(wrapper.get("h2").text()).toBe("Heidrun Code a besoin de programmes qui ne sont pas installés");
    expect(wrapper.get('[data-program="herdr"]').text()).toContain("Obligatoire");
    expect(wrapper.get('[data-program="ngrok"]').text()).toContain("Facultatif");
  });
});
