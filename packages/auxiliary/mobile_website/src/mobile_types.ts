///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Mobile types — the shapes of the answers of the mobile server
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The status of one coding agent, as the desktop application reports it. */
export type AgentStatus = 'blocked' | 'working' | 'done' | 'idle' | 'unknown';

/** One choice of the menu that blocks a coding agent. */
export type MenuOption = {
	/** The number that the coding agent shows for the choice. */
	n: number;
	/** The text of the choice. */
	label: string;
};

/** The menu that blocks a coding agent: a question, the command that the question is about, and the choices. */
export type AgentMenu = {
	/** The question of the menu, or null when the coding agent shows none. */
	question: string | null;
	/** The command or the file that the question is about, or null. */
	detail: string | null;
	/** The choices of the menu. */
	options: MenuOption[];
};

/** One pane: it runs a coding agent, or it is a plain terminal that the phone only reads. */
export type AgentView = {
	/** The identifier of the pane. */
	paneId: string;
	/** True when a coding agent runs in the pane. False for a plain terminal, which the phone only reads. */
	hasCodingAgent: boolean;
	/** The name of the coding agent, for example Claude Code. */
	name: string;
	/** The kind of the coding agent. */
	kind: string;
	/** The label of the workspace that holds the pane. */
	workspace: string;
	/** The label of the tab that holds the pane. */
	tab: string;
	/** The status of the coding agent. */
	status: AgentStatus;
	/** The time of the last change of the status, in milliseconds since 1970, or null. */
	since: number | null;
	/** The question that the coding agent asked, or null. */
	question: string | null;
	/** The percent of the context window that the coding agent used, or null. */
	context: number | null;
	/** The menu that blocks the coding agent, or null. */
	menu: AgentMenu | null;
};

/** One workspace and the coding agents that run in its panes. */
export type WorkspaceView = {
	/** The identifier of the workspace. */
	id: string;
	/** The label of the workspace. */
	label: string;
	/** The coding agents of the workspace. */
	agents: AgentView[];
};

/** One usage limit of a coding agent provider. */
export type QuotaView = {
	/** The name of the limit, for example "5-hour limit". */
	name: string;
	/** The percent of the limit that is used. */
	percent: number;
};

/** The answer of the method `state`: everything that the first screens show. */
export type Snapshot = {
	/** The time of the computer when it made the answer, in milliseconds since 1970. */
	now: number;
	/** True when the setting of Heidrun Code on the computer lets the phone type in a plain terminal. */
	terminalTypingAllowed: boolean;
	/** The identifiers of the panes that wait for the developer. */
	attention: string[];
	/** The workspaces, with their coding agents. */
	workspaces: WorkspaceView[];
	/** The usage limits. */
	quotas: QuotaView[];
};

/** What the page knows about the notifications of the phone. */
export type NotificationStatus = {
	/** True when the page runs on a secure address: `https`, or the address of the same device. */
	isSecure: boolean;
	/** True when the browser has the service workers and the notifications. */
	isSupported: boolean;
	/** The service worker: not registered yet, registered, or failed. */
	worker: 'not-registered' | 'registered' | 'failed';
	/** The permission that the developer gave, or `unsupported` when the browser has no notifications. */
	permission: NotificationPermission | 'unsupported';
	/** The push from the computer: `off` until the developer turns it on, `on` when the computer knows this phone. */
	push: 'off' | 'on' | 'failed';
	/** The text of the last error of the service worker or of the push, or null. */
	error: string | null;
};

/**
 * What the developer can do to type in a plain terminal. `off`: the setting of Heidrun Code on the computer forbids it.
 * `locked`: the setting allows it, and the developer must say yes first. `unlocked`: the developer said yes for the
 * terminal that is open.
 */
export type TerminalTyping = 'off' | 'locked' | 'unlocked';

/** A command that the guards of Heidrun Code want the developer to check once more. */
export type ConfirmRequest = {
	/** The command, as the computer shows it now. */
	command: string;
	/** Why the guards stopped the command. */
	why: string;
};

/** The answer of the methods `read`, `answer`, `prompt`, `keys`, and `launch`. */
export type CallResult = {
	/** A text for the developer, when the call did not work. */
	error?: string;
	/** A command to check once more, when the guards stopped the call. */
	confirm?: ConfirmRequest;
	/** True when the call worked. */
	ok?: boolean;
	/** The end of the output of a pane, for the method `read`. */
	text?: string;
	/** The public key of the computer for the push, for the method `pushKey`: URL-safe base 64. */
	key?: string;
};

/** One macro: a text that the page writes into the field for a prompt of one pane, like the keyboard. */
export type MacroView = {
	/** The identifier of the macro, unique in its source. */
	id: string;
	/** The name of the macro. */
	label: string;
	/** One short line that says what the macro does. It can be empty. */
	description: string;
	/** Where the macro comes from: the macros of the developer, or the file `.heidrun/config.json` of the project. */
	source: 'personal' | 'project';
	/** The text of the macro, with its variables replaced for the pane by the computer. */
	text: string;
};

/** The answer of the method `macros`. */
export type MacrosAnswer = {
	/** The personal macros, then the macros of the project of the workspace of the pane. */
	macros: MacroView[];
};

/** The status of one launcher: never run, its command runs now, or its command finished. */
export type LauncherStatus = 'idle' | 'running' | 'finished';

/** One launcher: a command of a project that runs in its own tab. */
export type LauncherView = {
	/** The identifier of the launcher, unique in its project. */
	id: string;
	/** The name of the launcher. */
	label: string;
	/** What the launcher does, or null when the launcher has no description. */
	description: string | null;
	/** The command line of the launcher. */
	command: string;
	/** The status of the launcher. */
	status: LauncherStatus;
};

/** One workspace and the launchers of its project. */
export type LauncherWorkspaceView = {
	/** The identifier of the workspace. */
	id: string;
	/** The label of the workspace. */
	label: string;
	/** Why the file `.heidrun/config.json` of the project cannot be read, or null. */
	error: string | null;
	/** The launchers of the project. */
	launchers: LauncherView[];
};

/** The answer of the method `launchers`. */
export type LaunchersAnswer = {
	/** The workspaces whose project has a launcher. */
	workspaces: LauncherWorkspaceView[];
};

/**
 * The screens that the address of the page names, except the screen of one pane: the welcome page, and the four
 * screens that the bottom bar opens. The welcome page has no button in the bottom bar.
 */
export type TabName = 'welcome' | 'dashboard' | 'needs_you' | 'panes' | 'launchers';

/** Every screen: the four screens of the bottom bar, and the screen of one pane. */
export type ScreenName = TabName | 'pane';
