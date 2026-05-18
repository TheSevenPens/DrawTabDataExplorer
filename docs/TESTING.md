# Testing

**Audience:** agents and contributors · When to run which command.

## Command matrix

| Command | Scope | When to run |
|---------|--------|-------------|
| `npm run check` | Svelte + TypeScript (`svelte-check`) | After almost any code change |
| `npm run test:unit` | Vitest — `src/lib/`, `packages/queriton/` | Helpers, queriton, pipeline-related TS |
| `npm run test:e2e` | Playwright — builds app, hits routes | Route/page/UI changes; slower (~minutes) |
| `npm run data-quality` | `data-repo` tablet structural CLI checks | After `data-repo/data/` edits |
| `npm run verify-docs` | `docs/FUTURES.txt` vs GitHub issue state | After editing FUTURES Open list |
| `npm run lint` | ESLint + Prettier check | CI parity; before commit |

## Unit test locations

| Path | Covers |
|------|--------|
| `src/lib/pen-helpers.test.ts` | Pen name helpers |
| `src/lib/year.test.ts` | Year parsing / compare helpers |
| `src/lib/field-display.test.ts` | Unit suffix / stripUnit |
| `src/lib/filter-url.test.ts` | URL `?filter=` parsing |
| `src/lib/views.test.ts` | Saved views / pipeline clone |
| `src/lib/storage.test.ts` | localStorage helpers |
| `src/lib/tablet-size-ranges.test.ts` | Size category constants |
| `packages/queriton/test/*.test.ts` | Query engine |
| `data-repo/lib/dataset.test.ts` | DataSet (submodule) |
| `data-repo/lib/pressure/pressure.test.ts` | Interpolation (submodule) |

Large Svelte pages (`TabletDetail`, `data-quality`, `tablet-analysis`) are **not** unit-tested yet — prefer section extraction (#176, #177) then tests on pure TS modules.

## E2E

- **File:** `e2e/smoke.spec.ts`
- **Behavior:** `playwright.config` builds and serves the app; tests assert key routes render.
- **Extend:** #179 — analysis, data-quality, session detail URLs.

## Data quality (two layers)

| Layer | How |
|-------|-----|
| CLI | `npm run data-quality` — schema/structure on tablets (and shared checks in data-repo) |
| In-app | `/data-quality` — cross-entity, completion %, pressure checks (needs `npm run dev`) |

## Typical PR checklist

1. `npm run check`
2. `npm run test:unit`
3. If `src/routes/` or major components: `npm run test:e2e`
4. If data JSON changed: `npm run data-quality`
5. If `docs/FUTURES.txt` Open changed: `npm run verify-docs`
