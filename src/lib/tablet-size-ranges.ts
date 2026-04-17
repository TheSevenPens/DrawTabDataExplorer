import type { HistogramRange } from '$lib/components/ValueHistogram.svelte';

export const penTabletRangesCm: HistogramRange[] = [
	{ label: 'TINY', min: 6, max: 16 },
	{ label: 'SMALL', min: 16, max: 24 },
	{ label: 'MEDIUM', min: 24, max: 36 },
	{ label: 'LARGE', min: 36, max: 50 },
	{ label: 'EXTRA LARGE', min: 50, max: 74 },
];

export const penTabletRangesIn: HistogramRange[] = [
	{ label: 'TINY', min: 2, max: 6 },
	{ label: 'SMALL', min: 6, max: 9 },
	{ label: 'MEDIUM', min: 9, max: 14 },
	{ label: 'LARGE', min: 14, max: 20 },
	{ label: 'EXTRA LARGE', min: 20, max: 29 },
];

export const displayRangesCm: HistogramRange[] = [
	{ label: 'TINY', min: 23, max: 28 },
	{ label: 'SMALL', min: 28, max: 38 },
	{ label: 'MEDIUM', min: 38, max: 50 },
	{ label: 'LARGE', min: 50, max: 76 },
	{ label: 'EXTRA LARGE', min: 76, max: 86 },
];

export const displayRangesIn: HistogramRange[] = [
	{ label: 'TINY', min: 9, max: 11 },
	{ label: 'SMALL', min: 11, max: 15 },
	{ label: 'MEDIUM', min: 15, max: 20 },
	{ label: 'LARGE', min: 20, max: 30 },
	{ label: 'EXTRA LARGE', min: 30, max: 34 },
];

// Ranges for a mixed pen-tablet + pen-display comparison chart
export const mixedRangesCm: HistogramRange[] = [
	{ label: 'SMALL',  min: 10, max: 28 },
	{ label: 'MEDIUM', min: 28, max: 41 },
	{ label: 'LARGE',  min: 41, max: 56 },
	{ label: 'XL',     min: 56, max: 86 },
];

export const mixedRangesIn: HistogramRange[] = [
	{ label: 'SMALL',  min:  4, max: 11 },
	{ label: 'MEDIUM', min: 11, max: 16 },
	{ label: 'LARGE',  min: 16, max: 22 },
	{ label: 'XL',     min: 22, max: 34 },
];

export const MM_TO_IN = 0.03937;
export const MM_TO_CM = 0.1;
