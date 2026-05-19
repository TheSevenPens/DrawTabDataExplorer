# queriton Tutorial

A narrative introduction to queriton, paired with the package's [README](../../README.md) reference. Read the chapters in order if you're new; jump to any individual chapter once you know the layout.

Every fenced ` ```ts run ` code block in the chapters is extracted into the test suite — what you see is what runs.

## Reading path

1. **[Getting Started](01-getting-started.md)** — install, your first Query, the Palmer Penguins dataset.
2. **[Transforming Queries](02-transforming-queries.md)** — filter, sort, select, take, skip; method chaining; lazy evaluation.
3. **[Deriving Columns](03-deriving-columns.md)** — `.derive()` for computed columns, `.unroll()` for arrays.
4. **[Grouping and Aggregation](04-grouping.md)** — `.countBy`, `.summarize`, HAVING-style filters, `countIf`.
5. **[Nulls and Empties](05-nulls-and-empties.md)** — the rules for missing values; where queriton diverges from SQL.
6. **[Joins](06-joins.md)** — inner / left / semi / anti — plus the null = null surprise.
7. **[Concat](07-concat.md)** — UNION ALL; combining Queries vertically.
8. **[The DataSet](08-the-dataset.md)** — the named-collection container.
9. **[FieldDef and FieldDisplayDef](09-field-defs.md)** — what's inside the `fields` array.
10. **[Tips](10-tips.md)** — common pitfalls, debugging, performance notes.

## Conventions

- `penguinsQ()`, `customersQ()`, `ordersQ()` are helper functions used in every example. They wrap the constructor so each example starts fresh. See chapter 1 for the actual definition.
- `expect(...)` calls inside snippets come from vitest — they show the actual value queriton produces so you can copy a snippet, change the inputs, and see the assertion break in a meaningful way.
- `>` blockquotes labelled **From SQL:** / **From dplyr:** offer cross-language analogues. Skip them if they don't help.

## Running the snippets locally

```bash
git clone https://github.com/TheSevenPens/DrawTabDataExplorer.git
cd DrawTabDataExplorer/packages/queriton
npm install
npm test
```

`npm test` regenerates `test/tutorial-snippets.generated.test.ts` from the markdown files, then runs the full vitest suite. If a snippet is out of date, the test fails with the assertion mismatch.
