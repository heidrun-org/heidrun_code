///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	DetectionFamilies — the one list of what Heidrun Code finds in the text of a terminal
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The identifiers of the detection families, in the order of the Settings window. A detection family is a group of rules
 * that find one sort of thing in the text of a terminal, and that the developer turns on or off as one. A new sort of
 * detection starts here: add its identifier to this list, and the Settings window, the sample field, and the tests follow.
 */
export const DETECTION_FAMILY_IDS = [
	'webAddresses',
	'issueReferences',
	'requestReferences',
	'tickets',
	'commits',
	'filePaths',
	'shellCommands',
	'slashCommands',
	'numberedSteps',
	'agentList',
	'questionsAndChoices',
] as const;

/** The identifier of one detection family. */
export type DetectionFamilyId = (typeof DETECTION_FAMILY_IDS)[number];

/** The two settings that decide which detection families are on. */
export type DetectionSwitches = {
	/** True when the automatic detection in the text of the terminals is on. False turns every detection family off. */
	terminalTextDetection: boolean;
	/** The identifiers of the detection families that the developer turned off. A family that is not listed is on. */
	disabledDetectionFamilies: readonly string[];
};

/** Reads the switches of the detection families. */
export class DetectionFamilies {
	/**
	 * Tells whether one detection family is on.
	 *
	 * @param switches - The two settings that decide which detection families are on.
	 * @param familyId - The identifier of the detection family.
	 * @returns True when the automatic detection is on and the family is not in the list of the families that are off.
	 */
	static isEnabled(switches: DetectionSwitches, familyId: DetectionFamilyId): boolean {
		if (switches.terminalTextDetection === false) {
			return false;
		}
		return switches.disabledDetectionFamilies.includes(familyId) === false;
	}

	/**
	 * Lists the detection families that are on.
	 *
	 * @param switches - The two settings that decide which detection families are on.
	 * @returns The identifiers of the families that are on. The set is empty when the automatic detection is off.
	 */
	static listEnabled(switches: DetectionSwitches): ReadonlySet<DetectionFamilyId> {
		const enabledFamilyIds = new Set<DetectionFamilyId>();
		for (const familyId of DETECTION_FAMILY_IDS) {
			if (DetectionFamilies.isEnabled(switches, familyId) === true) {
				enabledFamilyIds.add(familyId);
			}
		}
		return enabledFamilyIds;
	}

	/**
	 * Keeps the identifiers of a saved list that name a detection family, once each, and drops the others.
	 *
	 * @param value - The saved list, whatever it holds.
	 * @returns The identifiers of the detection families that the list names, in the order of the list.
	 */
	static keepKnownIds(value: unknown): DetectionFamilyId[] {
		if (Array.isArray(value) === false) {
			return [];
		}
		const knownFamilyIds: DetectionFamilyId[] = [];
		for (const entry of value as unknown[]) {
			const isKnown = (DETECTION_FAMILY_IDS as readonly unknown[]).includes(entry);
			if (isKnown === true && knownFamilyIds.includes(entry as DetectionFamilyId) === false) {
				knownFamilyIds.push(entry as DetectionFamilyId);
			}
		}
		return knownFamilyIds;
	}

	/**
	 * Turns one detection family on or off, in the list of the families that are off.
	 *
	 * @param disabledFamilyIds - The identifiers of the families that are off now.
	 * @param familyId - The identifier of the family to change.
	 * @param isEnabled - True to turn the family on, false to turn it off.
	 * @returns The new list of the families that are off, in the order of `DETECTION_FAMILY_IDS`.
	 */
	static withFamily(
		disabledFamilyIds: readonly string[],
		familyId: DetectionFamilyId,
		isEnabled: boolean,
	): DetectionFamilyId[] {
		const remainingFamilyIds = DetectionFamilies.keepKnownIds(disabledFamilyIds).filter((id) => id !== familyId);
		if (isEnabled === false) {
			remainingFamilyIds.push(familyId);
		}
		return DETECTION_FAMILY_IDS.filter((id) => remainingFamilyIds.includes(id) === true);
	}
}
