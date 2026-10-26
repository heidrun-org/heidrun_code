<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { Terminal, type IBufferLine, type IDecoration, type IDisposable, type ILink, type IMarker } from "@xterm/xterm";
import { openUrl } from "@tauri-apps/plugin-opener";
import { EMPTY_CONTEXT, REF_COLORS, claudeCommands, agentListState, refContext, type RefContext } from "../lib/refs";
import { DetectionFamilies } from "../lib/detection_families";
import { DetectionPatterns } from "../lib/detection_patterns";
import { HoverButtonsPlacement } from "../lib/hover_buttons_placement";
import { TerminalDetection, type DetectedItem, type DetectionAction } from "../lib/terminal_detection";
import { sendPrompt, toast } from "../stores/session";
import { openIssue } from "../stores/issues";
import { openFileRef } from "../stores/files";
import { fold, search } from "../stores/search";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { ClipboardAddon } from "@xterm/addon-clipboard";
import { osc52Provider, writeToClipboard } from "../lib/clipboard";
import { TerminalSelection } from "../lib/terminal_selection";
import { trailingDebounce, type TrailingDebounce } from "../lib/trailing_debounce";
import { createRefitHold, type RefitHold } from "../lib/refit_hold";
import { decideAfterStop, retryDelayMs } from "../lib/terminal_attach_retry";
import { resolvedTheme } from "../stores/theme";
import { TERMINAL_THEMES } from "../lib/terminal_themes";
import { t } from "../i18n/index";

const REF_COLORS_LIGHT: typeof REF_COLORS = {
  issue: "#0b5cc2",
  mr: "#7d4cc4",
  ticket: "#0e7c78",
  commit: "#9a5b13",
};

import { FONT_DEFAULT, fontStack, settings } from "../stores/settings";
import { selectionReaders } from "../stores/notes";
import { ImageDrop } from "../lib/image_drop";

const props = defineProps<{
  terminalId: string;
  paneId: string;
  focused: boolean;
  cwd?: string | null;
  /** Agent running in the pane ("claude", "codex"…), if any. */
  agent?: string | null;
}>();
const emit = defineEmits<{ pin: [text: string] }>();

const hasSelection = ref(false);
const terminalSelection = new TerminalSelection();

const el = ref<HTMLDivElement>();
const exited = ref(false);
/** True when Herdr refused the attach because another client holds the terminal. */
const heldByAnotherClient = ref(false);
const id = crypto.randomUUID();

let term: Terminal | null = null;
let fit: FitAddon | null = null;
let observer: ResizeObserver | null = null;
let refit: TrailingDebounce | null = null;
let refitHold: RefitHold | null = null;
/** Time without any size change, in milliseconds, before the terminal starts to take its new size. */
const REFIT_DELAY_MS = 300;
/** Time without any output from Herdr, in milliseconds, that means its redraw for the new size is complete. */
const REFIT_QUIET_MS = 120;
/** Longest time, in milliseconds, that the old screen stays on show while the redraw of Herdr is awaited. */
const REFIT_MAX_MS = 500;
const MOUSE_MODES = new Set([9, 1000, 1001, 1002, 1003, 1005, 1006, 1015, 1016]);
// Alternate screen: ignored. Herdr redraws the whole pane anyway and there is no
// scrollback here, but xterm only allows decorations (reference colors) on the normal screen.
const ALT_MODES = new Set([47, 1047, 1049]);
const requestedMouse = new Set<number>();
const unlisten: UnlistenFn[] = [];

