import { describe, expect, it } from 'vitest';
import { groupByOrderDate } from './inventory-timeline.js';

const u = (InventoryId: string, OrderDate?: string) => ({ InventoryId, OrderDate });

describe('groupByOrderDate', () => {
	it('groups newest first: year, then month, then day', () => {
		const t = groupByOrderDate([
			u('WAT.0001', '2023-03-10'),
			u('WAT.0002', '2025-06-28'),
			u('WAT.0003', '2025-06-02'),
			u('WAT.0004', '2025-01-15'),
		]);
		expect(t.years.map((y) => [y.year, y.count])).toEqual([
			['2025', 3],
			['2023', 1],
		]);
		expect(t.years[0].months.map((m) => [m.month, m.units.map((x) => x.InventoryId)])).toEqual([
			[6, ['WAT.0002', 'WAT.0003']],
			[1, ['WAT.0004']],
		]);
	});

	it('orders units bought the same day by InventoryId', () => {
		const t = groupByOrderDate([u('HUT.0021', '2026-09-13'), u('HUP.0031', '2026-09-13')]);
		expect(t.years[0].months[0].units.map((x) => x.InventoryId)).toEqual(['HUP.0031', 'HUT.0021']);
	});

	it('keeps units without a usable date, separately, instead of dropping them', () => {
		const t = groupByOrderDate([
			u('A.1', ''),
			u('A.2', 'UNKNOWN'),
			u('A.3'),
			u('A.4', '2024-02-01'),
		]);
		expect(t.undated.map((x) => x.InventoryId)).toEqual(['A.1', 'A.2', 'A.3']);
		expect(t.years.map((y) => y.year)).toEqual(['2024']);
	});

	it('a year-only or year-month date sorts after the dated units of that year / month', () => {
		const t = groupByOrderDate([
			u('A.1', '2024'),
			u('A.2', '2024-05'),
			u('A.3', '2024-05-20'),
			u('A.4', '2024-01-02'),
		]);
		expect(t.years[0].months.map((m) => [m.month, m.units.map((x) => x.InventoryId)])).toEqual([
			[5, ['A.3', 'A.2']],
			[1, ['A.4']],
			[null, ['A.1']],
		]);
	});
});
