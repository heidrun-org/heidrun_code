<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import DialogCloseButton from "./DialogCloseButton.vue";
import { currentProject } from "../stores/project";
import { toast } from "../stores/session";
import { VARIABLES, addMacro, macroEditor, macros, projectMacros, updateMacro } from "../stores/macros";
import { t } from "../i18n/index";

const selectedId = macroEditor.selectedId;
const isFromProject = macroEditor.isFromProject;
const isNew = selectedId === null;
const selectedMacro = computed(() =>
  (isFromProject ? projectMacros.value : macros.personal).find((macro) => macro.id === selectedId),
);
const label = ref(selectedMacro.value?.label ?? '');
const description = ref(selectedMacro.value?.description ?? '');
const text = ref(selectedMacro.value?.text ?? '');
const inProject = ref(false);
const isSaving = ref(false);

// Another program, such as heidrun_code_ctrl, may delete the macro that is open.
watch(selectedMacro, (macro) => {
  if (isNew === false && macro === undefined) {
    close();
  }
});

async function save() {
  if (isSaving.value === true) {
    return;
  }
  if (text.value.trim() === '') {
    toast(t('macroEditor.textRequired'));
    return;
  }
  isSaving.value = true;
  try {
    if (isNew === true) {
      await addMacro(label.value, description.value, text.value, inProject.value);
      toast(inProject.value ? t('macroEditor.addedToProject') : t('macroEditor.saved'));
    } else {
      await updateMacro(selectedId, isFromProject, label.value, description.value, text.value);
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
    <dialog class="dialog dialog-instant dialog-nonmodal" open aria-labelledby="macro-editor-title">
      <div class="dialog-header">
        <div id="macro-editor-title" class="dialog-title me-auto" role="heading" aria-level="2">{{ t(isNew ? "macroEditor.createTitle" : "macroEditor.title") }}</div>
        <DialogCloseButton :title="t('macroEditor.close')" :label="t('macroEditor.close')" @click="close" />
      </div>

      <div class="dialog-body">
        <div class="mb-3">
          <label class="form-label" for="macro-editor-label">{{ t("macroEditor.labelField") }}</label>
          <input id="macro-editor-label" v-model="label" class="form-control" autocomplete="off" spellcheck="false" />
        </div>

        <div class="mb-3">
          <label class="form-label" for="macro-editor-description">{{ t("macroEditor.description") }}</label>
          <input id="macro-editor-description" v-model="description" class="form-control" autocomplete="off" spellcheck="false" />
        </div>

        <div class="mb-3">
          <label class="form-label" for="macro-editor-text">{{ t("macroEditor.text") }}</label>
          <textarea id="macro-editor-text" v-model="text" class="form-control" rows="7" spellcheck="false"></textarea>
          <div class="form-text mono" :title="t('macroEditor.variablesTitle')">{{ VARIABLES.join(" ") }}</div>
        </div>

        <div v-if="isNew && currentProject" class="d-flex align-items-center gap-2">
          <input id="macro-editor-in-project" v-model="inProject" type="checkbox" />
          <label for="macro-editor-in-project">{{ t("macroEditor.inProject") }}</label>
        </div>
      </div>

      <div class="dialog-footer">
        <button type="button" class="btn lg" :disabled="isSaving" :title="t('macroEditor.discardTitle')" @click="discard">{{ t("macroEditor.discard") }}</button>
        <button type="button" class="btn lg primary" :disabled="isSaving" @click="save">{{ t("macroEditor.save") }}</button>
      </div>
    </dialog>
  </div>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; z-index: 59; background: var(--overlay); }
</style>
