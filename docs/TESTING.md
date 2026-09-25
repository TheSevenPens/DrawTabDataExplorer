# Testing

**Audience:** agents and contributors · When to run which command.

## Command matrix

| Command                | Scope                                                               | When to run                                                    |
| ---------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------- |
| `npm run check`        | Svelte + TypeScript (`svelte-check`)                                | After almost any code change                                   |
| `npm run test:unit`    | Vitest — `src/`, `scripts/`, `data-repo/lib/`, `packages/queriton/` | Helpers, loaders, queriton, field defs                         |
| `npm run test:e2e`     | Playwright — builds app, hits routes                                | Route/page/UI changes; slower (~minutes)                       |
| `npm run data-quality` | `data-repo` schema, cross-entity and brand-drift checks             | After `data-repo/data/` edits; must report zero                |
| `npm run verify-docs`  | `docs/FUTURES.txt` vs GitHub issue state                            | After editing FUTURES Open list                                |
| `npm run lint`         | ESLint + Prettier check                                             | CI parity; before commit                                       |
| `npm run pack-smoke`   | Packs data-repo + queriton, imports them from a throwaway project   | After touching either package's `package.json` (needs network) |

## Unit test locations

Tests sit beside the code they cover (`foo.ts` → `foo.test.ts`); every
extracted helper ships with one (CLAUDE.md § Extracted helpers). The config
in `vitest.config.ts` picks them up from:

| Path                               | Covers                                                                                  |
| ---------------------------------- | --------------------------------------------------------------------------------------- |
| `src/lib/**/*.test.ts`             | Helpers, search, exports, migrations, modal/tab keyboard logic, section analysis        |
| `scripts/*.test.ts`                | Build-time scripts (`version-json`)                                                     |
| `data-repo/lib/**/*.test.ts`       | Loaders and failure handling, DataSet, field defs (enum values), version info, pressure |
| `packages/queriton/test/*.test.ts` | Query engine, DataSet caching, generated tutorial snippets                              |

Components (`.svelte`) are covered by the e2e suite, not unit tests.

## E2E

- **File:** `e2e/smoke.spec.ts`
- **Behavior:** `playwright.config` builds and serves the app; tests assert key routes render.
- **Coverage:** every route renders without console errors; list → detail
  navigation; `SectionedPage` sections; pressure session detail; Reference
  left-nav; flag → compare; search matches the text on screen; a failed data
  file shows an error with Try again (#331); tab Back/Forward and saved-view
  rename collisions (#334); keyboard containment in the picker and export
  dialogs, ARIA tabs, keyboard-sortable headers (#335).

## CI

`.github/workflows/verify.yml` runs lint, type-check, unit, **data-quality**,
e2e and the production build on every pull request; `deploy.yml` calls the
same workflow on `main` and deploys only what it built. A red `verify`
check blocks nothing by itself — don't merge past it.

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

## Data pipeline regression checks

- `npm test --prefix data-repo`: also runs the data CLI tests, which the Explorer suite does not discover.
- `npm run typecheck:scripts --prefix data-repo`: checks TypeScript CLI entry points and their shared library.
- `scripts/data-writers.test.ts`: exercises successful imports, batch rejection and dry runs against a dataset copy.
- `scripts/data-pipeline.test.ts`: starts a real Vite watcher and checks source add/change/delete, invalid-source errors, bundle bytes and metadata.
- `scripts/version-json.test.ts`: publication rejects dirty inputs; local previews retain explicit provenance.
- `npm run pack-smoke`: checks counts and every generated bundle hash in the actual npm tarball.
