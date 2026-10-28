import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import type { VueWrapper } from "@vue/test-utils";

const opener = vi.hoisted(() => ({ openUrl: vi.fn(async (_address: string) => {}) }));
vi.mock("@tauri-apps/plugin-opener", () => opener);
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

const fake = vi.hoisted(() => ({ status: null as unknown, programs: null as unknown, isLeftoverKilled: false, stopCalls: 0 }));
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (command: string) => {
    if (command === "mobile_stop_leftover_ngrok") {
      fake.stopCalls += 1;
      return fake.isLeftoverKilled;
    }
    if (command === "mobile_status") {
      return fake.status;
    }
    if (command === "required_programs_status") {
      return fake.programs;
    }
    return null;
  }),
}));

const openWrappers: VueWrapper[] = [];

async function mountSection(status: unknown, language: "en" | "fr" = "en") {
  fake.status = status;
  const { settings } = await import("../../stores/settings");
  settings.language = language;
  const { default: SettingsMobileAccessSection } = await import("./SettingsMobileAccessSection.vue");
  const wrapper = mount(SettingsMobileAccessSection);
  openWrappers.push(wrapper);
  await flushPromises();
  return wrapper;
}

const QR = '<svg id="qr-of-the-test"></svg>';

const LINK = "https://properly-pouring-thaw.ngrok-free.dev/#t=" + "a".repeat(64);
const RUNNING = { enabled: true, running: true, url: "https://properly-pouring-thaw.ngrok-free.dev/", qr: QR, link: LINK, error: null };
const OPENING = { enabled: true, running: false, url: null, qr: null, link: null, error: null };
const OFF = { enabled: false, running: false, url: null, qr: null, link: null, error: null };

const WORDS_OF_THE_FIRST_WORK = [/iPhone/, /iPad/, /Tailscale/i, /Safari/, /Home Screen/, /\bMac\b/];

beforeEach(() => {
  fake.programs = null;
  fake.isLeftoverKilled = false;
  fake.stopCalls = 0;
  opener.openUrl.mockClear();
  localStorage.clear();
  vi.resetModules();
});

afterEach(() => {
  while (openWrappers.length > 0) {
    openWrappers.pop()?.unmount();
  }
});

describe("SettingsMobileAccessSection, with the access off", () => {
  it("shows the switch, an information card about the ngrok tunnel, and no QR code", async () => {
    const wrapper = await mountSection(OFF);
    const switchInput = wrapper.get('input[role="switch"]');
    expect(wrapper.get(`label[for="${switchInput.attributes("id")}"]`).text()).toBe("Turn on mobile access");
    expect((switchInput.element as HTMLInputElement).checked).toBe(false);
    expect(wrapper.text()).not.toContain("opens an ngrok tunnel with the program ngrok");
    const mark = wrapper.findAll(".information-card-part").find((part) => part.get('[role="img"]').attributes("aria-label") === "About the option “Turn on mobile access”")!;
    await mark.trigger("click");
    expect(wrapper.get(".popover").text()).toContain("Heidrun Code opens a tunnel with the program ngrok");
    expect(wrapper.find(".qr").exists()).toBe(false);
  });

  it("has no title iPhone and iPad, and no word of the first work: Tailscale, Safari, Home Screen, Mac", async () => {
    const wrapper = await mountSection(OFF);
    expect(wrapper.find(".eyebrow").exists()).toBe(false);
    for (const word of WORDS_OF_THE_FIRST_WORK) {
      expect(wrapper.text()).not.toMatch(word);
    }
  });
});

describe("SettingsMobileAccessSection, while the tunnel opens", () => {
  it("says that the tunnel opens, with no QR code and no error", async () => {
    const wrapper = await mountSection(OPENING);
    expect(wrapper.text()).toContain("Opening the tunnel…");
    expect(wrapper.find(".qr").exists()).toBe(false);
    expect(wrapper.find(".alert").exists()).toBe(false);
  });
});

