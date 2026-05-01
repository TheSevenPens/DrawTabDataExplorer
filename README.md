# DrawTabDataExplorer

A read-only browser for the [DrawTabData](https://github.com/TheSevenPens/DrawTabData)
dataset — drawing tablets, pens, families, brands, drivers, and related
metadata.

Live site: <https://thesevenpens.github.io/DrawTabDataExplorer/>

## Documentation

- [User manual](docs/USERMANUAL.md) — what's in the app and how to use it.
- [Architecture](docs/ARCHITECTURE.md) — project layout and components.
- [CLAUDE.md](CLAUDE.md) — developer notes (setup, adding a brand, the
  submodule workflow).

## Setup

```bash
git clone --recurse-submodules https://github.com/TheSevenPens/DrawTabDataExplorer.git
cd DrawTabDataExplorer
npm install
npm run dev
```

`npm install` runs the postinstall hook that creates the static-data
symlinks; if that step is skipped or the data submodule isn't checked
out yet, run `git submodule update --init --recursive` followed by
`npm run setup-static`.

## Scripts

| Script                    | Purpose                                                 |
| ------------------------- | ------------------------------------------------------- |
| `npm run dev`             | Start the dev server                                    |
| `npm run build`           | Production build (output in `build/`)                   |
| `npm run preview`         | Preview the production build                            |
| `npm run check`           | Type-check (`svelte-check`)                             |
| `npm run lint`            | Lint (`eslint .`) + format check (`prettier --check .`) |
| `npm run format`          | Auto-format with Prettier and ESLint `--fix`            |
| `npm run test:unit`       | Run Vitest unit tests once                              |
| `npm run test:unit:watch` | Run Vitest in watch mode                                |
| `npm run test:e2e`        | Run Playwright E2E smoke tests (auto-builds + serves)   |
| `npm run data-quality`    | Run the data-repo data-quality validator                |
| `npm run setup-static`    | Recreate `static/` → `data-repo/data/` symlinks         |

CI runs `lint` and `check` before building. `eslint.config.js` is
intentionally conservative — recommended rules only, with several
Svelte plugin rules downgraded to warnings to match existing patterns.
Tighten over time.
