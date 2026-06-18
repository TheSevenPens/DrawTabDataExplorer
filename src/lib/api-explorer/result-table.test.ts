import { describe, it, expect } from 'vitest';
import { buildTableShape, formatCell, stripMetaNoise } from './result-table.js';

describe('formatCell', () => {
	it('renders primitives directly and blanks for null/undefined', () => {
		expect(formatCell('hi')).toBe('hi');
		expect(formatCell(42)).toBe('42');
		expect(formatCell(false)).toBe('false');
		expect(formatCell(null)).toBe('');
		expect(formatCell(undefined)).toBe('');
	});

	it('joins primitive arrays and summarises object arrays', () => {
		expect(formatCell(['a', 'b', 'c'])).toBe('a, b, c');
		expect(formatCell([])).toBe('[]');
		expect(formatCell([{ x: 1 }, { x: 2 }])).toBe('[2 items]');
		expect(formatCell([{ x: 1 }])).toBe('[1 item]');
	});

	it('truncates long joined arrays with an ellipsis', () => {
		const long = Array.from({ length: 100 }, (_, i) => `v${i}`);
		const out = formatCell(long);
		expect(out.length).toBe(120);
		expect(out.endsWith('…')).toBe(true);
	});

	it('summarises objects by key count', () => {
		expect(formatCell({})).toBe('{}');
		expect(formatCell({ a: 1, b: 2 })).toBe('{2 keys}');
	});
});

describe('buildTableShape', () => {
	it('flattens an array of objects with dot-paths and unions columns first-seen', () => {
		const shape = buildTableShape([
			{ Model: { Brand: 'WACOM', Id: 'A' } },
			{ Model: { Brand: 'HUION', Id: 'B' }, Extra: 'x' },
		]);
		expect(shape.kind).toBe('array-of-objects');
		if (shape.kind !== 'array-of-objects') return;
		expect(shape.columns).toEqual(['Model.Brand', 'Model.Id', 'Extra']);
		expect(shape.rows[0]['Model.Brand']).toBe('WACOM');
		expect(shape.rows[1]['Extra']).toBe('x');
	});

	it('shapes a plain object as Key/Value rows', () => {
		const shape = buildTableShape({ a: 1, b: 'two' });
		expect(shape.kind).toBe('object');
		if (shape.kind !== 'object') return;
		expect(shape.rows).toEqual([
			{ Key: 'a', Value: '1' },
			{ Key: 'b', Value: 'two' },
		]);
	});

	it('shapes an array of primitives under a single Value column', () => {
		const shape = buildTableShape(['PENTABLET', 'PENDISPLAY']);
		expect(shape.kind).toBe('array-of-primitives');
		if (shape.kind !== 'array-of-primitives') return;
		expect(shape.rows.map((r) => r.Value)).toEqual(['PENTABLET', 'PENDISPLAY']);
	});

	it('reports not-tabular for empty, null, mixed-shape, and primitive inputs', () => {
		expect(buildTableShape([]).kind).toBe('not-tabular');
		expect(buildTableShape(null).kind).toBe('not-tabular');
		expect(buildTableShape([1, { a: 1 }]).kind).toBe('not-tabular');
		expect(buildTableShape(42).kind).toBe('not-tabular');
	});
});

describe('stripMetaNoise', () => {
	it('drops bookkeeping keys but keeps Meta.EntityId, recursing into arrays', () => {
		const input = [
			{
				_id: 'x1',
				_CreateDate: 'd',
				_ModifiedDate: 'd2',
				Name: 'Pen',
				Meta: { EntityId: 'wacom.pen.kp503e', _id: 'inner', _CreateDate: 'z' },
			},
		];
		const out = stripMetaNoise(input) as Record<string, unknown>[];
		expect(out[0]).not.toHaveProperty('_id');
		expect(out[0]).not.toHaveProperty('_CreateDate');
		expect(out[0]).not.toHaveProperty('_ModifiedDate');
		expect(out[0].Name).toBe('Pen');
		expect(out[0].Meta).toEqual({ EntityId: 'wacom.pen.kp503e' });
	});

	it('passes primitives through unchanged', () => {
		expect(stripMetaNoise('hi')).toBe('hi');
		expect(stripMetaNoise(7)).toBe(7);
		expect(stripMetaNoise(null)).toBe(null);
	});
});
