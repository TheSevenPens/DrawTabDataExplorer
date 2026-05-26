# Pressure interpolation (P00, P100, intermediate Pₙₙ)

**Audience:** contributors. How the IAF / Max-Pressure estimates that power every pressure-response chart are computed from raw `[physicalGf, logicalPct]` records.

All logic lives in [`data-repo/lib/pressure/interpolate.ts`](../data-repo/lib/pressure/interpolate.ts); tests pin every edge case in [`data-repo/lib/pressure/pressure.test.ts`](../data-repo/lib/pressure/pressure.test.ts).

## Inputs

Each pressure-response **session** carries a `Records: [physicalGf, logicalPct][]` array, with `physicalGf` in gram-force and `logicalPct` in 0–100. The schema is in [`data-repo/lib/schemas.ts`](../data-repo/lib/schemas.ts) (`PressureResponseSchema`).

Captured records are **sparse and noisy** — typical sessions land 20–80 monotonically-increasing points between roughly 5 % and 95 %. The interpolation/extrapolation layer fills in the rest.

## Three functions

| Function                | Range               | Method                                       | Returns `null` when                                               |
| ----------------------- | ------------------- | -------------------------------------------- | ----------------------------------------------------------------- |
| `interpolatePhysical()` | inside record range | linear between pairs                         | target ∉ `[y_first, y_last]`, or `n < 2`                          |
| `estimateP00()`         | below `y_first`     | bracket midpoint **or** spring-decay back    | no usable bracket and `n < 2` / degenerate slopes                 |
| `estimateP100()`        | above `y_last`      | bracket midpoint **or** spring-decay forward | no usable bracket and `n < 2` / extrapolation exceeds `4 · xLast` |

`interpolatePhysical` is also reused for every middle percentile (P01, P05, …, P99) the legend table renders — same linear walk, different target.

## `interpolatePhysical(records, targetLogical)`

Walks adjacent pairs `(x0,y0), (x1,y1)` and returns the first segment where `y0 ≤ target ≤ y1`. Uses standard linear interpolation:

```
x = x0 + (target − y0) · (x1 − x0) / (y1 − y0)
```

If `y1 === y0` (flat segment), returns `x0`. If no segment brackets the target, returns `null` — callers (the chart, the legend table) render this as `—`.

## Spring-decay model (P00 and P100)

When the records don't span all the way down to 0 % or up to 100 %, the endpoints are **extrapolated**, not invented. The model imagines a ball rolling along the curve whose velocity decays in proportion to its remaining distance from the boundary:

```
dy/dx = k · y         (near 0 % — for P00, x decreasing)
dy/dx = k · (100 − y)  (near 100 % — for P100, x increasing)
```

Both ODEs have exponential solutions. P00 is the `x` where `y` drops below the threshold `THRESHOLD = 0.5 %`; P100 is the `x` where `100 − y` drops below the same threshold.

The decay rate `k` is fitted from the **first / last N slopes** in the record sequence, weighted exponentially toward the most-recent measurement.

## `estimateP00(records)` — Initial Activation Force

Two-branch algorithm. The bracket branch is preferred when the data supports it; the spring-decay branch is the fallback.

### Branch 1 — bracket midpoint

Sessions that explicitly captured the activation transition contain records on **both sides of activation**: some samples at 0 % logical pressure, some non-zero. In that case the midpoint of the bracket is the best honest estimate without finer sampling.

1. Scan all records:
   - `A = max(x)` over records where `y ≤ 0` (highest force the pen still failed to register)
   - `B = min(x)` over records where `y > 0` (lowest force where the pen _did_ register)
2. If both exist **and** `A < B`, return `(A + B) / 2`.

This branch supersedes the old `records[0][1] ≤ 0 → return records[0][0]` short-circuit, which was buggy for sessions with multiple zero-pressure samples (it returned the first zero, not the last — see WAP.0037 on 2026-05-26 where 9 samples sat at 0 % up to 9.2 gf before activation around 9.4 gf).

Inputs are **not assumed sorted**; the scan finds max-A / min-B across all records.

### Branch 2 — spring-decay extrapolation (fallback)

Used when there's no clean 0 %→non-0 % bracket (e.g. the curve already starts at 30 %):

1. **Short-circuits**:
   - `records.length < 2` → `null`
   - `yFirst ≤ THRESHOLD` (0.5 %) → `xFirst` (close enough to activation that the first sample IS P00)

2. **Compute slopes** for every adjacent pair with `x1 > x0` (skips ties to avoid division by zero).

3. **Weight the first `N_SLOPES = 4` slopes** by exponential recency. For P00 the _earliest_ slopes are the _most recent_ in the backward-rolling frame, so they're reversed before weighting:

   ```
   weights = [2⁰, 2¹, 2², 2³]   // index 0 = oldest, N-1 = newest
   v_eff   = Σ slope_i · weight_i / Σ weight_i
   ```

   This biases the fit toward the slope of the segment closest to `xFirst`.

