<script setup lang="ts">
import { computed, ref } from "vue";
import { splitDiff, type DiffLine } from "../lib/diff";
import { settings } from "../stores/settings";
import { t } from "../i18n/index";

// The lines of a diff, as a unified diff or side by side. The large Git window and the diff pane both show a diff with it.
// Issue: https://github.com/heidrun-org/heidrun_code/issues/885
const props = defineProps<{
  /** The lines of the diff, from `parseDiff`. */
  lines: DiffLine[];
  /** The highlighted HTML of each line, at the same index as `lines`. */
  html: string[];
  /** "unified" for one column, "split" for two columns side by side. */
  mode: "unified" | "split";
  /** True when the long lines wrap instead of scrolling sideways. */
  isWrap: boolean;
}>();

const htmlOf = computed(() => new Map(props.lines.map((line, index) => [line, props.html[index] ?? ""])));
const split = computed(() => splitDiff(props.lines));
const hl = (line?: DiffLine) => (line ? htmlOf.value.get(line) ?? "" : "");

// Divider of the side-by-side view.
const splitEl = ref<HTMLElement>();
function startSplit(e: PointerEvent) {
  const el = splitEl.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const bar = e.target as HTMLElement;
  bar.setPointerCapture(e.pointerId);
  const move = (ev: PointerEvent) => {
    settings.splitRatio = Math.min(0.85, Math.max(0.15, (ev.clientX - rect.left) / rect.width));
  };
  const end = () => {
    bar.removeEventListener("pointermove", move);
    bar.removeEventListener("pointerup", end);
    bar.removeEventListener("pointercancel", end);
    bar.removeEventListener("lostpointercapture", end);
  };
  bar.addEventListener("pointermove", move);
  bar.addEventListener("pointerup", end);
  bar.addEventListener("pointercancel", end);
  bar.addEventListener("lostpointercapture", end);
  e.preventDefault();
}
</script>

<template>
  <!-- Unified diff -->
  <table v-if="mode === 'unified'" class="tbl" :class="{ wrap: isWrap }">
    <tbody>
      <tr v-for="(l, i) in lines" :key="i" :class="l.kind">
        <template v-if="l.kind === 'hunk'"><td colspan="4" class="hunk mono">{{ l.text }}</td></template>
        <template v-else>
          <td class="no">{{ l.old ?? "" }}</td>
          <td class="no">{{ l.new ?? "" }}</td>
          <td class="sign">{{ l.kind === "add" ? "+" : l.kind === "del" ? "−" : "" }}</td>
          <td class="src" v-html="html[i]"></td>
        </template>
      </tr>
    </tbody>
  </table>

  <!-- Side by side: two columns split where you want (drag the bar, double-click = middle).
       Without wrapping each side scrolls sideways on its own; rows stay aligned. -->
  <div
    v-else-if="!isWrap"
    ref="splitEl"
    class="split2"
    :style="{ gridTemplateColumns: `minmax(0, ${settings.splitRatio}fr) 6px minmax(0, ${1 - settings.splitRatio}fr)` }"
  >
    <div class="side">
      <table class="tbl">
        <tbody>
          <tr v-for="(r, i) in split" :key="i">
            <td v-if="r.hunk" colspan="2" class="hunk mono">{{ r.hunk }}</td>
            <template v-else>
              <td class="no" :class="r.left?.kind">{{ r.left?.old ?? "" }}</td>
              <td class="src" :class="r.left ? r.left.kind : 'none'" v-html="hl(r.left) || '&#8203;'"></td>
            </template>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="split-bar" :title="t('gitModal.splitBarTitle')" @pointerdown="startSplit" @dblclick="settings.splitRatio = 0.5"></div>
    <div class="side">
      <table class="tbl">
        <tbody>
          <tr v-for="(r, i) in split" :key="i">
            <td v-if="r.hunk" colspan="2" class="hunk mono">&#8203;</td>
            <template v-else>
              <td class="no" :class="r.right?.kind">{{ r.right?.new ?? "" }}</td>
              <td class="src" :class="r.right ? r.right.kind : 'none'" v-html="hl(r.right) || '&#8203;'"></td>
            </template>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
  <table v-else class="tbl split fixed wrap">
    <colgroup>
      <col class="c-no" />
      <col :style="{ width: `${settings.splitRatio * 100}%` }" />
      <col class="c-no" />
      <col :style="{ width: `${(1 - settings.splitRatio) * 100}%` }" />
    </colgroup>
    <tbody>
      <tr v-for="(r, i) in split" :key="i">
        <template v-if="r.hunk"><td colspan="4" class="hunk mono">{{ r.hunk }}</td></template>
        <template v-else>
          <td class="no" :class="r.left?.kind">{{ r.left?.old ?? "" }}</td>
          <td class="src" :class="r.left ? r.left.kind : 'none'" v-html="hl(r.left)"></td>
          <td class="no sepl" :class="r.right?.kind">{{ r.right?.new ?? "" }}</td>
          <td class="src" :class="r.right ? r.right.kind : 'none'" v-html="hl(r.right)"></td>
        </template>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
.tbl { border-collapse: collapse; width: 100%; }
.tbl td { padding: 0 10px; vertical-align: top; }
.no { width: 1%; min-width: 40px; text-align: right; color: var(--c-gutter); user-select: none; white-space: nowrap; }
.sign { width: 1%; padding: 0 4px !important; color: var(--c-gutter); user-select: none; }
.src { white-space: pre; user-select: text; }
.tbl.wrap .src { white-space: pre-wrap; word-break: break-all; }
.split2 { display: grid; min-width: 0; align-items: start; }
.side { min-width: 0; overflow-x: auto; }
.side .tbl { width: max-content; min-width: 100%; }
.split-bar { align-self: stretch; cursor: col-resize; background: rgba(var(--wash), 0.06); }
.split-bar:hover { background: var(--resize-hover); }
.tbl.fixed { table-layout: fixed; }
.c-no { width: 52px; }
.sepl { border-left: 1px solid rgba(var(--wash), 0.06); }
tr.add > td, td.add { background: var(--c-add); }
tr.del > td, td.del { background: var(--c-del); }
tr.add .sign, td.add.no { color: var(--ok); }
tr.del .sign, td.del.no { color: var(--blocked-text); }
td.none { background: rgba(var(--wash), 0.02); }
.hunk { background: var(--c-hunk); color: var(--c-hunk-fg); padding: 2px 10px !important; }
</style>
