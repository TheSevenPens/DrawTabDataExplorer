# Future Improvements

## E2E smoke tests with Playwright

Playwright is a browser automation library (by Microsoft) that drives a real
headless browser. A small smoke-test suite — one test per route, one per tab —
would catch runtime crashes that `svelte-check` misses (e.g. the `gcd`
recursive-`{@const}` crash, the `closestISO` blank-page bug).

Suggested scope for a first suite:
- Every top-level route renders a non-empty `<main>` / `<h1>`
- Every tab on Reference, Compare, and Inventory renders without a JS error
- Navigating to a tablet/pen detail page from the list page renders the detail

Setup: `npm init playwright@latest`, add a `test` step to `deploy.yml` after
Type-check. Tests live in `e2e/`.

## Accessibility

- **Keyboard navigation for drag-to-reorder** in FilterBar, SortBar,
  ColumnBar — currently drag-only; add Up/Down arrow key support on pills.
- **Live regions** for filter/sort/column changes so screen-readers
  announce result-count updates without full-page navigation.

## PowerPoint export (deferred from Phase 3 of export standardization)

A working implementation of `.pptx` download for both tables and charts
exists on the `feat/powerpoint-export` branch (commit `3349669`). The
work was paused because the layout/polish surface area is larger than
expected — punting until we have a clearer use case.

What's already on the branch:

- `pptxgenjs` (~200 KB) added as a dep, lazy-imported only when the user
  picks the PowerPoint format so the main bundle is unaffected.
- `src/lib/pptx-export.ts` — `exportTableAsPptx()` and
  `exportChartAsPptx()`. Both produce a single-deck file with one slide
  per export; the table function uses pptxgenjs's `autoPage: true` so a
  long table paginates across slides with the header row repeated.
- `ExportDialog`: 5th format option "PowerPoint", file-only (output radio
  snaps to "Save as file", clipboard radio disables, hint text appears).
- `ChartExportButton`: 5th menu item "Download PowerPoint". Reuses the
  existing SVG → canvas → PNG pipeline.
- Slide layout: 16:9 widescreen (`LAYOUT_WIDE`, 13.333 × 7.5 in), 0.5"
  margins, 22pt bold title at top. Tables use a light-grey bold header
  row, 10pt body, 0.5pt grey borders, equal column widths. Charts are
  embedded as PNG centered with aspect ratio preserved.

Smoke-tested: data-quality "Issues" → 543 KB pptx, Reference page
histogram → 141 KB pptx. Both files start with PKZip/OOXML magic bytes
(`50 4B 03 04`) so they're well-formed.

Open questions before merging:

- **Wide-table layout.** Equal column widths get cramped past ~7
  columns. Options: auto-size by content, give the first column extra
  width, switch to font auto-shrink, or warn the user when columns
  exceed a threshold.
- **Branding/theme.** Currently uses pptxgenjs defaults (Calibri,
  no master slide). A consistent corporate-style theme template
  would make the output feel less generic but adds maintenance.
- **Multi-deck assembly.** A user looking at the Compare page might
  reasonably want a single deck containing the comparison table AND
  the histograms — currently each export is its own one-shot file.
- **Bundle cost.** 200 KB lazy-loaded only when needed. Tolerable as
  long as users actually use it.

To revive: `git checkout feat/powerpoint-export`. The branch is on
`origin` and is ~400 LoC ahead of main.

## ValueHistogram — marker label layout

The current tier-placement algorithm (3-pass: strict → lenient → fallback) is
"good enough" but can still produce visual overlap when many markers fall in a
narrow x-range (e.g. a family where every tablet has nearly the same diagonal).

Ideas for a better approach:

- **Force-directed / constraint-solver**: treat each label as a rectangle and
  iteratively resolve overlaps, similar to how d3-annotation works.
- **Sliding-window compaction**: after assigning tiers, do a second pass that
  tries to promote markers back to a shallower tier once there is enough gap
  from the previously placed label on that tier.
- **Dynamic label width**: replace the `CHAR_WIDTH * label.length` estimate
  with an SVG `getComputedTextLength()` call so width is exact.
- **Overflow indicator**: when there are too many markers to place cleanly,
  show a small legend table below the chart instead of stacking infinitely.
