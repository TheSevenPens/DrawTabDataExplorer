// Pure client-side row filters applied after the queriton pipeline in
// EntityExplorer: quick filters, the "owned only" toggle, and free-text
// search. Extracted so they're unit-testable without rendering Svelte
// (GitHub #219). Generic over the row type so callers keep their entity types.

import type { AnyFieldDisplayDef } from '@thesevenpens/queriton';

/** Keep rows matching every active quick filter (field key → exact value).
 * Entries with an empty value are ignored; unknown field keys pass through. */
export function applyQuickFilters<T>(
	rows: T[],
	quickFilters: Record<string, string>,
	fields: AnyFieldDisplayDef[],
): T[] {
	const active = Object.entries(quickFilters).filter(([, v]) => v !== '');
	if (active.length === 0) return rows;
	return rows.filter((row) =>
		active.every(([key, val]) => {
			const fd = fields.find((f) => f.key === key);
			if (!fd) return true;
			return String(fd.getValue(row) ?? '') === val;
		}),
	);
}

/** Keep rows whose `field` value parses to a number > 0 (the "owned only"
 * toggle, where the field is a counter — "0" / "" / non-numeric read as not
 * owned). A no-op when `field` is undefined. */
export function applyOwnedOnly<T>(rows: T[], field: AnyFieldDisplayDef | undefined): T[] {
	if (!field) return rows;
	return rows.filter((row) => {
		const n = Number(field.getValue(row));
		return Number.isFinite(n) && n > 0;
	});
}

/**
 * Free-text search over rows. **What you see is what you search:** a row
 * matches when the query appears in the text a column actually draws, and
 * the stored value behind it is matched too so ids keep working.
 *
 * `displayText` resolves the rendered string for a row/field pair — pass
 * `cellText` from $lib/cell-text.ts, which is the same resolution
 * `ResultsTable` renders with. Omit it and only stored values are searched,
 * which is what every caller did before GitHub #324 and is why typing
 * "XP-Pen" on /tablets matched nothing while every row on screen said
 * "XP-Pen".
 *
 * Both strings are tested, not one or the other: the rendered text is what
 * the reader can see, and the raw value is what they may have pasted from a
 * URL or an id column. Case-insensitive substring; blank query is a no-op.
 */
export function applyTextSearch<T>(
	rows: T[],
	query: string,
	searchDefs: AnyFieldDisplayDef[],
	displayText?: (row: T, field: AnyFieldDisplayDef) => string,
): T[] {
	const q = query.trim().toLowerCase();
	if (!q) return rows;
	const hit = (s: string | null | undefined) => s != null && String(s).toLowerCase().includes(q);
	return rows.filter((row) =>
		searchDefs.some(
			(f) => hit(f.getValue(row)) || (displayText ? hit(displayText(row, f)) : false),
		),
	);
}
