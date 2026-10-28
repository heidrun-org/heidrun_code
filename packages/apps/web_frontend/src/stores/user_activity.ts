import { computed, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { UserActivity, type UserActivityActionKind, type UserActivityRecord } from "../lib/user_activity";
import { workspaceCwd } from "./project";
import { state, workspaces } from "./session";

/** The events that count as an action of the user, with the kind of action of each event. */
const ACTION_KINDS = {
	keydown: "keyboard",
	mousedown: "mouse",
	mousemove: "mouse",
	wheel: "mouse",
} as const satisfies Record<string, UserActivityActionKind>;

/** True while the window of Heidrun Code is in front and the user did an action less than the cool down ago. */
export const isUserActive = ref(false);

/** The time when the running period started, in milliseconds since 1 January 1970, or `null` when no period runs. */
export const activePeriodStartedAt = ref<number | null>(null);

/** The records of the periods that ended today, the oldest first: the ones read from the file, then the new ones. */
export const userActivityRecordsOfToday = ref<UserActivityRecord[]>([]);

/** The folder of the selected workspace, or `null` when no workspace is selected. */
export const selectedWorkspaceFolder = computed(() =>
	state.selectedWorkspaceId === null ? null : workspaceCwd(state.selectedWorkspaceId),
);

/** A workspace that is open in Heidrun Code, with the folder of its repository. */
export type OpenWorkspace = {
	/** The identifier of the workspace. */
	workspaceId: string;
	/** The name of the workspace, as the list of workspaces shows it. */
	label: string;
	/** The folder of the workspace. */
	folder: string;
};

/** The identifier of the selected workspace, or `null` when no workspace is selected. */
export const selectedWorkspaceId = computed(() => state.selectedWorkspaceId);

/** The workspaces that are open in Heidrun Code, in the order of the list of workspaces. A workspace with no known folder is left out. */
export const openWorkspaces = computed<OpenWorkspace[]>(() =>
	workspaces.value.flatMap((workspace) => {
		const folder = workspaceCwd(workspace.workspace_id);
		return folder === null ? [] : [{ workspaceId: workspace.workspace_id, label: workspace.label, folder }];
	}),
);

/** The rule that tells whether the user is active, and builds the records. `null` until `startUserActivity` runs. */
let userActivity: UserActivity | null = null;

/** The timer that checks again when the cool down ends, or `null` when no check is waiting. */
let timerId: number | null = null;

/** The time of the start of today, in the time zone of the computer, as an ISO 8601 text. */
function startOfToday(): string {
	const midnight = new Date();
	midnight.setHours(0, 0, 0, 0);
	return UserActivity.formatTime(midnight.getTime());
}

/** The text that tells two records apart. */
function recordKey(record: UserActivityRecord): string {
	return `${record.workspaceFolder}|${record.startedAt}|${record.endedAt}`;
}

/** Keeps a record that just ended: it goes to the list of today and to the file. A `null` record does nothing. */
function save(record: UserActivityRecord | null): void {
	if (record === null) {
		return;
	}
	userActivityRecordsOfToday.value = [...userActivityRecordsOfToday.value, record];
	invoke("user_activity_append", { record }).catch(() => {});
}

/** Reads the records of today from the file, and puts them before the records that ended since the start. */
async function loadRecordsOfToday(): Promise<void> {
	try {
		const fromFile = await invoke<UserActivityRecord[]>("user_activity_read", { since: startOfToday() });
		const known = new Set(fromFile.map(recordKey));
		const sinceStart = userActivityRecordsOfToday.value.filter((record) => known.has(recordKey(record)) === false);
		userActivityRecordsOfToday.value = [...fromFile, ...sinceStart];
	} catch {
		// Outside of the Tauri window, or the file cannot be read: the list keeps the new records only.
	}
}

/** Copies the state of the rule to the reactive values, and waits for the end of the cool down when a period runs. */
function refresh(): void {
	if (userActivity === null) {
		return;
	}
	timerId = null;
	const now = Date.now();
	save(userActivity.tick(now));
	isUserActive.value = userActivity.isActive(now);
	activePeriodStartedAt.value = userActivity.periodStartedAt;
	if (isUserActive.value) {
		timerId = window.setTimeout(refresh, userActivity.msUntilInactive(now));
	}
}

/** Stops the check that waits for the end of the cool down. */
function cancelTimer(): void {
	if (timerId !== null) {
		window.clearTimeout(timerId);
		timerId = null;
	}
}

/**
 * A keyboard action or a mouse action reached the window of Heidrun Code.
 *
 * @param event - The event of the action.
 */
function onAction(event: Event): void {
	if (userActivity === null) {
		return;
	}
	const kind = ACTION_KINDS[event.type as keyof typeof ACTION_KINDS];
	const now = Date.now();
	const isWindowInFront = document.hasFocus();
	save(userActivity.setWindowInFront(isWindowInFront, now));
	save(userActivity.recordAction(now, kind));
	activePeriodStartedAt.value = userActivity.periodStartedAt;
	if (isWindowInFront && timerId !== null) {
		return;
	}
	cancelTimer();
	refresh();
}

/** The window of Heidrun Code came to the front or went behind. */
function onWindowFocusChange(): void {
	if (userActivity === null) {
		return;
	}
	save(userActivity.setWindowInFront(document.hasFocus(), Date.now()));
	cancelTimer();
	refresh();
}

/** The user selected another workspace, or the folder of the selected workspace changed. */
function onWorkspaceFolderChange(folder: string | null): void {
	if (userActivity === null) {
		return;
	}
	save(userActivity.setWorkspaceFolder(folder, Date.now()));
	cancelTimer();
	refresh();
}

/** The window is going to close: the running period ends. The write is a best effort, because the page is closing. */
function onWindowClose(): void {
	if (userActivity === null) {
		return;
	}
	save(userActivity.close(Date.now()));
}

/**
 * Starts the detection of the activity of the user: listens to every keyboard action and mouse action that reach the
 * window of Heidrun Code, before any component sees them, to the focus of the window, and to the selected workspace. Each
 * active period ends with one record, which goes to the file `user_activity.jsonl` and to the list of today. The
 * status item in the macOS menu bar learns each time `isUserActive` changes. A second call does nothing.
 */
export function startUserActivity(): void {
	if (userActivity !== null) {
		return;
	}
	userActivity = new UserActivity(document.hasFocus(), selectedWorkspaceFolder.value);
	for (const eventName of Object.keys(ACTION_KINDS)) {
		window.addEventListener(eventName, onAction, { capture: true, passive: true });
	}
	window.addEventListener("focus", onWindowFocusChange);
	window.addEventListener("blur", onWindowFocusChange);
	window.addEventListener("beforeunload", onWindowClose);
	watch(selectedWorkspaceFolder, onWorkspaceFolderChange);
	watch(
		isUserActive,
		(isActive) => {
			invoke("status_item_set_user_active", { isActive }).catch(() => {});
		},
		{ immediate: true },
	);
	loadRecordsOfToday();
}
