// Named boundary types for the generic table / export infrastructure
// (EntityExplorer, ResultsTable, ExportDialog). These components handle rows
// of *any* entity (tablets, pens, drivers, …), so the row type is genuinely
// heterogeneous at this boundary — but it should be named rather than a bare
// `any` scattered across files. See GitHub issue #221.

/** A heterogeneous entity row, keyed by field name. Concrete entity types
 * (Tablet, Pen, …) are assignable to this. */
export type RowRecord = Record<string, unknown>;

/** Builds the linked cells rendered for one column from a row. The parameter
 * is intentionally loose (`any`) so call sites can supply entity-typed builders
 * — e.g. `(t: Tablet) => …` — without contravariance friction. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CellLink = (item: any) => { label: string; href: string }[];

/** Map of field key → per-column link builder. */
export type CellLinks = Record<string, CellLink>;
