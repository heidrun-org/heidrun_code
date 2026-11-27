import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import SettingsTextDetectionSection from './SettingsTextDetectionSection.vue';
import { settings } from '../../stores/settings';

enableAutoUnmount(afterEach);

afterEach(() => {
	settings.terminalTextDetection = true;
	settings.terminalWebAddresses = true;
	settings.terminalInputImagePreviews = true;
});

describe('SettingsTextDetectionSection', () => {
	it('offers independently controlled reference cards, ordinary web links, and input image previews', async () => {
		const wrapper = mount(SettingsTextDetectionSection);
		const referenceSwitch = wrapper.get('[data-option="textDetection"] input');
		const webSwitch = wrapper.get('[data-option="terminalWebAddresses"] input');
		const imageSwitch = wrapper.get('[data-option="terminalInputImagePreviews"] input');
		expect(wrapper.findAll('input')).toHaveLength(3);

		await referenceSwitch.setValue(false);
		expect(settings.terminalTextDetection).toBe(false);
		expect(settings.terminalWebAddresses).toBe(true);

		await webSwitch.setValue(false);
		await referenceSwitch.setValue(true);
		expect(settings.terminalTextDetection).toBe(true);
		expect(settings.terminalWebAddresses).toBe(false);
		expect(settings.terminalInputImagePreviews).toBe(true);

		await imageSwitch.setValue(false);
		expect(settings.terminalInputImagePreviews).toBe(false);
		expect(settings.terminalTextDetection).toBe(true);
		expect(settings.terminalWebAddresses).toBe(false);
	});
});
