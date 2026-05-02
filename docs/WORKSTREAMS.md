# Workstreams

Ongoing, incremental work — areas that get chipped away at over time
rather than landed in a single PR. Distinct from `FUTURE.md`, which
captures one-shot ideas.

Each entry: **Status** (where we are), **Next** (concrete next step),
**Open** (decisions still pending). Update in place as work progresses;
delete the entry when the workstream is done.

---

## Pen spec fill-in (Sensors / Controls / Physical)

**Status:** Wacom complete — 72 of 77 pens patched from the kuuube
spreadsheet on 2026-05-01 plus 6 manual overrides
([scripts/import-kuuube-pen-data.py](../scripts/import-kuuube-pen-data.py),
commit `ef7982f` in data-repo). 4 Wacom pens (LP-110, LP-120, LP-300E,
KP-403E) still bare — not in the spreadsheet. KP-503E was the seed
record done by hand. All non-Wacom brands (Apple, Asus, DigiDraw,
Gaomon, Huion, Samsung, Staedtler, Ugee, Xencelabs, XP-Pen) still
have only Model fields populated.

**Next:** find specs for the 4 remaining LP/KP pens; pick a non-Wacom
brand to start.

**Open:** the kuuube spreadsheet doesn't cover **Tilt**, **Hover**, or
**Shape** — those need a separate source for every pen. Apple Pencil
specs are well-published; XP-Pen / Huion are harder.

## Pen-tablet compatibility coverage

**Status:** the data-quality page reports gaps — Wacom tablets with no
pen-compat entries and pens with no tablet-compat entries. Recent
commits added Apple iPad×Apple Pencil pairs and a few cross-brand
GAOMON / UGEE rows.

**Next:** spot-check the data-quality "compat coverage" section on
each release and fill the largest gaps.

**Open:** for very old Wacom hardware (pre-2005 SP/UP/EP series) the
matching pen for each tablet often isn't documented anywhere reliable.

## Pre-existing data-quality issues

**Status:** 18 issues noted in CLAUDE.md as known/pre-existing:

- **5** EntityId mismatches (HUION `unkkamvas*_2019` and WACOM
  `ct0405u_*` records — the `_YYYY` suffix isn't part of the canonical
  EntityId derivation)
- **1** brand drift — VEIKK in `brands.json` but missing from
  `loader-shared.ts` `BRANDS` and `schemas.ts` `BrandEnum`
- **12** orphaned `Model.Family` refs — legacy Wacom pen-display
  records using plain names like `"Cintiq"` and `"MobileStudio Pro"`
  instead of EntityIds; HUION `gt2402` `"GEN3"`; XPPEN
  `md160uh` `"ARTISTULTRA"`

**Next:** decide per-cluster whether to fix the data, the EntityId
derivation rule, or accept and silence in the checker.

**Open:** the WACOM `ct0405u_2004` / `_2005` mismatch is intentional
(two product runs of the same model). Either the EntityId rule needs
to allow this disambiguation or the records need to be merged.

## Inventory — multi-user

**Status:** `/pen-inventory` and `/tablet-inventory` are hardcoded to
the `sevenpens` user. Data layout in
[`data-repo/data/inventory/`](../data-repo/data/inventory/) is already
keyed by user (`<user>-pens.json`, `<user>-tablets.json`).

**Next:** decide whether to (a) hardcode a different user, (b) read
from a query param `?user=…`, or (c) add a settings/profile picker.

**Open:** is this ever multi-user, or is the project effectively
single-user?

## PowerPoint export

