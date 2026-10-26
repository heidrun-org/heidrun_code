// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';

const invokeMock = vi.hoisted(() => vi.fn(async (_command: string, _args: Record<string, unknown>): Promise<unknown> => null));
const openMock = vi.hoisted(() => vi.fn(async (_path: string) => true));

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock('../stores/file_view_panes', () => ({ FileViewPanes: { open: openMock } }));

import QuickOpenModal from './QuickOpenModal.vue';
import { quickOpen } from '../stores/quick_open';

enableAutoUnmount(afterEach);

beforeEach(() => {
	invokeMock.mockReset();
	invokeMock.mockResolvedValue({
		root: '/work/project',
		files: ['README.md', 'src/main.rs', 'src/lib/parser.rs', 'target/'],
	});
	openMock.mockClear();
	quickOpen.isOpen = true;
	quickOpen.folder = '/work/project/src';
});

function names(wrapper: ReturnType<typeof mount>): string[] {
	return wrapper.findAll('[role=option] .name').map((name) => name.text());
}

describe('QuickOpenModal (issue #898)', () => {
	it('lists the files of the project of the selected pane, with a visible label on the box', async () => {
		const wrapper = mount(QuickOpenModal, { attachTo: document.body });
		await flushPromises();
		expect(invokeMock).toHaveBeenCalledWith('files_list', { cwd: '/work/project/src', ignored: false });
		expect(names(wrapper)).toEqual(['README.md', 'main.rs', 'parser.rs']);
		expect(wrapper.get('label[for=quick-open-input]').text()).toBe('Name of the file to open');
		expect(document.activeElement).toBe(wrapper.get('input').element);
	});

	it('finds a file by a part of its name, and opens it in a file view pane with Enter', async () => {
		const wrapper = mount(QuickOpenModal);
		await flushPromises();
		await wrapper.get('input').setValue('prs');
		expect(names(wrapper)[0]).toBe('parser.rs');
		await wrapper.get('input').trigger('keydown', { key: 'Enter' });
		expect(openMock).toHaveBeenCalledWith('/work/project/src/lib/parser.rs');
		expect(quickOpen.isOpen).toBe(false);
	});

	it('moves in the list with the arrow keys, and opens the file of a click', async () => {
		const wrapper = mount(QuickOpenModal);
		await flushPromises();
		await wrapper.get('input').trigger('keydown', { key: 'ArrowDown' });
		expect(wrapper.findAll('[role=option]')[1].attributes('aria-selected')).toBe('true');
		await wrapper.findAll('[role=option]')[2].trigger('click');
		expect(openMock).toHaveBeenCalledWith('/work/project/src/lib/parser.rs');
	});

	it('says that no file matches, and closes with the key Escape', async () => {
		const wrapper = mount(QuickOpenModal);
		await flushPromises();
		await wrapper.get('input').setValue('zzzz');
		expect(wrapper.text()).toContain('No file matches "zzzz"');
		await wrapper.get('input').trigger('keydown', { key: 'Escape' });
		expect(quickOpen.isOpen).toBe(false);
		expect(openMock).not.toHaveBeenCalled();
	});
});
