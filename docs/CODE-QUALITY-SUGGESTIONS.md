# Code quality suggestions

**Audience:** agents and contributors · Follow-up backlog from a repo/code review focused on reuse, componentization, typing, and maintainability.

## Context

These suggestions came from reviewing the app docs and the current Svelte/SvelteKit codebase. They are intended as candidate GitHub issues or future work items, not must-follow rules. Put mandatory rules in `CLAUDE.md`; put issue numbers only in `docs/FUTURES.txt` after GitHub issues exist.

## Summary table

| Priority    | Effort      | Suggestion                                                               | Primary files                                                                                                                                     |
| ----------- | ----------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| High        | Low         | Centralize Data sub-navigation tabs                                      | `src/lib/nav/subnav-tabs.ts`, `src/routes/reference/+page.svelte`, `src/routes/data-quality/+page.svelte`, `src/routes/api-explorer/+page.svelte` |
| Medium-high | Medium      | Extract shared picker modal behavior                                     | `src/lib/components/PenPicker.svelte`, `src/lib/components/TabletPicker.svelte`                                                                   |
| Medium      | Low-medium  | Add a reusable Data/page chrome layout                                   | `src/lib/components/`, Data routes                                                                                                                |
| Medium      | Low-medium  | Decide fate of unused query step editor components                       | `src/lib/components/FilterStep.svelte`, `SortStep.svelte`, `SelectStep.svelte`, `TakeStep.svelte`                                                 |
| Medium-high | Medium      | Extract shared query-pill drag/drop/context-menu behavior                | `FilterBar.svelte`, `SortBar.svelte`, `ColumnBar.svelte`                                                                                          |
| High        | Medium      | Split `EntityExplorer` state/pipeline logic from presentation            | `src/lib/components/EntityExplorer.svelte`                                                                                                        |
| Medium      | Medium      | Improve typing around canonical entity detail dispatch                   | `src/routes/entity/[entityId]/+page.ts`, `+page.svelte`, detail components                                                                        |
| Medium      | Low-medium  | Narrow broad `any` usage in generic export/table infrastructure          | `EntityExplorer.svelte`, `ResultsTable.svelte`, `ExportDialog.svelte`                                                                             |
| High        | High        | Refactor very large route pages into section components and pure helpers | `src/routes/api-explorer/+page.svelte`, `pen-compare`, `reference`, `data-quality`, `pen-analysis`                                                |
| Medium      | High        | Create a formal analysis-section abstraction                             | `SectionedPage.svelte`, analysis/reference/data-quality routes                                                                                    |
| Medium      | Medium-high | Consolidate chart/export logic across chart components                   | `PressureChart.svelte`, `BandsChart.svelte`, chart export helpers                                                                                 |
| High        | Medium      | Add focused unit tests for extracted pure helpers                        | `src/lib/data-quality/`, `src/lib/tablet-analysis/`, future helper modules                                                                        |
| Medium      | Low-medium  | Audit `/api-explorer` dataset construction                               | `src/routes/api-explorer/+page.svelte`, `src/routes/+layout.ts`                                                                                   |
| Medium      | Low-medium  | Clarify saved-view behavior for disabled filters                         | `src/lib/components/EntityExplorer.svelte`, `src/lib/views.ts`                                                                                    |

## 1. Centralize Data sub-navigation tabs

Tablet and pen sub-navigation is already centralized in `src/lib/nav/subnav-tabs.ts`. Data sub-navigation is still repeated inline across Data routes.

### Recommendation

Add a `dataSubNavTabs()` helper beside `tabletSubNavTabs()` and `penSubNavTabs()`:

```ts
export function dataSubNavTabs(): SubNavTab[] {
	return [
		{ href: '/reference', label: 'Reference' },
		{ href: '/data-dictionary', label: 'Data Dictionary' },
		{ href: '/api-explorer', label: 'API Explorer' },
		{ href: '/data-quality', label: 'Data Quality' },
		{ href: '/pen-compat', label: 'Pen Compat' },
		{ href: '/wacom-driver-compat', label: 'Driver Compat' },
	];
}
```

Then import it from Data routes rather than repeating local `dataTabs` arrays.

### Benefits

- Avoids route/label drift.
- Mirrors the existing tablet/pen helper pattern.
- Makes Data nav changes one-file updates.

## 2. Extract shared picker modal behavior

`PenPicker.svelte` and `TabletPicker.svelte` share a lot of modal and filtering structure: search state, brand filter, focused search input, Escape-to-close, backdrop click-to-close, list rendering, and count display.

### Recommendation

