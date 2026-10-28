import { reactive } from 'vue';
import * as api from '../lib/api';
import { PaneMove, type PaneMoveSide, type PaneMoveStep } from '../lib/pane_move';
import { ignoreNextClick, type Box } from '../lib/reorder';
import { t } from '../i18n/index';
import { allPanes, holdRefresh, selectPane, selectTab, state as sessionState, toast } from './session';
import { ZenMode } from './zen_mode';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	PaneMoveDrag — moves a pane when the developer drags its header onto another pane, in its tab or in another tab
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The distance in pixels that the pointer must move before a press on a header becomes a move. A shorter move is a click. */
const DRAG_THRESHOLD = 5;

/** The header elements that keep their own click: a press on one of them never starts a move. */
const OWN_CLICK_SELECTOR = 'button, input, textarea, select, a, [role="button"], [contenteditable="true"]';

/** The attribute of a pane of the grid that can receive a drop. It holds the identifier of the pane. */
export const PANE_MOVE_DESTINATION_ATTRIBUTE = 'data-pane-move-destination';

/** The attribute of a tab of the tab bar. It holds the identifier of the tab. */
export const PANE_MOVE_TAB_ATTRIBUTE = 'data-tab-id';

/** The attribute of the plus button of the tab bar. A release on this button moves the dragged pane into a new tab. */
export const PANE_MOVE_NEW_TAB_ATTRIBUTE = 'data-pane-move-new-tab';

/** One press on a pane header, from the press until the release. */
type Press = {
	/** The pane whose header was pressed. */
	paneId: string;
	/** The horizontal position of the press, in the pixels of the window. */
	startX: number;
	/** The vertical position of the press, in the pixels of the window. */
	startY: number;
	/** True once the pointer moved at least `DRAG_THRESHOLD` pixels. */
	isDrag: boolean;
};

/** Owns the move of a pane by drag and drop. The page uses the pointer events, and never the drag and drop of the browser. */
export class PaneMoveDrag {
	/** What the window shows during a move. All the fields are null when no pane is dragged. */
	static readonly state = reactive({
		/** The pane that the developer drags. */
		paneId: null as string | null,
		/** The destination pane under the pointer. */
		destinationPaneId: null as string | null,
		/** The triangle of the destination pane that holds the pointer. */
		side: null as PaneMoveSide | null,
		/** The half of the destination pane where the dragged pane goes, in the pixels of the window. */
		previewBox: null as Box | null,
		/** True while the pointer is over the plus button of the tab bar and a release there moves the dragged pane. */
		isNewTabTargeted: false,
	});

	/** The press in progress, or null. */
	private static press: Press | null = null;

	/** True while the calls to Herdr of a drop run. A new press waits until they end. */
	private static isMoveRunning = false;

	/**
	 * Starts to follow a press on the header of a pane. The press becomes a move only when the pointer moves.
	 * @param event The press on the header.
	 * @param paneId The pane whose header was pressed.
	 * @returns Nothing.
	 */
	static onPointerDown(event: PointerEvent, paneId: string): void {
		if (event.button !== 0 || PaneMoveDrag.press !== null || PaneMoveDrag.isMoveRunning || ZenMode.state.isActive) {
			return;
		}
		const target = event.target;
		if (target instanceof Element && target.closest(OWN_CLICK_SELECTOR) !== null) {
			return;
		}
		PaneMoveDrag.press = { paneId, startX: event.clientX, startY: event.clientY, isDrag: false };
		window.addEventListener('pointermove', PaneMoveDrag.onPointerMove, true);
		window.addEventListener('pointerup', PaneMoveDrag.onPointerUp, true);
		window.addEventListener('pointercancel', PaneMoveDrag.cancel, true);
		window.addEventListener('blur', PaneMoveDrag.cancel);
		window.addEventListener('keydown', PaneMoveDrag.onKeyDown, true);
	}

