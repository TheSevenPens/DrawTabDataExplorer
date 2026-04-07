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
Every entity list page delegates to this component. Pages can pass
`defaultFilterField` to seed the field used when the user clicks "+"
to add a new filter row.

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

## Using a local data repo

If you have DrawTabData cloned as a sibling folder (e.g. `../DrawTabData`),
you can point the dev server at it instead of the submodule:

```bash
VITE_DATA_DIR=../DrawTabData npm run dev
```

This enables a **data source toggle** banner at the top of the app:

- **Gray banner** — "Using submodule data" (default). Data is served from
  the `data-repo/` submodule via the static directory junctions.
- **Orange banner** — "Using local data repo". Data is served from your
  local clone. Click the button to switch.

Switching reloads the page so all data is re-fetched from the selected
source. The toggle sets a browser cookie; the Vite dev plugin reads it
on each JSON request to decide which directory to serve from.

Without `VITE_DATA_DIR`, no banner or toggle appears (production
behaviour).

## npm scripts

| Script    | Command       | Purpose                     |
|-----------|---------------|-----------------------------|
| `dev`     | `vite dev`    | Start dev server            |
| `build`   | `vite build`  | Build static site           |
| `preview` | `vite preview`| Preview built site          |

## Local data quality checks

The data quality page in the app (`/data-quality`) runs checks in the
browser. You can also run a subset of those checks locally without
starting the dev server.

### Tablet structural checks (CLI)

```bash
npx tsx data-repo/lib/run-data-quality.ts
```

This runs the checks defined in `data-repo/lib/data-quality.ts` against
all tablet JSON files: required fields, whitespace, enum validation,
numeric fields, complex field structure, color gamuts, EntityId format,
display-only fields on pen tablets, unknown fields, UUID format, ISO
dates, and duplicate EntityIds.

Exit code 0 means no issues; exit code 1 prints the issues grouped by
type.

### Browser-only checks

The following checks only run in the app (they need the full dataset
loaded and cross-entity relationships resolved):

- **Required fields** for pens, drivers, pen families, tablet families,
  pen-compat, and pressure response
- **Whitespace** on pens, drivers, and pressure response
- **Orphaned compat references** — pen-compat rows referencing TabletIds
  or PenIds that don't exist
- **Orphaned family references** — pens/tablets referencing a family ID
  that doesn't exist in the family entities
- **Compat coverage** — Wacom tablets with no pen-compat entries, pens
  with no tablet-compat entries
- **Field completion** — percentage of records with each optional field
  populated (tablets, displays, pens, drivers, pressure response,
  inventory)

To run these, start the dev server (`npm run dev`) and open the Data
Quality page.

## Dependencies

All dev-only:

- **svelte** (v5), **@sveltejs/kit**, **@sveltejs/vite-plugin-svelte**
- **@sveltejs/adapter-static** — static site adapter
- **typescript**, **vite**, **@types/node**
