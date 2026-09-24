import { describe, expect, it } from 'vitest';
import { nextTabIndex } from './tab-keys.js';

describe('nextTabIndex', () => {
	it('moves right and left, wrapping at the ends', () => {
		expect(nextTabIndex(0, 3, 'ArrowRight')).toBe(1);
		expect(nextTabIndex(2, 3, 'ArrowRight')).toBe(0);
		expect(nextTabIndex(1, 3, 'ArrowLeft')).toBe(0);
		expect(nextTabIndex(0, 3, 'ArrowLeft')).toBe(2);
	});

	it('jumps with Home and End', () => {
		expect(nextTabIndex(1, 3, 'Home')).toBe(0);
		expect(nextTabIndex(1, 3, 'End')).toBe(2);
	});

	it('ignores other keys and empty lists', () => {
		expect(nextTabIndex(0, 3, 'Enter')).toBeNull();
		expect(nextTabIndex(0, 3, 'ArrowDown')).toBeNull();
		expect(nextTabIndex(0, 0, 'ArrowRight')).toBeNull();
	});
});
