// @vitest-environment node
import Fs from 'node:fs';
import Path from 'node:path';
import { describe, expect, it } from 'vitest';

const __dirname = import.meta.dirname;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	ButtonRulesTest — the base look of a button is made of the Bootstrap button variables
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * One rule of a stylesheet, without nested blocks.
 */
type CssRule = {
	/** The text before the opening brace, for example `.btn:not(:hover)`. */
	selector: string;
	/** The names of the properties that the rule declares, for example `--btn-color` or `height`. */
	propertyNameList: string[];
};

/**
 * The properties that a base rule of a button may declare besides the Bootstrap button variables: what Bootstrap
 * cannot express.
 */
const ALLOWED_PROPERTY_NAME_LIST = ['height', 'display', 'align-items', 'gap', 'line-height', 'user-select'];

/**
 * Helpers for the tests of the button rules.
 */
class ButtonRulesTestHelper {
	/**
	 * Reads the rules of a stylesheet that stand at the top level. A rule inside an at-rule such as `@media` is left out.
	 *
	 * @param cssText - The stylesheet text.
	 * @returns The top-level rules, in order.
	 */
	static listTopLevelRules(cssText: string): CssRule[] {
		const textWithoutComments = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
		const ruleList: CssRule[] = [];
		let depth = 0;
		let headStart = 0;
		let bodyStart = 0;
		let head = '';
		for (let index = 0; index < textWithoutComments.length; index++) {
			const character = textWithoutComments[index];
			if (character === '{') {
				if (depth === 0) {
					head = textWithoutComments.slice(headStart, index).trim();
					bodyStart = index + 1;
				}
				depth += 1;
			} else if (character === '}') {
				depth -= 1;
				if (depth === 0) {
					headStart = index + 1;
					if (head.startsWith('@') === false) {
						const bodyText = textWithoutComments.slice(bodyStart, index);
						ruleList.push({ selector: head, propertyNameList: ButtonRulesTestHelper.listPropertyNames(bodyText) });
					}
				}
			} else if (character === ';' && depth === 0) {
				headStart = index + 1;
			}
		}
		return ruleList;
	}

	/**
	 * Lists the property names of a block of declarations.
	 *
	 * @param bodyText - The text between the braces of one rule.
	 * @returns The property names, in order.
	 */
	static listPropertyNames(bodyText: string): string[] {
		const propertyNameList: string[] = [];
		let parenthesisDepth = 0;
		let declarationStart = 0;
		for (let index = 0; index <= bodyText.length; index++) {
			const character = bodyText[index];
			if (character === '(') {
				parenthesisDepth += 1;
			} else if (character === ')') {
				parenthesisDepth -= 1;
			} else if ((character === ';' && parenthesisDepth === 0) || index === bodyText.length) {
				const declaration = bodyText.slice(declarationStart, index).trim();
				declarationStart = index + 1;
				if (declaration.includes(':')) {
					propertyNameList.push(declaration.slice(0, declaration.indexOf(':')).trim());
				}
			}
		}
		return propertyNameList;
	}

	/**
	 * Reads the text of `styles.css`.
	 *
	 * @returns The stylesheet text.
	 */
	static readStyles(): string {
		return Fs.readFileSync(Path.resolve(__dirname, 'styles.css'), 'utf8');
	}

	/**
	 * Lists the Vue components that have a button with the class `btn` in their own template.
	 *
	 * @returns The paths of the files, relative to `src`.
	 */
	static listComponentsWithButton(): string[] {
		const fileList: string[] = [];
		const visit = (directory: string): void => {
			for (const entry of Fs.readdirSync(directory, { withFileTypes: true })) {
				const path = Path.join(directory, entry.name);
				if (entry.isDirectory()) {
					visit(path);
				} else if (entry.name.endsWith('.vue')) {
					const sourceText = Fs.readFileSync(path, 'utf8');
					if (/<button[^>]*class="[^"]*\bbtn\b[^"]*"/.test(sourceText) === true) {
						fileList.push(Path.relative(__dirname, path));
					}
				}
			}
		};
		visit(Path.resolve(__dirname, 'components'));
		return fileList;
	}
}

describe('the base rules of a button in styles.css', () => {
	const baseRuleList = ButtonRulesTestHelper.listTopLevelRules(ButtonRulesTestHelper.readStyles()).filter((rule) =>
		rule.selector.split(',').every((part) => /^\.btn(:[a-z-]+(\([^)]*\))?)*$/.test(part.trim())),
	);

	it('has a rule for the class btn, which holds the Bootstrap button variables', () => {
		const rule = baseRuleList.find((item) => item.selector === '.btn');
		expect(rule).toBeDefined();
		expect(rule?.propertyNameList.filter((name) => name.startsWith('--btn-')).length).toBeGreaterThan(10);
	});

	it('declares nothing but the Bootstrap button variables, the height, the display, the alignment, the gap, the line height, and the text selection', () => {
		const offenderList: string[] = [];
		for (const rule of baseRuleList) {
			for (const name of rule.propertyNameList) {
				if (name.startsWith('--btn-') === false && ALLOWED_PROPERTY_NAME_LIST.includes(name) === false) {
					offenderList.push(`${rule.selector} { ${name} }`);
				}
			}
		}
		expect(offenderList).toEqual([]);
	});

	it('has no rule for the hover of the class btn, because the hover comes from the Bootstrap variables', () => {
		expect(baseRuleList.map((rule) => rule.selector)).not.toContain('.btn:hover');
	});

	it('keeps the global rule of the element button away from a button that has the class btn', () => {
		const ruleList = ButtonRulesTestHelper.listTopLevelRules(ButtonRulesTestHelper.readStyles()).filter(
			(rule) => rule.selector.startsWith('button'),
		);
		expect(ruleList.map((rule) => rule.selector)).toEqual(['button:where(:not(.btn))']);
	});
});

describe('the reset of the element button in a component that has a button with the class btn', () => {
	it('leaves the button that has the class btn to Bootstrap, because a rule without a layer always wins over Bootstrap', () => {
		const offenderList: string[] = [];
		for (const file of ButtonRulesTestHelper.listComponentsWithButton()) {
			const sourceText = Fs.readFileSync(Path.resolve(__dirname, file), 'utf8');
			if (/^:where\(button\)/m.test(sourceText) === true) {
				offenderList.push(file);
			}
		}
		expect(offenderList).toEqual([]);
	});
});
