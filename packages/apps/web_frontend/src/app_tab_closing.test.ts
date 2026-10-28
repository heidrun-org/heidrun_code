import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, shallowMount } from '@vue/test-utils';
import type { SessionSnapshot } from './lib/types';

vi.mock('@tauri-apps/api/event', () => ({
	listen: vi.fn(async () => () => {}),
}));
vi.mock('./components/TerminalView.vue', () => ({
	default: {
		render: () => null,
	},
}));
vi.mock('@tauri-apps/api/webview', () => ({
	getCurrentWebview: () => ({
		onDragDropEvent: vi.fn(async () => () => {}),
	}),
}));
vi.mock('./stores/session', async (importOriginal) => ({
	...(await importOriginal<typeof import('./stores/session')>()),
	start: vi.fn(),
}));
vi.mock('./stores/project', async (importOriginal) => ({
	...(await importOriginal<typeof import('./stores/project')>()),
	startProjects: vi.fn(),
}));
vi.mock('./stores/git', async (importOriginal) => ({
	...(await importOriginal<typeof import('./stores/git')>()),
	startGit: vi.fn(),
}));
vi.mock('./stores/alerts', async (importOriginal) => ({
	...(await importOriginal<typeof import('./stores/alerts')>()),
	startAlerts: vi.fn(),
}));
vi.mock('./stores/statusItem', async (importOriginal) => ({
	...(await importOriginal<typeof import('./stores/statusItem')>()),
	startStatusItem: vi.fn(),
}));
vi.mock('./stores/history', async (importOriginal) => ({
	...(await importOriginal<typeof import('./stores/history')>()),
	loadHistory: vi.fn(),
}));
vi.mock('./stores/mobile', async (importOriginal) => ({
	...(await importOriginal<typeof import('./stores/mobile')>()),
	startMobile: vi.fn(),
}));
vi.mock('./stores/claude', async (importOriginal) => ({
	...(await importOriginal<typeof import('./stores/claude')>()),
	loadClaudeLink: vi.fn(),
	startRemoteWatch: vi.fn(),
}));
vi.mock('./lib/api', async (importOriginal) => ({
	...(await importOriginal<typeof import('./lib/api')>()),
	closeTab: vi.fn(async () => ({})),
	closePane: vi.fn(async () => ({})),
}));

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	TabClosingTest — exercises tab closing through the application's keyboard listener
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** Mounts the application and sends the tab closing shortcut. */
class TabClosingTest {
	/** The application mounted by the current test. */
	static wrapper: ReturnType<typeof shallowMount> | null = null;

	/**
	 * Mounts two workspaces, with two tabs in the first workspace and one tab in the second workspace.
	 * @returns the real session store and the recorded application calls
	 */
	static async mount() {
		window.matchMedia = vi.fn(() => ({
			matches: false,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		})) as unknown as typeof window.matchMedia;
		const session = await import('./stores/session');
		const api = await import('./lib/api');
		const { default: App } = await import('./App.vue');
		session.state.snapshot = {
			workspaces: ['w1', 'w2'].map((workspaceId) => ({
				workspace_id: workspaceId,
			})),
			tabs: ['t1', 't2', 't3'].map((tabId, index) => ({
				tab_id: tabId,
				workspace_id: index < 2 ? 'w1' : 'w2',
				label: tabId,
			})),
			panes: ['p1', 'p2', 'p3'].map((paneId, index) => ({
				pane_id: paneId,
				tab_id: `t${index + 1}`,
				workspace_id: index < 2 ? 'w1' : 'w2',
			})),
			agents: [],
			layouts: [],
		} as unknown as SessionSnapshot;
		session.state.selectedWorkspaceId = 'w1';
		session.state.selectedTabId = 't1';
		session.state.selectedPaneId = 'p1';
		session.state.toast = '';
		TabClosingTest.wrapper = shallowMount(App);
		await flushPromises();
		return {
			session,
			api,
		};
	}

	/**
	 * Sends a closing shortcut to the application's actual keyboard listener.
	 * @param options - keyboard event properties to override
	 * @returns the keyboard event after the application handles the shortcut
	 */
	static press(options: KeyboardEventInit = {}): KeyboardEvent {
		const event = new KeyboardEvent('keydown', {
			key: 'w',
			code: 'KeyW',
			metaKey: true,
			bubbles: true,
			cancelable: true,
			...options,
		});
		window.dispatchEvent(event);
		return event;
	}
}

