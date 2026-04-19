# Future Improvements

## Dev-mode error banner

Add a `DevErrorBanner` component that listens for `window.onerror` and
`window.addEventListener('unhandledrejection', ...)` and renders the error
message + stack trace inline in the page (no devtools required). Mount it
in `+layout.svelte` under an `{#if import.meta.env.DEV}` guard so it has
zero production footprint.

This complements `+error.svelte` (which only catches SvelteKit load errors)
by surfacing reactive / template runtime errors that don't go through the
SvelteKit error pipeline.

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
