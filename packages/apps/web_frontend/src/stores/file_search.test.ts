// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const invokeMock = vi.hoisted(() => vi.fn(async (_command: string, _args: Record<string, unknown>): Promise<unknown> => null));
vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }));

import { FileSearch, fileSearch } from './file_search';

beforeEach(() => {
	invokeMock.mockReset();
	Object.assign(fileSearch, {
		query: '',
		root: '',
		hits: [],
		isTruncated: false,
		error: '',
		isSearching: false,
		foldedPaths: [],
	});
});

describe('FileSearch (issue #900)', () => {
	it('searches the text in the repository with the two options, and keeps the lines and the truncation', async () => {
		invokeMock.mockResolvedValue({
			hits: [{ path: 'src/a.ts', line: 3, text: 'const Value = 1;' }],
			truncated: true,
		});
		fileSearch.query = 'value';
		await FileSearch.run('/work/project', true, false);
		expect(invokeMock).toHaveBeenCalledWith('files_grep', { root: '/work/project', query: 'value', regex: false, case: true });
		expect(fileSearch.hits).toHaveLength(1);
		expect(fileSearch.isTruncated).toBe(true);
		expect(fileSearch.root).toBe('/work/project');
	});

	it('does not search a text shorter than two characters', async () => {
		fileSearch.query = 'a';
		await FileSearch.run('/work/project', false, false);
		expect(invokeMock).not.toHaveBeenCalled();
		expect(fileSearch.hits).toEqual([]);
	});

	it('keeps the error of the backend, for example a regular expression that is not valid', async () => {
		invokeMock.mockRejectedValue('search failed: invalid expression');
		fileSearch.query = '(abc';
		await FileSearch.run('/work/project', false, true);
		expect(fileSearch.error).toBe('search failed: invalid expression');
		expect(fileSearch.isSearching).toBe(false);
	});

	it('drops the answer of an older search', async () => {
		let resolveFirst: (value: unknown) => void = () => {};
		invokeMock.mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)));
		invokeMock.mockResolvedValueOnce({ hits: [{ path: 'new.ts', line: 1, text: 'new' }], truncated: false });
		fileSearch.query = 'old';
		const first = FileSearch.run('/work/project', false, false);
		fileSearch.query = 'new';
		await FileSearch.run('/work/project', false, false);
		resolveFirst({ hits: [{ path: 'old.ts', line: 1, text: 'old' }], truncated: false });
		await first;
		expect(fileSearch.hits.map((hit) => hit.path)).toEqual(['new.ts']);
	});

	it('groups the lines by file, in the order of the backend', () => {
		const groups = FileSearch.groups([
			{ path: 'b.ts', line: 1, text: 'x' },
			{ path: 'a.ts', line: 4, text: 'x' },
			{ path: 'b.ts', line: 9, text: 'x' },
		]);
		expect(groups.map((group) => [group.path, group.hits.map((hit) => hit.line)])).toEqual([
			['b.ts', [1, 9]],
			['a.ts', [4]],
		]);
	});

	it('splits a line around the match, with or without the case, and with a regular expression', () => {
		expect(FileSearch.lineParts('const Value = 1;', 'value', false, false)).toEqual({ before: 'const ', match: 'Value', after: ' = 1;' });
		expect(FileSearch.lineParts('const Value = 1;', 'value', true, false)).toEqual({ before: 'const Value = 1;', match: '', after: '' });
		expect(FileSearch.lineParts('id = 42;', '\\d+', false, true)).toEqual({ before: 'id = ', match: '42', after: ';' });
		expect(FileSearch.lineParts('abc', '(', false, true)).toEqual({ before: 'abc', match: '', after: '' });
	});

	it('shortens a long text before the match', () => {
		const parts = FileSearch.lineParts(`${'x'.repeat(100)}needle`, 'needle', false, false);
		expect(parts.before).toBe(`…${'x'.repeat(40)}`);
		expect(parts.match).toBe('needle');
	});
});
