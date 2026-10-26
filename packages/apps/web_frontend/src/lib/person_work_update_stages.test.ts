// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
	PersonWorkUpdateStages,
	type PersonWorkProgress,
	type PersonWorkUpdateReports,
	type PersonWorkUpdateStageId,
} from "./person_work_update_stages";

function report(
	stage: PersonWorkUpdateStageId,
	doneCount: number,
	totalCount: number | null,
	isFinished = false,
): PersonWorkProgress {
	return {
		repository: "heidrun-org/heidrun_code",
		stage,
		doneCount,
		totalCount,
		isFinished,
	};
}

describe("PersonWorkUpdateStages", () => {
	it("shows the six stages as waiting before the first report", () => {
		const stages = PersonWorkUpdateStages.stagesOf({});
		expect(stages.map((stage) => stage.id)).toEqual([
			"readCommits",
			"writeCommits",
			"readIssues",
			"writeIssues",
			"readPullRequests",
			"writePullRequests",
		]);
		expect(stages.every((stage) => stage.state === "waiting" && stage.percent === null)).toBe(true);
		expect(PersonWorkUpdateStages.repositoryOf({})).toBeNull();
	});

	it("shows a done stage with 100, the stage in progress with its percent, and the next stages as waiting", () => {
		let reports: PersonWorkUpdateReports = {};
		reports = PersonWorkUpdateStages.withReport(reports, report("readCommits", 0, 4000));
		reports = PersonWorkUpdateStages.withReport(reports, report("readCommits", 4000, 4000, true));
		reports = PersonWorkUpdateStages.withReport(reports, report("writeCommits", 4000, 4000, true));
		reports = PersonWorkUpdateStages.withReport(reports, report("readIssues", 100, 300));
		const stages = PersonWorkUpdateStages.stagesOf(reports);
		expect(stages.map((stage) => [stage.state, stage.percent])).toEqual([
			["done", 100],
			["done", 100],
			["working", 33],
			["waiting", null],
			["waiting", null],
			["waiting", null],
		]);
		expect(PersonWorkUpdateStages.repositoryOf(reports)).toBe("heidrun-org/heidrun_code");
	});

	it("shows a stage in progress with no percent when its total is not known, and 0 for a total of zero items", () => {
		const unknown = PersonWorkUpdateStages.stagesOf({
			readIssues: report("readIssues", 100, null),
		});
		expect(unknown[2]).toEqual({
			id: "readIssues",
			state: "working",
			percent: null,
		});
		const empty = PersonWorkUpdateStages.stagesOf({
			readCommits: report("readCommits", 0, 0),
		});
		expect(empty[0]?.percent).toBe(0);
	});

	it("never gives more than 100", () => {
		const stages = PersonWorkUpdateStages.stagesOf({
			readIssues: report("readIssues", 120, 100),
		});
		expect(stages[2]?.percent).toBe(100);
	});
});
