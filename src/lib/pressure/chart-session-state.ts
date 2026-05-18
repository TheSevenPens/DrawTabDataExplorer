// Shared chart-session state builders for the three pen-pressure detail
// pages (PenDetail, PenFamilyDetail, InventoryPenDetail). Each page
// renders a PressureChart + PressureResponseChartLegendTable + SessionStats
// trio and needs identical inputs: per-session color, per-session label,
// defect flags, and a hidden-set toggle. The Svelte state ($state Set)
// stays in the parent component so it can be shared with MaxPressureTab.

import type { PressureResponse } from '$data/lib/drawtab-loader.js';
import type { DefectInfo } from '$data/lib/pressure/defects.js';
import { paletteColor } from '$lib/chart-palette.js';

export type ChartSession = {
	id: string;
	label: string;
	records: PressureResponse['Records'];
	color: string | undefined;
	defective: boolean;
	defectInfo: string | undefined;
};

export function buildSessionColors(sessions: PressureResponse[]): Map<string, string> {
	return new Map(sessions.map((s, i) => [s._id, paletteColor(i)]));
}

export interface ChartSessionsOptions {
	colors: ReadonlyMap<string, string>;
	defectsByInventoryId?: ReadonlyMap<string, DefectInfo>;
	/** Per-session legend label. Defaults to "InventoryId Date".
	 * Pass a custom builder for family or single-unit views. */
	labelFor?: (s: PressureResponse) => string;
}

export function buildChartSessions(
	sessions: PressureResponse[],
	opts: ChartSessionsOptions,
): ChartSession[] {
	const { colors, defectsByInventoryId, labelFor } = opts;
	return sessions.map((s) => {
		const info = defectsByInventoryId?.get(s.InventoryId);
		return {
			id: s._id,
			label: labelFor ? labelFor(s) : `${s.InventoryId} ${s.Date}`,
			records: s.Records,
			color: colors.get(s._id),
			defective: !!info,
			defectInfo: info?.detailsLabel,
		};
	});
}

/** Toggle `id` in/out of `set`, returning a *new* Set so the assignment
 * triggers Svelte $state reactivity. */
export function toggleInSet<T>(set: ReadonlySet<T>, id: T): Set<T> {
	const next = new Set(set);
	if (next.has(id)) next.delete(id);
	else next.add(id);
	return next;
}
