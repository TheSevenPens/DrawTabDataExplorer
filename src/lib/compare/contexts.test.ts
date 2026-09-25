import { describe, expect, it } from 'vitest';
import type { Tablet, Pen, TabletFamily, PenFamily } from '$data/lib/drawtab-loader.js';
import type { InventoryPen } from '$data/lib/entities/inventory-pen-fields.js';
import { penCompareData, tabletCompareData } from './contexts';
import { resolveColumn, sessionInColumn } from './resolve';

const tablet = (id: string, modelId: string, family?: string) =>
	({
		Meta: { EntityId: id },
		Model: {
			Brand: 'WACOM',
			Id: modelId,
			Name: `Intuos ${modelId}`,
			Type: 'PENTABLET',
			Family: family,
		},
	}) as unknown as Tablet;

const tablets = [
	tablet('wacom.tablet.pth460', 'PTH-460', 'wacom.tabletfamily.pro2017'),
	tablet('wacom.tablet.pth660', 'PTH-660', 'wacom.tabletfamily.pro2017'),
	tablet('wacom.tablet.ctl4100', 'CTL-4100'),
];
const tabletFamilies = [
	{ EntityId: 'wacom.tabletfamily.pro2017', FamilyName: 'Wacom Intuos Pro 2017 tablet series' },
] as TabletFamily[];

describe('tabletCompareData', () => {
	const { ctx, candidates } = tabletCompareData(tablets, tabletFamilies);

	it('expands a family to its members, live from Model.Family', () => {
		expect(ctx.familyMembers('wacom.tabletfamily.pro2017').map(ctx.modelId)).toEqual([
			'wacom.tablet.pth460',
			'wacom.tablet.pth660',
		]);
		expect(ctx.familyMembers('nope')).toEqual([]);
	});

	it('offers families (with member counts) before models', () => {
		expect(candidates.map((c) => c.kindLabel)).toEqual([
			'family · 2 tablets',
			'pen tablet',
			'pen tablet',
			'pen tablet',
		]);
		expect(candidates[1].searchTexts).toContain('PTH-460');
	});
});

describe('penCompareData', () => {
	const pens = [
		{
			EntityId: 'wacom.pen.kp504e',
			Brand: 'WACOM',
			PenId: 'KP-504E',
			PenName: 'Pro Pen 2',
			PenFamily: 'wacom.penfamily.kpgen2',
		},
		{
			EntityId: 'wacom.pen.kp503e',
			Brand: 'WACOM',
			PenId: 'KP-503E',
			PenName: 'Grip Pen',
			PenFamily: 'wacom.penfamily.kpgen1',
		},
	] as unknown as Pen[];
	const families = [
		{ EntityId: 'wacom.penfamily.kpgen2', FamilyName: 'Wacom KP Gen2 pen series' },
	] as PenFamily[];
	const units = [{ InventoryId: 'WAP.0030', PenEntityId: 'wacom.pen.kp504e' }] as InventoryPen[];
	const { ctx, candidates } = penCompareData(pens, families, units);

	it('a unit resolves to its model for specs but only its own sessions', () => {
		const col = resolveColumn(
			{ id: 'c', refs: [{ type: 'unit', id: 'wap.0030' }], excluded: [] },
			ctx,
		);
		expect(col.models.map(ctx.modelId)).toEqual(['wacom.pen.kp504e']);
		expect(col.refs[0].label).toBe('WAP.0030 · Wacom Pro Pen 2');
		expect(sessionInColumn(col, { PenEntityId: 'wacom.pen.kp504e', InventoryId: 'WAP.0030' })).toBe(
			true,
		);
		expect(sessionInColumn(col, { PenEntityId: 'wacom.pen.kp504e', InventoryId: 'WAP.0031' })).toBe(
			false,
		);
	});

	it('offers families, models and units', () => {
		expect(candidates.map((c) => c.ref.type)).toEqual(['family', 'model', 'model', 'unit']);
		const unit = candidates[3];
		expect(unit.ref.id).toBe('wap.0030');
		expect(unit.modelId).toBe('wacom.pen.kp504e');
	});
});
