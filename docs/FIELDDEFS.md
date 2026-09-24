# FieldDef system

**Audience:** contributors and agents adding columns, filters, computed metrics, or new entity types.
**Source of truth:** [packages/queriton/src/types.ts](../packages/queriton/src/types.ts) (interfaces) + [data-repo/lib/entities/](../data-repo/lib/entities/) (per-entity field arrays).

Every column in the explorer's list pages, every filter / sort operator, every detail-page row, every export, and every API-Explorer query reads through the same `FieldDef` abstraction. Touching one field-def file propagates to all of those surfaces at once — no per-page wiring.

## The two interfaces

### `FieldDef<T>` — engine-side

The minimum descriptor the queriton engine needs to read, filter, sort, and group:

```ts
interface FieldDef<T> {
	key: string; // unique identifier within an entity (URL state, saved views)
	label: string; // human-readable column header
	getValue: (item: T) => string; // *always returns a string*; engine coerces per `type`
	type: 'string' | 'number' | 'enum';
	enumValues?: string[]; // required when type === 'enum'; drives the dropdown
}
```

The engine only sees this interface — CLI tools and backend pipelines can depend on it without pulling UI types.

### `FieldDisplayDef<T>` — UI-side (almost always what you want)

Extends `FieldDef<T>` with display affordances:

```ts
interface FieldDisplayDef<T> extends FieldDef<T> {
	group: string; // section label in FieldPicker, DetailView, ColumnBar
	getDisplayValue?: (item: T) => string; // override the rendered text only (filtering uses getValue)
	getHref?: (item: T) => string | null; // make the value a link in DetailView
	computed?: boolean; // show a "computed" badge in the UI
	unit?: string; // 'gf', 'g', 'mm' — picked up by unit-aware formatters
}
```

**Default to `FieldDisplayDef<T>` when authoring entity fields.** The convenience aliases `AnyFieldDef` (engine generics) and `AnyFieldDisplayDef` (UI generics) drop the `T` parameter for components that operate on arbitrary fields.

## Where the field arrays live

One file per entity, under [data-repo/lib/entities/](../data-repo/lib/entities/):

| File                                                                                   | Exported arrays                                                                         |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| [`pen-fields.ts`](../data-repo/lib/entities/pen-fields.ts)                             | `PEN_FIELDS`, `PEN_DEFAULT_COLUMNS`, `PEN_DEFAULT_VIEW`, `PEN_FIELD_GROUPS`             |
| [`tablet-fields.ts`](../data-repo/lib/entities/tablet-fields.ts)                       | `TABLET_FIELDS`, `TABLET_DEFAULT_COLUMNS`, `TABLET_DEFAULT_VIEW`, `TABLET_FIELD_GROUPS` |
| [`brand-fields.ts`](../data-repo/lib/entities/brand-fields.ts)                         | `BRAND_FIELDS`, ...                                                                     |
| [`driver-fields.ts`](../data-repo/lib/entities/driver-fields.ts)                       | `DRIVER_FIELDS`, ...                                                                    |
| [`pen-family-fields.ts`](../data-repo/lib/entities/pen-family-fields.ts)               | `PEN_FAMILY_FIELDS`, ...                                                                |
| [`tablet-family-fields.ts`](../data-repo/lib/entities/tablet-family-fields.ts)         | `TABLET_FAMILY_FIELDS`, ...                                                             |
| [`inventory-pen-fields.ts`](../data-repo/lib/entities/inventory-pen-fields.ts)         | `INVENTORY_PEN_FIELDS`, ...                                                             |
| [`inventory-tablet-fields.ts`](../data-repo/lib/entities/inventory-tablet-fields.ts)   | `INVENTORY_TABLET_FIELDS`, ...                                                          |
| [`pressure-response-fields.ts`](../data-repo/lib/entities/pressure-response-fields.ts) | `PRESSURE_RESPONSE_FIELDS`, ...                                                         |
| [`pen-compat-fields.ts`](../data-repo/lib/entities/pen-compat-fields.ts)               | `PEN_COMPAT_FIELDS`, ...                                                                |
| [`name-formatting.ts`](../data-repo/lib/entities/name-formatting.ts)                   | `brandPrefixesName`, `tokenAppearsInName` predicates (shared by pen/tablet)             |

Each file exports four things that the routes consume:

