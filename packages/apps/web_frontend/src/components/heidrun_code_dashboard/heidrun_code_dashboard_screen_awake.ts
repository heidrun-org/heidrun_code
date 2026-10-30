///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	HeidrunCodeDashboardScreenAwake — keeps the screen of a phone or a tablet of the local network on
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * A video of 2 seconds, 16 by 16 black pixels, with a silent sound track. WebKit keeps the display on only while a
 * video plays with a sound track, not muted, and with no `loop` attribute (issue 991).
 */
const SILENT_VIDEO_ADDRESS = 'data:video/mp4;base64,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b21hX21lPTEgdHJlbGxpcz0xIDh4OGRjdD0wIGNxbT0wIGRlYWR6b25lPTIxLDExIGZhc3RfcHNraXA9MSBjaHJvbWFfcXBfb2Zmc2V0PS0yIHRocmVhZHM9MSBsb29rYWhlYWRfdGhyZWFkcz0xIHNsaWNlZF90aHJlYWRzPTAgbnI9MCBkZWNpbWF0ZT0xIGludGVybGFjZWQ9MCBibHVyYXlfY29tcGF0PTAgY29uc3RyYWluZWRfaW50cmE9MCBiZnJhbWVzPTAgd2VpZ2h0cD0wIGtleWludD0yNTAga2V5aW50X21pbj0xIHNjZW5lY3V0PTQwIGludHJhX3JlZnJlc2g9MCByY19sb29rYWhlYWQ9NDAgcmM9Y3JmIG1idHJlZT0xIGNyZj0yMy4wIHFjb21wPTAuNjAgcXBtaW49MCBxcG1heD02OSBxcHN0ZXA9NCBpcF9yYXRpbz0xLjQwIGFxPTE6MS4wMACAAAAADmWIhAW///8PRQABT3+AARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcAAAAGQZo4CvqAARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAc=';

/** The time of the video, in seconds, after which the video goes back to its start, before it ends. */
const REWIND_AFTER_SECONDS = 1;

/** The events that a web browser counts as a gesture of the user, which allows a video with sound to play. */
const USER_GESTURE_EVENTS = [
	'touchend',
	'click',
	'keydown',
];

/** The part of the Screen Wake Lock interface of the web browser that the page uses. */
type WakeLockSentinelLike = {
	/** Lets the screen turn off again. */
	release: () => Promise<void>;
};

/** The part of `navigator.wakeLock` that the page uses. It exists only on HTTPS. */
type WakeLockLike = {
	/** Asks the device to keep its screen on. */
	request: (type: 'screen') => Promise<WakeLockSentinelLike>;
};

/**
 * Keeps the screen of the device on while the page shows. With HTTPS, it asks the Screen Wake Lock interface. On the
 * plain HTTP of the local network, the web browser has no such interface, so it plays a silent video, hidden, from the
 * first touch of the developer: the web browser refuses a video with sound before a gesture of the user.
 */
export class HeidrunCodeDashboardScreenAwake {
	/** The request of the Screen Wake Lock interface that keeps the screen on, or null. */
	private _wakeLock: WakeLockSentinelLike | null = null;
	/** The silent video that keeps the screen on when the web browser has no Screen Wake Lock interface, or null. */
	private _video: HTMLVideoElement | null = null;
	/** True between `start` and `stop`. */
	private _isStarted = false;

	/** The web browser releases the screen when the page hides: ask again when the page shows. */
	private readonly _onVisibilityChange = (): void => {
		if (document.visibilityState === 'visible') {
			this._wakeLock = null;
			void this._keepScreenOn();
		}
	};

	/** A gesture of the user allows the video to play, when it could not play before. */
	private readonly _onUserGesture = (): void => {
		void this._keepScreenOn();
	};

	/** A video that plays to its end lets the screen turn off, and a `loop` attribute too: go back to the start. */
	private readonly _onTimeUpdate = (): void => {
		if (this._video !== null && this._video.currentTime > REWIND_AFTER_SECONDS) {
			this._video.currentTime = 0;
		}
	};

	/**
	 * Starts to keep the screen on.
	 * @returns Nothing.
	 */
	start(): void {
		if (this._isStarted === true) {
			return;
		}
		this._isStarted = true;
		document.addEventListener('visibilitychange', this._onVisibilityChange);
		for (const eventName of USER_GESTURE_EVENTS) {
			document.addEventListener(eventName, this._onUserGesture, {
				capture: true,
				passive: true,
			});
		}
		void this._keepScreenOn();
	}

	/**
	 * Lets the screen turn off again, and removes the video.
	 * @returns Nothing.
	 */
	stop(): void {
		this._isStarted = false;
		document.removeEventListener('visibilitychange', this._onVisibilityChange);
		for (const eventName of USER_GESTURE_EVENTS) {
			document.removeEventListener(eventName, this._onUserGesture, {
				capture: true,
			});
		}
		void this._wakeLock?.release().catch(() => undefined);
		this._wakeLock = null;
		if (this._video !== null) {
			this._video.removeEventListener('timeupdate', this._onTimeUpdate);
			this._video.pause();
			this._video.remove();
			this._video = null;
		}
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Asks the Screen Wake Lock interface when it exists, and plays the silent video when it does not or when it refuses.
	 * @returns Nothing, when the request is done.
	 */
	private async _keepScreenOn(): Promise<void> {
		if (this._isStarted === false || this._wakeLock !== null) {
			return;
		}
		const wakeLockApi = (navigator as Navigator & { wakeLock?: WakeLockLike }).wakeLock;
		if (wakeLockApi !== undefined) {
			try {
				const wakeLock = await wakeLockApi.request('screen');
				if (this._isStopped() === true) {
					void wakeLock.release().catch(() => undefined);
					return;
				}
				this._wakeLock = wakeLock;
				return;
			} catch {
				this._wakeLock = null;
			}
		}
		await this._playVideo();
	}

	/**
	 * Tells whether `stop` came, also while a request waits.
	 * @returns True after `stop`.
	 */
	private _isStopped(): boolean {
		return this._isStarted === false;
	}

	/**
	 * Plays the silent video, and creates it the first time. The web browser refuses before a gesture of the user.
	 * @returns Nothing, when the web browser plays the video or refuses.
	 */
	private async _playVideo(): Promise<void> {
		if (this._video === null) {
			this._video = this._createVideo();
			document.body.appendChild(this._video);
		}
		if (this._video.paused === false) {
			return;
		}
		try {
			await this._video.play();
		} catch {
			/* no gesture of the user yet: the next touch plays the video */
		}
	}

	/**
	 * Creates the silent video, with sound and with no `loop` attribute, nearly invisible, and out of the way of a touch.
	 * @returns The video element, not yet in the page.
	 */
	private _createVideo(): HTMLVideoElement {
		const video = document.createElement('video');
		video.setAttribute('playsinline', '');
		video.setAttribute('aria-hidden', 'true');
		video.setAttribute('data-heidrun-code-dashboard-screen-awake', '');
		video.muted = false;
		video.loop = false;
		video.disableRemotePlayback = true;
		video.src = SILENT_VIDEO_ADDRESS;
		video.style.position = 'fixed';
		video.style.left = '0';
		video.style.top = '0';
		video.style.width = '1px';
		video.style.height = '1px';
		video.style.opacity = '0.01';
		video.style.pointerEvents = 'none';
		video.addEventListener('timeupdate', this._onTimeUpdate);
		return video;
	}
}
