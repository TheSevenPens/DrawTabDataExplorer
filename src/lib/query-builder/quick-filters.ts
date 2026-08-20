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
//      filters on Brand lights the dropdown up, and editing the pill in the
//      Filters row moves the dropdown. Desync is structurally impossible.
//
// A spec owns its field across the operators it can emit — its own, plus any
// an option overrides. A hand-written filter on the same field using some
// other operator is left alone and still applies.

import type { AnyFieldDisplayDef } from '@thesevenpens/queriton';
import type { BuilderCollection, BuilderFilter } from './mockup-templates.js';

export interface QuickFilterOptionSpec {
	/** The dropdown's value for this choice. Unique within a spec. */
	id: string;
	label: string;
	/** Operator for this choice. Defaults to the spec's operator. */
	operator?: string;
	/** Filter value for this choice. Defaults to `id`. */
	value?: string;
}

export interface QuickFilterSpec {
	/** FieldDef key this dropdown filters on. */
	field: string;
	/** Default operator, used by any option that does not override it. */
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
	{ id: '2024', label: '2024 or later' },
	{ id: '2022', label: '2022 or later' },
	{ id: '2020', label: '2020 or later' },
	{ id: '2015', label: '2015 or later' },
	{ id: '2010', label: '2010 or later' },
	{ id: '2000', label: '2000 or later' },
];

const PEN_YEAR_OPTIONS: QuickFilterOptionSpec[] = [
	{ id: '2022', label: '2022 or later' },
	{ id: '2020', label: '2020 or later' },
	{ id: '2015', label: '2015 or later' },
	{ id: '2010', label: '2010 or later' },
	{ id: '2000', label: '2000 or later' },
];

/**
 * Size order, not alphabetical — DigitizerSizeCategory is a computed string
 * field with no enumValues to derive from, and "Extra Large, Large, Medium,
 * Small, Tiny" would read as noise. "Other" covers tablets whose diagonal
 * falls outside the banded ranges for their type.
 */
const SIZE_CATEGORY_OPTIONS: QuickFilterOptionSpec[] = [
	{ id: 'Tiny', label: 'Tiny' },
	{ id: 'Small', label: 'Small' },
	{ id: 'Medium', label: 'Medium' },
	{ id: 'Large', label: 'Large' },
	{ id: 'Extra Large', label: 'Extra Large' },
	{ id: 'Other', label: 'Other' },
];

/**
 * UnitsInInventory is a count, so "owned" and "not owned" need different
 * operators off one dropdown — hence the per-option override.
 */
const INVENTORY_OPTIONS: QuickFilterOptionSpec[] = [
	{ id: 'owned', label: 'In inventory', operator: '>', value: '0' },
	{ id: 'unowned', label: 'Not in inventory', operator: '==', value: '0' },
];

/**
 * Curated per collection rather than derived from every enum field: Tablets
 * alone has 12 of those, including a 19-value aspect-ratio category. The point
 * is the handful of filters people actually reach for.
 */
export const QUICK_FILTERS: Record<BuilderCollection, QuickFilterSpec[]> = {
	Tablets: [
		{ field: 'Brand', operator: '==', anyLabel: 'All brands' },
		{ field: 'ModelType', operator: '==', anyLabel: 'All types' },
		{
			field: 'DigitizerSizeCategory',
			operator: '==',
			anyLabel: 'Any size',
			options: SIZE_CATEGORY_OPTIONS,
		},
		{
			field: 'ModelReleaseYear',
			operator: '>=',
			anyLabel: 'Any release year',
			options: TABLET_YEAR_OPTIONS,
		},
		{
			field: 'UnitsInInventory',
			operator: '>',
			anyLabel: 'Any inventory',
			options: INVENTORY_OPTIONS,
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
	return values.map((v) => ({ id: v, label: v }));
}

/** The (operator, value) pair a choice writes. */
function resolve(spec: QuickFilterSpec, option: QuickFilterOptionSpec) {
	return { operator: option.operator ?? spec.operator, value: option.value ?? option.id };
}

/**
 * Every operator this spec can emit. Ownership spans the set, so picking
 * "Not in inventory" after "In inventory" replaces the filter rather than
 * leaving both `> 0` and `== 0` in place, which together match nothing.
 */
function ownedOperators(spec: QuickFilterSpec, options: QuickFilterOptionSpec[]): Set<string> {
	const ops = new Set<string>([spec.operator]);
	for (const o of options) if (o.operator) ops.add(o.operator);
	return ops;
}

function ownedIndex(
	filters: readonly BuilderFilter[],
	spec: QuickFilterSpec,
	options: QuickFilterOptionSpec[],
): number {
	const ops = ownedOperators(spec, options);
	return filters.findIndex((f) => f.field === spec.field && ops.has(f.operator));
}

/**
 * The dropdown's current value, read back from the filters array. Empty when
 * the spec owns nothing, when its filter is disabled (a disabled filter is not
 * narrowing anything), or when the filter's value matches no offered choice.
 *
 * `options` must be the same list the dropdown is rendering — for enum specs
 * that list is derived from the field def, which this module cannot see.
 */
export function currentValue(
	filters: readonly BuilderFilter[],
	spec: QuickFilterSpec,
	options: QuickFilterOptionSpec[] = spec.options ?? [],
): string {
	const i = ownedIndex(filters, spec, options);
	if (i < 0) return '';
	const f = filters[i]!;
	if (f.disabled) return '';
	const match = options.find((o) => {
		const r = resolve(spec, o);
		return r.operator === f.operator && r.value === f.value;
	});
	return match ? match.id : '';
}

/**
 * Filters with this spec's selection applied. An empty `id` removes the owned
 * filter; anything else adds or updates it in place, so the pill keeps its
 * position in the row rather than jumping to the end on every change.
 */
export function withQuickFilter(
	filters: readonly BuilderFilter[],
	spec: QuickFilterSpec,
	id: string,
	options: QuickFilterOptionSpec[] = spec.options ?? [],
): BuilderFilter[] {
	const next = filters.map((f) => ({ ...f }));
	const i = ownedIndex(next, spec, options);
	if (id === '') {
		if (i >= 0) next.splice(i, 1);
		return next;
	}
	const option = options.find((o) => o.id === id) ?? { id, label: id };
	const { operator, value } = resolve(spec, option);
	const entry: BuilderFilter = { field: spec.field, operator, value };
	if (i >= 0) {
		next[i] = entry;
		return next;
	}
	next.push(entry);
	return next;
}