function decode(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Herdr refuses an attach while it is reading the same terminal for someone else
// (the app's own pane.read polling, another client…): "has a read in progress; retry".
// That is transient: retry quietly a few times before showing "Terminal detached".
// Herdr also refuses an attach while another client holds the terminal. That client can be the old attach client of
// this application, which is still stopping, so retry twice. After that, show the choice at once, and keep the text
// of the refusal on the screen: see `decideAfterStop`.
let spawnedAt = 0;
let retries = 0;
let lastOutput = "";
const textDecoder = new TextDecoder();

/**
 * Gives the terminal the size of its container. While Herdr is attached, the new size goes to Herdr first and
 * the terminal takes it once the redraw of Herdr is complete, see `createRefitHold`.
 */
function applyFit() {
  if (term === null || fit === null || refitHold === null) {
    return;
  }
  if (refitHold.isBusy()) {
    refit?.call();
    return;
  }
  if (exited.value) {
    fit.fit();
    return;
  }
  const size = fit.proposeDimensions();
  if (size === undefined || Number.isNaN(size.cols) || Number.isNaN(size.rows)) {
    return;
  }
  if (size.cols === term.cols && size.rows === term.rows) {
    return;
  }
  refitHold.start(size.cols, size.rows);
}

async function attach(takeover = false, quiet = false) {
  if (!term) return;
  refitHold?.cancel();
  exited.value = false;
  heldByAnotherClient.value = false;
  if (!quiet) retries = 0;
  spawnedAt = Date.now();
  lastOutput = "";
  try {
    await invoke("pty_spawn", { id, terminalId: props.terminalId, cols: term.cols, rows: term.rows, takeover });
  } catch (e) {
    term.writeln(`\r\n\x1b[31m${t("terminalView.attachFailed", { error: String(e) })}\x1b[0m`);
    exited.value = true;
  }
}

onMounted(async () => {
  term = new Terminal({
    fontFamily: fontStack(),
    fontSize: FONT_DEFAULT,
    lineHeight: 1.25,
    cursorBlink: true,
    macOptionIsMeta: true,
    // In "app" mouse mode, ⌥ + drag still forces a local selection.
    macOptionClickForcesSelection: true,
    // A right click keeps the selection, so that the item Copy of the context menu copies it. On macOS, xterm selects the
    // word under the pointer by default, which replaced the selection of the developer (issue #805).
    rightClickSelectsWord: false,
    scrollback: 0, // Herdr owns the scrollback; the attach client redraws the screen.
    allowProposedApi: true,
    theme: TERMINAL_THEMES[resolvedTheme.value],
  });
  try {
    await document.fonts.load(`${FONT_DEFAULT}px ${fontStack()}`);
  } catch {
    /* ignore */
  }
  fit = new FitAddon();
  term.loadAddon(fit);
  // Web addresses and references open with ⌘-click, like in iTerm (a plain click stays a click). The link providers
  // are built by `buildLinkProviders`, and built again when a switch of the detection changes.
  buildLinkProviders();
  term.loadAddon(new ClipboardAddon(osc52Provider));

  // Mouse reporting: Herdr's attach client asks for it, which turns every drag into
  // mouse events and makes text selection impossible. In "select" mode we drop those
  // requests (and remember them, to restore them if the user switches back to "app").
  term.parser.registerCsiHandler({ prefix: "?", final: "h" }, (params) => {
    const modes = params.flat() as number[];
    const mouse = modes.filter((m) => MOUSE_MODES.has(m));
    mouse.forEach((m) => requestedMouse.add(m));
    const dropMouse = settings.mouseMode === "select" && mouse.length > 0;
    const dropAlt = modes.some((m) => ALT_MODES.has(m));
    if (!dropMouse && !dropAlt) return false;
    const rest = modes.filter((m) => !ALT_MODES.has(m) && !(dropMouse && MOUSE_MODES.has(m)));
    if (rest.length) term!.write(`\x1b[?${rest.join(";")}h`);
    return true;
  });
  term.parser.registerCsiHandler({ prefix: "?", final: "l" }, (params) => {
    const modes = params.flat() as number[];
    modes.forEach((m) => requestedMouse.delete(m));
    if (!modes.some((m) => ALT_MODES.has(m))) return false;
    const rest = modes.filter((m) => !ALT_MODES.has(m));
    if (rest.length) term!.write(`\x1b[?${rest.join(";")}l`);
    return true;
  });

  // ⌘C copies the local selection; without one it falls through to the terminal.
  // ⇧↵ / ⌥↵ insert a new line instead of sending: ESC + CR, the sequence Claude Code,
  // Codex and zsh read as "newline" (what Option+Enter sends in Terminal/iTerm).
  term.attachCustomKeyEventHandler((e) => {
    if (e.type === "keydown" && e.metaKey && !e.ctrlKey && e.code === "KeyC" && term?.hasSelection()) {
      e.preventDefault();
      e.stopPropagation();
      void copySelection();
      return false;
    }
    if ((e.key === "Enter" || e.code === "NumpadEnter") && (e.shiftKey || e.altKey) && !e.metaKey && !e.ctrlKey) {
      if (e.type === "keydown" && !e.isComposing) {
        e.preventDefault();
        invoke("pty_write", { id, data: "\x1b\r" }).catch(() => {});
      }
      return false;
    }
    return true;
  });
  term.open(el.value!);
  fit.fit();

  term.onSelectionChange(() => {
    hasSelection.value = !!term?.hasSelection();
  });
  selectionReaders.set(props.paneId, () => term?.getSelection() ?? "");

  // Listen before spawning so no early output is lost.
  unlisten.push(
    await listen<{ id: string; data: string }>("pty://data", (e) => {
      if (e.payload.id !== id) return;
      terminalSelection.invalidate();
      const bytes = decode(e.payload.data);
      // Keep the start of the output, to recognize an attach refused by Herdr.
      if (Date.now() - spawnedAt < 4000 && lastOutput.length < 600) lastOutput += textDecoder.decode(bytes, { stream: true });
      if (refitHold?.hold(bytes) !== true) {
        term?.write(bytes);
      }
    }),
    await listen<{ id: string }>("pty://exit", (e) => {
      if (e.payload.id !== id) return;
      const outcome = decideAfterStop(lastOutput, Date.now() - spawnedAt, retries);
      if (outcome === "retry") {
        retries++;
        window.setTimeout(() => {
          term?.reset();
          attach(false, true);
        }, retryDelayMs(lastOutput, retries));
        return;
      }
      heldByAnotherClient.value = outcome === "held";
      exited.value = true;
    }),
  );

  term.onWriteParsed(scheduleRefs);
  term.onResize(() => {
    terminalSelection.invalidate();
    scheduleRefs();
  });
  term.onData((data) => invoke("pty_write", { id, data }).catch(() => {}));

  // Mouse wheel. In "select" mode xterm no longer reports the mouse, so it would turn
  // the wheel into ↑/↓ keys (shell or prompt history). Instead we send real wheel
  // events to Herdr, which scrolls the pane's history as it does in its own UI.
  // ⌥ + wheel does the opposite: ↑/↓ keys, to walk through previous commands.
  el.value!.addEventListener("wheel", onWheel, { capture: true, passive: false });
  el.value!.addEventListener("copy", onCopy, true);
  el.value!.addEventListener("mousedown", onDown, true);
  el.value!.addEventListener("mouseup", onUp, true);

  // While the window or a panel is dragged, the terminal keeps its size and its screen. Once the drag has
  // paused, Herdr gets the new size, and the terminal swaps to it when the redraw of Herdr is complete.
  // Without this, xterm reflows its old lines at once and the garbled screen shows until the redraw arrives.
  refitHold = createRefitHold({
    terminal: {
      write: (data, callback) => term?.write(data, callback),
      resize: (cols, rows) => term?.resize(cols, rows),
    },
    sendSize: (cols, rows) => {
      invoke("pty_resize", { id, cols, rows }).catch(() => {});
    },
    quietMs: REFIT_QUIET_MS,
    maxMs: REFIT_MAX_MS,
  });
  refit = trailingDebounce(applyFit, REFIT_DELAY_MS);
  observer = new ResizeObserver(() => refit?.call());
  observer.observe(el.value!);

  await attach(false);
  if (props.focused) term.focus();
});

// ---- References: #12, !34, PR #5, ABC-123, commits ------------------------

let refCtx: RefContext = EMPTY_CONTEXT;
let commands = new Set<string>();
const isClaude = () => (props.agent ?? "").includes("claude");
watch(
  () => [props.cwd, props.agent] as const,
  async ([cwd]) => {
    refCtx = await refContext(cwd);
    if (isClaude()) commands = await claudeCommands(cwd);
    scheduleRefs();
  },
  { immediate: true },
);

// A switch of the detection applies at once to the text already on the screen: the link providers are built again, the
// hover buttons close, and the colors of every line are computed again.
watch(
  () => [settings.terminalTextDetection, settings.disabledDetectionFamilies.join(",")] as const,
  () => {
    hideChip(true);
    buildLinkProviders();
    for (const y of [...rows.keys()]) clearRow(y);
    scheduleRefs();
  },
);

// ---- Link providers: web addresses, then the detection families ------------

let webLinks: WebLinksAddon | null = null;
let detectionProvider: IDisposable | null = null;

/** The detection families that are on now. The switches are read each time, so a change applies at once. */
function enabledFamilies() {
  return DetectionFamilies.listEnabled(settings);
}

/**
 * Registers the link providers of the terminal, in their order of precedence: the web-link add-on first, then the link provider of
 * the detection. xterm keeps the link of the provider that came first when two links overlap, so a web address is a link of the
 * add-on. The add-on asks the detection whether the address is an issue, a pull request, a merge request, or a commit.
 */
function buildLinkProviders() {
  if (term === null) {
    return;
  }
  webLinks?.dispose();
  webLinks = null;
  detectionProvider?.dispose();
  detectionProvider = null;
  if (DetectionFamilies.isEnabled(settings, "webAddresses")) {
    webLinks = new WebLinksAddon(
      (event, address) => {
        if (event.metaKey === false) {
          return;
        }
        const reference = TerminalDetection.findAddressReference(address, refCtx, enabledFamilies());
        hideChip(true);
        if (reference?.commandClick) {
          runAction(reference.commandClick);
        } else {
          openUrl(address).catch(() => {});
        }
      },
      {
        urlRegex: DetectionPatterns.WEB_ADDRESS,
        hover: (_event, address, range) => {
          overLink = true;
          const reference = TerminalDetection.findAddressReference(address, refCtx, enabledFamilies());
          if (reference !== null) {
            showHoverButtons(range, reference);
          }
        },
        leave: () => {
          overLink = false;
          hideChip();
        },
      },
    );
    term.loadAddon(webLinks);
  }
  detectionProvider = term.registerLinkProvider({ provideLinks: provideDetectionLinks });
}

/**
 * The links of one line: references, file paths, slash commands, numbered steps, shell commands, and the rows of the agent list.
 * Hovering shows hover buttons (open, run, ask the agent); ⌘-click does the main action directly.
 */
function provideDetectionLinks(y: number, callback: (links: ILink[] | undefined) => void) {
  const line = term?.buffer.active.getLine(y - 1);
  if (!term || !line) {
    return callback(undefined);
  }
  const { text, col, width } = lineText(line);
  const range = (s: number, e: number) => ({
    start: { x: col[s] + 1, y },
    end: { x: col[e - 1] + width[e - 1], y },
  });
  const { items } = TerminalDetection.detectLine({
    lineAt: screenLine,
    row: y - 1 - term.buffer.active.viewportY,
    rows: term.rows,
    columns: term.cols,
    context: refCtx,
    knownCommands: commands,
    agent: props.agent || null,
    enabledFamilies: enabledFamilies(),
  });
  const links = items
    .filter((item) => item.isEnabled && item.commandClick !== null)
    .map((item) => ({
      text: text.slice(item.start, item.end),
      range: range(item.start, item.end),
      decorations: { underline: item.isUnderlined, pointerCursor: item.isUnderlined || item.rule === "promptBox" },
      activate: (e: MouseEvent) => {
        if (e.metaKey && item.commandClick !== null) {
          hideChip(true);
          runAction(item.commandClick);
        }
      },
      hover: () => {
        overLink = true;
        showHoverButtons(range(item.start, item.end), item);
      },
      leave: () => {
        overLink = false;
        hideChip();
      },
    }));
  callback(links.length ? links : undefined);
}

/** Does what a detected piece of text proposes. The sample field of the Settings window never calls this function. */
function runAction(action: DetectionAction) {
  switch (action.type) {
    case "openAddress":
      openUrl(action.url).catch(() => {});
      break;
    case "previewIssue":
      openIssue(props.cwd, action.target, action.url);
      break;
    case "openFile":
      openFileRef(props.cwd, action.path, action.line);
      break;
    case "sendPrompt":
      sendPrompt(props.paneId, action.text);
      break;
    case "backToPrompt":
      backToPrompt(action.steps);
      break;
    case "switchAgent":
      switchToAgent(action.name);
      break;
  }
}

// ---- Hover buttons ----------------------------------------------------------

const wrapEl = ref<HTMLDivElement>();
interface ChipAction {
  label: string;
  run: () => void;
}
const chip = ref<{ left: number; top: number; label: string; title: string; run: () => void; alt?: ChipAction; detail?: string } | null>(null);
let chipTimer = 0;
// Mouse on the hover buttons: they are frozen. Claude redraws the screen all the time, and
// xterm then re-reads the link under the last pointer position, which may be another
// issue by now: without this, the hover buttons would switch target or vanish under the mouse.
let onChip = false;
/** Height of the hover buttons, in pixels. */
const CHIP_H = 26;
/** Height of the hover buttons with the line of the destination under them, in pixels. */
const CHIP_DETAIL_H = 42;
/** Width of one hover button before the label, in pixels: the padding on both sides. */
const CHIP_PADDING_W = 16;
/** Width of one character of a label, in pixels. Over-estimated, so that the buttons never reach the text next to them. */
const CHIP_CHARACTER_W = 8;
/** Longest width of one hover button, in pixels: the label is cut after it. */
const CHIP_MAX_W = 360;
/** Space around and between the hover buttons, in pixels. */
const CHIP_GAP_W = 12;

/**
 * Tells whether a cell of the screen holds no character, no color, and not the cursor. The hover buttons only go over such cells,
 * so they hide no text and no part of the interface of the coding agent.
 */
function isBlankCell(row: number, column: number): boolean {
  if (term === null) {
    return false;
  }
  const buffer = term.buffer.active;
  if (row === buffer.cursorY && column === buffer.cursorX) {
    return false;
  }
  const cell = buffer.getLine(buffer.viewportY + row)?.getCell(column);
  if (cell === undefined) {
    return false;
  }
  const chars = cell.getChars();
  return cell.getWidth() === 1 && (chars === "" || chars === " ") && cell.isBgDefault() && cell.isInverse() === 0;
}

/**
 * Shows the hover buttons of a detected piece of text. They sit on blank cells of the screen near the text (on its line, or on
 * the line above or below), so they cover no character. When no blank place is near, they do not show, and a ⌘-click on the text
 * runs the main action.
 */
function showHoverButtons(
  r: { start: { x: number; y: number }; end: { x: number; y: number } },
  item: DetectedItem,
) {
  if (onChip) return;
  window.clearTimeout(chipTimer);
  const screen = el.value?.querySelector(".xterm-screen") as HTMLElement | null;
  if (!term || !screen || !wrapEl.value || item.primary === null) return;
  const s = screen.getBoundingClientRect();
  const w = wrapEl.value.getBoundingClientRect();
  const cellW = s.width / term.cols;
  const cellH = s.height / term.rows;
  const row = r.start.y - 1 - term.buffer.active.viewportY;
  const labels = [item.primary, item.secondary].filter((button) => button !== null).map((button) => t(button.labelKey, button.labelParams));
  const buttonsWidth =
    labels.reduce((sum, label) => sum + Math.min(CHIP_MAX_W, CHIP_PADDING_W + label.length * CHIP_CHARACTER_W), 0) +
    CHIP_GAP_W * (labels.length + 1);
  const detailWidth = item.destination === null ? 0 : Math.min(CHIP_MAX_W, CHIP_PADDING_W + item.destination.length * 6);
  const request = {
    row,
    startColumn: r.start.x - 1,
    endColumn: r.end.y === r.start.y ? r.end.x : term.cols,
  };
  // With the line of the destination first, then without it when the first does not fit.
  const withDetail = item.destination === null ? [false] : [true, false];
  for (const hasDetail of withDetail) {
    const height = hasDetail ? CHIP_DETAIL_H : CHIP_H;
    const rowsCount = Math.max(1, Math.round(height / cellH));
    const width = Math.max(buttonsWidth, hasDetail ? detailWidth + CHIP_GAP_W : 0);
    const place = HoverButtonsPlacement.find(
      { columns: term.cols, rows: term.rows, isBlank: isBlankCell },
      { ...request, widthCells: Math.ceil(width / cellW) + 1, heightRows: rowsCount },
    );
    if (place === null) {
      continue;
    }
    const primary = item.primary;
    const secondary = item.secondary;
    chip.value = {
      left: s.left - w.left + place.column * cellW,
      top: s.top - w.top + place.row * cellH + (rowsCount * cellH - height) / 2,
      label: labels[0],
      title: item.destination ?? "",
      run: () => runAction(primary.action),
      alt: secondary === null ? undefined : { label: labels[1], run: () => runAction(secondary.action) },
      detail: hasDetail && item.destination !== null ? item.destination : undefined,
    };
    return;
  }
  chip.value = null;
}

function hideChip(now = false) {
  window.clearTimeout(chipTimer);
  if (now) {
    onChip = false;
    chip.value = null;
    return;
  }
  if (onChip) return;
  else chipTimer = window.setTimeout(() => (chip.value = null), 350);
}

/** Keys, one at a time: Claude Code's TUI reads them as separate presses. */
async function pressKeys(keys: string[]) {
  for (const k of keys) {
    await invoke("pty_write", { id, data: k }).catch(() => {});
    await new Promise((r) => window.setTimeout(r, 45));
  }
}

async function backToPrompt(steps: number) {
  if (!term) return;
  const up = term.modes.applicationCursorKeysMode ? "\x1bOA" : "\x1b[A";
  term.focus();
  await pressKeys(Array(steps).fill(up));
}

function screenLine(i: number): string | null {
  if (!term || i < 0 || i >= term.rows) return null;
  const l = term.buffer.active.getLine(term.buffer.active.viewportY + i);
  return l ? lineText(l).text : null;
}

/**
 * Moves Claude Code's agent selection to `name` and opens it. The selection may
 * still be in the prompt (first ↓ enters the list) or already on a row (❯), for
 * instance while another agent is shown: the screen is read again after each step.
 */
async function switchToAgent(name: string) {
  if (!term) return;
  const app = term.modes.applicationCursorKeysMode;
  const down = app ? "\x1bOB" : "\x1b[B";
  const up = app ? "\x1bOA" : "\x1b[A";
  const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));
  term.focus();
  let list = agentListState(screenLine, term.rows);
  if (!list) return;
  if (list.selected === null) {
    await pressKeys([down]);
    // Claude marks the selected row with ❯, but not always right away (or not at
    // all, depending on the version): wait a little for it, and without it assume
    // the first row, as the ↓ from the prompt lands there.
    let after = null as ReturnType<typeof agentListState>;
    for (let i = 0; i < 5; i++) {
      await wait(i ? 120 : 160);
      after = agentListState(screenLine, term.rows);
      if (!after || after.selected !== null) break;
    }
    // The list is gone: the ↓ opened something else. Undo it and stop rather than
    // pressing Enter on something unknown.
    if (!after) {
      await pressKeys([up]);
      toast(t("terminalView.agentListUnreachable"));
      return;
    }
    list = { names: after.names, selected: after.selected ?? 0 };
  }
  const target = list.names.indexOf(name);
  if (target === -1) return;
  const from = list.selected ?? 0;
  const steps = target - from;
  await pressKeys([...Array(Math.abs(steps)).fill(steps > 0 ? down : up), "\r"]);
}

