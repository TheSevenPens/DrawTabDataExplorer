# 5. Nulls and Empties

In this chapter you'll learn exactly how queriton treats missing values. The rules are small, consistent, and in three specific places they diverge from SQL — pin them now so they don't surprise you later.

## The rule: read through getValue, treat empty string as missing

Every field has a `getValue(row)` function that returns a string. queriton's convention is that `getValue` returns `""` whenever the underlying value is `null`, `undefined`, or missing. That single rule is the foundation; the rest of this chapter is its consequences.

For numeric fields, the value `getValue` returns is `String(value)` for non-null values and `""` for nulls. The Palmer Penguins fixture follows this convention: 2 rows have null `bill_length_mm`, and 11 rows have null `sex`.

## Operators: `empty` and `notempty`

The dedicated operators match nulls (which become `""`) and genuine empty strings — both:

```ts run
const noBill = await penguinsQ().filter('bill_length_mm', 'empty', '').count();
expect(noBill).toBe(2);

const knownSex = await penguinsQ().filter('sex', 'notempty', '').count();
expect(knownSex).toBe(333); // 344 − 11 nulls
```

## Sugar: `.dropEmpty()` and `.dropNulls()`

`.dropEmpty(field)` is shorthand for `.filter(field, 'notempty', '')`. `.dropNulls()` is its alias.

```ts run
const withBills = await penguinsQ().dropNulls('bill_length_mm').count();
expect(withBills).toBe(342);
```

The two methods are identical at runtime; the alias exists because "null" and "empty" feel different to different audiences and both names are common in dplyr / pandas.

## Numeric comparisons skip nulls

`>`, `>=`, `<`, `<=` always return false against a null value. This means `>= 0` does **not** match null rows.

```ts run
const anyMass = await penguinsQ().filter('body_mass_g', '>=', 0).count();
expect(anyMass).toBe(342); // not 344 — the 2 null-mass rows fall out
```

If you want them in, combine with the `empty` test:

```ts run
const inclusive = await penguinsQ()
	.filter({
		or: [
			{ field: 'body_mass_g', op: '>=', value: '0' },
			{ field: 'body_mass_g', op: 'empty', value: '' },
		],
	})
	.count();
expect(inclusive).toBe(344);
```

## summarize aggregators have two behaviours

This is the most important distinction in the chapter:

- **`count` counts every row**, including those with null values for the aggregated-on field. It's a row count.
- **`sum`, `avg`, `min`, `max`, `median`, `distinctCount` skip null and non-numeric values.** They're value reductions.

```ts run
const stats = await penguinsQ()
	.summarize({
		count: 'rows',
		sum: { totalMass: 'body_mass_g' },
		avg: { meanMass: 'body_mass_g' },
		distinctCount: { distinctSex: 'sex' },
	})
	.toArray();
expect(stats[0].rows).toBe(344);
// totalMass and meanMass are over the 342 non-null masses:
expect(stats[0].totalMass).toBe(1437000);
expect(stats[0].meanMass).toBeCloseTo(4201.75, 2);
// distinctCount of sex skips the 11 nulls — 2 distinct values (male, female):
expect(stats[0].distinctSex).toBe(2);
```

> **From SQL:** `COUNT(*)` matches queriton's `count`, but `COUNT(<field>)` in SQL also skips nulls. queriton's `count` is always row-shaped; if you want "non-null body_mass_g", use `countIf` with a predicate or chain `.dropNulls()` upstream.

## Grouping by a null key: the "" bucket

When you group by a field with null values, those rows are bundled into a single bucket with `""` as the group key — they don't vanish.

```ts run
const bySex = await penguinsQ().countBy('sex').toArray();
const lookup = Object.fromEntries(bySex.map((r) => [r.sex, r.count]));
expect(lookup).toEqual({ male: 168, female: 165, '': 11 });
```

The 11 nulls collapse to the `""` bucket. If you want them dropped instead of bucketed, `.dropNulls('sex')` upstream of `.countBy()`.

## first / last / collect include nulls

The non-reducing aggregators preserve nulls in their raw `""` form:

```ts run
const collected = await penguinsQ()
	.filter('species', '==', 'Adelie')
	.summarize({ collect: { allSexes: 'sex' } })
	.toArray();
const arr = collected[0].allSexes as string[];
expect(arr).toHaveLength(152);
expect(arr).toContain(''); // the 6 null-sex Adelie rows are present as ""
```

This is occasionally what you want (you genuinely care about position or completeness); often it's not. Pick the aggregator that matches what nulls mean in your data.

## A summary table

| Operation                                | On a null value                                  |
| ---------------------------------------- | ------------------------------------------------ |
| `.filter(f, 'empty', '')`                | match                                            |
| `.filter(f, 'notempty', '')`             | skip                                             |
| `.filter(f, '>', n)` etc.                | skip (`<`, `<=`, `>`, `>=`, `==`, `!=` all skip) |
| `.dropEmpty(f)` / `.dropNulls(f)`        | drop the row                                     |
| `.summarize({ count })`                  | counted                                          |
| `.summarize({ sum/avg/min/max/median })` | skipped                                          |
| `.summarize({ distinctCount })`          | skipped                                          |
| `.summarize({ first/last/collect })`     | included as `""`                                 |
| `.summarize({ by: f })`                  | bundled into the `""` group                      |

In the next chapter we'll meet the verb where queriton's null-handling story most clearly diverges from SQL: joins.
