/**
 * Difference table between two or more entities of the same type.
 *
 * Two rules, both learned by running the thing (docs/WEBMCP.md § Walkthrough A4):
 *
 * 1. **Diff `spec` fields only.** A naive diff over all 74 tablet fields is 58%
 *    identity noise — of course two products have different names.
 * 2. **Always return the accounting.** Rows alone let a caller report a
 *    confident answer without the denominator. `differing: 5` means something
 *    very different when `compared` is 62 versus 6.
 */
import type { FieldRole } from '$lib/field-roles.js';

/** The slice of `FieldDisplayDef` this module needs. */
export interface ComparableField<T> {
	key: string;
	label: string;
	group: string;
	getValue: (item: T) => string;
}

export interface CompareRow {
	key: string;
	label: string;
	group: string;
	/** One entry per input item, in input order. */
	values: string[];
}

export interface CompareAccounting {
	totalFields: number;
	/** Skipped because their role isn't in `include`. */
	excludedByRole: number;
	/** Examined — the denominator for `differing`. */
	compared: number;
	differing: number;
	identical: number;
	/** Compared, but blank on every item. Absence of data, not agreement. */
	emptyOnAll: number;
	/**
	 * Keys with no classification. Surfaced rather than swallowed: an
	 * unclassified field is a signal that `field-roles.ts` has drifted from the
	 * upstream field defs.
	 */
	unclassified: string[];
	/** Keys whose getter threw — computed fields can fail on sparse rows. */
	errored: string[];
}

export interface CompareResult {
	rows: CompareRow[];
	accounting: CompareAccounting;
}

export interface CompareOptions {
	roleOf: (key: string) => FieldRole | undefined;
	/** Roles to diff. Defaults to `spec` alone, which is the point of this module. */
	include?: readonly FieldRole[];
}

export function compareEntities<T>(
	items: readonly T[],
	fields: readonly ComparableField<T>[],
	opts: CompareOptions,
): CompareResult {
	const include = opts.include ?? (['spec'] as const);
	const rows: CompareRow[] = [];
	const unclassified: string[] = [];
	const errored: string[] = [];
	let excludedByRole = 0;
	let identical = 0;
	let emptyOnAll = 0;

	for (const field of fields) {
		const role = opts.roleOf(field.key);
		if (role === undefined) unclassified.push(field.key);
		// An unclassified field is still compared — dropping it silently would
		// hide a real difference. It is reported in `unclassified` instead.
		if (role !== undefined && !include.includes(role)) {
			excludedByRole++;
			continue;
		}

		let values: string[];
		try {
			values = items.map((item) => field.getValue(item) ?? '');
		} catch {
			errored.push(field.key);
			continue;
		}

		if (values.every((v) => v === '')) {
			emptyOnAll++;
			continue;
		}
		if (new Set(values).size === 1) {
			identical++;
			continue;
		}
		rows.push({ key: field.key, label: field.label, group: field.group, values });
	}

	return {
		rows,
		accounting: {
			totalFields: fields.length,
			excludedByRole,
			compared: identical + emptyOnAll + rows.length,
			differing: rows.length,
			identical,
			emptyOnAll,
			unclassified,
			errored,
		},
	};
}