beforeEach(async () => {
	vi.clearAllMocks();
	vi.spyOn(Date, 'now').mockReturnValue(1000);
	const { settings } = await import('./stores/settings');
	const { confirmDialog } = await import('./stores/confirm');
	settings.confirmTabClose = false;
	confirmDialog.open = false;
});

afterEach(() => {
	TabClosingTest.wrapper?.unmount();
	TabClosingTest.wrapper = null;
	vi.restoreAllMocks();
});

describe('Command-W twice tab closing', () => {
	it.each([false, true])('requires two presses with confirmation set to %s', async (isConfirmRequired) => {
		const { session, api } = await TabClosingTest.mount();
		const { settings } = await import('./stores/settings');
		const { confirmDialog } = await import('./stores/confirm');
		settings.confirmTabClose = isConfirmRequired;
		expect(TabClosingTest.press().defaultPrevented).toBe(true);
		await flushPromises();
		expect(api.closeTab).not.toHaveBeenCalled();
		expect(api.closePane).not.toHaveBeenCalled();
		expect(confirmDialog.open).toBe(false);
		expect(session.state.toast).toBe('Press ⌘W again to close this tab');
		TabClosingTest.press();
		await flushPromises();
		expect(api.closeTab).toHaveBeenCalledWith('t1');
		expect(api.closePane).not.toHaveBeenCalled();
		expect(confirmDialog.open).toBe(false);
	});

	it.each([false, true])('refuses the last tab with confirmation set to %s', async (isConfirmRequired) => {
		const { session, api } = await TabClosingTest.mount();
		const { settings } = await import('./stores/settings');
		const { confirmDialog } = await import('./stores/confirm');
		settings.confirmTabClose = isConfirmRequired;
		session.state.selectedWorkspaceId = 'w2';
		session.state.selectedTabId = 't3';
		session.state.selectedPaneId = 'p3';
		TabClosingTest.press();
		TabClosingTest.press();
		await flushPromises();
		expect(api.closeTab).not.toHaveBeenCalled();
		expect(api.closePane).not.toHaveBeenCalled();
		expect(confirmDialog.open).toBe(false);
		expect(session.state.toast).toBe('You cannot close the last tab of a workspace.');
		expect(session.state.toastKind).toBe('error');
	});

	it('closes the whole selected tab when the selected tab has several panes', async () => {
		const { session, api } = await TabClosingTest.mount();
		const snapshot = session.state.snapshot!;
		snapshot.panes.push({
			...snapshot.panes[0],
			pane_id: 'p4',
		});
		session.state.selectedPaneId = 'p4';
		TabClosingTest.press();
		TabClosingTest.press();
		await flushPromises();
		expect(api.closeTab).toHaveBeenCalledWith('t1');
		expect(api.closePane).not.toHaveBeenCalled();
	});

	it('requires a new pair of presses after two seconds', async () => {
		const { api } = await TabClosingTest.mount();
		TabClosingTest.press();
		vi.mocked(Date.now).mockReturnValue(3000);
		TabClosingTest.press();
		await flushPromises();
		expect(api.closeTab).not.toHaveBeenCalled();
		TabClosingTest.press();
		await flushPromises();
		expect(api.closeTab).toHaveBeenCalledWith('t1');
	});

	it('requires two presses for the same selected tab', async () => {
		const { session, api } = await TabClosingTest.mount();
		TabClosingTest.press();
		session.state.selectedTabId = 't2';
		TabClosingTest.press();
		await flushPromises();
		expect(api.closeTab).not.toHaveBeenCalled();
		TabClosingTest.press();
		await flushPromises();
		expect(api.closeTab).toHaveBeenCalledWith('t2');
	});

	it('does not count a held key as a second press', async () => {
		const { api } = await TabClosingTest.mount();
		TabClosingTest.press();
		TabClosingTest.press({
			repeat: true,
		});
		await flushPromises();
		expect(api.closeTab).not.toHaveBeenCalled();
		TabClosingTest.press();
		await flushPromises();
		expect(api.closeTab).toHaveBeenCalledWith('t1');
	});

	it('leaves Control-W to the terminal', async () => {
		const { api } = await TabClosingTest.mount();
		for (let index = 0; index < 2; index++) {
			expect(TabClosingTest.press({
				ctrlKey: true,
				metaKey: false,
			}).defaultPrevented).toBe(false);
		}
		await flushPromises();
		expect(api.closeTab).not.toHaveBeenCalled();
	});
});
