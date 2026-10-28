import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import SettingsNotificationsSection from './SettingsNotificationsSection.vue';
import { NOTIFICATION_KINDS, NotificationChannels } from '../../lib/notification_channels';
import { settings } from '../../stores/settings';

const mocks = vi.hoisted(() => ({ sendNotification: vi.fn(), invoke: vi.fn(async () => undefined) }));

vi.mock('@tauri-apps/plugin-notification', () => ({
	isPermissionGranted: vi.fn(async () => true),
	requestPermission: vi.fn(async () => 'granted'),
	sendNotification: mocks.sendNotification,
}));
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }));

enableAutoUnmount(afterEach);

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	SettingsNotificationsSectionTest — the system notification and the sound of each kind (issue #857)
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

beforeEach(() => {
	settings.language = 'en';
	settings.quietFrom = '';
	settings.quietTo = '';
	settings.notificationChannels = NotificationChannels.createDefaults();
	mocks.sendNotification.mockClear();
	mocks.invoke.mockClear();
});

/**
 * Finds the row of one kind of notification.
 *
 * @param wrapper - The mounted section.
 * @param kind - The kind of notification.
 * @returns The row of the kind.
 */
function getRow(wrapper: ReturnType<typeof mount>, kind: string) {
	return wrapper.get(`[data-option="notificationChannel"][data-kind="${kind}"]`);
}

describe('SettingsNotificationsSection, the rows of the kinds of notification', () => {
	it('shows one row for each of the nine kinds, in order, each with a visible name', () => {
		const wrapper = mount(SettingsNotificationsSection);
		const rowList = wrapper.findAll('[data-option="notificationChannel"]');
		expect(rowList.map((row) => row.attributes('data-kind'))).toEqual([...NOTIFICATION_KINDS]);
		expect(rowList[0].text()).toContain('A pane is blocked');
		expect(rowList[8].text()).toContain('The summary of the day');
	});

	it('puts the nine rows in one Bootstrap list group with a border, each row an action item that gets the soft background under the pointer', () => {
		const wrapper = mount(SettingsNotificationsSection);
		const listGroup = wrapper.get('.list-group');
		expect(listGroup.classes()).not.toContain('list-group-flush');
		const rowList = listGroup.findAll(':scope > .list-group-item.list-group-item-action');
		expect(rowList).toHaveLength(NOTIFICATION_KINDS.length);
		expect(rowList.every((row) => row.attributes('data-option') === 'notificationChannel')).toBe(true);
		expect(wrapper.findAll('[data-option="notificationChannel"]')).toHaveLength(NOTIFICATION_KINDS.length);
	});

	it('shows in every row two Bootstrap switches, a list of 14 sounds, and a button Test', () => {
		const wrapper = mount(SettingsNotificationsSection);
		for (const kind of NOTIFICATION_KINDS) {
			const row = getRow(wrapper, kind);
			const switchList = row.findAll('input[role="switch"]');
			expect(switchList).toHaveLength(2);
			expect(row.text()).toContain('System notification');
			expect(row.text()).toContain('Sound');
			expect(row.findAll('select option')).toHaveLength(14);
			expect(row.get('button').text()).toBe('Test');
		}
	});

	it('shows the system notification on and the sound off at first, and disables the list of sounds', () => {
		const wrapper = mount(SettingsNotificationsSection);
		const row = getRow(wrapper, 'blocked');
		const [systemSwitch, soundSwitch] = row.findAll('input[role="switch"]');
		expect((systemSwitch.element as HTMLInputElement).checked).toBe(true);
		expect((soundSwitch.element as HTMLInputElement).checked).toBe(false);
		expect(row.get('select').attributes('disabled')).toBeDefined();
	});

	it('saves the choice of one row without changing the other rows', async () => {
		const wrapper = mount(SettingsNotificationsSection);
		const row = getRow(wrapper, 'done');
		const [, soundSwitch] = row.findAll('input[role="switch"]');
		await soundSwitch.setValue(true);
		await row.get('select').setValue('Glass');
		expect(settings.notificationChannels.done.isSoundEnabled).toBe(true);
		expect(settings.notificationChannels.done.soundName).toBe('Glass');
		expect(settings.notificationChannels.blocked.isSoundEnabled).toBe(false);
		expect(row.get('select').attributes('disabled')).toBeUndefined();
	});

	it('disables the switch Sound, the list, and the button Test when the system notification is off', async () => {
		const wrapper = mount(SettingsNotificationsSection);
		const row = getRow(wrapper, 'quota');
		const [systemSwitch, soundSwitch] = row.findAll('input[role="switch"]');
		await systemSwitch.setValue(false);
		expect(settings.notificationChannels.quota.isSystemEnabled).toBe(false);
		expect(soundSwitch.attributes('disabled')).toBeDefined();
		expect(row.get('select').attributes('disabled')).toBeDefined();
		expect(row.get('button').attributes('disabled')).toBeDefined();
	});
});

describe('SettingsNotificationsSection, the button Test', () => {
	it('shows a test notification of the kind of its row, without a sound when the sound is off', async () => {
		const wrapper = mount(SettingsNotificationsSection);
		await getRow(wrapper, 'blocked').get('button').trigger('click');
		await flushPromises();
		expect(mocks.sendNotification).toHaveBeenCalledTimes(1);
		expect(mocks.sendNotification).toHaveBeenCalledWith({
			title: 'Test: A pane is blocked',
			body: 'This is a test of the system notification of Heidrun Code.',
		});
		expect(mocks.invoke).not.toHaveBeenCalled();
	});

	it('plays the chosen sound of its row through the application when the sound is on', async () => {
		settings.notificationChannels.evening.isSoundEnabled = true;
		settings.notificationChannels.evening.soundName = 'Submarine';
		const wrapper = mount(SettingsNotificationsSection);
		await getRow(wrapper, 'evening').get('button').trigger('click');
		await flushPromises();
		expect(mocks.sendNotification).toHaveBeenCalledWith({
			title: 'Test: The summary of the day',
			body: 'This is a test of the system notification of Heidrun Code.',
		});
		expect(mocks.invoke).toHaveBeenCalledWith('play_system_sound', { name: 'Submarine' });
	});

	it('shows the test notification in the quiet hours', async () => {
		const now = new Date();
		settings.quietFrom = `${String(now.getHours()).padStart(2, '0')}:00`;
		settings.quietTo = `${String((now.getHours() + 1) % 24).padStart(2, '0')}:00`;
		const wrapper = mount(SettingsNotificationsSection);
		await getRow(wrapper, 'done').get('button').trigger('click');
		await flushPromises();
		expect(mocks.sendNotification).toHaveBeenCalledTimes(1);
	});
});