	/**
	 * Moves a pane to a side of a destination pane, with the calls to Herdr that `PaneMove.plan` lists. The window reads the
	 * layout of Herdr once, after the last call, so it never shows the state between two calls. The pane is selected after the move.
	 * @param paneId The pane to move.
	 * @param destinationPaneId The destination pane.
	 * @param side The side of the destination pane where the pane goes.
	 * @returns Resolves after the move, or after the error message is shown.
	 */
	static async movePane(paneId: string, destinationPaneId: string, side: PaneMoveSide): Promise<void> {
		const pane = allPanes.value.find((candidate) => candidate.pane_id === paneId);
		const destinationPane = allPanes.value.find((candidate) => candidate.pane_id === destinationPaneId);
		if (pane === undefined || destinationPane === undefined || paneId === destinationPaneId) {
			return;
		}
		if (pane.workspace_id !== destinationPane.workspace_id) {
			return;
		}
		const steps = PaneMove.plan({
			paneId,
			workspaceId: pane.workspace_id,
			sourceTabId: pane.tab_id,
			destinationTabId: destinationPane.tab_id,
			destinationPaneId,
			side,
		});
		await PaneMoveDrag.runSteps(paneId, pane.tab_id, destinationPaneId, steps);
	}

	/**
	 * Tells if a pane can move into a new tab. A pane that is alone in its tab cannot, because Herdr would close its tab and
	 * the result would be the same tab at the end of the tab bar.
	 * @param paneId The pane to move.
	 * @returns True when the tab of the pane holds at least one other pane.
	 */
	static canMoveToNewTab(paneId: string): boolean {
		const pane = allPanes.value.find((candidate) => candidate.pane_id === paneId);
		if (pane === undefined) {
			return false;
		}
		return allPanes.value.filter((candidate) => candidate.tab_id === pane.tab_id).length > 1;
	}

	/**
	 * Moves a pane into a new tab of its workspace. The new tab holds only this pane, and no default command starts in it. The
	 * pane is selected after the move.
	 * @param paneId The pane to move.
	 * @returns Resolves after the move, or after the error message is shown.
	 */
	static async movePaneToNewTab(paneId: string): Promise<void> {
		const pane = allPanes.value.find((candidate) => candidate.pane_id === paneId);
		if (pane === undefined || PaneMoveDrag.canMoveToNewTab(paneId) === false) {
			return;
		}
		const steps = PaneMove.planNewTab({ paneId, workspaceId: pane.workspace_id });
		await PaneMoveDrag.runSteps(paneId, pane.tab_id, null, steps);
	}

	/**
	 * Ends the press without a move. After a drag, the click that the browser sends after the release is ignored.
	 * @returns Nothing.
	 */
	static cancel(): void {
		const wasDrag = PaneMoveDrag.press?.isDrag === true;
		PaneMoveDrag.press = null;
		PaneMoveDrag.state.paneId = null;
		PaneMoveDrag.state.destinationPaneId = null;
		PaneMoveDrag.state.side = null;
		PaneMoveDrag.state.previewBox = null;
		PaneMoveDrag.state.isNewTabTargeted = false;
		window.removeEventListener('pointermove', PaneMoveDrag.onPointerMove, true);
		window.removeEventListener('pointerup', PaneMoveDrag.onPointerUp, true);
		window.removeEventListener('pointercancel', PaneMoveDrag.cancel, true);
		window.removeEventListener('blur', PaneMoveDrag.cancel);
		window.removeEventListener('keydown', PaneMoveDrag.onKeyDown, true);
		document.body.style.userSelect = '';
		document.body.style.cursor = '';
		if (wasDrag) {
			ignoreNextClick();
		}
	}

	/**
	 * Follows the pointer: starts the move after the threshold, selects the tab under the pointer, and finds the half of
	 * the pane under the pointer.
	 * @param event The move of the pointer.
	 * @returns Nothing.
	 */
	private static readonly onPointerMove = (event: PointerEvent): void => {
		const press = PaneMoveDrag.press;
		if (press === null) {
			return;
		}
		if (press.isDrag === false) {
			if (Math.hypot(event.clientX - press.startX, event.clientY - press.startY) < DRAG_THRESHOLD) {
				return;
			}
			press.isDrag = true;
			PaneMoveDrag.state.paneId = press.paneId;
			window.getSelection()?.removeAllRanges();
			document.body.style.userSelect = 'none';
			document.body.style.cursor = 'grabbing';
		}
		PaneMoveDrag.follow(press.paneId, event.clientX, event.clientY);
	};

