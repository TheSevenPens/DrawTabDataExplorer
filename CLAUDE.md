# DrawTabDataExplorer – Claude Code Guide

## Project overview

SvelteKit static site (adapter-static, `ssr = false`, `prerender = true`) that
displays tablet/pen data from the `data-repo` git submodule. Data files are
symlinked from `static/` → `data-repo/data/` so Vite serves them as static
assets. The app is deployed to GitHub Pages.

## Key aliases

| Alias   | Resolves to                                              |
|---------|----------------------------------------------------------|
| `$data` | `data-repo/` (the submodule root, where TS lib lives)   |
| `$lib`  | `src/lib/`                                               |

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

| Entity         | Format                          | Example                             |
|----------------|---------------------------------|-------------------------------------|
| Tablet         | `brand.tablet.modelid`          | `wacom.tablet.ctl4100`              |
| Pen            | `brand.pen.penid`               | `wacom.pen.kp503e`                  |
| Driver         | `brand.driver.version_os`       | `wacom.driver.4.78-2_macos`         |
| Pen Family     | `brand.penfamily.familyid`      | `wacom.penfamily.wacomkpgen3`       |
| Tablet Family  | `brand.tabletfamily.familyid`   | `wacom.tabletfamily.wacomintuosprogen8` |
| Brand          | `brand`                         | `wacom`                             |

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
