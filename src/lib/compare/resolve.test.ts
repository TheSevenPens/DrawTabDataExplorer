import { describe, expect, it } from 'vitest';
import type { CompareColumn } from './model';
import {
	findOverlaps,
	resolveColumn,
	resolveColumns,
	sessionInColumn,
	type ResolveContext,
} from './resolve';

interface Pen {
	id: string;
	family?: string;
}
const pens: Pen[] = [
	{ id: 'wacom.pen.kp504e', family: 'kpgen2' },
	{ id: 'wacom.pen.acp500', family: 'acp' },
	{ id: 'wacom.pen.acp700', family: 'acp' },
	{ id: 'wacom.pen.cp923' },
];
const ctx: ResolveContext<Pen> = {
	model: (id) => pens.find((p) => p.id === id),
	familyMembers: (f) => pens.filter((p) => p.family === f),
	familyName: (f) => ({ acp: 'Pro Pen GEN3 ACP', kpgen2: 'KP GEN2' })[f],
	unitModelId: (u) => ({ 'wap.0030': 'wacom.pen.kp504e' })[u],
	unitLabel: (u) => u.toUpperCase(),
	modelId: (p) => p.id,
	modelLabel: (p) => p.id.split('.').pop()!.toUpperCase(),
};
const col = (over: Partial<CompareColumn>): CompareColumn => ({
	id: 'c1',
	refs: [],
	excluded: [],
	...over,
});

describe('resolveColumn', () => {
	it('a single model or family column takes its kind and name from the ref', () => {
		const m = resolveColumn(col({ refs: [{ type: 'model', id: 'wacom.pen.cp923' }] }), ctx);
		expect([m.kind, m.name, m.models.length]).toEqual(['model', 'CP923', 1]);
		const f = resolveColumn(col({ refs: [{ type: 'family', id: 'acp' }] }), ctx);
		expect([f.kind, f.name, f.refs[0].count]).toEqual(['family', 'Pro Pen GEN3 ACP', 2]);
	});

	it('a group de-duplicates models reached twice and honours exclusions', () => {
		const g = resolveColumn(
			col({
				name: 'Group 1',
				refs: [
					{ type: 'family', id: 'acp' },
					{ type: 'model', id: 'wacom.pen.acp500' },
				],
				excluded: ['wacom.pen.acp700'],
			}),
			ctx,
		);
		expect(g.kind).toBe('group');
		expect(g.models.map((p) => p.id)).toEqual(['wacom.pen.acp500']);
		expect(g.excluded).toEqual([{ id: 'wacom.pen.acp700', label: 'ACP700' }]);
	});

	it("a unit contributes its model's specs but only its own sessions", () => {
		const u = resolveColumn(col({ refs: [{ type: 'unit', id: 'wap.0030' }] }), ctx);
		expect(u.kind).toBe('unit');
		expect(u.name).toBe('WAP.0030 · KP504E');
		expect(u.models.map((p) => p.id)).toEqual(['wacom.pen.kp504e']);
		expect(sessionInColumn(u, { PenEntityId: 'wacom.pen.kp504e', InventoryId: 'WAP.0030' })).toBe(
			true,
		);
		expect(sessionInColumn(u, { PenEntityId: 'wacom.pen.kp504e', InventoryId: 'WAP.0099' })).toBe(
			false,
		);
	});

	it('refs to things no longer in the data are marked missing and contribute nothing', () => {
		const r = resolveColumn(
			col({
				refs: [
					{ type: 'model', id: 'wacom.pen.gone' },
					{ type: 'family', id: 'nope' },
				],
			}),
			ctx,
		);
		expect(r.refs.map((x) => x.missing)).toEqual([true, true]);
		expect(r.models).toEqual([]);
	});
});

describe('findOverlaps', () => {
	it('reports a model that sits in more than one column, on each column', () => {
		const cols = resolveColumns(
			[
				col({
					id: 'a',
					name: 'Group 1',
					refs: [
						{ type: 'model', id: 'wacom.pen.acp500' },
						{ type: 'model', id: 'wacom.pen.cp923' },
					],
				}),
				col({ id: 'b', name: 'Group 2', refs: [{ type: 'family', id: 'acp' }] }),
			],
			ctx,
		);
		const o = findOverlaps(cols, ctx);
		expect(o.get('a')).toEqual([{ label: 'ACP500', others: ['Group 2'] }]);
		expect(o.get('b')).toEqual([{ label: 'ACP500', others: ['Group 1'] }]);
	});
});
