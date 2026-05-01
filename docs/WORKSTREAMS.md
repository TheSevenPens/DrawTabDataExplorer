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
is a separate consumer of the data repo. The Explorer is already a
superset — `/pen-inventory` and `/tablet-inventory` cover the same
ground.

**Next:** update the DrawTabInventory README to mark the project
deprecated and point users to the Explorer's Inventory sub-tabs.

**Open:** is there any DrawTabInventory feature not yet in the
Explorer that should be ported before deprecation?

## Merge consumer project: Wacom-Driver-List

**Status:** [Wacom-Driver-List](https://github.com/TheSevenPens/Wacom-Driver-List)
is a separate consumer of the data repo. The Explorer is already a
superset — `/drivers` covers the same ground.

**Next:** update the Wacom-Driver-List README to mark the project
deprecated and point users to the Explorer's Drivers tab.

**Open:** is there any Wacom-Driver-List feature not yet in the
Explorer that should be ported before deprecation?

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

**Next (phased migration):**

1. **Replace the stub.** Add `chart.js` dep; port `interpolate.js`
   into `data-repo/lib/pressure/`; port `PressureChart.svelte`;
   rewrite `/pressure-response` from stub → Sessions list with
   detail drill-down. (~1-2 days)
2. **Light up existing pen detail pages.** Add a "Pressure Response"
   section to `PenDetail.svelte` and `PenFamilyDetail.svelte`
   showing all sessions for that pen/family. Port
   `ChartLegendTable` and `ModelStats`. (~1 day)
3. **Data Quality integration.** Port the pressure-specific checks
   into the existing `/data-quality` page. (~half day)
4. **Extend flagging to pens/models/families.** Generalize
   `flagged-store.ts` from tablet-only to handle three new sets.
   Add a Flagged sub-tab under Pens. (~1 day)
5. **Compare with named groups.** Deepest feature; could land as
   `/pen-compare` or be deferred indefinitely if simpler flagging
   covers the workflow. (~2-3 days)

After Phase 5 the standalone tool can be deprecated, mirroring the
DrawTabInventory and Wacom-Driver-List workstreams.

**Open:**

- **Chart library** — Chart.js (~200 KB lazy-loaded) for a fast
  port, or rebuild in SVG to match the Explorer's existing
  `ValueHistogram.svelte` pattern? SVG is consistent and
  bundle-friendly but adds 1-2 days. Recommendation: Chart.js for
  Phase 1, revisit later.
- **`interpolate.js` location** — confirm we land it in
  `data-repo/lib/pressure/` per the upstream's stated intent (one
  data-repo PR + outer-repo pointer bump).
- **Per-session URLs** — PenPressureData uses
  `/session/wap.0004_2024-09-02`. Explorer uses `/entity/<id>`
  canonically. Should sessions get an EntityId in the data
  (`<brand>.session.<id>`?) or stay outside the entity scheme with
  their own route?
- **Phase 5 scope** — keep Compare-with-named-groups, or call it
  YAGNI and rely on Phase 4 flagging?

---

_Last updated: 2026-05-01_