function enterChip() {
  onChip = true;
  window.clearTimeout(chipTimer);
}
function leaveChip() {
  onChip = false;
  hideChip();
}

function runChip(alt = false) {
  const c = chip.value;
  hideChip(true);
  if (alt) c?.alt?.run();
  else c?.run();
  term?.focus();
}

/** The tooltip of the first hover button: the destination when the line of the destination is not shown, and the ⌘-click hint. */
function firstButtonTitle(): string {
  const c = chip.value;
  if (c === null) {
    return "";
  }
  const destination = c.detail === undefined ? c.title : "";
  const hint = c.alt ? "" : t("terminalView.chipSameAsClick");
  return [destination, hint].filter((part) => part !== "").join("\n");
}

/** The text of a buffer line, with the cell column of each character (wide chars, emoji). */
function lineText(line: IBufferLine): { text: string; col: number[]; width: number[] } {
  let text = "";
  const col: number[] = [];
  const width: number[] = [];
  for (let x = 0; x < line.length; x++) {
    const cell = line.getCell(x);
    if (!cell) break;
    const w = cell.getWidth();
    if (w === 0) continue; // second half of a wide char
    const chars = cell.getChars() || " ";
    for (let i = 0; i < chars.length; i++) {
      col.push(x);
      width.push(w);
    }
    text += chars;
  }
  return { text, col, width };
}

