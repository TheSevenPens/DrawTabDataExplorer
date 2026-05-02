# Architecture

## Project structure

```
DrawTabDataExplorer/
├── data-repo/                    # Git submodule -> DrawTabData
│   ├── data/                     # JSON datasets
│   └── lib/                      # Loaders, pipeline, entities, units
├── src/
│   ├── app.html                  # HTML shell
│   ├── routes/                   # SvelteKit pages
│   │   ├── +layout.ts            # load() fetches version info for layout
│   │   ├── +layout.svelte        # Nav + version banner
│   │   ├── +page.ts              # Redirects / -> /tablets
│   │   ├── about/                # About page (links to related tools)
│   │   ├── tablets/              # Tablets list (+page.svelte) +
│   │   │                         # detail [entityId] (+page.ts redirect)
│   │   ├── pens/                 # Pens list + detail (+page.ts)
│   │   ├── pen-families/         # Pen families list + detail (+page.ts)
│   │   ├── tablet-families/      # Tablet families list + detail (+page.ts)
│   │   ├── pen-compat/           # Pen compatibility list
│   │   ├── drivers/              # Drivers list + detail (+page.ts)
│   │   ├── brands/               # Brands list + detail (+page.ts)
│   │   ├── pressure-response/    # Sessions list (sub-tab of Pens);
│   │   │                         # detail at /entity/<brand>.session.<id>
│   │   ├── pen-inventory/        # Personal pen inventory (sub-tab of Pens)
│   │   ├── tablet-inventory/     # Personal tablet inventory (sub-tab of Tablets)
│   │   ├── timeline/             # Timeline of releases by year
│   │   ├── reference/            # Reference (tablet sizes, ISO paper sizes)
│   │   └── data-quality/         # Data quality dashboard
│   └── lib/
│       ├── components/           # Reusable Svelte components
│       │   ├── EntityExplorer.svelte       # Generic entity list page
│       │   ├── DetailView.svelte           # Generic detail page
│       │   ├── QueryPipelineBar.svelte     # Thin coordinator for filter/sort/column panels
│       │   ├── FilterBar.svelte            # Filter pills + editor + drag-to-remove
│       │   ├── SortBar.svelte              # Sort pills + direction toggle + drag-to-reorder
│       │   ├── ColumnBar.svelte            # Column pills + drag-to-reorder
│       │   ├── SearchBar.svelte            # Text search + quick-filter dropdowns
│       │   ├── FilterStep.svelte
│       │   ├── SortStep.svelte
│       │   ├── SelectStep.svelte
│       │   ├── TakeStep.svelte
│       │   ├── ResultsTable.svelte
│       │   ├── ValueHistogram.svelte       # Histogram with KDE, ranges, markers
│       │   ├── TabletSizeComparison.svelte # Histogram + ISO note for tablet detail
│       │   ├── ForceProportionsView.svelte # Force-Proportions loss diagram (16:9, 16:10)
│       │   ├── PressureChart.svelte         # Chart.js scatter for force vs. pressure
│       │   ├── SessionDetail.svelte         # Per-session detail rendered at /entity/<id>
│       │   ├── SavedViews.svelte
│       │   ├── SubNav.svelte                # Sub-tab row under main nav
│       │   └── Nav.svelte
│       ├── load-all-data.ts      # loadAllData() — fetches all 9 datasets in parallel
│       ├── storage.ts            # localStorage helpers (getItem/setItem with JSON)
│       ├── unit-store.ts         # Svelte store for unit preference
│       └── views.ts              # Saved views (localStorage)
├── static/                       # Junctions -> data-repo/data/*
├── svelte.config.js
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## How it consumes DrawTabData

The DrawTabData repo is included as a git submodule at `data-repo/`.

**Import alias**: `$data` resolves to `data-repo/`, configured in both
`svelte.config.js` (kit.alias) and `vite.config.ts` (resolve.alias).

All data types, loaders, pipeline engine, field definitions, and unit
conversion are imported via `$data/lib/...`.

**Static data serving**: Windows directory junctions in `static/` point
to `data-repo/data/` subdirectories so SvelteKit serves the JSON files.
These junctions are gitignored.

## Key components

**EntityExplorer** — Generic page component that wires together the
pipeline builder, saved views, add-step buttons, and results table.
Every entity list page delegates to this component. Pages can pass
`defaultFilterField` to seed the field used when the user clicks "+"
to add a new filter row.

**DetailView** — Generic detail page showing all fields grouped by
category, with URL detection, unit conversion, and computed field badges.

**QueryPipelineBar** — Thin coordinator that renders FilterBar, SortBar,
ColumnBar, and the Views dropdown in a single toolbar row. Owns only
`openPanel` state; each sub-panel is self-contained.

**FilterBar** — Filter pills, inline editor row, field picker, operator
picker, context menu, and drag-to-remove. Supports operators: `contains`,
`notcontains`, `startswith`, `notstartswith`, `eq`, `neq`, `lt`, `lte`,
`gt`, `gte`, `isempty`, `isnotempty`.

**SortBar** — Sort pills with ascending/descending toggle, drag-to-reorder,
and context menu.

**ColumnBar** — Column pills with drag-to-reorder and context menu.

**TabletSizeComparison** — Wraps `ValueHistogram` with pre-computed size
ranges and the closestISO logic. Used on the tablet detail page so the
detail component itself stays lean.

**ForceProportionsView** — Visualises the active-area loss when "Force
Proportions" is applied against 16:9 and 16:10 monitor aspect ratios.
Renders three SVG panels per ratio: tablet at its actual proportions →
target ratio shape → result with USED region inscribed and LOST strip
drawn (bottom-aligned for horizontal bands, right-aligned for vertical
bands). Surfaced as the "Force Proportions" tab on `TabletDetail` for
`PENTABLET` only — pen displays and standalones already match their
own screen ratio.

**SavedViews** — Dropdown with built-in Default view and user-created
views. Scoped by entity type in localStorage.

**ValueHistogram** — SVG histogram with KDE curve overlay, range
backgrounds, and optional markers. Supports `currentValue` (red solid
line for a specific tablet), `markers` (red dashed lines, e.g. ISO
paper sizes), and an optional `compareYears` dropdown to filter the
dataset by release year. Used on the tablet detail page, the Reference
page's Tablet Sizes tab, and the ISO Paper Sizes tab.

**Nav** — Top-level navigation bar. Related routes are collapsed
under a single parent link via the `LinkSpec.altActive` array, which
lists additional pathnames that should also mark the link as active:

- **Tablets** (`/tablets`) — also active on `/tablet-families`,
  `/tablet-analysis`, `/tablet-inventory`, `/tablet-compare` (the bare
  `/` redirects to `/tablets`)
- **Pens** (`/pens`) — also active on `/pen-families`, `/pen-inventory`,
  `/pressure-response`
- **Data** (`/reference`) — also active on `/data-quality`, `/pen-compat`

The settings dropdown (gear icon) holds the metric/imperial toggle,
the alt-units toggle, and the theme toggle.

**SubNav** — Generic sub-tab row rendered beneath `Nav` on every page
that shares a top-level entry. Takes a `tabs: { href, label, badge? }[]`
prop and highlights the entry whose href matches the current pathname.
Optional `badge` shows a small count chip next to the label (used for
the flagged-tablets count on the Tablets ▸ Compare sub-tab).

The sub-tab sets per parent:

- **Tablets** (5 tabs): _Tablet models_ / _Tablet families_ / _Analysis_ / _Inventory_ / _Compare_
- **Pens** (4 tabs): _Pen models_ / _Pen families_ / _Inventory_ / _Pressure Response_
- **Data** (3 tabs): _Reference_ / _Data Quality_ / _Pen Compat_

## Compare feature

Users can flag tablets for side-by-side comparison. The feature spans
several files:

- **`src/lib/flagged-store.ts`** — Svelte writable store backed by
  localStorage (`drawtabdata-flagged-tablets`). Stores an array of
  EntityId strings, max 6. Exports `flaggedTablets`, `toggleFlag()`,
  `clearFlags()`, and `flaggedCount` (derived).

- **Flag from list page** — `ResultsTable` accepts optional `flaggedIds`
  (Set) and `onToggleFlag` callback props. When provided, renders a
  flag icon column. The tablets list page (`+page.svelte`) passes these
  through `EntityExplorer`.

- **Flag from detail page** — Tablet detail page shows a Flag/Unflag
  button in the title row.

- **Compare page** (`/tablet-compare`) — Two tabs:
  - _Flagged_ — list of flagged tablets with unflag buttons and clear all.
  - _Compare_ — side-by-side spec table with specs as rows and tablets
    as columns. Rows are grouped by field group (Model, Digitizer,
    Display, Physical). Cells with differing values are highlighted.
    Includes Copy as HTML and Export as HTML buttons. Below the table,
    size histograms show the flagged tablets as markers against the
    full distribution.

## Shared modules

- **`src/lib/load-all-data.ts`** — `loadAllData(base)` fetches all 9
  datasets in parallel (tablets, pens, penCompat, drivers, brands,
  penFamilies, tabletFamilies, isoSizes, pressureResponse) and returns a
  typed `AllData` object. Use this in pages that need multiple datasets.

- **`src/lib/storage.ts`** — `getItem<T>(key)` / `setItem(key, value)`
  helpers wrapping `localStorage` with JSON parse/stringify and
  try/catch. All localStorage access should go through this module.

- **`src/lib/tablet-size-ranges.ts`** — Size range constants for pen
  tablets and pen displays (cm and inches), plus `MM_TO_IN` and
  `MM_TO_CM` conversion constants. Single source of truth imported by
  the tablet detail, reference, and compare pages.

- **`src/lib/field-display.ts`** — `stripUnit()` and `valueSuffix()`
  helpers for formatting field labels and values with units. Used by
  the tablet detail and compare pages.

- **`src/lib/pen-helpers.ts`** — `buildPenNameMap()` and
  `formatPenIds()` for resolving pen IDs to display names. Used by
  the tablet detail and compare pages.

## Svelte 5 notes

- Step components use `$bindable()` props for parent binding
- Cannot use `structuredClone()` on Svelte 5 proxies — use
  `JSON.parse(JSON.stringify(...))` for deep copying
- Unit preference uses a Svelte writable store subscribed via `$`
- Detail routes (`[entityId]`) must use `+page.ts` `load()` to supply data;
  never use `onMount` for route data on detail pages (see CLAUDE.md)

## Type aliases

`AnyFieldDef` (`= FieldDef<any>`) is defined in `data-repo/lib/pipeline/types.ts`
and re-exported for use in UI components that handle fields generically.
Import it as:

```ts
import type { AnyFieldDef } from '$data/lib/pipeline/types.js';
```

## Setup

```bash
git clone --recurse-submodules https://github.com/TheSevenPens/DrawTabDataExplorer.git
cd DrawTabDataExplorer
npm install
npm run dev
```

To update the data submodule:

```bash
cd data-repo
git pull origin master
cd ..
git add data-repo
git commit -m "Update data submodule"
```

## Using a local data repo

If you have DrawTabData cloned as a sibling folder (e.g. `../DrawTabData`),
you can point the dev server at it instead of the submodule:

```bash
VITE_DATA_DIR=../DrawTabData npm run dev
```

This enables a **data source toggle** banner at the top of the app:

- **Gray banner** — "Using submodule data" (default). Data is served from
  the `data-repo/` submodule via the static directory junctions.
- **Orange banner** — "Using local data repo". Data is served from your
  local clone. Click the button to switch.

Switching reloads the page so all data is re-fetched from the selected
source. The toggle sets a browser cookie; the Vite dev plugin reads it
on each JSON request to decide which directory to serve from.

Without `VITE_DATA_DIR`, no banner or toggle appears (production
behaviour).

## npm scripts

| Script    | Command        | Purpose            |
| --------- | -------------- | ------------------ |
| `dev`     | `vite dev`     | Start dev server   |
| `build`   | `vite build`   | Build static site  |
| `preview` | `vite preview` | Preview built site |

## Local data quality checks

The data quality page in the app (`/data-quality`) runs checks in the
browser. You can also run a subset of those checks locally without
starting the dev server.

### Tablet structural checks (CLI)

```bash
npx tsx data-repo/lib/run-data-quality.ts
```

This runs the checks defined in `data-repo/lib/data-quality.ts` against
all tablet JSON files: required fields, whitespace, enum validation,
numeric fields, complex field structure, color gamuts, EntityId format,
display-only fields on pen tablets, unknown fields, UUID format, ISO
dates, and duplicate EntityIds.

Exit code 0 means no issues; exit code 1 prints the issues grouped by
type.

### Browser-only checks

The following checks only run in the app (they need the full dataset
loaded and cross-entity relationships resolved):

- **Required fields** for pens, drivers, pen families, tablet families,
  pen-compat, and pressure response
- **Whitespace** on pens, drivers, and pressure response
- **Orphaned compat references** — pen-compat rows referencing TabletIds
  or PenIds that don't exist
- **Orphaned family references** — pens/tablets referencing a family ID
  that doesn't exist in the family entities
- **Compat coverage** — Wacom tablets with no pen-compat entries, pens
  with no tablet-compat entries
- **Field completion** — percentage of records with each optional field
  populated (tablets, displays, pens, drivers, pressure response,
  inventory)

To run these, start the dev server (`npm run dev`) and open the Data
Quality page.

## Dependencies

All dev-only:

- **svelte** (v5), **@sveltejs/kit**, **@sveltejs/vite-plugin-svelte**
- **@sveltejs/adapter-static** — static site adapter
- **typescript**, **vite**, **@types/node**
