import Fs from 'node:fs';
import Path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppHarness } from './app_harness';
import { Fixtures } from './fixtures';

/** The `Notification` of the browser: the permission, and the question to the developer. */
class FakeNotification {
	static permission: NotificationPermission = 'default';
	static answer: NotificationPermission = 'granted';
	static requestPermission = vi.fn(async () => {
		FakeNotification.permission = FakeNotification.answer;
		return FakeNotification.permission;
	});
}

const showNotification = vi.fn(async (..._parameters: unknown[]) => undefined);

/** The key that the fake computer gives: 65 bytes, as the real one. */
const PUSH_KEY = Buffer.from(Uint8Array.from({ length: 65 }, (_, index) => index)).toString('base64url');

const unsubscribe = vi.fn(async () => true);
const subscribe = vi.fn(async (_options: unknown) => ({ endpoint: 'https://push.example.com/a', unsubscribe }));
const getSubscription = vi.fn(async (): Promise<unknown> => null);

/**
 * Builds the service worker registration of the fake browser.
 * @returns A registration that shows notifications and keeps a push subscription.
 */
const registration = (): unknown => ({
	showNotification,
	pushManager: {
		getSubscription,
		subscribe,
	},
});

/**
 * Builds a fake computer that gives the push key.
 * @returns The fake computer.
 */
const computerWithPushKey = () => {
	const computer = Fixtures.computer();
	computer.answers.pushKey = [{ key: PUSH_KEY }];
	return computer;
};

/**
 * Gives the browser a service worker that registers, or that fails, and a `Notification`.
 * @param register What `navigator.serviceWorker.register` does.
 */
const installBrowser = (register: () => Promise<unknown>): void => {
	Object.defineProperty(window, 'isSecureContext', {
		value: true,
		configurable: true,
	});
	Object.defineProperty(navigator, 'serviceWorker', {
		value: {
			register,
		},
		configurable: true,
	});
	vi.stubGlobal('Notification', FakeNotification);
};

afterEach(() => {
	Reflect.deleteProperty(navigator, 'serviceWorker');
	vi.unstubAllGlobals();
	FakeNotification.permission = 'default';
	FakeNotification.answer = 'granted';
	FakeNotification.requestPermission.mockClear();
	showNotification.mockClear();
	subscribe.mockClear();
	unsubscribe.mockClear();
	getSubscription.mockReset();
	getSubscription.mockResolvedValue(null);
});

/** The text of the settings window. */
const sheetText = (): string => document.querySelector('.settings-sheet')?.textContent ?? '';

const rowOf = (name: string): string | null => {
	const rows = [...document.querySelectorAll('.notification-row')];
	const row = rows.find((candidate) => candidate.querySelector('span')?.textContent === name);
	return row?.querySelectorAll('span')[1]?.textContent ?? null;
};

