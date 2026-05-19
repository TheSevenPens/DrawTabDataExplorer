# 2. Transforming Queries

In this chapter you'll focus on the fundamental verbs that shape a query: filter, sort, select, take, skip. Each one returns a new Query, and they compose into a pipeline.

## Filtering

`.filter(field, operator, value)` keeps rows that match a condition. The available operators are:

```
==   !=   <   <=   >   >=
contains   notcontains   startswith   notstartswith
empty   notempty
```

Adelies on Torgersen island:

```ts run
const rows = await penguinsQ()
	.filter('species', '==', 'Adelie')
	.filter('island', '==', 'Torgersen')
	.toArray();
expect(rows).toHaveLength(52);
```

A few things to notice:

- Chained `.filter()` calls are AND-ed together. Every row in the result satisfies _both_ conditions.
- The third argument is a value, not an expression. queriton compares it against what the field's `getValue` returns — a string in most cases — so `'==', 'Adelie'` works for a string column and `'>=', 4000` works for a numeric one.
- Order doesn't matter for AND-chained filters. `.filter(a).filter(b)` and `.filter(b).filter(a)` produce the same rows.

### Numeric comparisons

The `<` family works on any numeric field:

```ts run
const heavy = await penguinsQ().filter('body_mass_g', '>=', 5000).count();
expect(heavy).toBe(67);
```

### String contains and startswith

`contains` and `startswith` are case-insensitive. Use `containsStrict` / `startswithStrict` (via the expression form) if you need case-sensitive matching.

```ts run
const islanders = await penguinsQ().filter('island', 'startswith', 'B').count();
expect(islanders).toBe(168); // Biscoe only — there's no other island starting with B
```

### Predicate functions

When the three-argument form isn't expressive enough, pass a function:

```ts run
const big = await penguinsQ()
	.filter((p) => p.body_mass_g !== null && p.body_mass_g > 5500 && p.species === 'Gentoo')
	.count();
expect(big).toBe(28);
```

The function form is more flexible but has a tradeoff: it isn't serialisable, so pipelines that get persisted to a URL or saved view will drop predicate steps. For the most common cases the three-argument form is better.

## Sorting

`.sort(field, direction)` orders the rows. `direction` defaults to ascending.

```ts run
const top3 = await penguinsQ().sort('body_mass_g', 'desc').take(3).toArray();
expect(top3.map((p) => p.body_mass_g)).toEqual([6300, 6050, 6000]);
```

For multi-key sorts pass an array, primary key first:

```ts run
const sorted = await penguinsQ()
	.sort([
		{ field: 'species', direction: 'asc' },
		{ field: 'body_mass_g', direction: 'desc' },
	])
	.take(1)
	.toArray();
// Among Adelies (alphabetically first species), the heaviest is 4775g.
expect(sorted[0]).toMatchObject({ species: 'Adelie', body_mass_g: 4775 });
```

Things to notice:

- queriton's sort is stable, so secondary keys within the same primary value preserve input order — but for predictability it's better to make the order explicit with multi-key sort.
- Sort runs after filter and before take in a typical pipeline. queriton has an internal optimisation (`topK`) that fuses `.sort().take(n)` into one pass — covered in chapter 10.

## Limiting: take, skip, last, reverse

`.take(n)` keeps the first _n_ rows, `.skip(n)` drops the first _n_, `.last(n)` keeps the last _n_, and `.reverse()` flips the order.

```ts run
const heaviestFive = await penguinsQ().sort('body_mass_g', 'desc').take(5).toArray();
expect(heaviestFive).toHaveLength(5);

const skipTen = await penguinsQ().sort('species', 'asc').skip(10).count();
expect(skipTen).toBe(334);

const lastThree = await penguinsQ().sort('species', 'asc').last(3).toArray();
// Last three in ascending species order are all Gentoos.
expect(lastThree.every((p) => p.species === 'Gentoo')).toBe(true);
```

## Selecting columns

`.select(fields)` projects each row to only the listed fields. It changes the row shape — the resulting Query holds `SummaryRow`, a `Record<string, string | number | string[]>`, not your original type.

```ts run
const trimmed = await penguinsQ()
	.filter('species', '==', 'Adelie')
	.select(['species', 'island', 'body_mass_g'])
	.take(1)
	.toArray();
expect(Object.keys(trimmed[0]).sort()).toEqual(['body_mass_g', 'island', 'species']);
```

Things to notice:

- `.select()` is a **projection**: it transforms the rows. Downstream `.filter()` / `.sort()` see only the projected columns.
- If you only want to control which columns the UI shows but keep the full row shape, that's a different concern — handled at the UI layer, not by queriton.
- Unknown field keys passed to `.select()` don't throw; they appear as empty-string values. queriton is forgiving by design.

## Chaining is the idiom

Every Query method returns a new Query, so the natural style is a single fluent chain:

```ts run
const heaviestAdeliesOnBiscoe = await penguinsQ()
	.filter('species', '==', 'Adelie')
	.filter('island', '==', 'Biscoe')
	.sort('body_mass_g', 'desc')
	.take(3)
	.toArray();
expect(heaviestAdeliesOnBiscoe).toHaveLength(3);
expect(heaviestAdeliesOnBiscoe[0].body_mass_g).toBe(4775);
```

If you want intermediate names — for readability, or to fork the pipeline — assign Queries to variables. They're cheap; nothing runs until a terminal call.

```ts run
const adelies = penguinsQ().filter('species', '==', 'Adelie');
const onBiscoe = adelies.filter('island', '==', 'Biscoe');
const onDream = adelies.filter('island', '==', 'Dream');

expect(await onBiscoe.count()).toBe(44);
expect(await onDream.count()).toBe(56);
```

`adelies` is reused in two derived pipelines. Each branch is independent; running one doesn't affect the other.

In the next chapter we'll see how to add new computed columns to the rows themselves.
