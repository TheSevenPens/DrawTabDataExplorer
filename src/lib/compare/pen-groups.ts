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
