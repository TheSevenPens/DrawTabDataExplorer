# Testing

**Audience:** agents and contributors · When to run which command.

## Command matrix

| Command                | Scope                                     | When to run                              |
| ---------------------- | ----------------------------------------- | ---------------------------------------- |
| `npm run check`        | Svelte + TypeScript (`svelte-check`)      | After almost any code change             |
| `npm run test:unit`    | Vitest — `src/lib/`, `packages/queriton/` | Helpers, queriton, pipeline-related TS   |
| `npm run test:e2e`     | Playwright — builds app, hits routes      | Route/page/UI changes; slower (~minutes) |
| `npm run data-quality` | `data-repo` tablet structural CLI checks  | After `data-repo/data/` edits            |
| `npm run verify-docs`  | `docs/FUTURES.txt` vs GitHub issue state  | After editing FUTURES Open list          |
| `npm run lint`         | ESLint + Prettier check                   | CI parity; before commit                 |

## Unit test locations

| Path                                      | Covers                                                   |
| ----------------------------------------- | -------------------------------------------------------- |
| `src/lib/pen-helpers.test.ts`             | Pen name helpers                                         |
| `src/lib/chart-palette.test.ts`           | Chart palette: no-cycling, light/dark split, accent slot |
| `src/lib/year.test.ts`                    | Year parsing / compare helpers                           |
| `src/lib/field-display.test.ts`           | Unit suffix / stripUnit                                  |
| `src/lib/filter-url.test.ts`              | URL `?filter=` parsing                                   |
| `src/lib/views.test.ts`                   | Saved views / pipeline clone                             |
| `src/lib/storage.test.ts`                 | localStorage helpers                                     |
| `src/lib/tablet-size-ranges.test.ts`      | Size category constants                                  |
| `packages/queriton/test/*.test.ts`        | Query engine                                             |
| `data-repo/lib/dataset.test.ts`           | DataSet (submodule)                                      |
| `data-repo/lib/pressure/pressure.test.ts` | Interpolation (submodule)                                |

The large Svelte pages now have section-extracted modules
(`src/lib/data-quality/`, `src/lib/tablet-analysis/`, `src/lib/components/tablet-detail/`).
Unit tests for those pure-TS pieces are a follow-up — `TabletDetail`,
`data-quality`, and `tablet-analysis` are not directly unit-tested yet.

## E2E

- **File:** `e2e/smoke.spec.ts`
- **Behavior:** `playwright.config` builds and serves the app; tests assert key routes render.
- **Coverage:** every route renders without console errors, list → detail
  navigation for tablets / pens / brands, `SectionedPage` rendering on
  `/tablet-analysis` and `/data-quality`, Pressure Response list → session
  detail (canvas check), Reference left-nav sections, and the
  flag-tablet → compare workflow.

## Chart palette

`chart-palette.test.ts` covers the invariants a refactor could quietly undo
(slots never cycle, light and dark differ, slot 1 tracks the accent). It does
**not** re-check colourblind separation — that needs the dataviz skill's
`validate_palette.js`. If you change a palette slot, run the validator by hand
in both modes with `--pairs all` (the pressure chart is a scatter) and paste
the result in the PR. See [CLAUDE.md](../CLAUDE.md) § Chart colours.

## Data quality (two layers)

| Layer  | How                                                                                   |
| ------ | ------------------------------------------------------------------------------------- |
| CLI    | `npm run data-quality` — schema/structure on tablets (and shared checks in data-repo) |
| In-app | `/data-quality` — cross-entity, completion %, pressure checks (needs `npm run dev`)   |

## Typical PR checklist

1. `npm run check`
2. `npm run test:unit`
3. If `src/routes/` or major components: `npm run test:e2e`
4. If data JSON changed: `npm run data-quality`
5. If `docs/FUTURES.txt` Open changed: `npm run verify-docs`
