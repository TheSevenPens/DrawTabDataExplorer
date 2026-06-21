# DrawTabDataExplorer – Claude Code Guide

**Audience:** agents and developers · **Routing:** start with [AGENTS.md](AGENTS.md); reference detail in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Project overview

SvelteKit static site (adapter-static, `ssr = false`, `prerender = true`) that
displays tablet/pen data from the `data-repo` git submodule. Data files are
served via symlinks from `static/` → `data-repo/data/` so Vite picks them up
as static assets. The app is deployed to GitHub Pages.

## Git submodules

Two submodules need to be initialised after a fresh clone:

| Path                 | Repo                                                                    | Contents                                                               |
| -------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `data-repo/`         | [TheSevenPens/DrawTabData](https://github.com/TheSevenPens/DrawTabData) | Tablet/pen/driver JSON + the shared TS library                         |
| `packages/queriton/` | [TheSevenPens/queriton](https://github.com/TheSevenPens/queriton)       | Query/pipeline engine consumed via `import "queriton"` (npm workspace) |

Run `git submodule update --init --recursive` after cloning. Both submodules
are pinned to a specific commit in this repo; advancing them is a two-commit
flow (commit inside, commit pointer outside) — see "Submodule workflow" below.

## First-time setup — `static/` symlinks

`npm install` runs `scripts/setup-static.mjs` via the `postinstall` hook,
which creates symlinks (Windows: directory junctions) from `static/` →
`data-repo/data/` for every subdirectory the dev server needs. Idempotent —
re-runnable any time as `npm run setup-static`.

If either submodule isn't checked out yet, the setup script warns. Run
`git submodule update --init --recursive` first, then `npm run setup-static`.

Symptom of missing data-repo links: empty list pages and 404s on every entity
detail URL. The dev server prints `[404] GET /tablets/WACOM-tablets.json` and
similar in its terminal output.

Symptom of missing queriton submodule: module-not-found errors on any
`import "queriton"` — every UI component and load function fails.

## Key aliases

| Alias   | Resolves to                                           |
| ------- | ----------------------------------------------------- |
| `$data` | `data-repo/` (the submodule root, where TS lib lives) |
| `$lib`  | `src/lib/`                                            |

## Data loading patterns

**Every page that reads data uses a `+page.ts` load function.** No
`onMount(async ...)` data loading anywhere in the routes. The component
reads its data from `$props()`:

```ts
// +page.ts
export async function load({ parent }) {
	const { ds } = await parent();
	const tablets = await ds.Tablets.toArray();
	return { tablets };
}

// +page.svelte
let { data } = $props();
<EntityExplorer data={data.tablets} ... />
```

### Why a load function instead of onMount

With `ssr = false`, `$state` assignments after `await` inside `onMount`
are unreliable in Svelte 5 — the template may not re-render when the
state changes. `load` functions sidestep this entirely because data is
available before the component mounts.

### One DataSet per session

`src/routes/+layout.ts` constructs **one** `DrawTabDataSet` at session
start and exposes it as `data.ds`. Every child `+page.ts` reads it via
`await parent()`:

```ts
export async function load({ parent }) {
	const { ds } = await parent();
	// ds.Tablets, ds.Pens, ds.getVersion(), etc.
}
```

This means the per-collection load cache (inherited from queriton's
`DataSet`) is session-scoped: navigating from `/tablets` to
`/tablet-compare` reuses the already-fetched tablet data. The layout
also loads `version.json` eagerly so the schema-mismatch banner is
visible on every page.

### Where post-load analysis goes

Pages that do post-load shaping (building lookup maps, computing
completeness stats, joining cross-entity tables) put that logic either
in `+page.ts` (preferred when the result is a fixed structure the
template consumes) or in a top-level `$derived` / `$derived.by` block
in `+page.svelte` (when the result depends on user-editable state in
addition to the loaded data). Avoid `$effect` for pure derivations.

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

Both submodules use the same two-commit flow: commit inside the submodule,
then commit in the outer repo to advance the pointer.

**data-repo** (JSON + TS library):

```bash
cd data-repo && git add . && git commit -m "..." && git push
cd .. && git add data-repo && git commit -m "chore: update data-repo submodule (...)"
```

**packages/queriton** (query engine, also published to npm):

```bash
cd packages/queriton && git add . && git commit -m "..." && git push
cd ../.. && git add packages/queriton && git commit -m "chore: bump queriton submodule (...)"
```

If a queriton change is needed for an explorer feature, push queriton first,
then make the explorer commit that bumps the pointer and uses the new API in
the same PR — the pointer bump and the consumer change should land together.

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

### Shared primitives & frames (use these, don't re-roll)

The UX-architecture pass (GitHub #228) added a small reusable layer. Reach
for these instead of one-off markup — the full catalog with props is in
[docs/UXCOMPONENTS.md](docs/UXCOMPONENTS.md) § 0.

- **`Button`** / **`SegmentedControl`** — command buttons
  (variants primary/secondary/subtle/danger/icon/menu-trigger; pass
  `disabledReason` for a disabled-state tooltip) and view toggles. Don't
  add bespoke `.copy-btn`/`.add-btn`/`.view-toggle` styles.
- **`EmptyState` / `StatusMessage` / `LoadingState`** — no-data, good/warn/
  error, and loading text. Don't hand-roll `.no-data`/`.empty`/`.good`.
- **`EntityLink`** — markup links to `/entity/[entityId]`. The label still
  comes from the canonical formatters (see § Label formatting); EntityLink
  only wraps the `<a>`. Data-shaped links (ResultsTable `cellLinks`) build
  hrefs in route code.
- **`PopoverMenu`** — one anchored menu (FilterBar/SortBar/ColumnBar pill
  context menus).
- **`FlagButton`** — every flag affordance (table cells use `compact`).
- **Frames own chrome only, body stays a snippet:** `TableFrame`
  (title/count/actions/empty), `ChartFrame` (title/controls/actions/footer),
  `ChromeLayout` (Nav + optional SubNav + content, for the Data pages and
  analysis routes), `DetailPageFrame` (Nav + title + actions, detail pages),
  `SectionHeader` (shared section heading). `EntityExplorer`,
  `PressureResponseChart`, and the compare matrices stay specialized inside them.
- **`createExportDialogHost()`** ([src/lib/export-dialog-host.svelte.ts](src/lib/export-dialog-host.svelte.ts))
  — one ExportDialog state per Data route; don't re-declare `exportDialog` +
  `openExport`.

When pulling repeated markup into one of these, delete the now-dead CSS and
run `npm run check` (it flags unused selectors) — and remember the "extracted
helpers ship with tests" rule for any pure logic you split out.

### EntityListLayout

Thin shell that wraps `<Nav>` + optional `<SubNav>` + `<EntityExplorer>`,
used by the simple list routes (brands, drivers, tablet-families,
pen-families). Pass `subNavTabs` from one of the
[`src/lib/nav/subnav-tabs.ts`](src/lib/nav/subnav-tabs.ts) helpers
(`tabletSubNavTabs(...)` or `penSubNavTabs(...)`); omit it for the
brands route which has no sub-nav. Remaining props pass through to
EntityExplorer. Routes with extra page-only logic (e.g. tablets and
pens, which build `cellLinks` from a penNameMap and have flag columns)
still wire `Nav` + `SubNav` + `EntityExplorer` directly.

### Entity-typed redirect routes

The typed routes (`/tablets/[entityId]`, `/pens/[entityId]`, …) all
defer to the same one-liner helper in
[`src/lib/entity-redirect.ts`](src/lib/entity-redirect.ts). When adding
a new typed entity, copy one of the existing `+page.ts` files (it's
just `prerender = false` plus `redirectToCanonicalEntity(params)`).

### EntityExplorer / QueryPipelineBar / SearchBar

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) § Key components for **EntityExplorer**, **QueryPipelineBar**, **FilterBar**, **SortBar**, **ColumnBar**, and **SearchBar** (layout, operators, dropdown behavior).

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

`PressureResponseChart.svelte` (Chart.js) has two non-obvious behaviors that
will surprise contributors:

- **Envelope fill** is rendered as a single closed-polygon dataset
  (`[...low, ...high.reverse()]`) with `fill: 'shape'`, _not_ as two
  separate low/high lines with `fill: '-1'`. The between-datasets fill
  in Chart.js is x-axis-parametric, so it terminates at the smaller
  line's max x and leaves a triangular gap at the upper-right (around
  p=99→100, where `min(Pmax) ≪ max(Pmax)`). Don't "simplify" this back
  to two datasets without re-introducing the bug.
- **Pmax zoom** computes `x.max` dynamically as
  `max(estimatePmax across visible sessions) + 50` so the upper-right
  corner of the envelope always stays on-canvas. This depends on
  `visibleSessions` (which honours `hiddenIds` and the defective
  filter), so the `$effect` block explicitly reads `maxPmax` to track
  it.

The `lockedZoom` prop on `PressureResponseChart` hides the Zoom dropdown and
forces a preset — used by the `/pen-compare` combined Pmax comparison to
embed a max-zoomed overlay chart.

## IAF / MAX tabs

The pen, pen-family, inventory-unit, and pen-compare detail views share
one `PressureRangeTab.svelte` (prop `metric: "IAF" | "MAX"`) — it
replaced the old `PiafTab` / `PmaxTab`. Three modes (Summary default / By
unit / By sample) all derive from
`resolveRangeByUnit(metric, sessions, measurements)` in
`data-repo/lib/pressure/range-resolve.ts` (was `iaf-resolve.ts`), which
applies **measured-wins-per-unit**: a pen unit with any direct
`PressureRange` measurement uses those, else the per-session estimate.
The `/pen-compare` IAF tab also shows one combined `PressureRangeTab`
over all flagged pens at the top.

## Extracted helpers ship with tests

When you pull pure logic out of a component into a `.ts` helper (e.g.
`src/lib/pill-dnd.ts`, `src/lib/entity-explorer/view-state.ts`,
`src/lib/data-quality/analysis.ts`), add a focused Vitest `*.test.ts`
beside it in the same change. The point of extracting is testability — a
helper without coverage misses the benefit and makes the next refactor
riskier. (The `data-repo` submodule follows the same rule for its `lib/`
helpers; see GitHub #225.)

## Type aliases

`AnyFieldDef` is a convenience alias for `FieldDef<any>` used throughout UI
components that operate on fields generically (FilterBar, SortBar, ColumnBar,
FilterStep, SortStep, SelectStep, ResultsTable, etc.).

Import from the workspace package `@thesevenpens/queriton` (see [packages/queriton/](packages/queriton/)):

```ts
import type { AnyFieldDef } from '@thesevenpens/queriton';
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
