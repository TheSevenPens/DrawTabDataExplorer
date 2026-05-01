// Centralized data-access layer.
//
// Pages and components should fetch through these wrappers rather than
// calling `loadXFromURL` directly. Two reasons:
//   1. Promise dedup — concurrent calls for the same dataset share one
//      in-flight request.
//   2. Typed errors — DataNotFoundError / DataDecodeError / DataNetworkError
//      surface the failure mode so the UI can branch instead of showing
//      a generic loading spinner forever.
//
// The underlying loader behavior is unchanged; this is a thin shim that
// can grow into a richer layer (cache invalidation, ETag handling,
// schema migration hooks, etc.) without rewriting every caller.

import { base } from '$app/paths';
import {
	loadTabletsFromURL,
	loadPensFromURL,
	loadPenFamiliesFromURL,
	loadTabletFamiliesFromURL,
	loadPenCompatFromURL,
	loadDriversFromURL,
	loadPressureResponseFromURL,
	loadBrandsFromURL,
	loadVersionFromURL,
	loadISOPaperSizesFromURL,
	loadUSPaperSizesFromURL,
	type Tablet,
	type Pen,
	type PenFamily,
	type TabletFamily,
	type PenCompat,
	type Driver,
	type PressureResponse,
	type Brand,
	type VersionInfo,
	type ISOPaperSize,
	type USPaperSize,
} from '$data/lib/drawtab-loader.js';
import { loadAllData, type AllData } from '$lib/load-all-data.js';
import { DataNetworkError, DataDecodeError, DataNotFoundError } from './errors.js';

export {
	DataNotFoundError,
	DataDecodeError,
	DataNetworkError,
	isDataError,
	type DataError,
} from './errors.js';

// Per-dataset Promise<T> cache. The first call kicks off the fetch; later
// callers reuse the same promise until it settles. We keep settled promises
// indefinitely (data doesn't change between sessions). Call `invalidate(key)`
// to drop a cache entry — useful for the "use local data toggle" flow.
const cache = new Map<string, Promise<unknown>>();

export function invalidate(key?: string): void {
	if (key === undefined) {
		cache.clear();
	} else {
		cache.delete(key);
	}
}

/** Wrap a loader in: cache lookup + typed-error normalization. */
async function fetchOnce<T>(key: string, loader: () => Promise<T>): Promise<T> {
	const cached = cache.get(key);
	if (cached) return cached as Promise<T>;

	const promise = (async () => {
		try {
			return await loader();
		} catch (err) {
			// Drop the failed promise so a retry isn't poisoned.
			cache.delete(key);
			if (err instanceof SyntaxError) {
				throw new DataDecodeError(key, err);
			}
			if (err instanceof TypeError) {
				// fetch() throws TypeError on network failure (CORS, offline, etc).
				throw new DataNetworkError(key, err);
			}
			throw err;
		}
	})();

	cache.set(key, promise);
	return promise;
}

/** Wrap a loader that returns null/empty for "missing" into one that throws
 *  DataNotFoundError. Use for endpoints where missing data is a real
 *  failure rather than the empty case. */
async function requireFound<T>(key: string, value: T | null | undefined): Promise<T> {
	if (value == null) throw new DataNotFoundError(key);
	return value;
}

// --- Public API ---------------------------------------------------------

export const fetchTablets = (): Promise<Tablet[]> =>
	fetchOnce('tablets', () => loadTabletsFromURL(base));

export const fetchPens = (): Promise<Pen[]> => fetchOnce('pens', () => loadPensFromURL(base));

export const fetchPenFamilies = (): Promise<PenFamily[]> =>
	fetchOnce('pen-families', () => loadPenFamiliesFromURL(base));

export const fetchTabletFamilies = (): Promise<TabletFamily[]> =>
	fetchOnce('tablet-families', () => loadTabletFamiliesFromURL(base));

export const fetchPenCompat = (): Promise<PenCompat[]> =>
	fetchOnce('pen-compat', () => loadPenCompatFromURL(base));

export const fetchDrivers = (): Promise<Driver[]> =>
	fetchOnce('drivers', () => loadDriversFromURL(base));

export const fetchPressureResponse = (): Promise<PressureResponse[]> =>
	fetchOnce('pressure-response', () => loadPressureResponseFromURL(base));

export const fetchBrands = (): Promise<Brand[]> =>
	fetchOnce('brands', () => loadBrandsFromURL(base));

export const fetchISOPaperSizes = (): Promise<ISOPaperSize[]> =>
	fetchOnce('iso-paper-sizes', () => loadISOPaperSizesFromURL(base));

export const fetchUSPaperSizes = (): Promise<USPaperSize[]> =>
	fetchOnce('us-paper-sizes', () => loadUSPaperSizesFromURL(base));

/** Throws DataNotFoundError when version.json is missing/unreadable. */
export const fetchVersion = (): Promise<VersionInfo> =>
	fetchOnce('version', async () => requireFound('version', await loadVersionFromURL(base)));

/** Bundle of every dataset, fetched in parallel. */
export const fetchAllData = (): Promise<AllData> => fetchOnce('all', () => loadAllData(base));

export type {
	Tablet,
	Pen,
	PenFamily,
	TabletFamily,
	PenCompat,
	Driver,
	PressureResponse,
	Brand,
	VersionInfo,
	ISOPaperSize,
	USPaperSize,
	AllData,
};
