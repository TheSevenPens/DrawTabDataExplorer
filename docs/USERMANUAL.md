# DrawTabDataExplorer — User Manual

A tour of what's in the app and how to get around. Each section is short
on purpose — the app is meant to be self-explanatory once you know what's
there.

Live site: <https://thesevenpens.github.io/DrawTabDataExplorer/>

## What it is

A read-only browser for the [DrawTabData](https://github.com/TheSevenPens/DrawTabData)
dataset — drawing tablets, pens, pen families, brands, drivers, and
related metadata. Think of it as a multi-tabbed spreadsheet over the data,
with detail pages for every entity.

All data lives client-side after the initial page load, so filtering,
sorting, and switching views is instant. There is no account, no sync,
and no telemetry — your saved views and flagged tablets stay in your
browser's localStorage.

## Browsing entities

The top navigation collapses related views under a single parent:

- **Brands** — every manufacturer in the dataset (Wacom, XP-Pen, Huion, …).
- **Tablets** — sub-tabs: _Tablet models_, _Tablet families_, _Analysis_, _Inventory_, _Compare_.
- **Pens** — sub-tabs: _Pen models_, _Pen families_, _Inventory_, _Pressure Response_.
- **Drivers** — driver releases, mostly Wacom for now.
- **Timeline** — year-by-year view of releases.
- **Data** — sub-tabs: _Reference_, _Data Quality_, _Pen Compat_.
- **About** — credits and links to related tools.

Click any name in a list to open its detail page. Detail pages show all
populated fields grouped into categories (Model / Digitizer / Display /
Physical / Standalone), plus context — for example a tablet detail shows
its family, included pens, size comparison against other tablets, and
ISO paper-size equivalents.

The canonical URL for any entity is `/entity/<entity-id>` (e.g.
`/entity/wacom.tablet.ctl4100`). The typed routes
(`/tablets/<id>`, `/pens/<id>`, …) redirect to the canonical form.

Cross-references on list pages are clickable: the **Family** column on
the Pens page links to the pen-family detail, and the **Tablet** column
on the Tablet Inventory page links to the tablet detail (showing the
full marketing name rather than the raw EntityId).

Formatted full names suppress the model id when it would just duplicate
what's already in the marketing name — so you'll see "Asus ProArt Pen
MPA01" rather than "Asus ProArt Pen MPA01 (MPA01)". Apple iPads always
omit the model id since their internal ids ("iPad-Pro-12.9-Gen1") only
restate the marketing name in a less readable form.

## Searching and filtering

Every list page has the same toolbar:

```
[ Search... ] [ QuickFilter ▾ ]   [ Filters ] [ Sort ] [ Columns N ] [ Views ]
```

- **Search box** — case-insensitive substring search across the row's
  searchable fields (the entity name, ID, alternate names, etc.).
- **QuickFilter dropdown** — a one-click brand or category filter,
  populated from values present in the loaded data.
- **Filters** button — opens a panel for compound filters with operators
  (`contains`, `eq`, `lt`, `gte`, `isempty`, …). Multiple filters AND
  together. Drag a filter pill out to remove it.
- **Sort** button — multi-key sort. Drag to reorder the keys; click a
  pill to flip ascending / descending.
- **Columns** button — choose which columns appear and in what order.
  Drag pills to reorder.
- **Views** button — saved view manager (see next section).

Active filters and sorts show inline in the toolbar — an amber count badge
on Filters, the primary sort field on Sort, the column count on Columns.

## Saved views

A _view_ captures the current filter / sort / column / search state for
the page you're on. Click **Views → Save current view**, give it a name,
and it's stored in localStorage. Switch between saved views from the same
dropdown. Each entity type has its own set of views, so saving "My Wacoms"
on the Tablets page won't clutter the Pens page.

There's always a built-in **Default** view that resets everything.

## Compare tablets

To compare specs side by side:

1. On the Tablets list, click the flag icon in the leftmost column for
   each tablet you want to compare (max 6). The flag count appears as a
   badge on the **Compare** sub-tab under Tablets.
2. Open **Tablets ▸ Compare**. The _Flagged_ tab lists what you've
   selected; the _Compare_ tab is a side-by-side spec table with the
   tablets as columns and specs as rows. Cells with differing values are
   highlighted.
3. Use **Copy as HTML** or **Export as HTML** to share the table.

Below the spec table, size histograms show your flagged tablets as
markers against the full distribution — useful for "is this in the small
or large category" at a glance.

You can also flag/unflag from a tablet detail page.

## Reference

The **Reference** page has a left-hand navigation grouped into three
categories — **Tablets**, **Paper Sizes**, and **Pen Pressure** — that
collect measurement vocabularies other pages rely on:

- **Tablet Sizes** — pen-tablet and pen-display size categories with cm,
  inch, and closest ISO A paper-size equivalents.
- **ISO A / ISO B / US Paper Sizes** — full tables with diagonal in cm
  and inches.
- **Display Resolutions** — Full HD / 2.5K / 3K / 4K categories with
  counts of how many tablets in the dataset fall into each.
- **IAF Ranking** — Initial Activation Force bands (gram-force) for pen
  pressure, from EXCELLENT (≤ 1 gf) to AVOID (> 5 gf). Shown as a
  number-line band chart and table.
- **Max Physical Pressure** — digitizer saturation pressure bands
  (gram-force), from LIMITED (100–200 gf) to EXCESSIVE (> 900 gf).

Every section has an **Export** button that produces a CSV / TSV / HTML
copy of the table.

## Pressure Response

The **Pressure Response** sub-tab under **Pens** lists every
recorded measurement session — the relationship between physical
force on a pen tip (gram-force) and the logical pressure the
digitizer reports (0–100%). Filter by brand or pen, then click into
any row for a detail page with:

- A scatter chart of the raw force-vs-pressure measurements
- Dashed extrapolation lines showing the estimated **IAF** (Initial
  Activation Force, P00) and **Max Force** (P100) endpoints when
  the raw data doesn't reach 0% / 100% exactly
- A raw-records table

A more featureful viewer with envelope mode, zoom presets, and
named-group comparison still lives at
<https://thesevenpens.github.io/PenPressureData/>; those features
are being incrementally folded back into the Explorer.

## Max Pressure

Every pen and pen-family detail page has a **Max Pressure** tab that
contextualises the pen's saturation force against the same band ranges
used on the Reference page (LIMITED / OK / GOOD / EXCELLENT / EXCESSIVE,
in gram-force):

- _All max pressures_ — one solid red marker per non-defective
  measurement session, plotted against the bands so you can see at a
  glance where the pen typically lands.
- _Max pressure range_ — a summary chart that shades the min↔max
  span and marks the median with a thicker line, plus a Min / Median /
  Max table beneath.
- _Pressure response (max-zoom)_ — the same chart from the Pressure
  Response tab, locked to the 95–100% region and with the x-axis
  auto-sized to the largest P100 estimate (+50 gf headroom) so you can
  compare each session's approach to saturation.

Defective sessions are excluded from these aggregates by the same
inventory-defects rule the Pressure Response tab uses; toggle "Show N
defective" on the embedded chart to include them.

## Inventory

A personal record of physical pens and tablets you own — purchase date,
vendor, defects, notes. Lives as the **Inventory** sub-tab under
**Pens** (your pens) and the **Inventory** sub-tab under **Tablets**
(your tablets), each using the same EntityExplorer pattern with
filter / sort / columns / saved-views. Only one user (`sevenpens`) is
wired up today.

## Timeline

A year-by-year view of tablet and pen releases. Useful for spotting
launch-window patterns and discontinuations.

## Force Proportions

On a pen-tablet detail page, the **Force Proportions** tab visualises
how much of the tablet's active area is wasted when its native ratio is
forced to fit a 16:9 or 16:10 monitor. Three SVG panels per ratio show
the tablet's actual proportions, the target shape, and the result with
the lost strip highlighted. PEN displays and standalones already match
their own screen ratio, so this tab is hidden for them.

## Analysis

Custom analyses that don't fit the standard list-page pattern — pricing
trends, brand market share over time, and similar exploratory views.

## Data Quality

A health dashboard for the underlying dataset. Schema-level issues
(required fields, whitespace, enum values) are listed first; below that,
cross-entity issues — orphaned compat references, orphaned family
references, tablets with no compat coverage — and field-completion
percentages per entity type. Each section has its own Export button.

The CLI version of these checks runs via `npm run data-quality`; see
[CLAUDE.md](../CLAUDE.md) for contributor details.

## Settings

The gear icon in the top-right opens a small dropdown:

- **Units** — switch between metric (mm/cm) and imperial (inches). The
  toggle propagates everywhere dimensions are shown.
- **Show alt units** — when on, every dimension shows both unit systems
  side by side, e.g. `225 × 145 mm (8.86 × 5.71 in)`.
- **Theme** — light / dark.

Settings are remembered across sessions.

## Sharing

Every detail page has a stable URL (`/entity/<entity-id>`), so links to
specific tablets or pens are safe to share. Saved views currently live
only in your browser — there's no URL-encoded state yet (this is on the
future-improvements list).
