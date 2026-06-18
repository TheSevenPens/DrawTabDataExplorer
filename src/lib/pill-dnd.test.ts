import { describe, it, expect } from 'vitest';
import { computeDropIndex, moveItem } from './pill-dnd.js';

describe('computeDropIndex', () => {
	it('drops on the left side at that index (no earlier removal)', () => {
		expect(computeDropIndex(2, 0, 'left')).toBe(0);
		expect(computeDropIndex(2, 1, 'left')).toBe(1);
	});
	it('drops on the right side after that index', () => {
		expect(computeDropIndex(0, 2, 'right')).toBe(2); // 3, minus 1 for earlier removal
		expect(computeDropIndex(3, 1, 'right')).toBe(2);
	});
	it('decrements when the dragged item sat before the target (index shift)', () => {
		expect(computeDropIndex(0, 1, 'left')).toBe(0);
		expect(computeDropIndex(0, 1, 'right')).toBe(1);
	});
	it('never returns a negative index', () => {
		expect(computeDropIndex(5, 0, 'left')).toBe(0);
	});
});

describe('moveItem', () => {
	it('moves an item to the end (drop right of last)', () => {
		expect(moveItem(['a', 'b', 'c'], 0, 2, 'right')).toEqual(['b', 'c', 'a']);
	});
	it('moves an item to the front (drop left of first)', () => {
		expect(moveItem(['a', 'b', 'c'], 2, 0, 'left')).toEqual(['c', 'a', 'b']);
	});
	it('reorders within the middle', () => {
		expect(moveItem(['a', 'b', 'c'], 0, 1, 'right')).toEqual(['b', 'a', 'c']);
	});
	it('is a no-op when dropped just left of its own slot', () => {
		expect(moveItem(['a', 'b', 'c'], 0, 1, 'left')).toEqual(['a', 'b', 'c']);
	});
	it('returns an unchanged copy when from === over', () => {
		const input = ['a', 'b', 'c'];
		const out = moveItem(input, 1, 1, 'left');
		expect(out).toEqual(['a', 'b', 'c']);
		expect(out).not.toBe(input); // pure: new array
	});
	it('returns an unchanged copy for an out-of-range index', () => {
		expect(moveItem(['a', 'b'], 5, 0, 'left')).toEqual(['a', 'b']);
	});
	it('does not mutate the input', () => {
		const input = ['a', 'b', 'c'];
		moveItem(input, 0, 2, 'right');
		expect(input).toEqual(['a', 'b', 'c']);
	});
});
