# Where to change things

**Audience:** agents · **Maintenance:** update this table when adding routes, shared components, or major refactors.

| Goal | Primary files | Notes |
|------|----------------|-------|
| New entity list page | `src/routes/<entity>/+page.ts`, `+page.svelte`, `data-repo/lib/entities/*-fields.ts` | Use `EntityExplorer`; see [RECIPES.md](RECIPES.md) |
| Canonical entity detail | `src/routes/entity/[entityId]/+page.ts`, `+page.svelte`, `src/lib/components/*Detail.svelte` | `prerender = false` on loader |
| Typed URL → canonical redirect | `src/routes/<entity>/[entityId]/+page.ts` | 307 to `/entity/...` |
| Session-scoped data load | `src/routes/+layout.ts` | One `DrawTabDataSet` via `parent().ds` |
| Filter / sort / columns UI | `packages/queriton`, `EntityExplorer.svelte`, `FilterBar` / `SortBar` / `ColumnBar` | Import types from `queriton` |
| Saved views | `src/lib/views.ts`, `SavedViews.svelte` | localStorage per entity type |
| Tablet/pen display names | `$lib/pen-helpers.ts`, `$lib/tablet-helpers.ts` | Implementations in `data-repo/lib/entities/*-fields.ts` |
| Field metadata / columns | `data-repo/lib/entities/*-fields.ts` | `TABLET_FIELDS`, `PEN_FIELDS`, etc. |
| JSON schema / validation | `data-repo/lib/schemas.ts`, `data-repo/lib/data-quality.ts` | `npm run data-quality` |
| Static JSON 404s | `scripts/setup-static.mjs`, `static/` junctions | Not `static/` JSON directly |
| Submodule data edit | `data-repo/data/**` | Then bump submodule pointer in outer repo |
| Pressure interpolation / sessions | `data-repo/lib/pressure/` | `interpolate.ts`, `session-id.ts`, `defects.ts` |
| Reference bands (IAF, max pressure) | `src/lib/bands.ts` | Used by Reference + `MaxPressureTab` |
| Tablet size categories | `src/lib/tablet-size-ranges.ts` | Detail, Reference, Compare |
| Flag tablets for compare | `src/lib/flagged-store.ts`, tablets list `+page.svelte` | Max 6 |
| Flag pens (pressure) | `src/lib/flagged-store.ts`, `FlagButton.svelte`, `/pen-flagged` | Separate localStorage keys |
| Sub-nav tabs (Tablets / Pens) | Route `+page.svelte` files today; target: `src/lib/nav/` (#173) | See ARCHITECTURE.md § Nav |
| Data quality dashboard | `src/routes/data-quality/`, `src/lib/data-quality/` | Browser-only cross-entity checks |
| Tablet analysis sections | `src/routes/tablet-analysis/`, `src/lib/tablet-analysis/` | `SectionedPage`, `DistributionTable` |
| E2E smoke tests | `e2e/smoke.spec.ts` | See [TESTING.md](TESTING.md) |
| GitHub Pages base path | `svelte.config.js`, `vite.config.ts` | `base` / `paths` |

See also [ARCHITECTURE.md](ARCHITECTURE.md) for component catalog and [AGENTS.md](../AGENTS.md) for read order.
