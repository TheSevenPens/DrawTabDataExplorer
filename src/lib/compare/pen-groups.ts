/**
 * Pressure data per Compare column (#373). A column's sessions are those of
 * its model and family members plus those of its units (see `sessionInColumn`);
 * its direct IAF / MAX measurements follow the same rule. The group summary
 * resolves each unit measured-wins (`resolveRangeByUnit`, as the IAF / MAX
 * tabs do), drops defective units, and takes the median across units — one
 * unit, one vote, however many times it was measured.
 */

import type { PressureResponse, PressureRange } from '$data/lib/drawtab-loader.js';
import type { DefectInfo } from '$data/lib/pressure/defects.js';
import { resolveRangeByUnit, type RangeMetric } from '$data/lib/pressure/range-resolve.js';
import { sessionInColumn, type ResolvedColumn } from './resolve';

type SessionScope = Pick<ResolvedColumn<unknown>, 'sessionModelIds' | 'sessionUnitIds'>;

export function columnSessions(
	col: SessionScope,
	sessions: readonly PressureResponse[],
): PressureResponse[] {
	return sessions.filter((s) => sessionInColumn(col, s));
}

export function columnMeasurements(
	col: SessionScope,
	measurements: readonly PressureRange[],
): PressureRange[] {
	return measurements.filter((m) =>
		sessionInColumn(col, { PenEntityId: m.PenEntityId, InventoryId: m.PenInventoryId }),
	);
}

export function median(xs: readonly number[]): number | null {
	if (xs.length === 0) return null;
	const s = [...xs].sort((a, b) => a - b);
	const mid = Math.floor(s.length / 2);
	return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export interface PenGroupStats {
	/** Distinct pen models with at least one session. */
	pensMeasured: number;
	sessions: number;
	/** Median across non-defective units, or null when none has data. */
	iaf: number | null;
	max: number | null;
}

export function penGroupStats(
	sessions: readonly PressureResponse[],
	measurements: readonly PressureRange[],
	defects: ReadonlyMap<string, DefectInfo>,
): PenGroupStats {
	const unitMedian = (metric: RangeMetric) =>
		median(
			resolveRangeByUnit(metric, sessions, measurements)
				.filter((u) => !defects.has(u.inventoryId))
				.map((u) => u.value),
		);
	return {
		pensMeasured: new Set(sessions.map((s) => s.PenEntityId.toLowerCase())).size,
		sessions: sessions.length,
		iaf: unitMedian('IAF'),
		max: unitMedian('MAX'),
	};
}

/**
 * One column's resolved IAF / MAX values, one per pen unit, by the same rule
 * as PressureRangeTab (#377 follow-up): defective sessions are dropped, and a
 * unit flagged as an outlier for this metric loses its direct measurements
 * too. Measured wins per unit, else the median session estimate. Sorted.
 */
export function columnRangeValues(
	metric: RangeMetric,
	sessions: readonly PressureResponse[],
	measurements: readonly PressureRange[],
	defects: ReadonlyMap<string, DefectInfo>,
): number[] {
	const outlierKind = metric === 'IAF' ? 'pressure-outlier-iaf' : 'pressure-outlier-max';
	const isOutlier = (id: string) => !!defects.get(id)?.defects.some((d) => d.Kind === outlierKind);
	return resolveRangeByUnit(
		metric,
		sessions.filter((s) => !defects.has(s.InventoryId)),
		measurements.filter((m) => m.Metric === metric && !isOutlier(m.PenInventoryId)),
	)
		.map((u) => u.value)
		.sort((a, b) => a - b);
}

export interface RangeRow {
	label: string;
	color: string;
	/** Resolved per-unit values, ascending; empty when the column has no data. */
	values: number[];
	median: number | null;
}

/** Chart inputs for the combined rows: a min–max stripe per column, a tick per
 * unit, and a heavy median — all pinned to the column's own row. */
export function rangeRowsChart(
	rows: readonly RangeRow[],
	axisMax: number,
): {
	shadedRanges: { min: number; max: number; color: string; label: string }[];
	markers: {
		value: number;
		color: string;
		seriesIndex: number;
		dashed: boolean;
		strokeWidth: number;
	}[];
} {
	const clamp = (v: number) => Math.min(v, axisMax);
	return {
		shadedRanges: rows.map((r) => ({
			min: r.values.length ? clamp(r.values[0]) : 0,
			max: r.values.length ? clamp(r.values[r.values.length - 1]) : 0,
			color: r.color,
			label: r.values.length
				? `${r.label} · ${r.values.length} ${r.values.length === 1 ? 'unit' : 'units'}`
				: `${r.label} · no data`,
		})),
		markers: rows.flatMap((r, i) => [
			...r.values.map((v) => ({
				value: clamp(v),
				color: r.color,
				seriesIndex: i,
				dashed: false,
				strokeWidth: 1.5,
			})),
			...(r.median === null
				? []
				: [
						{
							value: clamp(r.median),
							color: r.color,
							seriesIndex: i,
							dashed: false,
							strokeWidth: 4,
						},
					]),
		]),
	};
}
