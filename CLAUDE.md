# DrawTabDataExplorer – Claude Code Guide

## Project overview

SvelteKit static site (adapter-static, `ssr = false`, `prerender = true`) that
displays tablet/pen data from the `data-repo` git submodule. Data files are
served via symlinks from `static/` → `data-repo/data/` so Vite picks them up
as static assets. The app is deployed to GitHub Pages.

## First-time setup — `static/` symlinks

`npm install` runs `scripts/setup-static.mjs` via the `postinstall` hook,
which creates symlinks (Windows: directory junctions) from `static/` →
`data-repo/data/` for every subdirectory the dev server needs. Idempotent —
re-runnable any time as `npm run setup-static`.

If the data submodule isn't checked out yet, the setup script warns and
skips. Run `git submodule update --init --recursive` first, then
`npm run setup-static`.

Symptom of missing links: empty list pages and 404s on every entity detail
URL. The dev server prints `[404] GET /tablets/WACOM-tablets.json` and
similar in its terminal output. Re-run `npm run setup-static` to fix.

## Key aliases

| Alias   | Resolves to                                           |
| ------- | ----------------------------------------------------- |
| `$data` | `data-repo/` (the submodule root, where TS lib lives) |
| `$lib`  | `src/lib/`                                            |

## Data loading patterns

### Detail pages — use `+page.ts` load functions

All routes with `[entityId]` segments load their data in a `+page.ts` file using
SvelteKit's `load` function. The page component reads the result from `$props()`:

```
src/routes/brands/[entityId]/+page.ts           ← load function
src/routes/brands/[entityId]/+page.svelte       ← reads let { data } = $props()

src/routes/tablets/[entityId]/+page.ts
src/routes/pens/[entityId]/+page.ts
src/routes/pen-families/[entityId]/+page.ts
src/routes/tablet-families/[entityId]/+page.ts
src/routes/drivers/[entityId]/+page.ts
```

**Do NOT load route data in `onMount`.** With `ssr = false`, `$state`
assignments after `await` inside `onMount` are unreliable in Svelte 5 — the
template may not re-render when the state changes. `load` functions avoid this
entirely because data is available before the component mounts.

### Layout-level data — `+layout.ts`

`src/routes/+layout.ts` exports a `load()` function that fetches the
DrawTabData version info once per session. `+layout.svelte` reads it via
`let { children, data } = $props()`. This avoids an `onMount` in the layout.

### List pages — `onMount` is fine

Pages that load a full dataset and pass it to `EntityExplorer` (e.g.
`/brands`, `/tablets`) use `onMount` with `Promise.all`. This works because
these pages use `{:else}` (not `{:else if data}`) so the component is always
mounted and Svelte can update it in place.

## Svelte 5 reactive state gotchas

- **`{:else if stateVar}` vs `{:else}`** — `{:else if stateVar}` requires
  Svelte to _create_ a new DOM branch when `stateVar` becomes truthy. In some
  async contexts this creation doesn't fire. Use `{:else}` and handle the
  null/loading state inside the block with optional chaining (`item?.name ?? ''`).

- **HMR state corruption** — After many rapid edits the Svelte HMR can
  accumulate stale state that makes debugging misleading (state assignments that
  print the right value in `console.log` but never update the DOM). When
  something looks impossibly wrong, use `window.location.replace(url)` for a
  full navigation rather than relying on HMR. Open a fresh browser tab if still
  confused.

## Submodule workflow

Data lives in `data-repo/` (a git submodule pointing to DrawTabData). Changes
to data files require two commits:

1. Commit inside `data-repo/`
2. Commit in the outer repo to advance the submodule pointer

```bash
cd data-repo && git add . && git commit -m "..." && git push
cd .. && git add data-repo && git commit -m "chore: update data-repo submodule (...)"
```

## Adding a new brand

A new brand needs touches in two places plus the data files themselves.
Anything else is automated or validated.

1. **Brand record** — add to `data-repo/data/brands/brands.json`. The static
   copy under `static/brands/` is now a symlink, so no separate resync.
2. **Schema enum** — add `"FOOBAR"` to `BrandEnum` in
   `data-repo/lib/schemas.ts` **and** to `BRANDS` in
   `data-repo/lib/loader-shared.ts` (single source for filter dropdowns).
   The data-quality CLI's drift check (`runBrandDriftCheck`) flags it if
   you forget either.
3. **Data files** — write `FOOBAR-tablets.json`, `FOOBAR-pens.json`, etc.
   See `scripts/gen-brand-data.example.mjs` for a generator template that
   handles UUIDs, derived display dimensions, and EntityId derivation.
