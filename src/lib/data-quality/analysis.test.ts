import { describe, it, expect } from 'vitest';
import { analyzeData, type AnalysisInput } from './analysis.js';
import type { Pen, Tablet, PressureResponse, PressureRange } from '$data/lib/drawtab-loader.js';
import type { InventoryPen } from '$data/lib/entities/inventory-pen-fields.js';

// Minimal builders — only the fields the analyzer reads. Cast through unknown
// since the full entity shapes carry many unrelated required fields.
function emptyInput(): AnalysisInput {
	return {
		brands: [],
		tablets: [],
		pens: [],
		penCompat: [],
		penFamilies: [],
		tabletFamilies: [],
		drivers: [],
		pressureResponse: [],
		pressureRange: [],
		invPens: [],
		invTablets: [],
	};
}

const pen = (over: Partial<Pen>): Pen =>
	({
		EntityId: 'wacom.pen.x',
		Brand: 'WACOM',
		PenId: 'X',
		PenName: 'Pen X',
		PenFamily: '',
		PenYear: '',
		_id: 'p',
		...over,
	}) as unknown as Pen;

const tablet = (id: string): Tablet =>
	({
		Meta: { EntityId: id },
		Model: { Brand: 'WACOM', Id: 'T', Name: 'T', Type: 'PENTABLET' },
	}) as unknown as Tablet;

const session = (over: Partial<PressureResponse>): PressureResponse =>
	({
		Brand: 'WACOM',
		PenEntityId: 'wacom.pen.x',
		PenFamily: '',
		InventoryId: 'WAP.A',
		Date: '2025-01-01',
		User: '',
		TabletEntityId: 'wacom.tablet.t',
		Driver: '',
		OS: '',
		Notes: '',
		Records: [
			[3, 0],
			[5, 50],
		],
		_id: 's',
		...over,
	}) as unknown as PressureResponse;

const meas = (over: Partial<PressureRange>): PressureRange =>
	({
		Brand: 'WACOM',
		PenEntityId: 'wacom.pen.x',
		PenInventoryId: 'WAP.A',
		Metric: 'IAF',
		Value: '3.0',
		Date: '2025-01-01',
		TabletEntityId: 'wacom.tablet.t',
		Driver: 'WACOM',
		OS: 'WINDOWS',
		Method: '',
		_id: 'm',
		...over,
	}) as unknown as PressureRange;

const invPen = (over: Partial<InventoryPen>): InventoryPen =>
	({
		InventoryId: 'WAP.A',
		PenEntityId: 'wacom.pen.x',
		Brand: 'WACOM',
		Defects: [],
		_id: 'i',
		...over,
	}) as unknown as InventoryPen;

describe('analyzeData — iafEstimatedNoMeasurement', () => {
	it('lists units with an estimate but no direct measurement; excludes measured and defective units', () => {
		const input: AnalysisInput = {
			...emptyInput(),
			pens: [pen({})],
			invPens: [
				invPen({ InventoryId: 'WAP.A', _id: 'i1' }),
				invPen({ InventoryId: 'WAP.B', _id: 'i2' }),
				invPen({ InventoryId: 'WAP.C', _id: 'i3', Defects: [{ Kind: 'broken', Notes: '' }] }),
			],
			pressureResponse: [
				session({ InventoryId: 'WAP.A', _id: 's1' }), // estimate only
				session({ InventoryId: 'WAP.B', _id: 's2' }), // also measured below
				session({ InventoryId: 'WAP.C', _id: 's3' }), // defective → excluded
			],
			pressureRange: [meas({ PenInventoryId: 'WAP.B', Value: '5.0', _id: 'm1' })],
		};
		const r = analyzeData(input);
		expect(r.iafEstimatedNoMeasurement.map((x) => x.inventoryId)).toEqual(['WAP.A']);
		expect(r.iafEstimatedNoMeasurement[0].penName).toBe('Pen X (X)');
	});
});

const tabletWithDate = (id: string, releaseDate: string): Tablet =>
	({
		Meta: { EntityId: `wacom.tablet.${id.toLowerCase()}` },
		Model: {
			Brand: 'WACOM',
			Id: id,
			Name: id,
			Type: 'PENTABLET',
			LaunchYear: '2020',
			ReleaseDate: releaseDate,
		},
	}) as unknown as Tablet;

