import { describe, expect, it } from 'vitest';
import type { PressureResponse, PressureRange } from '$data/lib/drawtab-loader.js';
import type { DefectInfo } from '$data/lib/pressure/defects.js';
import {
	columnMeasurements,
	columnRangeValues,
	columnSessions,
	median,
	penGroupStats,
	rangeRowsChart,
} from './pen-groups';

const session = (pen: string, unit: string) =>
	({
		_id: `${unit}-${pen}`,
		PenEntityId: pen,
		InventoryId: unit,
		Records: [],
	}) as unknown as PressureResponse;
const measure = (pen: string, unit: string, metric: 'IAF' | 'MAX', value: number) =>
	({
		PenEntityId: pen,
		PenInventoryId: unit,
		Metric: metric,
		Value: String(value),
	}) as PressureRange;

const sessions = [
	session('wacom.pen.kp504e', 'WAP.0030'),
	session('wacom.pen.kp504e', 'WAP.0031'),
	session('wacom.pen.kp503e', 'WAP.0010'),
];

describe('column scoping', () => {
	it('a model member brings every unit; a unit member only itself', () => {
		const byModel = {
			sessionModelIds: new Set(['wacom.pen.kp504e']),
			sessionUnitIds: new Set<string>(),
		};
		const byUnit = { sessionModelIds: new Set<string>(), sessionUnitIds: new Set(['wap.0030']) };
		expect(columnSessions(byModel, sessions).map((s) => s.InventoryId)).toEqual([
			'WAP.0030',
			'WAP.0031',
		]);
		expect(columnSessions(byUnit, sessions).map((s) => s.InventoryId)).toEqual(['WAP.0030']);
		const ms = [measure('wacom.pen.kp504e', 'WAP.0031', 'IAF', 1)];
		expect(columnMeasurements(byUnit, ms)).toEqual([]);
		expect(columnMeasurements(byModel, ms)).toHaveLength(1);
	});
});

describe('penGroupStats', () => {
	it('takes the median across units, one vote each, skipping defective units', () => {
		const ms = [
			measure('wacom.pen.kp504e', 'WAP.0030', 'IAF', 1),
			measure('wacom.pen.kp504e', 'WAP.0030', 'IAF', 1),
			measure('wacom.pen.kp504e', 'WAP.0031', 'IAF', 3),
			measure('wacom.pen.kp503e', 'WAP.0010', 'IAF', 99),
		];
		const defects = new Map([['WAP.0010', {} as DefectInfo]]);
		const stats = penGroupStats(sessions, ms, defects);
		expect(stats).toEqual({ pensMeasured: 2, sessions: 3, iaf: 2, max: null });
	});
});

describe('median', () => {
	it('handles empty, odd and even inputs', () => {
		expect(median([])).toBeNull();
		expect(median([3, 1, 2])).toBe(2);
		expect(median([4, 1, 3, 2])).toBe(2.5);
	});
});

describe('combined range rows', () => {
	const sess = (unit: string, pen = 'wacom.pen.kp504e') =>
		({
			_id: unit,
			PenEntityId: pen,
			InventoryId: unit,
			Records: [],
		}) as unknown as PressureResponse;

	it('follows the per-column rule: defective sessions out, outlier units lose measurements', () => {
		const ms = [
			measure('wacom.pen.kp504e', 'WAP.0030', 'MAX', 500),
			measure('wacom.pen.kp504e', 'WAP.0031', 'MAX', 900),
			measure('wacom.pen.kp504e', 'WAP.0032', 'MAX', 450),
			measure('wacom.pen.kp504e', 'WAP.0032', 'IAF', 3),
		];
		const defects = new Map([
			['WAP.0031', { defects: [{ Kind: 'pressure-outlier-max' }] } as unknown as DefectInfo],
			['WAP.0032', { defects: [{ Kind: 'tip-wobble' }] } as unknown as DefectInfo],
		]);
		const values = columnRangeValues(
			'MAX',
			[sess('WAP.0030'), sess('WAP.0031'), sess('WAP.0032')],
			ms,
			defects,
		);
		// 0031 is a MAX outlier: gone. 0032 has another defect: its measurement stays.
		expect(values).toEqual([450, 500]);
	});

	it('builds one stripe, a tick per unit and a median per row, pinned to its row', () => {
		const { shadedRanges, markers } = rangeRowsChart(
			[
				{ label: 'A', color: '#a', values: [300, 500, 1200], median: 500 },
				{ label: 'B', color: '#b', values: [], median: null },
			],
			1000,
		);
		expect(shadedRanges).toEqual([
			{ min: 300, max: 1000, color: '#a', label: 'A · 3 units' },
			{ min: 0, max: 0, color: '#b', label: 'B · no data' },
		]);
		expect(markers.map((m) => [m.value, m.seriesIndex, m.strokeWidth])).toEqual([
			[300, 0, 1.5],
			[500, 0, 1.5],
			[1000, 0, 1.5],
			[500, 0, 4],
		]);
	});
});
