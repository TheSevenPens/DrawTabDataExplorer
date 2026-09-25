import { describe, expect, it } from 'vitest';
import { selectionState, setAll, toggleOne } from './selection';

describe('row selection', () => {
	it('select-all touches only the shown rows and returns a new set', () => {
		const before = new Set(['hidden']);
		const after = setAll(before, ['a', 'b'], true);
		expect(after).not.toBe(before);
		expect([...after].sort()).toEqual(['a', 'b', 'hidden']);
		expect([...setAll(after, ['a', 'b'], false)]).toEqual(['hidden']);
	});

	it('reports none / some / all of the shown rows', () => {
		const s = new Set(['a', 'x']);
		expect(selectionState(s, ['b', 'c'])).toBe('none');
		expect(selectionState(s, ['a', 'b'])).toBe('some');
		expect(selectionState(s, ['a'])).toBe('all');
	});

	it('toggles one row', () => {
		expect([...toggleOne(new Set(['a']), 'a')]).toEqual([]);
		expect([...toggleOne(new Set(), 'a')]).toEqual(['a']);
	});
});
