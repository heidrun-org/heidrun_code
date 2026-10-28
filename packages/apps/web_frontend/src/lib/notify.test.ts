import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/plugin-notification", () => ({
  isPermissionGranted: vi.fn(async () => true),
  requestPermission: vi.fn(async () => "granted"),
  sendNotification: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => undefined) }));

import { invoke } from "@tauri-apps/api/core";
import { sendNotification } from "@tauri-apps/plugin-notification";
import { isQuiet, notify, notifyPhone, notifyTest } from "./notify";
import { NotificationChannels } from "./notification_channels";
import { settings } from "../stores/settings";

const at = (hours: number, minutes = 0) => new Date(2026, 0, 15, hours, minutes);

afterEach(() => {
  settings.quietFrom = "";
  settings.quietTo = "";
  settings.notificationChannels = NotificationChannels.createDefaults();
  vi.clearAllMocks();
});

describe("isQuiet", () => {
  it("is never quiet without hours", () => {
    expect(isQuiet(at(3))).toBe(false);
  });

  it("is quiet inside a same-day period", () => {
    settings.quietFrom = "12:00";
    settings.quietTo = "14:00";
    expect(isQuiet(at(13))).toBe(true);
    expect(isQuiet(at(14))).toBe(false);
    expect(isQuiet(at(11, 59))).toBe(false);
  });

  it("is quiet inside a period that spans midnight", () => {
    settings.quietFrom = "20:00";
    settings.quietTo = "08:00";
    expect(isQuiet(at(23))).toBe(true);
    expect(isQuiet(at(2))).toBe(true);
    expect(isQuiet(at(8))).toBe(false);
    expect(isQuiet(at(12))).toBe(false);
    expect(isQuiet(at(20))).toBe(true);
  });

  it("is not quiet when both hours are equal", () => {
    settings.quietFrom = "10:00";
    settings.quietTo = "10:00";
    expect(isQuiet(at(10))).toBe(false);
  });

  it("ignores a badly written hour", () => {
    settings.quietFrom = "late";
    settings.quietTo = "08:00";
    expect(isQuiet(at(2))).toBe(false);
  });
});

describe("notify", () => {
  it("sends a notification outside the quiet hours", async () => {
    expect(await notify("done", "Title", "Body")).toBe(true);
    expect(sendNotification).toHaveBeenCalledWith({ title: "Title", body: "Body" });
  });

  it("sends nothing during the quiet hours", async () => {
    const now = new Date();
    settings.quietFrom = `${String(now.getHours()).padStart(2, "0")}:00`;
    settings.quietTo = `${String((now.getHours() + 1) % 24).padStart(2, "0")}:00`;
    expect(await notify("done", "Title")).toBe(false);
    expect(sendNotification).not.toHaveBeenCalled();
  });
});

describe("notify, the channel of a kind (issue #857)", () => {
  it("makes no sound when the sound of the kind is off", async () => {
    settings.notificationChannels.done.soundName = "Glass";
    await notify("done", "Title", "Body");
    expect(sendNotification).toHaveBeenCalledWith({ title: "Title", body: "Body" });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("plays the chosen sound through the application when the sound of the kind is on", async () => {
    settings.notificationChannels.done.isSoundEnabled = true;
    settings.notificationChannels.done.soundName = "Glass";
    await notify("done", "Title", "Body");
    expect(invoke).toHaveBeenCalledWith("play_system_sound", { name: "Glass" });
    expect(sendNotification).toHaveBeenCalledWith({ title: "Title", body: "Body" });
  });

  it("plays the sound even when macOS does not allow the notification", async () => {
    vi.mocked(sendNotification).mockImplementationOnce(() => {
      throw new Error("not allowed");
    });
    settings.notificationChannels.done.isSoundEnabled = true;
    await notify("done", "Title", "Body");
    expect(invoke).toHaveBeenCalledWith("play_system_sound", { name: "Ping" });
  });

  it("does not fail when the sound cannot be played", async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error("no sound player"));
    settings.notificationChannels.done.isSoundEnabled = true;
    expect(await notify("done", "Title", "Body")).toBe(true);
  });

  it("keeps the sound of one kind away from another kind", async () => {
    settings.notificationChannels.done.isSoundEnabled = true;
    await notify("blocked", "Title", "Body");
    expect(sendNotification).toHaveBeenCalledWith({ title: "Title", body: "Body" });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("sends nothing and makes no sound when the system notification of the kind is off", async () => {
    settings.notificationChannels.done.isSystemEnabled = false;
    settings.notificationChannels.done.isSoundEnabled = true;
    expect(await notify("done", "Title", "Body")).toBe(false);
    expect(sendNotification).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("still sends the other kinds when one kind is off", async () => {
    settings.notificationChannels.done.isSystemEnabled = false;
    expect(await notify("blocked", "Title", "Body")).toBe(true);
    expect(sendNotification).toHaveBeenCalledTimes(1);
  });
});

describe("notifyTest (issue #857)", () => {
  it("shows the notification with the sound of the row, even in the quiet hours", async () => {
    settings.quietFrom = "00:00";
    settings.quietTo = "23:59";
    vi.useFakeTimers();
    vi.setSystemTime(at(12));
    settings.notificationChannels.quota.isSoundEnabled = true;
    settings.notificationChannels.quota.soundName = "Hero";
    const isShown = await notifyTest("quota", "Test", "Body");
    vi.useRealTimers();
    expect(isShown).toBe(true);
    expect(sendNotification).toHaveBeenCalledWith({ title: "Test", body: "Body" });
    expect(invoke).toHaveBeenCalledWith("play_system_sound", { name: "Hero" });
  });

  it("makes no sound when the sound of the row is off", async () => {
    await notifyTest("quota", "Test", "Body");
    expect(sendNotification).toHaveBeenCalledWith({ title: "Test", body: "Body" });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("shows nothing when the system notification of the row is off", async () => {
    settings.notificationChannels.quota.isSystemEnabled = false;
    expect(await notifyTest("quota", "Test", "Body")).toBe(false);
    expect(sendNotification).not.toHaveBeenCalled();
  });
});

describe("notifyPhone", () => {
  it("wakes the phones, and the desktop notification does not", async () => {
    await notify("done", "Title", "body");
    expect(invoke).not.toHaveBeenCalled();
    await notifyPhone();
    expect(invoke).toHaveBeenCalledWith("mobile_push");
  });

  it("wakes no phone in the quiet hours", async () => {
    settings.quietFrom = "00:00";
    settings.quietTo = "23:59";
    vi.useFakeTimers();
    vi.setSystemTime(at(12));
    await notifyPhone();
    vi.useRealTimers();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("does not fail when the push fails", async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error("no push"));
    await expect(notifyPhone()).resolves.toBeUndefined();
  });
});
