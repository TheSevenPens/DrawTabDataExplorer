/**
 * The grouped spec matrix behind `/tablet-compare` and `/pen-compare`.
 *
 * Both pages had built this inline, and the two copies had drifted into being
 * character-for-character identical — including the comment warning that
 * keying the `{#each}` on `label` rather than `key` crashes with
 * `each_key_duplicate` (two fields can strip to the same label, e.g. "Active
 * Area (mm²)" and "Active Area (cm²)"). A bug worth documenting twice is a bug
 * worth only being able to fix once.
 *
 * What stays on the pages is what genuinely differs: each supplies its own
 * `getDisplayValue`, because tablets special-case `ModelIncludedPen` to render
 * pen names rather than ids.
 */
import type { FieldDisplayDef } from '@thesevenpens/queriton';
import { stripUnit } from '$lib/field-display.js';

export interface CompareRow {
	/** FieldDef key. The stable `{#each}` key — see the note above. */
	key: string;
	/** Unit-stripped display label; the unit rides along in each value. */
	label: string;
	/** One entry per compared item, in input order. `''` for no value. */
	values: string[];
	differs: boolean;
}

export interface CompareGroup {
	group: string;
	fields: CompareRow[];
}

/**
 * Build the matrix, one section per group in `groupOrder`.
 *
 * Rows blank for every item are dropped, and a group left with no rows is
 * dropped with them — a comparison should not devote a heading to a section
 * neither item has filled in.
 */
export function buildCompareGroups<T>(
	items: readonly T[],
	fields: readonly FieldDisplayDef<T>[],
	groupOrder: readonly string[],
	getDisplayValue: (field: FieldDisplayDef<T>, item: T) => string,
): CompareGroup[] {
	if (items.length === 0) return [];
	const groups: CompareGroup[] = [];
	for (const group of groupOrder) {
		const rows: CompareRow[] = [];
		for (const field of fields) {
			if (field.group !== group) continue;
			const values = items.map((item) => getDisplayValue(field, item));
			if (values.every((v) => v === '')) continue;
			rows.push({
				key: field.key,
				label: stripUnit(field.label, field.unit),
				values,
				differs: countDistinct(values) > 1,
			});
		}
		if (rows.length > 0) groups.push({ group, fields: rows });
	}
	return groups;
}

/**
 * Distinct values, ignoring blanks.
 *
 * Blanks are excluded deliberately: "266 Hz" against a field nobody has filled
 * in is missing data, not a difference, and highlighting it as one sends the
 * reader chasing a gap in our dataset as though it were a spec change.
 */
function countDistinct(values: readonly string[]): number {
	return new Set(values.filter((v) => v !== '')).size;
}

/** Collapse to rows that differ, dropping groups left empty. */
export function onlyDifferences(groups: readonly CompareGroup[]): CompareGroup[] {
	return groups
		.map((g) => ({ ...g, fields: g.fields.filter((f) => f.differs) }))
		.filter((g) => g.fields.length > 0);
}

/** How many rows `onlyDifferences` would hide — for the toggle's label. */
export function countIdentical(groups: readonly CompareGroup[]): number {
	return groups.reduce((n, g) => n + g.fields.filter((f) => !f.differs).length, 0);
}

/**
 * Flatten to export rows: a group heading spanning blank cells, then its rows.
 */
export function toExportRows(
	groups: readonly CompareGroup[],
	columnCount: number,
): (string | number)[][] {
	const blanks = Array.from({ length: columnCount }, () => '');
	const out: (string | number)[][] = [];
	for (const group of groups) {
		out.push([group.group, ...blanks]);
		for (const row of group.fields) out.push([row.label, ...row.values]);
	}
	return out;
}
