import { describe, it, expect } from 'vitest';
import { isCompleteBuilderFilter, completeBuilderFilters } from './filter-complete.js';

describe('isCompleteBuilderFilter', () => {
	it('accepts filters with operator and value', () => {
		expect(isCompleteBuilderFilter({ field: 'Brand', operator: '==', value: 'WACOM' })).toBe(true);
	});

	it('rejects empty value for value-requiring operators', () => {
		expect(isCompleteBuilderFilter({ field: 'Brand', operator: '==', value: '' })).toBe(false);
		expect(isCompleteBuilderFilter({ field: 'Brand', operator: 'contains', value: '  ' })).toBe(
			false,
		);
	});

	it('accepts empty/notempty without a value', () => {
		expect(isCompleteBuilderFilter({ field: 'Brand', operator: 'empty', value: '' })).toBe(true);
	});

	it('rejects filterIn with no values', () => {
		expect(isCompleteBuilderFilter({ field: 'Brand', operator: 'in', value: ' , ' })).toBe(false);
		expect(isCompleteBuilderFilter({ field: 'Brand', operator: 'in', value: 'WACOM' })).toBe(true);
	});

	it('ignores disabled filters', () => {
		expect(
			isCompleteBuilderFilter({ field: 'Brand', operator: '==', value: 'WACOM', disabled: true }),
		).toBe(false);
	});
});

describe('completeBuilderFilters', () => {
	it('keeps only complete rows', () => {
		const filters = [
			{ field: 'Brand', operator: '==', value: 'WACOM' },
			{ field: 'ModelId', operator: '==', value: '' },
		];
		expect(completeBuilderFilters(filters)).toEqual([filters[0]]);
	});
});