describe('Notifications in the settings window of the Dashboard', () => {
	it('says that the browser cannot show notifications, and offers no button', async () => {
		const harness = await AppHarness.start(computerWithPushKey(), true, '#/dashboard');
		await harness.tap('[data-action="open-settings"]');
		expect(sheetText()).toContain('Notifications');
		expect(rowOf('Browser support')).toBe('no');
		expect(sheetText()).toContain('Chrome on Android needs an address that starts with https.');
		expect(document.querySelector('[data-action^="notifications-"]')).toBeNull();
	});

	it('registers the service worker at /sw.js, and shows the button Enable notifications', async () => {
		const register = vi.fn(async () => registration());
		installBrowser(register);
		const harness = await AppHarness.start(computerWithPushKey(), true, '#/dashboard');
		await harness.tap('[data-action="open-settings"]');
		expect(register).toHaveBeenCalledWith('/sw.js');
		expect(rowOf('Address with https')).toBe('yes');
		expect(rowOf('Browser support')).toBe('yes');
		expect(rowOf('Service worker')).toBe('registered');
		expect(rowOf('Permission')).toBe('default');
		expect(document.querySelector('[data-action="notifications-enable"]')).not.toBeNull();
	});

	it('shows the error of a service worker that fails to register, as it is', async () => {
		installBrowser(async () => {
			throw new TypeError('Failed to register a ServiceWorker: bad MIME type');
		});
		const harness = await AppHarness.start(computerWithPushKey(), true, '#/dashboard');
		await harness.tap('[data-action="open-settings"]');
		expect(rowOf('Service worker')).toBe('failed');
		expect(sheetText()).toContain('TypeError: Failed to register a ServiceWorker: bad MIME type');
	});

	it('asks the browser for the permission at a tap, then offers the test notification', async () => {
		installBrowser(async () => registration());
		const harness = await AppHarness.start(computerWithPushKey(), true, '#/dashboard');
		await harness.tap('[data-action="open-settings"]');
		await harness.tap('[data-action="notifications-enable"]');
		expect(FakeNotification.requestPermission).toHaveBeenCalledTimes(1);
		expect(rowOf('Permission')).toBe('granted');
		expect(document.querySelector('[data-action="notifications-enable"]')).toBeNull();
		expect(document.querySelector('[data-action="notifications-test"]')).not.toBeNull();
	});

	it('explains how to allow the notifications again when the developer refused', async () => {
		installBrowser(async () => registration());
		FakeNotification.answer = 'denied';
		const harness = await AppHarness.start(computerWithPushKey(), true, '#/dashboard');
		await harness.tap('[data-action="open-settings"]');
		await harness.tap('[data-action="notifications-enable"]');
		expect(rowOf('Permission')).toBe('denied');
		expect(sheetText()).toContain('allow them in the settings of the browser');
		expect(document.querySelector('[data-action^="notifications-"]')).toBeNull();
	});

	it('sends a test notification through the service worker, with the screen that a tap opens', async () => {
		installBrowser(async () => registration());
		FakeNotification.permission = 'granted';
		const harness = await AppHarness.start(computerWithPushKey(), true, '#/dashboard');
		await harness.tap('[data-action="open-settings"]');
		await harness.tap('[data-action="notifications-test"]');
		expect(showNotification).toHaveBeenCalledWith('Heidrun Code', {
			body: 'Test notification: a coding agent needs you.',
			tag: 'heidrun-test',
			data: {
				screen: '/needs-you',
			},
		});
		expect(harness.toast()).toBe('Test notification sent');
	});

	it('shows the error of a test notification that fails', async () => {
		installBrowser(async () => ({
			showNotification: async () => {
				throw new Error('no permission');
			},
		}));
		FakeNotification.permission = 'granted';
		const harness = await AppHarness.start(computerWithPushKey(), true, '#/dashboard');
		await harness.tap('[data-action="open-settings"]');
		await harness.tap('[data-action="notifications-test"]');
		expect(harness.toast()).toBe('The notification failed: Error: no permission');
	});
});

describe('The gear button of the Dashboard', () => {
	it('opens the settings window with the notifications, and Close removes it', async () => {
		const harness = await AppHarness.start(Fixtures.computer(), true, '#/dashboard');
		expect(document.querySelector('.settings-sheet')).toBeNull();
		expect(harness.text()).not.toContain('Notifications');
		await harness.tap('[data-action="open-settings"]');
		expect(sheetText()).toContain('Settings');
		expect(sheetText()).toContain('Notifications');
		await harness.tap('button[data-action="settings-close"]');
		expect(document.querySelector('.settings-sheet')).toBeNull();
	});

	it('is only on the Dashboard', async () => {
		await AppHarness.start(Fixtures.computer(), true, '#/panes');
		expect(document.querySelector('[data-action="open-settings"]')).toBeNull();
	});
});

