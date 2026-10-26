///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	UserActivity — tells whether the user is active in front of Heidrun Code, and builds one record for each active period
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** Time with no keyboard action and no mouse action after which the user is no longer active, in milliseconds. */
export const USER_ACTIVITY_COOL_DOWN_MS = 5_000;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Types
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The reason why an active period ended. */
export type UserActivityEndReason = "cool_down" | "window_behind" | "workspace_changed" | "app_closed";

/** The two kinds of action that make the user active. */
export type UserActivityActionKind = "keyboard" | "mouse";

/**
 * One active period of the user in one workspace. Every time is an ISO 8601 text with the offset of the time zone, for
 * example `2026-10-14T19:52:03.412+02:00`. The record never holds a key that the user typed, and never a text of the
 * screen: only counts.
 */
export type UserActivityRecord = {
	/** The folder of the workspace, as the current working directory of its selected pane. */
	workspaceFolder: string;
	/** The time of the first action of the period. */
	startedAt: string;
	/** The time of the last action of the period. */
	lastActionAt: string;
	/** The time when the user stopped to be active: the last action plus the cool down, or earlier for another reason. */
	endedAt: string;
	/** The number of keyboard actions in the period. */
	keyboardActionCount: number;
	/** The number of mouse actions in the period: a click, a wheel turn, or a move. */
	mouseActionCount: number;
	/** The reason why the period ended. */
	endReason: UserActivityEndReason;
};

/** The period that is running now, with its times in milliseconds since 1 January 1970. */
type OpenPeriod = {
	/** The time of the first action of the period, or the time of the change of workspace that started it. */
	startedAt: number;
	/**
	 * The time of the last action of the user. A change of workspace counts as an action, so this time is never before
	 * `startedAt`.
	 */
	lastActionAt: number;
	/** The number of keyboard actions since the start of the period. */
	keyboardActionCount: number;
	/** The number of mouse actions since the start of the period. */
	mouseActionCount: number;
};

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	UserActivity
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The user is active when the window of Heidrun Code is in front, a workspace is selected, and the last keyboard action or
 * mouse action is less than the cool down ago. An action while the window is not in front does not count. Each period
 * of activity ends with one record. A period ends when the cool down is over, when the window goes behind, when the
 * selected workspace changes, or when the application closes. The class holds no timer and never reads the clock: the
 * caller gives the current time, so that a test controls the time.
 */
export class UserActivity {
	/** The period that runs now, or `null` when the user is not active. */
	private _period: OpenPeriod | null = null;

	/** True while the window of Heidrun Code is in front. */
	private _isWindowInFront: boolean;

	/** The folder of the selected workspace, or `null` when no workspace is selected. */
	private _workspaceFolder: string | null;

	/** Time with no action after which the user is no longer active, in milliseconds. */
	private _coolDownMs: number;

	/**
	 * @param isWindowInFront - True when the window of Heidrun Code is in front now.
	 * @param workspaceFolder - The folder of the selected workspace, or `null` when no workspace is selected.
	 * @param coolDownMs - Time with no action after which the user is no longer active, in milliseconds.
	 */
	constructor(isWindowInFront: boolean, workspaceFolder: string | null, coolDownMs = USER_ACTIVITY_COOL_DOWN_MS) {
		this._isWindowInFront = isWindowInFront;
		this._workspaceFolder = workspaceFolder;
		this._coolDownMs = coolDownMs;
	}

	/**
	 * Writes a time as an ISO 8601 text, in the time zone of the computer, with milliseconds and the offset of the time
	 * zone: `2026-10-14T19:52:03.412+02:00`.
	 *
	 * @param time - The time, in milliseconds since 1 January 1970.
	 * @returns The time as an ISO 8601 text.
	 */
	static formatTime(time: number): string {
		const offsetMinutes = -new Date(time).getTimezoneOffset();
		const localText = new Date(time + offsetMinutes * 60_000).toISOString().slice(0, 23);
		const sign = offsetMinutes >= 0 ? "+" : "-";
		const hours = String(Math.floor(Math.abs(offsetMinutes) / 60)).padStart(2, "0");
		const minutes = String(Math.abs(offsetMinutes) % 60).padStart(2, "0");
		return `${localText}${sign}${hours}:${minutes}`;
	}