4. **Solve** for the spring-model rate and target:

   ```
   k    = v_eff / yFirst
   p00  = xFirst + ln(THRESHOLD / yFirst) / k
   ```

5. **Clamp** the result: `p00 < 0` → `0`; `p00 ≥ xFirst` → `xFirst`. Returns `null` if `v_eff <= 0` (curve was flat/decreasing at the bottom — no good fit).

### All-zero edge case

When every record sits at `y ≤ 0` (the pen never activated within the tested force range), `B` doesn't exist, and the spring-decay branch sees only zero-slope data → returns `null`. This is intentional: we can say "P00 is above max(x)" but can't say _how_ far above, so reporting `—` is more honest than picking an arbitrary point.

## `estimateP100(records)` — Maximum Force

Mirror of P00: bracket-midpoint when the session captured saturation explicitly, spring-decay forward otherwise.

### Branch 1 — bracket midpoint

A session whose pen reached saturation contains records on **both sides**: some below 100 % and some at ≥ 100 %. The midpoint is the best honest estimate.

1. Scan all records:
   - `C = max(x)` over records where `y < 100` (highest force the pen still hadn't saturated)
   - `D = min(x)` over records where `y ≥ 100` (lowest force the pen reported as saturated)
2. If both exist **and** `C < D`, return `(C + D) / 2`.
3. **Saturated-only fallback**: if `C` doesn't exist (every record is already ≥ 100 %), return `D`. Preserves the pre-bracket-logic behaviour for sessions whose first sample is already saturated.

Inputs are **not assumed sorted** — the scan finds max-C / min-D across all records.

### Branch 2 — spring-decay extrapolation (fallback)

Used when there's no clean sub-100 % → ≥ 100 % bracket (e.g. the curve stops at 80 %):

1. Compute slopes; weight the **last** `N_SLOPES` (no reverse — last entry already is "newest").
2. Spring decay on the remaining gap `r = 100 − yLast`:

   ```
   k     = v_eff / r
   p100  = xLast + ln(r / THRESHOLD) / k
   ```

3. **Clamp**: `p100 ≤ xLast` → `xLast`; `p100 > 4 · xLast` → `null` (treat as "no useful estimate" rather than printing a wild value).

The `4 · xLast` ceiling is the only ad-hoc cap; it kicks in when the curve is nearly flat at the top, which would otherwise produce a "P100 is at infinity" result. The corresponding test in [`pressure.test.ts`](../data-repo/lib/pressure/pressure.test.ts) pins this.

## Constants

| Constant    | Value | Where it bites                                                                             |
| ----------- | ----- | ------------------------------------------------------------------------------------------ |
| `N_SLOPES`  | `4`   | Number of slopes averaged when fitting `v_eff`. Smaller = noisier fits; larger = more lag. |
| `THRESHOLD` | `0.5` | Logical-pressure cutoff (in %) used as the activation/saturation boundary.                 |

Both are file-local constants — change them only with new tests demonstrating the effect on representative sessions.

## Format helper

`fmtP(val)` renders a force value (or `null`) for tables:

- `null` → `"—"` (em-dash sentinel)
- otherwise `val.toFixed(1)` (always 1 decimal place, even for integers — matches the existing data files' style)

## Where it's called

| Surface                            | Function                     | File                                                                                                                                                 |
| ---------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Per-session **IAF tab** table      | `estimateP00`                | [`src/lib/components/IafTab.svelte`](../src/lib/components/IafTab.svelte)                                                                            |
| Per-session **Max Pressure** table | `estimateP100`               | [`src/lib/components/MaxPressureTab.svelte`](../src/lib/components/MaxPressureTab.svelte)                                                            |
| Pressure-response legend (P-cols)  | all three                    | [`src/lib/components/PressureResponseChartLegendTable.svelte`](../src/lib/components/PressureResponseChartLegendTable.svelte)                        |
| **Pen Analysis** distributions     | `estimateP00`/`estimateP100` | [`src/routes/pen-analysis/+page.svelte`](../src/routes/pen-analysis/+page.svelte)                                                                    |
| Pressure-response field defs       | both extrapolators           | [`data-repo/lib/entities/pressure-response-fields.ts`](../data-repo/lib/entities/pressure-response-fields.ts) (`IAF`, `MaxPressure` computed fields) |

All these paths share the **same single source of truth** in `interpolate.ts`. Tweak math there, not at the call site.

## When records aren't suitable for extrapolation

Two real-world failure modes worth knowing:

- **Missing low end** — a session that starts at `y_first = 30 %` extrapolates to a P00 that's still well above 0 gf, but with low confidence. The data-quality CLI (`findMissingLowEnd`) flags sessions whose first sample is far from 0 %.
- **Non-monotonic curves** — a session where pressure briefly _drops_ (noise, lifted pen) breaks the linear-walk assumption in `interpolatePhysical`. `findNonMonotonicSessions` reports these.

Both checks live in [`data-repo/lib/pressure/data-quality.ts`](../data-repo/lib/pressure/data-quality.ts).
