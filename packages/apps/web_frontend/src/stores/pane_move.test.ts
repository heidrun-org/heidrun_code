import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	movePaneToNewTab: vi.fn(),
	movePaneNextToPane: vi.fn(),
	swapPanes: vi.fn(),
	snapshot: vi.fn(),
	elementsFromPoint: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => null) }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock('@tauri-apps/api/path', () => ({ homeDir: vi.fn(async () => '/home') }));
vi.mock('@tauri-apps/api/webview', () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));
vi.mock('../lib/api', () => ({
	movePaneToNewTab: mocks.movePaneToNewTab,
	movePaneNextToPane: mocks.movePaneNextToPane,
	swapPanes: mocks.swapPanes,
	snapshot: mocks.snapshot,
	watchPanes: vi.fn(async () => {}),
	codexUsage: vi.fn(async () => ({ available: false, sessions: {} })),
}));

import type { SessionSnapshot } from '../lib/types';
import { PaneMoveDrag } from './pane_move';
import { refresh, state } from './session';
import { ZenMode } from './zen_mode';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Helpers
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** One box of the fake window, in pixels. */
type FakeBox = { left: number; top: number; right: number; bottom: number };

/** The boxes of the elements of the fake window. */
const boxes = new Map<Element, FakeBox>();

/** The fake window: two tabs, two panes in the first tab, and one pane in the second tab. */
const windowHtmlContent = /* html */`
	<ul>
		<li id="tab-t1" data-tab-id="w1:t1"></li>
		<li id="tab-t2" data-tab-id="w1:t2"></li>
	</ul>
	<button id="new-tab-button" data-pane-move-new-tab></button>
	<section id="pane-p1" data-pane-move-destination="w1:p1"><header id="header-p1"><span id="name-p1"></span><button id="button-p1"></button></header></section>
	<section id="pane-p2" data-pane-move-destination="w1:p2"><header id="header-p2"></header></section>
	<section id="pane-p3" data-pane-move-destination="w1:p3"><header id="header-p3"></header></section>
`;

/** The snapshot of Herdr before the move: the panes p1 and p2 in the tab t1, and the pane p3 in the tab t2. */
function snapshotWithPaneIn(tabIdOfP3: string): SessionSnapshot {
	return {
		workspaces: [{ workspace_id: 'w1', number: 1, label: 'heidrun', agent_status: 'idle' }],
		tabs: [
			{ tab_id: 'w1:t1', workspace_id: 'w1', number: 1, label: '', focused: true, pane_count: 2, agent_status: 'idle' },
			{ tab_id: 'w1:t2', workspace_id: 'w1', number: 2, label: '', focused: false, pane_count: 1, agent_status: 'idle' },
		],
		panes: [
			{ pane_id: 'w1:p1', workspace_id: 'w1', tab_id: 'w1:t1', agent_status: 'idle' },
			{ pane_id: 'w1:p2', workspace_id: 'w1', tab_id: 'w1:t1', agent_status: 'idle' },
			{ pane_id: 'w1:p3', workspace_id: 'w1', tab_id: tabIdOfP3, agent_status: 'idle' },
		],
		agents: [],
		layouts: [],
	} as unknown as SessionSnapshot;
}

/**
 * Gives an element a box, so that the fake window can tell what is under a point.
 * @param id The identifier of the element.
 * @param box The box of the element.
 * @returns Nothing.
 */
function place(id: string, box: FakeBox): void {
	const element = document.getElementById(id) as HTMLElement;
	boxes.set(element, box);
	element.getBoundingClientRect = () => ({ ...box, x: box.left, y: box.top, width: box.right - box.left, height: box.bottom - box.top, toJSON: () => ({}) });
}

/** Builds the fake window and its boxes. */
function buildWindow(): void {
	boxes.clear();
	document.body.innerHTML = windowHtmlContent;
	place('tab-t1', { left: 0, top: 0, right: 100, bottom: 40 });
	place('tab-t2', { left: 100, top: 0, right: 200, bottom: 40 });
	place('new-tab-button', { left: 200, top: 0, right: 234, bottom: 40 });
	place('pane-p1', { left: 0, top: 50, right: 400, bottom: 350 });
	place('pane-p2', { left: 400, top: 50, right: 800, bottom: 350 });
	place('pane-p3', { left: 0, top: 50, right: 800, bottom: 350 });
	mocks.elementsFromPoint.mockImplementation((x: number, y: number) =>
		[...boxes.entries()]
			.filter(([element, box]) => x >= box.left && x < box.right && y >= box.top && y < box.bottom && isShown(element))
			.map(([element]) => element),
	);
	Object.defineProperty(document, 'elementsFromPoint', { value: mocks.elementsFromPoint, configurable: true });
}

