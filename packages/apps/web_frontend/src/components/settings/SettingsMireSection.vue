<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from "vue";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import Icon from "../Icon.vue";
import SettingsOptionHelp from "./SettingsOptionHelp.vue";
import SettingsSwitchRow from "./SettingsSwitchRow.vue";
import { MireLocalNetworkSettings, mireLocalNetworkSettingsState } from "../../stores/mire/mire_local_network_settings";
import { toast } from "../../stores/session";
import { t } from "../../i18n/index";

// The section "Mire" of the Settings window: the option "Show the Mire on the local network", and, while the server listens,
// the QR code and the address of the page with a copy button, for a phone or a tablet used as a second screen (issue 978).

const status = computed(() => mireLocalNetworkSettingsState.status);
const errorText = computed(() => (status.value?.error ? t(`mireLocalNetwork.error.${status.value.error.kind}`) : ""));
const isStarting = computed(() => status.value?.enabled === true && status.value.running === false && status.value.error === null);

/** The blocks of the information card of the option "Show the Mire on the local network", in the order of the card. */
const LOCAL_NETWORK_HELP_BLOCKS = [
  { titleKey: "settingsHelp.whatTitle", textKey: "settingsHelp.mireLocalNetwork.what" },
  { titleKey: "settingsHelp.onTitle", textKey: "settingsHelp.mireLocalNetwork.on" },
  { titleKey: "settingsHelp.offTitle", textKey: "settingsHelp.mireLocalNetwork.off" },
] as const;

// The address changes when the computer joins another network: read the status again while the section is open.
let timer = 0;
let isMounted = false;
function scheduleNextStatus() {
  timer = window.setTimeout(async () => {
    await MireLocalNetworkSettings.refresh();
    if (isMounted === true) {
      scheduleNextStatus();
    }
  }, isStarting.value === true ? 1000 : 5000);
}
onMounted(async () => {
  isMounted = true;
  await MireLocalNetworkSettings.refresh();
  if (isMounted === true) {
    scheduleNextStatus();
  }
});
onBeforeUnmount(() => {
  isMounted = false;
  window.clearTimeout(timer);
});

/**
 * Writes the address into the clipboard, with the clipboard of the browser when the clipboard of Tauri refuses it.
 * @param address - The address of the page.
 */
async function copyAddress(address: string) {
  let isCopied = true;
  try {
    await writeText(address);
  } catch {
    isCopied = await navigator.clipboard.writeText(address).then(() => true, () => false);
  }
  toast(isCopied === true ? t("mireLocalNetwork.copied") : t("mireLocalNetwork.copyFailed"), isCopied === true ? "info" : "error");
}
</script>

<template>
  <div class="d-flex flex-column gap-3">
    <p class="m-0">{{ t("mireLocalNetwork.lead") }}</p>

    <SettingsSwitchRow
      :model-value="status?.enabled === true"
      :is-disabled="mireLocalNetworkSettingsState.isBusy"
      :label="t('mireLocalNetwork.enable')"
      data-option="mireLocalNetwork"
      @update:model-value="MireLocalNetworkSettings.setEnabled($event)"
    >
      <SettingsOptionHelp title-key="mireLocalNetwork.enable" :blocks="LOCAL_NETWORK_HELP_BLOCKS" />
    </SettingsSwitchRow>

    <div v-if="status?.error" class="alert theme-danger" role="alert" data-mire-local-network-error>
      {{ errorText }}
      <div v-if="status.error.detail" class="mono mt-1">{{ status.error.detail }}</div>
    </div>

    <template v-if="status?.enabled && status.running && status.qr && status.address">
      <div class="d-flex align-items-center gap-3">
        <!-- eslint-disable-next-line vue/no-v-html : SVG produced by the app itself -->
        <div class="qr bg-white p-2 rounded" data-mire-local-network-qr v-html="status.qr"></div>
        <p class="m-0">{{ t("mireLocalNetwork.scanStep") }}</p>
      </div>
      <div class="d-flex flex-column gap-1">
        <span class="fw-medium">{{ t("mireLocalNetwork.addressLabel") }}</span>
        <div class="d-flex align-items-center gap-2">
          <span class="mono text-break user-select-all" data-mire-local-network-address>{{ status.address }}</span>
          <button type="button" class="btn small flex-shrink-0" :title="t('mireLocalNetwork.copyTitle')" data-copy-address @click="copyAddress(status.address)">
            <Icon name="clipboard" />
            {{ t("mireLocalNetwork.copy") }}
          </button>
        </div>
      </div>
      <p class="m-0 form-text">{{ t("mireLocalNetwork.keySecret") }}</p>
      <p class="m-0 form-text">{{ t("mireLocalNetwork.screenOn") }}</p>
      <p class="m-0 form-text">{{ t("mireLocalNetwork.firewall") }}</p>
      <button
        type="button"
        class="btn align-self-start"
        :disabled="mireLocalNetworkSettingsState.isBusy"
        :title="t('mireLocalNetwork.newKeyTitle')"
        data-new-key
        @click="MireLocalNetworkSettings.makeNewKey()"
      >
        {{ t("mireLocalNetwork.newKey") }}
      </button>
    </template>
    <p v-else-if="isStarting" class="m-0 form-text">{{ t("mireLocalNetwork.starting") }}</p>
  </div>
</template>

<style scoped>
.qr { width: 220px; flex-shrink: 0; }
.qr :deep(svg) { display: block; width: 100%; height: auto; }
</style>
