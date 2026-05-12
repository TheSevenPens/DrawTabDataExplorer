# Contributing

Welcome. This repo is a SvelteKit explorer for tablet/pen data plus a
generic query library ([queriton](./packages/queriton/)) that lives
here as an npm workspace. Issues, PRs, and discussions are all welcome.

## Repository layout

```
.
├── src/                       # SvelteKit app — routes, components, lib utilities
├── data-repo/                 # Git submodule (DrawTabData) — JSON datasets + TS loader/schema lib
├── packages/queriton/         # Generic Query/Pipeline library (workspace package)
├── e2e/                       # Playwright smoke tests
├── docs/                      # Architecture, FUTURES index, etc.
└── scripts/                   # One-off Node scripts (data audits, generators, setup)
```

## First-time setup

```bash
git clone --recurse-submodules https://github.com/TheSevenPens/DrawTabDataExplorer.git
cd DrawTabDataExplorer
npm install   # also wires the static/ → data-repo/data symlinks
npm run dev   # http://localhost:5173
```

If you forgot `--recurse-submodules`, run
`git submodule update --init --recursive && npm run setup-static`.

## Verification gates

Run all four before pushing:

```bash
npm run test:unit   # vitest — 333+ tests across src, queriton, data-repo
npm run check       # svelte-check — type errors only fail CI; warnings are tracked
npm run lint        # eslint + prettier --check
npm run build       # SvelteKit static build sanity check
```

The CI workflow ([.github/workflows/deploy.yml](.github/workflows/deploy.yml))
runs the first three on every push to `main` plus Playwright e2e and a
production build, then deploys to GitHub Pages.

## Code style

- **Tabs for indentation** (Prettier `useTabs: true`). The included
  [.editorconfig](.editorconfig) handles this for editors that don't
  run Prettier on save.
- Single quotes for strings (`singleQuote: true`), trailing commas
  everywhere (`trailingComma: "all"`), 100-char print width.
- Prefer editing existing files over creating new ones. Default to no
  comments — only add one when the _why_ is non-obvious.

## The submodule workflow

Data lives in `data-repo/` as a git submodule. Changes to data files
need two commits:

```bash
# 1. Inside the submodule:
cd data-repo
git add … && git commit -m "…" && git push

# 2. Outside, to advance the pointer:
cd ..
git add data-repo && git commit -m "chore: update data-repo submodule (…)"
```

## Working on queriton

The generic query library lives at [packages/queriton/](packages/queriton/).
Its source has zero DrawTab references — anything entity-specific
(tablets, pens, brands) belongs in `data-repo/lib/` or `src/`, not in
queriton.

Tests for queriton are filesystem-/network-free; they're built around
embedded fixtures (`mtcars`, `orders+customers`, `people+hobbies`,
`with-nulls`). When adding a new verb, add a test against the relevant
fixture in [packages/queriton/test/query.test.ts](packages/queriton/test/query.test.ts)
or [test/nulls.test.ts](packages/queriton/test/nulls.test.ts).

## Filing issues

Use the templates at [.github/ISSUE_TEMPLATE/](.github/ISSUE_TEMPLATE/)
if your situation fits — bug report or feature request. Otherwise
"Open a blank issue" is fine; we don't enforce templates.

## License

ISC — see [LICENSE](./LICENSE).
