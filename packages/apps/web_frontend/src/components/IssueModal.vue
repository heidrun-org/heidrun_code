<script setup lang="ts">
import Icon from "./Icon.vue";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { openUrl } from "@tauri-apps/plugin-opener";
import { issueView } from "../stores/issues";
import { settings } from "../stores/settings";
import { renderMarkdown } from "../lib/markdown";
import AbbreviatedTime from "./AbbreviatedTime.vue";
import PullRequestMergeBar from "./PullRequestMergeBar.vue";
import { pullRequestMerge } from "../stores/pull_request_merge";
import { stateOf } from "../stores/issues";
import { t } from "../i18n/index";

const el = ref<HTMLElement>();
const d = computed(() => issueView.data);
const mdCtx = computed(() => {
  if (!d.value) return undefined;
  let host = "";
  try {
    host = new URL(d.value.project).hostname;
  } catch {
    /* no project page */
  }
  // Images load only from the forge itself (and GitHub's attachment hosts).
  const imgHosts = [host, ...(d.value.forge === "GitHub" ? ["user-images.githubusercontent.com", "private-user-images.githubusercontent.com", "avatars.githubusercontent.com"] : [])].filter(Boolean);
  return { project: d.value.project, imgHosts };
});
const body = computed(() => (d.value?.body ? renderMarkdown(d.value.body, mdCtx.value) : ""));
const comments = computed(() => (d.value?.comments ?? []).map((c) => ({ ...c, html: renderMarkdown(c.body, mdCtx.value) })));
const webUrl = computed(() => issueView.url ?? d.value?.url ?? null);
const forgeName = computed(() => d.value?.forge ?? (issueView.url?.includes("github") ? "GitHub" : "GitLab"));

function close() {
  issueView.open = false;
}

// After the merge of the shown item, the window shows the state "Merged" and no merge bar (issue #570).
watch(
  () => pullRequestMerge.mergeCount,
  () => {
    if (issueView.merge !== null && issueView.data !== null && pullRequestMerge.name === issueView.data.ref) {
      const [state, stateLevel] = stateOf("merged");
      Object.assign(issueView.data, { state, stateLevel });
      issueView.merge = null;
    }
  },
);
function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    close();
  }
}
// Links of the description open in the browser, never inside the app.
function onClick(e: MouseEvent) {
  const a = (e.target as HTMLElement).closest("a");
  if (!a) return;
  e.preventDefault();
  const href = a.getAttribute("href") ?? "";
  if (/^https?:\/\//.test(href)) openUrl(href).catch(() => {});
}
onMounted(() => {
  window.addEventListener("keydown", onKey, true);
  nextTick(() => el.value?.focus());
});
onBeforeUnmount(() => window.removeEventListener("keydown", onKey, true));
</script>

<template>
  <div class="overlay" @mousedown.self="close">
    <div ref="el" class="window-box" role="dialog" :aria-label="t('issueModal.dialogLabel')" tabindex="-1">
      <header class="top">
        <div class="title">
          <span class="mono ref">{{ d?.ref ?? "…" }}</span>
          <span v-if="d" class="chip" :class="d.stateLevel">{{ d.state }}</span>
          <span v-for="l in d?.labels ?? []" :key="l" class="label">{{ l }}</span>
        </div>
        <div class="tools">
          <div class="seg" role="radiogroup" :aria-label="t('issueModal.readingWidth')">
            <button class="btn small" :title="t('issueModal.centeredTitle')" :class="{ on: settings.mdWidth === 'center' }" @click="settings.mdWidth = 'center'">{{ t("issueModal.centered") }}</button>
            <button class="btn small" :title="t('issueModal.fullWidthTitle')" :class="{ on: settings.mdWidth === 'full' }" @click="settings.mdWidth = 'full'">{{ t("issueModal.fullWidth") }}</button>
          </div>
          <button :title="t('issueModal.openTitle')" v-if="webUrl" class="btn" @click="openUrl(webUrl!)">{{ t("issueModal.openOn", { forge: forgeName }) }} <Icon name="box-arrow-up-right" /></button>
          <button :title="t('issueModal.closeTitle')" class="btn icon close" :aria-label="t('issueModal.closeLabel')" @click="close"><Icon name="x-lg" /></button>
        </div>
      </header>

      <div class="scroll" @click="onClick" @auxclick="onClick">
        <div v-if="issueView.loading" class="empty">{{ t("issueModal.loading") }}</div>
        <div v-else-if="issueView.error" class="empty err">{{ issueView.error }}</div>
        <template v-else-if="d">
          <div class="md-doc head-doc" :class="{ full: settings.mdWidth === 'full' }">
            <h1 class="t">{{ d.title }}</h1>
            <p class="meta">
              <span v-if="d.author">{{ d.author }}</span>
              <span v-if="d.at"> · <AbbreviatedTime :milliseconds="d.at" /></span>
              <span v-if="d.branches" class="mono"> · {{ d.branches }}</span>
            </p>
            <PullRequestMergeBar
              v-if="issueView.merge !== null"
              class="merge"
              :facts="issueView.merge.facts"
              :folder="issueView.merge.folder"
              :forge="issueView.merge.forge"
              :name="d.ref"
              :web-base="issueView.merge.webBase"
            />
          </div>
          <article v-if="body" class="md-doc" :class="{ full: settings.mdWidth === 'full' }" v-html="body"></article>
          <div v-else class="md-doc muted" :class="{ full: settings.mdWidth === 'full' }">{{ t("issueModal.noDescription") }}</div>

          <section v-if="comments.length" class="md-doc comments" :class="{ full: settings.mdWidth === 'full' }">
            <h2>{{ t("issueModal.comments") }} <span class="count">{{ comments.length }}</span></h2>
            <div v-for="(c, i) in comments" :key="i" class="comment">
              <div class="c-head"><strong>{{ c.author }}</strong><span v-if="c.at" class="muted"> · <AbbreviatedTime :milliseconds="c.at" /></span></div>
              <div class="c-body" v-html="c.html"></div>
            </div>
          </section>
        </template>
      </div>
      <footer class="foot muted">{{ t("issueModal.footer") }}</footer>
    </div>
  </div>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; z-index: 55; background: var(--overlay); display: flex; align-items: center; justify-content: center; }
