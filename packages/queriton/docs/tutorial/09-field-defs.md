# 9. FieldDef and FieldDisplayDef

In this chapter you'll learn what's inside the `fields` arrays you've been passing into every Query, why queriton splits them into two tiers, and how to write your own.

## What's a FieldDef?

A `FieldDef<T>` describes one column of a Query's rows. queriton's engine uses these for filtering, sorting, grouping — every place that needs to read a value out of a row. The core shape is intentionally small:

```ts
interface FieldDef<T> {
	key: string;
	label: string;
	getValue: (item: T) => string;
	type: 'string' | 'number' | 'enum';
	enumValues?: string[];
}
```

Five fields, only `enumValues` optional. Everything the engine does for you — filter operators, sort comparisons, group keys, numeric aggregators — is driven by `getValue` returning a string and `type` telling the engine how to interpret it.

A working example for the penguins fixture:

```ts run
const customField = {
	key: 'speciesShort',
	label: 'Species (short)',
	type: 'string' as const,
	getValue: (p: Penguin) => p.species.slice(0, 3), // "Ade", "Chi", "Gen"
};

const rows = await new Query<Penguin>(async () => penguins, [...penguinFields, customField])
	.countBy('speciesShort')
	.toArray();
expect(rows).toEqual([
	{ speciesShort: 'Ade', count: 152 },
	{ speciesShort: 'Gen', count: 124 },
	{ speciesShort: 'Chi', count: 68 },
]);
```

Things to notice:

- `getValue` does the work. queriton never inspects the row directly; it always asks the FieldDef.
- The convention for nulls is to return `""`. Chapter 5 covers what queriton does with empty strings — the FieldDef is where that contract gets enforced.
- The TypeScript generic `T` is the row type. A FieldDef defined over `Penguin` can read penguin fields; the engine widens to `FieldDef<unknown>` internally when chaining.

## Type matters for comparisons

The `type` field tells queriton how to interpret values for filtering and sorting. Numeric types use numeric comparison; string types use string comparison.

```ts run
const numericRanking = await new Query<Penguin>(async () => penguins, penguinFields)
	.filter('body_mass_g', 'notempty', '')
	.sort('body_mass_g', 'desc')
	.take(1)
	.toArray();
expect(numericRanking[0].body_mass_g).toBe(6300);
```

If `body_mass_g` were declared as `type: 'string'`, the sort would be lexicographic and `"6300"` would lose to `"6500"` but win against `"999"` — the kind of subtle bug that's annoying to chase down. Get the type right at FieldDef construction; the engine trusts you.

## The display-layer extension

For UI work, queriton also exports `FieldDisplayDef<T>` — a strict superset of `FieldDef<T>` with optional rendering hints:

```ts
interface FieldDisplayDef<T> extends FieldDef<T> {
	group: string;
	getDisplayValue?: (item: T) => string;
	getHref?: (item: T) => string | null;
	computed?: boolean;
	unit?: string;
}
```

- `group` — sectioning label for column pickers, detail panels, etc.
- `getDisplayValue` — override the rendered text without affecting filter/sort behavior (e.g. show "WACOM" but `getValue` returns the brand id).
- `getHref` — render the value as an internal link.
- `computed` — mark a derived/synthetic field so the UI can badge it.
- `unit` — a unit suffix consumed by formatters.

Field arrays in app code should be typed as `FieldDisplayDef<T>[]` so UI components see the richer shape. The engine is happy with either, because every `FieldDisplayDef` is also a `FieldDef`.

## Type aliases: AnyFieldDef and AnyFieldDisplayDef

When you're writing generic code that operates on field arrays without caring about the row type — UI components like a filter bar, or generic helpers — use the `any`-row aliases:

```ts
type AnyFieldDef = FieldDef<any>;
type AnyFieldDisplayDef = FieldDisplayDef<any>;
```

UI components in the DrawTab Explorer consume `AnyFieldDisplayDef[]`. Generic queriton helpers (filter operators, the engine's join handlers) consume `AnyFieldDef[]`. The split is deliberate — non-UI consumers of queriton see only what they need.

## When the engine adds its own field-defs

You don't always supply every field-def yourself. After `.summarize()`, `.project()`, or `.derive()`, queriton appends synthetic field-defs describing the new columns. Downstream `.filter('count', '>', 10)` works because the engine wrote a `count` field-def into the active set when the summarize ran. You can see this in action by inspecting `.toSteps()` — it's the same machinery used for URL serialisation in apps.

> **From SQL:** the closest analogy is information_schema. The set of columns is queryable; queriton just makes it explicit and TypeScript-typed.

In the final chapter we'll cover a handful of common pitfalls and patterns that don't fit neatly anywhere else.
