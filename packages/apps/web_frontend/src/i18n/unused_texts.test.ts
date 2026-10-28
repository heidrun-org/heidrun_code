// @vitest-environment node
import Fs from 'node:fs';
import Path from 'node:path';
import { describe, expect, it } from 'vitest';

const __dirname = import.meta.dirname;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	UnusedTextsTest — every text of the locale files is used by the source code
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The folder `src`, where the locale files and the source code are. */
const SOURCE_DIR = Path.resolve(__dirname, '..');

/** Helpers for the test of the unused texts. */
class UnusedTextsTestHelper {
	/**
	 * Lists the source files of the application, without the locale files and without the test files.
	 *
	 * @param folder - The folder to read.
	 * @returns The paths of the `.ts` and `.vue` files.
	 */
	static listSourceFiles(folder: string): string[] {
		const fileList: string[] = [];
		for (const entry of Fs.readdirSync(folder, { withFileTypes: true })) {
			const entryPath = Path.join(folder, entry.name);
			if (entry.isDirectory() === true) {
				if (entry.name !== 'locales') {
					fileList.push(...UnusedTextsTestHelper.listSourceFiles(entryPath));
				}
				continue;
			}
			const isSource = entry.name.endsWith('.ts') === true || entry.name.endsWith('.vue') === true;
			if (isSource === true && entry.name.endsWith('.test.ts') === false) {
				fileList.push(entryPath);
			}
		}
		return fileList;
	}

	/**
	 * Lists the full key of every text of the English locale files.
	 *
	 * @returns The keys written as `namespace.key`, for example `confirmModal.cancel`.
	 */
	static listEnglishKeys(): string[] {
		const localeDir = Path.join(SOURCE_DIR, 'i18n', 'locales', 'en');
		const keyList: string[] = [];
		for (const fileName of Fs.readdirSync(localeDir).filter((name) => name.endsWith('.json'))) {
			const namespace = fileName.slice(0, -'.json'.length);
			const texts = JSON.parse(Fs.readFileSync(Path.join(localeDir, fileName), 'utf8')) as Record<string, unknown>;
			keyList.push(...UnusedTextsTestHelper._flatten(texts, namespace));
		}
		return keyList;
	}

	/**
	 * Lists the key prefixes that the source code completes at run time, like `shortcuts.` in a template string.
	 *
	 * @param sourceText - The text of every source file, joined.
	 * @returns The prefixes, for example `format.status.`.
	 */
	static listDynamicPrefixes(sourceText: string): string[] {
		return [...sourceText.matchAll(/[`"']([A-Za-z]+(?:\.[A-Za-z_]+)*\.?)\$\{/g)].map((match) => match[1]);
	}

	/**
	 * Flattens the nested texts of a locale file into full keys.
	 *
	 * @param texts - The content of a locale file, or a part of it.
	 * @param prefix - The keys of the parents, joined with dots.
	 * @returns The full keys of the texts.
	 */
	private static _flatten(texts: Record<string, unknown>, prefix: string): string[] {
		const keyList: string[] = [];
		for (const [key, value] of Object.entries(texts)) {
			if (typeof value === 'object' && value !== null) {
				keyList.push(...UnusedTextsTestHelper._flatten(value as Record<string, unknown>, `${prefix}.${key}`));
				continue;
			}
			keyList.push(`${prefix}.${key}`);
		}
		return keyList;
	}
}

describe('the texts of the locale files', () => {
	it('are all used by the source code, with their plural forms and the keys that the code completes at run time', () => {
		const sourceText = UnusedTextsTestHelper.listSourceFiles(SOURCE_DIR)
			.map((filePath) => Fs.readFileSync(filePath, 'utf8'))
			.join('\n');
		const dynamicPrefixList = UnusedTextsTestHelper.listDynamicPrefixes(sourceText);
		const unusedKeyList = UnusedTextsTestHelper.listEnglishKeys().filter((key) => {
			const pluralBase = key.replace(/_(zero|one|two|few|many|other)$/, '');
			const isUsed = sourceText.includes(key) === true || sourceText.includes(pluralBase) === true;
			const isCompletedAtRunTime = dynamicPrefixList.some((prefix) => key.startsWith(prefix) === true);
			return isUsed === false && isCompletedAtRunTime === false;
		});
		expect(unusedKeyList).toEqual([]);
	});
});
