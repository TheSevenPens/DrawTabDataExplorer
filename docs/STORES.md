# Svelte stores

**Audience:** contributors and agents touching state, settings, or cross-page UI behaviour.
**Source of truth:** [src/lib/](../src/lib/) — every `*-store.ts` file. Each store below points back to its file.

The Explorer keeps cross-page state in four small Svelte stores. Each one is a singleton in module scope, hydrated from `localStorage` at module load (read once, then mutations write back). The data model (tablets/pens/sessions) is **not** stored here — that goes through the `DrawTabDataSet` constructed in `+layout.ts` and exposed via `await parent()` on every page.

## At a glance

| Store           | File                                                    | Persists to localStorage                                                                                                             | Drives                                                                                                                                                       |
| --------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `flagged-store` | [src/lib/flagged-store.ts](../src/lib/flagged-store.ts) | `drawtabdata-flagged-tablets`, `drawtabdata-flagged-pen-units`, `drawtabdata-flagged-pen-models`, `drawtabdata-flagged-pen-families` | The Tablets ▸ Compare sub-tab badge, the `/tablet-compare` page, the Pens ▸ Flagged sub-tab badge, the `/pen-flagged` overlay chart, the `/pen-compare` page |
| `theme-store`   | [src/lib/theme-store.ts](../src/lib/theme-store.ts)     | `drawtabdata-theme` (`'light'` \| `'dark'`)                                                                                          | The `data-theme` attribute on `<html>` (CSS variables flip)                                                                                                  |
| `unit-store`    | [src/lib/unit-store.ts](../src/lib/unit-store.ts)       | (via [data-repo/lib/units.ts](../data-repo/lib/units.ts)) + `drawtabdata-show-alt-units`                                             | Every dimension / weight / force formatter (metric ↔ imperial), the "show alt units in parens" toggle                                                        |
| `modal-store`   | [src/lib/modal-store.ts](../src/lib/modal-store.ts)     | Not persisted — in-memory request slot                                                                                               | `ModalRoot` (mounted once in the root layout); back-ends `promptModal()` and `confirmModal()` as awaitable functions                                         |

`storage.ts` ([src/lib/storage.ts](../src/lib/storage.ts)) wraps `localStorage` with SSR-safe getters / JSON helpers so each store can hydrate without `try/catch` around every read. Use those helpers in any new store rather than touching `localStorage` directly.

---

## `flagged-store`

Drives the comparison features. There are **four independent lists**, each with its own `localStorage` key and toggle function. They are independent so a user can flag at any granularity:

| Writable             | localStorage key                   | Cap | Toggle                        |
| -------------------- | ---------------------------------- | --- | ----------------------------- |
| `flaggedTablets`     | `drawtabdata-flagged-tablets`      | 6   | `toggleFlag(entityId)`        |
| `flaggedPenUnits`    | `drawtabdata-flagged-pen-units`    | —   | `toggleFlaggedPenUnit(invId)` |
| `flaggedPenModels`   | `drawtabdata-flagged-pen-models`   | —   | `toggleFlaggedPenModel(eid)`  |
| `flaggedPenFamilies` | `drawtabdata-flagged-pen-families` | —   | `toggleFlaggedPenFamily(eid)` |

The tablet cap is 6 because `/tablet-compare` renders SVG side-by-side outlines that become unreadable past that. The pen lists are uncapped because `/pen-flagged` aggregates pressure-response overlays where more is fine.

Derived stores (read-only) feed sub-nav badge counts:

- `flaggedCount` — tablet flag count
- `flaggedPenModelCount` — drives the `/pen-compare` sub-tab badge
- `flaggedPenTotalCount` — drives the Pens ▸ Flagged sub-tab badge (sum of all three pen sets)

Clear-all helpers: `clearFlags()` (tablets), `clearAllPenFlags()` (all three pen sets), `clearFlaggedPenModels()` (just pen models — mirrors the tablet-side scope).

The `FlagButton` component ([src/lib/components/FlagButton.svelte](../src/lib/components/FlagButton.svelte)) is the canonical UI; list pages embed it in the row's first column.

## `theme-store`

Single writable `theme: 'light' | 'dark'`, toggled by `toggleTheme()`. Persisted to `drawtabdata-theme`. Read by `+layout.svelte`, which sets a `data-theme` attribute on `<html>`; all colour variables are CSS custom properties that switch on that attribute.

The toggle UI lives in the gear-icon dropdown in `Nav`.

## `unit-store`

Two writables:

- `unitPreference: 'metric' | 'imperial'` — toggled by `toggleUnits()`. Persistence delegated to [data-repo/lib/units.ts](../data-repo/lib/units.ts)'s `loadUnitPreference()` / `saveUnitPreference()` (they own the key so the data-repo's own CLI tools can share it).
- `showAltUnits: boolean` — toggled by `toggleAltUnits()`. Persisted to `drawtabdata-show-alt-units`. When `true`, dimension formatters render "230 g (0.51 lbs)" instead of just "230 g".

Read by `DetailView`, `ValueHistogram`, and every `FieldDisplayDef` whose `unit` matches a known conversion (`gf`, `g`, `mm`, etc.) via [data-repo/lib/units.ts](../data-repo/lib/units.ts).

The toggle UI lives in the gear-icon dropdown in `Nav`.

## `modal-store`

Replaces `window.prompt()` / `window.confirm()` with styled, accessible Svelte modals. There is **one** request slot (`modalRequest: writable<ModalRequest | null>`); the `ModalRoot` component renders whichever request is currently set.

Two awaitable functions:

```ts
const name = await promptModal('Enter view name', defaultName); // → string | null
const ok = await confirmModal('Delete view?', 'This cannot be undone.'); // → boolean
```

Each sets the request slot with a `resolve` callback that `ModalRoot` invokes when the user confirms or cancels. The store is **not** persisted — modal requests are transient.

Both functions accept `{ confirmLabel, cancelLabel }` overrides; defaults are `'OK'` / `'Cancel'`.

---

## Patterns

- **One writable per concept.** Don't compose state inside a `derived` if a writable would do — the SSR-safe hydration is simpler.
- **`storage.ts` first.** New stores should use `getStorageJson` / `setStorageJson` / `getStorageItem` / `setStorageItem` from [src/lib/storage.ts](../src/lib/storage.ts) so they work under SvelteKit's `ssr = false` without `typeof window` guards.
- **Don't store loaded data.** The `DrawTabDataSet` cache is session-scoped and lives in `+layout.ts` — duplicating that into a store creates two sources of truth.
- **localStorage keys are namespaced.** Every key starts with `drawtabdata-` so they don't collide with anything else on the same origin (the user might also visit `PenPressureData` from the same browser).

See [ARCHITECTURE.md § Svelte 5 notes](ARCHITECTURE.md) for runes-vs-stores reasoning and [UXCOMPONENTS.md § ModalRoot](UXCOMPONENTS.md) for the modal portal entry point.
