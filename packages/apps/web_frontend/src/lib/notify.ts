import { invoke } from "@tauri-apps/api/core";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { settings } from "../stores/settings";
import type { NotificationKind } from "./notification_channels";

const minutes = (hhmm: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/** Inside the quiet hours set in the "A" menu (may span midnight: 20:00 → 08:00). */
export function isQuiet(d = new Date()): boolean {
  const from = minutes(settings.quietFrom);
  const to = minutes(settings.quietTo);
  if (from === null || to === null || from === to) return false;
  const now = d.getHours() * 60 + d.getMinutes();
  return from < to ? now >= from && now < to : now >= from || now < to;
}

let granted: boolean | null = null;

/**
 * Plays a system sound of macOS through the application, so that the sound does not depend on the way that macOS shows the
 * banner (issue #857). A failure is ignored: the sound is a convenience.
 */
async function playSound(soundName: string): Promise<void> {
  try {
    await invoke("play_system_sound", { name: soundName });
  } catch {
    /* no sound player, or an unknown sound */
  }
}

/**
 * Shows one system notification, and plays a sound when a sound name is given. The sound plays even when macOS does not
 * allow the banner. Resolves to true when the notification was shown.
 */
async function show(title: string, body: string | undefined, soundName: string | undefined): Promise<boolean> {
  if (soundName !== undefined) {
    void playSound(soundName);
  }
  try {
    if (granted === null) {
      granted = await isPermissionGranted();
      if (!granted) granted = (await requestPermission()) === "granted";
    }
    if (granted) sendNotification({ title, body });
    return !!granted;
  } catch {
    // Notifications are a convenience: never break the UI for them.
    return false;
  }
}

/**
 * Resolves to true when the notification was actually shown. Nothing is shown in the quiet hours, nor when the
 * developer turned the system notification of this kind off in the Settings window. The notification makes the chosen
 * sound only when the developer turned the sound of this kind on.
 */
export async function notify(kind: NotificationKind, title: string, body?: string): Promise<boolean> {
  if (isQuiet()) return false;
  const channel = settings.notificationChannels[kind];
  if (channel.isSystemEnabled === false) return false;
  return show(title, body, channel.isSoundEnabled ? channel.soundName : undefined);
}

/**
 * The button "Test" of the Settings window: shows a real notification of one kind with the settings of that kind, so
 * that the developer sees how it looks and hears how it sounds. The quiet hours do not apply, because the developer
 * asked for it. Nothing is shown when the system notification of this kind is off.
 */
export async function notifyTest(kind: NotificationKind, title: string, body?: string): Promise<boolean> {
  const channel = settings.notificationChannels[kind];
  if (channel.isSystemEnabled === false) return false;
  return show(title, body, channel.isSoundEnabled ? channel.soundName : undefined);
}

/**
 * Wakes the phones that asked for a push: a coding agent needs the developer. The push does not depend on the focus of
 * the window or on the pane that is open, because a phone is for a developer who is away. The quiet hours still apply.
 * A failure is ignored: nothing else depends on the push.
 */
export async function notifyPhone(): Promise<void> {
  if (isQuiet()) return;
  try {
    await invoke("mobile_push");
  } catch {
    /* no phone, or the push service does not answer */
  }
}
