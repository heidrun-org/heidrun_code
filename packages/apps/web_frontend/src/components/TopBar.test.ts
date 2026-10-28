import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';

let TopBar: typeof import('./TopBar.vue').default;
let session: typeof import('../stores/session');

beforeAll(async () => {
	// The theme store follows the colour scheme of the system, which jsdom does not know.
	window.matchMedia = vi.fn(() => ({
		matches: false,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
	})) as unknown as typeof window.matchMedia;
	TopBar = (await import('./TopBar.vue')).default;
	session = await import('../stores/session');
});

beforeEach(() => {
	session.state.selectedWorkspaceId = null;
	session.state.snapshot = {
		version: '1',
		protocol: 1,
		workspaces: ['heidrun', 'teamwright'].map((label, index) => ({
			workspace_id: `w${index + 1}`,
			number: index + 1,
			label,
			focused: false,
			pane_count: 0,
			tab_count: 0,
			active_tab_id: '',
			agent_status: 'idle' as const,
		})),
		tabs: [],
		panes: [],
		agents: [],
		layouts: [],
	};
});

afterEach(() => {
	session.state.selectedWorkspaceId = null;
	session.state.selectedTabId = null;
	session.state.selectedPaneId = null;
	session.state.paletteOpen = false;
	session.state.snapshot = null;
});

describe('TopBar', () => {
	it('does not show the application name Heidrun Code', () => {
		const wrapper = mount(TopBar);
		expect(wrapper.text()).not.toContain('Heidrun Code');
		wrapper.unmount();
	});

	it('shows Back and Forward in order immediately before the search button', () => {
		const wrapper = mount(TopBar);
		const back = wrapper.get('[data-direction="back"]').element;
		const forward = wrapper.get('[data-direction="forward"]').element;
		const search = wrapper.get('.search').element;
		expect(back.compareDocumentPosition(forward) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		expect(forward.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		expect(forward.parentElement?.nextElementSibling).toBe(search);
		wrapper.unmount();
	});

	it('keeps the existing menu and search controls', () => {
		const wrapper = mount(TopBar);
		expect(wrapper.find('.icon-btn').exists()).toBe(true);
		expect(wrapper.find('.search').exists()).toBe(true);
		wrapper.unmount();
	});

	it('updates the workspace name after switching workspaces and renaming the selected workspace', async () => {
		session.state.selectedWorkspaceId = 'w1';
		const wrapper = mount(TopBar);
		expect(wrapper.get('.search .workspace-name').text()).toBe('heidrun');
		expect(wrapper.get('.search').text()).not.toContain('Search, run a command');
		expect(wrapper.findAll('.workspace-name')).toHaveLength(1);
		session.state.selectedWorkspaceId = 'w2';
		await nextTick();
		expect(wrapper.get('.workspace-name').text()).toBe('teamwright');
		const label = 'A workspace with a very long name '.repeat(8);
		session.state.snapshot!.workspaces[1].label = label;
		await nextTick();
		expect(wrapper.get('.workspace-name').text()).toBe(label.trim());
		expect(wrapper.get('.workspace-name').attributes('title')).toBe(label);
		wrapper.unmount();
	});

	it('opens search when the workspace name inside the search button is clicked', async () => {
		session.state.selectedWorkspaceId = 'w1';
		const wrapper = mount(TopBar);
		await wrapper.get('.search .workspace-name').trigger('click');
		expect(session.state.paletteOpen).toBe(true);
		wrapper.unmount();
	});

	it('removes the workspace name when selection is empty or the workspace is missing', async () => {
		session.state.selectedWorkspaceId = 'w1';
		const wrapper = mount(TopBar);
		session.state.selectedWorkspaceId = null;
		await nextTick();
		expect(wrapper.find('.workspace-name').exists()).toBe(false);
		expect(wrapper.get('.search').text()).toContain('Search, run a command');
		session.state.selectedWorkspaceId = 'missing';
		await nextTick();
		expect(wrapper.find('.workspace-name').exists()).toBe(false);
		wrapper.unmount();
	});

	it('keeps the workspace name when the selected tab, pane, and terminal folder change', async () => {
		session.state.selectedWorkspaceId = 'w1';
		session.state.snapshot!.panes = [{
			pane_id: 'p1',
			terminal_id: 'terminal1',
			workspace_id: 'w1',
			tab_id: 't1',
			focused: true,
			agent_status: 'idle',
			revision: 1,
			cwd: '/work/heidrun',
		}];
		const wrapper = mount(TopBar);
		session.state.selectedTabId = 't2';
		session.state.selectedPaneId = 'p1';
		session.state.snapshot!.panes[0].cwd = '/work/teamwright';
		session.state.snapshot!.panes[0].foreground_cwd = '/work/teamwright';
		await nextTick();
		expect(wrapper.get('.workspace-name').text()).toBe('heidrun');
		wrapper.unmount();
	});
});