Create one of:

- `PickerModalShell.svelte` for backdrop/header/focus/Escape/layout behavior.
- `EntityPicker.svelte` with snippets/slots for filters and row rendering.
- A small helper module for shared keyboard/backdrop/focus behavior if full component extraction is too heavy.

Keep domain differences explicit: tablets have type filtering and a six-item cap; pens intentionally have no cap.

### Benefits

- Reduces duplicated modal code.
- Centralizes accessibility fixes such as focus trapping and Escape behavior.
- Makes future entity pickers easier to build.

## 3. Add a reusable Data/page chrome layout

Several non-list pages repeat `Nav`, `SubNav`, and local tab arrays. The app already has `EntityListLayout` for simple list routes.

### Recommendation

Add a more general shell, such as `ChromeLayout.svelte` or `DataPageLayout.svelte`:

```svelte
<ChromeLayout subNavTabs={dataSubNavTabs()}>
	<!-- page content -->
</ChromeLayout>
```

### Benefits

- Reduces repeated imports and markup.
- Makes chrome spacing/sticky behavior easier to change consistently.
- Gives Data pages a clear structural convention.

## 4. Decide fate of unused query step editor components

The docs note that `FilterStep`, `SortStep`, `SelectStep`, and `TakeStep` are currently unused and predate the current bar-of-pills UI.

### Recommendation

Choose one path:

1. Delete them if no near-term saved-views/API-editor work is planned.
2. Move them to a `legacy/` or `unused/` folder with a short README.
3. Integrate them into `/api-explorer` or saved views if they are part of the intended product direction.

### Benefits

- Reduces maintenance surface.
- Avoids future agents improving dead UI.
- Keeps the component catalog aligned with actual usage.

## 5. Extract shared query-pill drag/drop/context-menu behavior

`FilterBar`, `SortBar`, and `ColumnBar` all manage pill state, context menus, drag indexes, drag-over state, and removal/reorder behavior.

### Recommendation

Extract either:

- Pure helpers such as `computeDropIndex()` and `moveItem()`.
- A reusable `PillList.svelte` that handles drag state, context-menu coordinates, and keyboard-accessible reorder hooks.

The bars can still keep their differences: filters and sorts support drag-outside-to-remove; columns are removed through the context menu only.

### Benefits

- Fixes to drag behavior apply consistently.
- Makes keyboard accessibility easier to add.
- Keeps each bar focused on filter/sort/column semantics.

## 6. Split `EntityExplorer` state/pipeline logic from presentation

`EntityExplorer.svelte` currently owns view parsing, URL filters, quick filters, owned-only filters, text search, pipeline construction, execution, column-width persistence, export state, and table rendering.

### Recommendation

Extract pure modules such as:

- `src/lib/entity-explorer/view-state.ts`
  - initial columns
  - initial filters
  - initial sorts
  - conversion between UI state and queriton `Step[]`
- `src/lib/entity-explorer/search.ts`
  - quick filters
  - owned-only filtering
  - visible/always-search text search
- `src/lib/entity-explorer/types.ts`
  - shared `FilterItem`, `SortItem`, and cell-link types

### Benefits

- Makes logic unit-testable without rendering Svelte.
- Shrinks a central component.
- Gives future URL/view/search features a cleaner landing zone.

## 7. Improve typing around canonical entity detail dispatch

`src/routes/entity/[entityId]/+page.svelte` dispatches on `data.entityType` but passes `data as any` into every detail component.

### Recommendation

Define a discriminated union for canonical entity route data returned from `+page.ts`, then narrow branches in `+page.svelte` without broad casts.

Example concept:

```ts
type EntityPageData =
	| { entityType: 'tablet'; tablet: Tablet }
	| { entityType: 'pen'; pen: Pen }
	| { entityType: 'brand'; brand: Brand };
```

Adapt the actual union to include the extra relationship data each detail component needs.

### Benefits

- Catches missing route data at compile time.
- Clarifies detail component contracts.
- Makes entity-route refactors safer.

## 8. Narrow broad `any` usage in generic export/table infrastructure

Generic components such as `EntityExplorer`, `ResultsTable`, and `ExportDialog` reasonably need to handle heterogeneous row data, but the current boundary uses broad `any` in several places.

### Recommendation

Introduce named aliases or generic row types where Svelte ergonomics allow:

```ts
type RowRecord = Record<string, unknown>;
type CellLink<Row = RowRecord> = (item: Row) => { label: string; href: string }[];
```

If component generics are awkward, replacing repeated `any` with named aliases still documents intent.

### Benefits

