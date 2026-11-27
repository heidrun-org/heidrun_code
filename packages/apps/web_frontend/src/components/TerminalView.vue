<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { Terminal, type IBufferLine, type IBufferRange, type IDecoration, type IDisposable, type ILink, type IMarker } from "@xterm/xterm";
import { openUrl } from "@tauri-apps/plugin-opener";
import { EMPTY_CONTEXT, REF_COLORS, findRefs, refContext, sameReferenceAddress, type RefContext, type RefMatch } from "../lib/refs";
import { DetectionPatterns } from "../lib/detection_patterns";
import { toast } from "../stores/session";
import InformationCard from "./InformationCard.vue";
import CodeHostingReferenceCard from "./CodeHostingReferenceCard.vue";
import type { ChatReference } from "../lib/chat_references";
import type { ChatReferenceDetails as ReferenceDetails } from "../stores/chat_references";
import { ForgeReferenceDetails } from "../stores/forge_reference_details";
import { loadMergeFacts, type MergeFacts } from "../stores/pull_request_merge";
import type { Forge, RefTarget } from "../lib/refs";
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
};

import { FONT_DEFAULT, fontStack, settings } from "../stores/settings";
import { selectionReaders } from "../stores/notes";
import { ImageDrop } from "../lib/image_drop";
import { ChatImageHover } from "../stores/chat_image_hover";

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
    linkHandler: {
      activate: (event, url) => {
        const reference = terminalReferences(url)[0];
        if (reference?.url === url) {
          activateReference(event, reference);
        } else if (event.metaKey === true && settings.terminalWebAddresses) {
          void openUrl(url).catch(() => {});
        }
      },
      hover: (_event, url, range) => {
        const reference = terminalReferences(url)[0];
        overLink = reference?.url === url || settings.terminalWebAddresses;
        if (reference?.url === url) {
          showReferenceCard(range, reference);
        }
      },
      leave: () => {
        overLink = false;
        scheduleReferenceClose();
      },
    },
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

// ---- Issue and request links ------------------------------------------------

let refCtx: RefContext = EMPTY_CONTEXT;
let webLinks: WebLinksAddon | null = null;
let detectionProvider: IDisposable | null = null;
let chatImageProvider: IDisposable | null = null;

function refreshReferenceDecorations() {
  for (const row of rows.keys()) {
    clearRow(row);
  }
  scheduleRefs();
}

function terminalReferences(text: string) {
  return settings.terminalTextDetection ? findRefs(text, refCtx) : [];
}

function buildLinkProviders() {
  if (term === null) {
    return;
  }
  detectionProvider?.dispose();
  webLinks?.dispose();
  webLinks = null;
  chatImageProvider?.dispose();
  chatImageProvider = null;
  detectionProvider = term.registerLinkProvider({ provideLinks: provideDetectionLinks });
  if (settings.terminalWebAddresses) {
    webLinks = new WebLinksAddon(
      (event, address) => {
        if (event.metaKey === true && settings.terminalWebAddresses) {
          void openUrl(address).catch(() => {});
        }
      },
      {
        urlRegex: DetectionPatterns.WEB_ADDRESS,
        hover: () => { overLink = settings.terminalWebAddresses; },
        leave: () => { overLink = false; },
      },
    );
    term.loadAddon(webLinks);
  }
  if (settings.terminalInputImagePreviews) {
    chatImageProvider = term.registerLinkProvider(ChatImageHover.createLinkProvider(term, () => props.paneId));
  }
}

/** Supplies reference links from the whole wrapped line so a full address can span terminal rows. */
function provideDetectionLinks(y: number, callback: (links: ILink[] | undefined) => void) {
  const buffer = term?.buffer.active;
  if (buffer === undefined || buffer.getLine(y - 1) === undefined) {
    callback(undefined);
    return;
  }
  let first = y - 1;
  while (first > 0 && buffer.getLine(first)?.isWrapped === true) {
    first--;
  }
  let text = "";
  const cells: { x: number; y: number; width: number }[] = [];
  for (let row = first; row === first || buffer.getLine(row)?.isWrapped === true; row++) {
    const line = buffer.getLine(row);
    if (line === undefined) {
      break;
    }
    const content = lineText(line);
    text += content.text;
    for (let index = 0; index < content.text.length; index++) {
      cells.push({ x: content.col[index] + 1, y: row + 1, width: content.width[index] });
    }
  }
  const links: ILink[] = [];
  for (const match of terminalReferences(text)) {
    const firstCell = cells[match.start];
    const lastCell = cells[match.end - 1];
    if (y < firstCell.y || y > lastCell.y) {
      continue;
    }
    const range: IBufferRange = {
      start: { x: firstCell.x, y: firstCell.y },
      end: { x: lastCell.x + lastCell.width - 1, y: lastCell.y },
    };
    links.push({
      text: text.slice(match.start, match.end),
      range,
      activate: (event) => activateReference(event, match),
      hover: () => {
        overLink = settings.terminalTextDetection;
        if (overLink) {
          showReferenceCard(range, match);
        }
      },
      leave: () => {
        overLink = false;
        scheduleReferenceClose();
      },
    });
  }
  callback(links.length > 0 ? links : undefined);
}

