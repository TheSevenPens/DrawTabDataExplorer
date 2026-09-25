/**
 * Wording and markers for the Compare sizes view (#380). The chart's subject
 * is the compared tablets; the population of all tablets is an optional
 * context layer, and the text says which is which.
 */

import type { HistogramMarker } from '$lib/components/ValueHistogram.svelte';

export type SizeTypeFilter = 'PENTABLET' | 'PENDISPLAY' | 'ALL';

/** The kind of tablet the compared set is: all pen tablets, all displays, or mixed. */
export function sizeTypeFilter(types: readonly string[]): SizeTypeFilter {
	const tablets = types.some((t) => t === 'PENTABLET');
	const displays = types.some((t) => t !== 'PENTABLET');
	return tablets && displays ? 'ALL' : tablets ? 'PENTABLET' : 'PENDISPLAY';
}

/** "pen tablets", "pen displays" or "tablets" — the population the context layer draws. */
export function populationNoun(f: SizeTypeFilter): string {
	return f === 'PENTABLET' ? 'pen tablets' : f === 'PENDISPLAY' ? 'pen displays' : 'tablets';
}

/**
 * The chart's sub-line: what the markers are, and — when the context layer
 * is on — what the bars are. `years` null means every release year.
 */
export function sizeSubtitle(opts: {
	markerCount: number;
	columnCount: number;
	context: { noun: string; years: number | null; count: number } | null;
}): string {
	const { markerCount, columnCount, context } = opts;
	const marks = `${markerCount} compared ${markerCount === 1 ? 'tablet' : 'tablets'} in ${columnCount} ${columnCount === 1 ? 'column' : 'columns'}`;
	if (!context) return marks;
	const when =
		context.years === null ? 'of any year' : `released in the last ${context.years} years`;
	return `${marks} · bars: all ${context.count} ${context.noun} ${when}`;
}

/**
 * One marker per member per column, in its column's colour. A tablet in two
 * columns gets two markers — each column shows where it sits. Members with
 * no diagonal are skipped.
 */
export function sizeMarkers<T>(
	columns: readonly { models: readonly T[] }[],
	colors: readonly string[],
	diagonal: (t: T) => number | null,
	label: (t: T) => string,
): HistogramMarker[] {
	return columns.flatMap((col, i) =>
		col.models.flatMap((t) => {
			const d = diagonal(t);
			return d === null ? [] : [{ value: d, label: label(t), color: colors[i] }];
		}),
	);
}
