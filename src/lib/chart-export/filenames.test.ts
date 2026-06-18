import { describe, it, expect } from 'vitest';
import { slugify, dateStamp, datedFilename } from './filenames.js';

describe('slugify', () => {
	it('lowercases and replaces runs of non-alphanumerics with a single dash', () => {
		expect(slugify('Wacom Pro Pen 2 (KP-504E)')).toBe('wacom-pro-pen-2-kp-504e');
	});
	it('trims leading/trailing dashes', () => {
		expect(slugify('  — IAF range — ')).toBe('iaf-range');
	});
	it('returns empty string for all-symbol input', () => {
		expect(slugify('—/—')).toBe('');
	});
});

describe('dateStamp', () => {
	it('formats a given date as YYYY-MM-DD', () => {
		expect(dateStamp(new Date('2026-06-17T12:34:56Z'))).toBe('2026-06-17');
	});
});

describe('datedFilename', () => {
	it('appends the date stamp and extension, using base as-is', () => {
		expect(datedFilename('iaf-summary-kp504e', 'csv')).toMatch(
			/^iaf-summary-kp504e-\d{4}-\d{2}-\d{2}\.csv$/,
		);
	});
});
