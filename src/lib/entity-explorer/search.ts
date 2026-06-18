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

/** Keep rows where any of `searchDefs` has a value containing `query`
 * (case-insensitive). Blank query is a no-op. */
export function applyTextSearch<T>(
	rows: T[],
	query: string,
	searchDefs: AnyFieldDisplayDef[],
): T[] {
	const q = query.trim().toLowerCase();
	if (!q) return rows;
	return rows.filter((row) =>
		searchDefs.some((f) => {
			const val = f.getValue(row);
			return val != null && String(val).toLowerCase().includes(q);
		}),
	);
}
