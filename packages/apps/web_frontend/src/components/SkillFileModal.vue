<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { openUrl } from "@tauri-apps/plugin-opener";
import Icon from "./Icon.vue";
import { settings } from "../stores/settings";
import { closeSkillView, skills } from "../stores/skills";
import { codeThemeClass } from "../stores/theme";
import { highlightFile, languageFor } from "../lib/highlight";
import { renderMarkdown } from "../lib/markdown";
import { splitSkillText } from "../lib/skill_text";
import { isSameSkillText, skillDifferenceRows } from "../lib/skill_difference";
import { t } from "../i18n/index";

/** A file longer than this is shown without colours: the highlighter would take too long. */
const MAX_HIGHLIGHTED_CHARS = 400_000;

const dialog = ref<HTMLElement>();
const view = computed(() => skills.view);
const parts = computed(() => splitSkillText(view.value?.text ?? ""));
const rendered = computed(() => renderMarkdown(parts.value.body));
const lines = computed(() => {
  const text = view.value?.text ?? "";
  return highlightFile(text, text.length > MAX_HIGHLIGHTED_CHARS ? null : languageFor("SKILL.md"));
});

// When a skill with the same name is installed, the window can show what differs between the installed text and this text.
// It opens on the differences if there are some, until the developer chooses Rendered or Source.
const differenceChosen = ref<boolean | null>(null);
const installedText = computed(() => view.value?.installedText);
const isDifferent = computed(() => installedText.value !== undefined && isSameSkillText(installedText.value, view.value?.text ?? "") === false);
const showDifference = computed(() => installedText.value !== undefined && (differenceChosen.value ?? isDifferent.value));
const differenceRows = computed(() => (showDifference.value ? skillDifferenceRows(installedText.value ?? "", view.value?.text ?? "") : []));
watch(view, () => {
  differenceChosen.value = null;
});

function chooseRendered(rendered: boolean) {
  differenceChosen.value = false;
  settings.skillsViewRendered = rendered;
}

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopImmediatePropagation();
    closeSkillView();
  }
}

// Links of the rendered text open in the browser, never inside the application.
function onLinkClick(e: MouseEvent) {
  const link = (e.target as HTMLElement).closest("a");
  if (link === null) {
    return;
  }
  e.preventDefault();
  const href = link.getAttribute("href") ?? "";
  if (/^https?:\/\//.test(href)) {
    openUrl(href).catch(() => {});
  }
}

onMounted(() => {
  window.addEventListener("keydown", onKey, true);
  nextTick(() => dialog.value?.focus());
});
onBeforeUnmount(() => window.removeEventListener("keydown", onKey, true));
</script>