// Colors are decorations on top of the cells: the stream itself is never modified,
// so the agent's TUI keeps drawing exactly as it wants. Rows are recomputed only
// when their text changed (or moved), a short while after output settles.
interface RowRefs {
  text: string;
  marker: IMarker | null;
  decorations: IDecoration[];
}
const rows = new Map<number, RowRefs>();
let refsTimer = 0;

function scheduleRefs() {
  if (refsTimer) return;
  refsTimer = window.setTimeout(() => {
    refsTimer = 0;
    paintRefs();
  }, 120);
}

function clearRow(y: number) {
  const r = rows.get(y);
  if (!r) return;
  r.decorations.forEach((d) => d.dispose());
  r.marker?.dispose();
  rows.delete(y);
}

function paintRefs() {
  if (!term) return;
  const buf = term.buffer.active;
  if (buf.type !== "normal") return;
  for (const y of [...rows.keys()]) if (y >= term.rows) clearRow(y);
  for (let y = 0; y < term.rows; y++) {
    const line = buf.getLine(buf.baseY + y);
    if (!line) continue;
    const { text, col, width } = lineText(line);
    const prev = rows.get(y);
    if (prev && prev.text === text && (!prev.marker || (!prev.marker.isDisposed && prev.marker.line === buf.baseY + y))) continue;
    clearRow(y);
    const refs = TerminalDetection.findColoredReferences(text, refCtx, enabledFamilies());
    if (!refs.length) {
      rows.set(y, { text, marker: null, decorations: [] });
      continue;
    }
    const marker = term.registerMarker(buf.baseY + y - (buf.baseY + buf.cursorY));
    const decorations: IDecoration[] = [];
    for (const r of refs) {
      const x = col[r.start];
      const end = col[r.end - 1] + width[r.end - 1];
      const d = term.registerDecoration({ marker, x, width: end - x, foregroundColor: (resolvedTheme.value === "light" ? REF_COLORS_LIGHT : REF_COLORS)[r.kind], layer: "top" });
      if (d) decorations.push(d);
    }
    rows.set(y, { text, marker, decorations });
  }
}

