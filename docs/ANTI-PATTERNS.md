# Anti-patterns

**Audience:** agents · Quick reject list. Details and rationale: [`CLAUDE.md`](../CLAUDE.md).

| Don't | Do instead |
|-------|------------|
| `onMount` + `fetch` for route data | `+page.ts` `load()` + `$props().data` |
| Reconstruct `` `${brandName(x)} ${name} (${id})` `` for labels | `penFullName`, `tabletFullName`, etc. via `$lib/*-helpers` |
| Import from `data-repo/lib/pipeline` | `import … from 'queriton'` |
| Edit JSON under `static/` | Edit `data-repo/data/`, run `npm run setup-static` |
| `prerender = true` on `/entity/[entityId]` loader | Keep `prerender = false` (SPA fallback) |
| `structuredClone()` on Svelte 5 proxies in views/pipeline | `JSON.parse(JSON.stringify(...))` for deep clone |
| Display fields on `PENTABLET` records | Schema forbids — only PENDISPLAY / STANDALONE |
| `{:else if asyncVar}` for new DOM branches after async load | `{:else}` + optional chaining inside |
| Trust HMR after many rapid edits | Full navigation / fresh tab |
| Load full docs for planning | `docs/FUTURES.txt` + GitHub issue |
| Read `WORKSTREAMS.md` for every task | Top “Active focus” + issues unless doing history |
| Duplicate `CLAUDE.md` into Cursor rules | Link via `.cursor/rules/` and `AGENTS.md` |
| Add rules only in architecture prose | Put must-follow rules in `CLAUDE.md` |

Audit scripts for naming drift:

```bash
node scripts/find-name-contains-id.mjs
node scripts/find-brand-in-name.mjs
```
