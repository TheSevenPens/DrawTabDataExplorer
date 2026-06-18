# UX components

**Audience:** contributors and agents touching the UI.
**Source of truth:** [src/lib/components/](../src/lib/components/) (58 components). Each entry below points back to the file.

Components are grouped by role. Each entry has a one-line purpose, key props, and pointers to where it's used. Screenshots will be added later — [scripts/capture-component-screenshots.mjs](../scripts/capture-component-screenshots.mjs) is wired up to drive Playwright against the running dev server and drop PNGs into `docs/images/components/` when we want to regenerate them.

---

## 0. Shared primitives & frames

The reusable building blocks from the UX-architecture pass (GitHub #228). Prefer these over one-off markup: feature components compose them rather than re-implementing buttons, empty states, links, menus, or chrome. **Frames own chrome only** (title / count / actions / empty / controls); the body stays a snippet so specialized components (`EntityExplorer`, `PressureChart`, the compare matrices) stay specialized.

### `Button`

Shared command button. _Props:_ `variant` (`primary` / `secondary` / `subtle` / `danger` / `icon` / `menu-trigger`), `size` (`sm` / `md`), `pressed?` (aria-pressed for toggles), `disabled`, `disabledReason?` (surfaced as the tooltip when disabled). The one bit of logic — `resolveButtonTitle` — lives in [button-helpers.ts](../src/lib/components/button-helpers.ts) with tests.

### `SegmentedControl`

Generic two/three-option view toggle (`bind:value`, generic over the value type). Replaces the hand-rolled `.view-toggle` pattern. _Used by:_ `/api-explorer` (JSON/Table), and available for other mode switches.

### `EmptyState` / `StatusMessage` / `LoadingState`

The status-state primitives. `EmptyState` — muted "no data" message + optional `action` snippet for empty-workflow CTAs. `StatusMessage` — `good` / `warning` / `error` / `info` (error gets `role="alert"`). `LoadingState` — consistent "Loading…". _Used by:_ data-quality, detail tabs, analysis, compare, reference.

### `EntityLink`

Canonical link to `/entity/[entityId]`. Centralizes the `resolve()` call + `var(--link)` styling. The label is a snippet passed from the canonical formatters (`penFullName` / `tabletFullName` / …) — **never reconstruct a display name inline** (see CLAUDE.md § Label formatting). For data-shaped links (`ResultsTable` `cellLinks`) the route still builds hrefs in code.

### `PopoverMenu`

One anchored popover menu (position `{x, y}` + `items` + `onclose`; owns outside-click + Escape dismissal). _Used by:_ the `FilterBar` / `SortBar` / `ColumnBar` pill context menus.

### `TableFrame`

Table chrome: optional title + count badge + subtitle, a right-aligned `actions` area (export/commands sit with the table), and an `EmptyState`-backed empty state. Body is a snippet. _Used by:_ `CompatEntityTable`. _Note:_ actions hide when empty.

### `ChartFrame`

Chart chrome: optional title/subtitle, a left-aligned `controls` slot (view/zoom/compare selectors), a right-aligned `actions` slot (export), and a footer/legend slot. Body (the SVG/canvas) is a snippet. _Used by:_ `BandsChart`, `ValueHistogram`, `TabletDimensionComparison`, `PressureChart`.

---

## 1. Page chrome

These wrap every page. The top-level layout file ([src/routes/+layout.svelte](../src/routes/+layout.svelte)) does not render them directly — each page does, so a page can opt out of either.

### `Nav`

Top navigation bar with primary section links and the settings dropdown (gear icon: units / theme / alt-units toggles). Related routes are collapsed under a single parent via `LinkSpec.altActive`.

_Used by:_ every list and detail page · _Props:_ none (reads `$page.url` for active state).

### `SubNav`

Generic sub-tab row rendered beneath `Nav` on every page that shares a top-level entry. Highlights the entry whose href matches the current pathname.

_Props:_ `tabs: { href, label, badge? }[]`.
_Used by:_ Tablets ▸ {Models, Families, Analysis, Inventory, Compare}, Pens ▸ {Models, Families, Analysis, Inventory, Flagged, Compare, Pressure Response}, Data ▸ {Reference, Data Dictionary, API Explorer, Data Quality, Pen Compat, Driver Compat}.

Sub-tab definitions are centralised in [src/lib/nav/subnav-tabs.ts](../src/lib/nav/subnav-tabs.ts).

### `Tabs`

Detail-page tab strip used inside the various `*Detail` components. Each tab corresponds to a section of the detail page; the active tab is mirrored to the URL hash so `back/forward` navigation works.

_Props:_ `tabs: { id, label, badge?, visible? }[]`, `activeId = $bindable()`.
_Used by:_ `TabletDetail`, `PenDetail`, `PenFamilyDetail`, `TabletFamilyDetail`, `BrandDetail`, `SessionDetail`.

### `EntityListLayout`

Thin shell that wraps `Nav` + optional `SubNav` + `EntityExplorer` for the simple list routes (brands, drivers, tablet-families, pen-families). Pages that need extra page-only logic skip this and wire the pieces directly.

_Props:_ `subNavTabs?`, plus passthroughs to `EntityExplorer`.

### `ChromeLayout`

`Nav` + optional `SubNav` + a content slot, for arbitrary-content (non-list) pages. _Props:_ `subNavTabs?`, `children`. _Used by:_ `/reference`, `/data-quality`, `/api-explorer`, `/tablet-analysis`, `/pen-analysis`.

### `DetailPageFrame`

`Nav` + a detail-page title row with an optional right-aligned `actions` slot (flag / copy / export). The page body stays a sibling after it (not wrapped as children), so each detail page keeps its own structure. _Props:_ `title`, `actions?`. _Used by:_ `PenDetail`, `TabletDetail`, `PenFamilyDetail`, `TabletFamilyDetail`, `BrandDetail`, `DriverDetail`. (`SessionDetail` keeps a bespoke `Nav`+`SubNav` header; the inventory detail headers carry a model link rather than an action.)

### `SectionHeader`

Shared section heading (title + optional count) with either a convenience `onExport` Export button (via `Button`) or an arbitrary `actions` snippet. Promoted out of `data-quality/` in #231. _Used by:_ `/data-quality` and `CompletionSection`. (`/reference` keeps its in-snippet headers but routes their Export buttons through `Button`.)

### `SectionedPage`

Two-column page with a left sidebar tree and a main content area driven by URL hash. Used for the multi-section analysis / reference / data-quality pages where every section is a self-contained sub-component.

_Used by:_ `/reference`, `/data-quality`, `/tablet-analysis`, `/pen-analysis`.

### `ModalRoot`

Application-wide modal portal. Listens on a Svelte store for modal-open requests and renders the active modal as a centered card over a backdrop.

_Used by:_ `confirmModal`, `promptModal`, `alertModal` in [src/lib/modal-store.ts](../src/lib/modal-store.ts) (rendered from the root layout). See `ExportDialog` and the pickers below for examples of components that render through `ModalRoot`.

### `DevErrorBanner`

Bottom-of-page red banner that surfaces unhandled errors during `npm run dev`. Stays out of production builds.

_Used by:_ root layout (dev-only).

---

## 2. Entity-explorer ecosystem

The query-pipeline-driven list page is shared by tablets, pens, drivers, brands, families. One generic component (`EntityExplorer`) composes all the others below.

### `EntityExplorer`

The list-page workhorse. Owns the query pipeline, decoded view state, results count, and the embedded table. Pages pass their fields, default columns, default view, and `cellLinks` (link generators per row); the component wires everything together.

_Props:_ `entityType`, `fields`, `data`, `defaultColumns`, `defaultView`, `defaultFilterField?`, `cellLinks?`, ...

### `QueryPipelineBar`

Thin coordinator that lays out `FilterBar` + `SortBar` + `ColumnBar` + the Views dropdown in a single toolbar row. Owns only `openPanel` state; each sub-panel is self-contained.

### `SearchBar`

Free-text search input. Filters across one or more fields declared via `alwaysSearch` on the parent route.

### `FilterBar`

Filter pills + inline editor + field/operator pickers + drag-to-remove. Supports `contains` / `notcontains` / `startswith` / `notstartswith` / `eq` / `neq` / `lt` / `lte` / `gt` / `gte` / `isempty` / `isnotempty`.

### `SortBar`

Sort pills with asc/desc toggle, drag-to-reorder, and a context menu for "Sort field by..." actions.

### `ColumnBar`

Column pills with drag-to-reorder, hide/show, and the field picker for adding new columns.

### `ResultsTable`

The data table itself: header row from the active columns, body rows from the pipeline output, cell rendering via each field's `FieldDef.display`, optional `cellLinks` for clickable IDs.

### `SavedViews`

Dropdown with the built-in Default view and any views the user has saved (per entity type, in localStorage). Each view is a serialised query pipeline.

_Backing store:_ [src/lib/views.ts](../src/lib/views.ts).

### `FieldPicker`

Field-list popover used by FilterBar / SortBar / ColumnBar to choose a field. Groups fields by `category`, supports search-as-you-type.

### Extracted query-control helpers

The bar-of-pills UI is the only query editor; the old per-step editor components (`FilterStep` / `SortStep` / `SelectStep` / `TakeStep`) were deleted in #217. Pure logic behind the bars lives in helpers with tests: [pill-dnd.ts](../src/lib/pill-dnd.ts) (`computeDropIndex` / `moveItem`, used by SortBar/ColumnBar), [entity-explorer/view-state.ts](../src/lib/entity-explorer/view-state.ts) (`buildActiveSteps` — excludes disabled filters per #227), and [entity-explorer/search.ts](../src/lib/entity-explorer/search.ts) (quick-filter / owned-only / text-search). The three bars share one `PopoverMenu` for their pill context menus.

---

## 3. Entity detail pages

Each top-level entity has a dedicated detail component. They all follow the same shape: header strip (name, key fields, action buttons), `Tabs` for sub-sections, body content per tab.

The shared body is rendered by [`DetailView`](#detailview).

### `TabletDetail`

Detail page for a single tablet model. Tabs: _Model_ / _Specs_ / _Size Comparison_ / _Force Proportions_ / _Compatible Pens_ / _Inventory_ / _Similar Tablets_.

### `PenDetail`

Detail page for a single pen model. Tabs: _Model_ / _Specs_ / _Inventory_ / _Compatible Tablets_ / _Pressure Response_ / _IAF_ / _MAX_ / _Included With_. (The _IAF_ and _MAX_ tabs each embed a `PressureRangeTab` with the matching `metric`; it resolves each pen unit to a direct measurement where available, else the per-session estimate.)

### `PenFamilyDetail`

Detail page for a pen family (e.g. _Wacom Pro Pen Gen 3_). Tabs include the same pressure views (`PressureChart`, plus `PressureRangeTab` for IAF and MAX) aggregated across the family's members.

### `TabletFamilyDetail`

Detail page for a tablet family. Lists member tablets with their key specs.

### `BrandDetail`

Detail page for a brand. Aggregates tablet / pen / driver counts, links to brand-filtered list pages.

### `DriverDetail`

Detail page for a single driver release. Shows OS / version / source / changelog snippet.

### `SessionDetail`

Detail page for a pressure-response session. Header with pen / inventory / date / tablet / driver / OS, the standard `PressureChart`, the Piaf / Pmax estimate table, and the raw record table.

### `InventoryPenDetail`

Detail page for an inventory pen (a specific physical unit). Shows the unit's PenEntityId, defects, and pressure-response sessions captured against it.

### `InventoryTabletDetail`

Detail page for an inventory tablet (a specific physical unit). Shows TabletEntityId, condition notes, and any inventory pens currently paired with it.

### `DetailView`

Generic key-value renderer shared by every `*Detail` page. Walks the entity's `FieldDef[]` registry and renders each field grouped by `category`, with URL detection, unit conversion, and `computed` badges.

---

## 4. Detail-page tab content

These are reusable sub-views referenced by the `Tabs` strip on pen / pen-family / tablet detail pages.

### `PressureRangeTab`

Shared IAF / MAX tab, parameterised by a `metric` prop (`"IAF" | "MAX"`); replaced the former `PiafTab` / `PmaxTab`. A toggle selects three modes — _Summary_ (min/median/max, default), _By unit_ (one row per pen unit), _By sample_ (every datapoint) — all rendered as a `BandsChart` + table. Values come from `resolveRangeByUnit` (measured-wins-per-unit: a direct `PressureRange` measurement beats the per-session estimate); measured markers are solid, estimated dashed. Used by the pen / pen-family / inventory-unit detail tabs and `/pen-compare` (per-pen and one combined-across-flagged-pens instance on the IAF tab).

---

## 5. Charts and visualisations

Pure presentation components. Each has clear inputs and produces an SVG or canvas chart.

### `PressureChart`

Chart.js scatter of physical force (gf) vs logical pressure (%). View modes: _Raw_ / _Raw + estimates_ / _Standardized_ / _Envelope_. Zoom modes: _Normal_ / _Piaf detail (0-20 gf)_ / _Pmax detail (95-100%)_. Optional `lockedZoom` hides the dropdown and forces a preset (used by the `/pen-compare` combined Pmax comparison).

**Must-read before editing:** [CLAUDE.md § Pressure response charts](../CLAUDE.md) (envelope `fill: 'shape'` polygon and dynamic Pmax x-axis are non-obvious).

### `PressureResponseChartLegendTable`

Per-session legend table that sits below a `PressureChart` when multiple sessions are overlaid. Each row shows colour swatch, label, visibility toggle, and Piaf / P25 / P50 / P75 / Pmax values.

### `BandsChart`

Pure-SVG horizontal range-bands chart. One band per record; optional `markers` (red vertical lines, dashed or solid, with labels), `shadedRange` (semi-transparent red rectangle for highlighting a min↔max span), and `heading` (rendered _inside_ the SVG so it survives PNG/SVG export).

_Used by:_ Reference page (IAF Ranking, MAX Ranking), `PressureRangeTab` (IAF / MAX tabs), and the pen-analysis distribution sections.

### `ValueHistogram`

SVG histogram with KDE-curve overlay, range backgrounds, optional `currentValue` (red solid line for a specific tablet), `markers` (red dashed lines, e.g. ISO paper sizes), and an optional `compareYears` dropdown.

_Used by:_ Tablet detail's Size tab, Reference page's Tablet Sizes / ISO Paper Sizes tabs.

### `DistributionTable`

Bar-fill count table — each row shows a category, count, and a horizontal bar whose width is proportional to the count. Used wherever a sortable list of "X has N members" is more useful than a histogram.

_Used by:_ `/tablet-analysis` (aspect ratio, digitizer, audience...), `/pen-analysis` (pen-family distribution).

### `TabletSizeComparison`

Wraps `ValueHistogram` with pre-computed size ranges and the closest-ISO-paper-size logic. Used on the tablet detail page so the detail component itself stays lean.

### `TabletDimensionComparison`

Side-by-side SVG outlines of flagged tablets at their actual proportions, drawn to scale. Used on the Compare tab.

### `ForceProportionsView`

Visualises the active-area loss when "Force Proportions" is applied against 16:9 and 16:10 monitor aspect ratios. Renders three SVG panels per ratio: tablet at its actual proportions → target ratio shape → result with USED region inscribed and LOST strip drawn. Pen-display / standalone tablets are skipped (they already match their own screen ratio).

_Used by:_ TabletDetail's _Force Proportions_ tab (`PENTABLET` type only).

### `CompatEntityTable`

Compatible-entities table used by tablet ↔ pen cross-references. Shared by:

- `PenDetail` ▸ Compatible Tablets, Included With tabs
- `TabletDetail` ▸ Compatible Pens tab

### `SessionStats`

Aggregated min / median / max table for pressure-response sessions. Shows Piaf / P25 / P50 / P75 / Pmax across the selected sessions.

_Used by:_ `/pressure-response`, `SessionDetail`.

---

## 6. Pickers and dialogs

Modal popups triggered by user actions. All render through `ModalRoot`'s backdrop / centering.

### `PenPicker`

Pen-model search modal. Type to filter, click to select. Used by `/pen-compare` to add pens to the comparison.

### `TabletPicker`

Tablet-model search modal. Mirror of `PenPicker`, used by `/tablet-compare`. Capped at 6 flags (matches the inventory comparison limit).

### `PickerModalShell`

Shared modal shell behind `PenPicker` / `TabletPicker` (#215): backdrop click-to-close, Escape, the dialog frame, and the header (title + optional accessory + close button). Each picker supplies its own filters/list as `children` plus an optional `headerAccessory` (slot-count badge) and `footer`. `FieldPicker` is intentionally not migrated (it's an anchored popover, not a centered modal).

### `ExportDialog`

Universal "Export" dialog supporting PNG / CSV / TSV / JSON / HTML / Markdown across the explorer. Has a _rich_ mode (per-result-view scope toggles) and a _simple_ mode (caller passes headers + rows ready to serialise).

_Used by:_ EntityExplorer, ResultsTable, DetailView's per-section copy buttons, multiple analysis pages. The Data routes (`/data-quality`, `/reference`, `/tablet-analysis`, `/pen-analysis`) share one dialog instance via [`createExportDialogHost()`](../src/lib/export-dialog-host.svelte.ts) (#236) instead of each re-declaring the `exportDialog` state + `openExport` setter.

### `JsonTab`

Inline pretty-printed JSON view of the current entity, rendered as a detail-page tab (not a modal). Includes a Copy-to-clipboard button. Used by `PenDetail` and `TabletDetail` — both pages expose a "JSON" entry in their tab strip.

Replaced the older `JsonDialog` modal (deleted alongside this change) — agents looking at detail pages will find the JSON next to Specs / IAF / etc. instead of behind a floating dialog.

---

## 7. Buttons and atoms

Small reusable controls.

### `FlagButton`

The single flag / un-flag toggle (⚐ / ⚑). Two variants: default (bordered, detail-page headers) and `compact` (borderless, dense table cells). Every flag affordance routes through it — `ResultsTable` cells (`compact`), `TabletDetail` / `PenDetail` / `PenFamilyDetail` headers, and the `/pen-flagged` lists — so they look and behave consistently (#235). The flag is stored per entity type via [src/lib/flagged-store.ts](../src/lib/flagged-store.ts). Tablets cap at 6 flags (for the Compare page's SVG outlines); pens are uncapped (the `/pen-flagged` pressure overlay benefits from more).

### `ExportTableButton`

Compact "Export" button that opens `ExportDialog` in simple mode. Used wherever a non-EntityExplorer table needs an export option (`/api-explorer`, analysis pages, detail pages).

### `ChartExportButton`

Chart-specific export trigger. Two modes: PNG-of-the-canvas, or HTML-table-of-the-underlying-data (passed in as a `getDataHtml: () => string` callback).

Filename slugging is centralized in [src/lib/chart-export/filenames.ts](../src/lib/chart-export/filenames.ts) (#224).

_Used by:_ `PressureChart`, `BandsChart`, `ValueHistogram`, `TabletDimensionComparison` (all now mounted through `ChartFrame`'s `actions` slot).

---

## 8. Dev-only routes (not a "component" but pictured for completeness)

### `/pressure-backfill` route

Per-session navigator that lets a contributor add `(force, 0)` / `(force, 100)` endpoint records to pressure sessions that don't capture them. Reuses `PressureChart` twice (Piaf zoom + Pmax zoom). Not linked from `Nav`.

### `/marker-debug` route

Visual test harness for `ValueHistogram` marker / range rendering — a grid of synthetic-data test cases used to eyeball label collisions and range backgrounds. Not linked from `Nav`.

---

## Cross-reference

| If you're changing...                          | Touch                                                                                                |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| The pressure-response math                     | [data-repo/lib/pressure/interpolate.ts](../data-repo/lib/pressure/interpolate.ts) — _then_ the chart |
| The query pipeline behaviour                   | [packages/queriton/](../packages/queriton/) — _then_ `EntityExplorer` / `QueryPipelineBar`           |
| The field registry for an entity               | `data-repo/lib/entities/<entity>-fields.ts`                                                          |
| The exporter formats                           | [src/lib/export/](../src/lib/export/) — _then_ `ExportDialog`                                        |
| The flag store (which entities can be flagged) | [src/lib/flagged-store.ts](../src/lib/flagged-store.ts) — _then_ `FlagButton` / picker UIs           |
| The pressure-chart visual quirks               | **First read [CLAUDE.md § Pressure response charts](../CLAUDE.md)**, then `PressureChart.svelte`     |

See also [ARCHITECTURE.md](ARCHITECTURE.md) for the runtime data-flow picture and [WHERE.md](WHERE.md) for the goal→files lookup.
