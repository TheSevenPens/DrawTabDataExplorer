# Recipes

**Audience:** agents · Numbered workflows with verification steps. File paths: [WHERE.md](WHERE.md).

## 1. First-time dev environment

1. `git clone --recurse-submodules <repo-url>`
2. `cd DrawTabDataExplorer && npm install`
3. If lists are empty or JSON 404: `git submodule update --init --recursive && npm run setup-static`
4. `npm run dev`

**Verify:** open `/tablets` — table loads with rows.

## 2. Add a minimal entity list route

1. Add field defs in `data-repo/lib/entities/` if new entity type.
2. Ensure `DrawTabDataSet` exposes collection (see `data-repo/lib/dataset.ts`).
3. `src/routes/<name>/+page.ts`:

```ts
export async function load({ parent }) {
	const { ds } = await parent();
	const items = await ds.<Collection>.toArray();
	return { items };
}
```

4. `+page.svelte`: `Nav` + optional `SubNav` + `EntityExplorer` with `*_FIELDS`, `detailBasePath="/entity"`.

**Verify:** `npm run check`, open `/<name>` in browser.

## 3. Bump the data-repo submodule

1. `cd data-repo && git pull origin master` (or commit your data changes there first).
2. `cd .. && git add data-repo && git commit -m "chore: update data-repo submodule"`

**Verify:** `npm run data-quality` — no new issues from your edits.

## 4. Add a tablet to the dataset

1. Follow `data-repo/docs/IMPORTING-TABLETS.md`.
2. `npm run find-or-add-pen` / `npm run add-tablet` as documented in data-repo.
3. Update `data-repo/data/pen-compat/` if needed.
4. Bump submodule pointer in Explorer if applicable.

**Verify:** `npm run data-quality`, open `/entity/<new-entity-id>`.

## 5. Debug empty lists or JSON 404

1. Confirm submodule: `git submodule status`
2. `npm run setup-static`
3. Dev server log: look for `[404] GET /tablets/...json`
4. Confirm file exists under `data-repo/data/tablets/`

**Verify:** network tab returns 200 for brand JSON.

## 6. Add a computed tablet field (UI-visible)

1. Add to Valibot schema in `data-repo/lib/schemas.ts` if stored.
2. Add `FieldDef` in `data-repo/lib/entities/tablet-fields.ts` (getter or `computed`).
3. Optionally add to `TABLET_DEFAULT_COLUMNS`.

**Verify:** `npm run check`, column appears on `/tablets`, filter/sort if `filterable`/`sortable`.

## 7. Change pressure chart behavior

1. Read `CLAUDE.md` § Pressure response charts first.
2. Edit `src/lib/components/PressureChart.svelte`.
3. Check `PenDetail`, `PenFamilyDetail`, `SessionDetail`, `/pressure-response`.

**Verify:** `npm run check`, manual check on a pen with sessions; `npm run test:unit` if touching `data-repo/lib/pressure/`.

## 8. Add a data-quality section (browser)

1. Add check logic in `data-repo/lib/` or `src/lib/data-quality/`.
2. Wire section in `src/routes/data-quality/+page.svelte` (or `src/lib/data-quality/` module).
3. Use `SectionedPage` pattern.

**Verify:** `npm run dev` → `/data-quality`; `npm run check`.

## 9. Before opening a PR

1. `npm run check`
2. `npm run test:unit`
3. If routes/UI: `npm run test:e2e` (optional but recommended)
4. If `data-repo/data/` changed: `npm run data-quality`
5. If `docs/FUTURES.txt` Open section changed: `npm run verify-docs`

See [TESTING.md](TESTING.md) for command details.
