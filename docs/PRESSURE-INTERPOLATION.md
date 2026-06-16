# Pressure interpolation (Piaf, Pmax, intermediate Pₙₙ)

**Audience:** contributors. How the Piaf (Initial Activation Force, formerly P00/IAF) / Pmax (Maximum Force, formerly P100/Max Pressure) estimates that power every pressure-response chart are computed from raw `[physicalGf, logicalPct]` records.

All logic lives in [`data-repo/lib/pressure/interpolate.ts`](../data-repo/lib/pressure/interpolate.ts); tests pin every edge case in [`data-repo/lib/pressure/pressure.test.ts`](../data-repo/lib/pressure/pressure.test.ts).

## Inputs

Each pressure-response **session** carries a `Records: [physicalGf, logicalPct][]` array, with `physicalGf` in gram-force and `logicalPct` in 0–100. The schema is in [`data-repo/lib/schemas.ts`](../data-repo/lib/schemas.ts) (`PressureResponseSchema`).

Captured records are **sparse and noisy** — typical sessions land 20–80 monotonically-increasing points between roughly 5 % and 95 %. To estimate the endpoints honestly, sessions are expected to include explicit 0 %-logical and 100 %-logical samples wherever the activation / saturation transition can plausibly be inferred; sessions without them fall through to `null`.

## Three functions

| Function                | Range               | Method                        | Returns `null` when                                                |
| ----------------------- | ------------------- | ----------------------------- | ------------------------------------------------------------------ |
| `interpolatePhysical()` | inside record range | linear between pairs          | target ∉ `[y_first, y_last]`, or `n < 2`                           |
| `estimatePiaf()`        | activation boundary | bracket midpoint              | no record at `y ≤ 0` (the activation transition wasn't captured)   |
| `estimatePmax()`        | saturation boundary | bracket midpoint (+ fallback) | no record at `y ≥ 100` (the saturation transition wasn't captured) |

`interpolatePhysical` is also reused for every middle percentile (P01, P05, …, P99) the legend table renders — same linear walk, different target.

## `interpolatePhysical(records, targetLogical)`

Walks adjacent pairs `(x0,y0), (x1,y1)` and returns the first segment where `y0 ≤ target ≤ y1`. Uses standard linear interpolation:

```
x = x0 + (target − y0) · (x1 − x0) / (y1 − y0)
```

If `y1 === y0` (flat segment), returns `x0`. If no segment brackets the target, returns `null` — callers (the chart, the legend table) render this as `—`.

## `estimatePiaf(records)` — Piaf (Initial Activation Force)

**Bracket midpoint.** Sessions that explicitly captured the activation transition contain records on **both sides of activation**: some samples at 0 % logical pressure, some non-zero. The midpoint of the bracket is the best honest estimate without finer sampling.

1. Scan all records:
   - `A = max(x)` over records where `y ≤ 0` (highest force the pen still failed to register)
   - `B = min(x)` over records where `y > 0` (lowest force where the pen _did_ register)
2. If both exist **and** `A < B`, return `(A + B) / 2`.
3. Otherwise return `null`.

Inputs are **not assumed sorted**; the scan finds max-A / min-B across all records.

### Why no extrapolation

Prior to [#212](https://github.com/TheSevenPens/DrawTabDataExplorer/issues/212) this function had a spring-decay extrapolation branch that fit an exponential to the first few slopes and projected backward to the activation boundary. It was the chosen path for ~83 % of sessions, but the math was not trusted enough to claim an estimate where the session never captured the transition. The branch was removed once the dataset was backfilled with explicit `(force, 0)` samples on every session where the activation force could plausibly be inferred (see [`scripts/apply-pressure-backfill.mjs`](../scripts/apply-pressure-backfill.mjs)). Sessions that genuinely can't be backfilled now report `—`.

## `estimatePmax(records)` — Pmax (Maximum Force)

Mirror of Piaf.

**Bracket midpoint.** A session whose pen reached saturation contains records on **both sides**: some below 100 % and some at ≥ 100 %.

1. Scan all records:
   - `C = max(x)` over records where `y < 100` (highest force the pen still hadn't saturated)
   - `D = min(x)` over records where `y ≥ 100` (lowest force the pen reported as saturated)
2. If both exist **and** `C < D`, return `(C + D) / 2`.

**Saturated-only fallback.** If `C` doesn't exist (every record is already at `y ≥ 100`), return `D` — the lowest-force record. Preserves the pre-bracket-logic behaviour for sessions whose first sample is already saturated.

Otherwise returns `null`. (Like Piaf, the spring-decay forward-extrapolation that previously filled the gap was removed in [#212](https://github.com/TheSevenPens/DrawTabDataExplorer/issues/212).)

Inputs are **not assumed sorted** — the scan finds max-C / min-D across all records.

## Format helper

`fmtP(val)` renders a force value (or `null`) for tables:

- `null` → `"—"` (em-dash sentinel)
- otherwise `val.toFixed(1)` (always 1 decimal place, even for integers — matches the existing data files' style)

## Where it's called

| Surface                           | Function                      | File                                                                                                                                                                                 |
| --------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Per-session **Piaf tab** table    | `estimatePiaf`                | [`src/lib/components/PiafTab.svelte`](../src/lib/components/PiafTab.svelte)                                                                                                          |
| Per-session **Pmax** table        | `estimatePmax`                | [`src/lib/components/PmaxTab.svelte`](../src/lib/components/PmaxTab.svelte)                                                                                                          |
| Pressure-response legend (P-cols) | all three                     | [`src/lib/components/PressureResponseChartLegendTable.svelte`](../src/lib/components/PressureResponseChartLegendTable.svelte)                                                        |
| **Pen Analysis** distributions    | `estimatePiaf`/`estimatePmax` | [`src/routes/pen-analysis/+page.svelte`](../src/routes/pen-analysis/+page.svelte)                                                                                                    |
| Pressure-response field defs      | both estimators               | [`data-repo/lib/entities/pressure-response-fields.ts`](../data-repo/lib/entities/pressure-response-fields.ts) (`Piaf`, `Pmax` computed fields)                                       |
| Backfill dev tool                 | bracket math inline           | [`src/routes/pressure-backfill/+page.svelte`](../src/routes/pressure-backfill/+page.svelte) (lets contributors add `(force, 0)` / `(force, 100)` samples to sessions that lack them) |

All these paths share the **same single source of truth** in `interpolate.ts`. Tweak math there, not at the call site.

## When sessions can't produce an estimate

- **Missing endpoint** — when a session doesn't capture the activation (`y ≤ 0`) or saturation (`y ≥ 100`) transition, the estimator returns `null` and the surface renders `—`. To fix one of these sessions, open the [`/pressure-backfill`](../src/routes/pressure-backfill/+page.svelte) dev route, click through to the session, drag the slider to a plausible endpoint force, and run [`scripts/apply-pressure-backfill.mjs`](../scripts/apply-pressure-backfill.mjs) to splice the new record into the brand JSON.
- **Non-monotonic curves** — a session where pressure briefly _drops_ (noise, lifted pen) breaks the linear-walk assumption in `interpolatePhysical`. [`findNonMonotonicSessions`](../data-repo/lib/pressure/data-quality.ts) reports these.

Both checks live in [`data-repo/lib/pressure/data-quality.ts`](../data-repo/lib/pressure/data-quality.ts).
