// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DETECTION_FAMILY_IDS, DetectionFamilies } from './detection_families';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	DetectionFamiliesTest — the switches of the detection families (issue #638)
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

describe('DetectionFamilies', () => {
	it('lists every family once', () => {
		expect(new Set(DETECTION_FAMILY_IDS).size).toBe(DETECTION_FAMILY_IDS.length);
		expect(DETECTION_FAMILY_IDS).toHaveLength(11);
	});

	it('turns every family on when nothing is switched off', () => {
		const switches = { terminalTextDetection: true, disabledDetectionFamilies: [] };
		expect([...DetectionFamilies.listEnabled(switches)]).toEqual([...DETECTION_FAMILY_IDS]);
	});

	it('turns one family off without touching the others', () => {
		const switches = { terminalTextDetection: true, disabledDetectionFamilies: ['filePaths'] };
		expect(DetectionFamilies.isEnabled(switches, 'filePaths')).toBe(false);
		expect(DetectionFamilies.isEnabled(switches, 'issueReferences')).toBe(true);
		expect(DetectionFamilies.listEnabled(switches).size).toBe(DETECTION_FAMILY_IDS.length - 1);
	});

	it('turns every family off when the whole detection is off, and keeps the list of the families', () => {
		const switches = { terminalTextDetection: false, disabledDetectionFamilies: ['filePaths'] };
		expect(DetectionFamilies.listEnabled(switches).size).toBe(0);
		expect(DetectionFamilies.isEnabled(switches, 'webAddresses')).toBe(false);
	});

	it('drops the unknown identifiers and the repeated identifiers of a saved list', () => {
		expect(DetectionFamilies.keepKnownIds(['filePaths', 'nothing', 'filePaths', 3, null])).toEqual(['filePaths']);
		expect(DetectionFamilies.keepKnownIds('filePaths')).toEqual([]);
		expect(DetectionFamilies.keepKnownIds(undefined)).toEqual([]);
	});

	it('turns a family off and on in the list, in the order of the families', () => {
		const withTickets = DetectionFamilies.withFamily([], 'tickets', false);
		const withTicketsAndWeb = DetectionFamilies.withFamily(withTickets, 'webAddresses', false);
		expect(withTicketsAndWeb).toEqual(['webAddresses', 'tickets']);
		expect(DetectionFamilies.withFamily(withTicketsAndWeb, 'tickets', true)).toEqual(['webAddresses']);
		expect(DetectionFamilies.withFamily(['webAddresses'], 'webAddresses', false)).toEqual(['webAddresses']);
	});
});
