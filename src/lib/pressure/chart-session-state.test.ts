import { describe, expect, it } from 'vitest';
import { groupForEnvelope, toggleInSet } from './chart-session-state';

describe('groupForEnvelope', () => {
	it('one group per key, in first-seen order, coloured by its first session', () => {
		const groups = groupForEnvelope([
			{ id: 1, group: 'b', color: '#b' },
			{ id: 2, group: 'a', color: '#a' },
			{ id: 3, group: 'b', color: '#b' },
		]);
		expect(groups.map((g) => [g.key, g.color, g.sessions.map((s) => s.id)])).toEqual([
			['b', '#b', [1, 3]],
			['a', '#a', [2]],
		]);
	});

	it('ungrouped sessions make a single envelope, as before groups existed', () => {
		const groups = groupForEnvelope([{ id: 1 }, { id: 2, color: '#x' }]);
		expect(groups).toHaveLength(1);
		expect(groups[0].key).toBe('');
		expect(groups[0].sessions).toHaveLength(2);
	});
});

describe('toggleInSet', () => {
	it('returns a new set with the id flipped', () => {
		const a = new Set([1]);
		const b = toggleInSet(a, 2);
		expect(b).not.toBe(a);
		expect([...toggleInSet(b, 1)]).toEqual([2]);
	});
});
