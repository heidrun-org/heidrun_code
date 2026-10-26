<script setup lang="ts">
import { nextTick, onMounted, ref } from "vue";
import { requiredProgramsStatus } from "../lib/api";
import { INSTALL_COMMANDS, MissingPrograms, type ProgramName } from "../lib/missing_programs";
import { settings } from "../stores/settings";
import { t } from "../i18n/index";

/** The programs that the notice names. The notice is closed when the list is empty. */
const programNames = ref<ProgramName[]>([]);
/** True when Herdr is installed, but older than the version that Heidrun Code needs: the notice asks for an update. */
const isHerdrTooOld = ref(false);
const continueButton = ref<HTMLButtonElement>();

// The notice is under the splash screen, so the user sees it when the splash screen closes (issue 546).
onMounted(async () => {
  try {
    const status = await requiredProgramsStatus();
    programNames.value = MissingPrograms.toShow(status, settings.ngrokMissingNoticeShown);
    isHerdrTooOld.value = status.herdr.isInstalled === true && status.herdr.isTooOld === true;
  } catch {
    // Outside Heidrun Code (a plain browser), there is no program to test.
    return;
  }
  if (programNames.value.includes("ngrok")) {
    settings.ngrokMissingNoticeShown = true;
  }
  await nextTick();
  continueButton.value?.focus();
});

/** The key of the translated text of `part` for `programName`: a Herdr that is too old has its own texts. */
function textKey(programName: ProgramName, part: "reason" | "after") {
  const variant = programName === "herdr" && isHerdrTooOld.value ? "tooOld." : "";
  return `missingProgramsModal.${programName}.${variant}${part}`;
}

function close() {
  programNames.value = [];
}
</script>

<template>
  <div v-if="programNames.length > 0" class="overlay" @keydown.esc.stop.prevent="close">
    <div class="window-box d-flex flex-column gap-3" role="alertdialog" aria-labelledby="missing-programs-title">
      <h2 id="missing-programs-title" class="m-0">{{ t("missingProgramsModal.title") }}</h2>
      <section v-for="programName in programNames" :key="programName" class="d-flex flex-column gap-2" :data-program="programName">
        <h3 class="m-0">
          {{ t(`missingProgramsModal.${programName}.name`) }}
          <span class="badge" :class="programName === 'herdr' ? 'theme-danger' : 'theme-secondary'">
            {{ t(programName === "herdr" ? "missingProgramsModal.required" : "missingProgramsModal.optional") }}
          </span>
        </h3>
        <p class="m-0">{{ t(textKey(programName, "reason")) }}</p>
        <p class="m-0">{{ t("missingProgramsModal.installWith") }}</p>
        <code class="command mono p-2 rounded">{{ INSTALL_COMMANDS[programName] }}</code>
        <p class="m-0 form-text">{{ t(textKey(programName, "after")) }}</p>
      </section>
      <div class="d-flex justify-content-end">
        <button ref="continueButton" class="btn lg primary" type="button" @click="close">{{ t("missingProgramsModal.continue") }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed; inset: 0; z-index: 65; background: var(--overlay);
  display: flex; align-items: center; justify-content: center; padding: 24px;
}
.window-box {
  width: min(520px, 100%); max-height: 100%; overflow-y: auto; padding: 22px; border-radius: 14px; background: var(--panel);
  border: 1px solid var(--line-strong); box-shadow: 0 24px 64px var(--shadow); user-select: text;
}
h2, h3 { font-size: var(--font-size); font-weight: 600; }
.command { display: block; background: var(--field); color: var(--text); user-select: all; word-break: break-all; }
</style>
