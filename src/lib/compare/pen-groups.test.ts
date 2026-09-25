import { describe, expect, it } from 'vitest';
import type { PressureResponse, PressureRange } from '$data/lib/drawtab-loader.js';
import type { DefectInfo } from '$data/lib/pressure/defects.js';
import { columnMeasurements, columnSessions, median, penGroupStats } from './pen-groups';

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
