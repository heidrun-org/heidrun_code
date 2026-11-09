<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import DialogCloseButton from "./DialogCloseButton.vue";
import InformationCardTooltip from "./InformationCardTooltip.vue";
import { currentProject } from "../stores/project";
import { toast } from "../stores/session";
import { VARIABLES, addMacro, macroEditor, macros, projectMacros, updateMacro } from "../stores/macros";
import { t } from "../i18n/index";
import { renderMarkdown } from "../lib/markdown";

const selectedId = macroEditor.selectedId;
const isFromProject = macroEditor.isFromProject;
const isNew = selectedId === null;
const isReadOnly = macroEditor.isReadOnly;
const selectedMacro = computed(() =>
  (isFromProject ? projectMacros.value : macros.personal).find((macro) => macro.id === selectedId),
);
const label = ref(selectedMacro.value?.label ?? '');
const description = ref(selectedMacro.value?.description ?? '');
const text = ref(selectedMacro.value?.text ?? '');
const inProject = ref(isFromProject);
const isSaving = ref(false);

// Another program, such as heidrun_code_ctrl, may delete the macro that is open.
watch(selectedMacro, (macro) => {
  if (isNew === false && macro === undefined) {
    close();
  }
});

async function save() {
  if (isReadOnly === true || isSaving.value === true) {
    return;
  }
  if (text.value.trim() === '') {
    toast(t('macroEditor.contentRequired'));
    return;
  }
  isSaving.value = true;
  try {
    if (isNew === true) {
      await addMacro(label.value, description.value, text.value, inProject.value);
      toast(inProject.value ? t('macroEditor.addedToProject') : t('macroEditor.saved'));
    } else {
      await updateMacro(selectedId, isFromProject, label.value, description.value, text.value, inProject.value);
      toast(t('macroEditor.saved'));
    }
    close();
  } catch (error) {
    toast(String(error));
  } finally {
    isSaving.value = false;
  }
}

function discard() {
  label.value = selectedMacro.value?.label ?? '';
  description.value = selectedMacro.value?.description ?? '';
  text.value = selectedMacro.value?.text ?? '';
  inProject.value = isNew === false && isFromProject;
}

function close() {
  macroEditor.open = false;
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    close();
  }
}

onMounted(() => window.addEventListener("keydown", onKeyDown, true));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeyDown, true));
</script>

