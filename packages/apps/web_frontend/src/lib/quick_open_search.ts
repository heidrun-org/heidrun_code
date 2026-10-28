///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	QuickOpenSearch — finds the files of a project by a part of their name
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The largest number of files that the search by file name returns. */
const MAX_RESULTS = 80;

/**
 * Finds the files of a project by the letters of their name, in order, as the box of ⌘P does (issue #898). The letters
 * do not need to be next to each other. A "/" in the search text moves to the next folder.
 */
export class QuickOpenSearch {
	/**
	 * Gives a score to a path for a search text.
	 * @param query The search text.
	 * @param path The path of the file inside the project.
	 * @returns The score, higher for a better match, or null when the letters are not all in the path, in order. A match
	 * at the start of a word or of a folder, letters next to each other, a match in the file name, and a short path give
	 * a higher score.
	 */
	static score(query: string, path: string): number | null {
		const letters = query.toLowerCase().replace(/\s+/g, '');
		if (letters === '') {
			return 0;
		}
		const lowerPath = path.toLowerCase();
		let score = 0;
		let pathIndex = 0;
		let lastFound = -2;
		for (const letter of letters) {
			const found = lowerPath.indexOf(letter, pathIndex);
			if (found === -1) {
				return null;
			}
			const previous = lowerPath[found - 1];
			if (found === 0 || previous === '/' || previous === '-' || previous === '_' || previous === '.') {
				score += 8;
			}
			if (found === lastFound + 1) {
				score += 5;
			}
			lastFound = found;
			pathIndex = found + 1;
		}
		const fileName = lowerPath.slice(lowerPath.lastIndexOf('/') + 1);
		if (fileName.includes(letters)) {
			score += 25;
		}
		if (fileName.startsWith(letters)) {
			score += 15;
		}
		return score - lowerPath.length * 0.15;
	}

	/**
	 * Finds the files that match a search text, the best match first.
	 * @param query The search text.
	 * @param paths The paths of the files of the project. A path that ends with "/" is a folder and is skipped.
	 * @param maxResults The largest number of files to return.
	 * @returns The paths of the files that match, the best match first.
	 */
	static search(query: string, paths: string[], maxResults = MAX_RESULTS): string[] {
		const matches: { path: string; score: number }[] = [];
		for (const path of paths) {
			if (path.endsWith('/')) {
				continue;
			}
			const score = QuickOpenSearch.score(query, path);
			if (score !== null) {
				matches.push({
					path,
					score,
				});
			}
		}
		return matches
			.sort((first, second) => second.score - first.score)
			.slice(0, maxResults)
			.map((match) => match.path);
	}
}
