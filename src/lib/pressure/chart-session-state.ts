// Shared chart-session state builders for the three pen-pressure detail
// pages (PenDetail, PenFamilyDetail, InventoryPenDetail). Each page
// renders a PressureResponseChart + PressureResponseChartLegendTable + SessionStats
// trio and needs identical inputs: per-session color, per-session label,
// defect flags, and a hidden-set toggle. The Svelte state ($state Set)
// stays in the parent component so it can be shared with PressureRangeTab.

import type { PressureResponse } from '$data/lib/drawtab-loader.js';
import type { DefectInfo } from '$data/lib/pressure/defects.js';
import { paletteColor, type ChartMode } from '$lib/chart-palette.js';

export type ChartSession = {
	id: string;
	label: string;
	records: PressureResponse['Records'];
	color: string | undefined;
	defective: boolean;
	defectInfo: string | undefined;
};

export function buildSessionColors(
	sessions: PressureResponse[],
	mode: ChartMode,
): Map<string, string> {
	return new Map(sessions.map((s, i) => [s._id, paletteColor(i, mode)]));
}

/** What the chart's color axis groups by. "session" gives every session
 * its own color (the legacy behavior). The other modes assign one color
 * per distinct group, so sessions in the same unit / model / tablet
 * share a color — useful for spotting per-unit consistency, per-model
 * clusters, or tablet effects on the same pen. */
export type ColorBy = 'session' | 'unit' | 'model' | 'tablet';

/** Like `buildSessionColors`, but coalesces by a grouping axis. Walks
 * sessions in their natural order, assigning the next palette slot the
 * first time a group key is seen, so colors are deterministic and stable
 * as long as the session order is. */
export function buildSessionColorsBy(
	sessions: readonly PressureResponse[],
	by: ColorBy,
	mode: ChartMode,
): Map<string, string> {
	const keyFor = (s: PressureResponse): string => {
		if (by === 'unit') return s.InventoryId;
		if (by === 'model') return s.PenEntityId;
		if (by === 'tablet') return s.TabletEntityId;
		return s._id;
	};
	const groupColor = new Map<string, string>();
	const sessionColor = new Map<string, string>();
	let nextIdx = 0;
	for (const s of sessions) {
		const k = keyFor(s);
		let c = groupColor.get(k);
		if (!c) {
			c = paletteColor(nextIdx++, mode);
			groupColor.set(k, c);
		}
		sessionColor.set(s._id, c);
	}
	return sessionColor;
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
