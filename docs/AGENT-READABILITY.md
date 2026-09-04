# Agent readability

**Audience:** agents & contributors · **Status:** proposed, none of it built.

Making the dataset usable by AI assistants that are **not** driving a browser.
Static output only — no runtime code, no new dependencies, nothing that can
break the running app.

## Why (measured, not theoretical)

An AI assistant was asked a simple question against the live site: *which
tablets support touch?* It took **ten round-trips**, and one of them was silently
wrong.

| What it had to do | Why |
| --- | --- |
| Read `performance.getEntriesByType('resource')` to find the JSON URLs | No index. There is no documented entry point to the data. |
| Hardcode a **guessed** list of 12 brand names | No manifest listing the data files. |
| Fetch a brand file and walk the object tree hunting for a touch field | No published schema. |
| Filter on `SupportsTouch === true` → **0 results, reported confidently** | The value is the string `"YES"`. |
| Re-inspect, find `"YES"`/`"NO"`, rerun | — |

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

`version.json` is already the right shape and already generated — it just needs
the file list. For each data file: entity type, URL, brand (where applicable),
record count.

Note the local `version.json` reports `tablets: 300` while the live site loads
**375**. Counts must be generated, never hand-maintained: a stale manifest is
worse than no manifest.

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

| Entity | Fields | Simple path | Derived | `computed: true` | Enum |
| --- | --: | --: | --: | --: | --: |
| tablet | 81 | 39 | **42** | 19 | 12 |
| pen | 26 | 4 | **22** | 3 | 2 |
| pressure-response | 15 | 9 | 6 | 5 | 3 |
| inventory-tablet | 12 | 10 | 2 | 0 | 2 |
| driver | 11 | 8 | 3 | 3 | 2 |
| pressure-range | 11 | 10 | 1 | 0 | 3 |
| inventory-pen | 9 | 7 | 2 | 0 | 2 |
| tablet-family | 7 | 3 | 4 | 0 | 1 |
| pen-family | 6 | 3 | 3 | 3 | 1 |
| brand | 5 | 4 | 1 | 0 | 0 |
| pen-compat | 5 | 5 | 0 | 0 | 1 |
| **TOTAL** | **188** | **102** | **86** | **33** | **29** |

"Simple path" = the getter is a single optional-chained property read.
**46% of all fields have no single path**, and for `pen` it is 85%.

The derived ones are not edge cases. The first six on `tablet` are `FullName`,
`NameAndModelId`, `AlternateNames`, `LinkCount`, `Age`, `AgeInDays` — several of
which are the *most* agent-useful fields on the entity. `AlternateNames` is what
name resolution needs; `FullName` is what a citation needs. **None of them exist
in the raw JSON at any path.**

### Options

| | Approach | Coverage | Cost |
| --- | --- | --: | --- |
| **A** | Publish a flat projection keyed by FieldDef key | 100% | A second representation; all values are strings |
| **B** | Add `path` to each catalogue entry | 54% | One string per field; agent handles a mixed model |
| **C** | Do nothing | — | Agent infers the mapping, and cannot reach derived fields at all |

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

## Not this

Live agent tooling (WebMCP and similar) was considered and set aside. It serves
only agents that pilot a browser, carries a dependency on an unstable proposal,
and needs runtime code in the app. Static files reach every agent, cannot break
the site, and are cacheable and crawlable. If live tooling is ever revisited,
these files are still the right foundation under it.
