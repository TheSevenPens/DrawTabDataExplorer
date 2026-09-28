import { describe, expect, it } from 'vitest';
import {
	buildFilterUrl,
	buildFilterParams,
	parseFilterParams,
	parseSortParams,
	parseColumnParams,
	type UrlFilter,
} from './filter-url.js';

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
	it('preserves sorting and visible columns in a ranked-list link', () => {
		const filters = [{ field: 'ModelType', operator: '==', value: 'PENTABLET' }];
		const sorts = [{ field: 'DigitizerActiveAreaMm2', direction: 'desc' as const }];
		const columns = ['ModelName', 'DigitizerDimensions', 'DigitizerActiveAreaCm2'];
		const params = buildFilterParams(filters, { sorts, columns });
		expect(parseFilterParams(params)).toEqual(filters);
		expect(parseSortParams(params)).toEqual(sorts);
		expect(parseColumnParams(params)).toEqual(columns);
	});

	it('ignores malformed sorts and deduplicates columns', () => {
		const params = new URLSearchParams();
		for (const sort of ['Name', ':desc', 'Name:down', 'Name:asc:', 'Year:desc:extra', 'Name:asc'])
			params.append('sort', sort);
		for (const column of ['', 'ModelName', 'ModelName', 'ModelId']) params.append('column', column);
		expect(parseSortParams(params)).toEqual([{ field: 'Name', direction: 'asc' }]);
		expect(parseColumnParams(params)).toEqual(['ModelName', 'ModelId']);
	});

	it('preserves reserved characters in values (#334)', () => {
		const filters = [
			{ field: 'ModelName', operator: 'contains', value: 'A&B #2 + 50% / ?x=y' },
			{ field: 'Notes', operator: '==', value: 'time: 10:30' },
			{ field: 'ModelId', operator: 'empty', value: '' },
		];
		expect(roundTrip(filters)).toEqual(filters);
	});
});

describe('renamed field keys in deep links', () => {
	it('maps a pre-rename key in filter, sort and column params to the current key', () => {
		const params = new URLSearchParams(
			'filter=DigitizerSupportsTouch:==:YES&sort=DigitizerSupportsTouch:desc&column=DigitizerSupportsTouch',
		);
		expect(parseFilterParams(params)).toEqual([
			{ field: 'OtherInputsTouch', operator: '==', value: 'YES' },
		]);
		expect(parseSortParams(params)).toEqual([{ field: 'OtherInputsTouch', direction: 'desc' }]);
		expect(parseColumnParams(params)).toEqual(['OtherInputsTouch']);
	});
});