- Makes unsafe boundaries more visible.
- Improves editor help and refactor safety.
- Documents the intended shape of generic table/export rows.

## 9. Refactor very large route pages into section components and pure helpers

Large route components such as `/api-explorer`, `/pen-compare`, `/reference`, `/data-quality`, and `/pen-analysis` combine routing, state, analysis, rendering, export logic, and section markup.

### Recommendation

For each large route, split incrementally into:

- route shell,
- section definition/config file,
- pure analysis/helper module,
- focused section components.

Suggested first targets:

- `/api-explorer`: presets/config/evaluation/output rendering.
- `/pen-compare`: flagged tab, spec table, pressure tab, IAF/MAX sections.
- `/reference`: spec-band and paper-size section components.

### Benefits

- Reduces cognitive load.
- Makes helper logic unit-testable.
- Makes future agent work safer through clearer file ownership.

## 10. Create a formal analysis-section abstraction

`SectionedPage.svelte` already provides a shared left-nav/hash-driven shell. Several pages still repeat section definitions, badges, export configuration, explanatory blurbs, and section-specific rendering patterns.

### Recommendation

Introduce a section config abstraction, adapted to Svelte component/snippet constraints:

```ts
interface AnalysisSection<TContext> {
	id: string;
	category: string;
	label: string;
	count?: (ctx: TContext) => number;
	export?: (ctx: TContext) => ExportConfig;
}
```

Use this to drive common headers, empty states, counts, and export behavior where possible.

### Benefits

- Reduces boilerplate on analysis/reference/data-quality pages.
- Makes adding new sections more predictable.
- Improves consistency of section-level export UX.

## 11. Consolidate chart/export logic across chart components

`PressureChart.svelte` contains specialized dataset construction and non-obvious Chart.js behavior. Other chart components also carry export-related conventions.

### Recommendation

Extract data/model preparation from rendering components where feasible:

- `src/lib/pressure-chart/datasets.ts`
- `src/lib/pressure-chart/axis.ts`
- `src/lib/pressure-chart/envelope.ts`
- `src/lib/chart-export/filenames.ts`

### Benefits

- Makes complex chart behavior unit-testable.
- Keeps visual components focused on rendering.
- Reduces regression risk around pressure response behavior.

## 12. Add focused unit tests for extracted pure helpers

The testing docs already identify follow-up test gaps for extracted pure-TS pieces in `TabletDetail`, `data-quality`, and `tablet-analysis`.

### Recommendation

Prioritize unit tests for:

1. `src/lib/data-quality/analysis.ts`
2. `src/lib/tablet-analysis/helpers.ts`
3. future `src/lib/entity-explorer/search.ts`
4. future `src/lib/entity-explorer/view-state.ts`
5. picker filtering helpers if extracted
6. chart dataset helpers if extracted

### Benefits

- Supports the proposed decomposition.
- Catches regressions without relying only on Playwright smoke coverage.
- Makes large route refactors safer.

## 13. Audit `/api-explorer` dataset construction

The docs emphasize one session-scoped `DrawTabDataSet` from `src/routes/+layout.ts`, with child pages accessing it through `await parent()`. `/api-explorer` imports `DrawTabDataSet` and `onMount` directly, which may be intentional for an interactive sandbox but deserves a clear decision.

### Recommendation

Audit the page and choose one path:

- If it is normal page data, move loading to `+page.ts` and use `parent().ds`.
- If it intentionally creates a sandbox dataset, add a prominent comment explaining why this route is exempt from the normal pattern.

### Benefits

- Keeps data-loading conventions clear.
- Avoids accidental duplicate dataset/cache behavior.
- Helps future agents avoid incorrectly copying the exception.

## 14. Clarify saved-view behavior for disabled filters

`EntityExplorer` excludes disabled filters when building execution steps, but saved-view construction currently needs a clear policy for whether disabled filters are omitted, preserved, or re-enabled on save/load.

### Recommendation

Decide and document one behavior:

- Do not save disabled filters.
- Save disabled filters by extending saved-view state.
- Save them as normal active filters and document that saving re-enables disabled filters.

### Benefits

- Avoids subtle user surprises.
- Makes saved-view serialization match visible UI state.
- Gives tests a concrete expected behavior.

---

## Reviewer notes & questions (2026-06-17)

A reviewer pass checking each suggestion against `main` (current code). Each
note states what I verified, plus a question for you. Nothing here is a
rejection — mostly scope/sequencing/priority questions before any of these
become issues.

