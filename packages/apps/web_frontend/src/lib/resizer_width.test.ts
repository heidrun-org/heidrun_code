// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { ResizerWidth } from './resizer_width';

describe('ResizerWidth.clamp', () => {
	const limits = {
		min: 200,
		reserve: 0,
	};

	const limitsWithMax = {
		...limits,
		max: 520,
	};

	it('keeps a width that is between the limits', () => {
		expect(ResizerWidth.clamp(300, limits, 2000)).toBe(300);
	});

	it('raises a width that is under the smallest width', () => {
		expect(ResizerWidth.clamp(50, limits, 2000)).toBe(200);
	});

	it('lowers a width that is over the largest width, when the column has a largest width', () => {
		expect(ResizerWidth.clamp(900, limitsWithMax, 2000)).toBe(520);
	});

	it('keeps a wide width, when the column has no largest width', () => {
		expect(ResizerWidth.clamp(1500, limits, 2000)).toBe(1500);
	});

	it('leaves 400 pixels to the middle of the window, when the column has no largest width', () => {
		expect(ResizerWidth.clamp(5000, limits, 2000)).toBe(1600);
	});

	it('leaves 400 pixels to the middle of the window, after the width of the other columns', () => {
		const withReserve = {
			...limits,
			reserve: 300,
		};
		expect(ResizerWidth.clamp(900, withReserve, 1000)).toBe(300);
	});

	it('rounds to a whole number of pixels', () => {
		expect(ResizerWidth.clamp(300.6, limits, 2000)).toBe(301);
	});
});