.window-box {
  outline: none; width: 94vw; height: 90vh; display: flex; flex-direction: column; border-radius: 14px; overflow: hidden;
  background: var(--panel); border: 1px solid var(--line-modal); box-shadow: 0 24px 72px var(--shadow);
}
.top { flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--line); }
.title { display: flex; align-items: center; gap: 8px; min-width: 0; flex-wrap: wrap; }
.ref { color: var(--question); font-size: var(--font-size); }
.label { font-size: var(--font-size); padding: 2px 8px; border-radius: 10px; background: var(--chip); color: var(--text-2); }
.chip { height: 22px; padding: 0 8px; border-radius: 11px; display: inline-flex; align-items: center; font-size: var(--font-size); font-weight: 600; background: var(--chip); color: var(--text-2); }
.chip.ok { background: var(--tint-ok); color: var(--ok); } .chip.merged { background: var(--tint-merged); color: var(--question); }
.chip.crit { background: var(--tint-crit); color: var(--blocked-text); } .chip.muted { color: var(--muted); }
.tools { display: flex; align-items: center; gap: 8px; }
.seg { display: inline-flex; padding: 2px; border-radius: 8px; background: var(--bg); gap: 2px; }
.scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 24px 40px 60px; }
.scroll .md-doc { font-size: inherit; }
.head-doc .t { border: none; margin-bottom: 0.2em; }
.meta { color: var(--muted); font-size: 0.85em; }
.merge { margin-bottom: 1em; }
.comments { margin-top: 2em; }
.count { color: var(--muted); font-weight: 400; font-size: 0.8em; }
.comment { border: 1px solid var(--line-strong); border-radius: 10px; padding: 10px 16px; margin-bottom: 12px; background: rgba(var(--wash), 0.02); }
.c-head { font-size: 0.85em; margin-bottom: 4px; }
.c-body :deep(p:last-child) { margin-bottom: 0; }
.empty { padding: 24px; color: var(--muted); }
.err { color: var(--fail); }
.muted { color: var(--muted); }
.foot { flex-shrink: 0; padding: 6px 16px; border-top: 1px solid var(--line); font-size: var(--font-size); }
</style>