**1. Centralize Data sub-nav** — Verified: `dataTabs` is duplicated inline in
`reference`, `data-quality`, and `api-explorer` (`/pen-compat` and
`/wacom-driver-compat` routes also exist). Q: are the three inline arrays
already identical, or has drift crept in (different label/order)? And should
the helper be the single source for _all_ Data tabs — including
`/data-dictionary` and `/wacom-driver-compat`, which your example list omits?

**2. Picker modal shell** — Verified `PenPicker` + `TabletPicker` share the
structure. Note there's also a `FieldPicker.svelte`. Q: is FieldPicker in
scope for the shared shell, or is it different enough (column/field picker, not
an entity list) to leave alone?

**3. Data page chrome layout** — Q: this overlaps #1 (a `ChromeLayout` would
take `dataSubNavTabs()`), so should it depend on / subsume #1? And we already
have `EntityListLayout` — extend that rather than add a second shell, or are
they deliberately distinct (list vs. arbitrary-content pages)?

**4. Unused step editors** — Verified **unused**: `FilterStep/SortStep/
SelectStep/TakeStep.svelte` are imported nowhere; EntityExplorer only
references queriton's Step _types_ (same names), not these components. Q: any
near-term saved-views / API-editor work that would revive them? If not, I'd
lean **delete** (option 1) — agree?

**5. Query-pill drag/drop** — Q: prefer starting with pure helpers
(`computeDropIndex()`, `moveItem()`) — unit-testable, low risk — before
committing to a `PillList.svelte` component?

**6. Split EntityExplorer** — Big one; likely lands best _after_ #5/#8. Q: do
the proposed module boundaries (`view-state` / `search` / `types`) match how
you'd cut it, or would you split differently?

**7. Entity-detail discriminated union** — Verified: `+page.svelte` casts
`data as any` for all 7 detail components. Recent loader additions
(`maxMeasurements`, `inventoryTabletCounts`/`inventoryPenCounts`) widened the
per-branch divergence, so this is more valuable now. Q: worth it given Svelte
can't narrow a union _across_ the child-component boundary (the cast often just
moves into each child)? Or scope it to typing each branch's `+page.ts` return?

**8. Narrow `any`** — Verified present (EntityExplorer 3, ResultsTable 2,
ExportDialog 7). Q: which of these are intentional heterogeneous-row
boundaries vs. accidental? I'd start with the named aliases you propose
(`RowRecord`, `CellLink`) rather than full generics — agree?

**9. Refactor large routes** — Heads-up: `pen-analysis` and `pen-compare` were
already partly decomposed recently (`PressureMetricSection`,
`PressureRangeTab`, per-section blocks, `SectionedPage`). Q: re-scope this to
the remaining biggest offenders — `/api-explorer` and `/reference` — and what's
the priority order? `/api-explorer` looks like the heaviest.

**10. Analysis-section abstraction** — `SectionedPage` already drives
`pen-analysis` with categories (Pressure / Dimensions / Tags added recently).
Q: does a config-object `AnalysisSection<TContext>` actually pay off, given
Svelte snippets (the per-section rendering) can't live in a plain TS config?
Could you sketch how `export`/`count` wire up without pushing markup into the
config?

**11. Chart helpers** — Note: `CLAUDE.md` flags the PressureChart envelope
polygon + dynamic Pmax axis as fragile/non-obvious. Q: worth the regression
risk to extract `envelope.ts`/`axis.ts`? I'd suggest the low-risk
`chart-export/filenames.ts` first and treat envelope extraction as separate.

**12. Unit tests for helpers** — Verified: nothing tests
`src/lib/data-quality/analysis.ts` or `src/lib/tablet-analysis/helpers.ts`
(note `data-repo`'s `range-resolve.ts` _does_ have tests). Q: prioritize
`analysis.ts` (the IAF "estimated, not measured" logic) and the new
`runInventoryDuplicateCheck` first?

**13. api-explorer dataset** — Verified: it does `onMount` + `new
DrawTabDataSet(...)` directly (not `parent().ds`). Q: is that an intentional
interactive sandbox? If yes, this is just "add a comment explaining the
exception"; if no, move to `+page.ts`. Which is it?

**14. Saved-view disabled filters** — Verified saved views exist
(`views.ts` `saveView(entityType, name, Step[])`). Since execution already
drops disabled filters, today's `Step[]` presumably saves them as active
(re-enabling on load). Q: which of your three policies is the intended one?
That's a product decision I can't infer.

**General Q:** any priority/sequence beyond the table — e.g., a "do these 3
first" set you'd want turned into GitHub issues? Several of these are
interdependent (#1→#3, #5→#6, #8→#6).