describe('analyzeData — tabletsMissingExactReleaseDate', () => {
	it('flags non-exact dates by precision and excludes exact YYYY-MM-DD', () => {
		const input: AnalysisInput = {
			...emptyInput(),
			tablets: [
				tabletWithDate('EXACT', '2023-08-10'),
				tabletWithDate('MONTH', '2007-11'),
				tabletWithDate('YEAR', '1984'),
				tabletWithDate('NONE', ''),
			],
		};
		const r = analyzeData(input);
		const byId = new Map(r.tabletsMissingExactReleaseDate.map((t) => [t.id, t]));
		expect(byId.has('EXACT')).toBe(false);
		expect(byId.get('MONTH')?.precision).toBe('month');
		expect(byId.get('YEAR')?.precision).toBe('year');
		expect(byId.get('NONE')?.precision).toBe('none');
		expect(byId.get('NONE')?.missing).toBe('missing');
		expect(r.tabletsMissingExactReleaseDate).toHaveLength(3);
	});
});

describe('analyzeData — duplicate inventory ids', () => {
	it('flags duplicate pen and tablet inventory ids independently, exempting UNASSIGNED', () => {
		const input: AnalysisInput = {
			...emptyInput(),
			invPens: [
				invPen({ InventoryId: 'WAP.A', _id: 'i1' }),
				invPen({ InventoryId: 'WAP.A', _id: 'i2' }), // duplicate → flagged
				invPen({ InventoryId: 'WAP.B', _id: 'i3' }), // unique
				invPen({ InventoryId: 'UNASSIGNED', _id: 'i4' }),
				invPen({ InventoryId: 'UNASSIGNED', _id: 'i5' }), // placeholder → exempt
			],
			invTablets: [
				{ InventoryId: 'WAT.A', TabletEntityId: 'wacom.tablet.a', _id: 't1' },
				{ InventoryId: 'WAT.A', TabletEntityId: 'wacom.tablet.a', _id: 't2' }, // duplicate
			] as unknown as AnalysisInput['invTablets'],
		};
		const dups = analyzeData(input).issues.filter((i) => i.issue === 'duplicate InventoryId');
		expect(dups).toHaveLength(2);
		expect(dups.some((i) => i.entity === 'InventoryPen' && i.entityId === 'WAP.A')).toBe(true);
		expect(dups.some((i) => i.entity === 'InventoryTablet' && i.entityId === 'WAT.A')).toBe(true);
	});

	it('reports no duplicates when all inventory ids are unique', () => {
		const input: AnalysisInput = {
			...emptyInput(),
			invPens: [
				invPen({ InventoryId: 'WAP.A', _id: 'i1' }),
				invPen({ InventoryId: 'WAP.B', _id: 'i2' }),
			],
		};
		const dups = analyzeData(input).issues.filter((i) => i.issue === 'duplicate InventoryId');
		expect(dups).toHaveLength(0);
	});
});

describe('analyzeData — pressure-range integrity', () => {
	const base: AnalysisInput = {
		...emptyInput(),
		pens: [pen({})],
		tablets: [tablet('wacom.tablet.t')],
		invPens: [invPen({ InventoryId: 'WAP.A' })],
	};
	const issuesFor = (range: PressureRange[]) =>
		analyzeData({ ...base, pressureRange: range }).issues;

	it('flags a PenInventoryId not in the inventory', () => {
		const issues = issuesFor([meas({ PenInventoryId: 'WAP.Z', _id: 'm1' })]);
		expect(issues.some((i) => i.issue.includes('unknown inventory pen'))).toBe(true);
	});

	it('flags a TabletEntityId not in the tablet set', () => {
		const issues = issuesFor([meas({ TabletEntityId: 'wacom.tablet.nope', _id: 'm1' })]);
		expect(issues.some((i) => i.issue.includes('unknown tablet'))).toBe(true);
	});

	it('flags an exact-duplicate row but allows a same-day repeat with a different value', () => {
		const issues = issuesFor([
			meas({ _id: 'm1', Value: '3.0' }),
			meas({ _id: 'm2', Value: '3.0' }), // identical → flagged
			meas({ _id: 'm3', Value: '3.5' }), // same day, different value → allowed
		]);
		const dups = issues.filter((i) => i.issue.includes('identical measurement'));
		expect(dups).toHaveLength(1);
	});
});
