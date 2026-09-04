/**
 * The field catalogue, as data an agent can read before it queries anything.
 *
 * This exists because of a specific, measured failure. An agent working the
 * live dataset had to reverse-engineer that touch support lives at
 * `Digitizer.SupportsTouch` and holds the *string* `"YES"`, not a boolean —
 * costing several wasted round-trips and one silently wrong scan that returned
 * zero results. Both facts were already declared in
 * `data-repo/lib/entities/tablet-fields.ts`:
 *
 *     { key: "DigitizerSupportsTouch", label: "Touch", type: "enum",
 *       enumValues: ["YES", "NO"], group: "Digitizer" }
 *
 * The description existed and had no door. This is the door.
 *
 * Two rules:
 *
 * 1. **Project, never restate.** Everything here is derived from the existing
 *    FieldDefs. A hand-maintained field list would drift, and drift here is
 *    worse than absence — a confidently wrong enum value produces an empty
 *    result set that looks like a real answer.
 * 2. **Enum values are the payload.** Type alone ("enum") does not stop the
 *    `true` vs `"YES"` mistake. The allowed values do.
 */

/** The slice of `FieldDisplayDef` this module needs. */
export interface DescribableField<T> {
	key: string;
	label: string;
	type: 'string' | 'number' | 'enum';
	enumValues?: string[];
	group?: string;
	unit?: string;
	computed?: boolean;
	getValue?: (item: T) => string;
}

export interface FieldDescription {
	key: string;
	label: string;
	type: 'string' | 'number' | 'enum';
	group?: string;
	unit?: string;
	/** Present for `enum`. The set a filter value must come from. */
	enumValues?: string[];
	/** Derived rather than stored; may be absent on sparse records. */
	computed?: boolean;
	/**
	 * Fraction of sampled records with a non-empty value, 0–1, rounded to 2dp.
	 * Only present when `sample` was supplied.
	 *
	 * Worth having: a field that is 3% populated is technically queryable and
	 * practically a dead end, and an agent that filters on it reports "no
	 * matches" when it should report "not recorded for these".
	 */
	fillRate?: number;
}

export interface DescribeFieldsResult {
	entity: string;
	fields: FieldDescription[];
	/** Group → field keys, matching how the UI sections them. */
	groups: Record<string, string[]>;
	totalFields: number;
	/** Records used for `fillRate`; 0 when no sample was supplied. */
	sampled: number;
	/** Keys whose getter threw while sampling — surfaced, not swallowed. */
	errored: string[];
}

export interface DescribeFieldsOptions<T> {
	/** Restrict to these groups, e.g. only `Digitizer`. Case-insensitive. */
	groups?: string[];
	/** Restrict to these keys. Case-insensitive. */
	keys?: string[];
	/** Records to compute `fillRate` from. Omit to skip fill rates entirely. */
	sample?: readonly T[];
}

const norm = (s: string) => s.trim().toLowerCase();

export function describeFields<T>(
	entity: string,
	defs: readonly DescribableField<T>[],
	options: DescribeFieldsOptions<T> = {},
): DescribeFieldsResult {
	const wantGroups = options.groups?.map(norm);
	const wantKeys = options.keys?.map(norm);

	const selected = defs.filter((d) => {
		if (wantKeys && !wantKeys.includes(norm(d.key))) return false;
		if (wantGroups && !wantGroups.includes(norm(d.group ?? ''))) return false;
		return true;
	});

	const sample = options.sample ?? [];
	const errored: string[] = [];

	const fields: FieldDescription[] = selected.map((d) => {
		const out: FieldDescription = { key: d.key, label: d.label, type: d.type };
		if (d.group) out.group = d.group;
		if (d.unit) out.unit = d.unit;
		if (d.enumValues) out.enumValues = [...d.enumValues];
		if (d.computed) out.computed = true;

		if (sample.length && d.getValue) {
			let filled = 0;
			let threw = false;
			for (const item of sample) {
				try {
					if (String(d.getValue(item) ?? '').trim() !== '') filled++;
				} catch {
					threw = true;
				}
			}
			if (threw) errored.push(d.key);
			out.fillRate = Math.round((filled / sample.length) * 100) / 100;
		}
		return out;
	});

	const groups: Record<string, string[]> = {};
	for (const f of fields) {
		const g = f.group ?? 'Ungrouped';
		(groups[g] ??= []).push(f.key);
	}

	return {
		entity,
		fields,
		groups,
		totalFields: defs.length,
		sampled: sample.length,
		errored,
	};
}
