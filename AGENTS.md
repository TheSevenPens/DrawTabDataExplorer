# Agent guide — DrawTabDataExplorer

**Audience:** AI coding agents and contributors automating work in this repo.

**Rule of precedence:** [`CLAUDE.md`](CLAUDE.md) wins on constraints and gotchas. This file routes you to the right docs; it does not duplicate full rule lists.

## Repo map

| Path                 | What it is                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------ |
| `src/`               | SvelteKit app (routes, components)                                                         |
| `data-repo/`         | Git submodule → [DrawTabData](https://github.com/TheSevenPens/DrawTabData) (JSON + TS lib) |
| `packages/queriton/` | Workspace package — query/pipeline engine used by the UI                                   |
| `static/`            | Junctions → `data-repo/data/*` (created by `npm run setup-static`)                         |
| `docs/`              | Explorer docs (architecture, manual, planning index)                                       |
| `data-repo/docs/`    | Dataset & library docs (schemas, importing, defects)                                       |

## Read order by task

| Task                     | Read first                                       | Then                                           |
| ------------------------ | ------------------------------------------------ | ---------------------------------------------- |
| Any change               | This file + `CLAUDE.md`                          | [`docs/WHERE.md`](docs/WHERE.md)               |
| UI / routes / components | `CLAUDE.md` § Data loading, Svelte 5             | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| Step-by-step workflows   | [`docs/RECIPES.md`](docs/RECIPES.md)             | Files listed in recipe                         |
| Data shape / validation  | `data-repo/docs/ARCHITECTURE.md`                 | `data-repo/lib/schemas.ts`, `FIELDS.txt`       |
| Add tablet / pen JSON    | `data-repo/docs/IMPORTING-TABLETS.md`            | `CLAUDE.md` § Adding a brand                   |
| Pressure / charts        | `CLAUDE.md` § Pressure response                  | `PressureChart.svelte`                         |
| Tests / verify           | [`docs/TESTING.md`](docs/TESTING.md)             | Run commands below                             |
| Planned work             | [`docs/FUTURES.txt`](docs/FUTURES.txt)           | GitHub issue bodies                            |
| Don'ts (quick scan)      | [`docs/ANTI-PATTERNS.md`](docs/ANTI-PATTERNS.md) | `CLAUDE.md` for detail                         |

## Doc roles (what to load)

| File                                             | Audience      | Agents should                                     |
| ------------------------------------------------ | ------------- | ------------------------------------------------- |
| [`AGENTS.md`](AGENTS.md)                         | Agents        | Start here                                        |
| [`CLAUDE.md`](CLAUDE.md)                         | Agents / devs | Always follow rules                               |
| [`docs/WHERE.md`](docs/WHERE.md)                 | Agents        | Lookup “change X → files”                         |
| [`docs/RECIPES.md`](docs/RECIPES.md)             | Agents        | Common workflows                                  |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)   | Devs          | Reference (components, routes)                    |
| [`docs/ANTI-PATTERNS.md`](docs/ANTI-PATTERNS.md) | Agents        | Reject bad approaches fast                        |
| [`docs/TESTING.md`](docs/TESTING.md)             | Agents / devs | Verification commands                             |
| [`docs/DOC-STYLE.md`](docs/DOC-STYLE.md)         | Doc authors   | Format new/edited docs                            |
| [`docs/FUTURES.txt`](docs/FUTURES.txt)           | All           | Issue IDs only — open issue for scope             |
| [`docs/FUTURE.md`](docs/FUTURE.md)               | Devs          | Design notes; skim when implementing that feature |
| [`docs/WORKSTREAMS.md`](docs/WORKSTREAMS.md)     | Humans        | Historical narrative; see “Active focus” at top   |
| [`docs/USERMANUAL.md`](docs/USERMANUAL.md)       | End users     | UX/copy only — not for code changes               |

## Commands

| Command                | When                                          |
| ---------------------- | --------------------------------------------- |
| `npm install`          | First clone; runs `setup-static`              |
| `npm run setup-static` | 404 on `/*.json` static data                  |
| `npm run dev`          | Local app                                     |
| `npm run check`        | After TS/Svelte edits                         |
| `npm run test:unit`    | After `src/lib/`, queriton, helpers           |
| `npm run test:e2e`     | After routes / major UI (slow; builds first)  |
| `npm run data-quality` | After `data-repo/data/` edits                 |
| `npm run verify-docs`  | After editing `docs/FUTURES.txt` Open section |
| `npm run lint`         | Before commit (CI runs this)                  |

Submodule: `git submodule update --init --recursive` if `data-repo/` is empty.

## Cursor / IDE rules

Project rules under [`.cursor/rules/`](.cursor/rules/) **link** to `CLAUDE.md` and this file — they are not a second copy of the rules.

## File-top `Agent note:` comments

Some high-traffic source files start with a short `Agent note:` comment pointing here or to `CLAUDE.md`. Prefer updating those comments over duplicating rules in architecture docs.

## data-repo documentation

When editing JSON or `data-repo/lib/`, also see:

- `data-repo/docs/OVERVIEW.txt` — layout and EntityIds
- `data-repo/docs/DATALAYOUT.txt` — file naming
- `data-repo/docs/IMPORTING-TABLETS.md` — add tablets
- `data-repo/docs/DEFECTS.md` — inventory defects vocabulary
- `data-repo/docs/ARCHITECTURE.md` — loaders, schemas, valibot

Primary UI consumer: this repo (`CLAUDE.md`, `docs/`).
