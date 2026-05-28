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

## The cross-page setter pattern

Some fields need data the dataset doesn't store on the entity itself — e.g. "how many pressure-response sessions exist for this pen?" The fields file declares a module-scope `let` plus a `setX()` exporter; `+layout.ts` populates it once per session.

From [pen-fields.ts](../data-repo/lib/entities/pen-fields.ts):

```ts
let pressureSessionCountByPenEntityId: ReadonlyMap<string, number> = new Map();
export function setPressureSessionCountByPenEntityId(
	map: ReadonlyMap<string, number>,
): void {
	pressureSessionCountByPenEntityId = map;
}

// ...later in PEN_FIELDS:
{
	key: "PressureSessionCount", label: "Pressure Sessions",
	computed: true, type: "number", group: "Sensors",
	getValue: (p) => String(pressureSessionCountByPenEntityId.get(p.EntityId) ?? 0),
},
```

And from [src/routes/+layout.ts](../src/routes/+layout.ts):

```ts
const sessionsByPen = new Map<string, number>();
for (const s of sessions)
	sessionsByPen.set(s.PenEntityId, (sessionsByPen.get(s.PenEntityId) ?? 0) + 1);
setPressureSessionCountByPenEntityId(sessionsByPen);
```

**Wire setters in `+layout.ts`, not in individual `+page.ts` files.** That guarantees every list / detail page sees the same values regardless of entry point.

Current setters:

| Setter                                 | Populates                                                                           | Wired from                                        |
| -------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------- |
| `setDefectsByInventoryId`              | `IsDefective` on PressureResponse                                                   | [src/routes/+layout.ts](../src/routes/+layout.ts) |
| `setPenFamilyNames`                    | The `PenFamily` column shows `FamilyName` (not `EntityId`) on pens / inventory pens | [src/routes/+layout.ts](../src/routes/+layout.ts) |
| `setPressureSessionCountByPenEntityId` | `PressureSessionCount` on Pens                                                      | [src/routes/+layout.ts](../src/routes/+layout.ts) |
| `setInventoryUnitCountByPenEntityId`   | `UnitsInInventory` on Pens                                                          | [src/routes/+layout.ts](../src/routes/+layout.ts) |

## `enumValues` and the `BRANDS` constant

For enum fields whose values are open-ended (e.g. `Brand`), pull from [data-repo/lib/loader-shared.ts](../data-repo/lib/loader-shared.ts):

```ts
import { BRANDS } from '../loader-shared.js';

{ key: "Brand", label: "Brand", getValue: (p) => brandName(p.Brand),
  type: "enum", enumValues: [...BRANDS], group: "Model" },
```

The `BRANDS` array is the single source of truth for known brand IDs — adding a brand here propagates to every Brand-typed enum in every fields file. The data-quality CLI's `runBrandDriftCheck` flags any brand in `brands.json` that's missing from `BRANDS`.

## Display patterns

- **Always return a string from `getValue`.** Empty values → `''`. The engine coerces back to number / enum based on `type`. Returning `undefined` produces silent NaN comparisons.
- **`getDisplayValue` is rendering-only.** It changes what `DetailView` and the table cell render but the filter/sort still use `getValue`. Use it when you want a pretty label without breaking equality filters.
- **`getHref` makes a cell clickable in `DetailView` only.** List pages handle links via the route's `cellLinks` prop — see [EntityExplorer.svelte](../src/lib/components/EntityExplorer.svelte).
- **`computed: true` is for "this isn't on the JSON, we made it up"** — derived from other fields, aggregated from other entities, or computed via the setter pattern above. Surfaces as a small badge in the UI.
- **`unit` is consumed by formatters.** `'gf'` (gram-force), `'g'` (grams), `'mm'`, etc. Detail-page rows and the export pipeline check the unit string and apply metric ↔ imperial conversion when `unit-store`'s `unitPreference` is `'imperial'`.

## Pitfalls

- **Don't shadow built-in keys.** `EntityId`, `_id`, `_CreateDate`, `_ModifiedDate` are reserved — re-declaring them as a field-def causes saved-view round-trips to break.
- **Number fields with optional values.** Use `getValue: (p) => p.Field ?? ''` (string), not `p.Field?.toString()`. The empty string is the engine's "missing" sentinel for number fields, and `isempty` / `isnotempty` operators rely on it.
- **The cross-page setter pattern is module-level state.** If two `+layout.ts` instances ever raced to set it (they don't today; we have one root layout), the last write would win. Keep all setter calls in one place.
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
