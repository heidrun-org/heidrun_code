import { MIRE_LAYOUT_HALF_SIZE } from '../../lib/mire/mire_layout';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	MireMessageArcs — the curve of the travel of a message between two nodes of the radial graph
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** How far past the outer end the arc of a message inside one workspace bulges, in units of the view box. */
const OUTWARD_BULGE = 90;

/** The share of the middle of the two ends that the arc of a message across workspaces keeps: it bends to Heidrun. */
const INWARD_SHARE = 0.25;

/** How far to the side the arc between two ends on one ray from the centre bulges, plus half of its length. */
const SIDE_BULGE = 30;

/** Above this cosine between the line of the two ends and the ray to their middle, the two ends sit on one ray. */
const RADIAL_LIMIT = 0.8;

/** The place of one drawn node in the graph. */
export type MireNodePlace = {
	/** The centre of the node. */
	x: number;
	/** The centre of the node. */
	y: number;
	/** The node identifier of the workspace of the node. */
	workspaceNodeId: string;
};

/** Gives the curve of the travel of a message. It reads no store and draws nothing. */
export class MireMessageArcs {
	/**
	 * Gives the SVG path of the travel of a message, from the sender to the destination. Inside one workspace, the arc
	 * bulges outwards, past the subagents. Across workspaces, the arc bends towards Heidrun at the centre.
	 * @param from The place of the sender.
	 * @param to The place of the destination.
	 * @returns The SVG path, a quadratic curve.
	 */
	static path(from: MireNodePlace, to: MireNodePlace): string {
		const control = MireMessageArcs.controlPoint(from, to);
		return `M ${MireMessageArcs._round(from.x)} ${MireMessageArcs._round(from.y)} `
			+ `Q ${MireMessageArcs._round(control.x)} ${MireMessageArcs._round(control.y)} `
			+ `${MireMessageArcs._round(to.x)} ${MireMessageArcs._round(to.y)}`;
	}

	/**
	 * Gives the control point of the quadratic curve of a message. The point does not depend on the direction, so an
	 * answer travels back on the same arc.
	 * @param from The place of the sender.
	 * @param to The place of the destination.
	 * @returns The control point.
	 */
	static controlPoint(from: MireNodePlace, to: MireNodePlace): { x: number; y: number } {
		const middleX = (from.x + to.x) / 2;
		const middleY = (from.y + to.y) / 2;
		if (from.workspaceNodeId !== to.workspaceNodeId) {
			return {
				x: middleX * INWARD_SHARE,
				y: middleY * INWARD_SHARE,
			};
		}
		const middleLength = Math.hypot(middleX, middleY);
		const chordX = to.x - from.x;
		const chordY = to.y - from.y;
		const chordLength = Math.hypot(chordX, chordY);
		const isOnOneRay = middleLength > 0 && chordLength > 0
			&& Math.abs(chordX * middleX + chordY * middleY) / (chordLength * middleLength) > RADIAL_LIMIT;
		if (isOnOneRay === true) {
			// The two ends sit on one ray from the centre, for example a coding agent and its subagent: the arc bulges
			// to the clockwise side of the ray.
			const normalX = -middleY / middleLength;
			const normalY = middleX / middleLength;
			const bulge = SIDE_BULGE + chordLength * 0.5;
			return {
				x: middleX + normalX * 2 * bulge,
				y: middleY + normalY * 2 * bulge,
			};
		}
		const outerRadius = Math.min(
			MIRE_LAYOUT_HALF_SIZE - 10,
			Math.max(Math.hypot(from.x, from.y), Math.hypot(to.x, to.y)) + OUTWARD_BULGE,
		);
		const angle = middleLength === 0 ? Math.atan2(from.y, from.x) : Math.atan2(middleY, middleX);
		// The top of a quadratic curve is half way between the middle of its ends and its control point.
		const controlRadius = 2 * outerRadius - middleLength;
		return {
			x: Math.cos(angle) * controlRadius,
			y: Math.sin(angle) * controlRadius,
		};
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Rounds a coordinate to one decimal, for a short path.
	 * @param value The coordinate.
	 * @returns The rounded coordinate.
	 */
	private static _round(value: number): number {
		return Math.round(value * 10) / 10;
	}
}
