import { describe, expect, it } from 'vitest';
import type { FieldDisplayDef } from '@thesevenpens/queriton';
import {
	buildCompareGroups,
	countIdentical,
	onlyDifferences,
	toExportRows,
	type CompareGroup,
} from './compare-matrix.js';

type Row = Record<string, string>;

const F = (
	key: string,
	group: string,
	extra: Partial<FieldDisplayDef<Row>> = {},
): FieldDisplayDef<Row> => ({
	key,
	label: key,
	group,
	type: 'string',
	getValue: (r) => r[key] ?? '',
	...extra,
});

const GROUPS = ['Display', 'Physical'];
const FIELDS = [F('Contrast', 'Display'), F('Lamination', 'Display'), F('Weight', 'Physical')];
const plain = (f: FieldDisplayDef<Row>, r: Row) => f.getValue(r);

const A: Row = { Contrast: '1000', Lamination: 'NO', Weight: '3900' };
const B: Row = { Contrast: '1200', Lamination: 'NO', Weight: '2900' };

describe('buildCompareGroups', () => {
	it('groups rows in the given group order', () => {
		const groups = buildCompareGroups([A, B], FIELDS, GROUPS, plain);
		expect(groups.map((g) => g.group)).toEqual(['Display', 'Physical']);
		expect(groups[0].fields.map((f) => f.key)).toEqual(['Contrast', 'Lamination']);
	});

	it('flags only the rows that differ', () => {
		const groups = buildCompareGroups([A, B], FIELDS, GROUPS, plain);
		const flags = groups.flatMap((g) => g.fields).map((f) => [f.key, f.differs]);
		expect(flags).toEqual([
			['Contrast', true],
			['Lamination', false],
			['Weight', true],
		]);
	});

	it('treats a blank as missing data, not a difference', () => {
		// "266" against a field nobody filled in is a gap in our dataset. Marking
		// it as differing sends the reader chasing a spec change that isn't there.
		const groups = buildCompareGroups([{ Weight: '3900' }, {}], FIELDS, GROUPS, plain);
		expect(groups[0].fields[0]).toMatchObject({ key: 'Weight', differs: false });
	});

	it('drops rows blank on every item', () => {
		const groups = buildCompareGroups([{ Weight: '1' }, { Weight: '2' }], FIELDS, GROUPS, plain);
		expect(groups.flatMap((g) => g.fields).map((f) => f.key)).toEqual(['Weight']);
	});

	it('drops a group left with no rows', () => {
		const groups = buildCompareGroups([{ Weight: '1' }, { Weight: '2' }], FIELDS, GROUPS, plain);
		expect(groups.map((g) => g.group)).toEqual(['Physical']);
	});

	it('returns nothing for no items', () => {
		expect(buildCompareGroups([], FIELDS, GROUPS, plain)).toEqual([]);
	});

	it('keys rows on the field key, not the label', () => {
		// Two fields can strip to the same label ("Active Area (mm²)" and
		// "(cm²)"), and keying the {#each} on label crashed with
		// each_key_duplicate. The key must stay distinct even when labels collide.
		const fields = [
			F('AreaMm2', 'Physical', { label: 'Active Area (mm²)', unit: 'mm2' }),
			F('AreaCm2', 'Physical', { label: 'Active Area (cm²)', unit: 'cm2' }),
		];
		const rows = buildCompareGroups(
			[
				{ AreaMm2: '1', AreaCm2: '2' },
				{ AreaMm2: '3', AreaCm2: '4' },
			],
			fields,
			['Physical'],
			plain,
		)[0].fields;
		expect(rows.map((r) => r.key)).toEqual(['AreaMm2', 'AreaCm2']);
		expect(new Set(rows.map((r) => r.label)).size).toBe(1);
	});

	it('uses the supplied display function, so per-entity special cases stay put', () => {
		const groups = buildCompareGroups([A, B], FIELDS, GROUPS, (f, r) =>
			f.key === 'Weight' ? `${r[f.key]} grams` : f.getValue(r),
		);
		expect(groups[1].fields[0].values).toEqual(['3900 grams', '2900 grams']);
	});

	it('compares more than two items', () => {
		const C: Row = { ...A, Contrast: '1400' };
		const groups = buildCompareGroups([A, B, C], FIELDS, GROUPS, plain);
		expect(groups[0].fields[0].values).toEqual(['1000', '1200', '1400']);
	});
});

describe('onlyDifferences / countIdentical', () => {
	const groups = buildCompareGroups([A, B], FIELDS, GROUPS, plain);

	it('keeps only differing rows', () => {
		expect(
			onlyDifferences(groups)
				.flatMap((g) => g.fields)
				.map((f) => f.key),
		).toEqual(['Contrast', 'Weight']);
	});

	it('drops a group whose rows all matched', () => {
		const same = buildCompareGroups([A, A], FIELDS, GROUPS, plain);
		expect(onlyDifferences(same)).toEqual([]);
	});

	it('counts what the toggle would hide', () => {
		expect(countIdentical(groups)).toBe(1);
	});

	it('does not mutate the input', () => {
		onlyDifferences(groups);
		expect(groups[0].fields).toHaveLength(2);
	});
});

describe('toExportRows', () => {
	it('emits a spanning heading then its rows', () => {
		const groups: CompareGroup[] = [
			{
				group: 'Display',
				fields: [{ key: 'k', label: 'Contrast', values: ['1000', '1200'], differs: true }],
			},
		];
		expect(toExportRows(groups, 2)).toEqual([
			['Display', '', ''],
			['Contrast', '1000', '1200'],
		]);
	});

	it('is empty for no groups', () => {
		expect(toExportRows([], 2)).toEqual([]);
	});
});
