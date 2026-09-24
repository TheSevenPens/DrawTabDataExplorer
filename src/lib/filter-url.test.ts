import { describe, expect, it } from 'vitest';
import { buildFilterUrl, parseFilterParams, type UrlFilter } from './filter-url.js';

function roundTrip(filters: UrlFilter[]): UrlFilter[] {
	const url = buildFilterUrl('/tablets', filters);
	return parseFilterParams(new URL(url, 'http://x').searchParams);
}

describe('buildFilterUrl', () => {
	it('encodes a single filter as filter=field:operator:value', () => {
		expect(buildFilterUrl('/tablets', [{ field: 'Brand', operator: 'eq', value: 'WACOM' }])).toBe(
			'/tablets?filter=Brand%3Aeq%3AWACOM',
		);
	});

	it('repeats the filter param for multiple filters', () => {
		const url = buildFilterUrl('/tablets', [
			{ field: 'Brand', operator: 'eq', value: 'WACOM' },
			{ field: 'Year', operator: 'gte', value: '2020' },
		]);
		expect(url).toBe('/tablets?filter=Brand%3Aeq%3AWACOM&filter=Year%3Agte%3A2020');
	});
});

describe('parseFilterParams', () => {
	it('defaults a missing operator to == and drops entries with no field', () => {
		const params = new URLSearchParams('filter=Brand&filter=:==:x');
		expect(parseFilterParams(params)).toEqual([{ field: 'Brand', operator: '==', value: '' }]);
	});
});

describe('round trip', () => {
	it('preserves reserved characters in values (#334)', () => {
		const filters = [
			{ field: 'ModelName', operator: 'contains', value: 'A&B #2 + 50% / ?x=y' },
			{ field: 'Notes', operator: '==', value: 'time: 10:30' },
			{ field: 'ModelId', operator: 'empty', value: '' },
		];
		expect(roundTrip(filters)).toEqual(filters);
	});
});