	/**
	 * Ends the press. A drop on a destination pane moves the pane, a drop on the plus button of the tab bar moves the pane
	 * into a new tab, and a release anywhere else moves nothing.
	 * @returns Nothing.
	 */
	private static readonly onPointerUp = (): void => {
		const press = PaneMoveDrag.press;
		const destinationPaneId = PaneMoveDrag.state.destinationPaneId;
		const side = PaneMoveDrag.state.side;
		const isNewTabTargeted = PaneMoveDrag.state.isNewTabTargeted;
		PaneMoveDrag.cancel();
		if (press === null || press.isDrag === false) {
			return;
		}
		if (isNewTabTargeted) {
			void PaneMoveDrag.movePaneToNewTab(press.paneId);
			return;
		}
		if (destinationPaneId === null || side === null) {
			return;
		}
		void PaneMoveDrag.movePane(press.paneId, destinationPaneId, side);
	};

	/**
	 * Cancels the move when the developer presses Escape.
	 * @param event The key press.
	 * @returns Nothing.
	 */
	private static readonly onKeyDown = (event: KeyboardEvent): void => {
		if (event.key === 'Escape') {
			PaneMoveDrag.cancel();
		}
	};

	/**
	 * Looks at what is under the pointer. The plus button of the tab bar is marked when a drop there can move the dragged pane
	 * into a new tab. A tab of the tab bar is selected at once, so that the developer chooses the destination tab during the
	 * drag. A pane of the selected tab, other than the dragged pane, becomes the destination.
	 * @param paneId The dragged pane.
	 * @param x The horizontal position of the pointer, in the pixels of the window.
	 * @param y The vertical position of the pointer, in the pixels of the window.
	 * @returns Nothing.
	 */
	private static follow(paneId: string, x: number, y: number): void {
		const elements = document.elementsFromPoint(x, y);
		const isOverNewTabButton = elements.some((element) => element.closest(`[${PANE_MOVE_NEW_TAB_ATTRIBUTE}]`) !== null);
		PaneMoveDrag.state.isNewTabTargeted = isOverNewTabButton && PaneMoveDrag.canMoveToNewTab(paneId);
		if (isOverNewTabButton) {
			PaneMoveDrag.clearDestination();
			return;
		}
		for (const element of elements) {
			const tabElement = element.closest(`[${PANE_MOVE_TAB_ATTRIBUTE}]`);
			if (tabElement === null) {
				continue;
			}
			const tabId = tabElement.getAttribute(PANE_MOVE_TAB_ATTRIBUTE);
			if (tabId !== null && tabId !== sessionState.selectedTabId) {
				selectTab(tabId);
			}
			PaneMoveDrag.clearDestination();
			return;
		}
		for (const element of elements) {
			const paneElement = element.closest(`[${PANE_MOVE_DESTINATION_ATTRIBUTE}]`);
			if (paneElement === null) {
				continue;
			}
			const destinationPaneId = paneElement.getAttribute(PANE_MOVE_DESTINATION_ATTRIBUTE);
			if (destinationPaneId === null || destinationPaneId === paneId) {
				break;
			}
			const place = PaneMoveDrag.placeIn(paneElement, x, y);
			PaneMoveDrag.state.destinationPaneId = destinationPaneId;
			PaneMoveDrag.state.side = place.side;
			PaneMoveDrag.state.previewBox = place.previewBox;
			return;
		}
		PaneMoveDrag.clearDestination();
	}

