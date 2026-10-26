import Fs from 'node:fs';
import Path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SiteFiles } from './site_files';

/** The command that removes the quarantine mark from Heidrun Code, as the issue 514 gives it. */
const quarantineCommand = 'xattr -dr com.apple.quarantine "/Applications/Heidrun Code.app"';

/** The command that installs Heidrun Code with no quarantine mark, as the issue 515 gives it. */
const installCommand =
	'curl -fsSL https://raw.githubusercontent.com/heidrun-org/heidrun_code/main/scripts/install.sh | sh';

/** The developer documents that must give the quarantine command, relative to the root of the repository. */
const filesWithCommand = ['README_DEV.md', 'HOW_TO_RELEASE.md'];

const prefix = Fs.readFileSync(Path.join(SiteFiles.repositoryDir, 'docs/release_notes/prefix.md'), 'utf8');

describe('macOS message "Heidrun Code is damaged"', () => {
	for (const filePath of filesWithCommand) {
		it(`is solved by the command of the issue 514 in ${filePath}`, () => {
			const text = Fs.readFileSync(Path.join(SiteFiles.repositoryDir, filePath), 'utf8');
			expect(text).toContain(quarantineCommand);
		});
	}

	it('is not mentioned in the text of every GitHub release', () => {
		expect(prefix).not.toContain('damaged');
		expect(prefix).not.toContain('quarantine');
		expect(prefix).not.toContain('xattr');
	});

	it('is avoided by the installation command in the text of every GitHub release', () => {
		expect(prefix).toContain(installCommand);
		expect(prefix).toContain('macOS opens Heidrun Code with no message.');
	});
});