4. **`Model.Family` convention** — the value must be the tablet-family
   **EntityId** (e.g. `"foobar.tabletfamily.fooseries"`), **not** the
   `FamilyName`. The CLI's `runCrossEntityChecks` flags any orphaned
   reference. Older Wacom entries with plain names like `"Cintiq"` are
   legacy and produce orphan-reference warnings — don't follow that example.
5. **Validate** — `npm run data-quality` (alias for
   `tsx data-repo/lib/run-data-quality.ts`). Expect zero issues introduced
   by your changes; existing pre-existing issues (HUION/WACOM EntityId
   mismatches, legacy Wacom plain-name family refs, VEIKK brand drift) are
   unrelated.

What's automated (no manual action needed):

- **Loader gating** — the URL and disk loaders both attempt every brand in
  `BRANDS` and silently skip files that don't exist. There's no per-entity
  brand list to maintain.
- **Field-def Brand enums** — every `*-fields.ts` Brand field uses
  `enumValues: [...BRANDS]`. Adding a brand to `BRANDS` propagates to every
  filter dropdown automatically.
- **`static/` symlinks** — `npm install` wires up the static directory.
- **Cross-entity orphan checks** — typos in `Model.Family`, `PenFamily`,
  `PenCompat.PenId`, or `PenCompat.TabletIds` fail validation.

## UI component architecture

### EntityExplorer

The main list-page component. Renders a title row, a top-bar, and a results table.

**Top-bar layout** (one flex row):

```
[ Search... ] [ QuickFilter ▾ ] ...   [ Filters ] [ Sort ] [ Columns N ] [ Views ]
└─────────────── SearchBar ──────────┘ └──────────── QueryPipelineBar ────────────┘
```

- `SearchBar` — text search input + optional quick-filter dropdowns (configured via `quickFilterFields` prop). Stateless except for `$bindable` `searchText` and `quickFilters`.
- `QueryPipelineBar` — four toolbar buttons that open dropdown panels: **Filters**, **Sort**, **Columns**, **Views**. Buttons show active-state indicators (filter count badge, sort field name). The Views panel embeds `SavedViews` directly.

### QueryPipelineBar

A thin coordinator component that renders **FilterBar**, **SortBar**, **ColumnBar**, and the Views dropdown side-by-side. It owns only the `openPanel` state (`'filter' | 'sort' | 'columns' | 'views' | null`) and passes `isOpen` + `ontoggle` to each sub-component.

Each sub-component is self-contained:

- **FilterBar** — filter pills, editor row, field picker, context menu, drag-to-remove
- **SortBar** — sort pills, direction toggle, drag-to-reorder, context menu
- **ColumnBar** — column pills, drag-to-reorder, context menu

All panels are `position: absolute` dropdowns that open on button click and close on any outside click (`<svelte:window onclick>`). Clicks inside the panel use `stopPropagation` to stay open.

Active state indicators:

- Filters button turns amber + shows count badge when filters are active
- Sort button turns blue + shows the primary sort field and direction inline
- Columns button always shows a count badge

### SearchBar

Thin component — search input + quick-filter `<select>` elements + a Clear button (shown only when dirty). The `quickFilterOptions` array is computed by `EntityExplorer` from `quickFilterFields` and passed down.

## Label formatting (full names)

Pen and tablet "full name" labels go through canonical formatters in
`data-repo/lib/entities/{pen,tablet}-fields.ts`. **Never reconstruct
`${brandName(x)} ${x.Name} (${x.Id})` inline** — call one of:

- `penFullName(pen)` → "Brand Name (Id)" with redundant pieces dropped
- `penBrandAndName(pen)` → "Brand Name" only
- `tabletFullName(tablet)` → "Brand Name (Id)" with redundant pieces dropped
- `tabletBrandAndName(tablet)` → "Brand Name" only
- `tabletNameAndId(tablet)` → "Name (Id)" only (no brand prefix)

`src/lib/pen-helpers.ts` and `src/lib/tablet-helpers.ts` re-export these
for `$lib` consumers. Inline-formatting bypasses the suppression rules
and was the root cause of the "Wacom Wacom One Pen" bug — when the brand
prefix rule was added, only the field-def getters benefited. Keep the
list of consumers funnelling through the helpers small and explicit.

Two redundancy rules are in play (predicates exported from the same
files for ad-hoc use, e.g. when you want to keep the `(Id)` styled in a
`<span class="dim">`):