<template>
  <div class="overlay" @mousedown.self="close">
    <dialog class="dialog dialog-lg dialog-instant dialog-nonmodal dialog-scrollable" open aria-labelledby="macro-editor-title">
      <div class="dialog-header">
        <div id="macro-editor-title" class="dialog-title me-auto" role="heading" aria-level="2">{{ t(isReadOnly ? "macroEditor.viewTitle" : isNew ? "macroEditor.createTitle" : "macroEditor.title") }}</div>
        <DialogCloseButton :title="t('macroEditor.close')" :label="t('macroEditor.close')" @click="close" />
      </div>

      <div class="dialog-body">
        <div class="mb-3">
          <div class="d-flex align-items-center gap-2 mb-1">
            <div class="form-label mb-0">{{ t("macroEditor.labelField") }}</div>
            <InformationCardTooltip :title="t('macroEditor.labelField')" :blocks="[{ title: t('settingsHelp.whatTitle'), text: t('macroEditor.titleHelp') }]" placement="top" :open-delay="300" above-dialog v-slot="{ triggerProps }">
              <button v-bind="triggerProps" type="button" class="btn icon small macro-help-button" :aria-label="t('macroEditor.helpLabel', { field: t('macroEditor.labelField') })"><span class="macro-help-mark" aria-hidden="true">?</span></button>
            </InformationCardTooltip>
          </div>
          <div v-if="isReadOnly" class="card macro-value-card">{{ label }}</div>
          <input v-else id="macro-editor-label" v-model="label" class="form-control" autocomplete="off" spellcheck="false" />
        </div>

        <div class="mb-3">
          <div class="d-flex align-items-center gap-2 mb-1">
            <div class="form-label mb-0">{{ t("macroEditor.description") }}</div>
            <InformationCardTooltip :title="t('macroEditor.description')" :blocks="[{ title: t('settingsHelp.whatTitle'), text: t('macroEditor.descriptionHelp') }]" placement="top" :open-delay="300" above-dialog v-slot="{ triggerProps }">
              <button v-bind="triggerProps" type="button" class="btn icon small macro-help-button" :aria-label="t('macroEditor.helpLabel', { field: t('macroEditor.description') })"><span class="macro-help-mark" aria-hidden="true">?</span></button>
            </InformationCardTooltip>
          </div>
          <article v-if="isReadOnly" class="card md-doc full macro-value-card" v-html="renderMarkdown(description)"></article>
          <textarea v-else id="macro-editor-description" v-model="description" class="form-control" rows="3" spellcheck="false"></textarea>
        </div>

        <div class="mb-3">
          <div class="d-flex align-items-center gap-2 mb-1">
            <div class="form-label mb-0">{{ t("macroEditor.location") }}</div>
            <InformationCardTooltip :title="t('macroEditor.location')" :blocks="[{ title: t('settingsHelp.whatTitle'), text: t('macroEditor.locationHelp') }]" placement="top" :open-delay="300" above-dialog v-slot="{ triggerProps }">
              <button v-bind="triggerProps" type="button" class="btn icon small macro-help-button" :aria-label="t('macroEditor.helpLabel', { field: t('macroEditor.location') })"><span class="macro-help-mark" aria-hidden="true">?</span></button>
            </InformationCardTooltip>
          </div>
          <div v-if="isReadOnly"><span class="badge theme-secondary">{{ t(inProject ? "macroEditor.projectLevel" : "macroEditor.userLevel") }}</span></div>
          <div v-else class="btn-group" role="group" :aria-label="t('macroEditor.location')">
            <label class="btn btn-check btn-outline theme-secondary">
              <input id="macro-editor-user-level" v-model="inProject" type="radio" name="macro-editor-location" autocomplete="off" :value="false" />
              {{ t("macroEditor.userLevel") }}
            </label>
            <label v-if="currentProject" class="btn btn-check btn-outline theme-secondary">
              <input id="macro-editor-project-level" v-model="inProject" type="radio" name="macro-editor-location" autocomplete="off" :value="true" />
              {{ t("macroEditor.projectLevel") }}
            </label>
          </div>
        </div>

        <div class="mb-3">
          <div class="d-flex align-items-center gap-2 mb-1">
            <label v-if="isReadOnly === false" class="form-label mb-0" for="macro-editor-text">{{ t("macroEditor.content") }}</label>
            <div v-else class="form-label mb-0">{{ t("macroEditor.content") }}</div>
            <InformationCardTooltip :title="t('macroEditor.content')" :blocks="[{ title: t('settingsHelp.whatTitle'), text: t('macroEditor.contentHelp') }]" placement="top" :open-delay="300" above-dialog v-slot="{ triggerProps }">
              <button v-bind="triggerProps" type="button" class="btn icon small macro-help-button" :aria-label="t('macroEditor.helpLabel', { field: t('macroEditor.content') })"><span class="macro-help-mark" aria-hidden="true">?</span></button>
            </InformationCardTooltip>
          </div>
          <article v-if="isReadOnly" class="card md-doc full macro-value-card" v-html="renderMarkdown(text)"></article>
          <textarea v-else id="macro-editor-text" v-model="text" class="form-control" rows="7" spellcheck="false"></textarea>
          <div v-if="isReadOnly === false" class="form-text mono" :title="t('macroEditor.variablesTitle')">{{ VARIABLES.join(" ") }}</div>
        </div>

      </div>

      <div v-if="isReadOnly === false" class="dialog-footer">
        <button type="button" class="btn lg" :disabled="isSaving" :title="t('macroEditor.discardTitle')" @click="discard">{{ t("macroEditor.discard") }}</button>
        <button type="button" class="btn lg primary" :disabled="isSaving" @click="save">{{ t("macroEditor.save") }}</button>
      </div>
    </dialog>
  </div>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; z-index: 58; background: var(--overlay); }
textarea {
  box-sizing: border-box;
  width: 100%;
  min-width: 100%;
  max-width: 100%;
  resize: vertical;
}
.macro-value-card {
  background: var(--field);
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  padding: 0.75rem;
}
.macro-value-card :deep(> :last-child) { margin-bottom: 0; }
.macro-help-button.btn.icon.small {
  width: 22px;
  height: 22px;
}
.macro-help-mark {
  display: inline-flex;
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  align-items: center;
  justify-content: center;
  border: 1px solid currentColor;
  border-radius: 50%;
  font-size: 0.6875rem;
  font-weight: 600;
  line-height: 1;
}
</style>
