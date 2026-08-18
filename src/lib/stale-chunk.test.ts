import { describe, it, expect } from 'vitest';
import {
	isStaleChunkError,
	shouldReloadForStaleChunk,
	STALE_CHUNK_RELOAD_KEY,
	STALE_CHUNK_RELOAD_COOLDOWN_MS,
	type StorageLike,
} from './stale-chunk.js';

function fakeStorage(initial?: string): StorageLike & { store: Map<string, string> } {
	const store = new Map<string, string>();
	if (initial !== undefined) store.set(STALE_CHUNK_RELOAD_KEY, initial);
	return {
		store,
		getItem: (k) => store.get(k) ?? null,
		setItem: (k, v) => void store.set(k, v),
	};
}

describe('isStaleChunkError', () => {
	it('matches the wording each engine uses for a missing chunk', () => {
		// Chrome/Edge, Firefox, Safari, Vite's CSS preload helper.
		expect(
			isStaleChunkError(
				new Error('Failed to fetch dynamically imported module: https://x/_app/a.js'),
			),
		).toBe(true);
		expect(isStaleChunkError(new Error('error loading dynamically imported module'))).toBe(true);
		expect(isStaleChunkError(new Error('Importing a module script failed.'))).toBe(true);
		expect(isStaleChunkError(new Error('Unable to preload CSS for /_app/b.css'))).toBe(true);
	});

	it('accepts a bare string as well as an Error', () => {
		expect(isStaleChunkError('Failed to fetch dynamically imported module')).toBe(true);
	});

	it('ignores unrelated errors, and anything with no message', () => {
		expect(isStaleChunkError(new Error('Not found: wacom.tablet.nope'))).toBe(false);
		expect(isStaleChunkError(new Error(''))).toBe(false);
		expect(isStaleChunkError(undefined)).toBe(false);
		expect(isStaleChunkError({ message: 'Failed to fetch dynamically imported module' })).toBe(
			false,
		);
	});
});

describe('shouldReloadForStaleChunk', () => {
	const staleError = new Error('Failed to fetch dynamically imported module: /_app/a.js');

	it('reloads on the first stale-chunk error and records the attempt', () => {
		const storage = fakeStorage();
		expect(shouldReloadForStaleChunk(staleError, storage, 1_000_000)).toBe(true);
		expect(storage.store.get(STALE_CHUNK_RELOAD_KEY)).toBe('1000000');
	});

	it('refuses a second reload inside the cooldown — the chunk is really gone', () => {
		const storage = fakeStorage();
		const now = 1_000_000;
		expect(shouldReloadForStaleChunk(staleError, storage, now)).toBe(true);
		expect(shouldReloadForStaleChunk(staleError, storage, now + 1)).toBe(false);
		expect(shouldReloadForStaleChunk(staleError, storage, now + 59_999)).toBe(false);
	});

	it('allows another reload once the cooldown lapses — a later deploy is a new event', () => {
		const storage = fakeStorage();
		const now = 1_000_000;
		shouldReloadForStaleChunk(staleError, storage, now);
		expect(
			shouldReloadForStaleChunk(staleError, storage, now + STALE_CHUNK_RELOAD_COOLDOWN_MS),
		).toBe(true);
	});

	it('never reloads for an unrelated error', () => {
		const storage = fakeStorage();
		expect(shouldReloadForStaleChunk(new Error('boom'), storage, 1_000_000)).toBe(false);
		expect(storage.store.size).toBe(0);
	});

	it('never reloads without storage — a loop is worse than the error page', () => {
		expect(shouldReloadForStaleChunk(staleError, null, 1_000_000)).toBe(false);
	});

	it('treats a junk stored timestamp as no prior attempt', () => {
		const storage = fakeStorage('not-a-number');
		expect(shouldReloadForStaleChunk(staleError, storage, 1_000_000)).toBe(true);
	});
});