// Font changes: wait for the font to load so xterm measures the right cell size,
// then refit; the new cols/rows reach Herdr through `applyFit`.
// The font size is not here: the zoom of the whole window scales the terminal, see `applyWindowZoom`.
watch(
  () => settings.fontId,
  async () => {
    if (!term) return;
    const stack = fontStack();
    try {
      await document.fonts.load(`${FONT_DEFAULT}px ${stack}`);
    } catch {
      /* fall back to whatever is available */
    }
    term.options.fontFamily = stack;
    applyFit();
  },
);

watch(resolvedTheme, (theme) => {
  if (term) {
    term.options.theme = TERMINAL_THEMES[theme];
  }
});

// Switching modes live: turn local mouse reporting off, or give back what the app asked for.
watch(
  () => settings.mouseMode,
  (mode) => {
    if (!term) return;
    if (mode === "select") {
      term.write("\x1b[?9l\x1b[?1000l\x1b[?1002l\x1b[?1003l\x1b[?1006l\x1b[?1015l\x1b[?1016l");
    } else if (requestedMouse.size) {
      const modes = [...requestedMouse];
      requestedMouse.clear(); // re-added by the handler as the sequence goes through
      term.write(`\x1b[?${modes.join(";")}h`);
    }
  },
);

const writeToPty = async (data: string) => {
  await invoke("pty_write", { id, data });
};
watch(
  () => props.focused,
  (f) => f && term?.focus(),
);
onMounted(() => {
  ImageDrop.register(props.paneId, writeToPty);
});

