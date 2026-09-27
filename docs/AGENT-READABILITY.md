# Agent readability

**Audience:** agents & contributors · **Status:** static deliverables below are a proposal; the file manifest now ships in `version.json`. A small WebMCP pilot is implemented (see below).

The static-output proposal below makes the dataset usable by AI assistants
that are **not** driving a browser. It needs no runtime code or new dependencies.
The WebMCP pilot at the end covers agents using a supported browser.

## Why (measured, not theoretical)

An AI assistant was asked a simple question against the live site: _which
tablets support touch?_ It took **ten round-trips**, and one of them was silently
wrong.

| What it had to do                                                        | Why                                                       |
| ------------------------------------------------------------------------ | --------------------------------------------------------- |
| Read `performance.getEntriesByType('resource')` to find the JSON URLs    | No index. There is no documented entry point to the data. |
| Hardcode a **guessed** list of 12 brand names                            | No manifest listing the data files.                       |
| Fetch a brand file and walk the object tree hunting for a touch field    | No published schema.                                      |
| Filter on `SupportsTouch === true` → **0 results, reported confidently** | The value is the string `"YES"`.                          |
| Re-inspect, find `"YES"`/`"NO"`, rerun                                   | —                                                         |

Every one of those facts was already declared in
`data-repo/lib/entities/tablet-fields.ts`:

```ts
{ key: "DigitizerSupportsTouch", label: "Touch", type: "enum",
  enumValues: ["YES", "NO"], group: "Digitizer" }
```

**The description exists and has no door.** That is the whole problem.

## The bigger constraint

The app is `adapter-static` with `ssr = false`. A plain fetch of any page returns
the shell — title and viewport meta, no content. Most agents do not drive a
browser, so today they get **nothing**. Publishing static JSON is what makes the
dataset reachable at all; it is not an optimisation.

## Deliverables

Ordered by value ÷ cost. All four are build-time artifacts under `static/`.

### 1. `static/llms.txt`

Hand-written orientation, no build step. The conventions an agent cannot infer:

- What the dataset is and roughly how large
- Entity types and where each one's JSON lives
- `EntityId` format (`wacom.tablet.dth227`) and casing
- **Enum values are strings** — `"YES"` / `"NO"`, never booleans
- Measured-wins-per-unit for pressure ranges
- `Model.Family` groups variants
- Licence / attribution: whether an assistant may cite this and how

### 2. Field catalogue JSON

Per entity, emitted at build from the existing FieldDef arrays in
`data-repo/lib/entities/*-fields.ts`. Per field: `key`, `label`, `type`,
`enumValues`, `group`, `unit`, `computed`, and optionally `fillRate`.

**Project, never restate.** A hand-maintained field list drifts, and drift here
is worse than absence — a wrong enum value produces an empty result set that
looks like a real answer. Read the FieldDef arrays; do not transcribe them.

Worth surfacing per field: whether it is `computed` (derived, may be absent on
sparse rows) and its fill rate across the dataset. A field that is 3% populated
is queryable and practically a dead end — an agent filtering on it reports "no
matches" when the truth is "not recorded for these".

### 3. Data file index

`version.json` is already the right shape and, since #333, generated at build
time from the data being shipped (`scripts/version-json.ts`, called from
`vite.config.ts`) — it just needs the file list. For each data file: entity
type, URL, brand (where applicable), record count.

