// Convert open-ended Band[] (e.g. AVOID 5↔∞) into closed HistogramRange[]
// for ValueHistogram. The final band gets its `max` clamped to `axisMax`.

import type { Band } from '$lib/bands.js';
import type { HistogramRange } from '$lib/components/ValueHistogram.svelte';

export function bandsToHistogramRanges(bands: Band[], axisMax: number): HistogramRange[] {
	return bands.map((b) => ({
		label: b.label,
		min: b.min,
		max: b.max === null ? axisMax : Math.min(b.max, axisMax),
	}));
}

/** "N pen models · N pen units · N sessions" with singular/plural. */
export function pressureSubtitle(models: number, units: number, sessions: number): string {
	const fmt = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
	return `${fmt(models, 'pen model', 'pen models')} · ${fmt(units, 'pen unit', 'pen units')} · ${fmt(sessions, 'session', 'sessions')}`;
}
