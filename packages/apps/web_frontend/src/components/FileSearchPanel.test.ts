// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';

const invokeMock = vi.hoisted(() => vi.fn(async (_command: string, _args: Record<string, unknown>): Promise<unknown> => null));
const openMock = vi.hoisted(() => vi.fn(async (_path: string, _line?: number | null) => true));

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock('../stores/file_view_panes', () => ({ FileViewPanes: { open: openMock } }));

import FileSearchPanel from './FileSearchPanel.vue';
import { fileSearch } from '../stores/file_search';
import { git, type GitStatus } from '../stores/git';
import { state } from '../stores/session';
import { settings } from '../stores/settings';

enableAutoUnmount(afterEach);

const HITS = [
	{ path: 'src/a.ts', line: 3, text: 'const value = 1;' },
	{ path: 'src/a.ts', line: 8, text: 'return value;' },
	{ path: 'README.md', line: 1, text: 'The value' },
];

beforeEach(() => {
	vi.useFakeTimers();
	invokeMock.mockReset();
	invokeMock.mockResolvedValue({ hits: HITS, truncated: false });
	openMock.mockClear();
	Object.assign(fileSearch, { query: '', root: '', hits: [], isTruncated: false, error: '', isSearching: false, foldedPaths: [] });
	settings.fileSearchMatchCase = false;
	settings.fileSearchRegularExpression = false;
	state.selectedWorkspaceId = 'w1';
	git.status = { w1: { root: '/work/project' } as GitStatus };
});

afterEach(() => {
	vi.useRealTimers();
});

async function search(wrapper: ReturnType<typeof mount>, text: string) {
	await wrapper.get('#file-search-input').setValue(text);
	vi.advanceTimersByTime(400);
	await flushPromises();
}

describe('FileSearchPanel (issue #900)', () => {
	it('has a visible label on the box and on the two options', () => {
		const wrapper = mount(FileSearchPanel);
		expect(wrapper.get('label[for=file-search-input]').text()).toBe('Text to search in the files of the project');
		expect(wrapper.get('label[for=file-search-match-case]').text()).toBe('Match case');
		expect(wrapper.get('label[for=file-search-regular-expression]').text()).toBe('Regular expression');
	});

	it('searches the repository of the selected workspace after the last key, and groups the lines by file', async () => {
		const wrapper = mount(FileSearchPanel);
		await search(wrapper, 'value');
		expect(invokeMock).toHaveBeenCalledWith('files_grep', { root: '/work/project', query: 'value', regex: false, case: false });
		expect(wrapper.text()).toContain('3 results in 2 files');
		expect(wrapper.findAll('.group-row .name').map((name) => name.text())).toEqual(['a.ts', 'README.md']);
		expect(wrapper.findAll('.hit-row mark').map((mark) => mark.text())).toEqual(['value', 'value', 'value']);
	});

	it('searches again when an option changes', async () => {
		const wrapper = mount(FileSearchPanel);
		await search(wrapper, 'value');
		await wrapper.get('#file-search-match-case').setValue(true);
		await flushPromises();
		expect(invokeMock).toHaveBeenLastCalledWith('files_grep', { root: '/work/project', query: 'value', regex: false, case: true });
		await wrapper.get('#file-search-regular-expression').setValue(true);
		await flushPromises();
		expect(invokeMock).toHaveBeenLastCalledWith('files_grep', { root: '/work/project', query: 'value', regex: true, case: true });
	});

	it('opens the file at the line of a click in a file view pane', async () => {
		const wrapper = mount(FileSearchPanel);
		await search(wrapper, 'value');
		await wrapper.findAll('.hit-row')[1].trigger('click');
		expect(openMock).toHaveBeenCalledWith('/work/project/src/a.ts', 8);
	});

	it('folds and unfolds the lines of a file with a click on the file', async () => {
		const wrapper = mount(FileSearchPanel);
		await search(wrapper, 'value');
		await wrapper.findAll('.group-row')[0].trigger('click');
		expect(wrapper.findAll('.hit-row')).toHaveLength(1);
		await wrapper.findAll('.group-row')[0].trigger('click');
		expect(wrapper.findAll('.hit-row')).toHaveLength(3);
	});

	it('asks for two characters, and says when nothing is found', async () => {
		const wrapper = mount(FileSearchPanel);
		expect(wrapper.text()).toContain('Type at least 2 characters.');
		invokeMock.mockResolvedValue({ hits: [], truncated: false });
		await search(wrapper, 'nothing');
		expect(wrapper.text()).toContain('No result.');
	});
});
