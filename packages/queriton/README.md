# queriton

A lazy, typed pipeline-of-verb-steps query API for in-memory JSON-shaped
collections. dplyr-style verbs (`filter`, `sort`, `summarize`, `join`,
`unroll`, `derive`, …) build up a `Step[]` that's executed on demand
when you materialise the `Query` — and the pipeline itself is data, so
saved views, URL-state round-trips, and API-explorer-style introspection
are first-class.

Designed to be reusable. The package is a thin standalone core; the
DrawTab data explorer that drives its development is one consumer among
many it could have.

## Install

Currently an npm workspace package, not yet published. Inside this
monorepo it resolves via the workspace symlink:

```ts
import { Query, DataSet, type Loader, type AnyFieldDef } from 'queriton';
```

(Tracking issue [#143](https://github.com/TheSevenPens/DrawTabDataExplorer/issues/143)
covers the npm-publish path.)

## Minimal example

Register a collection on a `DataSet`, run a query, materialise it.

```ts
import { DataSet, type AnyFieldDef } from 'queriton';

interface Car {
	model: string;
	mpg: number;
	cyl: number;
}

const carFields: AnyFieldDef[] = [
	{ key: 'model', label: 'Model', type: 'string', group: 'data', getValue: (c: Car) => c.model },
	{ key: 'mpg', label: 'MPG', type: 'number', group: 'data', getValue: (c: Car) => String(c.mpg) },
	{ key: 'cyl', label: 'Cyl', type: 'number', group: 'data', getValue: (c: Car) => String(c.cyl) },
];

const ds = new DataSet();
ds.registerCollection<Car>('cars', async () => fetchCarsFromSomewhere(), carFields);

const topMpg = await ds
	.get<Car>('cars')
	.filter('cyl', '==', 4)
	.sort('mpg', 'desc')
	.take(3)
	.toArray();
```

The `load` function is invoked at most once per `DataSet` instance —
every `Query.toArray()` call against the same name reuses the cached
Promise.

## The verb set

- **Filter** — `.filter(field, op, value)`, `.filter(predicateFn)`, `.filter(boolExpr)`, `.filterIn(field, values)`, `.filterNotIn(field, values)`
- **Sort** — `.sort(field, direction?)`, `.sort([{field, direction?}, …])` (primary-first)
- **Pagination** — `.take(n)`, `.skip(n)`, `.last(n)`, `.reverse()`
- **Project** — `.select([fields])`
- **Compute** — `.derive({col: row => …})`
- **Group / aggregate** — `.summarize({by, count, sum, avg, min, max, median, distinctCount, first, last, collect})`
- **Distinct** — `.distinct(field)` / `.values(field)` (synonym)
- **Joins** — `.join(other, leftKey, rightKey)`, `.semijoin`, `.antijoin`, `.leftjoin`
- **Combine** — `.concat(other)` / `.union(other)` (synonym)
- **Unroll arrays** — `.unroll(field)`
- **Materialise** — `.toArray()`, `.find(predicateFn)`, `.count()`, `.keyBy(field)`, `.collectBy(field)`

### Filter operators

`==` · `!=` · `contains` · `notcontains` · `startswith` · `notstartswith`
· `containsStrict` · `notcontainsStrict` · `startswithStrict` ·
`notstartswithStrict` · `empty` · `notempty` · `>` · `>=` · `<` · `<=` ·
`in` (pipe-separated values) · `notin` · `between` (`'lo|hi'`,
inclusive).

`contains` / `startswith` are case-insensitive; the `Strict` variants
preserve case.

## SummaryRow widening

After `.summarize(…)` or `.select([…])`, the row shape becomes
`SummaryRow`:

```ts
type SummaryRow = Record<string, string | number | string[]>;
```

So `Query<T>` becomes `Query<SummaryRow>` and downstream verbs read
columns by name as opaque keys. This is a deliberate loosening — the
shape change is what makes "summarize then sort by the count column" a
chainable one-liner — but it does mean you trade compile-time field
narrowing for runtime flexibility at the summarize boundary.

## Null handling

Every documented null behaviour is pinned in
[`test/nulls.test.ts`](./test/nulls.test.ts). The headlines:

- `empty` / `notempty` match missing / undefined / `""`. `==` with
  refValue `""` matches null/missing fields (both stringify to `""`).
- Numeric operators (`>`, `>=`, `<`, `<=`, `between`) **exclude** null
  values (the engine short-circuits on `val === ''`).
- Sort places null values **first** in ascending order, **last** in
  descending order (`""` is the smallest string in `localeCompare`).
- `count` includes null rows; `sum` / `avg` / `min` / `max` / `median`
  skip them; `distinctCount` skips them; `first` / `last` / `collect`
  **include** them as `""` entries.
- `.distinct()`, `.keyBy()`, `.collectBy()` skip null keys.
- **Joins treat null keys as equal** — two rows with missing join keys
  will pair up. This is opposite of SQL's `NULL != NULL`. Deliberate
  design choice, pinned in tests; revisit behind an option if it bites.
- `.unroll()` on a null / non-array value passes the row through; on
  `[]` drops it; on `[null, …]` the null element survives as its own
  emitted row.

## A note on `FieldDef`

`FieldDef<T>` is the contract queriton uses to read values out of your
records (`getValue`) and present them in filter UIs (`type`,
`enumValues`, `label`). It also carries a few hooks that are really
display affordances — `getDisplayValue`, `getHref`, `group`. Non-UI
consumers can ignore them; a future split into a thinner core type plus
a `FieldDisplayDef` extension is tracked in
[#142](https://github.com/TheSevenPens/DrawTabDataExplorer/issues/142).

## Running the tests

The 126-test suite is filesystem- and network-free:

```bash
# From the outer repo:
npm run test:unit
```

Standalone `cd packages/queriton && npm test` doesn't work yet — that's
[#145](https://github.com/TheSevenPens/DrawTabDataExplorer/issues/145).

The fixtures live under [`test/fixtures/`](./test/fixtures/):

- `mtcars.ts` — classic 32 × 11 dataset; drives most verb coverage
- `orders-customers.ts` — 6 + 4 rows for the four join variants
- `people-hobbies.ts` — array column for `.unroll()`
- `with-nulls.ts` — 8-row null-handling fixture

## License

ISC.
