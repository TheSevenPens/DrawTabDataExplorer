import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	getStorageItem,
	setStorageItem,
	removeStorageItem,
	getStorageJson,
	setStorageJson,
} from './storage.js';

afterEach(() => {
	localStorage.clear();
	vi.restoreAllMocks();
});

describe('getStorageItem', () => {
	it('returns the stored value', () => {
		localStorage.setItem('k', 'v');
		expect(getStorageItem('k')).toBe('v');
	});

	it('returns null for a missing key', () => {
		expect(getStorageItem('missing')).toBeNull();
	});

	it('returns null when localStorage throws', () => {
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new Error('boom');
		});
		expect(getStorageItem('k')).toBeNull();
	});
});

describe('setStorageItem', () => {
	it('returns true on success', () => {
		expect(setStorageItem('k', 'v')).toBe(true);
		expect(localStorage.getItem('k')).toBe('v');
	});

	it('returns false when localStorage throws (e.g. quota exceeded)', () => {
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('quota');
		});
		expect(setStorageItem('k', 'v')).toBe(false);
	});
});

describe('removeStorageItem', () => {
	it('removes the key and returns true', () => {
		localStorage.setItem('k', 'v');
		expect(removeStorageItem('k')).toBe(true);
		expect(localStorage.getItem('k')).toBeNull();
	});

	it('returns false when localStorage throws', () => {
		vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
			throw new Error('nope');
		});
		expect(removeStorageItem('k')).toBe(false);
	});
});

describe('getStorageJson', () => {
	it('parses valid JSON', () => {
		localStorage.setItem('k', JSON.stringify({ a: 1 }));
		expect(getStorageJson('k', null)).toEqual({ a: 1 });
	});

	it('returns the fallback when key is missing', () => {
		expect(getStorageJson('missing', { a: 0 })).toEqual({ a: 0 });
	});

	it('returns the fallback when stored value is empty string', () => {
		localStorage.setItem('k', '');
		expect(getStorageJson('k', 'fallback')).toBe('fallback');
	});

	it('returns the fallback when JSON is malformed', () => {
		localStorage.setItem('k', '{not json');
		expect(getStorageJson('k', null)).toBeNull();
	});
});

describe('setStorageJson', () => {
	it('stringifies and stores', () => {
		expect(setStorageJson('k', { a: 1 })).toBe(true);
		expect(localStorage.getItem('k')).toBe('{"a":1}');
	});

	it('returns false when localStorage throws', () => {
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('quota');
		});
		expect(setStorageJson('k', { a: 1 })).toBe(false);
	});
});
