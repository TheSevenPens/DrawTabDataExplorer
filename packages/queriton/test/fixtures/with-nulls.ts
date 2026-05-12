// Null-handling fixture. Every column has at least one null / undefined /
// empty value, and the `value` column has both numeric strings and a
// non-numeric string so numeric aggregators have something to skip.
//
// Designed so each test in nulls.test.ts can assert exactly one rule
// without leaning on coincidental neighbours.

import type { AnyFieldDef } from '../../src/index.js';

export interface NullRow {
	id: string;
	category: string | null;
	value: number | string | null; // mostly numeric, one non-numeric
	tag: string | null;
}

export const withNulls: NullRow[] = [
	{ id: 'a', category: 'X', value: 10, tag: 'red' },
	{ id: 'b', category: 'X', value: 20, tag: null }, // null tag
	{ id: 'c', category: 'Y', value: null, tag: 'blue' }, // null value
	{ id: 'd', category: null, value: 30, tag: 'red' }, // null category
	{ id: 'e', category: 'Y', value: 0, tag: '' }, // empty-string tag (treated like null)
	{ id: 'f', category: 'Z', value: 40, tag: 'green' },
	{ id: 'g', category: null, value: 'oops', tag: null }, // non-numeric value + null category + null tag
	{ id: 'h', category: 'X', value: 50, tag: 'red' },
];

function field<T>(key: string, type: 'string' | 'number' = 'string'): AnyFieldDef {
	return {
		key,
		label: key,
		type,
		group: 'data',
		getValue: (row: T) => {
			const v = (row as Record<string, unknown>)[key];
			return v == null ? '' : String(v);
		},
	};
}

export const withNullsFields: AnyFieldDef[] = [
	field<NullRow>('id'),
	field<NullRow>('category'),
	field<NullRow>('value', 'number'),
	field<NullRow>('tag'),
];
