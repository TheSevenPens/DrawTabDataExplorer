// Free-text matching rules shared by every search box that finds tablets or
// pens: EntityExplorer's search (via applyTextSearch) and the compare
// pickers. GitHub #327, field-aware "Option B".
//
// Two checks; a candidate matches when either passes:
//
// 1. Exact — the trimmed, lowercased query appears in the lowercased text.
//    Unchanged from before; applies to every searched field.
//
// 2. Separator-insensitive — people write model IDs with and without the
//    dash (PTK-1240 / PTK1240), so both sides are *stripped* and compared.
//    Only when:
//      - the query contains a letter (so 13.3 or 2015-11 stay exact), and
//      - the field is an identity field (IDs, names, aliases — see
//        IDENTITY_SEARCH_KEYS). Measurements and dates stay exact: CTE-450's
//        "147.6 x 92.3" and the query "1476 x 92.3" both strip to
//        "1476x923", and the "x" passes the letter test.
//    and each candidate is a *single* value — never a joined string — so
//    stripping can't glue the end of one value to the start of the next.

import type { AnyFieldDisplayDef } from '@thesevenpens/queriton';
import { ROLE_KEYS } from '$lib/field-roles.js';
import { cellTextParts, type CellTextOptions } from '$lib/cell-text.js';

/**
 * NFC, lowercase, NFC again, then drop everything that isn't a letter, a
 * combining mark or a number. Marks are kept so कि and की stay distinct; NFC
 * makes precomposed é equal decomposed e + ◌́. This removes more than
 * "separators" — spaces, dashes, dots, slashes, symbols — on purpose.
 */
export function stripForSearch(text: string): string {
	return text
		.normalize('NFC')
		.toLowerCase()
		.normalize('NFC')
		.replace(/[^\p{L}\p{M}\p{N}]/gu, '');
}

export interface CompiledSearch {
	/** Exact check against one piece of text (a raw value is stringified). */
	exact(text: unknown): boolean;
	/** Separator-insensitive check against one single-value candidate.
	 * Always false when the query doesn't qualify. */
	stripped(text: unknown): boolean;
}

/** Prepare a query once per search. Returns null for a blank query. */
export function compileSearch(query: string): CompiledSearch | null {
	const exactNeedle = query.trim().toLowerCase();
	if (!exactNeedle) return null;
	const strippedNeedle = /\p{L}/u.test(exactNeedle) ? stripForSearch(exactNeedle) : '';
	return {
		exact: (text) => text != null && String(text).toLowerCase().includes(exactNeedle),
		stripped: (text) =>
			strippedNeedle !== '' &&
			text != null &&
			stripForSearch(String(text)).includes(strippedNeedle),
	};
}

/**
 * Fields whose values are identifiers, names or aliases — the only ones the
 * separator-insensitive check applies to. Keyed by FieldDef key, never by
 * column title. The tablet and pen identity roles come from field-roles.ts
 * so the two lists can't drift; the rest are the same kind of field on the
 * other lists (link labels on inventory pages, family / brand / driver names).
 */
export const IDENTITY_SEARCH_KEYS: ReadonlySet<string> = new Set([
	...ROLE_KEYS.tablet.identity,
	...ROLE_KEYS.pen.identity,
	'TabletEntityId',
	'PenEntityId',
	'ModelIncludedPen',
	'PenFamily',
	'FamilyName',
	'BrandName',
	'DriverName',
	'ModelIds',
]);

/**
 * Fields whose value is a list flattened into one string. Their candidates
 * come from the source values, not from splitting the rendered string, so a
 * value containing the separator can't be cut in two.
 */
const LIST_VALUES: Readonly<
	Record<string, (row: unknown, field: AnyFieldDisplayDef) => readonly string[] | undefined>
> = {
	AlternateNames: (row) =>
		(row as { Model?: { AlternateNames?: string[] } })?.Model?.AlternateNames,
	// Pen-family ModelIds is the dataset's own ", " join of PenIds (computed
	// in data-repo dataset.ts); PenIds never contain ", ", so splitting it is
	// exact rather than a guess at rendered text.
	ModelIds: (row, field) =>
		String(field.getValue(row) ?? '')
			.split(', ')
			.filter(Boolean),
};

/**
 * The single-value candidates the separator-insensitive check tests for
 * `field` on `row`, or null when the field isn't an identity field.
 * Raw value plus each drawn piece (each link label separately); list fields
 * contribute each list entry.
 */
export function strippedCandidates(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	row: any,
	field: AnyFieldDisplayDef,
	options: CellTextOptions,
): string[] | null {
	if (!IDENTITY_SEARCH_KEYS.has(field.key)) return null;
	const list = LIST_VALUES[field.key]?.(row, field);
	if (list) return [...list];
	const raw = field.getValue(row);
	return [raw == null ? '' : String(raw), ...cellTextParts(row, field, options)];
}
