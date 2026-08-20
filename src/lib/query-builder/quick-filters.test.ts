import { describe, it, expect } from 'vitest';
import type { AnyFieldDisplayDef } from '@thesevenpens/queriton';
import type { BuilderFilter } from './mockup-templates.js';
import {
	QUICK_FILTERS,
	optionsFor,
	currentValue,
	withQuickFilter,
	type QuickFilterSpec,
} from './quick-filters.js';

const brandSpec: QuickFilterSpec = { field: 'Brand', operator: '==', anyLabel: 'All brands' };
const yearSpec: QuickFilterSpec = {
	field: 'ModelReleaseYear',
	operator: '>=',
	anyLabel: 'Any release year',
	options: [{ value: '2020', label: '2020 or later' }],
};

describe('currentValue', () => {
	it('reads the value of the filter the spec owns', () => {
		const filters: BuilderFilter[] = [{ field: 'Brand', operator: '==', value: 'WACOM' }];
		expect(currentValue(filters, brandSpec)).toBe('WACOM');
	});

	it('is empty when nothing matches', () => {
		expect(currentValue([], brandSpec)).toBe('');
	});

	it('ignores a filter on the same field with a different operator', () => {
		// The dropdown owns Brand ==; a hand-written Brand != is not its business.
		const filters: BuilderFilter[] = [{ field: 'Brand', operator: '!=', value: 'HUION' }];
		expect(currentValue(filters, brandSpec)).toBe('');
	});

	it('reads empty for a disabled filter — it is not narrowing anything', () => {
		const filters: BuilderFilter[] = [
			{ field: 'Brand', operator: '==', value: 'WACOM', disabled: true },
		];
		expect(currentValue(filters, brandSpec)).toBe('');
	});
});

describe('withQuickFilter', () => {
	it('appends when the spec owns nothing yet', () => {
		expect(withQuickFilter([], brandSpec, 'WACOM')).toEqual([
			{ field: 'Brand', operator: '==', value: 'WACOM' },
		]);
	});

	it('updates in place, so the pill keeps its position', () => {
		const filters: BuilderFilter[] = [
			{ field: 'Brand', operator: '==', value: 'WACOM' },
			{ field: 'ModelName', operator: 'contains', value: 'Pro' },
		];
		expect(withQuickFilter(filters, brandSpec, 'XPPEN')).toEqual([
			{ field: 'Brand', operator: '==', value: 'XPPEN' },
			{ field: 'ModelName', operator: 'contains', value: 'Pro' },
		]);
	});

	it('removes the owned filter when cleared, leaving the others', () => {
		const filters: BuilderFilter[] = [
			{ field: 'Brand', operator: '==', value: 'WACOM' },
			{ field: 'ModelName', operator: 'contains', value: 'Pro' },
		];
		expect(withQuickFilter(filters, brandSpec, '')).toEqual([
			{ field: 'ModelName', operator: 'contains', value: 'Pro' },
		]);
	});

	it('clearing when nothing is owned is a no-op', () => {
		const filters: BuilderFilter[] = [{ field: 'ModelName', operator: 'contains', value: 'Pro' }];
		expect(withQuickFilter(filters, brandSpec, '')).toEqual(filters);
	});

	it('leaves a same-field filter with a different operator untouched', () => {
		const filters: BuilderFilter[] = [{ field: 'Brand', operator: '!=', value: 'HUION' }];
		expect(withQuickFilter(filters, brandSpec, 'WACOM')).toEqual([
			{ field: 'Brand', operator: '!=', value: 'HUION' },
			{ field: 'Brand', operator: '==', value: 'WACOM' },
		]);
	});

	it('does not mutate the input array or its entries', () => {
		const filters: BuilderFilter[] = [{ field: 'Brand', operator: '==', value: 'WACOM' }];
		const snapshot = JSON.parse(JSON.stringify(filters));
		withQuickFilter(filters, brandSpec, 'XPPEN');
		expect(filters).toEqual(snapshot);
	});

	it('round-trips: set then read gives back what was set', () => {
		const set = withQuickFilter([], yearSpec, '2020');
		expect(currentValue(set, yearSpec)).toBe('2020');
		expect(currentValue(withQuickFilter(set, yearSpec, ''), yearSpec)).toBe('');
	});
});

describe('optionsFor', () => {
	it('uses explicit options when the spec provides them', () => {
		expect(optionsFor(yearSpec, undefined)).toEqual([{ value: '2020', label: '2020 or later' }]);
	});

	it('derives choices from the field def enum values otherwise', () => {
		const fieldDef = { key: 'Brand', enumValues: ['WACOM', 'XPPEN'] } as AnyFieldDisplayDef;
		expect(optionsFor(brandSpec, fieldDef)).toEqual([
			{ value: 'WACOM', label: 'WACOM' },
			{ value: 'XPPEN', label: 'XPPEN' },
		]);
	});

	it('yields nothing when the field def is missing or has no enum values', () => {
		expect(optionsFor(brandSpec, undefined)).toEqual([]);
		expect(optionsFor(brandSpec, { key: 'Brand' } as AnyFieldDisplayDef)).toEqual([]);
	});
});

describe('QUICK_FILTERS config', () => {
	it('gives every collection at least one spec', () => {
		for (const [collection, specs] of Object.entries(QUICK_FILTERS)) {
			expect(specs.length, `${collection} has no quick filters`).toBeGreaterThan(0);
		}
	});

	it('never lets two specs in one collection own the same field and operator', () => {
		// Two dropdowns owning one pair would fight over the same filter entry.
		for (const [collection, specs] of Object.entries(QUICK_FILTERS)) {
			const pairs = specs.map((s) => `${s.field} ${s.operator}`);
			expect(new Set(pairs).size, `${collection} has a duplicate spec`).toBe(pairs.length);
		}
	});
});
