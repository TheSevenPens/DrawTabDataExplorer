import { describe, it, expect } from 'vitest';
import { migrateFieldKeys, RENAMED_FIELD_KEYS } from './field-key-migrations.js';

describe('migrateFieldKeys', () => {
	it('renames a filter step field', () => {
		const steps = [{ kind: 'filter', field: 'ModelLaunchYear', operator: '>=', value: '2020' }];
		expect(migrateFieldKeys(steps)).toEqual([
			{ kind: 'filter', field: 'ModelReleaseYear', operator: '>=', value: '2020' },
		]);
	});

	it('renames a sort step field', () => {
		expect(
			migrateFieldKeys([{ kind: 'sort', field: 'ModelLaunchYear', direction: 'desc' }]),
		).toEqual([{ kind: 'sort', field: 'ModelReleaseYear', direction: 'desc' }]);
	});

	it('renames inside select/project field arrays, leaving other keys alone', () => {
		const steps = [{ kind: 'select', fields: ['Brand', 'ModelLaunchYear', 'ModelName'] }];
		expect(migrateFieldKeys(steps)).toEqual([
			{ kind: 'select', fields: ['Brand', 'ModelReleaseYear', 'ModelName'] },
		]);
	});

	it('renames groupBy entries and nested aggregator fields', () => {
		const steps = [
			{
				kind: 'summarize',
				groupBy: ['ModelLaunchYear'],
				aggs: [
					{ name: 'n', op: 'count' },
					{ name: 'oldest', op: 'min', field: 'ModelLaunchYear' },
				],
			},
		];
		expect(migrateFieldKeys(steps)).toEqual([
			{
				kind: 'summarize',
				groupBy: ['ModelReleaseYear'],
				aggs: [
					{ name: 'n', op: 'count' },
					{ name: 'oldest', op: 'min', field: 'ModelReleaseYear' },
				],
			},
		]);
	});

	it('reaches field keys nested in a filter expression tree', () => {
		const steps = [
			{
				kind: 'filterExpr',
				expr: {
					op: 'and',
					nodes: [
						{ field: 'ModelLaunchYear', op: '>=', value: '2020' },
						{ field: 'Brand', op: '==', value: 'WACOM' },
					],
				},
			},
		];
		const out = migrateFieldKeys(steps) as typeof steps;
		expect(out[0].expr.nodes[0].field).toBe('ModelReleaseYear');
		expect(out[0].expr.nodes[1].field).toBe('Brand');
	});

	it('leaves a filter *value* alone even when it matches an old key', () => {
		// The value is text the user typed, not a field reference.
		const steps = [
			{ kind: 'filter', field: 'ModelName', operator: '==', value: 'ModelLaunchYear' },
		];
		expect(migrateFieldKeys(steps)).toEqual(steps);
	});

	it('passes through unknown keys and unrelated structures unchanged', () => {
		const steps = [
			{ kind: 'take', count: 20 },
			{ kind: 'sort', field: 'Brand', direction: 'asc' },
		];
		expect(migrateFieldKeys(steps)).toEqual(steps);
	});

	it('does not mutate its input', () => {
		const steps = [{ kind: 'sort', field: 'ModelLaunchYear', direction: 'asc' }];
		migrateFieldKeys(steps);
		expect(steps[0].field).toBe('ModelLaunchYear');
	});

	it('handles nulls and primitives without throwing', () => {
		expect(migrateFieldKeys(null)).toBeNull();
		expect(migrateFieldKeys(42)).toBe(42);
		expect(migrateFieldKeys({ a: null, b: [1, 'x'] })).toEqual({ a: null, b: [1, 'x'] });
	});

	it('every mapping points at a real rename, not an identity entry', () => {
		for (const [from, to] of Object.entries(RENAMED_FIELD_KEYS)) expect(from).not.toBe(to);
	});
});