// Global search: once this pane is shown, select the found text if it is in the
// terminal's buffer (the screen, mostly: older history stays in Herdr).
/** Logical line (wrapped rows joined) with, for each character, its row and column. */
function logicalLine(lastRow: number): { first: number; text: string; pos: { y: number; x: number }[] } {
  const buf = term!.buffer.active;
  let first = lastRow;
  while (first > 0 && buf.getLine(first)?.isWrapped) first--;
  let text = "";
  const pos: { y: number; x: number }[] = [];
  for (let y = first; y <= lastRow; y++) {
    const l = buf.getLine(y);
    if (!l) continue;
    for (let x = 0; x < l.length; x++) {
      const ch = l.getCell(x)?.getChars() ?? "";
      if (!ch) continue; // second half of a wide character
      // One entry per UTF-16 unit, like string indices.
      text += ch;
      for (let k = 0; k < ch.length; k++) pos.push({ y, x });
    }
  }
  return { first, text: text.replace(/\s+$/, ""), pos };
}

watch(
  () => search.jump,
  async (j) => {
    if (!j || j.paneId !== props.paneId) return;
    const whole = fold(j.line.trim());
    const lead = j.line.length - j.line.trimStart().length;
    const needle = fold(j.line.slice(j.start, j.end));
    if (!needle) return;
    // A pane just opened is still attaching: give its screen a moment to arrive.
    for (let attempt = 0; attempt < 6; attempt++) {
      await new Promise((r) => window.setTimeout(r, attempt ? 300 : 120));
      if (!term || search.jump?.seq !== j.seq) return;
      const buf = term.buffer.active;
      // The very line clicked first; else the most recent line holding the match.
      for (const exact of [true, false]) {
        let y = buf.length - 1;
        while (y >= 0) {
          const ll = logicalLine(y);
          const folded = fold(ll.text);
          let at = -1;
          if (exact) {
            const i = whole ? folded.indexOf(whole) : -1;
            if (i !== -1) at = i + (j.start - lead);
          } else at = folded.indexOf(needle);
          if (at >= 0 && at + needle.length <= ll.pos.length) {
            const a = ll.pos[at];
            const b = ll.pos[at + needle.length - 1];
            const cols = term.cols;
            term.scrollToLine(Math.max(0, a.y - Math.floor(term.rows / 2)));
            term.select(a.x, a.y, (b.y - a.y) * cols + b.x - a.x + 1);
            term.focus();
            search.jump = null;
            return;
          }
          y = ll.first - 1;
        }
      }
    }
    search.jump = null;
    toast(t("terminalView.resultAbove"));
  },
  { immediate: true },
);

