import { MobileApi } from './mobile_api';
import type { CallResult, NotificationStatus } from './mobile_types';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	PhoneNotifications — the service worker, the permission, and the notifications of the browser of the phone
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Gives access to the notifications of the browser. Chrome on Android shows a notification only through a service
 * worker, on an address that starts with `https`. A page in a plain tab can do it: it needs no installation.
 */
export class PhoneNotifications {
	/** The address of the file of the service worker. */
	static readonly workerAddress = '/sw.js';

	/** The service worker that is registered, or null before the registration ends, and when it fails. */
	private registration: ServiceWorkerRegistration | null = null;

	/** What the page knows now, for the screen. */
	private status: NotificationStatus = PhoneNotifications._initialStatus();

	/**
	 * Gives what the page knows now.
	 * @returns The status.
	 */
	getStatus(): NotificationStatus {
		return {
			...this.status,
			permission: PhoneNotifications._permission(),
		};
	}

	/**
	 * Registers the service worker. A failure does not throw: the status keeps the text of the error, and the
	 * screen shows it.
	 * @returns A promise that ends when the registration worked or failed.
	 */
	async register(): Promise<void> {
		if (this.status.isSupported === false) {
			return;
		}
		try {
			this.registration = await navigator.serviceWorker.register(PhoneNotifications.workerAddress);
			this.status = {
				...this.status,
				worker: 'registered',
				error: null,
			};
			await this._syncExistingPush();
		} catch (error) {
			this.registration = null;
			this.status = {
				...this.status,
				worker: 'failed',
				error: PhoneNotifications._errorText(error),
			};
		}
	}

	/**
	 * Asks the developer to allow the notifications. The browser shows its own question, and only a tap of the
	 * developer can start it: call this method in the handler of a tap, before any other waiting.
	 * @returns The answer of the developer: `granted`, `denied`, or `default` when the developer closed the question.
	 */
	async requestPermission(): Promise<NotificationPermission> {
		if (this.status.isSupported === false) {
			return 'denied';
		}
		return Notification.requestPermission();
	}

	/**
	 * Asks the browser for a push subscription with the key of the computer, then tells the computer where to send
	 * the push. The permission must be granted first.
	 * @returns The text of the error, or null when the computer knows this phone.
	 */
	async subscribePush(): Promise<string | null> {
		if (this.registration === null) {
			return 'The service worker is not registered';
		}
		try {
			const answer = await MobileApi.call<CallResult>('pushKey');
			if (answer.key === undefined) {
				throw new Error(answer.error ?? 'The computer sent no key');
			}
			const key = PhoneNotifications._keyBytes(answer.key);
			let subscription = await this.registration.pushManager.getSubscription();
			if (subscription !== null && PhoneNotifications._isSameKey(subscription, key) === false) {
				await subscription.unsubscribe();
				subscription = null;
			}
			subscription ??= await this.registration.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: key,
			});
			await MobileApi.call<CallResult>('subscribe', {
				endpoint: subscription.endpoint,
			});
			this.status = {
				...this.status,
				push: 'on',
				error: null,
			};
			return null;
		} catch (error) {
			const text = PhoneNotifications._errorText(error);
			this.status = {
				...this.status,
				push: 'failed',
				error: text,
			};
			return text;
		}
	}

	/**
	 * Stops the push: the browser forgets the subscription, and the computer forgets this phone.
	 * @returns The text of the error, or null when the push is off.
	 */
	async unsubscribePush(): Promise<string | null> {
		try {
			const subscription = (await this.registration?.pushManager.getSubscription()) ?? null;
			if (subscription !== null) {
				await MobileApi.call<CallResult>('unsubscribe', {
					endpoint: subscription.endpoint,
				});
				await subscription.unsubscribe();
			}
			this.status = {
				...this.status,
				push: 'off',
				error: null,
			};
			return null;
		} catch (error) {
			const text = PhoneNotifications._errorText(error);
			this.status = {
				...this.status,
				push: 'failed',
				error: text,
			};
			return text;
		}
	}

	/**
	 * Shows a notification that the page makes itself, to prove that the service worker and the permission work.
	 * @returns The text of the error, or null when the notification was sent to the system.
	 */
	async showTest(): Promise<string | null> {
		if (this.registration === null) {
			return 'The service worker is not registered';
		}
		try {
			await this.registration.showNotification('Heidrun Code', {
				body: 'Test notification: a coding agent needs you.',
				tag: 'heidrun-test',
				data: {
					screen: '/needs-you',
				},
			});
			return null;
		} catch (error) {
			return PhoneNotifications._errorText(error);
		}
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Private methods
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	private static _initialStatus(): NotificationStatus {
		const isSupported = 'serviceWorker' in navigator && 'Notification' in window;
		return {
			isSecure: window.isSecureContext === true,
			isSupported,
			worker: 'not-registered',
			permission: PhoneNotifications._permission(),
			push: 'off',
			error: null,
		};
	}

	/** When the browser has a subscription already, the computer is told again: it may have forgotten this phone. */
	private async _syncExistingPush(): Promise<void> {
		const subscription = await this.registration?.pushManager?.getSubscription();
		if (subscription === null || subscription === undefined || PhoneNotifications._permission() !== 'granted') {
			return;
		}
		await this.subscribePush();
	}

	private static _keyBytes(key: string): Uint8Array<ArrayBuffer> {
		const base64 = key.replace(/-/g, '+').replace(/_/g, '/');
		const text = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
		return Uint8Array.from(text, (character) => character.charCodeAt(0));
	}

	private static _isSameKey(subscription: PushSubscription, key: Uint8Array<ArrayBuffer>): boolean {
		const known = subscription.options.applicationServerKey;
		if (known === null) {
			return false;
		}
		const bytes = new Uint8Array(known);
		return bytes.length === key.length && bytes.every((value, index) => value === key[index]);
	}

	private static _permission(): NotificationPermission | 'unsupported' {
		return 'Notification' in window ? Notification.permission : 'unsupported';
	}

	private static _errorText(error: unknown): string {
		return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
	}
}
