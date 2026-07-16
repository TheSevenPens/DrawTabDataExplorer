# Architecture

**Audience:** contributors and agents · **Rules and gotchas:** [CLAUDE.md](../CLAUDE.md) · **Agent routing:** [AGENTS.md](../AGENTS.md) · **Where to edit:** [WHERE.md](WHERE.md).

> File tree below is illustrative; run `git ls-files src` for the current set.

## Project structure

```
DrawTabDataExplorer/
├── data-repo/                    # Git submodule -> DrawTabData
│   ├── data/                     # JSON datasets
│   └── lib/                      # Loaders, pipeline, entities, units
├── src/
│   ├── app.html                  # HTML shell
│   ├── routes/                   # SvelteKit pages
│   │   ├── +layout.ts            # Builds the session DrawTabDataSet (ds) + loads version
│   │   ├── +layout.svelte        # Design tokens + schema-version banner + ModalRoot
│   │   ├── +page.ts              # Redirects / -> /tablets
│   │   ├── about/                # About page (related tools + dataset version)
│   │   ├── entity/[entityId]/    # CANONICAL detail route (prerender = false)
│   │   ├── brands/               # Brands list + detail redirect
│   │   ├── tablets/              # Tablets list + detail redirect
│   │   ├── pens/                 # Pens list + detail redirect
│   │   ├── pen-families/         # Pen families list + detail redirect
│   │   ├── tablet-families/      # Tablet families list + detail redirect
│   │   ├── drivers/              # Drivers list + detail redirect
│   │   ├── pen-compat/           # Pen compatibility list (Data sub-tab)
│   │   ├── pressure-response/    # Sessions list (Pens sub-tab);
│   │   │                         # detail at /entity/<brand>.session.<id>
│   │   ├── pen-inventory/        # Personal pen inventory (Pens sub-tab)
│   │   ├── tablet-inventory/     # Personal tablet inventory (Tablets sub-tab)
│   │   ├── tablet-analysis/      # Tablet distributions (Tablets sub-tab)
│   │   ├── pen-analysis/         # Pen / pressure distributions (Pens sub-tab)
│   │   ├── tablet-compare/       # Flagged-tablet compare (Tablets sub-tab)
│   │   ├── pen-compare/          # Flagged-pen compare (Pens sub-tab)
│   │   ├── pen-flagged/          # Flagged-pen pressure overlay (Pens sub-tab)
│   │   ├── timeline/             # Timeline of releases by year
│   │   ├── reference/            # Reference (tablet sizes, ISO paper sizes)
│   │   ├── data-dictionary/      # Field dictionary (Data sub-tab)
│   │   ├── api-explorer/         # queriton query playground (Data sub-tab)
│   │   ├── data-quality/         # Data quality dashboard (Data sub-tab)
│   │   ├── wacom-driver-compat/  # Wacom product<->driver-range table (Data sub-tab)
│   │   ├── pressure-backfill/    # Dev-only: add 0%/100% endpoint records (not in Nav)
│   │   └── marker-debug/         # Dev-only: ValueHistogram marker test harness (not in Nav)
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
│       │   ├── PressureBandsChart.svelte           # Range-bands chart with markers + shadedRange
│       │   ├── PressureResponseChart.svelte         # Chart.js scatter for force vs. pressure
│       │   ├── SessionDetail.svelte         # Per-session detail rendered at /entity/<id>
│       │   ├── SavedViews.svelte
│       │   ├── SubNav.svelte                # Sub-tab row under main nav
│       │   └── Nav.svelte
│       ├── bands.ts              # Reference bands (Piaf, Pmax)
│       ├── storage.ts            # localStorage helpers (getItem/setItem with JSON)
│       ├── unit-store.ts         # Svelte store for unit preference
│       ├── pen-helpers.ts        # buildPenNameMap(), formatPenIds()
│       ├── tablet-helpers.ts     # tabletFullName(), tabletNameAndId()
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

## Design system (Metro)

The UI is Metro / Zune-era: content over chrome, hierarchy from type scale
and opacity rather than cards and borders, one accent, square edges, no
shadows.

**Everything visual is a token**, defined once in
[src/routes/+layout.svelte](../src/routes/+layout.svelte) and switched by the
`data-theme` attribute: `--accent` (+ `-hover` / `-contrast` / `-wash`),
`--good` / `--warning` / `--danger` (+ `--danger-wash`), the `--type-*`
scale, `--track-*`, `--weight-display`, `--radius`, and the ink/surface
tokens. Both light and dark are Metro; the toggle is unchanged.

That file is the whole leverage point — two `--accent` declarations
re-accent the app. The corollary is the rule in
[CLAUDE.md](../CLAUDE.md) § Design tokens: **a literal hex in a component
opts out of theming**, which is exactly how six components ended up
rendering wrong in dark mode (`SortableTable` painted `/data-quality`'s
tables white-on-white).

Typeface is **Open Sans** — same designer as Segoe UI (Steve Matteson) and
the same humanist skeleton, but a variable font with the 300 weight Metro's
display type needs and better hinting at the 12–13px the tables live at.
Segoe UI stays next in the stack.

Chart colour is the one exception to the token rule: it encodes data. See
[CLAUDE.md](../CLAUDE.md) § Chart colours and
[src/lib/chart-palette.ts](../src/lib/chart-palette.ts).

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

**PressureBandsChart** — Pure-SVG horizontal range-bands chart used on the
Reference page (Piaf Ranking, Pmax Ranking) and the Pmax
tabs on pen / pen-family detail pages. Optional props:

- `markers: BandMarker[]` — red vertical lines at given x values; each
  marker can be `dashed`, customise its `strokeWidth`, and carry a
  `label` rendered above the line.
- `shadedRange: { min, max }` — semi-transparent red rectangle drawn
  behind markers (used to highlight the min↔max Pmax span).
- `heading: string` — visible title rendered _inside_ the SVG (so it's
  captured by PNG/SVG exports). Distinct from `title`, which only sets
  the export filename slug.

The root SVG carries an explicit `font-family` attribute matching the
page body so standalone-rendered exports use the sans-serif stack
instead of the browser's default serif fallback.

**Nav** — Top-level navigation as a Zune word list: display-size
lowercase words, no tab chrome, the active section simply the bright
word among dim ones. On routes without a SubNav the nav word _is_ the
page title, which is why `EntityExplorer`'s h1 is `.sr-only`. Related
routes are collapsed under a single parent link via the
`LinkSpec.altActive` array, which lists additional pathnames that
should also mark the link as active:

- **Tablets** (`/tablets`) — also active on `/tablet-families`,
  `/tablet-analysis`, `/tablet-inventory`, `/tablet-compare` (the bare
  `/` redirects to `/tablets`)
- **Pens** (`/pens`) — also active on `/pen-families`, `/pen-analysis`,
  `/pen-inventory`, `/pen-flagged`, `/pen-compare`, `/pressure-response`
- **Data** (`/reference`) — also active on `/data-dictionary`,
  `/api-explorer`, `/data-quality`, `/pen-compat`, `/wacom-driver-compat`

The settings dropdown (gear icon) holds the metric/imperial toggle,
the alt-units toggle, and the theme toggle.

**SubNav** — Generic sub-tab row rendered beneath `Nav` on every page
that shares a top-level entry. Takes a `tabs: { href, label, badge? }[]`
prop and highlights the entry whose href matches the current pathname.
Optional `badge` shows a small count chip next to the label (used for
the flagged-tablets count on the Tablets ▸ Compare sub-tab).

The sub-tab sets per parent:

- **Tablets** (5 tabs): _Tablet models_ / _Tablet families_ / _Analysis_ / _Inventory_ / _Compare_
- **Pens** (7 tabs): _Pen models_ / _Pen families_ / _Analysis_ / _Inventory_ / _Flagged_ / _Compare_ / _Pressure Response_
- **Data** (6 tabs): _Reference_ / _Data Dictionary_ / _API Explorer_ / _Data Quality_ / _Pen Compat_ / _Driver Compat_

Tablets / Pens sub-tabs are centralised in
[`src/lib/nav/subnav-tabs.ts`](../src/lib/nav/subnav-tabs.ts); the Data
sub-tabs are declared inline on each Data page.

## Pressure response charts

`PressureResponseChart.svelte` — Chart.js scatter for force (gf) vs pressure (%).
Used on the Pressure Response tabs and the `/pen-compare` combined Pmax
comparison (`lockedZoom="pmax"`).

**Must-read before editing:** [CLAUDE.md](../CLAUDE.md) § Pressure response charts
(envelope `fill: 'shape'` polygon, dynamic Pmax x-axis, `lockedZoom`).

## IAF & MAX tabs (`PressureRangeTab`)

The pen, pen-family, inventory-unit, and pen-compare views all embed one
shared [`PressureRangeTab.svelte`](../src/lib/components/PressureRangeTab.svelte),
parameterised by a `metric` prop (`"IAF"` | `"MAX"`). It replaces the
former separate `PiafTab` / `PmaxTab`. A toggle at the top switches three
view modes (Summary is the default):

1. _Summary_ — `<PressureBandsChart>` with Min / Max markers, a bold labelled
   Median, and a `shadedRange` across min↔max, plus a Min/Median/Max table.
2. _By unit_ — one marker / table row per pen unit (the median of that
   unit's datapoints); solid marker = measured, dashed = estimated.
3. _By sample_ — every resolved datapoint individually (date, tablet,
   driver), no aggregation.

Values come from `resolveRangeByUnit(metric, sessions, measurements)`
([`data-repo/lib/pressure/range-resolve.ts`](../data-repo/lib/pressure/range-resolve.ts))
— **measured wins per unit**: a unit with any direct `PressureRange`
measurement resolves from those, otherwise from the per-session
bracket-midpoint estimate. Defective sessions are excluded via
`defectsByInventoryId`. Bands (`PIAF_BANDS` / `PMAX_BANDS`) and axis are
chosen from the metric.

On `/pen-compare`, the IAF tab additionally renders one combined
`PressureRangeTab` over the union of every flagged pen (a Pen column
distinguishes models) above the per-pen sections; the MAX tab keeps its
multi-colour combined overlay comparison.

## Label formatting (model id suppression)

Canonical formatters: `penFullName`, `tabletFullName`, etc. in
`data-repo/lib/entities/{pen,tablet}-fields.ts`, re-exported from
`$lib/pen-helpers` and `$lib/tablet-helpers`.

**Rules (required):** [CLAUDE.md](../CLAUDE.md) § Label formatting ·
**Reject list:** [ANTI-PATTERNS.md](ANTI-PATTERNS.md).

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

- **`src/lib/bands.ts`** — Reference band definitions (IAF / MAX ranking,
  each band carrying an optional `name` rating like "EXCELLENT", plus pen
  dimension bands) shared by the Reference page, `PressureRangeTab`, and
  the pen-analysis distribution sections. (Pages that need multiple datasets read
  them from the session `DrawTabDataSet` exposed as `ds` via
  `await parent()` — see "One DataSet per session" in
  [CLAUDE.md](../CLAUDE.md) — not a load-all helper.)

- **`src/lib/chart-palette.ts`** — the validated categorical chart palette
  (series identity), one array per theme, plus `paletteColor(i, mode)`.
  Derived by search and checked with the dataviz validator, not hand-picked;
  re-run it if you change a slot. Tests in `chart-palette.test.ts`.

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
  `formatPenIds()` for resolving pen IDs to display names. Re-exports
  `penFullName` and `penBrandAndName` from `data-repo/lib/entities/`
  so consumers can import via `$lib`. The canonical implementation
  (with brand- and id-redundancy rules) lives in data-repo.

- **`src/lib/tablet-helpers.ts`** — Thin re-export of `tabletFullName`,
  `tabletBrandAndName`, and `tabletNameAndId` from data-repo. Use
  these instead of reconstructing the format string inline; see
  "Label formatting" above.

## Svelte 5 notes

- Step components use `$bindable()` props for parent binding
- Cannot use `structuredClone()` on Svelte 5 proxies — use
  `JSON.parse(JSON.stringify(...))` for deep copying
- Unit preference uses a Svelte writable store subscribed via `$`
- Detail routes (`[entityId]`) must use `+page.ts` `load()` to supply data;
  never use `onMount` for route data on detail pages (see CLAUDE.md)

## Type aliases

`AnyFieldDef` (`= FieldDef<any>`) is defined in
[packages/queriton/src/types.ts](../packages/queriton/src/types.ts) and
exported from the workspace package `queriton`. Import it as:

```ts
import type { AnyFieldDef } from '@thesevenpens/queriton';
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
git pull origin master   # or: npm run update-data (wraps these two lines)
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