let wheelRest = 0;

function cellAt(e: WheelEvent): { col: number; row: number } {
  const screen = el.value!.querySelector(".xterm-screen") as HTMLElement | null;
  const rect = (screen ?? el.value!).getBoundingClientRect();
  const cols = term!.cols;
  const rows = term!.rows;
  const col = Math.min(cols, Math.max(1, Math.floor(((e.clientX - rect.left) / rect.width) * cols) + 1));
  const row = Math.min(rows, Math.max(1, Math.floor(((e.clientY - rect.top) / rect.height) * rows) + 1));
  return { col, row };
}

// ---- Clicks for the program, in "select" mode -------------------------------
// Dragging selects text, but a simple click (no drag, no modifier) still reaches
// the program when it asked for the mouse: buttons and × in Claude Code's panels,
// menus in Herdr… Clicks on our own links are left alone.
let overLink = false;
let down: { x: number; y: number } | null = null;

function onDown(e: MouseEvent) {
  down = e.button === 0 && !e.metaKey && !e.altKey && !e.ctrlKey && !e.shiftKey ? { x: e.clientX, y: e.clientY } : null;
}

function onUp(e: MouseEvent) {
  const start = down;
  down = null;
  if (!term || !start || settings.mouseMode !== "select" || overLink) return;
  if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 3) return; // a drag: selection
  if (![1000, 1002, 1003].some((m) => requestedMouse.has(m))) return;
  const { col, row } = cellAt(e as unknown as WheelEvent);
  let seq: string;
  if (requestedMouse.has(1006)) {
    seq = `\x1b[<0;${col};${row}M\x1b[<0;${col};${row}m`;
  } else {
    const c = (n: number) => String.fromCharCode(32 + Math.min(n, 223));
    seq = `\x1b[M${c(0)}${c(col)}${c(row)}\x1b[M${c(3)}${c(col)}${c(row)}`;
  }
  invoke("pty_write", { id, data: seq }).catch(() => {});
}

function onWheel(e: WheelEvent) {
  if (!term || e.deltaY === 0) return;
  const appMode = settings.mouseMode === "app";
  // App mode without ⌥: xterm already forwards the wheel to Herdr.
  if (appMode && !e.altKey) return;
  // Select mode with ⌥: keep xterm's default (↑/↓ keys).
  if (!appMode && e.altKey) return;
  e.preventDefault();
  e.stopPropagation();

  // Trackpads send many small deltas: turn them into whole lines.
  const unit = e.deltaMode === 1 ? 1 : e.deltaMode === 2 ? term.rows : 1 / 40;
  wheelRest += e.deltaY * unit;
  const lines = Math.trunc(wheelRest);
  if (!lines) return;
  wheelRest -= lines;
  terminalSelection.invalidate();
  const up = lines < 0;
  const count = Math.min(Math.abs(lines), 10);
  let seq = "";

  if (appMode) {
    // ⌥ + wheel in app mode: history keys.
    const app = term.modes.applicationCursorKeysMode;
    seq = (up ? (app ? "\x1bOA" : "\x1b[A") : app ? "\x1bOB" : "\x1b[B").repeat(count);
  } else {
    const { col, row } = cellAt(e);
    const button = up ? 64 : 65;
    if (requestedMouse.has(1006)) {
      seq = `\x1b[<${button};${col};${row}M`.repeat(count);
    } else if (requestedMouse.size) {
      seq = (`\x1b[M` + String.fromCharCode(32 + button, 32 + Math.min(col, 223), 32 + Math.min(row, 223))).repeat(count);
    } else {
      // The program did not ask for the mouse at all: plain arrow keys, like a normal terminal.
      seq = (up ? "\x1b[A" : "\x1b[B").repeat(count);
    }
  }
  invoke("pty_write", { id, data: seq }).catch(() => {});
}