function activateReference(event: MouseEvent, match: RefMatch) {
  if (event.metaKey === false || settings.terminalTextDetection === false) {
    return;
  }
  closeReferenceCard();
  void openUrl(match.url).catch(() => {});
}

/** The terminal position and hosting service data for the currently hovered reference. */
type ReferenceCard = {
  /** Unique key for each card opening. */
  key: number;
  /** The occurrence currently anchoring the card. */
  anchor: string;
  /** Horizontal midpoint and vertical bounds of the reference in the terminal. */
  left: number;
  top: number;
  height: number;
  /** The original destination and repository identity. */
  url: string;
  webBase: string;
  folder: string;
  forge: Forge;
  target: RefTarget;
  /** The resolved item and details returned by the hosting service. */
  reference: ChatReference;
  details: ReferenceDetails | null | undefined;
  facts: MergeFacts | null;
};

const wrapEl = ref<HTMLDivElement>();
const referenceCard = ref<ReferenceCard | null>(null);
let referenceKey = 0;
let referenceCloseTimer = 0;
let referenceOpenTimer = 0;
let referenceLoadingTimer = 0;
let pendingReferenceCard: ReferenceCard | null = null;
const REFERENCE_HOVER_DELAY_MS = 500;
const REFERENCE_LOADING_DELAY_MS = 800;
let isPointerOnCard = false;

function showReferenceCard(range: IBufferRange, match: RefMatch) {
  window.clearTimeout(referenceCloseTimer);
  const anchor = `${range.start.x}:${range.start.y}:${range.end.x}:${range.end.y}`;
  const current = pendingReferenceCard ?? referenceCard.value;
  if (isPointerOnCard || (current?.url === match.url && current.anchor === anchor)) {
    return;
  }
  cancelPendingReferenceCard();
  referenceCard.value = null;
  const { target, url } = match;
  const bounds = wrapEl.value?.getBoundingClientRect();
  const screen = el.value?.querySelector(".xterm-screen")?.getBoundingClientRect();
  const folder = refCtx.root ?? props.cwd;
  const forge = target.forge ?? refCtx.forge;
  if (term === null || bounds === undefined || screen === undefined ||
      folder === null || folder === undefined || forge === null) {
    return;
  }
  const cellWidth = screen.width / term.cols;
  const cellHeight = screen.height / term.rows;
  const viewport = term.buffer.active.viewportY;
  const firstRow = Math.max(0, range.start.y - 1 - viewport);
  const lastRow = Math.min(term.rows - 1, range.end.y - 1 - viewport);
  if (firstRow > lastRow) {
    return;
  }
  const midpoint = range.start.y === range.end.y
    ? (range.start.x - 1 + range.end.x) / 2
    : term.cols / 2;
  const address = new URL(url);
  const webBase = target.project === undefined
    ? refCtx.base ?? address.origin
    : `${address.origin}/${target.project}`;
  const card = reactive<ReferenceCard>({
    key: ++referenceKey,
    anchor,
    left: screen.left - bounds.left + midpoint * cellWidth,
    top: screen.top - bounds.top + firstRow * cellHeight,
    height: (lastRow - firstRow + 1) * cellHeight,
    url,
    webBase,
    folder,
    forge,
    target,
    reference: { kind: match.kind === "mr" ? "pull_request" : "issue", number: target.number, url },
    details: undefined,
    facts: null,
  });
  pendingReferenceCard = card;
  let hasHoverDelayElapsed = false;
  function display() {
    if (pendingReferenceCard === card) {
      cancelPendingReferenceCard();
      referenceCard.value = card;
    }
  }
  referenceOpenTimer = window.setTimeout(() => {
    hasHoverDelayElapsed = true;
    if (card.details !== undefined) {
      display();
    }
  }, REFERENCE_HOVER_DELAY_MS);
  referenceLoadingTimer = window.setTimeout(display, REFERENCE_LOADING_DELAY_MS);
  void prepareReferenceCard(card).then(() => {
    if (hasHoverDelayElapsed) {
      display();
    }
  });
}

