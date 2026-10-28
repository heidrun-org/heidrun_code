import type { Box } from './reorder';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	PaneMove — finds the place of a dropped pane in a destination pane, and lists the Herdr steps that move it there
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The side of the destination pane where the dragged pane goes: the triangle that holds the pointer. */
export type PaneMoveSide = 'top' | 'bottom' | 'left' | 'right';

/** What the developer dropped, and where. */
export type PaneMovePlanInput = {
	/** The pane that the developer dragged, for example `w1:p3`. */
	paneId: string;
	/** The workspace that holds the dragged pane and the destination pane. */
	workspaceId: string;
	/** The tab that holds the dragged pane before the move. */
	sourceTabId: string;
	/** The tab that holds the destination pane. */
	destinationTabId: string;
	/** The destination pane, the pane under the pointer at the drop. */
	destinationPaneId: string;
	/** The triangle of the destination pane that held the pointer at the drop. */
	side: PaneMoveSide;
};

/** What the developer dropped on the plus button of the tab bar. */
export type PaneMoveNewTabPlanInput = {
	/** The pane that the developer dragged, for example `w1:p3`. */
	paneId: string;
	/** The workspace that holds the dragged pane and gets the new tab. */
	workspaceId: string;
};

/** One call to Herdr. The steps run one after the other, in the order of the list. */
export type PaneMoveStep =
	| {
			/** Herdr cannot move a pane inside its own tab, so the pane leaves its tab first, into a new tab. */
			kind: 'move-to-new-tab';
			/** The pane to move. */
			paneId: string;
			/** The workspace that gets the new tab. */
			workspaceId: string;
	  }
	| {
			/** Herdr puts the pane to the right of the destination pane, or below it, and gives each half the space. */
			kind: 'move-next-to-pane';
			/** The pane to move. */
			paneId: string;
			/** The tab that receives the pane. */
			tabId: string;
			/** The pane that gets a neighbor. */
			destinationPaneId: string;
			/** `right`: side by side. `down`: one above the other. The moved pane is the second one. */
			direction: 'right' | 'down';
	  }
	| {
			/** The two panes exchange their places, so the moved pane goes to the left or to the top. */
			kind: 'swap';
			/** The moved pane. */
			paneId: string;
			/** The destination pane. */
			destinationPaneId: string;
	  };

/** Works out where a dragged pane lands in a destination pane, and which Herdr calls move it there. */
export class PaneMove {
	/**
	 * Finds the triangle that holds a point. Two diagonals, from corner to corner, cut the box into four triangles. A
	 * point exactly on a diagonal belongs to one of the two triangles that touch there, always the same one.
	 * @param box The box of the destination pane, in the pixels of the window.
	 * @param x The horizontal position of the point, in the pixels of the window.
	 * @param y The vertical position of the point, in the pixels of the window.
	 * @returns The side of the box that the triangle touches.
	 */
	static sideAt(box: Box, x: number, y: number): PaneMoveSide {
		const width = box.right - box.left;
		const height = box.bottom - box.top;
		const shareX = width > 0 ? (x - box.left) / width : 0.5;
		const shareY = height > 0 ? (y - box.top) / height : 0.5;
		const isBelowFirstDiagonal = shareY > shareX;
		const isBelowSecondDiagonal = shareY > 1 - shareX;
		if (isBelowFirstDiagonal && isBelowSecondDiagonal) {
			return 'bottom';
		}
		if (isBelowFirstDiagonal === false && isBelowSecondDiagonal === false) {
			return 'top';
		}
		return isBelowFirstDiagonal ? 'left' : 'right';
	}

	/**
	 * Gives the half of the destination pane where the dragged pane goes, so that the window shows the result before the
	 * drop.
	 * @param box The box of the destination pane, in the pixels of the window.
	 * @param side The triangle that holds the pointer.
	 * @returns The box of the half that touches `side`.
	 */
	static halfOf(box: Box, side: PaneMoveSide): Box {
		const middleX = (box.left + box.right) / 2;
		const middleY = (box.top + box.bottom) / 2;
		switch (side) {
			case 'top':
				return { left: box.left, top: box.top, right: box.right, bottom: middleY };
			case 'bottom':
				return { left: box.left, top: middleY, right: box.right, bottom: box.bottom };
			case 'left':
				return { left: box.left, top: box.top, right: middleX, bottom: box.bottom };
			case 'right':
				return { left: middleX, top: box.top, right: box.right, bottom: box.bottom };
		}
	}

	/**
	 * Lists the Herdr steps that move a pane into a new tab: one `pane.move` to a new tab. The terminal of the pane keeps
	 * running.
	 * @param input The dragged pane and its workspace.
	 * @returns The steps, in the order to run them.
	 */
	static planNewTab(input: PaneMoveNewTabPlanInput): PaneMoveStep[] {
		return [{ kind: 'move-to-new-tab', paneId: input.paneId, workspaceId: input.workspaceId }];
	}

	/**
	 * Lists the Herdr steps that move a pane to a side of a destination pane. Herdr puts a moved pane only to the right
	 * or below, so the top and the left come from a swap after the move. Herdr moves no pane inside its own tab, so a
	 * move inside one tab goes through a temporary tab that Herdr closes when its last pane leaves. The terminal of the
	 * pane keeps running in every step.
	 * @param input The dragged pane and the destination.
	 * @returns The steps, in the order to run them.
	 */
	static plan(input: PaneMovePlanInput): PaneMoveStep[] {
		const steps: PaneMoveStep[] = [];
		if (input.sourceTabId === input.destinationTabId) {
			steps.push({ kind: 'move-to-new-tab', paneId: input.paneId, workspaceId: input.workspaceId });
		}
		const isSideBySide = input.side === 'left' || input.side === 'right';
		steps.push({
			kind: 'move-next-to-pane',
			paneId: input.paneId,
			tabId: input.destinationTabId,
			destinationPaneId: input.destinationPaneId,
			direction: isSideBySide ? 'right' : 'down',
		});
		if (input.side === 'left' || input.side === 'top') {
			steps.push({ kind: 'swap', paneId: input.paneId, destinationPaneId: input.destinationPaneId });
		}
		return steps;
	}
}
