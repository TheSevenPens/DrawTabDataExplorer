// Unit tests for the engine's public helpers (`matchesOperator`,
// `getFieldDef`, `getOperatorsForField`, `executePipeline`). The full
// verb behaviour is exercised by query.test.ts; this file pins the
// individual building blocks so a regression in (say) `matchesOperator`
// surfaces with a tight, focused failure.

import { describe, it, expect } from 'vitest';
import {
	matchesOperator,
	getFieldDef,
	getOperatorsForField,
	executePipeline,
	type AnyFieldDef,
} from '../src/index.js';

describe('matchesOperator', () => {
	it.each([
		// [val, op, refValue, expected]
		['foo', '==', 'foo', true],
		['foo', '==', 'bar', false],
		['foo', '!=', 'bar', true],
		['FooBar', 'contains', 'foo', true], // case-insensitive
		['foobar', 'contains', 'baz', false],
		['FooBar', 'containsStrict', 'foo', false], // case-sensitive
		['FooBar', 'containsStrict', 'Foo', true],
		['FooBar', 'startswith', 'foo', true], // case-insensitive
		['FooBar', 'startswithStrict', 'foo', false],
		['foo', 'notcontains', 'bar', true],
		['foo', 'notstartswith', 'bar', true],
		['', 'empty', '', true],
		['x', 'empty', '', false],
		['x', 'notempty', '', true],
		['5', '>', '3', true],
		['5', '>=', '5', true],
		['3', '<', '5', true],
		['5', '<=', '5', true],
		['5', 'between', '1|10', true],
		['11', 'between', '1|10', false],
		['a', 'in', 'a|b|c', true],
		['d', 'in', 'a|b|c', false],
		['d', 'notin', 'a|b|c', true],
	])('matchesOperator(%j, %j, %j) === %j', (val, op, ref, expected) => {
		expect(matchesOperator(val as string, op as string, ref as string)).toBe(expected);
	});

	it('numeric ops short-circuit on empty val (excludes nulls)', () => {
		expect(matchesOperator('', '>', '0')).toBe(false);
		expect(matchesOperator('', '<', '100')).toBe(false);
		expect(matchesOperator('', '>=', '0')).toBe(false);
		expect(matchesOperator('', '<=', '100')).toBe(false);
		expect(matchesOperator('', 'between', '0|100')).toBe(false);
	});

	it('contains with empty refValue matches everything (JS includes semantic)', () => {
		expect(matchesOperator('anything', 'contains', '')).toBe(true);
		expect(matchesOperator('', 'contains', '')).toBe(true);
	});

	it('unknown operator falls through to true (forgiving default)', () => {
		// The engine defaults unknown operators to pass-through rather than
		// throwing — same forgiving behaviour as unknown fields.
		expect(matchesOperator('foo', 'doesnotexist', 'bar')).toBe(true);
	});
});

describe('getFieldDef', () => {
	const fields: AnyFieldDef[] = [
		{ key: 'a', label: 'A', type: 'string', group: 'g', getValue: () => '' },
		{ key: 'b', label: 'B', type: 'number', group: 'g', getValue: () => '' },
	];

	it('returns the field-def by key', () => {
		expect(getFieldDef('a', fields)?.label).toBe('A');
	});

	it('returns undefined for unknown keys', () => {
		expect(getFieldDef('NotAField', fields)).toBeUndefined();
	});
});

describe('getOperatorsForField', () => {
	const stringField: AnyFieldDef = {
		key: 'name',
		label: 'Name',
		type: 'string',
		group: 'g',
		getValue: () => '',
	};
	const numberField: AnyFieldDef = {
		key: 'age',
		label: 'Age',
		type: 'number',
		group: 'g',
		getValue: () => '',
	};
	const enumField: AnyFieldDef = {
		key: 'kind',
		label: 'Kind',
		type: 'enum',
		group: 'g',
		getValue: () => '',
	};

	it('strings get equality, text-search, and empty operators', () => {
		const ops = getOperatorsForField(stringField).map((o) => o.value);
		expect(ops).toContain('==');
		expect(ops).toContain('contains');
		expect(ops).toContain('startswith');
		expect(ops).toContain('empty');
		// No numeric comparisons.
		expect(ops).not.toContain('>');
	});

	it('numbers get comparison + equality, no text-search', () => {
		const ops = getOperatorsForField(numberField).map((o) => o.value);
		expect(ops).toContain('>');
		expect(ops).toContain('<=');
		expect(ops).not.toContain('contains');
	});

	it('enums get equality only (no text search, no comparisons)', () => {
		const ops = getOperatorsForField(enumField).map((o) => o.value);
		expect(ops).toContain('==');
		expect(ops).toContain('empty');
		expect(ops).not.toContain('contains');
		expect(ops).not.toContain('>');
	});
});

describe('executePipeline (direct)', () => {
	const fields: AnyFieldDef[] = [
		{
			key: 'n',
			label: 'n',
			type: 'number',
			group: 'g',
			getValue: (r: { n: number }) => String(r.n),
		},
	];
	const rows = [{ n: 1 }, { n: 2 }, { n: 3 }, { n: 4 }];

	it('runs an empty step list as identity', () => {
		const out = executePipeline(rows, [], fields, []);
		expect(out.data).toEqual(rows);
	});

	it('applies a filter step', () => {
		const out = executePipeline(
			rows,
			[{ kind: 'filter', field: 'n', operator: '>', value: '2' }],
			fields,
			[],
		);
		expect(out.data).toEqual([{ n: 3 }, { n: 4 }]);
	});

	it('applies a take step', () => {
		const out = executePipeline(rows, [{ kind: 'take', count: 2 }], fields, []);
		expect(out.data).toHaveLength(2);
	});

	it('throws on an unresolved join step (caller forgot Query.toArray)', () => {
		expect(() =>
			executePipeline(
				rows,
				[{ kind: 'join', other: null, leftKey: 'n', rightKey: 'n' }],
				fields,
				[],
			),
		).toThrow(/unresolved/);
	});
});