/**
 * Tells if an element is on the screen: the panes of the tab that is not selected are hidden.
 * @param element The element.
 * @returns False for a pane of the tab that is not selected.
 */
function isShown(element: Element): boolean {
	const destinationPaneId = element.getAttribute('data-pane-move-destination');
	if (destinationPaneId === null) {
		return true;
	}
	const pane = state.snapshot?.panes.find((candidate) => candidate.pane_id === destinationPaneId);
	return pane?.tab_id === state.selectedTabId;
}

/**
 * Presses the pointer on an element, as the header of a pane does.
 * @param elementId The element that receives the press.
 * @param paneId The pane whose header it is.
 * @param x The horizontal position of the press.
 * @param y The vertical position of the press.
 * @returns Nothing.
 */
function press(elementId: string, paneId: string, x: number, y: number): void {
	const element = document.getElementById(elementId) as HTMLElement;
	const forward = (event: Event) => PaneMoveDrag.onPointerDown(event as PointerEvent, paneId);
	element.addEventListener('pointerdown', forward, { once: true });
	element.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: x, clientY: y, button: 0 }));
	element.removeEventListener('pointerdown', forward);
}

/**
 * Moves the pointer.
 * @param x The horizontal position.
 * @param y The vertical position.
 * @returns Nothing.
 */
function moveTo(x: number, y: number): void {
	window.dispatchEvent(new MouseEvent('pointermove', { clientX: x, clientY: y }));
}

/** Releases the pointer. */
function release(): void {
	window.dispatchEvent(new MouseEvent('pointerup'));
}

/** Lets the chain of asynchronous calls of the store run until it is idle. */
async function settle(): Promise<void> {
	for (let turn = 0; turn < 30; turn++) {
		await Promise.resolve();
	}
}

/** The names of the calls to Herdr, in the order they happened. */
function callNames(): string[] {
	const calls = [
		...mocks.movePaneToNewTab.mock.invocationCallOrder.map((order) => ({ order, name: 'move-to-new-tab' })),
		...mocks.movePaneNextToPane.mock.invocationCallOrder.map((order) => ({ order, name: 'move-next-to-pane' })),
		...mocks.swapPanes.mock.invocationCallOrder.map((order) => ({ order, name: 'swap' })),
	];
	return calls.sort((first, second) => first.order - second.order).map((call) => call.name);
}

beforeEach(() => {
	PaneMoveDrag.cancel();
	mocks.movePaneToNewTab.mockReset();
	mocks.movePaneNextToPane.mockReset();
	mocks.swapPanes.mockReset();
	mocks.snapshot.mockReset();
	mocks.movePaneToNewTab.mockResolvedValue({ move_result: { changed: true } });
	mocks.movePaneNextToPane.mockResolvedValue({ move_result: { changed: true } });
	mocks.swapPanes.mockResolvedValue({ swap: { changed: true } });
	mocks.snapshot.mockResolvedValue(snapshotWithPaneIn('w1:t1'));
	state.snapshot = snapshotWithPaneIn('w1:t2');
	state.selectedWorkspaceId = 'w1';
	state.selectedTabId = 'w1:t1';
	state.selectedPaneId = 'w1:p1';
	state.toast = '';
	ZenMode.exit();
	buildWindow();
});

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	The press and the threshold
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

