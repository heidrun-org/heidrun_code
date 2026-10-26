// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
	PERSON_WORK_LONGEST_DAY_COUNT,
	PERSON_WORK_PERIODS,
	PersonWork,
	type PersonWorkCommit,
	type PersonWorkItems,
	type PersonWorkOpenedItem,
} from "./person_work";

/** Wednesday 14 October 2026, 15:00 in the time zone of the computer. */
const NOW = new Date(2026, 9, 14, 15, 0, 0).getTime();

/** A time of the clock of the computer, as an ISO 8601 text in UTC. `monthDay` counts from the 1st of October 2026. */
function at(monthDay: number, hour: number): string {
	return new Date(2026, 9, monthDay, hour, 0, 0).toISOString();
}

function commit(
	authorName: string,
	authorEmail: string,
	committedAt: string,
	insertions = 0,
	deletions = 0,
): PersonWorkCommit {
	return { authorName, authorEmail, committedAt, insertions, deletions };
}

function opened(author: string | null, createdAt: string): PersonWorkOpenedItem {
	return { author, createdAt };
}

function items(parts: Partial<PersonWorkItems>): PersonWorkItems {
	return { repository: "heidrun-org/heidrun", commits: [], pullRequests: [], issues: [], codeHostingError: null, ...parts };
}

describe("PersonWork.findPersons", () => {
	it("gives the same person to a commit author and to a login that differ by case, space, hyphen, and accent", () => {
		const persons = PersonWork.findPersons(
			items({
				commits: [commit("Jérôme Étienne", "jerome@example.com", at(12, 10))],
				pullRequests: [opened("jerome-etienne", at(12, 11))],
				issues: [opened("JeromeEtienne", at(13, 11))],
			}),
		);
		expect(persons).toHaveLength(1);
		expect(persons[0]).toEqual({ id: "jeromeetienne", name: "Jérôme Étienne", itemCount: 3 });
	});

	it("gives the same person to two emails with the same name", () => {
		const persons = PersonWork.findPersons(
			items({
				commits: [commit("Eric", "eric@home.example", at(12, 10)), commit("Eric", "eric@work.example", at(12, 11))],
			}),
		);
		expect(persons).toEqual([{ id: "eric", name: "Eric", itemCount: 2 }]);
	});

	it("reads the login in an email of GitHub that hides the address", () => {
		const persons = PersonWork.findPersons(
			items({
				commits: [commit("Someone Else", "12345+ada-lovelace@users.noreply.github.com", at(12, 10))],
				pullRequests: [opened("ada-lovelace", at(12, 11))],
			}),
		);
		expect(persons).toHaveLength(1);
		expect(persons[0].id).toBe("adalovelace");
		expect(persons[0].itemCount).toBe(2);
	});

	it("shows the name that is written the most often, and the login for a person with no commit", () => {
		const persons = PersonWork.findPersons(
			items({
				commits: [
					commit("JEROME ETIENNE", "jerome@example.com", at(12, 10)),
					commit("Jerome Etienne", "jerome@example.com", at(12, 11)),
					commit("Jerome Etienne", "jerome@example.com", at(12, 12)),
					commit("Jérôme Étienne", "jerome@example.com", at(12, 13)),
				],
				pullRequests: [opened("only-login", at(12, 11))],
			}),
		);
		expect(persons.map((person) => person.name)).toEqual(["Jerome Etienne", "only-login"]);
	});

	it("puts the person with the most items first, and ignores an item with no author", () => {
		const persons = PersonWork.findPersons(
			items({
				commits: [commit("Eric", "e@example.com", at(12, 10)), commit("Jerome", "j@example.com", at(12, 10))],
				pullRequests: [opened("jerome", at(12, 11)), opened(null, at(12, 11))],
			}),
		);
		expect(persons.map((person) => [person.name, person.itemCount])).toEqual([
			["Jerome", 2],
			["Eric", 1],
		]);
	});

	it("gives no person when there is no item", () => {
		expect(PersonWork.findPersons(items({}))).toEqual([]);
	});

	it("uses the email of an author whose name has no letter that a computer can read", () => {
		const persons = PersonWork.findPersons(
			items({ commits: [commit("王", "wang@example.com", at(12, 10)), commit("李", "li@example.com", at(12, 10))] }),
		);
		expect(persons.map((person) => person.id).sort()).toEqual(["li@example.com", "wang@example.com"]);
	});
});

