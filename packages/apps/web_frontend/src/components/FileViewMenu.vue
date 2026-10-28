<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from "vue";
import Icon from "./Icon.vue";
import { t } from "../i18n/index";

// The dropdown menu of the header of a file view pane: the actions on the file that the header has no room for as buttons.
// The menu opens with a click or with the keys Enter and Space on the button. The arrow keys move between the entries, and the
// key Escape closes the menu and gives the keyboard back to the button. The diff pane puts its own entries first, in the slot:
// each entry calls `choose` with its action, so that the menu closes first. The file view pane puts its switches last, in the
// slot `options`, under a divider: a switch changes its setting and leaves the menu open.
// Issues: https://github.com/heidrun-org/heidrun/issues/784, https://github.com/heidrun-org/heidrun_code/issues/885, and
// https://github.com/heidrun-org/heidrun_code/issues/897
defineProps<{
  /** True while the file is shown as code: only then the menu has the entry "Search". */
  isSearchShown: boolean;
}>();

const emit = defineEmits<{
  /** The developer chose "Search". */
  search: [];
  /** The developer chose "Copy path": `isAbsolute` is true when the key Option was held. */
  copyPath: [isAbsolute: boolean];
  /** The developer chose "Show in Finder". */
  showInFinder: [];
  /** The developer chose "Open in VS Code". */
  openInVisualStudioCode: [];
}>();

/** True while the dropdown menu is open. */
const isOpen = ref(false);
const button = ref<HTMLButtonElement>();
const menu = ref<HTMLElement>();
/** Where the dropdown menu sits, in pixels from the top and from the right edge of the window. */
const position = ref({ top: 0, right: 0 });

/** The entries of the open menu, from the first to the last. */
function entries(): HTMLButtonElement[] {
  return Array.from(menu.value?.querySelectorAll<HTMLButtonElement>("[role='menuitem'], [role='menuitemcheckbox']") ?? []);
}

/** Opens the dropdown menu under the button, or closes it. The window places it, so that the pane cannot cut it. */
function toggle() {
  if (isOpen.value) {
    close();
    return;
  }
  if (button.value === undefined) {
    return;
  }
  const rect = button.value.getBoundingClientRect();
  position.value = { top: rect.bottom + 6, right: Math.max(8, window.innerWidth - rect.right) };
  isOpen.value = true;
  nextTick(() => {
    document.addEventListener("mousedown", onDocumentMouseDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    entries()[0]?.focus();
  });
}

/** Closes the dropdown menu. */
function close() {
  isOpen.value = false;
  document.removeEventListener("mousedown", onDocumentMouseDown, true);
  document.removeEventListener("keydown", onKeyDown, true);
}

/** Closes the dropdown menu on a click outside the dropdown menu and outside the button. */
function onDocumentMouseDown(event: MouseEvent) {
  const target = event.target as Node;
  if (menu.value?.contains(target) === true || button.value?.contains(target) === true) {
    return;
  }
  close();
}

/** Moves the keyboard focus between the entries with the arrow keys, and closes the menu with Escape or Tab. */
function onKeyDown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.stopPropagation();
    close();
    button.value?.focus();
    return;
  }
  if (event.key === "Tab") {
    close();
    return;
  }
  const items = entries();
  const current = items.indexOf(document.activeElement as HTMLButtonElement);
  let next: number | null = null;
  if (event.key === "ArrowDown") {
    next = (current + 1) % items.length;
  } else if (event.key === "ArrowUp") {
    next = (current - 1 + items.length) % items.length;
  } else if (event.key === "Home") {
    next = 0;
  } else if (event.key === "End") {
    next = items.length - 1;
  }
  if (next === null) {
    return;
  }
  event.preventDefault();
  items[next]?.focus();
}

/** Closes the dropdown menu, then runs the choice of the developer. */
function choose(run: () => void) {
  close();
  button.value?.focus();
  run();
}

onBeforeUnmount(close);
</script>

<template>
  <button
    ref="button"
    type="button"
    class="btn icon small"
    :class="{ on: isOpen }"
    aria-haspopup="menu"
    :aria-expanded="isOpen"
    :aria-label="t('fileView.menuLabel')"
    :title="t('fileView.menuTitle')"
    @click="toggle"
  >
    <Icon name="three-dots-vertical" />
  </button>
  <Teleport to="body">
    <div
      v-if="isOpen"
      ref="menu"
      class="menu show position-fixed"
      role="menu"
      :aria-label="t('fileView.menuLabel')"
      :style="{ top: `${position.top}px`, right: `${position.right}px` }"
    >
      <slot :choose="choose"></slot>
      <button
        v-if="isSearchShown"
        type="button"
        class="menu-item d-flex align-items-center gap-2"
        role="menuitem"
        data-action="search"
        :title="t('fileView.searchTitle')"
        @click="choose(() => emit('search'))"
      >
        <Icon name="search" />
        {{ t("fileView.search") }}
      </button>
      <button
        type="button"
        class="menu-item d-flex align-items-center gap-2"
        role="menuitem"
        data-action="copy-path"
        :title="t('fileView.copyPathTitle')"
        @click="choose(() => emit('copyPath', $event.altKey))"
      >
        <Icon name="copy" />
        {{ t("fileView.copyPath") }}
      </button>
      <button
        type="button"
        class="menu-item d-flex align-items-center gap-2"
        role="menuitem"
        data-action="show-in-finder"
        :title="t('fileView.finderTitle')"
        @click="choose(() => emit('showInFinder'))"
      >
        <Icon name="folder2-open" />
        {{ t("fileView.showInFinder") }}
      </button>
      <button
        type="button"
        class="menu-item d-flex align-items-center gap-2"
        role="menuitem"
        data-action="open-in-visual-studio-code"
        :title="t('fileView.vscodeTitle')"
        @click="choose(() => emit('openInVisualStudioCode'))"
      >
        <Icon name="box-arrow-up-right" />
        {{ t("fileView.openInVisualStudioCode") }}
      </button>
      <template v-if="$slots.options !== undefined">
        <div class="menu-divider" role="separator"></div>
        <slot name="options"></slot>
      </template>
    </div>
  </Teleport>
</template>
