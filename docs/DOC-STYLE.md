# Documentation style (agents & contributors)

**Audience:** anyone editing `docs/`, `CLAUDE.md`, or `AGENTS.md`.

## Format

- Prefer **tables and bullet lists** over long paragraphs for reference material.
- One main idea per `##` heading; keep heading text stable for deep links.
- Put **`Audience:`** on the first lines (`agents`, `contributors`, `end-users`).
- Keep agent entry docs (~`AGENTS.md`) under ~2 screens; link out for depth.
- Use **repo-root paths** in backticks: `src/routes/tablets/+page.ts`.
- Issue tracking: **`docs/FUTURES.txt`** lists `#NNN` only; design detail lives in GitHub issues.

## Roles (don't duplicate)

| Kind                 | Location           |
| -------------------- | ------------------ |
| Must-follow rules    | `CLAUDE.md`        |
| Routing / read order | `AGENTS.md`        |
| Goal → files         | `WHERE.md`         |
| Workflows            | `RECIPES.md`       |
| Component catalog    | `UXCOMPONENTS.md`  |
| Reject list          | `ANTI-PATTERNS.md` |

When adding a rule, update `CLAUDE.md` and optionally one line in `ANTI-PATTERNS.md` — not three full copies.

## When you change the codebase

- New route or shared component → update [WHERE.md](WHERE.md).
- New common workflow → add a recipe in [RECIPES.md](RECIPES.md).
- Closed GitHub issue → move `#NNN` from Open to Shipped in `FUTURES.txt`; run `npm run verify-docs`.

## Examples

Good audience line:

```markdown
# Some doc

**Audience:** agents · Short purpose sentence.
```

Good cross-link:

```markdown
Pressure chart rules: see [CLAUDE.md](../CLAUDE.md) § Pressure response charts.
```
