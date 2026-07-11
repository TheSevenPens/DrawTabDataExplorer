import { describe, it, expect } from 'vitest';
import { fieldOptionLabel, fieldOptionLabelForKey } from './field-option-label.js';

const tabletFields = [
	{ key: 'Brand', label: 'Brand', group: 'Model' },
	{ key: 'DigitizerDensity', label: 'Density (LPmm)', group: 'Digitizer' },
	{ key: 'DisplayDensity', label: 'Density (px/mm)', group: 'Display' },
];

describe('fieldOptionLabel', () => {
	it('prefixes group for all fields that have one', () => {
		expect(fieldOptionLabel(tabletFields[0])).toBe('Model · Brand');
		expect(fieldOptionLabel(tabletFields[1])).toBe('Digitizer · Density (LPmm)');
		expect(fieldOptionLabel(tabletFields[2])).toBe('Display · Density (px/mm)');
	});

	it('falls back to plain label without a group', () => {
		expect(fieldOptionLabel({ key: 'Foo', label: 'Foo' })).toBe('Foo');
	});
});

describe('fieldOptionLabelForKey', () => {
	it('looks up by key', () => {
		expect(fieldOptionLabelForKey('DisplayDensity', tabletFields)).toBe(
			'Display · Density (px/mm)',
		);
		expect(fieldOptionLabelForKey('missing', tabletFields)).toBe('missing');
	});
});
