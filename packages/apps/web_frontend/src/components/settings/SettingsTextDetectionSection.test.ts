import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import SettingsTextDetectionSection from './SettingsTextDetectionSection.vue';
import { settings } from '../../stores/settings';

enableAutoUnmount(afterEach);

afterEach(() => {
	settings.terminalTextDetection = true;
	settings.terminalWebAddresses = true;
});

describe('SettingsTextDetectionSection', () => {
	it('offers independently controlled reference cards and ordinary web links', async () => {
		const wrapper = mount(SettingsTextDetectionSection);
		const referenceSwitch = wrapper.get('[data-option="textDetection"] input');
		const webSwitch = wrapper.get('[data-option="terminalWebAddresses"] input');
		expect(wrapper.findAll('input')).toHaveLength(2);

		await referenceSwitch.setValue(false);
		expect(settings.terminalTextDetection).toBe(false);
		expect(settings.terminalWebAddresses).toBe(true);

		await webSwitch.setValue(false);
		await referenceSwitch.setValue(true);
		expect(settings.terminalTextDetection).toBe(true);
		expect(settings.terminalWebAddresses).toBe(false);
	});
});