describe("PersonWork.compute", () => {
	const sample = items({
		commits: [
			commit("Jerome Etienne", "j@example.com", at(8, 9), 10, 2),
			commit("Jerome Etienne", "j@example.com", at(14, 9), 5, 1),
			commit("Jerome Etienne", "j@example.com", at(14, 14), 3, 3),
			commit("Eric", "e@example.com", at(14, 10), 7, 0),
			commit("Jerome Etienne", "j@example.com", at(7, 23), 100, 50),
		],
		pullRequests: [opened("jeromeetienne", at(14, 11)), opened("jeromeetienne", at(10, 11)), opened("eric", at(14, 12))],
		issues: [opened("jeromeetienne", at(13, 11)), opened("jeromeetienne", at(2, 11)), opened("eric", at(13, 11))],
	});

	it("gives one slot of one day for each day of the time range by default, the last slot being today", () => {
		const result = PersonWork.compute(sample, "jeromeetienne", NOW, 7);
		expect(result.slots).toHaveLength(7);
		expect(result.slots[0].startedAt).toBe(new Date(2026, 9, 8).getTime());
		expect(result.slots[6].startedAt).toBe(new Date(2026, 9, 14).getTime());
		expect(result.slots[6].endedAt).toBe(new Date(2026, 9, 15).getTime());
	});

	it("counts the commits and the pull requests of the person in each slot", () => {
		const result = PersonWork.compute(sample, "jeromeetienne", NOW, 7);
		expect(result.slots.map((slot) => [slot.commitCount, slot.pullRequestCount])).toEqual([
			[1, 0],
			[0, 0],
			[0, 1],
			[0, 0],
			[0, 0],
			[0, 0],
			[2, 1],
		]);
	});

	it("counts the totals of the person in the time range, and nothing of another person", () => {
		const result = PersonWork.compute(sample, "jeromeetienne", NOW, 7);
		expect([result.commitCount, result.pullRequestCount, result.issueCount]).toEqual([3, 2, 1]);
		const eric = PersonWork.compute(sample, "eric", NOW, 7);
		expect([eric.commitCount, eric.pullRequestCount, eric.issueCount]).toEqual([1, 1, 1]);
	});

	it("adds the lines added and the lines deleted of the commits of the person in the time range", () => {
		const result = PersonWork.compute(sample, "jeromeetienne", NOW, 7);
		expect([result.insertionCount, result.deletionCount]).toEqual([18, 6]);
		const eric = PersonWork.compute(sample, "eric", NOW, 7);
		expect([eric.insertionCount, eric.deletionCount]).toEqual([7, 0]);
	});

	it("adds the lines added and the lines deleted of the commits of the person in each slot", () => {
		const result = PersonWork.compute(sample, "jeromeetienne", NOW, 7);
		expect(result.slots.map((slot) => [slot.insertionCount, slot.deletionCount])).toEqual([
			[10, 2],
			[0, 0],
			[0, 0],
			[0, 0],
			[0, 0],
			[0, 0],
			[8, 4],
		]);
		const eric = PersonWork.compute(sample, "eric", NOW, 7);
		expect(eric.slots.map((slot) => [slot.insertionCount, slot.deletionCount])[6]).toEqual([7, 0]);
	});

	it("gives lines in the slots that add up to the lines of the time range", () => {
		const result = PersonWork.compute(sample, "jeromeetienne", NOW, 30);
		expect(result.slots.reduce((sum, slot) => sum + slot.insertionCount, 0)).toBe(result.insertionCount);
		expect(result.slots.reduce((sum, slot) => sum + slot.deletionCount, 0)).toBe(result.deletionCount);
	});

	it("does not add the lines of a pull request, because only a commit has lines", () => {
		const result = PersonWork.compute(items({ pullRequests: [opened("eric", at(14, 12))] }), "eric", NOW, 7);
		expect(result.slots.every((slot) => slot.insertionCount === 0 && slot.deletionCount === 0)).toBe(true);
	});

	it("does not add the lines of a commit outside the time range, and adds them again for thirty days", () => {
		const sevenDays = PersonWork.compute(sample, "jeromeetienne", NOW, 7);
		const thirtyDays = PersonWork.compute(sample, "jeromeetienne", NOW, 30);
		expect([sevenDays.insertionCount, sevenDays.deletionCount]).toEqual([18, 6]);
		expect([thirtyDays.insertionCount, thirtyDays.deletionCount]).toEqual([118, 56]);
	});

	it("gives no line for a person with no commit", () => {
		const result = PersonWork.compute(items({ pullRequests: [opened("eric", at(14, 12))] }), "eric", NOW, 7);
		expect([result.insertionCount, result.deletionCount]).toEqual([0, 0]);
	});

	it("counts an item of the first day and of the last day, and no item of the day before or of the day after", () => {
		const edges = items({
			commits: [
				commit("Eric", "e@example.com", new Date(2026, 9, 7, 23, 59, 59).toISOString()),
				commit("Eric", "e@example.com", new Date(2026, 9, 8, 0, 0, 0).toISOString()),
				commit("Eric", "e@example.com", new Date(2026, 9, 14, 23, 59, 59).toISOString()),
				commit("Eric", "e@example.com", new Date(2026, 9, 15, 0, 0, 0).toISOString()),
			],
		});
		const result = PersonWork.compute(edges, "eric", NOW, 7);
		expect(result.commitCount).toBe(2);
		expect(result.slots[0].commitCount).toBe(1);
		expect(result.slots[6].commitCount).toBe(1);
	});

	it("gives thirty days for the longest time range, and counts the older items in it", () => {
		const result = PersonWork.compute(sample, "jeromeetienne", NOW, 30);
		expect(result.slots).toHaveLength(30);
		expect(result.commitCount).toBe(4);
		expect(result.pullRequestCount).toBe(2);
		expect(result.issueCount).toBe(2);
	});

	it("gives slots with no count for a person with no item, and ignores a time that is not a time", () => {
		const result = PersonWork.compute(
			items({ commits: [commit("Eric", "e@example.com", "yesterday")] }),
			"eric",
			NOW,
			7,
		);
		expect(result.commitCount).toBe(0);
		expect(result.slots.every((slot) => slot.commitCount === 0 && slot.pullRequestCount === 0)).toBe(true);
	});
});

