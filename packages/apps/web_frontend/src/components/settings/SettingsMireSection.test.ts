import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";

const fake = vi.hoisted(() => ({ status: null as unknown, calls: [] as string[], copied: [] as string[] }));
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (command: string) => {
    fake.calls.push(command);
    if (command === "mire_local_network_enable") {
      fake.status = RUNNING;
    }
    if (command === "mire_local_network_disable") {
      fake.status = OFF;
    }
    if (command === "mire_local_network_new_key") {
      fake.status = { ...RUNNING, address: NEW_ADDRESS };
    }
    return fake.status;
  }),
}));
vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  writeText: vi.fn(async (text: string) => {
    fake.copied.push(text);
  }),
}));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

import SettingsMireSection from "./SettingsMireSection.vue";
import { state } from "../../stores/session";

enableAutoUnmount(afterEach);

const ADDRESS = "http://192.168.1.20:51234/mire?key=" + "a".repeat(64);
const NEW_ADDRESS = "http://192.168.1.20:51234/mire?key=" + "b".repeat(64);
const QR = '<svg id="qr-of-the-test"></svg>';
const RUNNING = { enabled: true, running: true, address: ADDRESS, qr: QR, error: null };
const OFF = { enabled: false, running: false, address: null, qr: null, error: null };

async function mountSection(status: unknown) {
  fake.status = status;
  const wrapper = mount(SettingsMireSection);
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  fake.calls = [];
  fake.copied = [];
});

describe("SettingsMireSection, the section Mire of the Settings window (issue 978)", () => {
  it("shows the option off, with no QR code and no address", async () => {
    const wrapper = await mountSection(OFF);
    const input = wrapper.get("[data-option='mireLocalNetwork'] input");
    expect((input.element as HTMLInputElement).checked).toBe(false);
    expect(wrapper.text()).toContain("Show the Mire on the local network");
    expect(wrapper.find("[data-mire-local-network-qr]").exists()).toBe(false);
    expect(wrapper.find("[data-mire-local-network-address]").exists()).toBe(false);
  });

  it("turns the option on, then shows the QR code and the address with its label", async () => {
    const wrapper = await mountSection(OFF);
    await wrapper.get("[data-option='mireLocalNetwork'] input").setValue(true);
    await flushPromises();
    expect(fake.calls).toContain("mire_local_network_enable");
    expect(wrapper.get("[data-mire-local-network-qr]").html()).toContain("qr-of-the-test");
    expect(wrapper.get("[data-mire-local-network-address]").text()).toBe(ADDRESS);
    expect(wrapper.text()).toContain("Address of the page");
    expect(wrapper.text()).toContain("plain HTTP");
  });

  it("copies the address with the copy button", async () => {
    const wrapper = await mountSection(RUNNING);
    await wrapper.get("[data-copy-address]").trigger("click");
    await flushPromises();
    expect(fake.copied).toEqual([ADDRESS]);
    expect(state.toast).toBe("The address is copied.");
  });

  it("makes a new pairing key, and shows the new address", async () => {
    const wrapper = await mountSection(RUNNING);
    await wrapper.get("[data-new-key]").trigger("click");
    await flushPromises();
    expect(fake.calls).toContain("mire_local_network_new_key");
    expect(wrapper.get("[data-mire-local-network-address]").text()).toBe(NEW_ADDRESS);
  });

  it("turns the option off, and hides the QR code", async () => {
    const wrapper = await mountSection(RUNNING);
    await wrapper.get("[data-option='mireLocalNetwork'] input").setValue(false);
    await flushPromises();
    expect(fake.calls).toContain("mire_local_network_disable");
    expect(wrapper.find("[data-mire-local-network-qr]").exists()).toBe(false);
  });

  it("says when the computer has no local network, and when the port is in use", async () => {
    let wrapper = await mountSection({ ...RUNNING, running: false, address: null, qr: null, error: { kind: "noNetwork", detail: "" } });
    expect(wrapper.get("[data-mire-local-network-error]").text()).toContain("no address on a local network");
    wrapper.unmount();
    wrapper = await mountSection({ ...OFF, enabled: true, error: { kind: "cannotListen", detail: "0.0.0.0:51234: Address already in use" } });
    expect(wrapper.get("[data-mire-local-network-error]").text()).toContain("cannot listen on its port");
    expect(wrapper.get("[data-mire-local-network-error]").text()).toContain("Address already in use");
  });
});
