import { describe, it, expect } from 'vitest';
import { compareValues, sortRows } from './sortable-table.js';

describe('compareValues', () => {
	it('compares numbers numerically', () => {
		expect(compareValues(2, 10)).toBeLessThan(0);
		expect(compareValues(10, 2)).toBeGreaterThan(0);
		expect(compareValues(5, 5)).toBe(0);
	});

	it('compares strings with natural (numeric-aware) order', () => {
		expect(compareValues('A2', 'A10')).toBeLessThan(0);
		expect(compareValues('item10', 'item9')).toBeGreaterThan(0);
		expect(compareValues('b', 'a')).toBeGreaterThan(0);
	});
});

describe('sortRows', () => {
	const rows = [
		{ n: 'A10', v: 3 },
		{ n: 'A2', v: 1 },
		{ n: 'A1', v: 2 },
	];

	it('sorts ascending by a string accessor (natural order)', () => {
		expect(sortRows(rows, (r) => r.n, 'asc').map((r) => r.n)).toEqual(['A1', 'A2', 'A10']);
	});

	it('sorts ascending and descending by a numeric accessor', () => {
		expect(sortRows(rows, (r) => r.v, 'asc').map((r) => r.v)).toEqual([1, 2, 3]);
		expect(sortRows(rows, (r) => r.v, 'desc').map((r) => r.v)).toEqual([3, 2, 1]);
	});

	it('does not mutate the input array', () => {
		const before = rows.map((r) => r.n);
		sortRows(rows, (r) => r.v, 'asc');
		expect(rows.map((r) => r.n)).toEqual(before);
	});

	it('is stable for equal keys', () => {
		const r = [
			{ n: 'x', k: 1 },
			{ n: 'y', k: 1 },
			{ n: 'z', k: 1 },
		];
		expect(sortRows(r, (x) => x.k, 'asc').map((x) => x.n)).toEqual(['x', 'y', 'z']);
	});
});
