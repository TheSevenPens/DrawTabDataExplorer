# Glossary

**Audience:** anyone new to the project, especially agents that need to map shorthand to concepts in one lookup.

Domain vocabulary used across this repo. Alphabetised. Each entry: short definition + a pointer to where the canonical implementation or longer write-up lives.

---

**Activation transition** — The point on a pressure-response curve where logical pressure first rises above 0 %. The force value at that point is the **Piaf** (formerly IAF / P00). See [PRESSURE-INTERPOLATION.md](PRESSURE-INTERPOLATION.md).

**Audience** — Field on tablets, one of `Consumer` / `Professional` / `Pro` / etc. Used for filtering and sorting on `/tablets`.

**Bracket midpoint** — Algorithm used by `estimatePiaf` / `estimatePmax`: when the session has records on both sides of a transition (e.g. a `y ≤ 0` sample AND a `y > 0` sample), return the average of those two force values. The only branch surviving issue [#212](https://github.com/TheSevenPens/DrawTabDataExplorer/issues/212).

**Brand** — Top-level entity. Singular noun form ("Wacom", "XP-Pen"). All-uppercase `BrandId` in code (`"WACOM"`, `"XPPEN"`). See `BRANDS` in [data-repo/lib/loader-shared.ts](../data-repo/lib/loader-shared.ts).

**Brand-sharded JSON** — Storage convention where one JSON file per brand holds all records of an entity type, e.g. `WACOM-pens.json`, `HUION-tablets.json`. Loaded transparently by [data-repo/lib/dataset.ts](../data-repo/lib/dataset.ts)'s `makeShardedLoader`.

**Cell links** — Per-route prop on `EntityExplorer` that turns specific cell values into clickable `/entity/<id>` URLs. See `cellLinks` in [src/lib/components/EntityExplorer.svelte](../src/lib/components/EntityExplorer.svelte).

**Compat** — Short for pen↔tablet compatibility. Stored in `data-repo/data/pen-compat/`. Each `PenCompat` record lists which pens work with which tablets. See [pen-compat-fields.ts](../data-repo/lib/entities/pen-compat-fields.ts).

**Computed field** — A `FieldDef` whose value is derived rather than read from the entity record. Surfaces with a small "computed" badge in the UI. Examples: `FullName`, `PressureSessionCount`, `Age (years)`. See [FIELDDEFS.md](FIELDDEFS.md).

**Cross-page setter pattern** — How fields-files get cross-entity data (e.g. session counts per pen). The fields file owns a module-scope `let` + a `setX()` exporter; `+layout.ts` calls it once per session. See [FIELDDEFS.md § Cross-page setter pattern](FIELDDEFS.md).

**`DataSource`** — Discriminator type telling `DrawTabDataSet` whether to load from URL (browser) or disk (Node CLI). See [data-repo/lib/dataset.ts](../data-repo/lib/dataset.ts).

**Defect** — Inventory pen flag indicating a known issue (e.g. `INK_LEAK`, `WORN_TIP`). Sessions on defective pens are hidden by default in chart aggregations. See `data-repo/docs/DEFECTS.md` and [data-repo/lib/pressure/defects.ts](../data-repo/lib/pressure/defects.ts).

**Digitizer** — The pen-sensing surface on a tablet (as distinct from the **Display**, which is the screen on a pen-display tablet). Tablets have both `DigitizerDimensions` (active sensing area) and optional `DisplayDimensions`.

**`DrawTabDataSet`** — The session-wide data accessor constructed once in `+layout.ts` and exposed via `await parent()` on every page. Wraps every entity collection with relations (`getPen()`, `getTablet()`, etc.). See [data-repo/lib/dataset.ts](../data-repo/lib/dataset.ts).

**Driver** — Vendor-supplied software (Wacom Bamboo Wacom Tablet, Huion driver, etc.). Tracked per release in `data-repo/data/drivers/<BRAND>-drivers.json`, EntityId format `brand.driver.<version>_<os>`.

**EntityId** — Lowercase, dot-separated, self-describing identifier whose second segment encodes the entity type. Formats:

| Entity        | Pattern                    | Example                                 |
| ------------- | -------------------------- | --------------------------------------- |
| Brand         | `brand`                    | `wacom`                                 |
| Tablet        | `brand.tablet.modelid`     | `wacom.tablet.ctl4100`                  |
| Tablet family | `brand.tabletfamily.id`    | `wacom.tabletfamily.wacomintuosprogen8` |
| Pen           | `brand.pen.penid`          | `wacom.pen.kp503e`                      |
| Pen family    | `brand.penfamily.id`       | `wacom.penfamily.wacomkpgen3`           |
| Driver        | `brand.driver.version_os`  | `wacom.driver.6.4.13-2_windows`         |
| Session       | `brand.session.invid_date` | `wacom.session.wap.0001_2024-09-02`     |

See [CLAUDE.md § EntityId formats](../CLAUDE.md) and [data-repo/lib/pressure/session-id.ts](../data-repo/lib/pressure/session-id.ts) for the session derivation.

**Envelope** — `PressureChart` view mode that overlays Min/Max (or P05/P95, or P25/P75) bands across all selected sessions. Implemented as a single closed-polygon dataset with `fill: 'shape'` to avoid Chart.js's between-datasets fill bug. See [CLAUDE.md § Pressure response charts](../CLAUDE.md).

**Field def** / **`FieldDef`** / **`FieldDisplayDef`** — The descriptor type that drives every column / filter / sort / detail row / export across the explorer. See [FIELDDEFS.md](FIELDDEFS.md).

**Field picker** — The "+" popover used by `FilterBar` / `SortBar` / `ColumnBar` to pick a field. Components: [FieldPicker.svelte](../src/lib/components/FieldPicker.svelte).

**Flag** — User-flagged item, persisted to localStorage, drives the Compare and Flagged sub-tabs. Four independent sets (tablets / pen-units / pen-models / pen-families). See [STORES.md § flagged-store](STORES.md).

**`gf`** — Gram-force. The physical-force unit for pressure-response measurements. (1 gf ≈ 9.81 mN.) Used as `unit: 'gf'` on numeric `FieldDef`s.

**HUP / WAP / XPP / SAP / XEP / LAP** — Inventory-ID prefixes by brand (Huion / Wacom / XP-Pen / Samsung / Xencelabs / Lamy pens). Followed by a 4-digit serial: `WAP.0001`, `HUP.0024`.

**IAF** — Stored **manufacturer-quoted** Initial Activation Force spec on a pen model (`Pen.IAF`, gram-force). A real published value, **not** an estimate — distinct from **Piaf**, the per-session activation force the explorer estimates from pressure-response records. See [pen-fields.ts](../data-repo/lib/entities/pen-fields.ts).

**`InventoryId`** — Identifier for a specific physical pen unit (or tablet unit) that the project owns, e.g. `WAP.0001`. Distinct from `EntityId` (which identifies a **model**). Stored in `data-repo/data/inventory/sevenpens-pens.json` and `sevenpens-tablets.json`.

**Inventory pen** / **Inventory tablet** — A specific physical unit (one of multiple of the same model). Carries an `InventoryId`, references a model via `PenEntityId` / `TabletEntityId`, may carry defects. EntityId format `sevenpens-inventory.invpen.<id>`.

**ISO paper size** — A4, A5, B5, etc. — referenced on the tablet detail page's Size tab to give a physical-scale comparison. Markers in [ValueHistogram](../src/lib/components/ValueHistogram.svelte).

**Junction** — Windows term for "directory symlink". Used in [setup-static.mjs](../scripts/setup-static.mjs) because the dev server needs `static/<entity>` to point at `data-repo/data/<entity>` without admin privileges (which a true symlink would require on Windows).

**`logicalPct`** — The "pressure %" axis on pressure-response curves (0 to 100). The tablet driver reports this as a fraction; the explorer multiplies by 100 for display.

**`makeShardedLoader`** — Factory function that builds a per-entity loader (URL or disk) given a shard list and root key. The reason `BRANDS` is the single source of truth for which files to try. See [data-repo/lib/dataset.ts](../data-repo/lib/dataset.ts).

**Model** — The product (e.g. "Wacom Intuos Small"). Distinct from a unit (an instance owned). Tablets and Pens are "model" entities.

**Model family** — Group of related models sharing a generation or tech (e.g. "Wacom Intuos 2018 tablet series"). Stored in `data-repo/data/tablet-families/` and `pen-families/`. The convention for `Model.Family` is the family's **EntityId** (e.g. `wacom.tabletfamily.wacomintuos2018`), not the human-readable `FamilyName`.

**`PenCompat`** — A record listing which `PenId`s are compatible with which `TabletId`s. One `PenCompat` group can cover many pens × many tablets. See [pen-compat-fields.ts](../data-repo/lib/entities/pen-compat-fields.ts).

**`physicalGf`** — The "force" axis on pressure-response curves, in gram-force.

**Pressure response curve** — The map between physical force applied to a pen tip and the logical pressure value the driver reports. Captured as a sparse sequence of `[force, pct]` records per **session**. Visualised by [PressureChart.svelte](../src/lib/components/PressureChart.svelte).

**Pressure session** / **PressureResponse session** — One capture event of a pen ↔ tablet pair under specific driver / OS conditions. Has `Records: [force, pct][]`, `Date`, `User`, `Notes`. Identified by `<brand>.session.<inventoryid>_<date>`. Stored in `data-repo/data/pressure-response/`.

**Piaf, P25, P50, P75, Pmax** — Standard force values on a pressure-response curve. Piaf = activation (formerly P00), P25/P50/P75 = quartiles (computed via `interpolatePhysical`), Pmax = saturation (formerly P100).

**Piaf** — The **estimated** Initial Activation Force (formerly P00). Physical force (gf) at which the pen first registers logical pressure above 0 %, estimated per session by `estimatePiaf` from pressure-response records. Distinct from the stored manufacturer-spec **IAF** field. See [PRESSURE-INTERPOLATION.md](PRESSURE-INTERPOLATION.md).

**Pmax** — Maximum Force (formerly P100 / Max Pressure / MaxP100). Physical force (gf) at which the pen's logical pressure reaches 100 % (digitizer saturation). Computed by `estimatePmax`. See [PRESSURE-INTERPOLATION.md](PRESSURE-INTERPOLATION.md).

**P50** / **Median** — The force at logical 50 %. Used as the "middle" marker on `BandsChart`.

**Powershell wide-indent JSON** — The non-standard JSON formatting used by `data-repo/data/*.json` files (29 / 33 / 45 / 49 / 53 space indent levels). Produced originally by PowerShell `ConvertTo-Json`; preserved by all write scripts via either re-shelling to PowerShell or surgical text splicing. **Do not `JSON.parse → JSON.stringify` round-trip these files** — the resulting diff is enormous.

**Prerender** — SvelteKit setting (`export const prerender = true/false`). Most list pages prerender for static deployment to GitHub Pages; the canonical entity detail route (`/entity/[entityId]`) is `prerender = false` and relies on the SPA fallback (`404.html`).

**`prerender = false`** + **`ssr = false`** + **`adapter-static`** — The setup that makes every page a client-only SPA route. `+layout.ts` runs once in the browser, constructs the `DrawTabDataSet`, exposes it via `await parent()` on every child page.

**Queriton** — The query / pipeline engine consumed via `import "@thesevenpens/queriton"`. Lives at [packages/queriton/](../packages/queriton/) (also a git submodule). Powers every list page's filter / sort / column UI and the `/api-explorer`. Own README: [packages/queriton/README.md](../packages/queriton/README.md).

**`Records`** — The `[force, pct][]` array on a pressure session. First record (typically) has `pct = 0`; last record (typically) has `pct = 100`. Records should be **monotonic on both axes** — `findNonMonotonicSessions` catches drops.

**Saturation transition** — The point on a pressure-response curve where logical pressure reaches 100 %. The force at that point is the **Pmax** (formerly Max Pressure / P100).

**Saturated-only session** — A session where every record has `y ≥ 100`. `estimatePmax` returns the lowest-force record's x as a fallback estimate (pre-bracket-logic behaviour).

**Saved view** — A user-saved query pipeline (filters + sorts + visible columns). Persisted to localStorage, scoped per entity type. See [SavedViews.svelte](../src/lib/components/SavedViews.svelte) and [src/lib/views.ts](../src/lib/views.ts).

**`sevenpens`** — The username string under which all owned inventory and sessions are stored. Single-user inventory project — there's no multi-user system. Hardcoded in `+layout.ts` and [data-repo/data/inventory/sevenpens-pens.json](../data-repo/data/inventory/sevenpens-pens.json).

**Spring decay** — Removed-in-#212 extrapolation method that fit an exponential to the last few slopes of a curve to project a Piaf / Pmax estimate when the session didn't capture activation / saturation. Replaced by the simpler **bracket midpoint** approach + the new `/pressure-backfill` dev tool for adding explicit endpoint records.

**SPA fallback** — The static `404.html` page that serves the SvelteKit app shell for any path the static adapter didn't prerender (e.g. `/entity/<id>` for entity IDs not known at build time).

**SubNav** — Sub-tab row beneath the top-level Nav. Each top-level section (Tablets / Pens / Data) has its own set of sub-tabs. Definitions centralised in [src/lib/nav/subnav-tabs.ts](../src/lib/nav/subnav-tabs.ts).

**Symlink / Junction** — See "Junction" above.

**`Tablet.Family`** — Tablet-family EntityId reference (e.g. `wacom.tabletfamily.wacomintuosprogen8`). **Not** the human-readable `FamilyName`. Legacy Wacom records use plain names; the data-quality CLI flags those as orphan references.

**Tab** / **Detail tab** — Sub-section of a detail page (Model / Specs / Compatible Pens / etc.). Implemented by [Tabs.svelte](../src/lib/components/Tabs.svelte). The active tab is mirrored to the URL hash so back/forward navigation works.

**Valibot** — Schema-validation library used in [data-repo/lib/schemas.ts](../data-repo/lib/schemas.ts). All JSON files validate against these schemas in `npm run data-quality`.

**View** — Two distinct meanings:

- A SvelteKit page-component (synonymous with route).
- A saved query pipeline (see **Saved view**).

The doc usually disambiguates by saying "saved view" for the latter.

**`/pressure-backfill`** — Dev-only route added in #212 that lets a contributor tune `(force, 0)` / `(force, 100)` endpoint records for sessions that don't capture activation / saturation. Saved tunings are applied by [`apply-pressure-backfill.mjs`](../scripts/apply-pressure-backfill.mjs). Not linked from Nav.

---

See also:

- [CLAUDE.md](../CLAUDE.md) for project-wide rules and gotchas.
- [ARCHITECTURE.md](ARCHITECTURE.md) for the runtime data-flow picture.
- [PRESSURE-INTERPOLATION.md](PRESSURE-INTERPOLATION.md) for the pressure-math vocabulary in depth.
- [SCRIPTS.md](SCRIPTS.md) for every CLI tool referenced above.
- [STORES.md](STORES.md) for the four Svelte stores.
- [FIELDDEFS.md](FIELDDEFS.md) for the FieldDef abstraction.
- [UXCOMPONENTS.md](UXCOMPONENTS.md) for every Svelte component.
