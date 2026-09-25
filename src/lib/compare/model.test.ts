import { describe, expect, it } from 'vitest';
import {
	MAX_COLUMNS,
	addRef,
	addRefs,
	emptyComparison,
	mergeColumns,
	moveRef,
	newGroup,
	nextGroupName,
	parseComparison,
	removeColumn,
	removeRef,
	renameColumn,
	toggleExcluded,
	type MemberRef,
} from './model';

const model = (id: string): MemberRef => ({ type: 'model', id });
const family = (id: string): MemberRef => ({ type: 'family', id });

describe('comparison operations', () => {
	it('adds each ref as its own column, lowercased, up to MAX_COLUMNS', () => {
		const refs = Array.from({ length: MAX_COLUMNS + 2 }, (_, i) => model(`WACOM.TABLET.T${i}`));
		const c = addRefs(emptyComparison('tablets'), refs);
		expect(c.columns).toHaveLength(MAX_COLUMNS);
		expect(c.columns[0].refs).toEqual([model('wacom.tablet.t0')]);
		expect(new Set(c.columns.map((col) => col.id)).size).toBe(MAX_COLUMNS);
	});

	it('adding into a column appends once, even when full, and un-excludes that model', () => {
		let c = addRef(emptyComparison('pens'), family('wacom.penfamily.wacom_acp'));
		const id = c.columns[0].id;
		c = toggleExcluded(c, id, 'wacom.pen.acp700');
		c = addRef(c, model('wacom.pen.acp700'), id);
		c = addRef(c, model('wacom.pen.acp700'), id);
		expect(c.columns[0].refs).toHaveLength(2);
		expect(c.columns[0].excluded).toEqual([]);
	});

	it('new groups get the lowest free "Group N" name', () => {
		let c = newGroup(emptyComparison('pens'));
		c = newGroup(c);
		expect(c.columns.map((col) => col.name)).toEqual(['Group 1', 'Group 2']);
		c = removeColumn(c, c.columns[0].id);
		expect(nextGroupName(c)).toBe('Group 1');
	});

	it('removing the last ref drops an unnamed column but keeps a named, empty group', () => {
		let c = addRef(emptyComparison('pens'), model('wacom.pen.kp504e'));
		c = removeRef(c, c.columns[0].id, model('wacom.pen.kp504e'));
		expect(c.columns).toEqual([]);
		c = newGroup(c, [model('wacom.pen.kp504e')]);
		c = removeRef(c, c.columns[0].id, model('WACOM.PEN.KP504E'));
		expect(c.columns).toHaveLength(1);
		expect(c.columns[0].refs).toEqual([]);
	});

	it('moves a ref between columns and merges one column into another', () => {
		let c = addRefs(emptyComparison('pens'), [
			model('wacom.pen.kp504e'),
			model('wacom.pen.acp500'),
		]);
		c = newGroup(c);
		const [a, b, g] = c.columns.map((col) => col.id);
		c = moveRef(c, a, g, model('wacom.pen.kp504e'));
		expect(c.columns.map((col) => col.id)).toEqual([b, g]);
		c = mergeColumns(c, b, g);
		expect(c.columns).toHaveLength(1);
		expect(c.columns[0].refs.map((r) => r.id)).toEqual(['wacom.pen.kp504e', 'wacom.pen.acp500']);
	});

	it('renames, and clearing the name falls back to the default', () => {
		let c = newGroup(emptyComparison('tablets'));
		const id = c.columns[0].id;
		c = renameColumn(c, id, '  Mediums ');
		expect(c.columns[0].name).toBe('Mediums');
		c = renameColumn(c, id, '   ');
		expect(c.columns[0].name).toBeUndefined();
	});
});

describe('parseComparison', () => {
	it('keeps a valid stored comparison and normalises ids', () => {
		const stored = {
			kind: 'pens',
			seq: 3,
			columns: [{ id: 'c1', refs: [{ type: 'unit', id: 'WAP.0030' }], excluded: [] }],
		};
		expect(parseComparison(stored, 'pens').columns[0].refs).toEqual([
			{ type: 'unit', id: 'wap.0030' },
		]);
	});

	it('falls back to empty on the wrong kind, junk, or malformed columns', () => {
		expect(parseComparison(null, 'pens').columns).toEqual([]);
		expect(parseComparison({ kind: 'tablets', columns: [] }, 'pens').kind).toBe('pens');
		const bad = {
			kind: 'pens',
			columns: [{ id: 'c1', refs: [{ type: 'laser', id: 'x' }] }, { nope: 1 }],
		};
		expect(parseComparison(bad, 'pens').columns).toEqual([]);
	});
});
