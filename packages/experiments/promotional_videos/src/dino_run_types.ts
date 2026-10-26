import type { GameCommand, GameEvent, GamePhase } from 'git_runner';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	DinoRunTypes — the shapes of the data of a video of the dinosaur game
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * A command of the player at one time of the run.
 */
export type TimedCommand = {
	/** The time of the command, in seconds after the key Enter that starts the run. */
	timeSeconds: number;
	/** The command that the player gives. */
	command: GameCommand;
	/** What the command shows in the video, in plain words. */
	label: string;
};

/**
 * A run of the dinosaur game that a video shows: one seed, the commands of the player, and what the run must do.
 */
export type DinoRunScenario = {
	/** The name of the scenario. It is also the name of the video file. */
	name: string;
	/** The seed of the random numbers of the world. The same seed gives the same world. */
	seed: number;
	/** The commands of the player, from the first to the last. */
	timedCommands: TimedCommand[];
	/** The earliest time of the hit, in seconds after the start of the run. A hit before this time is a failure. */
	earliestHitSeconds: number;
	/** The latest time of the hit, in seconds after the start of the run. A hit after this time is a failure. */
	latestHitSeconds: number;
	/** True when the recording turns the sound of the game on with the key M, and records the sound. */
	isSoundOn: boolean;
	/** The events that must happen during the run, for example a rock that the dinosaur destroys. */
	requiredEvents: GameEvent[];
};

/**
 * An event of the run and the time when it happened.
 */
export type ScenarioEvent = {
	/** The time of the event, in seconds after the start of the run. */
	timeSeconds: number;
	/** The event. */
	event: GameEvent;
};

/**
 * What a scenario does when the rules of the game play it without a browser.
 */
export type ScenarioReport = {
	/** The events, from the oldest to the newest. */
	events: ScenarioEvent[];
	/** The phase of the game when the replay stopped. */
	endPhase: GamePhase;
	/** The time when the replay stopped, in seconds after the start of the run. */
	endSeconds: number;
};

/**
 * A key press of the recording, with its time in the video of the browser.
 */
export type CommandPress = {
	/** The command that the key press gave. */
	command: GameCommand;
	/** What the command shows in the video, in plain words. */
	label: string;
	/** The time of the key press, in seconds after the start of the video of the browser. */
	videoSeconds: number;
};

/**
 * The sound that the page made during the recording.
 */
export type RecordedSound = {
	/** The path of the sound file, in the format WebM with the codec Opus. */
	path: string;
	/** The time when the sound recording started, in seconds after the start of the video of the browser. */
	startSeconds: number;
};

/**
 * What the recorder gives back: where the video of the browser is, and when each thing happened in this video.
 */
export type RecordingTimeline = {
	/** The path of the video of the browser, in the format WebM. */
	rawVideoPath: string;
	/** The time when the second load of the page ended, in seconds after the start of the video of the browser. */
	gameStartSeconds: number;
	/** The time when the game over card has shown for the planned time, in seconds after the start of the video. */
	gameEndSeconds: number;
	/** The key presses, from the first to the last, without the key Enter that starts the run. */
	commandPresses: CommandPress[];
	/** The sound of the page, or null when the scenario has no sound. */
	recordedSound: RecordedSound | null;
};