async function copySelection() {
  if (term === null || term.hasSelection() === false) {
    return;
  }
  const position = JSON.stringify(term.getSelectionPosition());
  try {
    await terminalSelection.copy(term, props.paneId, writeToClipboard);
    // A new selection made while Herdr answered stays: only the copied selection is cleared (issue #803).
    if (JSON.stringify(term.getSelectionPosition()) === position) {
      term.clearSelection();
    }
  } catch {
    toast(t("terminalView.copyFailed"));
  }
}

function onCopy(event: ClipboardEvent) {
  if (term === null || term.hasSelection() === false) {
    return;
  }
  // The item Copy of the context menu of the system: the event puts the displayed selection in the clipboard at once, and
  // the copy then replaces it with the original text of Herdr when it can (issue #805).
  event.clipboardData?.setData("text/plain", term.getSelection());
  event.preventDefault();
  event.stopPropagation();
  void copySelection();
}

function pinSelection() {
  if (!term) return;
  emit("pin", term.getSelection());
  term.clearSelection();
}

onBeforeUnmount(() => {
  window.clearTimeout(refsTimer);
  window.clearTimeout(chipTimer);
  webLinks?.dispose();
  detectionProvider?.dispose();
  for (const y of [...rows.keys()]) clearRow(y);
  el.value?.removeEventListener("wheel", onWheel, { capture: true });
  el.value?.removeEventListener("copy", onCopy, true);
  el.value?.removeEventListener("mousedown", onDown, true);
  el.value?.removeEventListener("mouseup", onUp, true);
  if (selectionReaders.get(props.paneId)) selectionReaders.delete(props.paneId);
  ImageDrop.unregister(props.paneId);
  observer?.disconnect();
  refit?.cancel();
  refitHold?.cancel();
  unlisten.forEach((u) => u());
  invoke("pty_kill", { id }).catch(() => {});
  term?.dispose();
});
</script>

<template>
  <div ref="wrapEl" class="wrap">
    <div ref="el" class="term"></div>
    <div
      v-if="chip"
      class="chips"
      :style="{ top: `${chip.top}px`, left: `${chip.left}px` }"
      @mouseenter="enterChip()"
      @mouseleave="leaveChip()"
      @mousedown.stop.prevent
    >
      <div class="chip-actions">
        <button class="btn small chip" type="button" :title="firstButtonTitle()" @click="runChip(false)">{{ chip.label }}</button>
        <button v-if="chip.alt" class="btn small chip" type="button" :title="t('terminalView.previewInApp')" @click="runChip(true)">{{ chip.alt.label }}</button>
      </div>
      <div v-if="chip.detail" class="chip-detail" :title="chip.detail">{{ chip.detail }}</div>
    </div>
    <div v-if="hasSelection" class="sel-bar" @mousedown.stop.prevent>
      <button :title="t('terminalView.copyTitle')" class="btn" @click="copySelection">{{ t("terminalView.copy") }} <kbd>⌘C</kbd></button>
      <button :title="t('terminalView.pinTitle')" class="btn" @click="pinSelection">{{ t("terminalView.pin") }} <kbd>⇧⌘P</kbd></button>
    </div>
    <div v-if="exited" class="overlay">
      <p>{{ heldByAnotherClient ? t("terminalView.heldByAnotherClient") : t("terminalView.detached") }}</p>
      <div class="actions">
        <button :title="t('terminalView.reattachTitle')" class="btn" @click="attach(false)">{{ t("terminalView.reattach") }}</button>
        <button :title="t('terminalView.takeControlTitle')" class="btn" @click="attach(true)">{{ t("terminalView.takeControl") }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wrap { flex: 1; min-height: 0; position: relative; }
.term { position: absolute; inset: 8px 4px 4px 12px; }
.overlay {
  position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; background: var(--raised); color: var(--text-2);
}
.overlay p { margin: 0; }
.actions { display: flex; gap: 8px; }
:deep(.xterm) { height: 100%; }
.sel-bar {
  position: absolute; right: 12px; bottom: 12px; z-index: 5; display: flex; gap: 6px; padding: 6px;
  border-radius: 10px; background: var(--raised); border: 1px solid var(--line-modal); box-shadow: 0 10px 28px var(--shadow);
}
.sel-bar .btn { background: var(--field); }
/* The padding is part of the hover zone, and reaches down to the hovered text. */
.chips { position: absolute; z-index: 6; display: flex; flex-direction: column; align-items: flex-start; gap: 3px; padding: 0 4px; }
.chip-actions { height: 26px; display: flex; align-items: flex-start; gap: 4px; }
.chip-detail { max-width: 352px; overflow: hidden; color: var(--text-2); font-size: calc(var(--font-size) * 0.7); line-height: 13px; text-overflow: ellipsis; white-space: nowrap; }
.chip { white-space: nowrap; cursor: pointer; max-width: 360px; overflow: hidden; text-overflow: ellipsis; }
:deep(.xterm-viewport) { background: transparent !important; }
</style>
