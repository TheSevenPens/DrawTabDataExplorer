import { describe, expect, it } from 'vitest';
import type { FieldDisplayDef } from '@thesevenpens/queriton';
import { computeFieldCompletion } from './helpers.js';

type Row = { name?: string; tags?: string[]; year?: string };

const F = (
	key: string,
	getValue: (r: Row) => string,
	extra: Partial<FieldDisplayDef<Row>> = {},
): FieldDisplayDef<Row> => ({
	key,
	label: key,
	group: 'Model',
	type: 'string',
	getValue,
	...extra,
});

const NAME = F('Name', (r) => r.name ?? '');
const TAGS = F('Tags', (r) => (r.tags ?? []).join(', '));
const YEAR = F('Year', (r) => r.year ?? '');

describe('computeFieldCompletion', () => {
	it('counts populated values per field', () => {
		const rows: Row[] = [{ name: 'a' }, { name: 'b' }, {}];
		const [stat] = computeFieldCompletion(rows, [NAME]);
		expect(stat).toMatchObject({
			field: 'Name',
			label: 'Name',
			populated: 2,
			total: 3,
			percent: '66.7',
		});
	});

	it('does not count an empty array as populated', () => {
		// The path-based version this replaced compared the raw value against
		// undefined/null/'' — an empty array passed all three, so 13 tablets with
		// `IncludedPen: []` were reported as filled in. Going through getValue,
		// [].join(', ') is '' and they are correctly counted as gaps.
		const rows: Row[] = [{ tags: ['x'] }, { tags: [] }, { tags: [] }];
		const [stat] = computeFieldCompletion(rows, [TAGS]);
		expect(stat.populated).toBe(1);
	});

	it('treats whitespace-only values as empty', () => {
		const rows: Row[] = [{ name: 'a' }, { name: '   ' }];
		expect(computeFieldCompletion(rows, [NAME])[0].populated).toBe(1);
	});

	it('carries the FieldDef key so the row filter link resolves', () => {
		// EntityExplorer looks up a URL filter by FieldDef key. The old stats
		// carried a schema path ("Model.ReleaseYear"), which matched no field, so
		// every "show" link rendered the unfiltered list.
		const [stat] = computeFieldCompletion([{}], [F('ModelReleaseYear', () => '')]);
		expect(stat.field).toBe('ModelReleaseYear');
	});

	it('excludes computed fields', () => {
		const computed = F('Age', () => '5', { computed: true });
		expect(computeFieldCompletion([{}], [NAME, computed]).map((s) => s.field)).toEqual(['Name']);
	});

	it('survives a getter that throws, counting that row as unpopulated', () => {
		const boom = F('Boom', (r) => {
			if (!r.name) throw new Error('sparse row');
			return r.name;
		});
		const [stat] = computeFieldCompletion([{ name: 'a' }, {}], [boom]);
		expect(stat.populated).toBe(1);
	});

	it('sorts emptiest first, then by label for stability', () => {
		const rows: Row[] = [{ name: 'a', year: '2020' }, { name: 'b' }];
		const stats = computeFieldCompletion(rows, [NAME, YEAR, TAGS]);
		expect(stats.map((s) => s.field)).toEqual(['Tags', 'Year', 'Name']);
	});

	it('reports 0 percent rather than dividing by zero on an empty collection', () => {
		const [stat] = computeFieldCompletion([], [NAME]);
		expect(stat).toMatchObject({ populated: 0, total: 0, percent: '0' });
	});
});
