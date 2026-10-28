// The Search in files sidebar section: a text searched in all the files of the repository of the selected workspace.
// - issue #900
import { reactive } from 'vue';
import { invoke } from '@tauri-apps/api/core';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	FileSearch — searches a text in all the files of a repository
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** One line of a file that holds the searched text. */
export type FileSearchHit = {
	/** The path of the file inside the repository. */
	path: string;
	/** The number of the line, from 1. */
	line: number;
	/** The text of the line, cut after 300 characters. */
	text: string;
};

/** The answer of the backend to a search. */
type FileSearchResult = {
	/** The lines that hold the searched text. */
	hits: FileSearchHit[];
	/** True when the backend stopped after 2,000 lines. */
	truncated: boolean;
};

/** The lines of one file that hold the searched text. */
export type FileSearchGroup = {
	/** The path of the file inside the repository. */
	path: string;
	/** The lines of the file that hold the searched text. */
	hits: FileSearchHit[];
};

/** One part of the text of a line: the searched text is `match`, the text before it is `before`, the rest is `after`. */
export type FileSearchLineParts = {
	/** The text before the match, shortened at its start to 40 characters. */
	before: string;
	/** The text that matches. */
	match: string;
	/** The text after the match. */
	after: string;
};

/** The state of the Search in files sidebar section. It stays when the developer shows another sidebar section. */
export const fileSearch = reactive({
	/** The text that the developer typed. */
	query: '',
	/** The repository of the last search. */
	root: '',
	/** The lines that hold the searched text. */
	hits: [] as FileSearchHit[],
	/** True when the backend stopped after 2,000 lines. */
	isTruncated: false,
	/** The error of the last search, or an empty text. */
	error: '',
	/** True while a search runs. */
	isSearching: false,
	/** The paths of the files whose lines are folded. */
	foldedPaths: [] as string[],
});

/** The shortest search text: a search of one character finds almost every line. */
export const FILE_SEARCH_MIN_LENGTH = 2;

let searchSequence = 0;

/** Searches a text in all the files of a repository, and splits the lines of the results around the match. */
export class FileSearch {
	/**
	 * Searches the text of `fileSearch.query` in all the files of a repository. Git ignores the files of `.gitignore`,
	 * and the backend skips the binary files. An answer that comes after a newer search is dropped.
	 * @param root The folder of the repository.
	 * @param isMatchCase True to find only the text with the same upper case and lower case letters.
	 * @param isRegularExpression True when the text is a regular expression.
	 */
	static async run(root: string, isMatchCase: boolean, isRegularExpression: boolean): Promise<void> {
		const query = fileSearch.query;
		const mine = ++searchSequence;
		fileSearch.root = root;
		if (query.trim().length < FILE_SEARCH_MIN_LENGTH) {
			Object.assign(fileSearch, {
				hits: [],
				isTruncated: false,
				error: '',
				isSearching: false,
			});
			return;
		}
		fileSearch.isSearching = true;
		try {
			const result = await invoke<FileSearchResult>('files_grep', {
				root,
				query,
				regex: isRegularExpression,
				case: isMatchCase,
			});
			if (mine !== searchSequence) {
				return;
			}
			Object.assign(fileSearch, {
				hits: result.hits,
				isTruncated: result.truncated,
				error: '',
				foldedPaths: [],
			});
		} catch (error) {
			if (mine === searchSequence) {
				fileSearch.hits = [];
				fileSearch.error = String(error);
			}
		} finally {
			if (mine === searchSequence) {
				fileSearch.isSearching = false;
			}
		}
	}

	/**
	 * Groups the lines of the results by file, in the order of the backend.
	 * @param hits The lines that hold the searched text.
	 * @returns One group for each file.
	 */
	static groups(hits: FileSearchHit[]): FileSearchGroup[] {
		const groupMap = new Map<string, FileSearchHit[]>();
		for (const hit of hits) {
			groupMap.set(hit.path, [...(groupMap.get(hit.path) ?? []), hit]);
		}
		return [...groupMap.entries()].map(([path, groupHits]) => ({
			path,
			hits: groupHits,
		}));
	}

	/**
	 * Splits the text of a line around the first match, so that the match can be highlighted.
	 * @param text The text of the line.
	 * @param query The searched text.
	 * @param isMatchCase True when the case of the letters counts.
	 * @param isRegularExpression True when the searched text is a regular expression.
	 * @returns The text before the match, the match, and the text after it. The whole text is in `before` when the
	 * match cannot be found again, for example with a regular expression that JavaScript does not accept.
	 */
	static lineParts(text: string, query: string, isMatchCase: boolean, isRegularExpression: boolean): FileSearchLineParts {
		let start = -1;
		let length = 0;
		try {
			if (isRegularExpression) {
				const expression = new RegExp(query, isMatchCase ? '' : 'i');
				const found = expression.exec(text);
				if (found !== null) {
					start = found.index;
					length = found[0].length;
				}
			} else {
				start = isMatchCase ? text.indexOf(query) : text.toLowerCase().indexOf(query.toLowerCase());
				length = query.length;
			}
		} catch {
			start = -1;
		}
		if (start < 0) {
			return {
				before: text,
				match: '',
				after: '',
			};
		}
		const from = Math.max(0, start - 40);
		return {
			before: (from > 0 ? '…' : '') + text.slice(from, start),
			match: text.slice(start, start + length),
			after: text.slice(start + length),
		};
	}
}
