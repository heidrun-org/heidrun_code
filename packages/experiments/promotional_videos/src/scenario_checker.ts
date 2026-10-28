import { GameSettings, GameWorld } from 'git_runner';
import type { CommitRecord } from 'git_runner';
import type { DinoRunScenario, ScenarioEvent, ScenarioReport } from './dino_run_types.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	ScenarioChecker — plays a scenario with the rules of the game, with no browser
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Plays a scenario with `GameWorld`, the same rules that the page uses, so a scenario is checked before a browser
 * records it. The page runs the rules in steps of one sixtieth of a second, and so does this class.
 */
export class ScenarioChecker {
	/** The longest replay, in seconds. A scenario that does not end before this time is a failure. */
	private static readonly _LONGEST_REPLAY_SECONDS = 30;

	/**
	 * Plays the scenario until the game stops.
	 * @param scenario The scenario.
	 * @param commits The commits of the world, from the oldest commit to the newest commit.
	 * @returns What happened.
	 */
	static replay(scenario: DinoRunScenario, commits: CommitRecord[]): ScenarioReport {
		const gameWorld = new GameWorld(scenario.seed, commits);
		gameWorld.command('start');
		const events: ScenarioEvent[] = [];
		const stepCount = Math.round(ScenarioChecker._LONGEST_REPLAY_SECONDS / GameSettings.STEP_SECONDS);
		for (let step = 0; step < stepCount; step++) {
			const timeSeconds = step * GameSettings.STEP_SECONDS;
			for (const timedCommand of scenario.timedCommands) {
				if (Math.round(timedCommand.timeSeconds / GameSettings.STEP_SECONDS) === step) {
					gameWorld.command(timedCommand.command);
				}
			}
			gameWorld.step(GameSettings.STEP_SECONDS);
			for (const event of gameWorld.takeEvents()) {
				events.push({
					timeSeconds,
					event,
				});
			}
			if (gameWorld.state.phase !== 'running') {
				const report: ScenarioReport = {
					events,
					endPhase: gameWorld.state.phase,
					endSeconds: timeSeconds,
				};
				return report;
			}
		}
		const report: ScenarioReport = {
			events,
			endPhase: gameWorld.state.phase,
			endSeconds: ScenarioChecker._LONGEST_REPLAY_SECONDS,
		};
		return report;
	}

	/**
	 * Plays the scenario and checks that it does what it promises: the dinosaur is hit inside the time window, and every
	 * required event happens.
	 * @param scenario The scenario.
	 * @param commits The commits of the world, from the oldest commit to the newest commit.
	 * @returns What happened.
	 * @throws An error that says what is wrong, when the scenario does not do what it promises.
	 */
	static check(scenario: DinoRunScenario, commits: CommitRecord[]): ScenarioReport {
		const report = ScenarioChecker.replay(scenario, commits);
		if (report.endPhase !== 'over') {
			throw new Error(`The scenario ${scenario.name} ends in the phase ${report.endPhase}, not in the phase over.`);
		}
		if (report.endSeconds < scenario.earliestHitSeconds || report.endSeconds > scenario.latestHitSeconds) {
			throw new Error(
				`The scenario ${scenario.name} hits at ${report.endSeconds.toFixed(2)} seconds, ` +
					`not between ${scenario.earliestHitSeconds} and ${scenario.latestHitSeconds} seconds.`,
			);
		}
		for (const requiredEvent of scenario.requiredEvents) {
			const isFound = report.events.some((scenarioEvent) => scenarioEvent.event === requiredEvent);
			if (isFound === false) {
				throw new Error(`The scenario ${scenario.name} never has the event ${requiredEvent}.`);
			}
		}
		return report;
	}
}
