// Code editor (CodeMirror 6), loaded only when a file is edited.
import { EditorView, keymap } from "@codemirror/view";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import { basicSetup } from "codemirror";
import { indentWithTab } from "@codemirror/commands";
import { openSearchPanel } from "@codemirror/search";
import { HighlightStyle, StreamLanguage, syntaxHighlighting, type LanguageSupport, type StreamParser } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

/** Colours from the code themes of the app (CSS variables of `.code.<theme>`). */
const style = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.operatorKeyword, t.moduleKeyword, t.definitionKeyword], color: "var(--k)" },
  { tag: [t.string, t.special(t.string), t.regexp, t.character], color: "var(--s)" },
  { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: "var(--c)", fontStyle: "italic" },
  { tag: [t.number, t.bool, t.null, t.atom], color: "var(--n)" },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.macroName], color: "var(--f)" },
  { tag: [t.typeName, t.className, t.namespace, t.standard(t.typeName)], color: "var(--t)" },
  { tag: [t.attributeName, t.propertyName], color: "var(--a)" },
  { tag: [t.self, t.special(t.variableName), t.labelName], color: "var(--v)" },
  { tag: [t.tagName, t.meta, t.processingInstruction], color: "var(--m)" },
  { tag: [t.heading], color: "var(--k)", fontWeight: "700" },
  { tag: [t.link, t.url], color: "var(--s)", textDecoration: "underline" },
  { tag: [t.emphasis], fontStyle: "italic" },
  { tag: [t.strong], fontWeight: "700" },
  { tag: [t.invalid], color: "var(--blocked)" },
]);

const themeRules = {
    "&": { height: "100%", backgroundColor: "var(--c-bg)", color: "var(--c-fg)" },
    ".cm-scroller": { fontFamily: "var(--mono)", lineHeight: "1.55" },
    ".cm-gutters": { backgroundColor: "var(--c-bg)", color: "var(--c-gutter)", border: "none" },
    ".cm-activeLineGutter": { backgroundColor: "var(--editor-active-line)" },
    ".cm-activeLine": { backgroundColor: "var(--editor-active-line)" },
    ".cm-content": { caretColor: "var(--editor-caret)" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--editor-caret)" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": { backgroundColor: "var(--editor-selection) !important" },
    ".cm-selectionMatch": { backgroundColor: "var(--editor-selection-match)" },
    ".cm-matchingBracket": { backgroundColor: "var(--editor-bracket)", outline: "none" },
    ".cm-searchMatch": { backgroundColor: "var(--editor-search)" },
    ".cm-searchMatch.cm-searchMatch-selected": { backgroundColor: "var(--editor-search-selected)" },
    ".cm-panels": { backgroundColor: "var(--field)", color: "var(--text)", borderTop: "1px solid var(--line-strong)" },
    ".cm-panel input, .cm-panel button": { fontSize: "12px" },
    ".cm-textfield": { backgroundColor: "var(--bg)", border: "1px solid var(--line-strong)", color: "var(--text)", borderRadius: "5px" },
    ".cm-button": { backgroundImage: "none", backgroundColor: "var(--chip)", border: "1px solid var(--line-strong)", color: "var(--text)", borderRadius: "5px" },
    ".cm-tooltip": { backgroundColor: "var(--raised)", border: "1px solid var(--line-modal)", color: "var(--text)" },
    ".cm-tooltip-autocomplete ul li[aria-selected]": { backgroundColor: "var(--sel)" },
    ".cm-foldPlaceholder": { backgroundColor: "var(--chip)", border: "none", color: "var(--muted)" },
};

/** Editor theme; `dark` switches the built-in CodeMirror base colours. */
function themeFor(dark: boolean): Extension {
  return EditorView.theme(themeRules, { dark });
}

/** Language of a file, by its name (lazy: only the one needed is loaded). */
async function languageFor(path: string): Promise<LanguageSupport | Extension | null> {
  const name = path.split("/").pop()?.toLowerCase() ?? "";
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1) : "";
  const legacy = async (p: Promise<StreamParser<unknown>>) => StreamLanguage.define(await p);
  if (name === "dockerfile" || name.startsWith("dockerfile.")) return legacy(import("@codemirror/legacy-modes/mode/dockerfile").then((m) => m.dockerFile));
  if (name === "makefile") return legacy(import("@codemirror/legacy-modes/mode/shell").then((m) => m.shell));
  switch (ext) {
    case "ts": case "mts": case "cts": return (await import("@codemirror/lang-javascript")).javascript({ typescript: true });
    case "tsx": return (await import("@codemirror/lang-javascript")).javascript({ typescript: true, jsx: true });
    case "js": case "mjs": case "cjs": return (await import("@codemirror/lang-javascript")).javascript();
    case "jsx": return (await import("@codemirror/lang-javascript")).javascript({ jsx: true });
    case "vue": return (await import("@codemirror/lang-vue")).vue();
    case "json": case "jsonc": case "json5": return (await import("@codemirror/lang-json")).json();
    case "html": case "htm": case "twig": return (await import("@codemirror/lang-html")).html();
    case "css": case "scss": case "less": return (await import("@codemirror/lang-css")).css();
    case "md": case "markdown": case "mdx": return (await import("@codemirror/lang-markdown")).markdown();
    case "py": return (await import("@codemirror/lang-python")).python();
    case "rs": return (await import("@codemirror/lang-rust")).rust();
    case "php": return (await import("@codemirror/lang-php")).php();
    case "yml": case "yaml": return (await import("@codemirror/lang-yaml")).yaml();
    case "sql": return (await import("@codemirror/lang-sql")).sql();
    case "java": return (await import("@codemirror/lang-java")).java();
    case "xml": case "svg": case "plist": case "xaml": return (await import("@codemirror/lang-xml")).xml();
    case "sh": case "bash": case "zsh": case "env": return legacy(import("@codemirror/legacy-modes/mode/shell").then((m) => m.shell));
    case "toml": return legacy(import("@codemirror/legacy-modes/mode/toml").then((m) => m.toml));
    case "go": return legacy(import("@codemirror/legacy-modes/mode/go").then((m) => m.go));
    case "swift": return legacy(import("@codemirror/legacy-modes/mode/swift").then((m) => m.swift));
    case "rb": return legacy(import("@codemirror/legacy-modes/mode/ruby").then((m) => m.ruby));
    case "dart": return legacy(import("@codemirror/legacy-modes/mode/clike").then((m) => m.dart));
    case "kt": case "kts": return legacy(import("@codemirror/legacy-modes/mode/clike").then((m) => m.kotlin));
    case "c": case "h": return legacy(import("@codemirror/legacy-modes/mode/clike").then((m) => m.c));
    case "cpp": case "cc": case "hpp": return legacy(import("@codemirror/legacy-modes/mode/clike").then((m) => m.cpp));
    case "cs": return legacy(import("@codemirror/legacy-modes/mode/clike").then((m) => m.csharp));
    case "lua": return legacy(import("@codemirror/legacy-modes/mode/lua").then((m) => m.lua));
    case "ini": case "properties": case "conf": return legacy(import("@codemirror/legacy-modes/mode/properties").then((m) => m.properties));
    default: return null;
  }
}

