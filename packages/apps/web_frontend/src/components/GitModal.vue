<script setup lang="ts">
import Icon from "./Icon.vue";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { currentForge, currentGit, git, refreshGit } from "../stores/git";
import { settings } from "../stores/settings";
import { codeThemeClass } from "../stores/theme";
import AbbreviatedTime from "./AbbreviatedTime.vue";
import { diffStats, parseDiff, type DiffLine } from "../lib/diff";
import DiffLines from "./DiffLines.vue";
import { highlightFile, highlightLine, languageFor } from "../lib/highlight";
import { isMarkdown, renderMarkdown } from "../lib/markdown";
import Resizer from "./Resizer.vue";
import SettingsSwitchRow from "./settings/SettingsSwitchRow.vue";
import { t } from "../i18n/index";

const st = currentGit;
const fg = currentForge;
const filter = ref("");
const listEl = ref<HTMLElement>();

const files = computed(() => {
  const q = filter.value.trim().toLowerCase();
  const all = st.value?.files ?? [];
  return q ? all.filter((f) => f.path.toLowerCase().includes(q)) : all;
});
const selected = computed(() => git.modal.path);
const selectedFile = computed(() => st.value?.files.find((f) => f.path === selected.value) ?? null);
const lang = computed(() => (selected.value ? languageFor(selected.value) : null));
const repoName = computed(() => (fg.value?.base ? fg.value.base.replace(/^https?:\/\/[^/]+\//, "") : st.value?.root.split("/").pop() ?? ""));
const kind = computed(() => (fg.value?.forge === "github" ? "PR" : "MR"));

// ---- Loading ------------------------------------------------------------------
const MAX_ROWS = 6000;
const diff = ref<DiffLine[]>([]);
/** Highlighted HTML, computed once per load (not on every render). */
const diffHtml = ref<string[]>([]);
const fileLines = ref<string[]>([]);
const truncated = ref(false);
const rendered = ref("");
const md = computed(() => isMarkdown(selected.value));
// "Preview" only exists for Markdown: elsewhere it falls back to the file view.
// A file that the File explorer sidebar section opens, and that has no change, has no diff: it shows as a whole file.
const isUnchanged = computed(() => selected.value !== null && selectedFile.value === null);
const mode = computed(() => {
  if (isUnchanged.value && settings.diffMode !== "preview") {
    return "file";
  }
  return settings.diffMode === "preview" && !md.value ? "file" : settings.diffMode;
});

/** The choices of the radio button group of the title bar that picks the view of the file. */
const VIEW_CHOICES = [
  { id: "unified", labelKey: "gitModal.unified", titleKey: "gitModal.unifiedTitle" },
  { id: "split", labelKey: "gitModal.split", titleKey: "gitModal.splitTitle" },
  { id: "file", labelKey: "gitModal.file", titleKey: "gitModal.fileTitle" },
  { id: "preview", labelKey: "gitModal.preview", titleKey: "gitModal.previewTitle" },
] as const;
/** The choices of the radio button group that picks the width of the preview. */
const PREVIEW_WIDTH_CHOICES = [
  { id: "center", labelKey: "gitModal.centered", titleKey: "gitModal.centeredTitle" },
  { id: "full", labelKey: "gitModal.fullWidth", titleKey: "gitModal.fullWidthTitle" },
] as const;
// "Preview" shows for a Markdown file only. "Diff" and "Side by side" are off for a file that has no change.
const viewChoices = computed(() =>
  VIEW_CHOICES.filter((choice) => choice.id !== "preview" || md.value).map((choice) => ({
    ...choice,
    isDisabled: isUnchanged.value && (choice.id === "unified" || choice.id === "split"),
  })),
);
const error = ref("");
const loading = ref(false);
let seq = 0;

async function load() {
  const path = selected.value;
  const root = st.value?.root;
  diff.value = [];
  diffHtml.value = [];
  fileLines.value = [];
  rendered.value = "";
  truncated.value = false;
  error.value = "";
  if (!path || !root) return;
  const my = ++seq;
  loading.value = true;
  try {
    const d = isUnchanged.value ? "" : await invoke<string>("git_diff", { root, path });
    if (my !== seq) return;
    const lines = parseDiff(d);
    truncated.value = lines.length > MAX_ROWS;
    diff.value = lines.slice(0, MAX_ROWS);
    diffHtml.value = diff.value.map((l) => (l.kind === "hunk" ? "" : highlightLine(l.text, lang.value)));
    if (mode.value === "file" || mode.value === "preview") {
      // A deleted file: show it as it was in HEAD.
      const deleted = selectedFile.value?.status.includes("D") ?? false;
      const text = await invoke<string>("git_file", { root, path, rev: deleted ? "HEAD" : null });
      if (my !== seq) return;
      const all = text.replace(/\n$/, "");
      if (mode.value === "preview") {
        rendered.value = renderMarkdown(all);
        return;
      }
      // Big files: plain text (highlighting a whole megabyte would freeze the window).
      const rows = all.length > 400_000 ? highlightFile(all, null) : highlightFile(all, lang.value);
      truncated.value = rows.length > MAX_ROWS;
      fileLines.value = rows.slice(0, MAX_ROWS);
    }
  } catch (e) {
    if (my === seq) error.value = String(e);
  } finally {
    if (my === seq) loading.value = false;
  }
}
// Separate getters: the status object is replaced every few seconds by polling,
// which must not reload (and flash) the file being read.
watch([() => selected.value, () => mode.value, () => st.value?.root], load, { immediate: true });

// Links in rendered Markdown open in the browser, never inside the app.
function onMdClick(e: MouseEvent) {
  const a = (e.target as HTMLElement).closest("a");
  if (!a) return;
  e.preventDefault();
  const href = a.getAttribute("href") ?? "";
  if (/^https?:\/\//.test(href)) openUrl(href).catch(() => {});
}
// Another workspace (or the file left the list): show its first file.
watch(
  () => st.value?.root,
  () => {
    const list = st.value?.files ?? [];
    if (!list.some((f) => f.path === git.modal.path)) git.modal.path = list[0]?.path ?? null;
  },
);

const stats = computed(() => diffStats(diff.value));
// Lines added or changed, for the gutter of the file view.
const changedNew = computed(() => new Set(diff.value.filter((l) => l.kind === "add").map((l) => l.new!)));

// ---- Keyboard -----------------------------------------------------------------
function select(path: string) {
  git.modal.path = path;
}
function move(delta: number) {
  const list = files.value;
  if (!list.length) return;
  const i = list.findIndex((f) => f.path === selected.value);
  const next = list[Math.max(0, Math.min(list.length - 1, (i === -1 ? -1 : i) + delta))];
  select(next.path);
  nextTick(() => listEl.value?.querySelector(".file.on")?.scrollIntoView({ block: "nearest" }));
}
const modalEl = ref<HTMLElement>();

function onKey(e: KeyboardEvent) {
  if (e.altKey || e.metaKey || e.ctrlKey) return;
  const target = e.target as HTMLElement | null;
  if (target && (target.closest("select, textarea, [contenteditable]") || (target instanceof HTMLInputElement && e.key !== "Escape"))) {
    if (e.key !== "Escape") return;
  }
  if (e.key === "Escape") {
    e.preventDefault();
    git.modal.open = false;
  } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    move(e.key === "ArrowDown" ? 1 : -1);
  }
}
onMounted(() => {
  window.addEventListener("keydown", onKey, true);
  // Take the focus from the terminal, so arrows do not reach the agent.
  nextTick(() => modalEl.value?.focus());
  if (!selected.value && st.value?.files[0]) select(st.value.files[0].path);
});
onBeforeUnmount(() => window.removeEventListener("keydown", onKey, true));

function statusClass(x: string) {
  if (x === "??") return "new";
  if (x.includes("D")) return "del";
  if (x.includes("A")) return "add";
  if (x.includes("R")) return "ren";
  if (x.includes("U")) return "conf";
  return "mod";
}
const statusLetter = (x: string) => (x === "??" ? "N" : (x.replace(/\./g, "")[0] ?? "M").toUpperCase());
const dir = (p: string) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/") + 1) : "");
const base = (p: string) => p.slice(p.lastIndexOf("/") + 1);
const open = (url?: string | null) => url && openUrl(url).catch(() => {});
</script>

<template>
  <div class="overlay" @mousedown.self="git.modal.open = false">
    <div ref="modalEl" class="window-box" role="dialog" aria-label="Git" tabindex="-1">
      <header class="top">
        <div class="title">
          <button
            type="button"
            class="list-action icon left-sidebar-enable-disable-button"
            :title="settings.gitListHidden ? t('gitModal.showList') : t('gitModal.hideList')"
            @click="settings.gitListHidden = !settings.gitListHidden"
          >{{ settings.gitListHidden ? "⇥" : "⇤" }}</button>
          <span class="repo">{{ repoName }}</span>
          <span v-if="st" class="mono branch">{{ st.branch ?? t("gitModal.detached") }}</span>
          <span v-if="st?.ahead" class="chip warn">↑ {{ st.ahead }}</span>
          <span v-if="st?.behind" class="chip pending">↓ {{ st.behind }}</span>
          <button :title="t('gitModal.openCiTitle')" v-if="fg?.ci" class="btn small chip" :class="fg.ci.level" @click="open(fg.ci.url)">{{ fg.ci.label }}</button>
        </div>
        <div class="tools">
          <div class="btn-group" role="group" :aria-label="t('gitModal.display')">
            <label v-for="choice in viewChoices" :key="choice.id" class="btn btn-check btn-outline theme-secondary" :title="t(choice.titleKey)">
              <input
                type="radio"
                name="git-window-view"
                autocomplete="off"
                :value="choice.id"
                :checked="mode === choice.id"
                :disabled="choice.isDisabled"
                @change="settings.diffMode = choice.id"
              />
              {{ t(choice.labelKey) }}
            </label>
          </div>
          <div v-if="mode === 'preview'" class="btn-group" role="group" :aria-label="t('gitModal.previewWidth')">
            <label v-for="choice in PREVIEW_WIDTH_CHOICES" :key="choice.id" class="btn btn-check btn-outline theme-secondary" :title="t(choice.titleKey)">
              <input v-model="settings.mdWidth" type="radio" name="git-window-preview-width" autocomplete="off" :value="choice.id" />
              {{ t(choice.labelKey) }}
            </label>
          </div>
          <SettingsSwitchRow v-model="settings.codeWrap" :label="t('gitModal.wrap')" :title="t('gitModal.wrapTitle')" />
          <button :title="t('gitModal.refreshTitle')" class="btn" :disabled="git.loading" @click="refreshGit()">{{ git.loading ? "…" : t("gitModal.refresh") }}</button>
          <button :title="t('gitModal.closeTitle')" class="btn icon close" :aria-label="t('gitModal.closeLabel')" @click="git.modal.open = false"><Icon name="x-lg" /></button>
        </div>
      </header>

      <div class="body">
        <aside v-show="!settings.gitListHidden" class="left" :style="{ width: `${settings.gitListWidth}px` }">
          <input v-model="filter" class="form-control filter" :placeholder="t('gitModal.filterPlaceholder')" spellcheck="false" />
          <div class="eyebrow">{{ t("gitModal.changes") }} <span class="count">{{ st ? st.changed + st.untracked : 0 }}</span></div>
          <div ref="listEl" class="files">
            <button
              v-for="f in files"
              :key="f.path"
              class="list-action file"
              :class="{ on: f.path === selected }"
              :title="f.path"
              @click="select(f.path)"
            >
              <span class="st" :class="statusClass(f.status)">{{ statusLetter(f.status) }}</span>
              <span class="name">{{ base(f.path) }}</span>
              <span class="dir mono">{{ dir(f.path) }}</span>
            </button>
            <div v-if="!files.length" class="muted pad">{{ filter ? t("gitModal.noMatch") : t("gitModal.noChanges") }}</div>
          </div>
          <div v-if="fg && !fg.error && fg.requests.length" class="reqs">
            <div class="eyebrow">{{ t("gitModal.openRequests", { kind }) }} <span class="count">{{ fg.requests.length }}</span></div>
            <button v-for="r in fg.requests" :key="r.ref" class="list-action req" :class="{ mine: r.branch === st?.branch }" :title="r.title" @click="open(r.url)">
              <span class="mono ref">{{ r.ref }}</span>
              <span class="chip sm" :class="r.level">{{ r.state }}</span>
              <span v-if="r.review" class="chip sm" :class="r.review.level" :title="r.review.label">{{ r.review.level === "ok" ? "✓" : r.review.level === "crit" ? "✗" : "…" }}</span>
              <span class="req-t">{{ r.title }}</span>
            </button>
          </div>
        </aside>

        <Resizer v-show="!settings.gitListHidden" v-model:width="settings.gitListWidth" side="left" :min="220" :max="900" :default-width="340" />
        <section class="viewer">
          <div class="bar">
            <div class="path mono" :title="selected ?? ''">
              <template v-if="selected">{{ selected }}</template>
              <span v-if="selected && diff.length" class="stats"><span class="plus">+{{ stats.added }}</span> <span class="minus">−{{ stats.removed }}</span></span>
            </div>
          </div>

          <div class="code" :class="[codeThemeClass, { wrap: settings.codeWrap }]">
            <div v-if="!selected" class="empty">{{ t("gitModal.chooseFile") }}</div>
            <div v-else-if="error" class="empty err">{{ error }}</div>
            <div v-else-if="loading && !diff.length && !fileLines.length" class="empty">{{ t("gitModal.loading") }}</div>

            <!-- Markdown, rendered -->
            <article v-else-if="mode === 'preview'" class="md" :class="{ full: settings.mdWidth === 'full' }" @click="onMdClick" v-html="rendered"></article>

            <DiffLines
              v-else-if="mode === 'unified' || mode === 'split'"
              :lines="diff"
              :html="diffHtml"
              :mode="mode"
              :is-wrap="settings.codeWrap"
            />

            <!-- Whole file, changed lines marked -->
            <table v-else class="tbl">
              <tbody>
                <tr v-for="(h, i) in fileLines" :key="i" :class="{ add: changedNew.has(i + 1) }">
                  <td class="no">{{ i + 1 }}</td>
                  <td class="mark">{{ changedNew.has(i + 1) ? "▎" : "" }}</td>
                  <td class="src" v-html="h"></td>
                </tr>
              </tbody>
            </table>
            <div v-if="truncated" class="empty">{{ t("gitModal.truncated", { count: MAX_ROWS }) }}</div>
            <div v-if="selected && !error && !loading && mode !== 'file' && mode !== 'preview' && !diff.length" class="empty">{{ t("gitModal.noTextDiff") }}</div>
          </div>
          <div v-if="selected && isUnchanged" class="foot muted">
            <template v-if="mode === 'preview'">{{ t("gitModal.previewTitle") }} · </template>
            {{ t("gitModal.unchanged") }} · {{ t("gitModal.footerKeys") }}
          </div>
          <div v-else-if="selectedFile" class="foot muted">
            <template v-if="mode === 'preview'">{{ t("gitModal.previewTitle") }} · </template>
            {{ selectedFile.status === "??" ? t("gitModal.untracked") : t("gitModal.comparedToHead") }}
            <template v-if="st?.last_time"> · <AbbreviatedTime :milliseconds="st.last_time * 1000" phrase-key="gitModal.lastCommit" /></template>
            · {{ t("gitModal.footerKeys") }}
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; z-index: 50; background: var(--overlay); display: flex; align-items: center; justify-content: center; }
.window-box {
  outline: none;
  width: 94vw; height: 90vh; display: flex; flex-direction: column; border-radius: 14px; overflow: hidden;
  background: var(--panel); border: 1px solid var(--line-modal); box-shadow: 0 24px 72px var(--shadow);
}
.top { flex-shrink: 0; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--line); }
.title { display: flex; align-items: center; gap: 10px; min-width: 0; flex-wrap: wrap; }
.repo { color: var(--text); font-size: var(--font-size); font-weight: 600; }
.branch { font-size: var(--font-size); color: var(--text-2); }
.tools { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 8px; }
.body { flex: 1; min-height: 0; display: flex; }
.left { flex-shrink: 0; display: flex; flex-direction: column; gap: 8px; padding: 12px; border-right: 1px solid var(--line); min-height: 0; }
.filter { height: 32px; }
.count { color: var(--muted); margin-left: 4px; }
.files { flex: 1; min-height: 80px; overflow-y: auto; display: flex; flex-direction: column; gap: 1px; }
.file { display: flex; align-items: baseline; gap: 8px; min-width: 0; padding: 5px 8px; border: none; border-radius: 6px; background: transparent; color: var(--text-2); text-align: left; font-size: var(--font-size); }
.file:hover { background: var(--hover-soft); }
.file.on { background: var(--hover); color: var(--text); }
.st { width: 14px; flex-shrink: 0; font: 600 var(--font-size) var(--mono); text-align: center; }
.st.mod { color: var(--accent); } .st.add, .st.new { color: var(--ok); } .st.del { color: var(--blocked-text); } .st.ren { color: var(--done-text); } .st.conf { color: var(--blocked-text); }
.name { flex-shrink: 0; max-width: 60%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dir { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--font-size); color: var(--muted); direction: rtl; text-align: left; }
.reqs { max-height: 38%; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; border-top: 1px solid var(--line); padding-top: 10px; }
.req { display: flex; align-items: center; gap: 6px; min-width: 0; padding: 5px 6px; border: none; border-radius: 6px; background: transparent; color: var(--text-2); text-align: left; font-size: var(--font-size); }
.req:hover { background: var(--hover-soft); }
.req.mine { box-shadow: inset 0 0 0 1px var(--pane-ring-selected); }
.ref { color: var(--question); font-size: var(--font-size); flex-shrink: 0; }
.req-t { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.viewer { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.bar { flex-shrink: 0; display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-bottom: 1px solid var(--line); }
.path { flex: 1; min-width: 0; font-size: var(--font-size); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.stats { margin-left: 10px; font-size: var(--font-size); }
.plus { color: var(--ok); } .minus { color: var(--blocked-text); }
.code { flex: 1; min-height: 0; overflow: auto; font-family: var(--mono); line-height: 1.55; }
/* Rendered Markdown: a reading column, GitHub-like. */
.md { max-width: 860px; margin: 0 auto; padding: 28px 36px 60px; font: var(--font-size)/1.7 var(--sans);  color: var(--c-fg); user-select: text; }
.md.full { max-width: none; padding: 24px 40px 60px; }
.md.full :deep(table) { display: table; width: 100%; }
.icon { width: 28px; height: 28px; flex-shrink: 0; border: none; border-radius: 7px; background: transparent; color: var(--muted); font-size: var(--font-size); }
.icon:hover { background: var(--hover); color: var(--text); }
.md :deep(h1), .md :deep(h2) { padding-bottom: 0.3em; border-bottom: 1px solid rgba(var(--wash), 0.1); }
.md :deep(h1) { font-size: 1.9em; margin: 0.2em 0 0.7em; }
.md :deep(h2) { font-size: 1.45em; margin: 1.6em 0 0.6em; }
.md :deep(h3) { font-size: 1.2em; margin: 1.4em 0 0.5em; }
.md :deep(h4), .md :deep(h5), .md :deep(h6) { font-size: 1em; margin: 1.2em 0 0.4em; }
.md :deep(p), .md :deep(ul), .md :deep(ol), .md :deep(blockquote), .md :deep(table), .md :deep(pre) { margin: 0 0 1em; }
.md :deep(ul), .md :deep(ol) { padding-left: 1.6em; }
.md :deep(li) { margin: 0.2em 0; }
.md :deep(li input[type="checkbox"]) { margin-right: 0.4em; accent-color: var(--done); }
.md :deep(a) { color: var(--link); text-decoration: none; }
.md :deep(a:hover) { text-decoration: underline; }
.md :deep(code) { font-family: var(--mono); font-size: 0.86em; padding: 0.15em 0.4em; border-radius: 5px; background: rgba(var(--wash), 0.08); }
.md :deep(pre.md-code) { padding: 14px 16px; border-radius: 8px; background: var(--code-block-bg); overflow: auto; font-size: 0.82em; line-height: 1.55; }
.md :deep(pre.md-code code) { padding: 0; background: none; font-size: inherit; }
.md :deep(blockquote) { padding: 0.2em 1em; border-left: 3px solid rgba(var(--wash), 0.2); color: var(--c-gutter); }
.md :deep(table) { border-collapse: collapse; display: block; overflow-x: auto; font-size: 0.92em; }
.md :deep(th), .md :deep(td) { padding: 6px 12px; border: 1px solid rgba(var(--wash), 0.12); }
.md :deep(th) { background: rgba(var(--wash), 0.05); font-weight: 600; }
.md :deep(tr:nth-child(2n) td) { background: rgba(var(--wash), 0.02); }
.md :deep(hr) { border: none; border-top: 1px solid rgba(var(--wash), 0.12); margin: 2em 0; }
.md :deep(img) { max-width: 100%; }
.tbl { border-collapse: collapse; width: 100%; }
.tbl td { padding: 0 10px; vertical-align: top; }
.no { width: 1%; min-width: 40px; text-align: right; color: var(--c-gutter); user-select: none; white-space: nowrap; }
.mark { width: 1%; padding: 0 4px !important; color: var(--c-gutter); user-select: none; }
.mark { color: var(--ok); }
.src { white-space: pre; user-select: text; }
.code.wrap .src { white-space: pre-wrap; word-break: break-all; }
tr.add > td { background: var(--c-add); }
.empty { padding: 24px; color: var(--c-gutter); font-family: var(--sans); font-size: var(--font-size); }
.err { color: var(--fail); }
.foot { flex-shrink: 0; padding: 6px 12px; border-top: 1px solid var(--line); font-size: var(--font-size); }
.muted { color: var(--muted); }
.pad { padding: 8px; font-size: var(--font-size); }
.chip { display: inline-flex; align-items: center; }
.chip.sm { flex-shrink: 0; }
</style>