async function prepareReferenceCard(card: ReferenceCard) {
  const { folder, forge, target, webBase } = card;
  const answer = await ForgeReferenceDetails.loadTerminalReference(folder, forge, webBase, card.reference, target)
    .catch(() => ({ reference: card.reference, details: null }));
  if (pendingReferenceCard !== card && referenceCard.value !== card) {
    return;
  }
  if (answer.reference.kind === "pull_request" && forge === refCtx.forge &&
      sameReferenceAddress(webBase, refCtx.base, forge)) {
    card.facts = await loadMergeFacts(folder, forge, target.number, false, answer.reference.url).catch(() => null);
  }
  card.reference = answer.reference;
  card.details = answer.details;
}

function cancelPendingReferenceCard() {
  window.clearTimeout(referenceOpenTimer);
  window.clearTimeout(referenceLoadingTimer);
  pendingReferenceCard = null;
}

function closeReferenceCard() {
  cancelPendingReferenceCard();
  window.clearTimeout(referenceCloseTimer);
  referenceCard.value = null;
  isPointerOnCard = false;
}

function scheduleReferenceClose() {
  cancelPendingReferenceCard();
  window.clearTimeout(referenceCloseTimer);
  if (isPointerOnCard === false) {
    referenceCloseTimer = window.setTimeout(closeReferenceCard, 350);
  }
}

function enterReferenceCard() {
  isPointerOnCard = true;
  window.clearTimeout(referenceCloseTimer);
}

function leaveReferenceCard() {
  isPointerOnCard = false;
  scheduleReferenceClose();
}

function referenceName(card: ReferenceCard): string {
  return `${card.forge === "gitlab" && card.reference.kind === "pull_request" ? "!" : "#"}${card.target.number}`;
}

watch(
  () => props.cwd,
  async (cwd, _old, onCleanup) => {
    let isCurrent = true;
    onCleanup(() => { isCurrent = false; });
    refCtx = EMPTY_CONTEXT;
    closeReferenceCard();
    const context = await refContext(cwd);
    if (isCurrent === true) {
      refCtx = context;
      refreshReferenceDecorations();
    }
  },
  { immediate: true },
);

watch(
  () => [settings.terminalTextDetection, settings.terminalWebAddresses, settings.terminalInputImagePreviews] as const,
  () => {
    overLink = false;
    closeReferenceCard();
    if (settings.terminalInputImagePreviews === false) {
      ChatImageHover.hide();
    }
    buildLinkProviders();
    refreshReferenceDecorations();
  },
);

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
    const refs = terminalReferences(text);
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
  closeReferenceCard();
  webLinks?.dispose();
  detectionProvider?.dispose();
  chatImageProvider?.dispose();
  ChatImageHover.hide();
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
      v-if="referenceCard"
      :key="referenceCard.key"
      class="terminal-reference-anchor"
      :style="{ top: `${referenceCard.top}px`, left: `${referenceCard.left}px`, height: `${referenceCard.height}px` }"
      @pointerenter="enterReferenceCard"
      @pointerleave="leaveReferenceCard"
    >
      <InformationCard
        opens-on-mount
        placement="above-or-below"
        :label="t('codeHostingPanel.cardLabel', { name: referenceName(referenceCard) })"
        @dismiss="closeReferenceCard"
      >
        <template #card>
          <CodeHostingReferenceCard
            :reference="referenceCard.reference"
            :details="referenceCard.details"
            :folder="referenceCard.folder"
            :forge="referenceCard.forge"
            :web-base="referenceCard.webBase"
            :title="referenceCard.details?.title ?? null"
            :name="referenceName(referenceCard)"
            :target="referenceCard.target"
            :facts="referenceCard.facts"
            :expected-url="referenceCard.reference.url"
          />
        </template>
      </InformationCard>
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
.terminal-reference-anchor { --information-card-part-background: transparent; position: absolute; z-index: 6; pointer-events: none; }
.terminal-reference-anchor :deep(.information-card-part) { height: 100%; }
.terminal-reference-anchor :deep(.popover) { pointer-events: auto; }
.wrap { flex: 1; min-height: 0; position: relative; }
/* Keep terminal link decorations below the information card. */
.term { position: absolute; inset: 8px 4px 4px 12px; isolation: isolate; }
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
:deep(.xterm-viewport) { background: transparent !important; }
</style>
