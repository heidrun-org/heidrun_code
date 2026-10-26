// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DETECTION_FAMILY_IDS } from './detection_families';
import { DetectionCatalog } from './detection_catalog';
import { DetectionPatterns } from './detection_patterns';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	DetectionCatalogTest — every example of the catalog is run through the real detection (issue #638)
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

describe('DetectionCatalog, the list of the rules', () => {
	it('has one entry for each detection family, in the order of the families', () => {
		expect(DetectionCatalog.FAMILIES.map((family) => family.id)).toEqual([...DETECTION_FAMILY_IDS]);
	});

	it('gives every rule a pattern, an example that is found, and a name that is unique inside its family', () => {
		for (const family of DetectionCatalog.FAMILIES) {
			const ruleIds = family.rules.map((rule) => rule.id);
			expect(new Set(ruleIds).size, family.id).toBe(ruleIds.length);
			for (const rule of family.rules) {
				expect(rule.patterns.length, `${family.id}/${rule.id}`).toBeGreaterThan(0);
				expect(rule.found.length, `${family.id}/${rule.id}`).toBeGreaterThan(0);
			}
		}
	});

	it('shows every regular expression of the class DetectionPatterns', () => {
		const shown = new Set<RegExp>();
		for (const family of DetectionCatalog.FAMILIES) {
			for (const rule of family.rules) {
				for (const pattern of rule.patterns) {
					shown.add(pattern.regex);
				}
			}
		}
		const hidden = Object.entries(DetectionPatterns)
			.filter(([, value]) => value instanceof RegExp && shown.has(value) === false)
			.map(([name]) => name);
		expect(hidden).toEqual([]);
	});

	it('never keeps a position in a pattern: no pattern has the flag g', () => {
		for (const [name, value] of Object.entries(DetectionPatterns)) {
			if (value instanceof RegExp) {
				expect(value.flags.includes('g'), name).toBe(false);
			}
		}
	});
});

describe('DetectionCatalog, the examples run through the real detection', () => {
	for (const family of DetectionCatalog.FAMILIES) {
		for (const rule of family.rules) {
			const options = DetectionCatalog.buildStandardOptions(rule.forge);
			for (const example of rule.found) {
				it(`${family.id} / ${rule.id} finds ${JSON.stringify(example)}`, () => {
					const check = DetectionCatalog.check(example, family.id, rule.id, options);
					expect(check.isFound).toBe(true);
				});
			}
			for (const example of rule.notFound) {
				it(`${family.id} / ${rule.id} refuses ${JSON.stringify(example)}`, () => {
					const check = DetectionCatalog.check(example, family.id, rule.id, options);
					expect(check.isFound).toBe(false);
				});
			}
		}
	}

	it('gives the text that the rule found, not the whole example', () => {
		const options = DetectionCatalog.buildStandardOptions('github');
		expect(DetectionCatalog.check('fix #12 now', 'issueReferences', 'hash', options).text).toBe('#12');
		expect(DetectionCatalog.check('See https://example.com/x.', 'webAddresses', 'address', options).text).toBe(
			'https://example.com/x',
		);
		expect(DetectionCatalog.check('● Done.\n\nShould I merge?', 'questionsAndChoices', 'question', options).text).toBe(
			'Should I merge?',
		);
	});
});
