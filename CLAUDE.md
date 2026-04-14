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

Routes with `[entityId]` segments load their data in a `+page.ts` file using
SvelteKit's `load` function. The page component reads the result from `$props()`:

```
src/routes/brands/[entityId]/+page.ts      ← load function
src/routes/brands/[entityId]/+page.svelte  ← reads let { data } = $props()
```

**Do NOT load route data in `onMount`.** With `ssr = false`, `$state`
assignments after `await` inside `onMount` are unreliable in Svelte 5 — the
template may not re-render when the state changes. `load` functions avoid this
entirely because data is available before the component mounts.

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

Owns filter/sort/column pipeline state via `$bindable` props. Also owns the Views panel (accepts `steps`, `entityType`, `defaultView`, `onload` props and renders `SavedViews` inside its dropdown).

All four panels are `position: absolute` dropdowns that open on button click and close on any outside click (`<svelte:window onclick>`). Clicks inside the toolbar use `stopPropagation` to stay open.

Active state indicators:
- Filters button turns amber + shows count badge when filters are active
- Sort button turns blue + shows the primary sort field and direction inline
- Columns button always shows a count badge

### SearchBar

Thin component — search input + quick-filter `<select>` elements + a Clear button (shown only when dirty). The `quickFilterOptions` array is computed by `EntityExplorer` from `quickFilterFields` and passed down.

## EntityId formats

| Entity  | Format                        | Example                  |
|---------|-------------------------------|--------------------------|
| Tablet  | `BRAND.TABLET.MODELID`        | `WACOM.TABLET.CTL4100`   |
| Pen     | `BRAND.PEN.PENID`             | `WACOM.PEN.KP503E`       |
| Brand   | `BRANDID`                     | `WACOM`                  |

Brand EntityIds are intentionally short (just the BrandId) because the
`BRAND.BRAND.BRAND` pattern added no information.
