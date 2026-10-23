import { describe, expect, it } from 'vitest';
import { PIAF_BANDS, PMAX_BANDS, type Band } from './bands.js';

const rows = (bands: Band[]) => bands.map((b) => [b.label, b.name, b.min, b.max]);

/** The band a value falls in: lower edge included, upper edge excluded. */
const rankOf = (bands: Band[], v: number) =>
	bands.find((b) => v >= b.min && (b.max === null || v < b.max))?.label;

// The 7P Demos "IAF ranking" and "Max pressure ranking" pages (GitHub #408).
describe('PIAF_BANDS', () => {
	it('matches the IAF ranking', () => {
		expect(rows(PIAF_BANDS)).toEqual([
			['S', 'SUPER', 0, 1],
			['A', 'GREAT', 1, 2],
			['B', 'GOOD', 2, 4],
			['C', 'OK', 4, 6],
			['D', 'AVOID', 6, 10],
			['F', 'FAIL', 10, null],
		]);
	});

	it('includes the lower edge and excludes the upper edge', () => {
		expect(rankOf(PIAF_BANDS, 0)).toBe('S');
		expect(rankOf(PIAF_BANDS, 4)).toBe('C');
		expect(rankOf(PIAF_BANDS, 9.99)).toBe('D');
		expect(rankOf(PIAF_BANDS, 10)).toBe('F');
	});
});

describe('PMAX_BANDS', () => {
	it('matches the max pressure ranking', () => {
		expect(rows(PMAX_BANDS)).toEqual([
			['F', 'FAIL', 0, 100],
			['D', 'AVOID', 100, 200],
			['C', 'OK', 200, 300],
			['B', 'GOOD', 300, 400],
			['A', 'GREAT', 400, 500],
			['S', 'SUPER', 500, 900],
			['X', 'EXCESSIVE', 900, null],
		]);
	});

	it('includes the lower edge and excludes the upper edge', () => {
		expect(rankOf(PMAX_BANDS, 50)).toBe('F');
		expect(rankOf(PMAX_BANDS, 300)).toBe('B');
		expect(rankOf(PMAX_BANDS, 900)).toBe('X');
	});
});

describe.each([
	['PIAF_BANDS', PIAF_BANDS],
	['PMAX_BANDS', PMAX_BANDS],
])('%s', (_, bands) => {
	it('starts at 0 and leaves no gaps', () => {
		expect(bands[0].min).toBe(0);
		for (let i = 1; i < bands.length; i++) expect(bands[i].min).toBe(bands[i - 1].max);
		expect(bands.at(-1)?.max).toBeNull();
	});
});
