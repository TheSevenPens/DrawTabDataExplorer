# 10. Tips

A few patterns and pitfalls that don't fit neatly into one chapter but that you'll meet sooner or later. Read once now; come back when something goes wrong.

## Await once, at the end

Every terminal method on a Query returns a Promise. Method-chained Queries are still synchronous — you only need `await` at the materialisation point.

```ts run
// Good — one await at the end.
const result = await penguinsQ()
	.filter('species', '==', 'Adelie')
	.sort('body_mass_g', 'desc')
	.take(5)
	.toArray();
expect(result).toHaveLength(5);
```

A common new-user mistake is putting `await` between Query methods. It doesn't work — `.filter()` returns a Query, not a Promise — and TypeScript will flag it. The async surface is the terminal call only.

## Summarize swaps the row shape

After `.summarize()`, the rows are `SummaryRow` (a `Record<string, string | number | string[]>`), not your original entity type. Downstream verbs work on the summary rows.

```ts run
// .summarize() collapses 344 penguins to 3 summary rows, one per species.
const summary = await penguinsQ().countBy('species').toArray();
expect(summary).toHaveLength(3);
// The row shape changed — there's no body_mass_g column to filter on:
const filtered = await penguinsQ().countBy('species').filter('count', '>=', 100).toArray();
expect(filtered).toHaveLength(2); // Adelie + Gentoo
```

If you want both — the rolled-up summary _and_ the original rows — run the pipeline twice (queriton caches loaders inside a `DataSet`, so the underlying data isn't reloaded).

## Predicate filters are not serialisable

`.filter(row => ...)` accepts an arbitrary function. The function is stored as a `PredicateStep` in the pipeline. That's powerful, but it doesn't survive `JSON.stringify` — if you save a pipeline to a URL or to localStorage, predicate steps are dropped.

The serialisable alternatives:

- `.filter(field, op, value)` — flat AND-chain.
- `.filter({ and: [...], or: [...] })` — boolean expression tree.

For data-quality patterns where you only run the pipeline in code, predicate filters are fine. For pipelines that get persisted and reloaded (saved views, shareable URLs), use the structured forms.

## .find() and .findBy() short-circuit

`.find(predicate)` returns the first match, `undefined` if none. `.findBy(field, value)` is sugar for `.filter(field, '==', value)` followed by first-result extraction.

```ts run
const heaviestAdelie = await penguinsQ()
	.filter('species', '==', 'Adelie')
	.sort('body_mass_g', 'desc')
	.find(() => true);
expect(heaviestAdelie?.body_mass_g).toBe(4775);
```

Both return as soon as they find a match. There's no early-stop optimisation in the engine itself, but the materialisation step skips work after the first hit.

## Debugging a pipeline

`.toSteps()` returns the pipeline as data — useful for logging or inspecting a complex chain.

```ts run
const steps = penguinsQ()
	.filter('species', '==', 'Adelie')
	.sort('body_mass_g', 'desc')
	.take(5)
	.toSteps();
expect(steps).toHaveLength(3);
expect(steps[0].kind).toBe('filter');
expect(steps[1].kind).toBe('sort');
expect(steps[2].kind).toBe('take');
```

The DrawTab Explorer uses this to power its API Explorer view — pipelines round-trip through URL state via `.toSteps()` and a reconstruction helper.

## When summarize seems to do the wrong thing

Three rules to check, in order:

1. **Is the field-def's `type` correct?** Numeric aggregators (`sum`, `avg`, etc.) skip non-numeric values. If `type: 'string'` is set on a numeric column, the values pass through `getValue` as strings, and aggregators may not coerce as you expect. See chapter 9.
2. **Are nulls being counted vs. skipped as you expect?** `count` includes them; everything else doesn't. Re-read chapter 5 if anything in your output is off by a small number.
3. **Did you mean `.select()` or `.derive()`?** They're easy to swap by mistake. `.select()` projects to a new row shape (drops other columns); `.derive()` adds columns to the existing shape. If your downstream `.filter()` complains about a missing field, you may have `.select()`-ed it away.

## Performance: the topK optimisation

queriton fuses `.sort(field, dir).take(n)` into a single `topK` pass — O(n log k) instead of O(n log n). This means top-N queries are cheap even on large datasets; don't pre-sort manually thinking you'll save work.

The fusion is automatic; you don't opt in. To verify it's happening for a specific pipeline, check `.toSteps()` — you'll see a single `topK` step where the sort+take would otherwise appear (the rewrite runs at `.toArray()` time, so `.toSteps()` shows the pre-rewrite pipeline).

## Where to go next

You've seen every public verb queriton offers. From here, the next steps depend on what you're building:

- **Reference** — the package's `README.md` has the full API surface, condensed.
- **The DrawTab Explorer** — queriton's biggest consumer. See [api-explorer/+page.svelte](../../../src/routes/api-explorer/+page.svelte) for a runnable playground over real data.
- **Custom field-defs** — chapter 9 has the contract. The DrawTab codebase has 10+ examples under [data-repo/lib/entities/](../../../data-repo/lib/entities/).

Happy querying.