	/**
	 * Records one keyboard action or one mouse action. The action counts only while the window is in front and a
	 * workspace is selected.
	 *
	 * @param now - The current time, in milliseconds.
	 * @param kind - The kind of the action.
	 * @returns The record of the period that the cool down ended just before this action, or `null`.
	 */
	recordAction(now: number, kind: UserActivityActionKind): UserActivityRecord | null {
		if (this._isWindowInFront === false || this._workspaceFolder === null) {
			return null;
		}
		const finished = this.tick(now);
		if (this._period === null) {
			this._period = { startedAt: now, lastActionAt: now, keyboardActionCount: 0, mouseActionCount: 0 };
		}
		this._period.lastActionAt = now;
		if (kind === "keyboard") {
			this._period.keyboardActionCount += 1;
		} else {
			this._period.mouseActionCount += 1;
		}
		return finished;
	}

	/**
	 * Ends the running period when the cool down is over.
	 *
	 * @param now - The current time, in milliseconds.
	 * @returns The record of the period that ended, or `null` when no period ended.
	 */
	tick(now: number): UserActivityRecord | null {
		if (this._period === null || now < this._period.lastActionAt + this._coolDownMs) {
			return null;
		}
		return this._finish("cool_down", this._period.lastActionAt + this._coolDownMs);
	}

	/**
	 * Tells the class that the window of Heidrun Code came to the front or went behind. When the window goes behind, the
	 * period ends at once, without waiting for the cool down.
	 *
	 * @param isWindowInFront - True when the window of Heidrun Code is in front now.
	 * @param now - The current time, in milliseconds.
	 * @returns The record of the period that ended, or `null` when no period ended.
	 */
	setWindowInFront(isWindowInFront: boolean, now: number): UserActivityRecord | null {
		this._isWindowInFront = isWindowInFront;
		if (isWindowInFront) {
			return null;
		}
		return this.tick(now) ?? this._finish("window_behind", now);
	}

	/**
	 * Tells the class which workspace is selected. A change of workspace ends the running period. When the user is still
	 * active, a new period starts at once in the new workspace, and the change counts as its first action.
	 *
	 * @param workspaceFolder - The folder of the selected workspace, or `null` when no workspace is selected.
	 * @param now - The current time, in milliseconds.
	 * @returns The record of the period that ended, or `null` when no period ended.
	 */
	setWorkspaceFolder(workspaceFolder: string | null, now: number): UserActivityRecord | null {
		if (workspaceFolder === this._workspaceFolder) {
			return null;
		}
		const hadPeriod = this._period !== null;
		const finishedByCoolDown = this.tick(now);
		const isStillActive = hadPeriod && finishedByCoolDown === null;
		const finished = finishedByCoolDown ?? this._finish("workspace_changed", now);
		this._workspaceFolder = workspaceFolder;
		if (isStillActive && workspaceFolder !== null) {
			this._period = { startedAt: now, lastActionAt: now, keyboardActionCount: 0, mouseActionCount: 0 };
		}
		return finished;
	}

	/**
	 * Ends the running period because the application closes.
	 *
	 * @param now - The current time, in milliseconds.
	 * @returns The record of the period that ended, or `null` when no period ran.
	 */
	close(now: number): UserActivityRecord | null {
		return this.tick(now) ?? this._finish("app_closed", now);
	}

	/**
	 * Tells whether the user is active.
	 *
	 * @param now - The current time, in milliseconds.
	 * @returns True when a period runs and its cool down is not over.
	 */
	isActive(now: number): boolean {
		return this.msUntilInactive(now) > 0;
	}

	/**
	 * Gives the time left before the user is no longer active, if the user does nothing more.
	 *
	 * @param now - The current time, in milliseconds.
	 * @returns The time left, in milliseconds, or 0 when the user is not active.
	 */
	msUntilInactive(now: number): number {
		if (this._period === null) {
			return 0;
		}
		return Math.max(0, this._period.lastActionAt + this._coolDownMs - now);
	}

	/**
	 * Gives the time when the running period started.
	 *
	 * @returns The time in milliseconds since 1 January 1970, or `null` when no period runs.
	 */
	get periodStartedAt(): number | null {
		return this._period?.startedAt ?? null;
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Ends the running period and builds its record.
	 *
	 * @param endReason - The reason why the period ends.
	 * @param endedAt - The time when the period ends, in milliseconds since 1 January 1970.
	 * @returns The record of the period, or `null` when no period runs.
	 */
	private _finish(endReason: UserActivityEndReason, endedAt: number): UserActivityRecord | null {
		const period = this._period;
		this._period = null;
		if (period === null || this._workspaceFolder === null) {
			return null;
		}
		return {
			workspaceFolder: this._workspaceFolder,
			startedAt: UserActivity.formatTime(period.startedAt),
			lastActionAt: UserActivity.formatTime(period.lastActionAt),
			endedAt: UserActivity.formatTime(endedAt),
			keyboardActionCount: period.keyboardActionCount,
			mouseActionCount: period.mouseActionCount,
			endReason,
		};
	}
}
