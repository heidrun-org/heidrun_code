import Fs from 'node:fs';
import Path from 'node:path';
import { describe, expect, it } from 'vitest';

const __dirname = import.meta.dirname;
const repositoryDir = Path.join(__dirname, '../../../..');

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	MobileWordsScanner — finds the forbidden words in the files of the mobile feature
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

class MobileWordsScanner {
	/**
	 * Lists the files under a path of the repository. A path that is a file gives this one file.
	 *
	 * @param relativePath - the path of a file or of a folder, from the root of the repository
	 * @returns the absolute path of each file
	 */
	static listFiles(relativePath: string): string[] {
		const absolutePath = Path.join(repositoryDir, relativePath);
		if (Fs.statSync(absolutePath).isFile() === true) {
			return [absolutePath];
		}
		const entries = Fs.readdirSync(absolutePath, {
			recursive: true,
			withFileTypes: true,
		});
		return entries
			.filter((entry) => entry.isFile() === true)
			.map((entry) => Path.join(entry.parentPath, entry.name))
			.filter((filePath) => filePath.includes('node_modules') === false);
	}

	/**
	 * Finds each line of each file that matches the pattern.
	 *
	 * @param relativePaths - the paths of the files and of the folders to read, from the root of the repository
	 * @param pattern - the forbidden words
	 * @returns one text `file:line: text` for each line that matches
	 */
	static findLines(relativePaths: string[], pattern: RegExp): string[] {
		const matches: string[] = [];
		for (const relativePath of relativePaths) {
			for (const filePath of MobileWordsScanner.listFiles(relativePath)) {
				const lines = Fs.readFileSync(filePath, 'utf8').split('\n');
				lines.forEach((line, index) => {
					if (pattern.test(line) === true) {
						matches.push(`${Path.relative(repositoryDir, filePath)}:${index + 1}: ${line.slice(0, 120)}`);
					}
				});
			}
		}
		return matches;
	}
}

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Tests
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

const codeAndDocumentPaths = [
	'packages/auxiliary/mobile_website/src',
	'packages/auxiliary/mobile_website/dev',
	'packages/auxiliary/mobile_website/index.html',
	'packages/auxiliary/mobile_website/vite.config.ts',
	'packages/auxiliary/mobile_website/README.md',
	'packages/auxiliary/mobile_website/CONTEXT.md',
	'packages/auxiliary/mobile_server/src',
	'packages/auxiliary/mobile_server/README.md',
	'packages/auxiliary/mobile_server/CONTEXT.md',
];

const documentPaths = [
	'SECURITY.md',
	'.env.example',
	'docs/mobile_access/mobile_access.md',
	'docs/mobile_access/README.md',
	'docs/mobile_access/index.md',
	'docs/agents_rules/glossary/heidrun_code_mobile.md',
	'docs/agents_rules/user_interface/heidrun_code_mobile/screens.md',
	'packages/auxiliary/website_public/docs/features/phone_access.md',
];

describe('The words of the mobile feature', () => {
	it('never name the Mac, because the computer of the developer may be any computer', () => {
		const lines = MobileWordsScanner.findLines([...codeAndDocumentPaths, ...documentPaths], /\bMac\b/);
		expect(lines).toEqual([]);
	});

	it('never name Tailscale, because the mobile feature does not use it', () => {
		const lines = MobileWordsScanner.findLines([...codeAndDocumentPaths, ...documentPaths], /Tailscale/i);
		expect(lines).toEqual([]);
	});

	it('never name the iPhone or the iPad in the code, because the phone of the developer may be any phone', () => {
		const lines = MobileWordsScanner.findLines(codeAndDocumentPaths, /\b(iPhone|iPad)\b/);
		expect(lines).toEqual([]);
	});
});