1. **`<ENTITY>_FIELDS`** — the array of `FieldDisplayDef<EntityType>`.
2. **`<ENTITY>_DEFAULT_COLUMNS`** — string keys for the initial visible columns.
3. **`<ENTITY>_DEFAULT_VIEW`** — initial queriton `Step[]` (typically a `select` + a `sort`).
4. **`<ENTITY>_FIELD_GROUPS`** — ordered group labels for sectioned UIs (matches each field's `group`).

## A worked example — adding a computed field

Suppose you want to add a "Has Eraser" boolean badge to the pen list. Edit [pen-fields.ts](../data-repo/lib/entities/pen-fields.ts):

```ts
{
	key: "HasEraser",
	label: "Eraser",
	computed: true,
	type: "enum",
	enumValues: ["yes", "no"],
	group: "Controls",
	getValue: (p) => (p.Eraser ? "yes" : "no"),
},
```

That single edit gives you:

- A new entry in the FieldPicker under "Controls"
- Filter operator support (`eq` / `neq` with the yes/no enum dropdown)
- Sort support
- Column-bar entry
- Detail-page row with the "computed" badge
- Export inclusion in CSV / TSV / JSON / HTML / Markdown
- API-Explorer access

No route changes, no per-page wiring.

## Fields computed from other collections

Some fields need data the entity doesn't store — "how many pressure-response sessions exist for this pen?", "how many units do we own?". **The `DrawTabDataSet` computes these while loading the collection that shows them** and attaches the results to each row; the FieldDef reads them with `computedOf(row)` from [computed.ts](../data-repo/lib/computed.ts).

```ts
// pen-fields.ts
{
	key: "PressureSessionCount", label: "Pressure Sessions",
	computed: true, type: "number", group: "Sensors",
	getValue: (p) => String(computedOf(p).PressureSessionCount ?? 0),
},
```

The collection's loader in [dataset.ts](../data-repo/lib/dataset.ts) loads exactly the inputs it needs and calls `attachComputed(row, { … })`. Nothing is preloaded by the app, and no page can forget a setup step.

| Computed value                           | On               | Computed from                                                         |
| ---------------------------------------- | ---------------- | --------------------------------------------------------------------- |
| `UnitsInInventory`                       | Pens, Tablets    | InventoryPens / InventoryTablets                                      |
| `PressureSessionCount`                   | Pens             | `version.json` `indexes.pressureSessionsByPen` (URL); sessions (disk) |
| `FamilyName` (display of `PenFamily`)    | Pens             | PenFamilies                                                           |
| `PenCount`, `InventoryCount`, `ModelIds` | PenFamilies      | Pens, InventoryPens                                                   |
| `IsDefective`                            | PressureResponse | InventoryPens defects                                                 |

To add one: extend `ComputedValues`, compute it in the collection's loader, read it with `computedOf`. If its input is large and the value small (the session count is ~3 KB derived from ~1.5 MB), add a build-time index to `buildVersionInfo()` and prefer it in URL mode.

**This replaced module-level setters** (`setPenFamilyNames`, `setPressureSessionCountByPenEntityId`, …) that `+layout.ts` had to call. That forced every page, `/about` included, to preload ~1.6 MB, and any consumer that skipped the setup read 0 / NO. Don't reintroduce the pattern (#346).

## `enumValues` and the `BRANDS` constant

For enum fields whose values are open-ended (e.g. `Brand`), pull from [data-repo/lib/loader-shared.ts](../data-repo/lib/loader-shared.ts):

```ts
import { BRANDS } from '../loader-shared.js';

{ key: "Brand", label: "Brand", getValue: (p) => p.Brand, getDisplayValue: (p) => brandName(p.Brand),
  type: "enum", enumValues: [...BRANDS], group: "Model" },
```

The `BRANDS` array is the single source of truth for known brand IDs — adding a brand here propagates to every Brand-typed enum in every fields file. The data-quality CLI's `runBrandDriftCheck` flags any brand in `brands.json` that's missing from `BRANDS`.

## Display patterns

- **Always return a string from `getValue`.** Empty values → `''`. The engine coerces back to number / enum based on `type`. Returning `undefined` produces silent NaN comparisons.
- **`getDisplayValue` is rendering-only.** It changes what `DetailView` and the table cell render but the filter/sort still use `getValue`. Use it when you want a pretty label without breaking equality filters.
- **`getHref` makes a cell clickable in `DetailView` only.** List pages handle links via the route's `cellLinks` prop — see [EntityExplorer.svelte](../src/lib/components/EntityExplorer.svelte).
- **`computed: true` is for "this isn't on the JSON, we made it up"** — derived from other fields, or computed from other collections by the dataset (above). Surfaces as a small badge in the UI.
- **`unit` is consumed by formatters.** `'gf'` (gram-force), `'g'` (grams), `'mm'`, etc. Detail-page rows and the export pipeline check the unit string and apply metric ↔ imperial conversion when `unit-store`'s `unitPreference` is `'imperial'`.

## Pitfalls

- **Don't shadow built-in keys.** `EntityId`, `_id`, `_CreateDate`, `_ModifiedDate` are reserved — re-declaring them as a field-def causes saved-view round-trips to break.
- **Number fields with optional values.** Use `getValue: (p) => p.Field ?? ''` (string), not `p.Field?.toString()`. The empty string is the engine's "missing" sentinel for number fields, and `isempty` / `isnotempty` operators rely on it.
- **`getValue` returns the stored value, never a label.** An enum field's `getValue` must be one of its `enumValues` (`data-repo/lib/field-values.test.ts` checks every one). Labels go in `getDisplayValue`.
- **The label is the column header but the key is the URL.** Renaming `label` is free; renaming `key` invalidates saved views and shared URLs.

## Where it's read

| Surface                                        | Reads                                                                  |
| ---------------------------------------------- | ---------------------------------------------------------------------- |
| `EntityExplorer`                               | `<ENTITY>_FIELDS`, `<ENTITY>_DEFAULT_COLUMNS`, `<ENTITY>_DEFAULT_VIEW` |
| `FilterBar` / `SortBar`                        | `FieldDef.type`, `FieldDef.enumValues`                                 |
| `ColumnBar` / `FieldPicker`                    | `FieldDisplayDef.group`, `.label`, `.computed`                         |
| `ResultsTable`                                 | `FieldDef.getValue`                                                    |
| `DetailView`                                   | `FieldDisplayDef.getDisplayValue ?? .getValue`, `.getHref`, `.unit`    |
| `ExportDialog`                                 | `FieldDef.getValue` for every visible column                           |
| queriton engine (filter/sort/summarize/derive) | The full `FieldDef[]` is threaded into every step                      |
| `/api-explorer`                                | Lets users build queries against any `FieldDef` they like              |

See [ARCHITECTURE.md § Shared modules](ARCHITECTURE.md) for the broader data-flow picture and [packages/queriton/README.md](../packages/queriton/README.md) for the engine APIs that consume `FieldDef`.
