# Dependency audit

**Audience:** agents and contributors · What `npm audit` reports, and why each remaining advisory is accepted.

Last reviewed **2026-09-24** (GitHub #336, from audit #328). Re-run `npm audit` after any dependency change and update this page.

## How to read an advisory here

This is a static site on GitHub Pages: no server, no SSR (`ssr = false`), no user uploads. An advisory matters when the vulnerable code **ships in `build/`** and can be fed attacker-controlled input there, or when it affects a developer's machine during `vite dev`. Severity in `npm audit` is the package's worst case, not ours.

Never run `npm audit fix --force` blindly: for this tree it proposes **downgrading** `pptxgenjs` to 2.2.0 and `@sveltejs/kit` to 0.0.30.

## Fixed in #336

`npm update` within existing ranges, then the direct packages' floors were raised to the patched versions: 15 advisories (7 high) → 5 (2 high, 3 low).

| Package                         | Now      | Advisory it closed                                                      |
| ------------------------------- | -------- | ----------------------------------------------------------------------- |
| `vite`                          | ^8.3.1   | `server.fs.deny` bypass on Windows paths; launch-editor NTLM leak (dev) |
| `vitest`, `@vitest/coverage-v8` | ^4.1.11  | mocker path traversal (dev)                                             |
| `@sveltejs/kit`                 | ^2.70.3  | remote-form prototype pollution / DoS, content-negotiation ReDoS        |
| `valibot`                       | ^1.5.0   | `record()` issue paths breaking `flatten()`                             |
| transitive                      | lockfile | `devalue`, `nanoid`, `postcss`, `undici`, `brace-expansion`, …          |

## Accepted (not reachable)

| Advisory                                                               | Via                             | Why it is accepted                                                                                                                                                                                                                                                                     | Revisit when                              |
| ---------------------------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `image-size` ≤2.0.2 — DoS parsing crafted ICNS / JXL / HEIF (high ×2)  | `pptxgenjs@4.0.1` pins `^1.2.1` | Not in the shipped bundle: pptxgenjs reaches it only through a Node-only `require`, and `build/_app` contains no image-size code. The app only ever hands pptxgenjs its own chart PNGs. 4.0.1 is the latest pptxgenjs; an `overrides` to image-size 2.x would change the API under it. | pptxgenjs releases with image-size ≥2.0.3 |
| `cookie` <0.7.0 — out-of-bounds chars in name / path / domain (low ×3) | `@sveltejs/kit` pins `^0.6.0`   | Server-side cookie serialisation. There is no server; the client bundle contains no `cookie` code. Overriding a framework pin is riskier than the advisory.                                                                                                                            | SvelteKit bumps its `cookie` range        |

## Deliberately not upgraded

- **`@playwright/test` stays 1.59.x.** No advisory. A newer version needs a matching browser download (`npx playwright install`) on every dev machine; CI installs browsers per run, so bump it in its own change.
- **Majors** (`vitest` 5, `typescript` 7, `prettier-plugin-svelte` 4, `@types/node` 26) are feature upgrades, not security fixes — separate PRs with their own verification.
- **Submodules** were refreshed in the same change: `data-repo` (not a workspace — it has its own lockfile, and when installed locally Vite resolves its `node_modules` first, so a stale copy there made local builds use an older `valibot` than CI) and `packages/queriton` (a workspace; its own lockfile is for standalone use). Both report 0 vulnerabilities.