/** The lines that the developer selected in the editor, and where the end of the selection sits in the window. */
export interface EditorSelection {
  /** The first selected line, from 1. */
  fromLine: number;
  /** The last selected line, from 1. */
  toLine: number;
  /** The selected text. */
  text: string;
  /** The left edge of the end of the selection, in pixels from the left edge of the window. */
  left: number;
  /** The bottom edge of the end of the selection, in pixels from the top edge of the window. */
  bottom: number;
}

export interface Editor {
  view: EditorView;
  getText(): string;
  setText(text: string): void;
  /** Replaces only the part that differs: the cursor and the scroll stay put. */
  replaceKeepingCursor(text: string): void;
  setWrap(on: boolean): void;
  setDark(dark: boolean): void;
  focus(): void;
  /** Opens the search panel of the editor, as the key ⌘F does. */
  openSearch(): void;
  goToLine(line: number): void;
  destroy(): void;
}

/** The selected lines of the editor, or null when nothing is selected. */
function selectionOf(view: EditorView): EditorSelection | null {
  const range = view.state.selection.main;
  if (range.empty) {
    return null;
  }
  const text = view.state.sliceDoc(range.from, range.to);
  if (text.trim() === "") {
    return null;
  }
  const coordinates = view.coordsAtPos(range.head) ?? view.coordsAtPos(range.to);
  return {
    fromLine: view.state.doc.lineAt(range.from).number,
    toLine: view.state.doc.lineAt(range.to).number,
    text,
    left: coordinates?.left ?? 0,
    bottom: coordinates?.bottom ?? 0,
  };
}

export async function createEditor(
  parent: HTMLElement,
  opts: {
    text: string;
    path: string;
    wrap: boolean;
    dark: boolean;
    /** True: the text cannot change, and the search (⌘F) still works. */
    readOnly?: boolean;
    onChange: (text: string) => void;
    onSave: () => void;
    /** Called when the selection changes: the selected lines, or null when nothing is selected. */
    onSelectionChange?: (selection: EditorSelection | null) => void;
  },
): Promise<Editor> {
  const wrap = new Compartment();
  const lang = new Compartment();
  const colors = new Compartment();
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: opts.text,
      extensions: [
        basicSetup,
        keymap.of([
          { key: "Mod-s", preventDefault: true, run: () => (opts.onSave(), true) },
          indentWithTab,
        ]),
        syntaxHighlighting(style),
        EditorState.readOnly.of(opts.readOnly === true),
        colors.of(themeFor(opts.dark)),
        wrap.of(opts.wrap ? EditorView.lineWrapping : []),
        lang.of([]),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) opts.onChange(u.state.doc.toString());
          if ((u.selectionSet || u.focusChanged) && opts.onSelectionChange !== undefined) {
            opts.onSelectionChange(selectionOf(u.view));
          }
        }),
      ],
    }),
  });
  // The language arrives a moment later (its module is loaded on demand).
  languageFor(opts.path)
    .then((l) => l && view.dispatch({ effects: lang.reconfigure(l) }))
    .catch(() => {});
  return {
    view,
    getText: () => view.state.doc.toString(),
    setText: (text) => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } }),
    replaceKeepingCursor: (text) => {
      const old = view.state.doc.toString();
      let start = 0;
      while (start < old.length && start < text.length && old[start] === text[start]) start++;
      let endOld = old.length;
      let endNew = text.length;
      while (endOld > start && endNew > start && old[endOld - 1] === text[endNew - 1]) {
        endOld--;
        endNew--;
      }
      view.dispatch({ changes: { from: start, to: endOld, insert: text.slice(start, endNew) } });
    },
    setWrap: (on) => view.dispatch({ effects: wrap.reconfigure(on ? EditorView.lineWrapping : []) }),
    setDark: (dark) => view.dispatch({ effects: colors.reconfigure(themeFor(dark)) }),
    focus: () => view.focus(),
    openSearch: () => {
      view.focus();
      openSearchPanel(view);
    },
    goToLine: (n) => {
      const line = view.state.doc.line(Math.min(Math.max(1, n), view.state.doc.lines));
      view.dispatch({ selection: { anchor: line.from }, effects: EditorView.scrollIntoView(line.from, { y: "center" }) });
    },
    destroy: () => view.destroy(),
  };
}
