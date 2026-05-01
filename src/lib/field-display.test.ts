import { describe, expect, it } from 'vitest';
import { stripUnit, valueSuffix, formatValueWithAlt } from './field-display.js';

describe('stripUnit', () => {
	it('removes a parenthesized unit when an explicit unit is supplied', () => {
		expect(stripUnit('Weight (g)', 'g')).toBe('Weight');
	});

	it('removes a parenthesized unit when it is one of the known label units', () => {
		expect(stripUnit('Width (mm)', undefined)).toBe('Width');
		expect(stripUnit('Refresh (Hz)', undefined)).toBe('Refresh');
	});

	it('leaves the label alone when the parenthesized text is not a known unit', () => {
		expect(stripUnit('Notes (extra info)', undefined)).toBe('Notes (extra info)');
	});

	it('leaves the label alone when there is no parenthesized suffix', () => {
		expect(stripUnit('Brand', undefined)).toBe('Brand');
	});
});

describe('valueSuffix', () => {
	it('returns the metric unit in metric mode', () => {
		expect(valueSuffix('Weight (g)', 'g', 'metric')).toBe(' g');
	});

	it('switches to the imperial unit in imperial mode', () => {
		// Don't hardcode the imperial unit (it's owned by data-repo's unit
		// table — could be oz or lbs depending on conversion rules). Just
		// assert it isn't ' g'.
		expect(valueSuffix('Weight (g)', 'g', 'imperial')).not.toBe(' g');
	});

	it('falls back to a parenthesized known label unit when no unit is supplied', () => {
		expect(valueSuffix('Refresh (Hz)', undefined, 'metric')).toBe(' Hz');
	});

	it('returns an empty suffix when no unit is supplied and label has no known unit', () => {
		expect(valueSuffix('Brand', undefined, 'metric')).toBe('');
	});
});

describe('formatValueWithAlt', () => {
	it('returns the raw value unchanged for empty or "-"', () => {
		expect(formatValueWithAlt('', 'Weight (g)', 'g', 'metric')).toBe('');
		expect(formatValueWithAlt('-', 'Weight (g)', 'g', 'metric')).toBe('-');
	});

	it('formats a convertible unit with primary + alt by default', () => {
		const out = formatValueWithAlt('660', 'Weight (g)', 'g', 'metric');
		expect(out).toContain('660 g');
		// Alt portion is parenthesized; don't hardcode oz vs lbs.
		expect(out).toMatch(/\(.+\)/);
	});

	it('omits the alt when showAlt=false', () => {
		expect(formatValueWithAlt('660', 'Weight (g)', 'g', 'metric', false)).toBe('660 g');
	});

	it('formats px/mm as px/cm in metric and PPI in imperial', () => {
		expect(formatValueWithAlt('20', 'Density (px/mm)', 'px/mm', 'metric', false)).toContain(
			'px/cm',
		);
		expect(formatValueWithAlt('20', 'Density (px/mm)', 'px/mm', 'imperial', false)).toContain(
			'PPI',
		);
	});

	it('shows both px/cm and PPI when showAlt=true', () => {
		const metric = formatValueWithAlt('20', 'Density (px/mm)', 'px/mm', 'metric');
		expect(metric).toContain('px/cm');
		expect(metric).toContain('PPI');
	});

	it('returns just the primary when no convertible unit is involved', () => {
		expect(formatValueWithAlt('60', 'Refresh (Hz)', 'Hz', 'metric')).toBe('60 Hz');
	});
});
