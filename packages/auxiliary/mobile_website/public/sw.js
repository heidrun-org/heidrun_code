// The service worker of Heidrun Code Mobile. The page registers it so that Chrome on Android can show a notification, even
// when the page is in the background. It does nothing else: it has no cache and no offline page.

/**
 * Takes control at once, so a new version of this file replaces the old one without waiting for the developer to
 * close every tab.
 */
self.addEventListener('install', () => {
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(self.clients.claim());
});

/**
 * The computer sends a push when a coding agent needs the developer. The push has no body, so the notification has a
 * fixed text. Chrome on Android needs a visible notification for every push.
 */
self.addEventListener('push', (event) => {
	event.waitUntil(
		self.registration.showNotification('Heidrun Code', {
			body: 'A coding agent needs you.',
			tag: 'heidrun-needs-you',
			renotify: true,
			data: {
				screen: '/needs-you',
			},
		}),
	);
});

/**
 * A tap on a notification opens the screen that the notification names, in the window of the page when one is open.
 * The notification carries the part of the address after "#" in `data.screen`, for example `/panes/p-1`.
 */
self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const screen = event.notification.data?.screen ?? '/needs-you';
	const address = new URL(`/#${screen}`, self.location.origin).href;
	event.waitUntil(
		self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windows) => {
			for (const client of windows) {
				if ('navigate' in client) {
					await client.navigate(address);
					return client.focus();
				}
			}
			return self.clients.openWindow(address);
		}),
	);
});