- `penIdRedundantInName` / `tabletIdRedundantInName` — id appears in
  name as a whole token. **`tabletIdRedundantInName` always returns
  `true` for `Brand === 'APPLE'`** — Apple iPad ids
  (e.g. `iPad-Pro-12.9-Gen1`) only restate the marketing name in a
  less-readable form. Don't remove the APPLE branch when refactoring.
- `penBrandRedundantInName` / `tabletBrandRedundantInName` — name starts
  with the brand display name (case-insensitive).

To audit the dataset for new entities matching either rule:

```bash
node scripts/find-name-contains-id.mjs   # id in name
node scripts/find-brand-in-name.mjs      # name starts with brand
```

## Pressure response chart gotchas

`PressureChart.svelte` (Chart.js) has two non-obvious behaviors that
will surprise contributors:

- **Envelope fill** is rendered as a single closed-polygon dataset
  (`[...low, ...high.reverse()]`) with `fill: 'shape'`, _not_ as two
  separate low/high lines with `fill: '-1'`. The between-datasets fill
  in Chart.js is x-axis-parametric, so it terminates at the smaller
  line's max x and leaves a triangular gap at the upper-right (around
  p=99→100, where `min(P100) ≪ max(P100)`). Don't "simplify" this back
  to two datasets without re-introducing the bug.
- **Max-pressure zoom** computes `x.max` dynamically as
  `max(estimateP100 across visible sessions) + 50` so the upper-right
  corner of the envelope always stays on-canvas. This depends on
  `visibleSessions` (which honours `hiddenIds` and the defective
  filter), so the `$effect` block explicitly reads `maxP100` to track
  it.

The `lockedZoom` prop on `PressureChart` hides the Zoom dropdown and
forces a preset — used by the Max Pressure tab to embed a max-zoomed
chart alongside the bands charts.

## Type aliases

`AnyFieldDef` is a convenience alias for `FieldDef<any>` used throughout UI
components that operate on fields generically (FilterBar, SortBar, ColumnBar,
FilterStep, SortStep, SelectStep, ResultsTable, etc.).

```ts
// data-repo/lib/pipeline/types.ts
export type AnyFieldDef = FieldDef<any>;
```

Import it alongside other pipeline types:

```ts
import type { AnyFieldDef } from '$data/lib/pipeline/types.js';
```

## EntityId formats

All EntityIds are **lowercase**. The second dot-segment encodes the entity type,
making EntityIds self-describing.

| Entity        | Format                        | Example                                 |
| ------------- | ----------------------------- | --------------------------------------- |
| Tablet        | `brand.tablet.modelid`        | `wacom.tablet.ctl4100`                  |
| Pen           | `brand.pen.penid`             | `wacom.pen.kp503e`                      |
| Driver        | `brand.driver.version_os`     | `wacom.driver.4.78-2_macos`             |
| Pen Family    | `brand.penfamily.familyid`    | `wacom.penfamily.wacomkpgen3`           |
| Tablet Family | `brand.tabletfamily.familyid` | `wacom.tabletfamily.wacomintuosprogen8` |
| Brand         | `brand`                       | `wacom`                                 |

Brand EntityIds have no dots (just the brand name) because the
`brand.brand.brand` pattern adds no information.

## Entity detail route

`/entity/[entityId]` is the **canonical** detail URL for every entity. The
loader (`src/routes/entity/[entityId]/+page.ts`) parses the EntityId,
determines the entity type from the second dot-segment (or treats a single
segment as a brand), fetches the appropriate data, and returns it with an
`entityType` discriminator. The page component (`+page.svelte`) renders one
of `TabletDetail`, `PenDetail`, `BrandDetail`, `DriverDetail`,
`PenFamilyDetail`, or `TabletFamilyDetail` based on `entityType`.

```
/entity/wacom.pen.kp503e                       →  PenDetail
/entity/wacom.tablet.ctl4100                   →  TabletDetail
/entity/wacom                                  →  BrandDetail
/entity/wacom.driver.4.78-2_macos              →  DriverDetail
/entity/wacom.penfamily.wacomkpgen3            →  PenFamilyDetail
/entity/wacom.tabletfamily.wacomintuosprogen8  →  TabletFamilyDetail
```

The typed routes (`/tablets/[entityId]`, `/pens/[entityId]`, etc.) still
exist but are thin redirects to `/entity/[entityId]` — see each route's
`+page.ts` for the `redirect(307, ...)` call. List pages link directly to
`/entity/...` so users land on the canonical URL without an intermediate
hop.

The route has `prerender = false` and relies on the SPA fallback
(`404.html`) to serve the app shell for unrecognised paths.
