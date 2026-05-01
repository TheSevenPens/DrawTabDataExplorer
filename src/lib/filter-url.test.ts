import { describe, expect, it } from 'vitest';
import { buildFilterUrl, buildFilterUrlForValues } from './filter-url.js';

describe('buildFilterUrl', () => {
	it('encodes a single filter as filter=field:operator:value', () => {
		expect(buildFilterUrl('/tablets', [{ field: 'Brand', operator: 'eq', value: 'WACOM' }])).toBe(
			'/tablets?filter=Brand:eq:WACOM',
		);
	});

	it('joins multiple filters with &', () => {
		const url = buildFilterUrl('/tablets', [
			{ field: 'Brand', operator: 'eq', value: 'WACOM' },
			{ field: 'Year', operator: 'gte', value: '2020' },
		]);
		expect(url).toBe('/tablets?filter=Brand:eq:WACOM&filter=Year:gte:2020');
	});

	it('returns just `?` when no filters are passed', () => {
		expect(buildFilterUrl('/tablets', [])).toBe('/tablets?');
	});
});

describe('buildFilterUrlForValues', () => {
	it('encodes values as filterIn=field:csv', () => {
		expect(buildFilterUrlForValues('/tablets', 'Brand', ['WACOM', 'HUION'])).toBe(
			'/tablets?filterIn=Brand%3AWACOM%2CHUION',
		);
	});

	it('handles a single value', () => {
		expect(buildFilterUrlForValues('/tablets', 'Brand', ['WACOM'])).toBe(
			'/tablets?filterIn=Brand%3AWACOM',
		);
	});
});
