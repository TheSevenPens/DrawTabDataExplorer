// Palmer Penguins fixture coverage — exercises aggregators across
// realistic group sizes (3 species × 3 islands × 2 sexes, 344 rows) and
// validates that the documented null-handling rules hold when the
// percentage of missing values is small but non-zero. Complements
// mtcars (32 rows, no NAs) and the hand-crafted with-nulls fixture
// (8 rows, contrived NAs).

import { describe, it, expect } from 'vitest';
import { Query } from '../src/index.js';
import { penguins, penguinFields, type Penguin } from './fixtures/penguins.js';

function penguinsQ(): Query<Penguin> {
	return new Query<Penguin>(async () => penguins, penguinFields);
}

describe('Palmer Penguins — fixture sanity', () => {
	it('contains 344 rows', async () => {
		expect(await penguinsQ().count()).toBe(344);
	});

	it('has the three documented species in the expected proportions', async () => {
		const rows = await penguinsQ().countBy('species').toArray();
		expect(rows).toEqual([
			{ species: 'Adelie', count: 152 },
			{ species: 'Gentoo', count: 124 },
			{ species: 'Chinstrap', count: 68 },
		]);
	});

	it('Gentoo lives only on Biscoe; Chinstrap only on Dream', async () => {
		// Multi-key countBy. Adelie spans all three islands; the other two
		// species are single-island. This pinned ordering catches any future
		// sort-stability regressions in the summarize → sort chain.
		const rows = await penguinsQ().countBy(['species', 'island']).toArray();
		expect(rows).toEqual([
			{ species: 'Gentoo', island: 'Biscoe', count: 124 },
			{ species: 'Chinstrap', island: 'Dream', count: 68 },
			{ species: 'Adelie', island: 'Dream', count: 56 },
			{ species: 'Adelie', island: 'Torgersen', count: 52 },
			{ species: 'Adelie', island: 'Biscoe', count: 44 },
		]);
	});
});

describe('Palmer Penguins — aggregators across realistic group sizes', () => {
	it('avg body mass per species matches hand-computed means', async () => {
		// Means are over the non-null body_mass_g values per species:
		//   Adelie: sum 558800 / 151 = 3700.6623…
		//   Chinstrap: sum 253850 / 68 = 3733.0882…
		//   Gentoo: sum 624350 / 123 = 5076.0163…
		// (Each species has 1 row with all measurements null except Gentoo.
		// engine treats those as skipped, not as zero.)
		const rows = await penguinsQ()
			.summarize({ by: 'species', avg: { mass: 'body_mass_g' } })
			.sort('species', 'asc')
			.toArray();
		expect(rows).toHaveLength(3);
		expect(rows[0]).toMatchObject({ species: 'Adelie' });
		expect(rows[0].mass).toBeCloseTo(3700.6623, 3);
		expect(rows[1]).toMatchObject({ species: 'Chinstrap' });
		expect(rows[1].mass).toBeCloseTo(3733.0882, 3);
		expect(rows[2]).toMatchObject({ species: 'Gentoo' });
		expect(rows[2].mass).toBeCloseTo(5076.0163, 3);
	});

	it('median body mass per species — exercises even-length group medians', async () => {
		// Median is the bug-prone aggregator on even-length groups:
		// Adelie (151, odd) and Chinstrap (68, even) and Gentoo (123, odd)
		// non-null counts cover both parities.
		const rows = await penguinsQ()
			.summarize({ by: 'species', median: { mid: 'body_mass_g' } })
			.sort('species', 'asc')
			.toArray();
		expect(rows.map((r) => [r.species, r.mid])).toEqual([
			['Adelie', 3700],
			['Chinstrap', 3700],
			['Gentoo', 5000],
		]);
	});

	it('min / max flipper length per species', async () => {
		const rows = await penguinsQ()
			.summarize({
				by: 'species',
				min: { lo: 'flipper_length_mm' },
				max: { hi: 'flipper_length_mm' },
			})
			.sort('species', 'asc')
			.toArray();
		expect(rows).toEqual([
			{ species: 'Adelie', lo: 172, hi: 210 },
			{ species: 'Chinstrap', lo: 178, hi: 212 },
			{ species: 'Gentoo', lo: 203, hi: 231 },
		]);
	});
});

describe('Palmer Penguins — null handling at scale', () => {
	it('.dropNulls(field) drops exactly the 2 rows with missing measurements', async () => {
		// bill_length_mm / bill_depth_mm / flipper_length_mm / body_mass_g
		// are all null on the same 2 rows (the canonical "Torgersen island
		// row 4" plus one Gentoo row), so dropNulls on any of them removes
		// the same 2 rows.
		const dropped = await penguinsQ().dropNulls('bill_length_mm').count();
		expect(dropped).toBe(342);
	});

	it('countBy a partially-null field bundles nulls into the "" bucket', async () => {
		// 11 rows have null sex. countBy uses summarize-by under the hood,
		// which collapses null-valued group keys into "" rather than dropping
		// them — matches the rule pinned in nulls.test.ts.
		const rows = await penguinsQ().countBy('sex').toArray();
		const bySex = Object.fromEntries(rows.map((r) => [r.sex, r.count]));
		expect(bySex).toEqual({ male: 168, female: 165, '': 11 });
	});

	it('distinctCount of a null-bearing field skips nulls', async () => {
		// sex has 3 distinct *string* values in the raw data: male, female,
		// and "NA" — but our fixture coerces "NA" to null. distinctCount
		// must return 2, not 3.
		const rows = await penguinsQ()
			.summarize({ distinctCount: { dc: 'sex' } })
			.toArray();
		expect(rows[0].dc).toBe(2);
	});
});