**Status:** a working implementation lives on the
`feat/powerpoint-export` branch (commit `3349669`). Punted from main
because the layout/polish surface area is bigger than expected.
Details are in [`docs/FUTURE.md`](FUTURE.md#powerpoint-export-deferred-from-phase-3-of-export-standardization).

**Next:** revive only when there's a concrete user request that
justifies the polish work.

**Open:** wide-table layout, branding/theme, multi-deck assembly,
bundle cost — all still open per FUTURE.md.

## Merge consumer project: DrawTabInventory

**Status:** [DrawTabInventory](https://github.com/TheSevenPens/DrawTabInventory)
is a single-file static HTML page (`index.html`, 33 KB) that fetches
the inventory JSON from the data submodule at runtime and renders two
tabs (Tablets / Pens) with search, brand+type filters, sort, and a
row count. No README in the repo today.

The Explorer is already a **full superset** — `/pen-inventory` and
`/tablet-inventory` use `EntityExplorer` (better search, multiple
filters, sort, column picker, saved views). Nothing to port.

**Done:**

1. ✅ Added `README.md` with deprecation notice + Explorer links
   (DrawTabInventory commit `5f2f50f`, 2026-05-01).
2. ✅ Added in-page deprecation banner to `index.html`.
3. ✅ Added deprecation notice at top of `docs/OVERVIEW.md`.

**Next:** decide whether to archive the GitHub repo.

**Open:** archive the repo or leave it live (deprecated)? Archiving
prevents future stars/forks; leaving it live keeps existing URLs
functional.

## Merge consumer project: Wacom-Driver-List

**Status:** [Wacom-Driver-List](https://github.com/TheSevenPens/Wacom-Driver-List)
is a SvelteKit static site (~50 KB Svelte) with five routes:

| Route                                                     | Explorer status             |
| --------------------------------------------------------- | --------------------------- |
| `/drivers` (list, filter, sort, JSON export)              | ✓ present at `/drivers`     |
| `/drivers/[version]` (per-version detail + download URLs) | ✓ present at `/entity/<id>` |
| `/tablets` (Wacom products with compat driver range)      | ✗ data missing              |
| `/tablets/[name]` (per-tablet driver range)               | ✗ data missing              |
| `/notes` (static info + links)                            | ~ half-covered by `/about`  |

The interesting gap: Wacom-Driver-List has its own
`wacom-products.json` (~333 entries with `name`, `model`,
`platforms[]`, `drivermin`, `drivermax`) extracted from
`link.wacom.com/wdc/update.xml` via `scripts/extract-products.js`.
**This data isn't in DrawTabData yet.** It's the only piece the
Explorer doesn't already cover.

There's also a hidden `JsonMerger.svelte` developer utility (~8 KB)
for comparing driver JSON files during data maintenance — belongs in
`data-repo/scripts/`, not the user-facing app.

**Phases:**

1. ✅ **Deprecation banner.** Added `README.md`, in-page banner in
   `+layout.svelte` (visible on every route), and notice at top of
   `docs/OVERVIEW.md` (Wacom-Driver-List commit `2478d0a`,
   2026-05-01).
2. ✅ **Port the driver-range data.** (2026-05-01) Went with the
   hybrid approach (option 3 in the original analysis): manifest
   data lives at `data-repo/data/wacom-update/products.json` (98
   entries, plus the source XML for reproducibility) extracted by
   `data-repo/scripts/extract-wacom-products.mjs`. Added an optional
   `Model.SensorId` field to the tablet schema for the per-tablet
   join, and a new **Data ▸ Driver Compat** sub-tab
   (`/wacom-driver-compat`) that lists every manifest entry with its
   driver range and links to matching tablets. 18 of 98 entries
   match by dashless `Model.Id` already; SensorId fill-in will close
   the rest as a slow incremental workstream. **Still TODO inside
   Phase 2:** surface the matched driver range on the tablet detail
   page itself (currently visible only via the Driver Compat
   listing).
3. ✅ **JsonMerger — dropped as obsolete (no port).** (2026-05-01)
   Investigation showed the component was built for a workflow that
   no longer exists: it merges a flat `wacom-drivers.json` array
   against an additions JSON, but the legacy flat file was removed
   from Wacom-Driver-List in commit `dea89c2` and the current driver
   updates go through `data-repo/scripts/Add-WacomDriver.ps1`
   directly (no merge step). The component isn't reachable from any
   nav link in the Wacom-Driver-List app today either. Nothing to
   port; the file dies when the repo is archived.

After the TabletDetail sub-task in Phase 2 lands, the workstream is
fully done — archive the repo.

**Open:**

- TabletDetail integration: surface the driver range from
  `wacom-update/products.json` on the tablet detail page itself when
  the join hits (via dashless `Model.Id` or `Model.SensorId`).
  Currently the data is only visible via the Driver Compat listing.
- Archive vs. leave-live, same question as DrawTabInventory.

## Suggested execution order for the consumer-merge workstreams

1. **Both deprecation banners** (~1 hour total) — DrawTabInventory
   Phase 1 + Wacom-Driver-List Phase 1. Quickest user-visible win.
2. **Wacom-Driver-List Phase 2** — port driver-range data; finishes
   the only feature gap.
3. **Wacom-Driver-List Phase 3** — relocate the merger script,
   archive both Wacom-Driver-List and DrawTabInventory.
4. **PenPressureData** — much larger, separate workstream tracked
   below.

## Merge consumer project: PenPressureData

**Status:** [PenPressureData](https://github.com/TheSevenPens/PenPressureData)
is a separate consumer of the data repo (Svelte 5 + SvelteKit static
site, same stack as the Explorer, ~146 KB of Svelte, version 0.13).
The Explorer's `/pressure-response` page is currently a stub that
just links there; the in-app viewer was removed when the new UX
wasn't finalized. The Explorer already loads the `pressureResponse`
dataset via `loadAllData()` — it just doesn't visualize it.

What PenPressureData has that the Explorer doesn't:

- `PressureChart.svelte` — Chart.js scatter of force (gf) vs.
  pressure (%); zoom modes (normal / IAF detail 0-20gf / max
  pressure 95-100%); data view modes (raw / raw+estimates /
  standardized / envelope); envelope range options (Min/Max /
  P05/P95 / P25/P75); PNG + HTML export
- `interpolate.js` — 17-percentile P-value computation with
  spring-decay extrapolation for IAF (P00) and Max Pressure (P100)
  when raw data doesn't reach those endpoints. Per their architecture
  doc, this should eventually move into the shared DrawTabData lib.
- Defects-aware behaviour — auto-hides defective sessions on charts,
  excludes them from aggregates, shows "Excluding N defective" notes
- Three-tier flagging — pens (inventory IDs), models (pen entity
  IDs), families (family entity IDs); each in its own localStorage
  key
- Per-session detail pages (`/session/<sessionId>`)
- Compare with named groups — most complex feature; named groups of
  any mix of pens/models/families/tags, per-group colour, overlap
  warnings, saved views
- Pressure-specific data quality checks — non-monotonic sessions,
  missing low-end data, single-session pens, stale measurements

**Phases (Phase 5 dropped — see Open below):**

1. ✅ **Stub replaced.** (2026-05-01) Added `chart.js` dep; ported
   `interpolate.js` to `data-repo/lib/pressure/interpolate.ts` (typed)
   plus a `session-id.ts` helper that derives the canonical
   `<brand>.session.<inventoryid>_<date>` EntityId from the raw
   session record. New `PressureChart.svelte` (Chart.js scatter,
   raw + P00/P100 estimate dashed extensions) and `SessionDetail.svelte`.
   `/pressure-response` is now a Sessions list (124 entries) with
   brand/pen filters; rows link to `/entity/<sessionEntityId>` which
   renders the chart, P00/P100 stats, and the raw record table.
   **Deferred to later phases:** zoom modes, envelope view, PNG/HTML
   export menus, multi-session overlay UI.
2. **Light up existing pen detail pages.** (~1 day)
   - Add a "Pressure Response" section to
     [`src/lib/components/PenDetail.svelte`](../src/lib/components/PenDetail.svelte)
     and `PenFamilyDetail.svelte` rendering `<PressureChart>` with
     all sessions whose `PenEntityId` matches (or whose pen's
     `PenFamily` matches, for the family page). The
     `pressureSessionCount` is already on `PenDetail`'s data load
     ([entity loader](../src/routes/entity/[entityId]/+page.ts));
     extend the loader to return the session array itself.
   - Port `ChartLegendTable.svelte` (per-session checkbox + P-value
     stats + links) from
     `../PenPressureData/app/src/lib/components/ChartLegendTable.svelte`
     and `ModelStats.svelte` (min/median/max aggregates) from the
     same dir. Both are ~200 lines each.
   - On `PressureChart`, hook up multi-session colour assignment
     (already done — uses `PALETTE`) and verify a 6+ session pen
     looks legible.
3. **Data Quality integration.** (~half day)
   - Port the pressure-specific checks from
     `../PenPressureData/app/src/lib/dataQuality.js` (non-monotonic
     sessions, missing low-end data, single-session pens, stale
     measurements, recommended-for-re-measurement) into the existing
     [`/data-quality`](../src/routes/data-quality/+page.svelte)
     page as a new section.
4. **Extend flagging to pens/models/families.** (~1 day)
   - Generalize
     [`src/lib/flagged-store.ts`](../src/lib/flagged-store.ts)
     from tablet-only to handle three new sets (pens by inventory
     ID, pen models by entity ID, pen families by entity ID).
     Reference impl:
     `../PenPressureData/app/src/lib/flagged.svelte.js` (uses
     V2-suffixed localStorage keys; preserve that scheme to avoid
     colliding with existing tablet flags).
   - Add a "Flagged" sub-tab under **Pens** showing all flagged
     items overlaid on a single `<PressureChart>`.
   - Extend `SubNav` badge support if needed (already supports
     optional `badge`).

After Phase 4 the standalone tool can be deprecated, mirroring the
DrawTabInventory and Wacom-Driver-List workstreams.

**Pickup notes (resuming this work):**

- Source repo is cloned as a sibling at `../PenPressureData/`. Pull
  it before referencing files (`cd ../PenPressureData && git pull`).
- Already in place after Phase 1: `chart.js` dep, `PressureChart.svelte`,
  `SessionDetail.svelte`, `data-repo/lib/pressure/{interpolate,session-id}.ts`,
  `session` case in the `/entity/[entityId]` loader.
- Deferred from Phase 1 (could land in any later phase or stay
  punted): zoom modes (normal / IAF / max-pressure detail), envelope
  view (median + min/max area), multi-session overlay UI on the
  Sessions list, PNG and HTML export from the chart.
- Drawing curve labels above 6 sessions gets visually busy in
  PenPressureData's chart too — the marker-label tier algorithm in
  Explorer's `ValueHistogram.svelte` could be ported across if/when
  this becomes a problem.

**Open:**

- ~~Chart library~~ — went with **Chart.js** for Phase 1 (lazy-loaded
  via the chart component). Revisit if bundle size becomes an issue.
- ~~`interpolate.js` location~~ — landed in
  [`data-repo/lib/pressure/interpolate.ts`](../data-repo/lib/pressure/interpolate.ts).
- ~~Per-session URLs~~ — using canonical
  `<brand>.session.<inventoryid>_<date>` EntityId at
  `/entity/<id>`. Derived on the fly via
  [`data-repo/lib/pressure/session-id.ts`](../data-repo/lib/pressure/session-id.ts);
  not stored in the JSON yet (could be added later if needed).
- ~~Phase 5 (Compare with named groups)~~ — **dropped** as YAGNI;
  Phase 4 flagging is expected to cover the cross-pen comparison
  use case. Can be revived if a real need emerges.

---

_Last updated: 2026-05-01_
