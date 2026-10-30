<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from "vue";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import Icon from "../Icon.vue";
import SettingsOptionHelp from "./SettingsOptionHelp.vue";
import SettingsSwitchRow from "./SettingsSwitchRow.vue";
import { HeidrunCodeDashboardLocalNetworkSettings, heidrunCodeDashboardLocalNetworkSettingsState } from "../../stores/heidrun_code_dashboard/heidrun_code_dashboard_local_network_settings";
import { toast } from "../../stores/session";
import { t } from "../../i18n/index";

// The section "Heidrun Code Dashboard" of the Settings window: the option "Show the Heidrun Code Dashboard on the local network", and, while the server listens,
// the QR code and the address of the page with a copy button, for a phone or a tablet used as a second screen (issue 978).

const status = computed(() => heidrunCodeDashboardLocalNetworkSettingsState.status);
const errorText = computed(() => (status.value?.error ? t(`heidrunCodeDashboardLocalNetwork.error.${status.value.error.kind}`) : ""));
const isStarting = computed(() => status.value?.enabled === true && status.value.running === false && status.value.error === null);

/** The blocks of the information card of the option "Show the Heidrun Code Dashboard on the local network", in the order of the card. */
const LOCAL_NETWORK_HELP_BLOCKS = [
  { titleKey: "settingsHelp.whatTitle", textKey: "settingsHelp.heidrunCodeDashboardLocalNetwork.what" },
  { titleKey: "settingsHelp.onTitle", textKey: "settingsHelp.heidrunCodeDashboardLocalNetwork.on" },
  { titleKey: "settingsHelp.offTitle", textKey: "settingsHelp.heidrunCodeDashboardLocalNetwork.off" },
] as const;

// The address changes when the computer joins another network: read the status again while the section is open.
let timer = 0;
let isMounted = false;
function scheduleNextStatus() {
  timer = window.setTimeout(async () => {
    await HeidrunCodeDashboardLocalNetworkSettings.refresh();
    if (isMounted === true) {
      scheduleNextStatus();
    }
  }, isStarting.value === true ? 1000 : 5000);
}
onMounted(async () => {
  isMounted = true;
  await HeidrunCodeDashboardLocalNetworkSettings.refresh();
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
  toast(isCopied === true ? t("heidrunCodeDashboardLocalNetwork.copied") : t("heidrunCodeDashboardLocalNetwork.copyFailed"), isCopied === true ? "info" : "error");
}
</script>

<template>
  <div class="d-flex flex-column gap-3">
    <p class="m-0">{{ t("heidrunCodeDashboardLocalNetwork.lead") }}</p>

    <SettingsSwitchRow
      :model-value="status?.enabled === true"
      :is-disabled="heidrunCodeDashboardLocalNetworkSettingsState.isBusy"
      :label="t('heidrunCodeDashboardLocalNetwork.enable')"
      data-option="heidrunCodeDashboardLocalNetwork"
      @update:model-value="HeidrunCodeDashboardLocalNetworkSettings.setEnabled($event)"
    >
      <SettingsOptionHelp title-key="heidrunCodeDashboardLocalNetwork.enable" :blocks="LOCAL_NETWORK_HELP_BLOCKS" />
    </SettingsSwitchRow>

    <div v-if="status?.error" class="alert theme-danger" role="alert" data-heidrun-code-dashboard-local-network-error>
      {{ errorText }}
      <div v-if="status.error.detail" class="mono mt-1">{{ status.error.detail }}</div>
    </div>

    <template v-if="status?.enabled && status.running && status.qr && status.address">
      <div class="d-flex align-items-center gap-3">
        <!-- eslint-disable-next-line vue/no-v-html : SVG produced by the app itself -->
        <div class="qr bg-white p-2 rounded" data-heidrun-code-dashboard-local-network-qr v-html="status.qr"></div>
        <p class="m-0">{{ t("heidrunCodeDashboardLocalNetwork.scanStep") }}</p>
      </div>
      <div class="d-flex flex-column gap-1">
        <span class="fw-medium">{{ t("heidrunCodeDashboardLocalNetwork.addressLabel") }}</span>
        <div class="d-flex align-items-center gap-2">
          <span class="mono text-break user-select-all" data-heidrun-code-dashboard-local-network-address>{{ status.address }}</span>
          <button type="button" class="btn small flex-shrink-0" :title="t('heidrunCodeDashboardLocalNetwork.copyTitle')" data-copy-address @click="copyAddress(status.address)">
            <Icon name="clipboard" />
            {{ t("heidrunCodeDashboardLocalNetwork.copy") }}
          </button>
        </div>
      </div>
      <p class="m-0 form-text">{{ t("heidrunCodeDashboardLocalNetwork.keySecret") }}</p>
      <p class="m-0 form-text">{{ t("heidrunCodeDashboardLocalNetwork.screenOn") }}</p>
      <p class="m-0 form-text">{{ t("heidrunCodeDashboardLocalNetwork.firewall") }}</p>
      <button
        type="button"
        class="btn align-self-start"
        :disabled="heidrunCodeDashboardLocalNetworkSettingsState.isBusy"
        :title="t('heidrunCodeDashboardLocalNetwork.newKeyTitle')"
        data-new-key
        @click="HeidrunCodeDashboardLocalNetworkSettings.makeNewKey()"
      >
        {{ t("heidrunCodeDashboardLocalNetwork.newKey") }}
      </button>
    </template>
    <p v-else-if="isStarting" class="m-0 form-text">{{ t("heidrunCodeDashboardLocalNetwork.starting") }}</p>
  </div>
</template>

<style scoped>
.qr { width: 220px; flex-shrink: 0; }
.qr :deep(svg) { display: block; width: 100%; height: auto; }
</style>
