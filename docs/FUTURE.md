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
