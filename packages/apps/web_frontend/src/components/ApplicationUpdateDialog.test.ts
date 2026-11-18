import { emit } from '@tauri-apps/api/event';
import { clearMocks, mockIPC } from '@tauri-apps/api/mocks';
import { flushPromises, mount } from '@vue/test-utils';
import { expect, it, vi } from 'vitest';
import ApplicationUpdateDialog from './ApplicationUpdateDialog.vue';

it('blocks dismissal while installing and unlocks after an installation error', async () => {
	let rejectInstall: (error: string) => void = () => {};
	const installation = new Promise<never>((_resolve, reject) => {
		rejectInstall = reject;
	});
	const invoke = vi.fn((command: string) => {
		if (command === 'answerApplicationUpdate') {
			return installation;
		}
	});
	vi.stubGlobal('isTauri', true);
	mockIPC(invoke, {
		shouldMockEvents: true,
	});
	const wrapper = mount(ApplicationUpdateDialog, {
		attachTo: document.body,
	});
	try {
		await flushPromises();
		await emit('application-update-dialog', {
			running: '0.4.0',
			latest: '0.4.1',
			isInstallable: true,
		});
		await flushPromises();
		const dialog = wrapper.get<HTMLDialogElement>('dialog');
		expect(dialog.element.open).toBe(true);
		await wrapper.get('button:not(.primary)').trigger('click');
		expect(wrapper.get('[role="status"]').text()).toContain('Installing version 0.4.1');
		expect(wrapper.findAll('button')).toHaveLength(0);
		await dialog.trigger('cancel');
		expect(dialog.element.open).toBe(true);
		expect(invoke).toHaveBeenCalledTimes(1);

		rejectInstall('Download interrupted');
		await flushPromises();
		expect(wrapper.get('[role="alert"]').text()).toContain('Download interrupted');
		expect(wrapper.find('.spinner-border').exists()).toBe(false);
		await wrapper.get('button').trigger('click');
		expect(dialog.element.open).toBe(false);
		expect(invoke).toHaveBeenCalledTimes(1);
	} finally {
		wrapper.unmount();
		await flushPromises();
		clearMocks();
		vi.unstubAllGlobals();
	}
});
