# 1. Getting Started

In this chapter you will install queriton, run your first query, and meet the dataset you'll use throughout the tutorial. By the end you'll know how a Query is constructed and how to materialise its results.

## Installing queriton

queriton is a TypeScript library with no runtime dependencies. Install it the usual way:

```bash
npm install queriton
```

It works in Node, in the browser, and in any bundler that understands ESM. The whole library is one import:

```ts
import { Query, DataSet } from 'queriton';
```

`Query` is the per-collection workhorse. `DataSet` (covered in chapter 8) is an optional container that groups Queries together — you don't need it to get started.

## The dataset

We'll use the **Palmer Penguins** dataset for almost every example in the tutorial. It's 344 rows of measurements taken at three Antarctic research stations: bill length and depth, flipper length, body mass, plus species, island, sex, and the year of observation. It's well-known to anyone who's used R or Python's data tools, and it has a useful property for teaching: it contains naturally-occurring missing values.

A representative slice:

| species   | island    | bill_length_mm | bill_depth_mm | flipper_length_mm | body_mass_g | sex    | year |
| --------- | --------- | -------------- | ------------- | ----------------- | ----------- | ------ | ---- |
| Adelie    | Torgersen | 39.1           | 18.7          | 181               | 3750        | male   | 2007 |
| Adelie    | Torgersen | 39.5           | 17.4          | 186               | 3800        | female | 2007 |
| Adelie    | Torgersen | _null_         | _null_        | _null_            | _null_      | _null_ | 2007 |
| Gentoo    | Biscoe    | 46.1           | 13.2          | 211               | 4500        | female | 2007 |
| Chinstrap | Dream     | 46.5           | 17.9          | 192               | 3500        | female | 2007 |

The data comes from Horst, Hill & Gorman (2020); it's published under CC0. queriton bundles it as a test fixture at `packages/queriton/test/fixtures/penguins.ts`.

## Your first Query

Constructing a Query takes two arguments: a **loader** that returns the rows, and a **fields array** describing each column.

```ts run
const q = new Query<Penguin>(async () => penguins, penguinFields);
const rows = await q.toArray();
expect(rows).toHaveLength(344);
```

A few things to notice:

- The loader is `async () => penguins` — a zero-argument function that returns a Promise of the rows. queriton calls it lazily, the first time you materialise the Query. If your data lives in a file or a remote service, this is where the fetch goes.
- `penguinFields` is a typed array of `FieldDef<Penguin>` describing each column. The engine uses field definitions to read values for filtering, sorting, and grouping — covered in chapter 9.
- `.toArray()` is the standard way to extract the result. It returns a Promise of `Penguin[]`.

## Counting without materialising

If you only need a count, `.count()` is more direct than `(await q.toArray()).length`:

```ts run
const n = await penguinsQ().count();
expect(n).toBe(344);
```

`penguinsQ()` is the helper used throughout this tutorial:

```ts
function penguinsQ(): Query<Penguin> {
	return new Query<Penguin>(async () => penguins, penguinFields);
}
```

It just wraps the constructor so every example can start fresh. You'll see it in every chapter.

## Queries are lazy and immutable

A Query is a description of work to do, not a buffer of rows. Calling `.filter()` or `.sort()` returns a **new** Query — the original is untouched and no rows have been read yet. Nothing actually runs until you call `.toArray()`, `.count()`, or another terminal method.

```ts run
const base = penguinsQ();
const filtered = base.filter('species', '==', 'Adelie');

// The original is unchanged.
expect(await base.count()).toBe(344);
expect(await filtered.count()).toBe(152);
```

Two things to notice:

- Calling `.filter()` did not mutate `base`. Each Query method returns a new Query.
- Each terminal call (`base.count()`, `filtered.count()`) re-runs the pipeline from scratch. queriton doesn't cache results between terminal calls — that's the caller's job if you need it.

In the next chapter we'll build up real pipelines: filter, sort, select, take.
