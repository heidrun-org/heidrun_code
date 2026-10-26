// @vitest-environment node
import Fs from 'node:fs';
import Path from 'node:path';
import { describe, expect, it } from 'vitest';

const __dirname = import.meta.dirname;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	DialogBoxClassTest — the boxes of the windows never use the class `modal`
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The windows that had their own box with the class `modal` before the issue 204.
 */
const WINDOW_FILE_NAME_LIST = [
	'AgentsInformationModal.vue',
	'FilesModal.vue',
	'GitModal.vue',
	'HistoryModal.vue',
	'IssueModal.vue',
	'MosaicModal.vue',
	'NewCustomLauncherModal.vue',
	'SearchModal.vue',
	'ShortcutsModal.vue',
	'SkillFileModal.vue',
];

/**
 * Helpers for the tests of the class names of the window boxes.
 */
class DialogBoxClassTestHelper {
	/**
	 * Reads the source of a component of the folder `components`.
	 *
	 * @param fileName - The name of the file, for example `ShortcutsModal.vue`.
	 * @returns The source text of the component.
	 */
	static readComponent(fileName: string): string {
		return Fs.readFileSync(Path.resolve(__dirname, 'components', fileName), 'utf8');
	}

	/**
	 * Lists the components.
	 *
	 * @returns The file names of the folder `components` that end with `.vue`.
	 */
	static listOwnComponentFileNames(): string[] {
		return Fs.readdirSync(Path.resolve(__dirname, 'components')).filter((fileName) => {
			return fileName.endsWith('.vue') === true;
		});
	}

	/**
	 * Lists every class name that the template of a component writes in a `class` attribute.
	 *
	 * @param sourceText - The source text of the component.
	 * @returns The class names, one entry for each use.
	 */
	static listTemplateClassNames(sourceText: string): string[] {
		const templateText = sourceText.split('<style')[0];
		const classNameList: string[] = [];
		for (const match of templateText.matchAll(/\sclass="([^"]*)"/g)) {
			classNameList.push(...match[1].split(/\s+/).filter((className) => className !== ''));
		}
		return classNameList;
	}

	/**
	 * Lists the selectors of the `<style>` block of a component that start with the class `modal`.
	 *
	 * @param sourceText - The source text of the component.
	 * @returns The matching selector starts, for example `.modal {`.
	 */
	static listModalStyleRules(sourceText: string): string[] {
		const styleText = sourceText.split('<style').slice(1).join('');
		return [...styleText.matchAll(/\.modal(?![\w-])[^{;]*\{/g)].map((match) => match[0]);
	}
}

describe('the boxes of the windows (issue 204: the Shortcuts window sat against the top-left corner)', () => {
	it('lists the ten windows that must not use the class modal', () => {
		for (const fileName of WINDOW_FILE_NAME_LIST) {
			expect(DialogBoxClassTestHelper.listOwnComponentFileNames()).toContain(fileName);
		}
	});

	it('no component writes the class modal in its template', () => {
		for (const fileName of DialogBoxClassTestHelper.listOwnComponentFileNames()) {
			const classNameList = DialogBoxClassTestHelper.listTemplateClassNames(
				DialogBoxClassTestHelper.readComponent(fileName),
			);
			expect({ fileName, hasModalClass: classNameList.includes('modal') }).toEqual({
				fileName,
				hasModalClass: false,
			});
		}
	});

	it('no component styles the class modal', () => {
		for (const fileName of DialogBoxClassTestHelper.listOwnComponentFileNames()) {
			const ruleList = DialogBoxClassTestHelper.listModalStyleRules(
				DialogBoxClassTestHelper.readComponent(fileName),
			);
			expect({ fileName, ruleList }).toEqual({
				fileName,
				ruleList: [],
			});
		}
	});

	it('each of the ten windows has a box with the class window-box, and styles it', () => {
		for (const fileName of WINDOW_FILE_NAME_LIST) {
			const sourceText = DialogBoxClassTestHelper.readComponent(fileName);
			expect({ fileName, isUsed: DialogBoxClassTestHelper.listTemplateClassNames(sourceText).includes('window-box') })
				.toEqual({
					fileName,
					isUsed: true,
				});
			expect({ fileName, isStyled: /^\.window-box\s*\{/m.test(sourceText) }).toEqual({
				fileName,
				isStyled: true,
			});
		}
	});
});