<template>
  <div v-if="view !== null" class="overlay" @mousedown.self="closeSkillView">
    <div ref="dialog" class="window-box" role="dialog" aria-labelledby="skill-title" tabindex="-1">
      <header class="top">
        <h2 id="skill-title">{{ view.name }}</h2>
        <span class="origin">{{ view.originLabel }}</span>
        <span class="grow"></span>
        <div class="seg" role="radiogroup" :aria-label="t('settingsSkills.viewLabel')">
          <button
            v-if="installedText !== undefined"
            class="btn small"
            role="radio"
            :title="t('settingsSkills.differenceTitle')"
            :aria-checked="showDifference"
            :class="{ on: showDifference }"
            @click="differenceChosen = true"
          >{{ t("settingsSkills.difference") }}</button>
          <button
            class="btn small"
            role="radio"
            :title="t('settingsSkills.renderedTitle')"
            :aria-checked="!showDifference && settings.skillsViewRendered"
            :class="{ on: !showDifference && settings.skillsViewRendered }"
            @click="chooseRendered(true)"
          >{{ t("settingsSkills.rendered") }}</button>
          <button
            class="btn small"
            role="radio"
            :title="t('settingsSkills.sourceTitle')"
            :aria-checked="!showDifference && !settings.skillsViewRendered"
            :class="{ on: !showDifference && !settings.skillsViewRendered }"
            @click="chooseRendered(false)"
          >{{ t("settingsSkills.source") }}</button>
        </div>
        <button class="btn icon close" :title="t('settingsSkills.closeTitle')" :aria-label="t('settingsSkills.closeLabel')" @click="closeSkillView"><Icon name="x-lg" /></button>
      </header>
      <div class="body" :class="codeThemeClass">
        <div v-if="view.loading" class="empty">{{ t("settingsSkills.loading") }}</div>
        <template v-else-if="showDifference">
          <div class="diff-help">{{ isDifferent ? t("settingsSkills.differenceHelp") : t("settingsSkills.differenceNone") }}</div>
          <div v-if="isDifferent" class="diff">
            <div v-for="(row, index) in differenceRows" :key="index" class="d-row" :class="row.kind">
              <span class="d-sign">{{ row.kind === "add" ? "+" : row.kind === "del" ? "−" : "" }}</span>{{ row.text || " " }}
            </div>
          </div>
        </template>
        <template v-else-if="settings.skillsViewRendered">
          <dl v-if="parts.fields.length > 0" class="front">
            <template v-for="field in parts.fields" :key="field.key">
              <dt>{{ field.key }}</dt>
              <dd>{{ field.value }}</dd>
            </template>
          </dl>
          <article class="md-doc" @click="onLinkClick" v-html="rendered"></article>
        </template>
        <table v-else class="tbl">
          <tbody>
            <tr v-for="(html, index) in lines" :key="index">
              <td class="no">{{ index + 1 }}</td>
              <td class="src" v-html="html || '&#8203;'"></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
:where(button:not(.btn)) { background: transparent; border: 0; color: inherit; font: inherit; }
.overlay { position: fixed; inset: 0; z-index: 61; background: var(--overlay); display: flex; align-items: center; justify-content: center; padding: 24px; }
.window-box {
  width: min(1100px, 100%); height: 100%; display: flex; flex-direction: column; overflow: hidden; border-radius: 14px;
  background: var(--panel); border: 1px solid var(--line-strong); box-shadow: 0 24px 64px var(--shadow); outline: none;
}
.top { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-bottom: 1px solid var(--line); min-width: 0; }
h2 { margin: 0; font-size: var(--font-size); font-weight: 600; white-space: nowrap; }
.origin { color: var(--muted); font-size: var(--font-size); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.grow { flex: 1; }
.seg { display: flex; padding: 3px; border-radius: 9px; background: var(--bg); gap: 3px; flex-shrink: 0; }
.body { flex: 1; min-height: 0; overflow: auto; font-family: var(--mono); line-height: 1.55; }
.empty { padding: 24px; color: var(--muted); font-family: var(--sans); font-size: var(--font-size); }
.front { display: grid; grid-template-columns: max-content 1fr; gap: 4px 14px; max-width: 860px; margin: 24px auto 0; padding: 12px 16px; border-radius: 10px; background: var(--field); font: var(--font-size)/1.5 var(--sans); }
.front dt { color: var(--muted); }
.front dd { margin: 0; color: var(--text-2); overflow-wrap: anywhere; user-select: text; }
.md-doc { padding: 24px 36px 60px; }
.diff-help { padding: 12px 16px; color: var(--text-2); font-family: var(--sans); font-size: var(--font-size); }
.diff { white-space: pre-wrap; overflow-wrap: anywhere; user-select: text; }
.d-row { padding: 0 10px; }
.d-row.add { background: var(--c-add); }
.d-row.del { background: var(--c-del); }
.d-row.gap { color: var(--c-gutter); }
.d-sign { display: inline-block; width: 16px; color: var(--c-gutter); user-select: none; }
.tbl { border-collapse: collapse; width: 100%; }
.tbl td { padding: 0 10px; vertical-align: top; }
.no { width: 1%; min-width: 44px; text-align: right; color: var(--c-gutter); user-select: none; white-space: nowrap; }
.src { white-space: pre-wrap; overflow-wrap: anywhere; user-select: text; }
</style>