describe('PaneMoveDrag: the press', () => {
	it('is a click, and moves nothing, when the pointer moves less than 5 pixels', async () => {
		press('header-p2', 'w1:p2', 500, 60);
		moveTo(503, 62);
		expect(PaneMoveDrag.state.paneId).toBeNull();
		release();
		await settle();
		expect(callNames()).toEqual([]);
	});

	it('starts a move when the pointer moves 5 pixels or more', () => {
		press('header-p2', 'w1:p2', 500, 60);
		moveTo(300, 200);
		expect(PaneMoveDrag.state.paneId).toBe('w1:p2');
		release();
	});

	it('does not start a move from a button of the header', () => {
		press('button-p1', 'w1:p1', 20, 60);
		moveTo(500, 200);
		expect(PaneMoveDrag.state.paneId).toBeNull();
		release();
	});

	it('does not start a move in Zen Mode, which shows one pane', () => {
		ZenMode.toggle('w1:p1', 'w1:t1');
		press('header-p1', 'w1:p1', 20, 60);
		moveTo(500, 200);
		expect(PaneMoveDrag.state.paneId).toBeNull();
		release();
		ZenMode.exit();
	});

	it('ignores the click that follows a move, so a move does not select or rename anything', () => {
		press('header-p2', 'w1:p2', 500, 60);
		moveTo(100, 200);
		release();
		const onClick = vi.fn();
		document.body.addEventListener('click', onClick);
		(document.getElementById('header-p2') as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(onClick).not.toHaveBeenCalled();
	});
});

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	The destination during the move
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

describe('PaneMoveDrag: the destination', () => {
	it('shows the half of the pane under the pointer where the dragged pane goes', () => {
		press('header-p2', 'w1:p2', 500, 60);
		moveTo(10, 200);
		expect(PaneMoveDrag.state.destinationPaneId).toBe('w1:p1');
		expect(PaneMoveDrag.state.side).toBe('left');
		expect(PaneMoveDrag.state.previewBox).toEqual({ left: 0, top: 50, right: 200, bottom: 350 });
		moveTo(200, 60);
		expect(PaneMoveDrag.state.side).toBe('top');
		expect(PaneMoveDrag.state.previewBox).toEqual({ left: 0, top: 50, right: 400, bottom: 200 });
		moveTo(390, 200);
		expect(PaneMoveDrag.state.side).toBe('right');
		expect(PaneMoveDrag.state.previewBox).toEqual({ left: 200, top: 50, right: 400, bottom: 350 });
		moveTo(200, 340);
		expect(PaneMoveDrag.state.side).toBe('bottom');
		expect(PaneMoveDrag.state.previewBox).toEqual({ left: 0, top: 200, right: 400, bottom: 350 });
		release();
	});

	it('has no destination over the dragged pane itself', () => {
		press('header-p2', 'w1:p2', 500, 60);
		moveTo(600, 200);
		expect(PaneMoveDrag.state.destinationPaneId).toBeNull();
		expect(PaneMoveDrag.state.previewBox).toBeNull();
		release();
	});

	it('has no destination outside every pane', () => {
		press('header-p2', 'w1:p2', 500, 60);
		moveTo(10, 200);
		moveTo(900, 900);
		expect(PaneMoveDrag.state.destinationPaneId).toBeNull();
		expect(PaneMoveDrag.state.previewBox).toBeNull();
		release();
	});

	it('selects a tab at once when the pointer is over it, and has no destination there', () => {
		press('header-p2', 'w1:p2', 500, 60);
		moveTo(150, 20);
		expect(state.selectedTabId).toBe('w1:t2');
		expect(PaneMoveDrag.state.destinationPaneId).toBeNull();
		release();
	});

	it('offers the panes of the tab that the pointer selected, and no pane of the tab that it left', () => {
		press('header-p2', 'w1:p2', 500, 60);
		moveTo(150, 20);
		moveTo(10, 200);
		expect(PaneMoveDrag.state.destinationPaneId).toBe('w1:p3');
		release();
	});
});

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	The drop
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

describe('PaneMoveDrag: the drop', () => {
	it('does nothing when the developer presses Escape, also if the pointer is released over a pane', async () => {
		press('header-p2', 'w1:p2', 500, 60);
		moveTo(10, 200);
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
		expect(PaneMoveDrag.state.paneId).toBeNull();
		release();
		await settle();
		expect(callNames()).toEqual([]);
	});

	it('does nothing when the pointer is released on the dragged pane', async () => {
		press('header-p2', 'w1:p2', 500, 60);
		moveTo(600, 200);
		release();
		await settle();
		expect(callNames()).toEqual([]);
	});

	it('does nothing when the pointer is released outside every pane, and the pane stays where it was', async () => {
		press('header-p2', 'w1:p2', 500, 60);
		moveTo(900, 900);
		release();
		await settle();
		expect(callNames()).toEqual([]);
		expect(state.selectedTabId).toBe('w1:t1');
	});

	it('moves a pane inside its tab to the right of the destination pane through a temporary tab', async () => {
		press('header-p2', 'w1:p2', 500, 60);
		moveTo(390, 200);
		release();
		await settle();
		expect(callNames()).toEqual(['move-to-new-tab', 'move-next-to-pane']);
		expect(mocks.movePaneToNewTab).toHaveBeenCalledWith('w1:p2', 'w1');
		expect(mocks.movePaneNextToPane).toHaveBeenCalledWith('w1:p2', 'w1:t1', 'w1:p1', 'right');
	});

	it('moves a pane inside its tab above the destination pane: temporary tab, move down, then swap', async () => {
		press('header-p2', 'w1:p2', 500, 60);
		moveTo(200, 60);
		release();
		await settle();
		expect(callNames()).toEqual(['move-to-new-tab', 'move-next-to-pane', 'swap']);
		expect(mocks.movePaneNextToPane).toHaveBeenCalledWith('w1:p2', 'w1:t1', 'w1:p1', 'down');
		expect(mocks.swapPanes).toHaveBeenCalledWith('w1:p2', 'w1:p1');
	});

	it('moves a pane to another tab, to the left of a pane of that tab: move to the right, then swap', async () => {
		state.selectedTabId = 'w1:t2';
		press('header-p3', 'w1:p3', 400, 60);
		moveTo(50, 20);
		expect(state.selectedTabId).toBe('w1:t1');
		moveTo(10, 200);
		release();
		await settle();
		expect(callNames()).toEqual(['move-next-to-pane', 'swap']);
		expect(mocks.movePaneNextToPane).toHaveBeenCalledWith('w1:p3', 'w1:t1', 'w1:p1', 'right');
		expect(mocks.swapPanes).toHaveBeenCalledWith('w1:p3', 'w1:p1');
	});

	it('selects the moved pane in its new tab after the move', async () => {
		state.selectedTabId = 'w1:t2';
		press('header-p3', 'w1:p3', 400, 60);
		moveTo(50, 20);
		moveTo(390, 200);
		release();
		await settle();
		expect(state.selectedTabId).toBe('w1:t1');
		expect(state.selectedPaneId).toBe('w1:p3');
	});

	it('reads the layout of Herdr once, after the last call, so the window never shows the temporary tab', async () => {
		const snapshotCountAtEachCall: number[] = [];
		mocks.movePaneToNewTab.mockImplementation(async () => {
			snapshotCountAtEachCall.push(mocks.snapshot.mock.calls.length);
			await refresh();
			return { move_result: { changed: true } };
		});
		mocks.movePaneNextToPane.mockImplementation(async () => {
			snapshotCountAtEachCall.push(mocks.snapshot.mock.calls.length);
			await refresh();
			return { move_result: { changed: true } };
		});
		press('header-p2', 'w1:p2', 500, 60);
		moveTo(390, 200);
		release();
		await settle();
		expect(snapshotCountAtEachCall).toEqual([0, 0]);
		expect(mocks.snapshot).toHaveBeenCalledTimes(1);
	});
});

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	The plus button of the tab bar
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

describe('PaneMoveDrag: the plus button of the tab bar', () => {
	it('marks the plus button while the pointer is over it, and has no destination there', () => {
		press('header-p2', 'w1:p2', 500, 60);
		moveTo(10, 200);
		expect(PaneMoveDrag.state.destinationPaneId).toBe('w1:p1');
		moveTo(215, 20);
		expect(PaneMoveDrag.state.isNewTabTargeted).toBe(true);
		expect(PaneMoveDrag.state.destinationPaneId).toBeNull();
		expect(PaneMoveDrag.state.previewBox).toBeNull();
		release();
	});

	it('removes the mark when the pointer leaves the plus button', () => {
		press('header-p2', 'w1:p2', 500, 60);
		moveTo(215, 20);
		moveTo(300, 200);
		expect(PaneMoveDrag.state.isNewTabTargeted).toBe(false);
		moveTo(215, 20);
		moveTo(10, 200);
		expect(PaneMoveDrag.state.isNewTabTargeted).toBe(false);
		expect(PaneMoveDrag.state.destinationPaneId).toBe('w1:p1');
		release();
	});

	it('removes the mark when the developer presses Escape, and a release then moves nothing', async () => {
		press('header-p2', 'w1:p2', 500, 60);
		moveTo(215, 20);
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
		expect(PaneMoveDrag.state.isNewTabTargeted).toBe(false);
		release();
		await settle();
		expect(callNames()).toEqual([]);
	});

	it('removes the mark after the release', () => {
		press('header-p2', 'w1:p2', 500, 60);
		moveTo(215, 20);
		release();
		expect(PaneMoveDrag.state.isNewTabTargeted).toBe(false);
	});

	it('never marks the plus button without a drag of a pane', () => {
		press('header-p2', 'w1:p2', 500, 60);
		moveTo(503, 62);
		expect(PaneMoveDrag.state.isNewTabTargeted).toBe(false);
		release();
	});

	it('moves the dragged pane into a new tab with one call to Herdr, and selects the pane', async () => {
		mocks.snapshot.mockResolvedValue({
			...snapshotWithPaneIn('w1:t2'),
			panes: [
				{ pane_id: 'w1:p1', workspace_id: 'w1', tab_id: 'w1:t1', agent_status: 'idle' },
				{ pane_id: 'w1:p2', workspace_id: 'w1', tab_id: 'w1:t3', agent_status: 'idle' },
				{ pane_id: 'w1:p3', workspace_id: 'w1', tab_id: 'w1:t2', agent_status: 'idle' },
			],
		});
		press('header-p2', 'w1:p2', 500, 60);
		moveTo(215, 20);
		release();
		await settle();
		expect(callNames()).toEqual(['move-to-new-tab']);
		expect(mocks.movePaneToNewTab).toHaveBeenCalledWith('w1:p2', 'w1');
		expect(mocks.snapshot).toHaveBeenCalledTimes(1);
		expect(state.selectedPaneId).toBe('w1:p2');
	});

	it('does not mark the plus button and moves nothing when the dragged pane is alone in its tab', async () => {
		state.selectedTabId = 'w1:t2';
		press('header-p3', 'w1:p3', 400, 60);
		moveTo(215, 20);
		expect(PaneMoveDrag.state.isNewTabTargeted).toBe(false);
		release();
		await settle();
		expect(callNames()).toEqual([]);
	});

	it('shows the reason when Herdr refuses the move into a new tab', async () => {
		mocks.movePaneToNewTab.mockRejectedValue('invalid_request: no such pane');
		press('header-p2', 'w1:p2', 500, 60);
		moveTo(215, 20);
		release();
		await settle();
		expect(mocks.movePaneNextToPane).not.toHaveBeenCalled();
		expect(state.toast).toContain('invalid_request: no such pane');
		expect(state.toastKind).toBe('error');
	});
});

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	The failures
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

describe('PaneMoveDrag: the failures', () => {
	it('shows the reason and keeps the pane selected when Herdr refuses the move', async () => {
		mocks.movePaneNextToPane.mockRejectedValue('invalid_request: no such pane');
		state.selectedTabId = 'w1:t2';
		press('header-p3', 'w1:p3', 400, 60);
		moveTo(50, 20);
		moveTo(390, 200);
		release();
		await settle();
		expect(state.toast).toContain('invalid_request: no such pane');
		expect(state.toastKind).toBe('error');
	});

	it('shows the reason when Herdr answers that nothing changed', async () => {
		mocks.movePaneNextToPane.mockResolvedValue({ move_result: { changed: false, reason: 'zoomed_tab' } });
		press('header-p2', 'w1:p2', 500, 60);
		moveTo(390, 200);
		release();
		await settle();
		expect(state.toast).toContain('zoomed_tab');
	});

	it('brings the pane back to its tab when the second call fails after the pane left for the temporary tab', async () => {
		mocks.movePaneNextToPane.mockRejectedValueOnce('invalid_request: no such pane');
		mocks.movePaneNextToPane.mockResolvedValue({ move_result: { changed: true } });
		press('header-p2', 'w1:p2', 500, 60);
		moveTo(390, 200);
		release();
		await settle();
		expect(mocks.movePaneNextToPane).toHaveBeenCalledTimes(2);
		expect(mocks.movePaneNextToPane).toHaveBeenLastCalledWith('w1:p2', 'w1:t1', 'w1:p1', 'right');
	});

	it('does not look for the temporary tab when the pane never left its tab', async () => {
		mocks.movePaneToNewTab.mockRejectedValue('invalid_request: no such pane');
		press('header-p2', 'w1:p2', 500, 60);
		moveTo(390, 200);
		release();
		await settle();
		expect(mocks.movePaneNextToPane).not.toHaveBeenCalled();
	});
});
