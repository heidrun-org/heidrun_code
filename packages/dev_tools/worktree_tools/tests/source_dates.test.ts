import Fs from 'node:fs';
import Path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SourceDates } from '../src/source_dates.ts';
import { TestRepository } from './test_repository.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Helpers
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Creates a main checkout with committed files, an old date on each of them, and a worktree.
 */
class DatedCheckouts {
	/** The old date that every file and folder of the main checkout gets. */
	static readonly oldDate = new Date('2026-01-01T00:00:00Z');

	/**
	 * Creates the main checkout with the files `packages/crate/src/lib.rs` and `packages/crate/skills/a.md`, then a
	 * worktree, then gives the files and the folders of the main checkout the old date.
	 * @returns The paths of the main checkout and of the worktree.
	 */
	static create(): { mainCheckoutPath: string; worktreePath: string } {
		const mainCheckoutPath = TestRepository.create();
		for (const relativePath of ['packages/crate/src/lib.rs', 'packages/crate/skills/a.md']) {
			Fs.mkdirSync(Path.dirname(Path.join(mainCheckoutPath, relativePath)), { recursive: true });
			Fs.writeFileSync(Path.join(mainCheckoutPath, relativePath), `content of ${relativePath}\n`);
		}
		TestRepository.git(mainCheckoutPath, ['add', '.']);
		TestRepository.git(mainCheckoutPath, ['commit', '--quiet', '-m', 'files']);
		const worktreePath = TestRepository.addWorktree(mainCheckoutPath, 'feature');
		TestRepository.setModificationTimeOfTree(Path.join(mainCheckoutPath, 'packages'), DatedCheckouts.oldDate);
		return {
			mainCheckoutPath,
			worktreePath,
		};
	}

	/**
	 * Reads the modification time of a path.
	 * @param path The absolute path.
	 * @returns The modification time in milliseconds.
	 */
	static modifiedMilliseconds(path: string): number {
		return Fs.statSync(path).mtimeMs;
	}
}

describe('SourceDates', () => {
	afterEach(() => {
		TestRepository.removeAll();
	});

	it('gives the unchanged files and folders of the worktree the dates of the main checkout', () => {
		const { mainCheckoutPath, worktreePath } = DatedCheckouts.create();
		const result = SourceDates.copyFromMainCheckout(mainCheckoutPath, worktreePath);
		expect(result.fileCount).toBeGreaterThanOrEqual(2);
		expect(result.folderCount).toBeGreaterThanOrEqual(4);
		for (const relativePath of ['packages/crate/src/lib.rs', 'packages/crate/skills/a.md', 'packages/crate/skills']) {
			expect(DatedCheckouts.modifiedMilliseconds(Path.join(worktreePath, relativePath)))
				.toBe(DatedCheckouts.oldDate.getTime());
		}
	});

	it('keeps the new date of a file whose content differs', () => {
		const { mainCheckoutPath, worktreePath } = DatedCheckouts.create();
		const changedPath = Path.join(worktreePath, 'packages/crate/src/lib.rs');
		Fs.writeFileSync(changedPath, 'changed in the worktree\n');
		SourceDates.copyFromMainCheckout(mainCheckoutPath, worktreePath);
		expect(DatedCheckouts.modifiedMilliseconds(changedPath)).not.toBe(DatedCheckouts.oldDate.getTime());
	});

	it('keeps the new date of a folder whose list of names differs', () => {
		const { mainCheckoutPath, worktreePath } = DatedCheckouts.create();
		Fs.writeFileSync(Path.join(worktreePath, 'packages/crate/skills/b.md'), 'only in the worktree\n');
		TestRepository.git(worktreePath, ['add', '.']);
		SourceDates.copyFromMainCheckout(mainCheckoutPath, worktreePath);
		expect(DatedCheckouts.modifiedMilliseconds(Path.join(worktreePath, 'packages/crate/skills')))
			.not.toBe(DatedCheckouts.oldDate.getTime());
		expect(DatedCheckouts.modifiedMilliseconds(Path.join(worktreePath, 'packages/crate/skills/a.md')))
			.toBe(DatedCheckouts.oldDate.getTime());
	});
});
