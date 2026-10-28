<script setup lang="ts">
import Icon from "./Icon.vue";
import { computed, ref } from "vue";
import ConfirmButton from "./ConfirmButton.vue";
import ChatImagesSection from "./ChatImagesSection.vue";
import SettingsSwitchRow from "./settings/SettingsSwitchRow.vue";
import InlineRename from "./InlineRename.vue";
import { moveNote, notes, removeNote, renameNote, visibleNotes, type Note } from "../stores/notes";
import { useReorder } from "../lib/reorder";
import { agentGroups, allPanes, paneFullName, sendPrompt, toast } from "../stores/session";
import { copy } from "../lib/clipboard";
import { settings } from "../stores/settings";
import AbbreviatedTime from "./AbbreviatedTime.vue";
import { t } from "../i18n/index";

const list = visibleNotes;
const others = computed(() => notes.list.length - list.value.length);

// Only the grip starts a drag, so text in the note stays selectable.
const drag = useReorder("y", (id, at) => moveNote(list.value.map((n) => n.id), id, at));

const agents = computed(() => allPanes.value.filter((p) => p.agent));
const renaming = ref<string | null>(null);
const expanded = ref<Record<string, boolean>>({});

async function copyNote(n: Note) {
  await copy(n.text);
  toast(t("notesPanel.copied"));
}

function sendTo(n: Note, paneId: string) {
  if (!paneId) return;
  sendPrompt(paneId, `${n.title}\n\n\`\`\`\n${n.text}\n\`\`\``);
  const agent = agents.value.find((a) => a.pane_id === paneId);
  if (agent) toast(t("notesPanel.sentTo", { agent: paneFullName(agent) }));
}
</script>

<template>
  <div class="panel">
    <header class="notes-title d-flex align-items-center">
      <span class="fw-semibold text-truncate me-auto">{{ t("notesPanel.title") }}</span>
      <SettingsSwitchRow v-model="settings.notesShowAll" :label="t('notesPanel.allWorkspaces')" />
    </header>

    <p v-if="!list.length" class="empty">
      {{ t("notesPanel.emptyBefore") }}<kbd>⇧⌘P</kbd>{{ t("notesPanel.emptyAfter") }}
      <template v-if="others">{{ t("notesPanel.otherWorkspaces", { count: others }) }}</template>
    </p>

    <article
      v-for="(n, ni) in list"
      :key="n.id"
      class="note"
      :class="{
        dragging: drag.dragging.value === n.id,
        'drop-before': drag.gap.value === ni,
        'drop-after': drag.gap.value === ni + 1 && ni === list.length - 1,
      }"
      :data-reorder-id="n.id"
    >
      <header>
        <span class="grip" aria-hidden="true" :title="t('notesPanel.dragToReorder')" @pointerdown="drag.onPointerDown($event, list.map((x) => x.id))">⋮⋮</span>
        <InlineRename
          v-if="renaming === n.id"
          :value="n.title"
          :label="t('notesPanel.noteTitle')"
          @save="(v) => { renameNote(n.id, v); renaming = null; }"
          @cancel="renaming = null"
        />
        <h3 v-else :title="t('notesPanel.doubleClickToRename')" @dblclick="renaming = n.id">{{ n.title }}</h3>
        <button class="btn icon small tool" :aria-label="t('notesPanel.openLarge')" :title="t('notesPanel.openLarge')" @click="notes.openId = n.id">
          <Icon name="arrows-angle-expand" />
        </button>
        <ConfirmButton icon="x-lg" :confirm-label="t('notesPanel.deleteConfirm')" :question="t('notesPanel.deleteNote')" @confirm="removeNote(n.id)" />
      </header>
      <div class="origin">{{ n.origin }} · <AbbreviatedTime :milliseconds="n.createdAt" /></div>
      <pre class="mono" :class="{ open: expanded[n.id] }" :title="t('notesPanel.textTitle')" @click="expanded[n.id] = !expanded[n.id]" @dblclick="notes.openId = n.id">{{ n.text }}</pre>
      <div class="actions">
        <button :title="t('notesPanel.copyTitle')" class="btn" @click="copyNote(n)">{{ t("notesPanel.copy") }}</button>
        <label class="sr" :for="`send-${n.id}`">{{ t("notesPanel.sendToAgent") }}</label>
        <select
          v-if="agents.length"
          :id="`send-${n.id}`"
          class="form-control send"
          @change="(e) => { sendTo(n, (e.target as HTMLSelectElement).value); (e.target as HTMLSelectElement).value = ''; }"
        >
          <option value="">{{ t("notesPanel.sendTo") }}</option>
          <optgroup v-for="g in agentGroups" :key="g.workspace" :label="g.workspace">
            <option v-for="a in g.items" :key="a.pane.pane_id" :value="a.pane.pane_id">{{ a.label }}</option>
          </optgroup>
        </select>
      </div>
    </article>

    <ChatImagesSection />
  </div>
</template>

<style scoped>
.panel { flex: 1; min-height: 0; overflow-y: auto; padding: 12px 14px 18px; display: flex; flex-direction: column; gap: 10px; }
.empty { margin: 0; font-size: var(--font-size); color: var(--muted); line-height: 1.6; }
kbd { font-family: var(--mono); color: var(--text-2); }
.note { display: flex; flex-direction: column; gap: 6px; padding: 12px; border-radius: 10px; background: var(--field); border: 1px solid var(--line-strong); }
.note header { display: flex; align-items: center; gap: 6px; }
h3 { flex: 1; min-width: 0; margin: 0; font-size: var(--font-size); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; user-select: text; }
.origin { font-size: var(--font-size); color: var(--muted); }
.tool { display: inline-flex; align-items: center; justify-content: center; }
pre {
  margin: 0; padding: 8px 10px; border-radius: 7px; background: var(--bg); color: var(--text-2);
  font-size: var(--font-size); line-height: 1.5; white-space: pre-wrap; word-break: break-word;
  max-height: 96px; overflow: hidden; cursor: pointer; user-select: text;
}
pre.open { max-height: none; }
.actions { display: flex; gap: 6px; }
.send { flex: 1; height: 30px; }
.dragging { opacity: 0.4; }
.drop-before, .drop-after { position: relative; }
.drop-before::before, .drop-after::after {
  content: ""; position: absolute; left: 6px; right: 6px; height: 2px; border-radius: 1px; background: var(--done);
}
.drop-before::before { top: -5px; }
.drop-after::after { bottom: -5px; }
.grip { color: var(--muted); cursor: grab; font-size: var(--font-size); letter-spacing: -2px; padding: 0 2px; user-select: none; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
