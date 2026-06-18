import { describe, it, expect } from 'vitest';
import {
	gcd,
	diagonalCm,
	diagonalIn,
	getResolutionCategory,
	closestISOA,
	formatBandRange,
	sortBandsByRank,
	paperSizeExportRows,
	type PaperSize,
} from './reference-data.js';
import type { ISOPaperSize } from '$data/lib/drawtab-loader.js';

describe('gcd', () => {
	it('computes the greatest common divisor', () => {
		expect(gcd(1920, 1080)).toBe(120);
		expect(gcd(2560, 1600)).toBe(320);
		expect(gcd(7, 0)).toBe(7);
	});
});

describe('diagonals', () => {
	it('computes a 3-4-5 diagonal in cm from mm inputs', () => {
		// 30mm × 40mm → 50mm hypotenuse → 5.0 cm
		expect(diagonalCm(30, 40)).toBeCloseTo(5, 5);
	});
	it('computes a diagonal in inches from inch inputs', () => {
		expect(diagonalIn(3, 4)).toBeCloseTo(5, 5);
	});
});

describe('getResolutionCategory', () => {
	it('buckets known resolutions and falls back to Other', () => {
		expect(getResolutionCategory(1920, 1080)).toBe('Full HD');
		expect(getResolutionCategory(2560, 1440)).toBe('2.5K');
		expect(getResolutionCategory(2560, 1600)).toBe('2.5K');
		expect(getResolutionCategory(2880, 1800)).toBe('3K');
		expect(getResolutionCategory(3840, 2160)).toBe('4K');
		expect(getResolutionCategory(1366, 768)).toBe('Other');
	});
});

describe('closestISOA', () => {
	const aSeries: ISOPaperSize[] = [
		{ Series: 'A', Name: 'A4', Width_mm: 210, Height_mm: 297, Width_in: 8.3, Height_in: 11.7 },
		{ Series: 'A', Name: 'A3', Width_mm: 297, Height_mm: 420, Width_in: 11.7, Height_in: 16.5 },
	];

	it('returns blanks when the A-series list is empty', () => {
		expect(closestISOA([], 30)).toEqual({ name: '', diagCm: '', diagIn: '' });
	});

	it('picks the A size whose diagonal is closest to the midpoint', () => {
		// A4 diagonal ≈ 36.4 cm, A3 ≈ 51.5 cm.
		expect(closestISOA(aSeries, 36).name).toBe('A4');
		expect(closestISOA(aSeries, 50).name).toBe('A3');
	});
});

describe('formatBandRange', () => {
	it('formats a min–max range with the unit on both ends', () => {
		expect(formatBandRange({ label: 'B', min: 2, max: 3.5 }, 'gf')).toBe('2 gf to 3.5 gf');
	});
});

describe('sortBandsByRank', () => {
	it('orders bands S, A, B, C, D, X and preserves extra fields', () => {
		const bands = [
			{ label: 'D', min: 100, max: 150, name: 'AVOID' },
			{ label: 'S', min: 500, max: 900, name: 'EXCELLENT' },
			{ label: 'B', min: 200, max: 350, name: 'GOOD' },
		];
		const sorted = sortBandsByRank(bands);
		expect(sorted.map((b) => b.label)).toEqual(['S', 'B', 'D']);
		// extra `name` field survives (generic, not widened to SpecBand)
		expect(sorted[0].name).toBe('EXCELLENT');
	});
});

describe('paperSizeExportRows', () => {
	const sizes: PaperSize[] = [
		{ Series: 'A', Name: 'A4', Width_mm: 210, Height_mm: 297, Width_in: 8.3, Height_in: 11.7 },
	];

	it('omits the Series column by default', () => {
		const rows = paperSizeExportRows(sizes);
		expect(rows[0][0]).toBe('A4');
		expect(rows[0][1]).toBe('21.0'); // width cm — no Series inserted
		expect(rows[0]).toHaveLength(7);
	});

	it('includes the Series column when requested', () => {
		const rows = paperSizeExportRows(sizes, { includeSeries: true });
		expect(rows[0][0]).toBe('A4');
		expect(rows[0][1]).toBe('A'); // Series
		expect(rows[0][2]).toBe('21.0'); // width cm
		expect(rows[0]).toHaveLength(8);
	});
});
