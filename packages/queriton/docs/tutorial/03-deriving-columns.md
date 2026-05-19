# 3. Deriving Columns

In this chapter you'll add new computed columns to each row with `.derive()`, and you'll see how `.unroll()` turns an array-valued column into one row per element. Both verbs change the row shape — downstream steps see the new columns.

## Adding a single derived column

`.derive({ name: fn })` adds one or more new columns whose values are produced by a function over the current row.

```ts run
const withKg = await penguinsQ()
	.filter((p) => p.body_mass_g !== null)
	.derive({ body_mass_kg: (p) => p.body_mass_g! / 1000 })
	.take(3)
	.toArray();
expect(withKg[0].body_mass_kg).toBe(3.75);
expect(withKg[1].body_mass_kg).toBe(3.8);
expect(withKg[2].body_mass_kg).toBe(3.25);
```

Things to notice:

- The derive function takes the **current row** and returns a `string | number`. queriton attaches the result under the requested key.
- The row's TypeScript type widens to include the new key — `withKg[0].body_mass_kg` is typed.
- The original columns are still present; derive only adds.

## Multiple columns at once

Pass an object with one entry per new column:

```ts run
const enriched = await penguinsQ()
	.filter((p) => p.bill_length_mm !== null && p.bill_depth_mm !== null)
	.derive({
		billRatio: (p) => p.bill_length_mm! / p.bill_depth_mm!,
		hemisphere: () => 'south', // all observations are Antarctic
	})
	.take(1)
	.toArray();
expect(enriched[0].hemisphere).toBe('south');
expect(enriched[0].billRatio).toBeCloseTo(2.091, 3);
```

## Derived columns are visible to downstream verbs

Once derived, the new columns participate in `.filter()`, `.sort()`, and `.summarize()` like any other field:

```ts run
const longBills = await penguinsQ()
	.filter((p) => p.bill_length_mm !== null && p.bill_depth_mm !== null)
	.derive({ billRatio: (p) => p.bill_length_mm! / p.bill_depth_mm! })
	.sort('billRatio', 'desc')
	.take(1)
	.toArray();
expect(longBills[0].species).toBe('Gentoo');
expect(longBills[0].island).toBe('Biscoe');
expect((longBills[0].billRatio as number).toFixed(3)).toBe('3.510');
```

A subtlety: a derived column you reference via the `.sort('billRatio', ...)` string form is recognised by its synthetic field-def, which queriton adds automatically when you `.derive()`. The synthetic def's `type` defaults to `'string'`, but sort handles numeric values correctly — coercing as needed. For tighter type control, define a real `FieldDef` and register it at the Query construction site (chapter 9).

## Derive runs before summarize

The order is meaningful when you mix derive and summarize:

```ts run
const byHeavy = await penguinsQ()
	.filter((p) => p.body_mass_g !== null)
	.derive({ heavy: (p) => (p.body_mass_g! > 4000 ? 'yes' : 'no') })
	.summarize({ by: 'heavy', count: 'n' })
	.sort('heavy', 'asc')
	.toArray();
expect(byHeavy).toEqual([
	{ heavy: 'no', n: 170 },
	{ heavy: 'yes', n: 172 },
]);
```

The derived `heavy` column becomes a grouping key. Without the upstream `.derive()`, the `summarize` step would have no such column to reference.

> **From dplyr:** `.derive()` is `mutate()`. The verb name diverges; the semantics are the same.
>
> **From SQL:** there's no direct equivalent in standard SQL — `.derive()` corresponds to projecting a computed expression in the `SELECT` clause, but queriton's version keeps **all** existing columns and adds the new ones, which SQL needs `SELECT *, expr AS name` to express.

## Unrolling array columns

`.unroll(field)` explodes a top-level array-valued column into one row per element. The Palmer Penguins dataset has no array columns, so we'll derive one to demonstrate:

```ts run
const tagged = await penguinsQ()
	.filter((p) => p.species === 'Chinstrap')
	.take(2)
	.derive({ tags: (p) => [p.species, p.island, p.sex ?? 'unknown'] as unknown as string })
	.toArray();
// Each row's `tags` is an array of three strings.
expect(tagged).toHaveLength(2);
expect(Array.isArray((tagged[0] as unknown as { tags: string[] }).tags)).toBe(true);
expect((tagged[0] as unknown as { tags: string[] }).tags).toHaveLength(3);
```

The cast is unfortunate but reflects a real constraint: `.derive()` is typed to return `string | number`, while `.unroll()` requires array values. In practice you'd register a `FieldDef` for the array column (so its type is fully expressed) and skip the derive workaround.

Things to notice:

- Rows whose array field is empty (`[]`) or non-array are **dropped** by unroll. This matches dplyr's `unnest` and Arquero's `unroll`.
- Unroll changes row count: a 5-row Query with a 3-element array per row produces 15 rows.

In the next chapter we'll group and aggregate — the verbs that actually condense rows down to summaries.
