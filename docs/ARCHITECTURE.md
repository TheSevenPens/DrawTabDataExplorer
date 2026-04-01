# Architecture

## Project structure

```
DrawTabDataExplorer/
├── data-repo/                    # Git submodule -> DrawTabData
│   ├── data/                     # JSON datasets
│   └── lib/                      # Loaders, pipeline, entities, units
├── src/
│   ├── app.html                  # HTML shell
│   ├── routes/                   # SvelteKit pages
│   │   ├── +layout.ts            # CSR-only, no SSR
│   │   ├── +page.svelte          # Tablets list
│   │   ├── tablets/[entityId]/   # Tablet detail
│   │   ├── pens/                 # Pens list + detail
│   │   ├── pen-families/         # Pen families list + detail
│   │   ├── tablet-families/      # Tablet families list + detail
│   │   ├── pen-compat/           # Pen compatibility list
│   │   ├── drivers/              # Drivers list + detail
│   │   ├── pressure-response/    # Pressure response sessions
│   │   ├── inventory/            # Inventory (pens/tablets sub-tabs)
│   │   └── data-quality/         # Data quality dashboard
│   └── lib/
│       ├── components/           # Reusable Svelte components
│       │   ├── EntityExplorer.svelte   # Generic entity page
│       │   ├── DetailView.svelte       # Generic detail page
│       │   ├── FilterStep.svelte
│       │   ├── SortStep.svelte
│       │   ├── SelectStep.svelte
│       │   ├── TakeStep.svelte
│       │   ├── ResultsTable.svelte
│       │   ├── SavedViews.svelte
│       │   └── Nav.svelte
│       ├── unit-store.ts         # Svelte store for unit preference
│       └── views.ts              # Saved views (localStorage)
├── static/                       # Junctions -> data-repo/data/*
├── svelte.config.js
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## How it consumes DrawTabData

The DrawTabData repo is included as a git submodule at `data-repo/`.

**Import alias**: `$data` resolves to `data-repo/`, configured in both
`svelte.config.js` (kit.alias) and `vite.config.ts` (resolve.alias).

All data types, loaders, pipeline engine, field definitions, and unit
conversion are imported via `$data/lib/...`.

**Static data serving**: Windows directory junctions in `static/` point
to `data-repo/data/` subdirectories so SvelteKit serves the JSON files.
These junctions are gitignored.

## Key components

**EntityExplorer** — Generic page component that wires together the
pipeline builder, saved views, add-step buttons, and results table.
Every entity list page delegates to this component.

**DetailView** — Generic detail page showing all fields grouped by
category, with URL detection, unit conversion, and computed field badges.

**SavedViews** — Dropdown with built-in Default view and user-created
views. Scoped by entity type in localStorage.

**Nav** — Navigation bar with links to all entity pages and a
metric/imperial toggle button.

## Svelte 5 notes

- Step components use `$bindable()` props for parent binding
- Cannot use `structuredClone()` on Svelte 5 proxies — use
  `JSON.parse(JSON.stringify(...))` for deep copying
- Unit preference uses a Svelte writable store subscribed via `$`

## Setup

```bash
git clone --recurse-submodules https://github.com/TheSevenPens/DrawTabDataExplorer.git
cd DrawTabDataExplorer
npm install
npm run dev
```

To update the data submodule:
```bash
cd data-repo
git pull origin master
cd ..
git add data-repo
git commit -m "Update data submodule"
```

## npm scripts

| Script    | Command       | Purpose                     |
|-----------|---------------|-----------------------------|
| `dev`     | `vite dev`    | Start dev server            |
| `build`   | `vite build`  | Build static site           |
| `preview` | `vite preview`| Preview built site          |

## Dependencies

All dev-only:

- **svelte** (v5), **@sveltejs/kit**, **@sveltejs/vite-plugin-svelte**
- **@sveltejs/adapter-static** — static site adapter
- **typescript**, **vite**, **@types/node**