describe("PersonWork.compute, the slot length", () => {
	const sample = items({
		commits: [
			commit("Eric", "e@example.com", at(14, 5), 1, 0),
			commit("Eric", "e@example.com", at(14, 6), 2, 0),
			commit("Eric", "e@example.com", at(14, 11), 4, 0),
			commit("Eric", "e@example.com", at(14, 12), 8, 0),
			commit("Eric", "e@example.com", at(13, 0), 16, 0),
		],
		pullRequests: [opened("eric", at(14, 13)), opened("eric", at(14, 14)), opened("eric", at(13, 23))],
		issues: [opened("eric", at(14, 7))],
	});

	it("gives four slots for each day with a slot of 6 hours, and 24 slots for each day with a slot of 1 hour", () => {
		expect(PersonWork.compute(sample, "eric", NOW, 7, 6).slots).toHaveLength(28);
		expect(PersonWork.compute(sample, "eric", NOW, 7, 1).slots).toHaveLength(168);
		expect(PersonWork.compute(sample, "eric", NOW, 7, 24).slots).toHaveLength(7);
	});

	it("adds the lines of the commits of the person in each slot of 6 hours, and the slots add up to the totals", () => {
		const result = PersonWork.compute(sample, "eric", NOW, 7, 6);
		expect(result.slots.slice(24).map((slot) => [slot.insertionCount, slot.deletionCount])).toEqual([
			[1, 0],
			[6, 0],
			[8, 0],
			[0, 0],
		]);
		expect(result.slots.reduce((sum, slot) => sum + slot.insertionCount, 0)).toBe(result.insertionCount);
	});

	it("counts the commits and the pull requests of the person in each slot of 6 hours", () => {
		const today = PersonWork.compute(sample, "eric", NOW, 7, 6).slots.slice(24);
		expect(today.map((slot) => [slot.commitCount, slot.pullRequestCount])).toEqual([
			[1, 0],
			[2, 0],
			[1, 2],
			[0, 0],
		]);
		const yesterday = PersonWork.compute(sample, "eric", NOW, 7, 6).slots.slice(20, 24);
		expect(yesterday.map((slot) => [slot.commitCount, slot.pullRequestCount])).toEqual([
			[1, 0],
			[0, 0],
			[0, 0],
			[0, 1],
		]);
	});

	it("counts a commit in the slot of 1 hour of its hour", () => {
		const slots = PersonWork.compute(sample, "eric", NOW, 7, 1).slots;
		const today = 6 * 24;
		expect(slots[today + 5].commitCount).toBe(1);
		expect(slots[today + 6].commitCount).toBe(1);
		expect(slots[today + 13].pullRequestCount).toBe(1);
		expect(slots[today + 8].commitCount).toBe(0);
	});

	it("gives the same totals for every slot length", () => {
		const totals = [1, 6, 24].map((slotHours) => {
			const result = PersonWork.compute(sample, "eric", NOW, 7, slotHours);
			return [result.commitCount, result.pullRequestCount, result.issueCount, result.insertionCount, result.deletionCount];
		});
		expect(totals[0]).toEqual([5, 3, 1, 31, 0]);
		expect(totals[1]).toEqual(totals[0]);
		expect(totals[2]).toEqual(totals[0]);
	});
});

