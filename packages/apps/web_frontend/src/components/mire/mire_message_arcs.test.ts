// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { MireMessageArcs, type MireNodePlace } from './mire_message_arcs';

/**
 * Builds a place on a ring of the graph.
 * @param radius The distance to Heidrun.
 * @param degrees The angle, clockwise from the right.
 * @param workspaceNodeId The workspace of the node.
 * @returns The place.
 */
function place(radius: number, degrees: number, workspaceNodeId: string): MireNodePlace {
	const angle = (degrees * Math.PI) / 180;
	return {
		x: Math.cos(angle) * radius,
		y: Math.sin(angle) * radius,
		workspaceNodeId,
	};
}

describe('MireMessageArcs', () => {
	it('bulges the arc of a message inside one workspace outwards, past the subagents', () => {
		const control = MireMessageArcs.controlPoint(place(295, 80, 'w1'), place(295, 100, 'w1'));
		expect(Math.hypot(control.x, control.y)).toBeGreaterThan(405);
	});

	it('bends the arc of a message across two workspaces towards Heidrun', () => {
		const from = place(295, 0, 'w1');
		const to = place(295, 120, 'w2');
		const control = MireMessageArcs.controlPoint(from, to);
		expect(Math.hypot(control.x, control.y)).toBeLessThan(Math.hypot((from.x + to.x) / 2, (from.y + to.y) / 2));
	});

	it('bulges to the side of the ray when the two ends sit on one ray from the centre', () => {
		const control = MireMessageArcs.controlPoint(place(295, 90, 'w1'), place(405, 90, 'w1'));
		expect(Math.abs(control.x)).toBeGreaterThan(50);
	});

	it('gives the same arc to a message and to its answer', () => {
		for (const [from, to] of [
			[place(295, 80, 'w1'), place(295, 100, 'w1')],
			[place(295, 90, 'w1'), place(405, 90, 'w1')],
			[place(295, 0, 'w1'), place(295, 120, 'w2')],
		]) {
			const there = MireMessageArcs.controlPoint(from, to);
			const back = MireMessageArcs.controlPoint(to, from);
			expect(back.x).toBeCloseTo(there.x);
			expect(back.y).toBeCloseTo(there.y);
		}
		expect(MireMessageArcs.path(place(10, 0, 'w1'), place(20, 0, 'w2'))).toMatch(/^M 10 0 Q [-\d.]+ [-\d.]+ 20 0$/);
	});
});