describe("SettingsMobileAccessSection, with the tunnel open", () => {
  it("shows the QR code, the address of the tunnel, and one step: scan the QR code with the camera of the phone", async () => {
    const wrapper = await mountSection(RUNNING);
    expect(wrapper.find(".qr svg#qr-of-the-test").exists()).toBe(true);
    expect(wrapper.text()).toContain("Scan this QR code with the camera of the phone.");
    expect(wrapper.find("ol").exists()).toBe(false);
    expect(wrapper.text()).toContain("https://properly-pouring-thaw.ngrok-free.dev/");
    expect(wrapper.text()).not.toContain("127.0.0.1");
  });

  it("shows the address as a link that holds the pairing key, and shows no key in the text", async () => {
    const wrapper = await mountSection(RUNNING);
    const link = wrapper.get("a.mono");
    expect(link.attributes("href")).toBe(LINK);
    expect(link.text()).toBe("https://properly-pouring-thaw.ngrok-free.dev/");
    expect(wrapper.text()).not.toContain("#t=");
    expect(link.attributes("title")).toBe("Open the page, already paired, in the web browser of this computer");
  });

  it("opens the pairing link in the web browser when the developer clicks the address, and does not follow the link in the window", async () => {
    const wrapper = await mountSection(RUNNING);
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    wrapper.get("a.mono").element.dispatchEvent(click);
    await flushPromises();
    expect(click.defaultPrevented).toBe(true);
    expect(opener.openUrl).toHaveBeenCalledTimes(1);
    expect(opener.openUrl).toHaveBeenCalledWith(LINK);
  });

  it("says that the phone shows a warning page of ngrok the first time, and that the address stays the same", async () => {
    const wrapper = await mountSection(RUNNING);
    expect(wrapper.text()).toContain("The first time, the phone shows a warning page of ngrok. Tap the button Visit Site.");
    expect(wrapper.text()).toContain("you scan the QR code only once");
  });

  it("keeps the warning about the pairing key and the button to revoke the paired devices", async () => {
    const wrapper = await mountSection(RUNNING);
    expect(wrapper.text()).toContain("The QR code contains the pairing key: do not show it, do not share it.");
    expect(wrapper.get("button.btn").text()).toBe("Revoke the paired devices");
  });

  it("has no word of the first work: iPhone, iPad, Tailscale, Safari, Home Screen, Mac", async () => {
    const wrapper = await mountSection(RUNNING);
    for (const word of WORDS_OF_THE_FIRST_WORK) {
      expect(wrapper.text()).not.toMatch(word);
    }
  });
});

describe("SettingsMobileAccessSection, when something goes wrong", () => {
  it("says how to install the program ngrok, and how to sign in, when it is missing", async () => {
    const wrapper = await mountSection({ ...OPENING, error: { kind: "ngrokMissing", detail: "" } });
    const alert = wrapper.get(".alert");
    expect(alert.text()).toContain("brew install ngrok");
    expect(alert.text()).toContain("ngrok config add-authtoken");
    expect(wrapper.find(".qr").exists()).toBe(false);
  });

  it("says how to sign in to ngrok when the program has no account", async () => {
    const wrapper = await mountSection({ ...OPENING, error: { kind: "ngrokNotSignedIn", detail: "authentication failed: This ngrok session is not authenticated." } });
    const alert = wrapper.get(".alert");
    expect(alert.text()).toContain("Create a free account at ngrok.com");
    expect(alert.text()).toContain("ngrok config add-authtoken");
    expect(alert.get(".mono").text()).toBe("authentication failed: This ngrok session is not authenticated.");
  });

  it("says that another program ngrok already uses the address of the account", async () => {
    const wrapper = await mountSection({ ...OPENING, error: { kind: "ngrokAddressInUse", detail: "ERR_NGROK_334" } });
    expect(wrapper.get(".alert").text()).toContain("Another program ngrok already uses the address of your ngrok account.");
  });

  it("shows the button Stop the old ngrok only with the error ngrokAddressInUse", async () => {
    const wrapper = await mountSection({ ...OPENING, error: { kind: "ngrokAddressInUse", detail: "ERR_NGROK_334" } });
    expect(wrapper.get(".stop-old-ngrok").text()).toBe("Stop the old ngrok");
    vi.resetModules();
    const otherWrapper = await mountSection({ ...OPENING, error: { kind: "ngrokStopped", detail: "" } });
    expect(otherWrapper.find(".stop-old-ngrok").exists()).toBe(false);
  });

  it("stops the old ngrok with the button, and says nothing more when it was stopped", async () => {
    fake.isLeftoverKilled = true;
    const wrapper = await mountSection({ ...OPENING, error: { kind: "ngrokAddressInUse", detail: "ERR_NGROK_334" } });
    await wrapper.get(".stop-old-ngrok").trigger("click");
    await flushPromises();
    expect(fake.stopCalls).toBe(1);
    expect(wrapper.find(".old-ngrok-not-found").exists()).toBe(false);
  });

  it("says to close the other ngrok by hand when Heidrun Code did not start it", async () => {
    fake.isLeftoverKilled = false;
    const wrapper = await mountSection({ ...OPENING, error: { kind: "ngrokAddressInUse", detail: "ERR_NGROK_334" } });
    await wrapper.get(".stop-old-ngrok").trigger("click");
    await flushPromises();
    expect(wrapper.get(".old-ngrok-not-found").text()).toContain("Heidrun Code did not start the other ngrok. Close it by hand");
    expect(wrapper.get(".kill-all-ngrok").text()).toBe("pkill -x ngrok");
  });

  it("shows the last message of ngrok under the sentence when it stopped", async () => {
    const wrapper = await mountSection({ ...OPENING, error: { kind: "ngrokStopped", detail: "connection reset by peer" } });
    const alert = wrapper.get(".alert");
    expect(alert.text()).toContain("The program ngrok stopped.");
    expect(alert.get(".mono").text()).toBe("connection reset by peer");
  });

  it("writes a sentence for every kind of error that the mobile server sends, in English and in French", async () => {
    const kinds = ["ngrokMissing", "ngrokCannotStart", "ngrokNoAddress", "ngrokStopped", "ngrokNotSignedIn", "ngrokAddressInUse", "cannotListen"];
    for (const language of ["en", "fr"] as const) {
      for (const kind of kinds) {
        vi.resetModules();
        const wrapper = await mountSection({ ...OPENING, error: { kind, detail: "" } }, language);
        const text = wrapper.get(".alert").text();
        expect(text, `${language} ${kind}`).not.toContain("mobileModal.error");
        expect(text.length, `${language} ${kind}`).toBeGreaterThan(20);
      }
    }
  });
});

