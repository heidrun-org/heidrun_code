import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HeidrunCodeDashboardScreenAwake } from './heidrun_code_dashboard_screen_awake';

let screenAwake: HeidrunCodeDashboardScreenAwake | null = null;
let play = vi.fn(async () => {});

beforeEach(() => {
	play = vi.fn(async () => {});
	vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(play);
	vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});

afterEach(() => {
	screenAwake?.stop();
	screenAwake = null;
	delete (navigator as unknown as { wakeLock?: unknown }).wakeLock;
	vi.restoreAllMocks();
	document.body.innerHTML = '';
});

/**
 * Gives the silent video of the page, or null.
 * @returns The video element, or null.
 */
function findVideo(): HTMLVideoElement | null {
	return document.querySelector<HTMLVideoElement>('[data-heidrun-code-dashboard-screen-awake]');
}

/**
 * Gives the page a fake Screen Wake Lock interface, as a web browser does on HTTPS.
 * @param request The fake request.
 * @returns Nothing.
 */
function installWakeLock(request: () => Promise<{ release: () => Promise<void> }>): void {
	Object.defineProperty(navigator, 'wakeLock', {
		configurable: true,
		value: {
			request,
		},
	});
}

describe('HeidrunCodeDashboardScreenAwake, the screen of a phone or a tablet of the local network stays on (issue 991)', () => {
	it('plays a silent video with sound and with no loop attribute when the web browser has no Screen Wake Lock interface', async () => {
		screenAwake = new HeidrunCodeDashboardScreenAwake();
		screenAwake.start();
		await vi.waitFor(() => expect(play).toHaveBeenCalledTimes(1));
		const video = findVideo();
		expect(video).not.toBeNull();
		expect(video?.muted).toBe(false);
		expect(video?.loop).toBe(false);
		expect(video?.hasAttribute('playsinline')).toBe(true);
		expect(video?.src.startsWith('data:video/mp4;base64,')).toBe(true);
	});

	it('plays the video again at the first touch when the web browser refused it before a gesture of the user', async () => {
		play.mockRejectedValueOnce(new DOMException('no gesture', 'NotAllowedError'));
		screenAwake = new HeidrunCodeDashboardScreenAwake();
		screenAwake.start();
		await vi.waitFor(() => expect(play).toHaveBeenCalledTimes(1));
		document.body.dispatchEvent(new Event('touchend', {
			bubbles: true,
		}));
		await vi.waitFor(() => expect(play).toHaveBeenCalledTimes(2));
	});

	it('goes back to the start of the video before its end, because a video that ends lets the screen turn off', async () => {
		screenAwake = new HeidrunCodeDashboardScreenAwake();
		screenAwake.start();
		await vi.waitFor(() => expect(findVideo()).not.toBeNull());
		const video = findVideo() as HTMLVideoElement;
		video.currentTime = 1.5;
		video.dispatchEvent(new Event('timeupdate'));
		expect(video.currentTime).toBe(0);
	});

	it('asks the Screen Wake Lock interface when it exists, and plays no video', async () => {
		const release = vi.fn(async () => {});
		const request = vi.fn(async () => ({
			release,
		}));
		installWakeLock(request);
		screenAwake = new HeidrunCodeDashboardScreenAwake();
		screenAwake.start();
		await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));
		expect(findVideo()).toBeNull();
		expect(play).not.toHaveBeenCalled();
		screenAwake.stop();
		expect(release).toHaveBeenCalledTimes(1);
	});

	it('plays the video when the Screen Wake Lock interface refuses', async () => {
		installWakeLock(async () => {
			throw new DOMException('refused', 'NotAllowedError');
		});
		screenAwake = new HeidrunCodeDashboardScreenAwake();
		screenAwake.start();
		await vi.waitFor(() => expect(play).toHaveBeenCalledTimes(1));
		expect(findVideo()).not.toBeNull();
	});

	it('removes the video when the page closes', async () => {
		screenAwake = new HeidrunCodeDashboardScreenAwake();
		screenAwake.start();
		await vi.waitFor(() => expect(findVideo()).not.toBeNull());
		screenAwake.stop();
		expect(findVideo()).toBeNull();
		document.body.dispatchEvent(new Event('click', {
			bubbles: true,
		}));
		expect(play).toHaveBeenCalledTimes(1);
	});
});
