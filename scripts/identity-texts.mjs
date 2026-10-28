// Writes the title, the motto, and the description of Heidrun Code from data/identity.json into the files that show them.
// pnpm docs:identity
import Fs from 'node:fs';
import Path from 'node:path';

const __dirname = import.meta.dirname;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	IdentityTexts — writes the identity texts of Heidrun Code into the Markdown files
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The line of a Markdown file where the generated identity texts start. */
const START = '<!-- identity:start -->';

/** The line of a Markdown file where the generated identity texts end. */
const END = '<!-- identity:end -->';

/** The line written under the start marker, to tell a reader that the text is generated. */
const GENERATED_COMMENT = '<!-- Generated from data/identity.json: pnpm docs:identity -->';

/** The root of the repository. */
const REPOSITORY_DIR = Path.resolve(__dirname, '..');

/**
 * Writes the identity texts of Heidrun Code between the two markers of each Markdown file that shows them.
 */
class IdentityTexts {
	/**
	 * Reads data/identity.json, then replaces the text between the two markers of each Markdown file.
	 *
	 * @returns Nothing. The process exits with the code 1 when a marker is missing from a file.
	 */
	static run() {
		const identity = JSON.parse(Fs.readFileSync(Path.join(REPOSITORY_DIR, 'data/identity.json'), 'utf8'));
		for (const target of IdentityTexts._listTargets(identity)) {
			IdentityTexts._writeTarget(target);
		}
	}

	/**
	 * Lists the Markdown files that show the identity texts, with the lines that go between their markers.
	 *
	 * @param identity - The content of data/identity.json.
	 * @returns One object per file: the path of the file from the root of the repository, and the lines to write.
	 */
	static _listTargets(identity) {
		const descriptionLines = [identity.description.en];
		return [
			{
				path: 'README.md',
				lines: [`# ${identity.title}`, '', `### ${identity.motto.en}`, '', `**${identity.description.en}**`],
			},
			{ path: 'AGENTS.md', lines: descriptionLines },
			{ path: 'docs/release_notes/prefix.md', lines: descriptionLines },
		];
	}

	/**
	 * Replaces the text between the two markers of one file.
	 *
	 * @param target - One file and the lines to write, as given by `_listTargets`.
	 * @returns Nothing. The process exits with the code 1 when a marker is missing from the file.
	 */
	static _writeTarget(target) {
		const filePath = Path.join(REPOSITORY_DIR, target.path);
		const content = Fs.readFileSync(filePath, 'utf8');
		const startIndex = content.indexOf(START);
		const endIndex = content.indexOf(END);
		if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
			console.error(`The markers ${START} and ${END} are missing from ${target.path}, or are in the wrong order.`);
			process.exit(1);
		}
		const generated = [START, GENERATED_COMMENT, '', ...target.lines, '', END].join('\n');
		Fs.writeFileSync(filePath, content.slice(0, startIndex) + generated + content.slice(endIndex + END.length));
		console.log(`${target.path}: the identity texts are up to date`);
	}
}

IdentityTexts.run();