describe("SettingsMobileAccessSection, in French", () => {
  it("speaks of the tunnel ngrok, and says ordinateur and never Mac", async () => {
    const wrapper = await mountSection({ ...OPENING, error: { kind: "ngrokMissing", detail: "" } }, "fr");
    expect(wrapper.text()).toContain("tunnel ngrok");
    expect(wrapper.text()).toContain("cet ordinateur");
    for (const word of WORDS_OF_THE_FIRST_WORK) {
      expect(wrapper.text()).not.toMatch(word);
    }
  });
});

describe("SettingsMobileAccessSection, the reminder of a missing ngrok (issue 546)", () => {
  it("says, before the access is on, that the mobile access is impossible without ngrok, and how to install it", async () => {
    fake.programs = { herdr: { isInstalled: true }, ngrok: { isInstalled: false } };
    const wrapper = await mountSection(OFF);
    const reminder = wrapper.get(".ngrok-reminder");
    expect(reminder.text()).toContain("Without it, the mobile access is impossible.");
    expect(reminder.text()).toContain("brew install ngrok");
    expect(reminder.text()).toContain("ngrok config add-authtoken");
  });

  it("shows no reminder when ngrok is installed", async () => {
    fake.programs = { herdr: { isInstalled: true }, ngrok: { isInstalled: true } };
    const wrapper = await mountSection(OFF);
    expect(wrapper.find(".ngrok-reminder").exists()).toBe(false);
  });

  it("shows only the error, and no reminder, when the access is on and the error already says that ngrok is missing", async () => {
    fake.programs = { herdr: { isInstalled: true }, ngrok: { isInstalled: false } };
    const wrapper = await mountSection({ ...OPENING, error: { kind: "ngrokMissing", detail: "" } });
    expect(wrapper.find(".ngrok-reminder").exists()).toBe(false);
    expect(wrapper.findAll(".alert")).toHaveLength(1);
  });

  it("says the same thing in French", async () => {
    fake.programs = { herdr: { isInstalled: true }, ngrok: { isInstalled: false } };
    const wrapper = await mountSection(OFF, "fr");
    expect(wrapper.get(".ngrok-reminder").text()).toContain("Sans lui, l’accès mobile est impossible.");
  });
});
