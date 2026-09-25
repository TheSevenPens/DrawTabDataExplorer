/**
 * The summary view of a comparison (#373): one cell per column, however many
 * models the column holds.
 *
 * - Every member agrees → that value.
 * - Numbers that differ → "smallest – largest", ranked by the stored value
 *   (so "9.1 g" < "15 g"), each end drawn with its member's display text so
 *   units and unit preference carry over.
 * - Anything else that differs → the distinct values joined ("No / Yes"), or
 *   "N values" past three. Long free text → "N different notes".
 * - Members with no value don't count as a value; when only some have one,
 *   the cell says "n of m recorded". A column with none shows blank.
 *
 * `differs` compares columns the way compare-matrix does: blanks are missing
 * data, not a difference.
 */

import type { FieldDisplayDef } from '@thesevenpens/queriton';
import { stripUnit } from '$lib/field-display.js';

export interface SummaryCell {
	text: string;
	/** Members of this column disagree. */
	varies: boolean;
	/** "n of m recorded" when some members lack the field; else ''. */
	note: string;
}

export interface SummaryRow {
	key: string;
	label: string;
	cells: SummaryCell[];
	differs: boolean;
}

export interface SummaryGroup {
	group: string;
	rows: SummaryRow[];
}

const MAX_LISTED = 3;

export function summarizeCell<T>(
	field: FieldDisplayDef<T>,
	models: readonly T[],
	display: (field: FieldDisplayDef<T>, item: T) => string,
): SummaryCell {
	const values = models.map((m) => ({ text: display(field, m), raw: field.getValue(m) ?? '' }));
	const present = values.filter((v) => v.text !== '');
	const note =
		present.length > 0 && present.length < models.length
			? `${present.length} of ${models.length} recorded`
			: '';
	const distinct = [...new Set(present.map((v) => v.text))];
	if (distinct.length === 0) return { text: '', varies: false, note: '' };
	if (distinct.length === 1) return { text: distinct[0], varies: false, note };

	if (field.multiline) return { text: `${distinct.length} different notes`, varies: true, note };

	const numeric = present.every((v) => v.raw.trim() !== '' && Number.isFinite(Number(v.raw)));
	if (numeric) {
		const sorted = [...present].sort((a, b) => Number(a.raw) - Number(b.raw));
		const lo = sorted[0];
		const hi = sorted[sorted.length - 1];
		return { text: `${lo.text} – ${hi.text}`, varies: true, note };
	}
	const text = distinct.length <= MAX_LISTED ? distinct.join(' / ') : `${distinct.length} values`;
	return { text, varies: true, note };
}

/**
 * Build the summary matrix: one section per field group, one row per field,
 * one cell per column. Rows blank in every column are dropped, and groups
 * left with no rows go with them — same rule as buildCompareGroups.
 */
export function buildSummaryGroups<T>(
	columns: readonly { models: readonly T[] }[],
	fields: readonly FieldDisplayDef<T>[],
	groupOrder: readonly string[],
	display: (field: FieldDisplayDef<T>, item: T) => string,
): SummaryGroup[] {
	if (columns.length === 0) return [];
	const groups: SummaryGroup[] = [];
	for (const group of groupOrder) {
		const rows: SummaryRow[] = [];
		for (const field of fields) {
			if (field.group !== group) continue;
			const cells = columns.map((c) => summarizeCell(field, c.models, display));
			if (cells.every((c) => c.text === '')) continue;
			const texts = new Set(cells.map((c) => c.text).filter((t) => t !== ''));
			rows.push({
				key: field.key,
				label: stripUnit(field.label, field.unit),
				cells,
				differs: texts.size > 1,
			});
		}
		if (rows.length > 0) groups.push({ group, rows });
	}
	return groups;
}

export function onlyDifferingRows(groups: readonly SummaryGroup[]): SummaryGroup[] {
	return groups
		.map((g) => ({ ...g, rows: g.rows.filter((r) => r.differs) }))
		.filter((g) => g.rows.length > 0);
}

export function countIdenticalRows(groups: readonly SummaryGroup[]): number {
	return groups.reduce((n, g) => n + g.rows.filter((r) => !r.differs).length, 0);
}

/** Rows for export: [section, field, ...one text per column] with "(varies)" / notes spelled out. */
export function summaryExportRows(groups: readonly SummaryGroup[]): string[][] {
	return groups.flatMap((g) =>
		g.rows.map((r) => [
			g.group,
			r.label,
			...r.cells.map((c) =>
				[c.text || '—', c.varies ? '(varies)' : '', c.note ? `(${c.note})` : '']
					.filter(Boolean)
					.join(' '),
			),
		]),
	);
}