describe("PersonWork.merge", () => {
	it("joins the commits, the pull requests, and the issues of several repositories", () => {
		const heidrun = items({
			repository: "heidrun-org/heidrun",
			commits: [commit("Jerome", "jerome@example.com", at(12, 10), 5, 1)],
			pullRequests: [opened("jerome", at(12, 11))],
		});
		const mobile = items({
			repository: "heidrun-org/mobile",
			commits: [commit("Jerome", "jerome@example.com", at(13, 10), 7, 2)],
			issues: [opened("jerome", at(13, 11))],
		});
		const merged = PersonWork.merge([heidrun, mobile]);
		expect(merged.repository).toBe("heidrun-org/heidrun, heidrun-org/mobile");
		expect(merged.commits).toHaveLength(2);
		expect(merged.pullRequests).toHaveLength(1);
		expect(merged.issues).toHaveLength(1);
		const result = PersonWork.compute(merged, PersonWork.findPersons(merged)[0].id, NOW, 7);
		expect([result.commitCount, result.insertionCount, result.deletionCount]).toEqual([2, 12, 3]);
	});

	it("counts a repository once when two workspaces read it, for example a folder and its worktree", () => {
		const one = items({ commits: [commit("Jerome", "jerome@example.com", at(12, 10), 5, 1)] });
		const merged = PersonWork.merge([one, { ...one }]);
		expect(merged.repository).toBe("heidrun-org/heidrun");
		expect(merged.commits).toHaveLength(1);
	});

	it("gives the errors of GitHub of the workspaces, each one once, or null when there is none", () => {
		const first = items({ repository: "a/a", codeHostingError: "no network" });
		const second = items({ repository: "b/b", codeHostingError: "no network" });
		const third = items({ repository: "c/c", codeHostingError: "bad token" });
		expect(PersonWork.merge([first, second, third]).codeHostingError).toBe("no network; bad token");
		expect(PersonWork.merge([items({ repository: "a/a" }), items({ repository: "b/b" })]).codeHostingError).toBeNull();
	});

	it("gives empty items when there is no workspace", () => {
		expect(PersonWork.merge([])).toEqual({ repository: "", commits: [], pullRequests: [], issues: [], codeHostingError: null });
	});
});

describe("PERSON_WORK_PERIODS", () => {
	it("has the choices of 3, 7, 14, and 30 days, from the shortest to the longest, each with the slot lengths 1 hour, 6 hours, and 1 day", () => {
		expect(Object.keys(PERSON_WORK_PERIODS)).toEqual(["three_days", "seven_days", "fourteen_days", "thirty_days"]);
		expect(Object.values(PERSON_WORK_PERIODS).map((period) => period.dayCount)).toEqual([3, 7, 14, 30]);
		for (const period of Object.values(PERSON_WORK_PERIODS)) {
			expect(period.slotHoursChoices).toEqual([1, 6, 24]);
			expect(period.defaultSlotHours).toBe(24);
		}
	});

	it("reads as many days as the longest choice", () => {
		expect(PERSON_WORK_LONGEST_DAY_COUNT).toBe(Math.max(...Object.values(PERSON_WORK_PERIODS).map((period) => period.dayCount)));
	});
});