	/**
	 * Gives the triangle that holds the pointer in a destination pane, and the half of the pane where the dragged pane goes.
	 * @param element The element of the destination pane.
	 * @param x The horizontal position of the pointer, in the pixels of the window.
	 * @param y The vertical position of the pointer, in the pixels of the window.
	 * @returns The triangle that holds the pointer and the half that it decides.
	 */
	private static placeIn(element: Element, x: number, y: number): { side: PaneMoveSide; previewBox: Box } {
		const rect = element.getBoundingClientRect();
		const box: Box = { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
		const side = PaneMove.sideAt(box, x, y);
		return { side, previewBox: PaneMove.halfOf(box, side) };
	}

	/**
	 * Forgets the destination pane, because the pointer is not over a pane that can receive the dragged pane.
	 * @returns Nothing.
	 */
	private static clearDestination(): void {
		PaneMoveDrag.state.destinationPaneId = null;
		PaneMoveDrag.state.side = null;
		PaneMoveDrag.state.previewBox = null;
	}

	/**
	 * Runs the steps of a move one after the other. The window reads the layout of Herdr once, after the last step, so it never
	 * shows the state between two steps. When a step fails, the error message shows the reason. The pane is selected after the move.
	 * @param paneId The pane to move.
	 * @param sourceTabId The tab that held the pane before the move.
	 * @param destinationPaneId The destination pane, or null when the move has no destination pane.
	 * @param steps The steps of the move.
	 * @returns Resolves after the move, or after the error message is shown.
	 */
	private static async runSteps(
		paneId: string,
		sourceTabId: string,
		destinationPaneId: string | null,
		steps: PaneMoveStep[],
	): Promise<void> {
		PaneMoveDrag.isMoveRunning = true;
		const releaseRefresh = holdRefresh();
		let failureReason: string | null = null;
		let doneStepCount = 0;
		try {
			for (const step of steps) {
				await PaneMoveDrag.runStep(step);
				doneStepCount += 1;
			}
		} catch (error) {
			failureReason = error instanceof Error ? error.message : String(error);
			await PaneMoveDrag.bringBackToTab(steps, doneStepCount, sourceTabId, destinationPaneId);
		} finally {
			await releaseRefresh();
			PaneMoveDrag.isMoveRunning = false;
		}
		if (failureReason !== null) {
			toast(t('sessionStore.error.paneMove', { reason: failureReason }), 'error');
			return;
		}
		const movedPane = allPanes.value.find((candidate) => candidate.pane_id === paneId);
		if (movedPane !== undefined) {
			selectPane(movedPane);
		}
	}

	/**
	 * Runs one call to Herdr of a move.
	 * @param step The call.
	 * @returns Resolves when Herdr moved the pane. Rejects with the reason when Herdr answers that nothing changed.
	 */
	private static async runStep(step: PaneMoveStep): Promise<void> {
		if (step.kind === 'swap') {
			const answer = await api.swapPanes(step.paneId, step.destinationPaneId);
			PaneMoveDrag.requireChange(answer.swap.changed, answer.swap.reason);
			return;
		}
		if (step.kind === 'move-to-new-tab') {
			const answer = await api.movePaneToNewTab(step.paneId, step.workspaceId);
			PaneMoveDrag.requireChange(answer.move_result.changed, answer.move_result.reason);
			return;
		}
		const answer = await api.movePaneNextToPane(step.paneId, step.tabId, step.destinationPaneId, step.direction);
		PaneMoveDrag.requireChange(answer.move_result.changed, answer.move_result.reason);
	}

	/**
	 * Fails when Herdr did not do what a call asked.
	 * @param isChanged The field `changed` of the answer of Herdr.
	 * @param reason The field `reason` of the answer of Herdr.
	 * @returns Nothing.
	 */
	private static requireChange(isChanged: boolean, reason: string | null | undefined): void {
		if (isChanged === false) {
			throw new Error(reason ?? 'unchanged');
		}
	}

	/**
	 * After a failure in a move inside one tab, brings the pane back from the temporary tab, so that no pane stays alone in
	 * a tab that the developer never asked for.
	 * @param steps The steps of the move.
	 * @param doneStepCount The number of steps that ended before the failure.
	 * @param sourceTabId The tab that held the pane before the move.
	 * @param destinationPaneId The destination pane, which is in the source tab, or null when the move has none.
	 * @returns Resolves when the pane is back, or when the attempt failed.
	 */
	private static async bringBackToTab(
		steps: PaneMoveStep[],
		doneStepCount: number,
		sourceTabId: string,
		destinationPaneId: string | null,
	): Promise<void> {
		const isInTemporaryTab = steps[0]?.kind === 'move-to-new-tab' && doneStepCount === 1;
		if (isInTemporaryTab === false || destinationPaneId === null) {
			return;
		}
		try {
			await api.movePaneNextToPane(steps[0].paneId, sourceTabId, destinationPaneId, 'right');
		} catch {
			// The window shows the pane in its temporary tab, and the error message tells the developer.
		}
	}
}
