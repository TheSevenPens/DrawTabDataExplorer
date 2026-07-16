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

- **Reactive `Set`/`Map` state is driven by reassignment, not in-place
  mutation.** The convention is `hiddenIds = new Set(hiddenIds)` /
  `selectedIds = toggleInSet(selectedIds, id)` — build a new collection and
  assign it, which is what triggers Svelte 5 reactivity. Plain `Set`/`Map` is
  therefore correct in `$state`; do **not** reach for `SvelteSet`/`SvelteMap`.
  (`svelte/prefer-svelte-reactivity` is off for this reason — it flagged every
  `new Set/Map`, all false positives; see the rule comment in
  [`eslint.config.js`](eslint.config.js) and GitHub #151.) The one time
  `SvelteSet`/`SvelteMap` is right is if you deliberately mutate reactive state
  **in place** (`.add()` / `.delete()`) and need the template to re-render — a
  deliberate exception, not the default.

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

## Design tokens — never hard-code a colour

The UI is Metro (Zune-era): content over chrome, hierarchy from type scale
and opacity rather than cards and borders, one accent, square edges. Every
colour, type size, tracking value and radius comes from CSS custom
properties defined **once** in [`src/routes/+layout.svelte`](src/routes/+layout.svelte).

**Rule: no literal hex in a component.** Use a token. This is not style
policing — six separate dark-mode bugs came from components restating
colours locally and overriding the globals. `SortableTable` hard-coded a
`#fff` ground and `#333` header, so every table on `/data-quality`
rendered white-on-white and the rows were invisible in dark mode. Same
root cause in `TabletFamilyDetail`, `SectionedPage`, `CompletionSection`,
`data-dictionary`, and `api-explorer`/`query-builder`. If you find
yourself writing a hex, you are probably re-creating one of those bugs.

| Token group       | Tokens                                                                     |
| ----------------- | -------------------------------------------------------------------------- |
| Emphasis          | `--accent`, `--accent-hover`, `--accent-contrast`, `--accent-wash`         |
| Status            | `--good`, `--warning`, `--danger`, `--danger-wash`                         |
| Type scale        | `--type-display/title/heading/subhead/body/caption/micro`                  |
| Tracking / weight | `--track-display`, `--track-tight`, `--track-wide`, `--weight-display`     |
| Shape             | `--radius` (0 — Metro is square)                                           |
| Ink & surfaces    | `--text`, `--text-muted`, `--text-dim`, `--bg`, `--bg-card`, `--border`, … |

Rules that follow from the design, in rough order of how often they bite:

- **Status is not the accent.** "This is emphasis" and "this is wrong" must
  not look alike. Never spend `--accent` on an error, or `--danger` on a
  series. The accent is cyan (not the Zune orange we started with) precisely
  because orange sat ~3° from `--warning` amber and the two collapsed —
  see the token comment in `+layout.svelte` for the measured gaps.
- **The accent is scarce.** It marks _where you are_ / _what you clicked_,
  not every clickable thing. Table rows are `--text` and turn accent on
  hover; only `Button variant="primary"`, `FieldPicker`'s search hit, and
  `FlagButton`'s flagged state spend it as a fill.
- **Don't restate table styles locally.** `:global(table)` /
  `:global(th)` / `:global(td)` in `+layout.svelte` own the look. A local
  `table { background: … }` block is the exact shape of the bug above.
- **No shadows, no radius, no glow.** Panels sit on the backdrop; focus is
  an accent edge, not a halo. Reach for `var(--radius)`, not `0`.
- **Colour that restates adjacent text is redundant.** A type badge that
  prints its own label doesn't also need a per-type hue; a timeline group
  under a "Pens (n)" heading doesn't need a "pen" colour. Metro deletes
  the hue and keeps the word.

### Lowercase is presentational

Nav / SubNav / Tabs render lowercase via CSS `text-transform`, never in the
DOM, so the authored label ("IAF", "JSON") stays intact for assistive tech
and search. Chrome words are lowercase; **content keeps its authored case**
— a detail page title renders "KP-503E" as written, because that's data.

### Pages named by the Nav keep an `.sr-only` h1

The Metro nav word _is_ the page title, so a visible h1 restating it was
pure duplication and is gone from every list route and every page whose
SubNav tab names it (see `dataSubNavTabs()`). The h1 stays in the DOM as
`.sr-only` (utility in `+layout.svelte`) — **don't delete it**: the nav
word is a link, not a heading, so removing it leaves the page with no
heading at all for screen-reader users. Pages the nav does _not_ name (the
session detail, `+error`, the dev-only routes) keep a visible title.

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

## Chart colours are data — validate, don't eyeball

Chart colour is the **one exception** to "use a token": it encodes data, so
it can't collapse into the single accent. Every chart colour does exactly
one job, and mixing them up is the mistake:

| Job                      | Where                                    | What to use                                                            |
| ------------------------ | ---------------------------------------- | ---------------------------------------------------------------------- |
| **Identity** (series)    | pressure-response sessions / pens        | `paletteColor(i, mode)` — [chart-palette.ts](src/lib/chart-palette.ts) |
| **Magnitude** (1 series) | histogram bars, KDE curve                | `var(--accent)`                                                        |
| **Annotation / zones**   | S/A/B/C/D bands, size-category ranges    | neutral chrome (`--text-dim`, `--bg-card`)                             |
| **Reference marks**      | "this tablet", ISO sizes, min/median/max | `var(--text)` — ink, _not_ `--danger`                                  |

**If you change a slot in `CHART_PALETTE`, re-run the validator.** The
palette is derived, not chosen: a beam search over the Metro hues scored on
worst all-pairs CVD ΔE in both modes. The palette it replaced failed —
`#ca8a04` and `#d97706` collapsed to ΔE 1.5 under deuteranopia, i.e. two
sessions ~5% of men could not tell apart.

```bash
# from the dataviz skill's directory; --pairs all because the chart is a scatter
node scripts/validate_palette.js "<light hexes>" --mode light --surface "#ffffff" --pairs all
node scripts/validate_palette.js "<dark hexes>"  --mode dark  --surface "#0a0a0a" --pairs all
```

Three constraints that are load-bearing — read the header comment in
[chart-palette.ts](src/lib/chart-palette.ts) before touching it:

- **Light and dark are separate arrays, not a flip.** One set can't sit in
  both OKLCH lightness bands (0.43–0.77 vs 0.48–0.67). Same hue families,
  different steps, so a series is "the magenta one" in either theme. The
  mode is threaded from `$theme` so a switch repaints live.
- **Slots are never cycled.** Past slot 8, series fold into one neutral
  "other" grey. The old `i % 8` handed a 9th series slot 1's hue.
- **A few slots sit just under 3:1 on their surface.** That is only legal
  because every `PressureResponseChart` ships a
  `PressureResponseChartLegendTable` naming each series. **Never render one
  without the other** — the palette stops being accessible.

`src/lib/chart-palette.test.ts` guards the no-cycling rule, the light/dark
split, and slot 1 tracking the accent.

## Chart typography — name a role, never a size

All chart text traces to one file, [`src/lib/chart-type.ts`](src/lib/chart-type.ts):
a role table (`title` / `subtitle` / `axisTitle` / `axisTick` / `zoneTier`
/ `zoneLabel` / `seriesLabel` / `annotation`), each carrying size + weight

- tracking + a Metro caps flag. **A chart names a role, not a number.**

Why a whole module instead of `var(--type-*)`: chart text renders on four
surfaces with different mechanisms.

- **HTML companions** (legend tables, ChartFrame, SessionStats) — plain
  `var(--type-*)`, nothing special.
- **In-document SVG `<text>`** — `style={svgTextStyle('axisTick')}`. Literal
  px, not a token, because…
- **Standalone SVG / PNG export** — a serialised chart has no `:root`, so
  `var()` wouldn't resolve and a scoped `<style>` block isn't serialised at
  all. `svgTextStyle` bakes literal px + an explicit family inline (survives
  serialisation), and the export flatten in `ChartExportButton` bakes each
  node's _computed_ font + colour onto the clone — so the exported file is
  self-contained and matches the screen, current theme included.
- **Chart.js canvas** — no CSS; `Chart.defaults.font` is pointed at
  `CHART_FONT_FAMILY` + the scale in `PressureResponseChart.svelte`.

Rules:

- Sizes mirror the `--type-*` scale; `chart-type.test.ts` asserts they can't
  drift and that the family leads with the face `app.html` ships (a stale
  `'Google Sans'` is the exact bug it catches).
- **Never `font-family="inherit"` on SVG text** — it renders serif once
  exported (no ancestor). Use `svgTextStyle` (bakes the stack) or, for
  export, the flatten handles it.
- `chart-typography.guard.test.ts` fails the build on a raw
  `font-size=`/`font-weight=` SVG attribute or a `'Google Sans'` in a chart.
- The export flatten (`flattenComputedStyles`) is load-bearing for both
  colour and type fidelity — don't remove it thinking `var()` fallbacks or
  CSS classes will carry over to a standalone file. They won't.

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
