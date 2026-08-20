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
const brandOptions = [
	{ id: 'WACOM', label: 'WACOM' },
	{ id: 'XPPEN', label: 'XPPEN' },
];

const yearSpec: QuickFilterSpec = {
	field: 'ModelReleaseYear',
	operator: '>=',
	anyLabel: 'Any release year',
	options: [{ id: '2020', label: '2020 or later' }],
};

// The shape that needs two operators off one dropdown.
const inventorySpec: QuickFilterSpec = {
	field: 'UnitsInInventory',
	operator: '>',
	anyLabel: 'Any inventory',
	options: [
		{ id: 'owned', label: 'In inventory', operator: '>', value: '0' },
		{ id: 'unowned', label: 'Not in inventory', operator: '==', value: '0' },
	],
};

describe('currentValue', () => {
	it('reads back the choice the filter corresponds to', () => {
		const filters: BuilderFilter[] = [{ field: 'Brand', operator: '==', value: 'WACOM' }];
		expect(currentValue(filters, brandSpec, brandOptions)).toBe('WACOM');
	});

	it('is empty when nothing matches', () => {
		expect(currentValue([], brandSpec, brandOptions)).toBe('');
	});

	it('ignores a filter on the same field with an operator the spec cannot emit', () => {
		// The dropdown owns Brand ==; a hand-written Brand != is not its business.
		const filters: BuilderFilter[] = [{ field: 'Brand', operator: '!=', value: 'HUION' }];
		expect(currentValue(filters, brandSpec, brandOptions)).toBe('');
	});

	it('reads empty for a disabled filter — it is not narrowing anything', () => {
		const filters: BuilderFilter[] = [
			{ field: 'Brand', operator: '==', value: 'WACOM', disabled: true },
		];
		expect(currentValue(filters, brandSpec, brandOptions)).toBe('');
	});

	it('reads empty when the value matches no offered choice', () => {
		const filters: BuilderFilter[] = [{ field: 'Brand', operator: '==', value: 'NOTABRAND' }];
		expect(currentValue(filters, brandSpec, brandOptions)).toBe('');
	});

	it('distinguishes two choices that share a value but differ by operator', () => {
		const owned: BuilderFilter[] = [{ field: 'UnitsInInventory', operator: '>', value: '0' }];
		const unowned: BuilderFilter[] = [{ field: 'UnitsInInventory', operator: '==', value: '0' }];
		expect(currentValue(owned, inventorySpec)).toBe('owned');
		expect(currentValue(unowned, inventorySpec)).toBe('unowned');
	});
});

describe('withQuickFilter', () => {
	it('appends when the spec owns nothing yet', () => {
		expect(withQuickFilter([], brandSpec, 'WACOM', brandOptions)).toEqual([
			{ field: 'Brand', operator: '==', value: 'WACOM' },
		]);
	});

	it('updates in place, so the pill keeps its position', () => {
		const filters: BuilderFilter[] = [
			{ field: 'Brand', operator: '==', value: 'WACOM' },
			{ field: 'ModelName', operator: 'contains', value: 'Pro' },
		];
		expect(withQuickFilter(filters, brandSpec, 'XPPEN', brandOptions)).toEqual([
			{ field: 'Brand', operator: '==', value: 'XPPEN' },
			{ field: 'ModelName', operator: 'contains', value: 'Pro' },
		]);
	});

	it('removes the owned filter when cleared, leaving the others', () => {
		const filters: BuilderFilter[] = [
			{ field: 'Brand', operator: '==', value: 'WACOM' },
			{ field: 'ModelName', operator: 'contains', value: 'Pro' },
		];
		expect(withQuickFilter(filters, brandSpec, '', brandOptions)).toEqual([
			{ field: 'ModelName', operator: 'contains', value: 'Pro' },
		]);
	});

	it('clearing when nothing is owned is a no-op', () => {
		const filters: BuilderFilter[] = [{ field: 'ModelName', operator: 'contains', value: 'Pro' }];
		expect(withQuickFilter(filters, brandSpec, '', brandOptions)).toEqual(filters);
	});

	it('leaves a same-field filter with an unowned operator untouched', () => {
		const filters: BuilderFilter[] = [{ field: 'Brand', operator: '!=', value: 'HUION' }];
		expect(withQuickFilter(filters, brandSpec, 'WACOM', brandOptions)).toEqual([
			{ field: 'Brand', operator: '!=', value: 'HUION' },
			{ field: 'Brand', operator: '==', value: 'WACOM' },
		]);
	});

	it('writes the operator and value a choice overrides', () => {
		expect(withQuickFilter([], inventorySpec, 'unowned')).toEqual([
			{ field: 'UnitsInInventory', operator: '==', value: '0' },
		]);
	});

	it('replaces across operators rather than stacking contradictory filters', () => {
		// > 0 and == 0 together match nothing, so switching must swap, not add.
		const owned = withQuickFilter([], inventorySpec, 'owned');
		const swapped = withQuickFilter(owned, inventorySpec, 'unowned');
		expect(swapped).toEqual([{ field: 'UnitsInInventory', operator: '==', value: '0' }]);
	});

	it('clears a choice that overrode the operator', () => {
		const unowned = withQuickFilter([], inventorySpec, 'unowned');
		expect(withQuickFilter(unowned, inventorySpec, '')).toEqual([]);
	});

	it('does not mutate the input array or its entries', () => {
		const filters: BuilderFilter[] = [{ field: 'Brand', operator: '==', value: 'WACOM' }];
		const snapshot = JSON.parse(JSON.stringify(filters));
		withQuickFilter(filters, brandSpec, 'XPPEN', brandOptions);
		expect(filters).toEqual(snapshot);
	});

	it('round-trips: set then read gives back what was set', () => {
		for (const id of ['2020', '']) {
			const set = withQuickFilter([], yearSpec, id);
			expect(currentValue(set, yearSpec)).toBe(id);
		}
		for (const id of ['owned', 'unowned', '']) {
			const set = withQuickFilter([], inventorySpec, id);
			expect(currentValue(set, inventorySpec)).toBe(id);
		}
	});
});

describe('optionsFor', () => {
	it('uses explicit options when the spec provides them', () => {
		expect(optionsFor(yearSpec, undefined)).toEqual([{ id: '2020', label: '2020 or later' }]);
	});

	it('derives choices from the field def enum values otherwise', () => {
		const fieldDef = { key: 'Brand', enumValues: ['WACOM', 'XPPEN'] } as AnyFieldDisplayDef;
		expect(optionsFor(brandSpec, fieldDef)).toEqual(brandOptions);
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

	it('never lets two specs in one collection own overlapping field and operator', () => {
		// Two dropdowns sharing a pair would fight over the same filter entry.
		for (const [collection, specs] of Object.entries(QUICK_FILTERS)) {
			const pairs: string[] = [];
			for (const spec of specs) {
				const ops = new Set([
					spec.operator,
					...(spec.options ?? []).map((o) => o.operator ?? spec.operator),
				]);
				for (const op of ops) pairs.push(`${spec.field} ${op}`);
			}
			expect(new Set(pairs).size, `${collection} has an overlapping spec`).toBe(pairs.length);
		}
	});

	it('keeps option ids unique within a spec, so read-back is unambiguous', () => {
		for (const [collection, specs] of Object.entries(QUICK_FILTERS)) {
			for (const spec of specs) {
				const ids = (spec.options ?? []).map((o) => o.id);
				expect(new Set(ids).size, `${collection}/${spec.field} has a duplicate option id`).toBe(
					ids.length,
				);
			}
		}
	});
});
