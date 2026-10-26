///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	NotificationChannels — the system notification and the sound of each kind of notification
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The kinds of notification that Heidrun Code sends, in the order of the Notifications section of the Settings window.
 */
export const NOTIFICATION_KINDS = [
	'blocked',
	'question',
	'done',
	'stillBlocked',
	'context',
	'quota',
	'budget',
	'patternFound',
	'evening',
] as const;

/**
 * One kind of notification.
 */
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/**
 * The names of the 14 system sounds of macOS. The notification plugin of Tauri accepts one of these names.
 */
export const SYSTEM_SOUND_NAMES = [
	'Basso',
	'Blow',
	'Bottle',
	'Frog',
	'Funk',
	'Glass',
	'Hero',
	'Morse',
	'Ping',
	'Pop',
	'Purr',
	'Sosumi',
	'Submarine',
	'Tink',
] as const;

/**
 * The name of one system sound of macOS.
 */
export type SystemSoundName = (typeof SYSTEM_SOUND_NAMES)[number];

/**
 * How one kind of notification reaches the developer.
 */
export type NotificationChannel = {
	/** True when Heidrun Code sends a system notification for this kind. */
	isSystemEnabled: boolean;
	/** True when the system notification of this kind makes a sound. Only used when `isSystemEnabled` is true. */
	isSoundEnabled: boolean;
	/** The system sound that the notification makes when `isSoundEnabled` is true. */
	soundName: SystemSoundName;
};

/**
 * The channel of every kind of notification.
 */
export type NotificationChannelMap = Record<NotificationKind, NotificationChannel>;

/**
 * Creates and cleans the saved channels of the kinds of notification (issue #857).
 */
export class NotificationChannels {
	/**
	 * The first sound of every kind.
	 */
	static readonly DEFAULT_SOUND_NAME: SystemSoundName = 'Ping';

	/**
	 * Gives the channels of a developer who changed nothing: the system notification is on and the sound is off.
	 *
	 * @returns A new channel for every kind of notification.
	 */
	static createDefaults(): NotificationChannelMap {
		const channelMap = {} as NotificationChannelMap;
		for (const kind of NOTIFICATION_KINDS) {
			channelMap[kind] = {
				isSystemEnabled: true,
				isSoundEnabled: false,
				soundName: NotificationChannels.DEFAULT_SOUND_NAME,
			};
		}
		return channelMap;
	}

	/**
	 * Keeps each saved field that has the right type, and gives the default value back for every other field. A kind
	 * that the saved value does not know gets its default channel.
	 *
	 * @param value - The saved value of the option, whatever it holds.
	 * @returns The channels that can be used.
	 */
	static keep(value: unknown): NotificationChannelMap {
		const channelMap = NotificationChannels.createDefaults();
		if (typeof value !== 'object' || value === null) {
			return channelMap;
		}
		for (const kind of NOTIFICATION_KINDS) {
			const candidate = (value as Partial<Record<NotificationKind, Partial<NotificationChannel> | null>>)[kind];
			if (typeof candidate !== 'object' || candidate === null) {
				continue;
			}
			if (typeof candidate.isSystemEnabled === 'boolean') {
				channelMap[kind].isSystemEnabled = candidate.isSystemEnabled;
			}
			if (typeof candidate.isSoundEnabled === 'boolean') {
				channelMap[kind].isSoundEnabled = candidate.isSoundEnabled;
			}
			if (SYSTEM_SOUND_NAMES.includes(candidate.soundName as SystemSoundName) === true) {
				channelMap[kind].soundName = candidate.soundName as SystemSoundName;
			}
		}
		return channelMap;
	}
}
