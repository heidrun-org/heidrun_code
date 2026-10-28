// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { INSTALL_COMMANDS, MissingPrograms, type RequiredProgramsStatus } from './missing_programs';

/**
 * Builds the state of the two programs.
 *
 * @param isHerdrInstalled - True when Herdr is installed.
 * @param isNgrokInstalled - True when ngrok is installed.
 * @param isHerdrTooOld - True when the installed Herdr is older than 0.9.
 * @returns The state, as the command `required_programs_status` sends it.
 */
function statusOf(isHerdrInstalled: boolean, isNgrokInstalled: boolean, isHerdrTooOld = false): RequiredProgramsStatus {
	return {
		herdr: {
			isInstalled: isHerdrInstalled,
			isTooOld: isHerdrTooOld,
		},
		ngrok: {
			isInstalled: isNgrokInstalled,
			isTooOld: false,
		},
	};
}

describe('MissingPrograms.toShow', () => {
	it('names nothing when both programs are installed', () => {
		expect(MissingPrograms.toShow(statusOf(true, true), false)).toEqual([]);
	});

	it('names a missing Herdr at every start', () => {
		expect(MissingPrograms.toShow(statusOf(false, true), false)).toEqual(['herdr']);
		expect(MissingPrograms.toShow(statusOf(false, true), true)).toEqual(['herdr']);
	});

	it('names a Herdr older than 0.9 at every start', () => {
		expect(MissingPrograms.toShow(statusOf(true, true, true), false)).toEqual(['herdr']);
		expect(MissingPrograms.toShow(statusOf(true, true, true), true)).toEqual(['herdr']);
	});

	it('names a missing ngrok only once', () => {
		expect(MissingPrograms.toShow(statusOf(true, false), false)).toEqual(['ngrok']);
		expect(MissingPrograms.toShow(statusOf(true, false), true)).toEqual([]);
	});

	it('names Herdr first, then ngrok, when both are missing, also after the first notice of ngrok', () => {
		expect(MissingPrograms.toShow(statusOf(false, false), false)).toEqual(['herdr', 'ngrok']);
		expect(MissingPrograms.toShow(statusOf(false, false), true)).toEqual(['herdr', 'ngrok']);
	});
});

describe('INSTALL_COMMANDS', () => {
	it('gives the install command of the website of Herdr, and the Homebrew command of ngrok', () => {
		expect(INSTALL_COMMANDS.herdr).toBe('curl -fsSL https://herdr.dev/install.sh | sh');
		expect(INSTALL_COMMANDS.ngrok).toBe('brew install ngrok');
	});
});
