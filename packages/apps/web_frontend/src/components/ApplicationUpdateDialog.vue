<script setup lang="ts">
import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { nextTick, onMounted, onUnmounted, ref } from 'vue';
import { t } from '../i18n/index';
import { availableUpdateVersion } from '../stores/application_update';

/** The result of the current manual check. */
type UpdateCheckResult = {
	/** Version running on this computer. */
	running: string;
	/** Latest version found on the server. */
	latest: string;
	/** Whether the current check can supply an update. */
	isInstallable: boolean;
};

const dialog = ref<HTMLDialogElement>();
const laterButton = ref<HTMLButtonElement>();
const release = ref<UpdateCheckResult>();
const isInstalling = ref(false);
const installError = ref<string>();
const installStatus = ref<HTMLElement>();
let unlisten: UnlistenFn | undefined;
let isUnmounted = false;

onMounted(async () => {
	if (isTauri() === false) {
		return;
	}
	const stopListening = await listen<UpdateCheckResult>('application-update-dialog', async ({ payload }) => {
		availableUpdateVersion.value = payload.isInstallable === true ? payload.latest : null;
		installError.value = undefined;
		release.value = payload;
		await nextTick();
		if (dialog.value?.open === false) {
			dialog.value.showModal();
		}
		laterButton.value?.focus();
	}).catch(() => undefined);
	if (isUnmounted === true) {
		stopListening?.();
		return;
	}
	unlisten = stopListening;
});

onUnmounted(() => {
	isUnmounted = true;
	unlisten?.();
});

async function answer(confirmed: boolean) {
	if (isInstalling.value === true) {
		return;
	}
	const shownRelease = release.value;
	if (confirmed === true && shownRelease?.isInstallable === true) {
		isInstalling.value = true;
		await nextTick();
		installStatus.value?.focus();
		try {
			await invoke('answerApplicationUpdate', {
				version: shownRelease.latest,
				confirmed: true,
			});
		} catch (error) {
			installError.value = String(error);
			isInstalling.value = false;
			await nextTick();
			laterButton.value?.focus();
		}
		return;
	}
	const isPending = shownRelease?.isInstallable === true && installError.value === undefined;
	dialog.value?.close();
	release.value = undefined;
	installError.value = undefined;
	if (isPending === true) {
		await invoke('answerApplicationUpdate', {
			version: shownRelease.latest,
			confirmed: false,
		}).catch(() => undefined);
	}
}
</script>

<template>
  <dialog ref="dialog" class="update-dialog" aria-labelledby="update-dialog-title" @cancel.prevent="answer(false)">
    <template v-if="release !== undefined">
      <h2 id="update-dialog-title">{{ t('applicationUpdateDialog.title') }}</h2>
      <div v-if="isInstalling" ref="installStatus" class="update-progress" role="status" tabindex="-1">
        <span class="spinner-border" aria-hidden="true"></span>
        <p>{{ t('applicationUpdateDialog.installing', { version: release.latest }) }}</p>
        <p>{{ t('applicationUpdateDialog.restart') }}</p>
      </div>
      <template v-else>
        <template v-if="installError === undefined">
          <p>{{ t('applicationUpdateDialog.running', { version: release.running }) }}</p>
          <p>{{ t('applicationUpdateDialog.latest', { version: release.latest }) }}</p>
          <p class="update-status">
            {{ t(release.isInstallable ? 'applicationUpdateDialog.restart' : 'applicationUpdateDialog.current') }}
          </p>
        </template>
        <div v-else role="alert">
          <p>{{ t('applicationUpdateDialog.failed') }}</p>
          <p class="update-status">{{ installError }}</p>
        </div>
        <div class="update-actions">
          <button v-if="release.isInstallable && installError === undefined" type="button" class="btn" @click="answer(true)">
            {{ t('applicationUpdateDialog.install', { version: release.latest }) }}
          </button>
          <button ref="laterButton" type="button" class="btn primary" @click="answer(false)">
            {{ t(release.isInstallable && installError === undefined ? 'applicationUpdateDialog.later' : 'applicationUpdateDialog.close') }}
          </button>
        </div>
      </template>
    </template>
  </dialog>
</template>

<style scoped>
.update-dialog {
  width: min(420px, calc(100% - 32px));
  padding: 24px;
  color: var(--text);
  background: var(--panel);
  border: 1px solid var(--line-modal);
  border-radius: 14px;
  box-shadow: 0 24px 64px var(--shadow);
}
.update-dialog::backdrop { background: var(--overlay); }
h2 { margin: 0 0 16px; font-size: 18px; }
p { margin: 0; }
.update-status { margin-top: 12px; }
.update-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }
.update-progress { display: grid; justify-items: center; gap: 12px; padding: 12px 0; text-align: center; }
.update-progress .spinner-border { width: 56px; height: 56px; }
</style>
