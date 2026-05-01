// Tests cover the layer's behavior — error normalization, dedup, cache
// invalidation. We mock the underlying URL loaders since unit tests
// shouldn't touch the filesystem or network.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$data/lib/drawtab-loader.js', () => {
	const mock = vi.fn();
	return {
		loadTabletsFromURL: mock,
		loadPensFromURL: vi.fn(async () => []),
		loadPenFamiliesFromURL: vi.fn(async () => []),
		loadTabletFamiliesFromURL: vi.fn(async () => []),
		loadPenCompatFromURL: vi.fn(async () => []),
		loadDriversFromURL: vi.fn(async () => []),
		loadPressureResponseFromURL: vi.fn(async () => []),
		loadBrandsFromURL: vi.fn(async () => []),
		loadVersionFromURL: vi.fn(async () => null),
		loadISOPaperSizesFromURL: vi.fn(async () => []),
		loadUSPaperSizesFromURL: vi.fn(async () => []),
	};
});
vi.mock('$lib/load-all-data.js', () => ({
	loadAllData: vi.fn(async () => ({})),
}));

import { loadTabletsFromURL, loadVersionFromURL } from '$data/lib/drawtab-loader.js';
import {
	fetchTablets,
	fetchVersion,
	invalidate,
	DataNotFoundError,
	DataDecodeError,
	DataNetworkError,
	isDataError,
} from './index.js';

beforeEach(() => {
	invalidate();
	vi.mocked(loadTabletsFromURL).mockReset();
	vi.mocked(loadVersionFromURL).mockReset();
});

afterEach(() => {
	invalidate();
});

describe('Promise dedup', () => {
	it('shares one in-flight request between concurrent callers', async () => {
		vi.mocked(loadTabletsFromURL).mockResolvedValue([{ id: 'a' }] as never);
		const [a, b] = await Promise.all([fetchTablets(), fetchTablets()]);
		expect(a).toBe(b);
		expect(loadTabletsFromURL).toHaveBeenCalledTimes(1);
	});

	it('serves cached results to later callers', async () => {
		vi.mocked(loadTabletsFromURL).mockResolvedValue([] as never);
		await fetchTablets();
		await fetchTablets();
		await fetchTablets();
		expect(loadTabletsFromURL).toHaveBeenCalledTimes(1);
	});

	it('invalidate(key) clears just that entry', async () => {
		vi.mocked(loadTabletsFromURL).mockResolvedValue([] as never);
		await fetchTablets();
		invalidate('tablets');
		await fetchTablets();
		expect(loadTabletsFromURL).toHaveBeenCalledTimes(2);
	});

	it('invalidate() with no args clears the entire cache', async () => {
		vi.mocked(loadTabletsFromURL).mockResolvedValue([] as never);
		await fetchTablets();
		invalidate();
		await fetchTablets();
		expect(loadTabletsFromURL).toHaveBeenCalledTimes(2);
	});
});

describe('Typed error normalization', () => {
	it('wraps SyntaxError as DataDecodeError', async () => {
		vi.mocked(loadTabletsFromURL).mockRejectedValue(new SyntaxError('bad json'));
		await expect(fetchTablets()).rejects.toBeInstanceOf(DataDecodeError);
	});

	it('wraps TypeError as DataNetworkError', async () => {
		vi.mocked(loadTabletsFromURL).mockRejectedValue(new TypeError('Failed to fetch'));
		await expect(fetchTablets()).rejects.toBeInstanceOf(DataNetworkError);
	});

	it('throws DataNotFoundError when version.json is null/missing', async () => {
		vi.mocked(loadVersionFromURL).mockResolvedValue(null);
		await expect(fetchVersion()).rejects.toBeInstanceOf(DataNotFoundError);
	});

	it('drops a failed promise so a retry actually retries', async () => {
		vi.mocked(loadTabletsFromURL)
			.mockRejectedValueOnce(new TypeError('offline'))
			.mockResolvedValueOnce([{ id: 'recovered' }] as never);
		await expect(fetchTablets()).rejects.toBeInstanceOf(DataNetworkError);
		const second = await fetchTablets();
		expect(second).toEqual([{ id: 'recovered' }]);
		expect(loadTabletsFromURL).toHaveBeenCalledTimes(2);
	});

	it('isDataError() narrows to the union type', () => {
		expect(isDataError(new DataNotFoundError('x'))).toBe(true);
		expect(isDataError(new DataDecodeError('x'))).toBe(true);
		expect(isDataError(new DataNetworkError('x'))).toBe(true);
		expect(isDataError(new Error('regular'))).toBe(false);
		expect(isDataError(null)).toBe(false);
	});
});
