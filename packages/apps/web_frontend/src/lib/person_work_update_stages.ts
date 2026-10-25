///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	PersonWorkUpdateStages — turns the progress reports of the update of the data layer into a list of stages to show
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Types
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The stages of the update, in the order where the command `person_work_synchronize` runs them. */
export const PERSON_WORK_UPDATE_STAGE_IDS = [
	"readCommits",
	"writeCommits",
	"readIssues",
	"writeIssues",
	"readPullRequests",
	"writePullRequests",
] as const;

/** The identifier of one stage of the update. */
export type PersonWorkUpdateStageId = (typeof PERSON_WORK_UPDATE_STAGE_IDS)[number];

/** One progress report, as the command `person_work_synchronize` sends it through its channel. */
export type PersonWorkProgress = {
	/** The repository, in the format `owner/name`. */
	repository: string;
	/** The stage that the report describes. */
	stage: PersonWorkUpdateStageId;
	/** The number of items that the stage handled. */
	doneCount: number;
	/** The number of items that the stage handles in all, or `null` when it is not known. */
	totalCount: number | null;
	/** True when the stage is done. */
	isFinished: boolean;
};

/** The last progress report of each stage of the update of one folder. A stage with no report did not start. */
export type PersonWorkUpdateReports = Partial<Record<PersonWorkUpdateStageId, PersonWorkProgress>>;

/** The state of one stage: it waits, it is in progress, or it is done. */
export type PersonWorkUpdateStageState = "waiting" | "working" | "done";

/** One stage of the update, as the tab shows it. */
export type PersonWorkUpdateStage = {
	/** The identifier of the stage. */
	id: PersonWorkUpdateStageId;
	/** The state of the stage. */
	state: PersonWorkUpdateStageState;
	/** The progress from 0 to 100 of a stage in progress whose total is known, 100 for a stage that is done, else `null`. */
	percent: number | null;
};

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	PersonWorkUpdateStages
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** Turns the progress reports of the update of one folder into the six stages that the tab shows. */
export class PersonWorkUpdateStages {
	/**
	 * Keeps a new progress report: it replaces the last report of its stage.
	 *
	 * @param reports - The last report of each stage.
	 * @param report - The new report.
	 * @returns The reports with the new report.
	 */
	static withReport(reports: PersonWorkUpdateReports, report: PersonWorkProgress): PersonWorkUpdateReports {
		return {
			...reports,
			[report.stage]: report,
		};
	}

	/**
	 * Gives the six stages, in order, with the state and the progress of each one.
	 *
	 * @param reports - The last report of each stage.
	 * @returns The six stages.
	 */
	static stagesOf(reports: PersonWorkUpdateReports): PersonWorkUpdateStage[] {
		return PERSON_WORK_UPDATE_STAGE_IDS.map((id) => {
			const report = reports[id];
			if (report === undefined) {
				return {
					id,
					state: "waiting",
					percent: null,
				};
			}
			if (report.isFinished === true) {
				return {
					id,
					state: "done",
					percent: 100,
				};
			}
			return {
				id,
				state: "working",
				percent: PersonWorkUpdateStages._percentOf(report),
			};
		});
	}

	/**
	 * Gives the repository of the reports, or `null` before the first report.
	 *
	 * @param reports - The last report of each stage.
	 * @returns The repository, in the format `owner/name`, or `null`.
	 */
	static repositoryOf(reports: PersonWorkUpdateReports): string | null {
		const report = PERSON_WORK_UPDATE_STAGE_IDS.map((id) => reports[id]).find((found) => found !== undefined);
		return report?.repository ?? null;
	}

	/**
	 * Gives the progress from 0 to 100 of a stage in progress, rounded down, or `null` when its total is not known. A total of
	 * zero items gives 0 until the stage is done.
	 *
	 * @param report - The last report of the stage.
	 * @returns The progress, or `null`.
	 */
	private static _percentOf(report: PersonWorkProgress): number | null {
		if (report.totalCount === null) {
			return null;
		}
		if (report.totalCount === 0) {
			return 0;
		}
		return Math.min(100, Math.floor((report.doneCount / report.totalCount) * 100));
	}
}
