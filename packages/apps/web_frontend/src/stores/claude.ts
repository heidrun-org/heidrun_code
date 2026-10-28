import { reactive } from "vue";
import { invoke } from "@tauri-apps/api/core";
import * as api from "../lib/api";
import { allPanes, sendPrompt, toast } from "./session";
import { t } from "../i18n/index";

interface StatuslineState {
  installed: boolean;
  settings_path: string;
  chained: string | null;
  hidden: boolean;
}

/** Whether Claude Code's status line reports to Heidrun Code (see src-tauri/src/claude.rs). */
export const claudeLink = reactive({
  loaded: false,
  installed: false,
  chained: null as string | null,
  hidden: false,
  busy: false,
});

function apply(s: StatuslineState) {
  claudeLink.installed = s.installed;
  claudeLink.chained = s.chained;
  claudeLink.hidden = s.hidden;
  claudeLink.loaded = true;
}

export async function loadClaudeLink() {
  try {
    apply(await invoke<StatuslineState>("claude_statusline_state"));
  } catch {
    claudeLink.loaded = true;
  }
}

export async function enableClaudeLink(showSuccess = true) {
  claudeLink.busy = true;
  try {
    apply(await invoke<StatuslineState>("claude_statusline_install"));
    if (showSuccess) toast(t("claudeStore.trackingEnabled"));
  } catch (e) {
    toast(String(e));
  } finally {
    claudeLink.busy = false;
  }
}

export async function setClaudeLineHidden(hidden: boolean) {
  try {
    apply(await invoke<StatuslineState>("claude_statusline_set_hidden", { hidden }));
    toast(hidden ? t("claudeStore.statusLineHidden") : t("claudeStore.statusLineShown"));
  } catch (e) {
    toast(String(e));
  }
}

// ---- Remote Control ------------------------------------------------------
// Claude Code exposes no API for it: the state is read from the "/rc active"
// indicator it draws in the prompt footer (hidden when the terminal is too narrow).

export type RcState = "active" | "failed" | "off";

export const remote = reactive({
  byPane: {} as Record<string, RcState>,
  urls: {} as Record<string, string>,
  /** Pane whose session link is shown in the QR code window. */
  openFor: null as string | null,
  atStartup: null as boolean | null,
});

// Marker phrases Claude Code prints, newest wins. The footer "/rc active" indicator is
// often hidden (narrow terminal, custom status line), so the messages it writes in the
// conversation count too.
const RC_MARKERS: [RegExp, RcState][] = [
  [/\/rc active/gi, "active"],
  [/remote-control is active/gi, "active"],
  [/remote control (is )?(connected|active|enabled)/gi, "active"],
  [/this session is available in the claude mobile app/gi, "active"],
  [/remote control (failed|error)|couldn.t (connect|reconnect) to (your )?remote control|\/rc failed/gi, "failed"],
  [/remote control (disconnected|stopped|disabled|is off)|disconnected (from )?remote control|remote control not started here/gi, "off"],
];

function readRc(screen: string): { state: RcState; url?: string } | null {
  let best: { at: number; state: RcState } | null = null;
  for (const [re, state] of RC_MARKERS) {
    for (const m of screen.matchAll(re)) {
      if (!best || m.index! >= best.at) best = { at: m.index!, state };
    }
  }
  if (!best) return null;
  const urls = [...screen.matchAll(/https:\/\/claude\.ai\/code\/session_[A-Za-z0-9]+/g)];
  return { state: best.state, url: urls.length ? urls[urls.length - 1][0] : undefined };
}

async function pollRc() {
  const panes = allPanes.value.filter((p) => p.agent?.includes("claude"));
  for (const p of panes) {
    try {
      const r = await api.request<{ read: { text: string } }>("pane.read", {
        pane_id: p.pane_id,
        source: "recent_unwrapped",
        lines: 400,
      });
      const found = readRc(r.read.text);
      // No marker in what is still on screen: keep the last known state.
      if (found) {
        remote.byPane[p.pane_id] = found.state;
        if (found.url) remote.urls[p.pane_id] = found.url;
      }
    } catch {
      /* keep the last state */
    }
  }
}

/** /remote-control toggles: it connects, or opens the status panel (URL, QR code, disconnect). */
export async function toggleRemoteControl(paneId: string) {
  await sendPrompt(paneId, "/remote-control");
  // Claude answers within a second or two: check right away instead of waiting 8 s.
  window.setTimeout(pollRc, 1500);
  window.setTimeout(pollRc, 4000);
}

export async function loadRcStartup() {
  try {
    remote.atStartup = await invoke<boolean | null>("claude_rc_startup");
  } catch {
    /* ignore */
  }
}

export async function setRcStartup(enabled: boolean) {
  try {
    remote.atStartup = await invoke<boolean | null>("claude_set_rc_startup", { enabled });
    toast(enabled ? t("claudeStore.remoteControlEnabled") : t("claudeStore.remoteControlDisabled"));
  } catch (e) {
    toast(String(e));
  }
}

let rcTimer: number | undefined;
export function startRemoteWatch() {
  if (rcTimer) return;
  loadRcStartup();
  pollRc();
  rcTimer = window.setInterval(pollRc, 8000);
}

export async function disableClaudeLink(showSuccess = true) {
  claudeLink.busy = true;
  try {
    apply(await invoke<StatuslineState>("claude_statusline_uninstall"));
    if (showSuccess) toast(t("claudeStore.trackingDisabled"));
  } catch (e) {
    toast(String(e));
  } finally {
    claudeLink.busy = false;
  }
}
