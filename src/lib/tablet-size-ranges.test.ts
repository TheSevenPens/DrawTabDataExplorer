import { describe, expect, it } from 'vitest';
import {
	penTabletRangesCm,
	penTabletRangesIn,
	displayRangesCm,
	displayRangesIn,
	mixedRangesCm,
	mixedRangesIn,
	MM_TO_IN,
	MM_TO_CM,
} from './tablet-size-ranges.js';

const ALL_BAND_SETS: { name: string; bands: { label: string; min: number; max: number }[] }[] = [
	{ name: 'penTabletRangesCm', bands: penTabletRangesCm },
	{ name: 'penTabletRangesIn', bands: penTabletRangesIn },
	{ name: 'displayRangesCm', bands: displayRangesCm },
	{ name: 'displayRangesIn', bands: displayRangesIn },
	{ name: 'mixedRangesCm', bands: mixedRangesCm },
	{ name: 'mixedRangesIn', bands: mixedRangesIn },
];

describe.each(ALL_BAND_SETS)('$name', ({ bands }) => {
	it('has at least one band', () => {
		expect(bands.length).toBeGreaterThan(0);
	});

	it('has min < max for every band', () => {
		for (const b of bands) {
			expect(b.min).toBeLessThan(b.max);
		}
	});

	it('is contiguous (each band starts where the previous ended)', () => {
		for (let i = 1; i < bands.length; i++) {
			expect(bands[i].min).toBe(bands[i - 1].max);
		}
	});

	it('has a non-empty label on every band', () => {
		for (const b of bands) {
			expect(b.label).toMatch(/\S/);
		}
	});
});

describe('unit conversion constants', () => {
	it('MM_TO_IN converts millimeters to inches (~0.03937)', () => {
		expect(MM_TO_IN).toBeCloseTo(1 / 25.4, 4);
	});

	it('MM_TO_CM converts millimeters to centimeters (= 0.1)', () => {
		expect(MM_TO_CM).toBe(0.1);
	});

	it('1 inch round-trips to ~25.4 mm', () => {
		expect(1 / MM_TO_IN).toBeCloseTo(25.4, 1);
	});
});
