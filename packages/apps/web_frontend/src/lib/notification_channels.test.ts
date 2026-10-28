// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { NOTIFICATION_KINDS, NotificationChannels, SYSTEM_SOUND_NAMES } from './notification_channels';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	NotificationChannelsTest — the channel of each kind of notification (issue #857)
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

describe('NotificationChannels.createDefaults', () => {
	it('lists the nine kinds of notification', () => {
		expect(NOTIFICATION_KINDS).toHaveLength(9);
	});

	it('lists the 14 system sounds of macOS', () => {
		expect(SYSTEM_SOUND_NAMES).toHaveLength(14);
	});

	it('turns the system notification on and the sound off for every kind, with the sound Ping', () => {
		const channelMap = NotificationChannels.createDefaults();
		for (const kind of NOTIFICATION_KINDS) {
			expect(channelMap[kind]).toEqual({
				isSystemEnabled: true,
				isSoundEnabled: false,
				soundName: 'Ping',
			});
		}
	});

	it('gives a new channel each time, so that a change in one map never reaches another map', () => {
		const firstMap = NotificationChannels.createDefaults();
		const secondMap = NotificationChannels.createDefaults();
		firstMap.blocked.isSoundEnabled = true;
		expect(secondMap.blocked.isSoundEnabled).toBe(false);
	});
});

describe('NotificationChannels.keep', () => {
	it('gives the defaults back for a value that is not an object', () => {
		expect(NotificationChannels.keep(null)).toEqual(NotificationChannels.createDefaults());
		expect(NotificationChannels.keep('loud')).toEqual(NotificationChannels.createDefaults());
		expect(NotificationChannels.keep(12)).toEqual(NotificationChannels.createDefaults());
	});

	it('keeps a valid saved channel', () => {
		const channelMap = NotificationChannels.keep({
			done: {
				isSystemEnabled: false,
				isSoundEnabled: true,
				soundName: 'Glass',
			},
		});
		expect(channelMap.done).toEqual({
			isSystemEnabled: false,
			isSoundEnabled: true,
			soundName: 'Glass',
		});
	});

	it('gives the default channel to a kind that the saved value does not know', () => {
		const channelMap = NotificationChannels.keep({ done: { isSoundEnabled: true } });
		expect(channelMap.blocked).toEqual(NotificationChannels.createDefaults().blocked);
		expect(channelMap.done.isSoundEnabled).toBe(true);
	});

	it('replaces a field of the wrong type and a sound that macOS does not have', () => {
		const channelMap = NotificationChannels.keep({
			quota: {
				isSystemEnabled: 'yes',
				isSoundEnabled: 1,
				soundName: 'Airhorn',
			},
		});
		expect(channelMap.quota).toEqual(NotificationChannels.createDefaults().quota);
	});

	it('drops a kind that does not exist', () => {
		const channelMap = NotificationChannels.keep({ invented: { isSystemEnabled: false } });
		expect(Object.keys(channelMap)).toEqual([...NOTIFICATION_KINDS]);
	});
});
