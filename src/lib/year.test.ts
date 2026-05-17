import { describe, expect, it } from 'vitest';
import type { Pen, Tablet } from '$data/lib/drawtab-loader.js';
import { yearNum } from './year.js';
import { compareTabletByYearDesc } from './tablet-helpers.js';
import { comparePenByYearDesc } from './pen-helpers.js';

describe('yearNum', () => {
	it('returns the number for numeric strings', () => {
		expect(yearNum('2025')).toBe(2025);
		expect(yearNum('2013')).toBe(2013);
	});

	it('returns the number when given a number', () => {
		expect(yearNum(2020)).toBe(2020);
	});

	it('coerces null, undefined, and empty string to -Infinity', () => {
		expect(yearNum(null)).toBe(-Infinity);
		expect(yearNum(undefined)).toBe(-Infinity);
		expect(yearNum('')).toBe(-Infinity);
	});

	it('coerces garbage strings to -Infinity', () => {
		expect(yearNum('unknown')).toBe(-Infinity);
		expect(yearNum('TBD')).toBe(-Infinity);
	});
});

const TABLET = (year: unknown): Tablet =>
	({ Meta: { EntityId: `t-${year}` }, Model: { LaunchYear: year } }) as unknown as Tablet;

const PEN = (year: unknown): Pen => ({ EntityId: `p-${year}`, PenYear: year }) as unknown as Pen;

describe('compareTabletByYearDesc', () => {
	it('sorts newest first', () => {
		const sorted = [TABLET('2013'), TABLET('2025'), TABLET('2018')].sort(compareTabletByYearDesc);
		expect(sorted.map((t) => t.Model.LaunchYear)).toEqual(['2025', '2018', '2013']);
	});

	it('sinks null/undefined LaunchYear to the bottom', () => {
		const sorted = [TABLET(null), TABLET('2020'), TABLET(undefined), TABLET('2010')].sort(
			compareTabletByYearDesc,
		);
		expect(sorted.map((t) => t.Model.LaunchYear)).toEqual(['2020', '2010', null, undefined]);
	});

	it('returns 0 for equal years (stable sort behaviour)', () => {
		expect(compareTabletByYearDesc(TABLET('2020'), TABLET('2020'))).toBe(0);
	});
});

describe('comparePenByYearDesc', () => {
	it('sorts newest first', () => {
		const sorted = [PEN('2009'), PEN('2024'), PEN('2015')].sort(comparePenByYearDesc);
		expect(sorted.map((p) => p.PenYear)).toEqual(['2024', '2015', '2009']);
	});

	it('sinks null/undefined PenYear to the bottom', () => {
		const sorted = [PEN(undefined), PEN('2020'), PEN(null)].sort(comparePenByYearDesc);
		expect(sorted.map((p) => p.PenYear)).toEqual(['2020', undefined, null]);
	});

	it('returns 0 for equal years', () => {
		expect(comparePenByYearDesc(PEN('2020'), PEN('2020'))).toBe(0);
	});
});
