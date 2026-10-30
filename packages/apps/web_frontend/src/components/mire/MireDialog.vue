<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";
import DialogCloseButton from "../DialogCloseButton.vue";
import MireView from "./MireView.vue";
import { MireModal } from "../../stores/mire/mire_modal";
import { t } from "../../i18n/index";

// The Mire as a modal over the main window, opened from the item "Mire" of the More menu. Escape closes it when the
// graph does not use the key first: the graph uses Escape to select Heidrun again.

function onKeyDown(event: KeyboardEvent) {
  if (event.key === "Escape" && event.defaultPrevented === false) {
    event.preventDefault();
    MireModal.close();
  }
}

onMounted(() => {
  window.addEventListener("keydown", onKeyDown);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeyDown);
});
</script>

<template>
  <div class="overlay">
    <dialog
      class="dialog dialog-fullscreen dialog-instant dialog-nonmodal"
      style="height: 100vh"
      open
      aria-labelledby="mire-title"
      data-mire-dialog
    >
      <div class="dialog-header gap-3" style="--dialog-header-padding: 0.375rem 0.75rem 0.375rem 84px">
        <div id="mire-title" class="dialog-title me-auto" role="heading" aria-level="2">{{ t("mire.title") }}</div>
        <DialogCloseButton :title="t('mire.close')" :label="t('mire.close')" :is-small="true" @click="MireModal.close()" />
      </div>
      <div class="dialog-body" style="flex: 1 1 0; min-height: 0; display: flex; padding: 0">
        <MireView @opened-in-heidrun-code="MireModal.close()" />
      </div>
    </dialog>
  </div>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; z-index: 59; background: var(--overlay); }
</style>
