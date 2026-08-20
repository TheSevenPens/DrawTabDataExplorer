// Quick filters — the curated dropdown row above the query builder's Filters
// row. Each dropdown is sugar for one `.filter()` call, nothing more.
//
// Two properties make this safe to bolt onto the existing builder:
//
//   1. A selection desugars into a real entry in the `filters` array, so the
//      generated code and the executed pipeline stay identical. Anything else
//      would make the page lie about the API it exists to teach.
//   2. A dropdown is a *view* onto that array rather than separate state: it
//      reads its current value back out, so loading a template that already
//      filters on Brand lights the dropdown up, and deleting the pill in the
//      Filters row resets it. Desync is structurally impossible.
//
// A spec owns exactly one (field, operator) pair. A hand-written filter on the
// same field with a different operator is left alone and still applies.

import type { AnyFieldDisplayDef } from '@thesevenpens/queriton';
import type { BuilderCollection, BuilderFilter } from './mockup-templates.js';

export interface QuickFilterOptionSpec {
	value: string;
	label: string;
}

export interface QuickFilterSpec {
	/** FieldDef key this dropdown filters on. */
	field: string;
	/** Operator the dropdown owns. */
	operator: string;
	/** Label for the empty selection, e.g. "All brands". */
	anyLabel: string;
	/**
	 * Explicit choices. Omit for an enum field to derive them from its
	 * `enumValues` — that keeps Brand in step with the BRANDS list for free.
	 */
	options?: QuickFilterOptionSpec[];
}

/**
 * Year cut-points, chosen from the data rather than round numbers: each lands
 * on a meaningfully different slice. Absolute years, not a relative age —
 * "5 years or newer" means something different every January, and these
 * queries get saved as examples.
 */
const TABLET_YEAR_OPTIONS: QuickFilterOptionSpec[] = [
	{ value: '2024', label: '2024 or later' },
	{ value: '2022', label: '2022 or later' },
	{ value: '2020', label: '2020 or later' },
	{ value: '2015', label: '2015 or later' },
	{ value: '2010', label: '2010 or later' },
	{ value: '2000', label: '2000 or later' },
];

const PEN_YEAR_OPTIONS: QuickFilterOptionSpec[] = [
	{ value: '2022', label: '2022 or later' },
	{ value: '2020', label: '2020 or later' },
	{ value: '2015', label: '2015 or later' },
	{ value: '2010', label: '2010 or later' },
	{ value: '2000', label: '2000 or later' },
];

/**
 * Curated per collection rather than derived from every enum field: Tablets
 * alone has 12 of those, including a 19-value aspect-ratio category. The point
 * is the two or three filters people actually reach for.
 */
export const QUICK_FILTERS: Record<BuilderCollection, QuickFilterSpec[]> = {
	Tablets: [
		{ field: 'Brand', operator: '==', anyLabel: 'All brands' },
		{ field: 'ModelType', operator: '==', anyLabel: 'All types' },
		{
			field: 'ModelReleaseYear',
			operator: '>=',
			anyLabel: 'Any release year',
			options: TABLET_YEAR_OPTIONS,
		},
	],
	Pens: [
		{ field: 'Brand', operator: '==', anyLabel: 'All brands' },
		{ field: 'PenTech', operator: '==', anyLabel: 'All technologies' },
		{
			field: 'ReleaseYear',
			operator: '>=',
			anyLabel: 'Any release year',
			options: PEN_YEAR_OPTIONS,
		},
	],
	Drivers: [
		{ field: 'Brand', operator: '==', anyLabel: 'All brands' },
		{ field: 'OSFamily', operator: '==', anyLabel: 'All platforms' },
	],
	PressureResponse: [
		{ field: 'Brand', operator: '==', anyLabel: 'All brands' },
		{ field: 'IsDefective', operator: '==', anyLabel: 'Any condition' },
	],
	PenCompat: [{ field: 'Brand', operator: '==', anyLabel: 'All brands' }],
};

/** Choices for a spec: explicit when given, else the field's enum values. */
export function optionsFor(
	spec: QuickFilterSpec,
	fieldDef: AnyFieldDisplayDef | undefined,
): QuickFilterOptionSpec[] {
	if (spec.options) return spec.options;
	const values = fieldDef?.enumValues ?? [];
	return values.map((v) => ({ value: v, label: v }));
}

/** Index of the filter this spec owns, or -1. */
function ownedIndex(filters: readonly BuilderFilter[], spec: QuickFilterSpec): number {
	return filters.findIndex((f) => f.field === spec.field && f.operator === spec.operator);
}

/**
 * The dropdown's current value, read back from the filters array. Empty when
 * the spec owns nothing — including when its filter exists but is disabled,
 * since a disabled filter isn't narrowing anything.
 */
export function currentValue(filters: readonly BuilderFilter[], spec: QuickFilterSpec): string {
	const i = ownedIndex(filters, spec);
	if (i < 0) return '';
	const f = filters[i]!;
	return f.disabled ? '' : f.value;
}

/**
 * Filters with this spec's selection applied. An empty `value` removes the
 * owned filter; anything else adds or updates it in place, so the pill keeps
 * its position in the row rather than jumping to the end on every change.
 */
export function withQuickFilter(
	filters: readonly BuilderFilter[],
	spec: QuickFilterSpec,
	value: string,
): BuilderFilter[] {
	const next = filters.map((f) => ({ ...f }));
	const i = ownedIndex(next, spec);
	if (value === '') {
		if (i >= 0) next.splice(i, 1);
		return next;
	}
	if (i >= 0) {
		next[i] = { field: spec.field, operator: spec.operator, value };
		return next;
	}
	next.push({ field: spec.field, operator: spec.operator, value });
	return next;
}