Counts must be generated, never hand-maintained: a stale manifest is worse than
no manifest. (The hand-maintained copy reported `tablets: 300` against a live
375, which is what #333 fixed.)

### 4. Combined file per entity

`static/tablets/all-tablets.json` alongside the per-brand files. Twelve fetches
become one, and nobody needs to know the brand list to begin. Keep the per-brand
files — they are better for anything brand-scoped.

## Acceptance

An agent with **no prior knowledge of this site** should be able to answer
"which pen displays support touch" in **two fetches**: `llms.txt`, then one data
file. Today it takes ten and can silently fail.

## Constraints

- Build-time only. Nothing runs in the browser.
- No new dependencies.
- Additive. No existing file changes shape; nothing under `static/` is hand-edited
  (see `docs/ANTI-PATTERNS.md`).
- Generated output must be reproducible from `data-repo` — never committed by hand.

## Open

- **Deliverable 5, the key collision.** Decision pending — see the section below.
  Discuss before building deliverable 2, because the answer changes what the
  catalogue emits.
- **Static HTML for `/entity/[entityId]`.** What would make a tablet page quotable
  by a non-JS agent. Conflicts with the current `prerender = false` SPA fallback
  (`docs/ANTI-PATTERNS.md`). Larger job, not part of 1–4.

## Deliverable 5 — the key collision (decision pending)

### The problem

The field catalogue will say `DigitizerSupportsTouch`. The raw JSON says
`Digitizer.SupportsTouch`. An agent reads the catalogue, learns the key, goes to
filter the data, and the key is not there. It then has to infer the mapping —
a second inference step, in exactly the place the catalogue was meant to remove
inference. This is the same failure class as `true` vs `"YES"`.

### The evidence

Measured across all 11 FieldDef arrays in `data-repo/lib/entities/`:

| Entity            |  Fields | Simple path | Derived | `computed: true` |   Enum |
| ----------------- | ------: | ----------: | ------: | ---------------: | -----: |
| tablet            |      81 |          39 |  **42** |               19 |     12 |
| pen               |      26 |           4 |  **22** |                3 |      2 |
| pressure-response |      15 |           9 |       6 |                5 |      3 |
| inventory-tablet  |      12 |          10 |       2 |                0 |      2 |
| driver            |      11 |           8 |       3 |                3 |      2 |
| pressure-range    |      11 |          10 |       1 |                0 |      3 |
| inventory-pen     |       9 |           7 |       2 |                0 |      2 |
| tablet-family     |       7 |           3 |       4 |                0 |      1 |
| pen-family        |       6 |           3 |       3 |                3 |      1 |
| brand             |       5 |           4 |       1 |                0 |      0 |
| pen-compat        |       5 |           5 |       0 |                0 |      1 |
| **TOTAL**         | **188** |     **102** |  **86** |           **33** | **29** |

"Simple path" = the getter is a single optional-chained property read.
**46% of all fields have no single path**, and for `pen` it is 85%.

The derived ones are not edge cases. The first six on `tablet` are `FullName`,
`NameAndModelId`, `AlternateNames`, `LinkCount`, `Age`, `AgeInDays` — several of
which are the _most_ agent-useful fields on the entity. `AlternateNames` is what
name resolution needs; `FullName` is what a citation needs. **None of them exist
in the raw JSON at any path.**

### Options

|       | Approach                                        | Coverage | Cost                                                             |
| ----- | ----------------------------------------------- | -------: | ---------------------------------------------------------------- |
| **A** | Publish a flat projection keyed by FieldDef key |     100% | A second representation; all values are strings                  |
| **B** | Add `path` to each catalogue entry              |      54% | One string per field; agent handles a mixed model                |
| **C** | Do nothing                                      |        — | Agent infers the mapping, and cannot reach derived fields at all |

### Recommendation: A

B was the intuitive answer before the numbers. It does not survive them — it
covers barely half the fields, and the half it misses includes the ones an agent
most wants. It also leaves the agent handling two kinds of field, which is worse
than handling one unfamiliar kind.

A works because `getValue()` is defined for **every** field, derived included.
Emitting it per record produces one uniform representation whose keys are
exactly the catalogue's keys. The derived fields stop being a problem and become
the argument.

### Open sub-questions for that discussion

1. **Everything becomes a string.** `FieldDef.getValue` returns `string` by
   contract, so a flat file gives `"3840"`, not `3840`. The catalogue's `type`
   tells an agent how to coerce, and the raw JSON is still there for anyone who
   wants native types — but it should be a deliberate choice, not a surprise.
2. **Size.** 375 tablets x 81 fields. Worth measuring before committing; may
   argue for flat files per entity rather than one combined file.
3. **Drift.** Two representations that must agree is the risk "project, never
   restate" exists to avoid. Mitigated by generating both from the same source in
   one build step, and never hand-editing either.
4. **Scope.** All 11 entities, or only the ones agents actually query — tablet,
   pen, pen-compat?
5. **Naming.** `all-tablets-flat.json`? A `flat/` directory? This becomes a
   published contract, so the name outlives the decision.

## WebMCP pilot — tablet specs

The in-app **About → Agents** page (`/about/agents`) lists the available tools,
example inputs and query options for humans and agents. Keep its brief reference
aligned with the tools registered in `src/lib/webmcp/register.ts`.

The Explorer exposes `lookup_tablet_specs` (read-only data for chat) and
`open_tablet_specs` (show specs in the browser), plus `compare_tablet_sizes`
(visual size comparison), and the query tools below, in browsers that implement
`document.modelContext.registerTool`. All are registered from the root layout
and use the session's existing dataset, loading tablets only when
called. No server, polyfill or new dependency is needed. Unsupported browsers
continue to use the normal UI.

| Input / result                  | Behavior                                                                                 |
| ------------------------------- | ---------------------------------------------------------------------------------------- |
| `{ "query": "Wacom CTL-4100" }` | Look up a name, alternate name, model ID or EntityId                                     |
| `found`                         | Identity, entity URL, labeled specs, units, derived-value markers and dataset provenance |
| `ambiguous`                     | Up to 10 candidates plus total count; retry with an exact EntityId                       |
| `not_found`                     | The loaded dataset has no match                                                          |
| `invalid_input` / `unavailable` | Invalid arguments or a loading failure; never evidence that a product does not exist     |

Values are projected from `TABLET_FIELDS` in canonical units (the `unit` property
or units in the label), independent of the UI's unit preference. Numeric fields
return numbers when possible. `YES`/`NO` remain strings; missing and inapplicable
values are null with distinct status values. Lookup does not navigate, change
filters, or modify the working comparison.

`open_tablet_specs` accepts the same input and resolves the same candidates.
For a unique match it navigates directly to `/entity/<EntityId>#specs` using
the app router; the existing URL hash selects the Specs tab without a click.
It returns `opened` only after navigation completes, or `navigation_failed`
with the destination URL if navigation rejects. Invalid input, ambiguity,
missing matches and unavailable data leave the current page alone. Unlike the
lookup, its annotation is not read-only because it changes the visible page.

Implementation: `src/lib/webmcp/tablet-specs.ts`, `open-tablet-specs.ts` and `register.ts`. Registration
is feature-detected, failures are contained, and the registration is removed
with an AbortSignal when the layout is torn down.

To try it, run `npm run dev`, open the local Explorer in a browser/agent with
WebMCP support, and ask: **“Use the Explorer to look up the specs for Wacom
CTL-4100 in chat.”** For navigation, ask **“Show the Wacom PTH660 specs in the
browser.”** Inspect the browser's site tools for the tools above. Try
“Cintiq” to exercise disambiguation. This is page-based access; static data
access and conventional MCP connectors remain separate options for agents
without a supported browser.

### Visual size comparison

Ask **“Compare the sizes of the PTH660 and PTK670 in the browser.”** The
`compare_tablet_sizes` tool accepts `{ "tablets": ["PTH660", "PTK670"] }`
(2–8 names, model IDs or EntityIds). It replaces the working tablet comparison
with exactly the requested models, one per column in request order, and opens
`/compare/tablets#sizes` directly. The existing Sizes view shows active drawing
area outlines and diagonal sizes; these are not the tablets' outer dimensions.

All names must resolve uniquely to distinct models with usable active-area
width and height before navigation. `needs_resolution` returns a result per
query so the agent can resolve every ambiguous or missing name and retry the
full request. Invalid input, unavailable data, `missing_dimensions` and failed
navigation leave the working comparison unchanged. Flags and the pen comparison
are unaffected. The comparison is replaced only after navigation succeeds.

Implementation: `src/lib/webmcp/compare-tablet-sizes.ts`, using the existing
`startWith` comparison operation and the tablet comparison store. No UI clicks
or separate chart implementation are needed.

API reference: [WebMCP imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api).

### Simple tablet queries

Ask **“Which pen displays were released in 2026?”** The `query_tablets` tool
accepts `{ "tabletType": "PENDISPLAY", "releaseYear": 2026 }`. Type and year
filters are optional when ranking by area; at least one filter or `sortBy` is
required. Unsupported fields are rejected rather than ignored.

| Tool                | Behavior                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------- |
| `query_tablets`     | Read-only: returns every match, count, applied filters, source provenance and a filtered-list URL |
| `open_tablet_query` | Returns the same results and opens the regular Tablets list with editable filters and sorting     |

Filters are ANDed through `buildActiveSteps` and queriton's `executePipeline`,
using `TABLET_FIELDS`, exactly like the regular list. `ModelReleaseYear` is the
recorded release-year field. No implicit five-row limit is applied. A successful
zero-match result is distinct from unavailable data. Results describe the
Explorer's dataset, not a guarantee that its catalog covers every product.

Ask **“What are the largest pen tablets?”** with
`{ "tabletType": "PENTABLET", "sortBy": "activeArea" }`. Area ranking defaults
to descending; `sortDirection: "asc"` gives smallest first. It uses the existing
`DigitizerActiveAreaMm2` field (width × height), not diagonal or outer body size.
The ranking excludes missing/nonpositive area with a visible `> 0` filter and
reports the excluded count. It includes historical/discontinued models and
returns status and dimensions so answers can make that scope clear. Every
ranked match is returned; an agent may summarize the leaders in chat.

Ranked browser links carry `sort` and `column` parameters so the same ordering
opens with dimensions, area, year and model status visible. These are ordinary,
editable list controls; following another query or using Back restores them.

These queries use the regular list's filters and sorting. The advanced Query Builder's
grouping, aggregations and other pipeline operations remain a separate future
WebMCP surface. Navigating to a filter URL on an already-open list reapplies the
URL filters, sorting and columns and clears temporary search, quick filters and selection so stale
UI state cannot silently narrow the requested result.

Implementation: `src/lib/webmcp/query-tablets.ts`, with the shared encoder in
`src/lib/filter-url.ts` and URL navigation handling in `EntityExplorer.svelte`.