| Script         | Command                                  | Purpose                            |
| -------------- | ---------------------------------------- | ---------------------------------- |
| `dev`          | `vite dev`                               | Start dev server                   |
| `build`        | `vite build`                             | Build static site                  |
| `preview`      | `vite preview`                           | Preview built site                 |
| `check`        | `svelte-check`                           | Type-check                         |
| `lint`         | `eslint . && prettier --check .`         | Lint + format check (CI parity)    |
| `format`       | `prettier --write . && eslint --fix .`   | Auto-format + lint-fix             |
| `test:unit`    | `vitest run`                             | Unit tests (queriton, helpers)     |
| `test:e2e`     | `playwright test`                        | E2E smoke tests (builds first)     |
| `data-quality` | `tsx data-repo/lib/run-data-quality.ts`  | Data validator                     |
| `verify-docs`  | `node scripts/verify-docs.mjs`           | Check FUTURES.txt Open issue state |
| `setup-static` | `node scripts/setup-static.mjs`          | Recreate `static/` symlinks        |
| `update-data`  | `cd data-repo && git pull origin master` | Fast-forward the data submodule    |

See [README.md](../README.md) and [TESTING.md](TESTING.md) for when to run which.

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

Runtime (`dependencies` in `package.json`):

- **valibot** — schema validation (shared with data-repo's CLI checks)
- **pptxgenjs** — PowerPoint export (pinned to its own Vite chunk)

Also bundled into the client build:

- **chart.js** — pressure-response scatter charts (listed under
  `devDependencies`; the static `ssr = false` build inlines it client-side)
- **@thesevenpens/queriton** — query/pipeline engine, resolved via the
  npm `workspaces` field from `packages/queriton/`

Tooling (`devDependencies`): **svelte** (v5), **@sveltejs/kit**,
**@sveltejs/vite-plugin-svelte**, **@sveltejs/adapter-static** (static
site adapter), **typescript**, **vite**, **vitest**,
**@playwright/test**, **eslint**, **prettier**, **@types/node**.
