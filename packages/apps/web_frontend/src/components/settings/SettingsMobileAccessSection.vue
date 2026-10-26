<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { openUrl } from "@tauri-apps/plugin-opener";
import SettingsOptionHelp from "./SettingsOptionHelp.vue";
import SettingsSwitchRow from "./SettingsSwitchRow.vue";
import { mobile, mobileStatus, revokeMobile, setMobile, stopLeftoverNgrok } from "../../stores/mobile";
import AbbreviatedTime from "../AbbreviatedTime.vue";
import { toast } from "../../stores/session";
import { settings } from "../../stores/settings";
import { requiredProgramsStatus } from "../../lib/api";
import { t } from "../../i18n/index";

const st = computed(() => mobile.status);
const errorText = computed(() => (st.value?.error ? t(`mobileModal.error.${st.value.error.kind}`) : ""));
// The reminder of a missing ngrok shows before the developer turns the mobile access on (issue 546). When the mobile access
// is on, the error "ngrokMissing" of the status says the same thing, so the reminder hides.
const isNgrokInstalled = ref(true);
const isNgrokReminderVisible = computed(() => isNgrokInstalled.value === false && st.value?.error?.kind !== "ngrokMissing");
const isOpeningTheTunnel = computed(() => st.value?.enabled === true && st.value.running === false && st.value.error === null);

/** The blocks of the information card of the option "Turn on mobile access", in the order of the card. */
const MOBILE_ACCESS_HELP_BLOCKS = [
  { titleKey: "settingsHelp.whatTitle", textKey: "settingsHelp.mobileAccess.what" },
  { titleKey: "settingsHelp.onTitle", textKey: "settingsHelp.mobileAccess.on" },
  { titleKey: "settingsHelp.offTitle", textKey: "settingsHelp.mobileAccess.off" },
] as const;

/** The blocks of the information card of the option "Allow typing in terminals from the phone", in the order of the card. */
const MOBILE_TYPING_HELP_BLOCKS = [
  { titleKey: "settingsHelp.whatTitle", textKey: "settingsHelp.mobileTyping.what" },
  { titleKey: "settingsHelp.onTitle", textKey: "settingsHelp.mobileTyping.on" },
  { titleKey: "settingsHelp.offTitle", textKey: "settingsHelp.mobileTyping.off" },
] as const;

// The tunnel needs a few seconds to open: ask for the status every second until it is open.
let timer = 0;
let isMounted = false;
function scheduleNextStatus() {
  timer = window.setTimeout(async () => {
    await mobileStatus();
    if (isMounted) {
      scheduleNextStatus();
    }
  }, isOpeningTheTunnel.value ? 1000 : 5000);
}
onMounted(async () => {
  isMounted = true;
  requiredProgramsStatus()
    .then((status) => {
      isNgrokInstalled.value = status.ngrok.isInstalled;
    })
    .catch(() => {});
  await mobileStatus();
  if (isMounted) {
    scheduleNextStatus();
  }
});
onBeforeUnmount(() => {
  isMounted = false;
  window.clearTimeout(timer);
});

// The button "Stop the old ngrok" (issue 583). When no ngrok of Heidrun Code was killed, the other ngrok runs somewhere else, and
// the developer closes it by hand.
const isLeftoverNotFound = ref(false);
/** The command that stops every ngrok of this computer, the same in every language. */
const KILL_ALL_NGROK_COMMAND = "pkill -x ngrok";
async function stopOldNgrok() {
  const isKilled = await stopLeftoverNgrok();
  isLeftoverNotFound.value = isKilled === false;
  if (isKilled === true) {
    toast(t("mobileModal.oldNgrokStopped"));
  }
}

async function openPairingLink(link: string) {
  try {
    await openUrl(link);
  } catch (reason) {
    toast(String(reason), "error");
  }
}
</script>

<template>
  <div class="d-flex flex-column gap-3">
    <p class="m-0">{{ t("mobileModal.lead") }}</p>

    <SettingsSwitchRow :model-value="st?.enabled === true" :is-disabled="mobile.busy" :label="t('mobileModal.enable')" data-option="mobileAccess" @update:model-value="setMobile($event)">
      <SettingsOptionHelp title-key="mobileModal.enable" :blocks="MOBILE_ACCESS_HELP_BLOCKS" />
    </SettingsSwitchRow>

    <SettingsSwitchRow v-model="settings.mobileTerminalTyping" :label="t('mobileModal.terminalTyping')" data-option="mobileTerminalTyping">
      <SettingsOptionHelp title-key="mobileModal.terminalTyping" :blocks="MOBILE_TYPING_HELP_BLOCKS" />
    </SettingsSwitchRow>
    <div v-if="isNgrokReminderVisible" class="alert theme-warning ngrok-reminder" role="alert">{{ t("mobileModal.ngrokNotInstalled") }}</div>

    <div v-if="st?.error" class="alert theme-danger" role="alert">
      {{ errorText }}
      <div v-if="st.error.detail" class="mono mt-1">{{ st.error.detail }}</div>
      <template v-if="st.error.kind === 'ngrokAddressInUse'">
        <button type="button" class="btn mt-2 stop-old-ngrok" :disabled="mobile.busy" @click="stopOldNgrok">
          {{ t("mobileModal.stopOldNgrok") }}
        </button>
        <div v-if="isLeftoverNotFound" class="mt-2 old-ngrok-not-found">
          {{ t("mobileModal.oldNgrokNotFound") }}
          <code class="command d-block mono mt-2 p-2 rounded user-select-all kill-all-ngrok">{{ KILL_ALL_NGROK_COMMAND }}</code>
        </div>
      </template>
    </div>

    <template v-if="st?.enabled && st.running && st.qr">
      <div class="d-flex align-items-center gap-3">
        <!-- eslint-disable-next-line vue/no-v-html : SVG produced by the app itself -->
        <div class="qr bg-white p-2 rounded" v-html="st.qr"></div>
        <p class="m-0">{{ t("mobileModal.pairStep") }}</p>
      </div>
      <p class="m-0">
        <a v-if="st.link" class="mono" :href="st.link" :title="t('mobileModal.openTitle')" @click.prevent="openPairingLink(st.link)">{{ st.url }}</a>
        <span v-else class="mono text-body-secondary">{{ st.url }}</span>
      </p>
      <p class="m-0 form-text">{{ t("mobileModal.firstVisit") }}</p>
      <p class="m-0 form-text">{{ t("mobileModal.qrSecret") }}</p>
      <p v-if="mobile.lastSeen" class="m-0 form-text"><AbbreviatedTime :milliseconds="mobile.lastSeen" phrase-key="mobileModal.lastSeen" /></p>
      <button type="button" class="btn align-self-start" :disabled="mobile.busy" :title="t('mobileModal.revokeTitle')" @click="revokeMobile">
        {{ t("mobileModal.revoke") }}
      </button>
    </template>
    <template v-else-if="isOpeningTheTunnel">
      <p class="m-0 form-text">{{ t("mobileModal.starting") }}</p>
    </template>
  </div>
</template>

<style scoped>
.qr { width: 220px; flex-shrink: 0; }
.qr :deep(svg) { display: block; width: 100%; height: auto; }
.command { background: var(--field); color: var(--text); }
</style>
