///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	MissingPrograms — chooses the programs that the notice of the missing programs names
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The state of one program on this computer, as the command `required_programs_status` sends it.
 */
export type ProgramStatus = {
	/** True when the program is on this computer. */
	isInstalled: boolean;
	/** True when the program is on this computer, but its version is older than the version that Heidrun Code needs. */
	isTooOld: boolean;
};

/**
 * The state of each program that Heidrun Code needs, as the command `required_programs_status` sends it.
 */
export type RequiredProgramsStatus = {
	/** Herdr: required. Heidrun Code cannot show a terminal without it. */
	herdr: ProgramStatus;
	/** ngrok: optional. Only the mobile access uses it. */
	ngrok: ProgramStatus;
};

/**
 * The name of a program that Heidrun Code needs.
 */
export type ProgramName = 'herdr' | 'ngrok';

/**
 * The install command of each program, the same in every language.
 */
export const INSTALL_COMMANDS: Record<ProgramName, string> = {
	herdr: 'curl -fsSL https://herdr.dev/install.sh | sh',
	ngrok: 'brew install ngrok',
};

/**
 * The choice of the programs that the notice of the missing programs names, at the start of Heidrun Code (issue 546).
 */
export class MissingPrograms {
	/**
	 * Chooses the programs that the notice names. A missing Herdr, or a Herdr older than 0.9, is named at every start,
	 * because Heidrun Code cannot show a terminal without it. A missing ngrok is named only once, because it is optional: the Mobile access section of the
	 * Settings window keeps the reminder after that.
	 *
	 * @param status - The state of each program.
	 * @param isNgrokNoticeShown - True when a notice already named the missing ngrok at an earlier start.
	 * @returns The programs to name, Herdr first, or an empty list when the notice must not show.
	 */
	static toShow(status: RequiredProgramsStatus, isNgrokNoticeShown: boolean): ProgramName[] {
		const programNames: ProgramName[] = [];
		if (status.herdr.isInstalled === false || status.herdr.isTooOld === true) {
			programNames.push('herdr');
		}
		if (status.ngrok.isInstalled === false && (isNgrokNoticeShown === false || programNames.length > 0)) {
			programNames.push('ngrok');
		}
		return programNames;
	}
}
