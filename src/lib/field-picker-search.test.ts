import { describe, it, expect } from 'vitest';
import {
	fieldLabelBoldWhenKeyMatch,
	fieldMatchesQuery,
	highlightFieldLabel,
} from './field-picker-search.js';

describe('fieldMatchesQuery', () => {
	it('matches label substring case-insensitively', () => {
		expect(fieldMatchesQuery({ label: 'Launch year', key: 'ModelLaunchYear' }, 'year')).toBe(true);
	});

	it('matches field key', () => {
		expect(fieldMatchesQuery({ label: 'Brand', key: 'Brand' }, 'brand')).toBe(true);
	});

	it('returns false for empty query', () => {
		expect(fieldMatchesQuery({ label: 'Brand', key: 'Brand' }, '  ')).toBe(false);
	});
});

describe('highlightFieldLabel', () => {
	it('marks the matching substring', () => {
		expect(highlightFieldLabel('Launch year', 'year')).toEqual([
			{ text: 'Launch ', match: false },
			{ text: 'year', match: true },
		]);
	});

	it('returns one non-match segment when query is absent in label', () => {
		expect(highlightFieldLabel('Brand', 'zzz')).toEqual([{ text: 'Brand', match: false }]);
	});
});

describe('fieldLabelBoldWhenKeyMatch', () => {
	it('is true when only the key matches', () => {
		expect(
			fieldLabelBoldWhenKeyMatch({ label: 'Launch year', key: 'ModelLaunchYear' }, 'modellaunch'),
		).toBe(true);
	});

	it('is false when the label already matches', () => {
		expect(fieldLabelBoldWhenKeyMatch({ label: 'Brand', key: 'Brand' }, 'brand')).toBe(false);
	});
});
