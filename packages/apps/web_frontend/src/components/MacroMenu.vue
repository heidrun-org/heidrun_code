<script setup lang="ts">
import Icon from "./Icon.vue";
import { computed, nextTick, onBeforeUnmount, ref } from "vue";
import { askConfirm } from "../stores/confirm";
import { insertText, toast } from "../stores/session";
import { macroEditor, macros, projectMacros, removeMacro, resolveMacroVariables, type Macro } from "../stores/macros";
import { t } from "../i18n/index";

const props = defineProps<{ paneId: string }>();

const open = ref(false);
const button = ref<HTMLButtonElement>();
const menu = ref<HTMLElement>();
const position = ref({ top: 0, right: 0 });

// The menu is placed with the viewport, so the pane around it cannot cut it.
function toggle() {
  if (open.value) {
    close();
    return;
  }
  const rect = button.value!.getBoundingClientRect();
  position.value = { top: rect.bottom + 6, right: Math.max(8, window.innerWidth - rect.right) };
  open.value = true;
  nextTick(() => {
    document.addEventListener("mousedown", onDocumentMouseDown, true);
    document.addEventListener("keydown", onKeyDown, true);
  });
}

function close() {
  open.value = false;
  document.removeEventListener("mousedown", onDocumentMouseDown, true);
  document.removeEventListener("keydown", onKeyDown, true);
}

function onDocumentMouseDown(event: MouseEvent) {
  const target = event.target as Node;
  if (menu.value?.contains(target) === true || button.value?.contains(target) === true) {
    return;
  }
  close();
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.stopPropagation();
    close();
  }
}

/** The groups of the menu that have macros, in order: the project macros, then the user macros. */
const groups = computed(() =>
  [
    { id: "project", title: t("macroMenu.project"), items: projectMacros.value },
    { id: "personal", title: t("macroMenu.personal"), items: macros.personal },
  ].filter((group) => group.items.length > 0),
);

// A click writes the text; a Shift+click writes it and presses Enter.
async function useMacro(macro: Macro, event: MouseEvent) {
  close();
  const text = await resolveMacroVariables(macro.text, props.paneId);
  await insertText(props.paneId, text, event.shiftKey);
}

function edit(macro: Macro | null, isFromProject = false, isReadOnly = false) {
  close();
  macroEditor.isReadOnly = isReadOnly;
  macroEditor.selectedId = macro?.id ?? null;
  macroEditor.isFromProject = isFromProject;
  macroEditor.open = true;
}

async function remove(macro: Macro, isFromProject: boolean) {
  close();
  const isConfirmed = await askConfirm(t('macroMenu.deleteConfirm', { label: macro.label }), t('macroMenu.delete'));
  if (isConfirmed === false) {
    return;
  }
  try {
    await removeMacro(macro.id, isFromProject);
  } catch (error) {
    toast(String(error));
  }
}

onBeforeUnmount(close);
</script>

<template>
  <button
    ref="button"
    class="btn icon small tool"
    :class="{ on: open }"
    :aria-expanded="open"
    :aria-label="t('macroMenu.label')"
    :title="t('macroMenu.title')"
    @mousedown.stop
    @click="toggle"
  >
    <Icon name="chat-square-text" />
  </button>
  <Teleport to="body">
    <div
      v-if="open"
      ref="menu"
      class="menu show position-fixed overflow-y-auto"
      role="menu"
      :style="{ top: `${position.top}px`, right: `${position.right}px`, width: 'min(420px, calc(100vw - 16px))', maxHeight: '70vh' }"
      @mousedown.stop
    >
      <template v-for="(group, index) in groups" :key="group.id">
        <div v-if="index > 0" class="menu-divider" role="separator"></div>
        <div class="menu-header">{{ group.title }}</div>
        <div v-for="macro in group.items" :key="group.id + macro.id" class="position-relative">
          <button type="button" class="menu-item text-wrap text-break" role="menuitem" :title="macro.text" @click="useMacro(macro, $event)">
            <span class="d-flex flex-column gap-1 align-self-start">
              <span class="fw-medium pe-5 me-4">{{ macro.label }}</span>
              <small v-if="macro.description !== ''" class="text-body-secondary">{{ macro.description.split(/\r\n|\r|\n/, 1)[0] }}</small>
            </span>
          </button>
          <span class="position-absolute top-0 end-0 d-flex align-items-center mt-1">
            <button type="button" class="btn icon small" role="menuitem" :aria-label="t('macroMenu.viewMacro', { label: macro.label })" :title="t('macroMenu.view')" @click.stop="edit(macro, group.id === 'project', true)">
              <Icon name="eye" />
            </button>
            <button type="button" class="btn icon small" role="menuitem" :aria-label="t('macroMenu.editMacro', { label: macro.label })" :title="t('macroMenu.edit')" @click.stop="edit(macro, group.id === 'project')">
              <Icon name="pencil" />
            </button>
            <button type="button" class="btn icon small text-danger-emphasis" role="menuitem" :aria-label="t('macroMenu.deleteMacro', { label: macro.label })" :title="t('macroMenu.delete')" @click.stop="remove(macro, group.id === 'project')">
              <Icon name="trash" />
            </button>
          </span>
        </div>
      </template>
      <div class="menu-divider" role="separator"></div>
      <button type="button" class="menu-item d-flex align-items-center gap-2 text-primary-emphasis" role="menuitem" @click="edit(null)">
        <Icon name="plus-lg" /> {{ t("macroMenu.create") }}
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.tool { display: inline-flex; align-items: center; justify-content: center; }
</style>
