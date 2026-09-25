/**
 * What the "compare" menus on detail pages do (#373). Adding from a detail
 * page is idempotent — a ref a column already holds is not added twice — so
 * pressing "add to comparison" on a page you came back to does nothing new.
 */

import {
	addRefs,
	emptyComparison,
	refKey,
	type CompareKind,
	type Comparison,
	type MemberRef,
} from './model';

/** Some column holds `ref` directly (not merely through a family). */
export function holds(c: Comparison, ref: MemberRef): boolean {
	const key = refKey(ref);
	return c.columns.some((col) => col.refs.some((r) => refKey(r) === key));
}

/** Add each ref not already held as its own column, stopping at the column cap. */
export function addMissing(c: Comparison, refs: readonly MemberRef[]): Comparison {
	return addRefs(
		c,
		refs.filter((r) => !holds(c, r)),
	);
}

/** Replace the comparison with these refs, one column each. */
export function startWith(kind: CompareKind, refs: readonly MemberRef[]): Comparison {
	return addRefs(emptyComparison(kind), refs);
}