describe('The push from the computer', () => {
	it('subscribes with the key of the computer when the developer allows the notifications, and tells the computer', async () => {
		installBrowser(async () => registration());
		const computer = computerWithPushKey();
		const harness = await AppHarness.start(computer, true, '#/dashboard');
		await harness.tap('[data-action="open-settings"]');
		await harness.tap('[data-action="notifications-enable"]');
		expect(subscribe).toHaveBeenCalledTimes(1);
		const options = subscribe.mock.calls[0][0] as { userVisibleOnly: boolean; applicationServerKey: Uint8Array };
		expect(options.userVisibleOnly).toBe(true);
		expect([...options.applicationServerKey]).toEqual(Array.from({ length: 65 }, (_, index) => index));
		expect(computer.callsOf('subscribe').map((call) => call.params)).toEqual([{ endpoint: 'https://push.example.com/a' }]);
		expect(rowOf('Push from the computer')).toBe('on');
		expect(document.querySelector('[data-action="push-off"]')).not.toBeNull();
	});

	it('tells the computer again about a subscription that the browser already has', async () => {
		installBrowser(async () => registration());
		FakeNotification.permission = 'granted';
		getSubscription.mockResolvedValue({
			endpoint: 'https://push.example.com/old',
			options: {
				applicationServerKey: Uint8Array.from({ length: 65 }, (_, index) => index).buffer,
			},
			unsubscribe,
		});
		const computer = computerWithPushKey();
		const harness = await AppHarness.start(computer, true, '#/dashboard');
		await harness.tap('[data-action="open-settings"]');
		await harness.settle();
		expect(subscribe).not.toHaveBeenCalled();
		expect(computer.callsOf('subscribe').map((call) => call.params)).toEqual([{ endpoint: 'https://push.example.com/old' }]);
		expect(rowOf('Push from the computer')).toBe('on');
	});

	it('replaces a subscription that was made with another key', async () => {
		installBrowser(async () => registration());
		FakeNotification.permission = 'granted';
		getSubscription.mockResolvedValue({
			endpoint: 'https://push.example.com/old',
			options: {
				applicationServerKey: Uint8Array.from([1, 2, 3]).buffer,
			},
			unsubscribe,
		});
		const harness = await AppHarness.start(computerWithPushKey(), true, '#/dashboard');
		await harness.tap('[data-action="open-settings"]');
		await harness.settle();
		expect(unsubscribe).toHaveBeenCalledTimes(1);
		expect(subscribe).toHaveBeenCalledTimes(1);
	});

	it('shows the error when the browser refuses the subscription', async () => {
		installBrowser(async () => registration());
		subscribe.mockRejectedValueOnce(new Error('push service error'));
		const harness = await AppHarness.start(computerWithPushKey(), true, '#/dashboard');
		await harness.tap('[data-action="open-settings"]');
		await harness.tap('[data-action="notifications-enable"]');
		expect(rowOf('Push from the computer')).toBe('failed');
		expect(sheetText()).toContain('Error: push service error');
		expect(document.querySelector('[data-action="push-on"]')).not.toBeNull();
	});

	it('turns the push off in the browser and on the computer', async () => {
		installBrowser(async () => registration());
		FakeNotification.permission = 'granted';
		const computer = computerWithPushKey();
		const harness = await AppHarness.start(computer, true, '#/dashboard');
		await harness.tap('[data-action="open-settings"]');
		await harness.tap('[data-action="push-on"]');
		getSubscription.mockResolvedValue({ endpoint: 'https://push.example.com/a', unsubscribe });
		await harness.tap('[data-action="push-off"]');
		expect(computer.callsOf('unsubscribe').map((call) => call.params)).toEqual([{ endpoint: 'https://push.example.com/a' }]);
		expect(unsubscribe).toHaveBeenCalledTimes(1);
		expect(rowOf('Push from the computer')).toBe('off');
	});
});

describe('The file of the service worker', () => {
	const pushSource = Fs.readFileSync(Path.join(__dirname, '../public/sw.js'), 'utf8');

	it('shows a notification for every push, and a tap on it opens the screen Needs you', () => {
		expect(pushSource).toContain("addEventListener('push'");
		expect(pushSource).toContain('showNotification');
		expect(pushSource).toContain("screen: '/needs-you'");
	});

	const source = Fs.readFileSync(Path.join(__dirname, '../public/sw.js'), 'utf8');

	it('opens the screen of a notification when the developer taps it', () => {
		expect(source).toContain("addEventListener('notificationclick'");
		expect(source).toContain('openWindow');
	});

	it('has no cache and no fetch handler, so it never answers a call of the page in place of the computer', () => {
		expect(source).not.toContain("addEventListener('fetch'");
		expect(source).not.toContain('caches.');
	});
});
