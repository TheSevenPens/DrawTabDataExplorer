# Anti-patterns

**Audience:** agents · Quick reject list. Details and rationale: [`CLAUDE.md`](../CLAUDE.md).

| Don't                                                          | Do instead                                                 |
| -------------------------------------------------------------- | ---------------------------------------------------------- |
| Hard-code a hex in a component                                 | A token from `+layout.svelte` (caused 6 dark-mode bugs)    |
| Restate `table` / `th` / `td` styles in a component            | `:global(table)` owns it — a local block breaks dark mode  |
| `--accent` for an error, or `--danger` for a chart series      | Status ≠ emphasis: `--good` / `--warning` / `--danger`     |
| `border-radius: 4px`, `box-shadow`, focus glow                 | `var(--radius)` (0), no shadow, accent-edge focus          |
| Delete the `.sr-only` h1 because the Nav says it               | Keep it — a nav link is not a heading                      |
| Lowercase a label in the DOM                                   | CSS `text-transform` — keeps "IAF"/"JSON" for a11y         |
| Eyeball a new `CHART_PALETTE` slot                             | Re-run the dataviz validator (`--pairs all`, both modes)   |
| Cycle chart colours (`i % len`)                                | Fixed slots; fold the tail into the neutral "other"        |
| A `PressureResponseChart` without its legend table             | Ship both — the palette's contrast relief depends on it    |
| A per-type/category hue next to a label saying the same thing  | Drop the hue, keep the word                                |
| `onMount` + `fetch` for route data                             | `+page.ts` `load()` + `$props().data`                      |
| Reconstruct `` `${brandName(x)} ${name} (${id})` `` for labels | `penFullName`, `tabletFullName`, etc. via `$lib/*-helpers` |
| Import from `data-repo/lib/pipeline`                           | `import … from '@thesevenpens/queriton'`                   |
| Edit JSON under `static/`                                      | Edit `data-repo/data/`, run `npm run setup-static`         |
| `prerender = true` on `/entity/[entityId]` loader              | Keep `prerender = false` (SPA fallback)                    |
| `structuredClone()` on Svelte 5 proxies in views/pipeline      | `JSON.parse(JSON.stringify(...))` for deep clone           |
| Display fields on `PENTABLET` records                          | Schema forbids — only PENDISPLAY / STANDALONE              |
| `{:else if asyncVar}` for new DOM branches after async load    | `{:else}` + optional chaining inside                       |
| Trust HMR after many rapid edits                               | Full navigation / fresh tab                                |
| Load full docs for planning                                    | `docs/FUTURES.txt` + GitHub issue                          |
| Read `WORKSTREAMS.md` for every task                           | Top “Active focus” + issues unless doing history           |
| Duplicate `CLAUDE.md` into Cursor rules                        | Link via `.cursor/rules/` and `AGENTS.md`                  |
| Add rules only in architecture prose                           | Put must-follow rules in `CLAUDE.md`                       |

Audit scripts for naming drift:

```bash
node scripts/find-name-contains-id.mjs
node scripts/find-brand-in-name.mjs
```
