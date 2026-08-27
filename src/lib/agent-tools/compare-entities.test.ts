import { describe, expect, it } from 'vitest';
import { compareEntities, type ComparableField } from './compare-entities.js';
import type { FieldRole } from '$lib/field-roles.js';

type Row = Record<string, string>;
const F = (key: string, group = 'Model'): ComparableField<Row> => ({
	key,
	label: key,
	group,
	getValue: (r) => r[key] ?? '',
});

const ROLES: Record<string, FieldRole> = {
	Name: 'identity',
	EntityId: 'identity',
	LinkCount: 'metadata',
	Weight: 'spec',
	Contrast: 'spec',
	Lamination: 'spec',
	Brightness: 'spec',
	Notes: 'spec',
};
const roleOf = (k: string) => ROLES[k];

const FIELDS = [
	F('Name'),
	F('EntityId'),
	F('LinkCount'),
	F('Weight', 'Physical'),
	F('Contrast', 'Display'),
	F('Lamination', 'Display'),
	F('Brightness', 'Display'),
	F('Notes'),
];

const A: Row = {
	Name: 'Kamvas 22',
	EntityId: 'a',
	LinkCount: '1',
	Weight: '3900',
	Contrast: '1000',
	Lamination: 'NO',
	Brightness: '220',
};
const B: Row = {
	Name: 'Kamvas 22 Plus',
	EntityId: 'b',
	LinkCount: '4',
	Weight: '2900',
	Contrast: '1200',
	Lamination: 'YES',
	Brightness: '220',
};

describe('compareEntities', () => {
	const res = compareEntities([A, B], FIELDS, { roleOf });

	it('returns only fields that differ', () => {
		expect(res.rows.map((r) => r.key)).toEqual(['Weight', 'Contrast', 'Lamination']);
	});

	it('drops identity and metadata rather than restating the question', () => {
		// Name, EntityId and LinkCount all differ, and all three are noise.
		expect(res.rows.map((r) => r.key)).not.toContain('Name');
		expect(res.rows.map((r) => r.key)).not.toContain('LinkCount');
		expect(res.accounting.excludedByRole).toBe(3);
	});

	it('reports the accounting alongside the rows', () => {
		expect(res.accounting).toMatchObject({
			totalFields: 8,
			excludedByRole: 3,
			compared: 5,
			differing: 3,
			identical: 1, // Brightness
			emptyOnAll: 1, // Notes
		});
	});

	it('distinguishes agreement from absence of data', () => {
		// Both blank is not the same claim as both equal, and collapsing the two
		// would let a caller say "identical on 2 fields" about a field nobody
		// has filled in.
		expect(res.accounting.identical).toBe(1);
		expect(res.accounting.emptyOnAll).toBe(1);
	});

	it('keeps values in input order', () => {
		const weight = res.rows.find((r) => r.key === 'Weight');
		expect(weight?.values).toEqual(['3900', '2900']);
	});

	it('surfaces unclassified fields instead of guessing a role', () => {
		const withUnknown = compareEntities([A, B], [...FIELDS, F('Mystery')], { roleOf });
		expect(withUnknown.accounting.unclassified).toEqual(['Mystery']);
	});

	it('still compares an unclassified field, so a real difference is not hidden', () => {
		const rows = compareEntities([{ Mystery: 'x' }, { Mystery: 'y' }], [F('Mystery')], { roleOf });
		expect(rows.rows.map((r) => r.key)).toEqual(['Mystery']);
		expect(rows.accounting.unclassified).toEqual(['Mystery']);
	});

	it('records a throwing getter without aborting the comparison', () => {
		const boom: ComparableField<Row> = {
			key: 'Boom',
			label: 'Boom',
			group: 'Display',
			getValue: () => {
				throw new Error('computed field blew up');
			},
		};
		const out = compareEntities([A, B], [boom, F('Weight', 'Physical')], { roleOf });
		expect(out.accounting.errored).toEqual(['Boom']);
		expect(out.rows.map((r) => r.key)).toEqual(['Weight']);
	});

	it('honours an explicit include list', () => {
		const out = compareEntities([A, B], FIELDS, { roleOf, include: ['spec', 'identity'] });
		expect(out.rows.map((r) => r.key)).toContain('Name');
		expect(out.accounting.excludedByRole).toBe(1); // LinkCount only
	});

	it('compares more than two entities', () => {
		const C: Row = { ...A, Weight: '4100' };
		const out = compareEntities([A, B, C], FIELDS, { roleOf });
		expect(out.rows.find((r) => r.key === 'Weight')?.values).toEqual(['3900', '2900', '4100']);
	});
});
