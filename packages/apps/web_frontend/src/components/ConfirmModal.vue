<script setup lang="ts">
import { nextTick, onMounted, ref } from "vue";
import { answerChoice, answerConfirm, confirmDialog } from "../stores/confirm";
import { t } from "../i18n/index";

const confirmButton = ref<HTMLButtonElement>();
// Enter validates the main button, Escape and a click outside cancel; the focus stays inside the window so the keys arrive.
onMounted(() => nextTick(() => confirmButton.value?.focus()));
</script>

<template>
  <div class="overlay" @mousedown.self="answerConfirm(false)" @keydown.esc.stop.prevent="answerConfirm(false)" @keydown.enter.stop.prevent="answerConfirm(true)">
    <div class="window-box" :class="{ wide: confirmDialog.otherChoices.length > 0 }" role="alertdialog" aria-labelledby="confirm-title">
      <h2 id="confirm-title">{{ confirmDialog.title }}</h2>
      <label v-if="confirmDialog.rememberLabel !== ''" class="remember">
        <input v-model="confirmDialog.isRemembered" type="checkbox" data-test="confirm-remember" />
        {{ confirmDialog.rememberLabel }}
      </label>
      <div class="row">
        <button class="btn lg" :title="t('confirmModal.cancelTitle')" @click="answerConfirm(false)">{{ confirmDialog.cancelLabel || t("confirmModal.cancel") }}</button>
        <button v-for="choice in confirmDialog.otherChoices" :key="choice.id" class="btn lg" :data-choice="choice.id" @click="answerChoice(choice.id)">{{ choice.label }}</button>
        <button ref="confirmButton" class="btn lg" :class="confirmDialog.isDanger ? 'danger' : 'primary'" @click="answerConfirm(true)">{{ confirmDialog.confirmLabel }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed; inset: 0; z-index: 60; background: var(--overlay);
  display: flex; align-items: center; justify-content: center; padding: 24px;
}
.window-box {
  width: min(440px, 100%); padding: 22px; border-radius: 14px; background: var(--panel);
  border: 1px solid var(--pane-ring-blocked); box-shadow: 0 24px 64px var(--shadow);
  display: flex; flex-direction: column; gap: 16px;
}
/* Several choices: the buttons spread over the width (No under the text on the left, the main button on the right), and stay on one line (issue #956). */
.window-box.wide { width: min(600px, 100%); }
.window-box.wide .row { justify-content: space-between; }
/* A line break of the title starts a new line. */
h2 { margin: 0; font-size: var(--font-size); font-weight: 600; white-space: pre-line; }
.row { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.row .btn { white-space: nowrap; }
.remember { display: flex; align-items: center; gap: 8px; color: var(--muted); cursor: pointer; }
</style>
