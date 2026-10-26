import Fs from 'node:fs';
import Path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CommitFileReader } from 'git_runner';
import { DinoHitsABoulderScenario } from '../src/dino_hits_a_boulder_scenario.ts';
import { ScenarioChecker } from '../src/scenario_checker.ts';

const __dirname = import.meta.dirname;
const firstFortyCommits = CommitFileReader.read(
	JSON.parse(Fs.readFileSync(Path.join(__dirname, 'fixtures/first_forty_commits.json'), 'utf8')),
).commits;
const fullCommitsPath = Path.resolve(
	__dirname,
	'../../../../submodules/heidrun_git_runner/packages/git_runner/public/commits.json',
);

describe('DinoHitsABoulderScenario', () => {
	it('survives the first five seconds, then hits a boulder inside the time window', () => {
		const scenario = DinoHitsABoulderScenario.create();
		const report = ScenarioChecker.check(scenario, firstFortyCommits);
		expect(report.endPhase).toBe('over');
		expect(report.endSeconds).toBeGreaterThanOrEqual(5);
		expect(report.endSeconds).toBeLessThanOrEqual(6);
	});

	it('shoots a rock three times and destroys it', () => {
		const scenario = DinoHitsABoulderScenario.create();
		const report = ScenarioChecker.check(scenario, firstFortyCommits);
		const eventNames = report.events.map((scenarioEvent) => scenarioEvent.event);
		expect(eventNames.filter((eventName) => eventName === 'shoot')).toHaveLength(3);
		expect(eventNames).toContain('rockDestroyed');
	});

	it('is hit at once when the dinosaur does nothing, so the checker detects a wrong scenario', () => {
		const scenario = DinoHitsABoulderScenario.create();
		scenario.timedCommands = [];
		expect(() => ScenarioChecker.check(scenario, firstFortyCommits)).toThrow(/hits at/);
	});

	it('plays the same with the whole file of commits of this repository, when the file exists', () => {
		if (Fs.existsSync(fullCommitsPath) === false) {
			return;
		}
		const scenario = DinoHitsABoulderScenario.create();
		const fullCommits = CommitFileReader.read(JSON.parse(Fs.readFileSync(fullCommitsPath, 'utf8'))).commits;
		expect(ScenarioChecker.replay(scenario, fullCommits)).toEqual(ScenarioChecker.replay(scenario, firstFortyCommits));
	});
});
