import Fs from 'node:fs';
import Path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_GUARDS } from './guards';
import { parseProjectConfig } from './project_config';
import GUARDS_TEXTS from '../i18n/locales/en/guards.json';

const __dirname = import.meta.dirname;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	GuardsDocumentTest — the document of the guards lists every built-in guard
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Reads the table of the built-in guards in the document of the guards.
 */
class GuardsDocumentTest {
	/** The path of the document of the guards, from this test file. */
	static readonly DOCUMENT_PATH = Path.resolve(__dirname, '../../../../../docs/architecture/guards.md');

	/**
	 * Reads the rows of the table of the built-in guards.
	 *
	 * @returns a map from the translation key of each row to the reason written in the row
	 */
	static readTableRows(): Map<string, string> {
		const documentText = Fs.readFileSync(GuardsDocumentTest.DOCUMENT_PATH, 'utf8');
		const rowMap = new Map<string, string>();
		for (const line of documentText.split('\n')) {
			const match = /^\| `(guards\.why\.\w+)` \| ([^|]+) \|/.exec(line);
			if (match === null) {
				continue;
			}
			rowMap.set(match[1], match[2].trim());
		}
		return rowMap;
	}

	/**
	 * Reads the third column of the table of the built-in guards: the commands that each guard stops.
	 *
	 * @returns a map from the translation key of each row to the text of the third column
	 */
	static readTableCommands(): Map<string, string> {
		const documentText = Fs.readFileSync(GuardsDocumentTest.DOCUMENT_PATH, 'utf8');
		const commandMap = new Map<string, string>();
		for (const line of documentText.split('\n')) {
			const match = /^\| `(guards\.why\.\w+)` \| [^|]+ \| (.+) \|$/.exec(line);
			if (match === null) {
				continue;
			}
			commandMap.set(match[1], match[2].trim());
		}
		return commandMap;
	}
}

describe('the document of the guards', () => {
	const rowMap = GuardsDocumentTest.readTableRows();

	it('has an example of the file .heidrun/config.json that the schema accepts, and that turns off a built-in guard', () => {
		const documentText = Fs.readFileSync(GuardsDocumentTest.DOCUMENT_PATH, 'utf8');
		const exampleMatch = /```json\n([\s\S]*?)\n```/.exec(documentText);
		expect(exampleMatch).not.toBeNull();
		const config = parseProjectConfig(JSON.parse(exampleMatch?.[1] ?? '{}'));
		const keyList = DEFAULT_GUARDS.map((guard) => {
			return guard.whyKey;
		});
		expect(config.guards?.disabled?.length).toBeGreaterThan(0);
		for (const key of config.guards?.disabled ?? []) {
			expect(keyList).toContain(key);
		}
	});

	it('has one row for each built-in guard, in the order of the list', () => {
		const keyList = DEFAULT_GUARDS.map((guard) => {
			return guard.whyKey;
		});
		expect([...rowMap.keys()]).toEqual(keyList);
	});

	it('writes the commands that the Guards section shows for each built-in guard', () => {
		const commandMap = GuardsDocumentTest.readTableCommands();
		const textMap = GUARDS_TEXTS as Record<string, string>;
		for (const guard of DEFAULT_GUARDS) {
			const textKey = guard.whatKey.replace(/^guards\./, '');
			expect(commandMap.get(guard.whyKey), guard.whyKey).toBe(textMap[textKey]);
		}
	});

	it('writes the reason that Heidrun Code shows for each built-in guard', () => {
		const textMap = GUARDS_TEXTS as Record<string, string>;
		for (const guard of DEFAULT_GUARDS) {
			const textKey = guard.whyKey.replace(/^guards\./, '');
			expect(rowMap.get(guard.whyKey), guard.whyKey).toBe(textMap[textKey]);
		}
	});
});
