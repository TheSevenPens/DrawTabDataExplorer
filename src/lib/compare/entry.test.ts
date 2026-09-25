import { describe, expect, it } from 'vitest';
import { addAsGroup, addMissing, holds, startWith } from './entry';
import { MAX_COLUMNS, addRef, emptyComparison } from './model';

const model = (id: string) => ({ type: 'model' as const, id });
const family = (id: string) => ({ type: 'family' as const, id });

describe('compare entry points', () => {
	it('adding what is already there does nothing', () => {
		const c = addMissing(emptyComparison('tablets'), [model('a')]);
		expect(addMissing(c, [model('A')])).toEqual(c);
		expect(holds(c, model('a'))).toBe(true);
		expect(holds(c, family('a'))).toBe(false);
	});

	it('a ref inside a group counts as held', () => {
		let c = addRef(emptyComparison('pens'), model('a'));
		c = addRef(c, model('b'), c.columns[0].id);
		expect(holds(c, model('b'))).toBe(true);
		expect(addMissing(c, [model('b'), family('f')]).columns).toHaveLength(2);
	});

	it('starting fresh replaces the comparison and respects the cap', () => {
		const ids = Array.from({ length: MAX_COLUMNS + 2 }, (_, i) => model(`m${i}`));
		const c = startWith('tablets', ids);
		expect(c.columns).toHaveLength(MAX_COLUMNS);
		expect(c.columns[0].refs).toEqual([model('m0')]);
	});

	it('adds a selection as one named group, beyond the column cap in size', () => {
		const many = Array.from({ length: MAX_COLUMNS + 3 }, (_, i) => model(`m${i}`));
		const c = addAsGroup(emptyComparison('tablets'), many);
		expect(c.columns).toHaveLength(1);
		expect(c.columns[0].name).toBe('Group 1');
		expect(c.columns[0].refs).toHaveLength(MAX_COLUMNS + 3);
		expect(addAsGroup(c, [])).toBe(c);
	});
});
