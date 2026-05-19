# 4. Grouping and Aggregation

In this chapter you'll group rows by one or more keys and compute summary values for each group. You'll meet the two verbs that drive every aggregation: `.countBy()` for the common case and `.summarize()` for everything else.

## The simplest case: count by one key

`.countBy(field)` produces one row per distinct value, with a `count` column. The result is sorted descending by count by default.

```ts run
const bySpecies = await penguinsQ().countBy('species').toArray();
expect(bySpecies).toEqual([
	{ species: 'Adelie', count: 152 },
	{ species: 'Gentoo', count: 124 },
	{ species: 'Chinstrap', count: 68 },
]);
```

Things to notice:

- The result is a `Query<SummaryRow>` — the row shape changes. Subsequent `.filter()` / `.sort()` operate on the summary rows, not the original penguins.
- The default count column is named `count`. Override with `.countBy('species', { countAlias: 'n' })`.
- The default sort is by count descending. Pass `{ sort: 'asc' }` to flip, or `{ sort: 'none' }` to suppress.

## Counting by multiple keys

Pass an array of field names:

```ts run
const bySpeciesIsland = await penguinsQ().countBy(['species', 'island']).toArray();
expect(bySpeciesIsland).toEqual([
	{ species: 'Gentoo', island: 'Biscoe', count: 124 },
	{ species: 'Chinstrap', island: 'Dream', count: 68 },
	{ species: 'Adelie', island: 'Dream', count: 56 },
	{ species: 'Adelie', island: 'Torgersen', count: 52 },
	{ species: 'Adelie', island: 'Biscoe', count: 44 },
]);
```

Two species are single-island: Gentoo is only on Biscoe, Chinstrap is only on Dream. Adelie spans all three.

## Summarize: aggregators per group

`.summarize()` is the general form. The spec is an object: `by` is the grouping key(s); the other keys (`count`, `sum`, `avg`, `min`, `max`, `median`, `distinctCount`, `first`, `last`, `collect`, `countIf`) each describe an aggregator.

```ts run
const stats = await penguinsQ()
	.summarize({
		by: 'species',
		count: 'n',
		avg: { meanMass: 'body_mass_g' },
		min: { minMass: 'body_mass_g' },
		max: { maxMass: 'body_mass_g' },
	})
	.sort('species', 'asc')
	.toArray();
expect(stats).toHaveLength(3);
expect(stats[0].species).toBe('Adelie');
expect(stats[0].n).toBe(152);
expect(stats[0].meanMass).toBeCloseTo(3700.66, 2);
expect(stats[0].minMass).toBe(2850);
expect(stats[0].maxMass).toBe(4775);
```

Things to notice:

- Numeric aggregators (`sum`, `avg`, `min`, `max`, `median`) **skip null and non-numeric** values. The count of 152 Adelies includes the one row with all measurements null; the mean of 3700.66 is over the 151 non-null masses.
- `count` counts **every** row in the group, including those with null measurements. Pin this rule: `count` is row-shaped, every other numeric aggregator is value-shaped.
- The output row keys are exactly what you named in the spec — there's no `<field>__avg` munging.

## SQL HAVING: filter after summarize

To keep only groups that satisfy a condition, run `.filter()` after `.summarize()`:

```ts run
const popular = await penguinsQ().countBy('species').filter('count', '>', 100).toArray();
expect(popular).toEqual([
	{ species: 'Adelie', count: 152 },
	{ species: 'Gentoo', count: 124 },
]);
```

> **From SQL:** this is `HAVING count > 100`. queriton doesn't have a separate `having` verb — chained `.filter()` after summarize is the idiom, and the same operators apply.

## countIf: Excel-style conditional counts

`countIf` adds a column whose value is the number of rows in each group matching a condition. Useful for "what fraction of each group satisfies X" without resorting to a derive-then-summarize two-step.

```ts run
const sexBreakdown = await penguinsQ()
	.summarize({
		by: 'species',
		count: 'total',
		countIf: {
			males: (p) => (p as Penguin).sex === 'male',
			females: (p) => (p as Penguin).sex === 'female',
		},
	})
	.sort('species', 'asc')
	.toArray();
expect(sexBreakdown).toEqual([
	{ species: 'Adelie', total: 152, males: 73, females: 73 },
	{ species: 'Chinstrap', total: 68, males: 34, females: 34 },
	{ species: 'Gentoo', total: 124, males: 61, females: 58 },
]);
```

The two named conditions (`males`, `females`) each become a column. The `total` column counts everyone including the 11 rows with unknown sex — `total − males − females` recovers that bucket.

## Aggregating without grouping

Omit `by` to compute one row over the whole dataset:

```ts run
const overall = await penguinsQ()
	.summarize({
		count: 'n',
		avg: { meanMass: 'body_mass_g' },
		max: { heaviest: 'body_mass_g' },
	})
	.toArray();
expect(overall).toHaveLength(1);
expect(overall[0].n).toBe(344);
expect(overall[0].heaviest).toBe(6300);
```

## distinctCount, first, last, collect

A few less-frequent but useful aggregators:

```ts run
const summary = await penguinsQ()
	.summarize({
		by: 'species',
		distinctCount: { islandCount: 'island' },
		first: { firstYear: 'year' },
		last: { lastYear: 'year' },
	})
	.sort('species', 'asc')
	.toArray();
expect(summary[0]).toMatchObject({
	species: 'Adelie',
	islandCount: 3, // Adelie spans Biscoe, Dream, Torgersen
});
expect(summary[1].islandCount).toBe(1); // Chinstrap only on Dream
expect(summary[2].islandCount).toBe(1); // Gentoo only on Biscoe
```

- `distinctCount` counts unique non-empty values.
- `first` / `last` take the raw value from the first/last row in **input order** (no sort applied internally).
- `collect` returns an array of all values in input order — useful for flattening or further processing.

> **From dplyr:** `.summarize()` is `summarise()`. queriton's spec-as-object form is closer to `data.table::dcast` or Arquero's `rollup` than dplyr's verb-per-aggregator style, but the result is the same.

In the next chapter we'll pin down exactly what happens when those summarize aggregators meet null values.
