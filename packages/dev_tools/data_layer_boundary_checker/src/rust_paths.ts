import type { RustPath } from './boundary_types.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	RustPaths — finds every path that starts with `crate` or with the name of a package of the data layer
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Reads the paths of a Rust file, with their groups: `use data_layer_source_control::{find_commits, Commit};` gives the two
 * paths `data_layer_source_control::find_commits` and `data_layer_source_control::Commit`.
 */
export class RustPaths {
	/**
	 * Tests whether a name is the name of a package of the data layer.
	 *
	 * @param name - The first segment of a path.
	 * @returns True for `heidrun_data` and for every name that starts with `data_layer_`, except
	 * `data_layer_operation_log`, which records the operations of the data layer and gives no data.
	 */
	static isPackageName(name: string): boolean {
		if (name === 'data_layer_operation_log') {
			return false;
		}
		return name === 'heidrun_data' || name.startsWith('data_layer_');
	}

	/**
	 * Finds the paths that start with `crate` or with the name of a package of the data layer.
	 *
	 * @param code - The code of the file, without comments and string contents.
	 * @returns The paths, each with the position where it starts.
	 */
	static find(code: string): RustPath[] {
		const paths: RustPath[] = [];
		const start = /\b(crate|heidrun_data|data_layer_[a-z_]+)\b(?=\s*(?:::|;|\s+as\b))/g;
		let match = start.exec(code);
		while (match !== null) {
			const cursor = { index: match.index };
			const texts = RustPaths._readTree(code, cursor, []);
			for (const text of texts) {
				paths.push({
					text,
					offset: match.index,
				});
			}
			start.lastIndex = Math.max(cursor.index, start.lastIndex);
			match = start.exec(code);
		}
		return paths;
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Reads a path, or a group of paths between braces, and moves the cursor after it.
	 *
	 * @param code - The code of the file.
	 * @param cursor - The position in the code. The function changes it.
	 * @param prefix - The segments that come before, when the tree is inside a group.
	 * @returns The full path of each leaf, with `::` between the segments. A glob ends with `*`.
	 */
	private static _readTree(code: string, cursor: { index: number }, prefix: string[]): string[] {
		const segments = [...prefix];
		RustPaths._skipSpaces(code, cursor);
		while (cursor.index < code.length) {
			if (code[cursor.index] === '{') {
				return RustPaths._readGroup(code, cursor, segments);
			}
			if (code[cursor.index] === '*') {
				cursor.index += 1;
				return [[...segments, '*'].join('::')];
			}
			const identifier = /[A-Za-z_][A-Za-z0-9_]*/y;
			identifier.lastIndex = cursor.index;
			const match = identifier.exec(code);
			if (match === null) {
				break;
			}
			cursor.index += match[0].length;
			const isSelfOfGroup = match[0] === 'self' && prefix.length > 0 && segments.length === prefix.length;
			if (isSelfOfGroup === false) {
				segments.push(match[0]);
			}
			const afterIdentifier = cursor.index;
			RustPaths._skipSpaces(code, cursor);
			if (code.startsWith('::', cursor.index) === false) {
				cursor.index = afterIdentifier;
				break;
			}
			cursor.index += 2;
			RustPaths._skipSpaces(code, cursor);
		}
		return [segments.join('::')];
	}

	/**
	 * Reads a group of paths between braces.
	 *
	 * @param code - The code of the file.
	 * @param cursor - The position of the opening brace. The function moves it after the closing brace.
	 * @param prefix - The segments that come before the group.
	 * @returns The full path of each leaf of the group.
	 */
	private static _readGroup(code: string, cursor: { index: number }, prefix: string[]): string[] {
		const paths: string[] = [];
		cursor.index += 1;
		while (cursor.index < code.length) {
			RustPaths._skipSpaces(code, cursor);
			if (code[cursor.index] === '}') {
				cursor.index += 1;
				return paths;
			}
			if (code[cursor.index] === ',') {
				cursor.index += 1;
				continue;
			}
			const before = cursor.index;
			paths.push(...RustPaths._readTree(code, cursor, prefix));
			RustPaths._skipAlias(code, cursor);
			if (cursor.index === before) {
				cursor.index += 1;
			}
		}
		return paths;
	}

	/**
	 * Moves the cursor after the spaces and the new lines.
	 *
	 * @param code - The code of the file.
	 * @param cursor - The position in the code. The function changes it.
	 */
	private static _skipSpaces(code: string, cursor: { index: number }): void {
		while (cursor.index < code.length && /\s/.test(code[cursor.index] ?? '')) {
			cursor.index += 1;
		}
	}

	/**
	 * Moves the cursor after `as name`, when it is there.
	 *
	 * @param code - The code of the file.
	 * @param cursor - The position in the code. The function changes it.
	 */
	private static _skipAlias(code: string, cursor: { index: number }): void {
		const alias = /\s+as\s+[A-Za-z_][A-Za-z0-9_]*/y;
		alias.lastIndex = cursor.index;
		const match = alias.exec(code);
		if (match !== null) {
			cursor.index += match[0].length;
		}
	}
}
