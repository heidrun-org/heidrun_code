<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";
import DialogCloseButton from "../DialogCloseButton.vue";
import Icon from "../Icon.vue";
import HeidrunCodeDashboardView from "./HeidrunCodeDashboardView.vue";
import { HeidrunCodeDashboardModal } from "../../stores/heidrun_code_dashboard/heidrun_code_dashboard_modal";
import { t } from "../../i18n/index";

// The Heidrun Code Dashboard as a modal over the main window, opened from the item "Dashboard" of the More menu. Escape closes it when the
// graph does not use the key first: the graph uses Escape to select Heidrun again. Escape and the close button give the
// keyboard focus back to where it was. The button "Open in a separate window" opens the separate Heidrun Code Dashboard window, for a
// second screen, and closes the modal.

function onKeyDown(event: KeyboardEvent) {
  if (event.key === "Escape" && event.defaultPrevented === false) {
    event.preventDefault();
    HeidrunCodeDashboardModal.close();
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
      aria-labelledby="heidrun-code-dashboard-title"
      data-heidrun-code-dashboard-dialog
    >
      <div class="dialog-header gap-3" style="--dialog-header-padding: 0.375rem 0.75rem 0.375rem 84px">
        <div id="heidrun-code-dashboard-title" class="dialog-title me-auto" role="heading" aria-level="2">{{ t("heidrunCodeDashboard.title") }}</div>
        <button type="button" class="btn small" :title="t('heidrunCodeDashboard.separateWindow.openTitle')" data-open-separate-window @click="HeidrunCodeDashboardModal.openInSeparateWindow()">
          <Icon name="window-stack" />
          {{ t("heidrunCodeDashboard.separateWindow.open") }}
        </button>
        <DialogCloseButton :title="t('heidrunCodeDashboard.close')" :label="t('heidrunCodeDashboard.close')" :is-small="true" @click="HeidrunCodeDashboardModal.close()" />
      </div>
      <div class="dialog-body" style="flex: 1 1 0; min-height: 0; display: flex; padding: 0">
        <HeidrunCodeDashboardView @opened-in-heidrun-code="HeidrunCodeDashboardModal.close({ isFocusRestored: false })" />
      </div>
    </dialog>
  </div>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; z-index: 59; background: var(--overlay); }
</style>
