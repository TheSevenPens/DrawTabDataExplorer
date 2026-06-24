// Pure data + geometry helpers for the /reference page (GitHub #222).
// The route repeated the same diagonal math, ISO-A nearest-match search,
// resolution bucketing, and paper-size export-row shaping inline across
// several near-identical sections. Extracting them here removes the
// duplication and makes each piece unit-testable; the route keeps its
// rendering snippets (per the #223 steer — config/compute extracted,
// markup stays local).

import { MM_TO_IN } from '$lib/tablet-size-ranges.js';
import type { SpecBand } from '$lib/bands.js';
import type { ISOPaperSize, USPaperSize } from '$data/lib/drawtab-loader.js';

// ISO and US paper-size records share an identical shape.
export type PaperSize = ISOPaperSize | USPaperSize;

/** Greatest common divisor — used to reduce a W×H resolution to an aspect ratio. */
export function gcd(a: number, b: number): number {
	return b === 0 ? a : gcd(b, a % b);
}

/** Diagonal of a width×height rectangle (mm inputs) expressed in centimetres. */
export function diagonalCm(widthMm: number, heightMm: number): number {
	return Math.sqrt(widthMm ** 2 + heightMm ** 2) / 10;
}

/** Diagonal of a width×height rectangle (inch inputs) expressed in inches. */
export function diagonalIn(widthIn: number, heightIn: number): number {
	return Math.sqrt(widthIn ** 2 + heightIn ** 2);
}

// --- Display resolution categories ---

export const resolutionCategories: { name: string; resolutions: { w: number; h: number }[] }[] = [
	{ name: 'Full HD', resolutions: [{ w: 1920, h: 1080 }] },
	{
		name: '2.5K',
		resolutions: [
			{ w: 2560, h: 1440 },
			{ w: 2560, h: 1600 },
		],
	},
	{ name: '3K', resolutions: [{ w: 2880, h: 1800 }] },
	{ name: '4K', resolutions: [{ w: 3840, h: 2160 }] },
];

export function getResolutionCategory(w: number, h: number): string {
	if (w === 1920 && h === 1080) return 'Full HD';
	if ((w === 2560 && h === 1440) || (w === 2560 && h === 1600)) return '2.5K';
	if (w === 2880 && h === 1800) return '3K';
	if (w === 3840 && h === 2160) return '4K';
	return 'Other';
}

/**
 * Find the ISO A-series paper size whose diagonal is closest to `midpointCm`
 * (the midpoint of a tablet/display size category), returning its name and
 * formatted diagonals. Returns blanks when the A-series list is empty (data
 * not yet loaded).
 */
export function closestISOA(
	aSeries: ISOPaperSize[],
	midpointCm: number,
): { name: string; diagCm: string; diagIn: string } {
	if (aSeries.length === 0) return { name: '', diagCm: '', diagIn: '' };
	let best = aSeries[0];
	let bestDist = Infinity;
	for (const p of aSeries) {
		const dCm = diagonalCm(p.Width_mm, p.Height_mm);
		const dist = Math.abs(dCm - midpointCm);
		if (dist < bestDist) {
			bestDist = dist;
			best = p;
		}
	}
	const diagMm = Math.sqrt(best.Width_mm ** 2 + best.Height_mm ** 2);
	return {
		name: best.Name,
		diagCm: (diagMm / 10).toFixed(1),
		diagIn: (diagMm * MM_TO_IN).toFixed(1),
	};
}

/** "min unit to max unit" range label for a spec band. */
export function formatBandRange(b: SpecBand, unit: string): string {
	return `${b.min} ${unit} to ${b.max} ${unit}`;
}

// PMAX_BANDS is defined low→high force (for the chart axis); the table reads
// better tier-first (best → excessive).
export const MAX_RANK_ORDER = ['S', 'A', 'B', 'C', 'D', 'X'];

// Generic over the band shape so a richer band type (e.g. bands.ts `Band`,
// which carries an optional `name` and a nullable `max`) round-trips without
// being widened to SpecBand and losing those fields.
export function sortBandsByRank<T extends { label: string }>(bands: T[]): T[] {
	return [...bands].sort(
		(a, b) => MAX_RANK_ORDER.indexOf(a.label) - MAX_RANK_ORDER.indexOf(b.label),
	);
}

// --- Paper-size sorting (the /reference paper tables' sort control) ---

export type PaperSortKey = 'Name' | 'Series' | 'Width' | 'Height' | 'Diagonal';

/**
 * Sort paper sizes by the chosen key/direction. Width/Height/Diagonal sort
 * numerically (mm / computed diagonal); Name and Series use natural
 * (numeric-aware) comparison so "A2" sorts before "A10". Returns a new array.
 */
export function sortPaperSizes(
	sizes: PaperSize[],
	key: PaperSortKey,
	dir: 'asc' | 'desc',
): PaperSize[] {
	const mult = dir === 'asc' ? 1 : -1;
	const numericVal = (s: PaperSize): number | null => {
		switch (key) {
			case 'Width':
				return s.Width_mm;
			case 'Height':
				return s.Height_mm;
			case 'Diagonal':
				return diagonalCm(s.Width_mm, s.Height_mm);
			default:
				return null;
		}
	};
	const stringVal = (s: PaperSize): string => (key === 'Series' ? s.Series : s.Name);
	return [...sizes].sort((a, b) => {
		const na = numericVal(a);
		if (na !== null) return (na - (numericVal(b) as number)) * mult;
		return stringVal(a).localeCompare(stringVal(b), undefined, { numeric: true }) * mult;
	});
}

/**
 * Build export rows for a paper-size table: Name [, Series] then width/height
 * (cm), diagonal (cm), width/height (in), diagonal (in). `includeSeries` adds
 * the Series column used by the US table.
 */
export function paperSizeExportRows(
	sizes: PaperSize[],
	opts: { includeSeries?: boolean } = {},
): (string | number)[][] {
	return sizes.map((size) => {
		const diagCm = diagonalCm(size.Width_mm, size.Height_mm);
		const diagIn = diagonalIn(size.Width_in, size.Height_in);
		const lead: (string | number)[] = opts.includeSeries ? [size.Name, size.Series] : [size.Name];
		return [
			...lead,
			(size.Width_mm / 10).toFixed(1),
			(size.Height_mm / 10).toFixed(1),
			diagCm.toFixed(1),
			size.Width_in,
			size.Height_in,
			diagIn.toFixed(1),
		];
	});
}
