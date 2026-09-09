import { describe, it, expect } from 'vitest';
import { fitContain } from './pptx-export.js';

// The slide's content area, from the module's own layout constants
// (LAYOUT_WIDE 13.333 x 7.5 in, 0.5" margins, 0.6" title + 0.15" gap).
const AVAIL_W = 13.333 - 2 * 0.5;
const AVAIL_H = 7.5 - (0.5 + 0.6 + 0.15) - 0.5;

// The box is far wider than it is tall (~2.14), so "wide" here means wider
// than THAT, not wider than square — a 16:9 chart is height-constrained in
// this slide, which is the case worth pinning.
const BOX_ASPECT = AVAIL_W / AVAIL_H;

describe('fitContain', () => {
	it('fills the width when the image is wider than the box', () => {
		const { w, h } = fitContain(AVAIL_W, AVAIL_H, BOX_ASPECT * 1.5);
		expect(w).toBeCloseTo(AVAIL_W);
		expect(h).toBeLessThanOrEqual(AVAIL_H);
	});

	it('fills the height when the image is taller than the box', () => {
		for (const aspect of [1 / 2, 1, 16 / 9]) {
			expect(aspect).toBeLessThan(BOX_ASPECT);
			const { w, h } = fitContain(AVAIL_W, AVAIL_H, aspect);
			expect(h).toBeCloseTo(AVAIL_H);
			expect(w).toBeLessThanOrEqual(AVAIL_W);
		}
	});

	it('never exceeds the box in either dimension', () => {
		for (const aspect of [0.1, 0.5, 1, 1.5, 16 / 9, 4, 20]) {
			const { w, h } = fitContain(AVAIL_W, AVAIL_H, aspect);
			expect(w).toBeLessThanOrEqual(AVAIL_W + 1e-9);
			expect(h).toBeLessThanOrEqual(AVAIL_H + 1e-9);
		}
	});

	// "Contain", not "cover" — a chart cropped to fill the slide would hide
	// axis labels, which is worse than letterboxing.
	it('preserves the aspect ratio exactly', () => {
		for (const aspect of [0.4, 1, 2.35, 16 / 9]) {
			const { w, h } = fitContain(AVAIL_W, AVAIL_H, aspect);
			expect(w / h).toBeCloseTo(aspect, 10);
		}
	});

	it('touches at least one edge of the box, so it is the largest such fit', () => {
		for (const aspect of [0.4, 1, 2.35, 16 / 9]) {
			const { w, h } = fitContain(AVAIL_W, AVAIL_H, aspect);
			const touches = Math.abs(w - AVAIL_W) < 1e-9 || Math.abs(h - AVAIL_H) < 1e-9;
			expect(touches).toBe(true);
		}
	});

	it('fills the box when the aspect is unknown', () => {
		// An image whose intrinsic size the caller could not determine.
		for (const bad of [Number.NaN, 0, -2, Number.POSITIVE_INFINITY]) {
			expect(fitContain(AVAIL_W, AVAIL_H, bad)).toEqual({ w: AVAIL_W, h: AVAIL_H });
		}
	});

	it('centres square in a square box', () => {
		expect(fitContain(5, 5, 1)).toEqual({ w: 5, h: 5 });
	});
});
