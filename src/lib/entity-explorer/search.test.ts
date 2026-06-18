import { describe, it, expect } from 'vitest';
import type { AnyFieldDisplayDef } from '@thesevenpens/queriton';
import { applyQuickFilters, applyOwnedOnly, applyTextSearch } from './search.js';

const field = (key: string): AnyFieldDisplayDef =>
	({
		key,
		label: key,
		type: 'string',
		group: '',
		getValue: (r: unknown) => String((r as Record<string, unknown>)[key] ?? ''),
	}) as unknown as AnyFieldDisplayDef;

const rows = [
	{ Brand: 'WACOM', Name: 'Pro Pen', Units: '2' },
	{ Brand: 'HUION', Name: 'PW100', Units: '0' },
	{ Brand: 'WACOM', Name: 'Grip Pen', Units: '' },
];

describe('applyQuickFilters', () => {
	it('keeps rows matching every active filter', () => {
		expect(
			applyQuickFilters(rows, { Brand: 'WACOM' }, [field('Brand')]).map((r) => r.Name),
		).toEqual(['Pro Pen', 'Grip Pen']);
	});
	it('ignores blank-valued filters (returns all)', () => {
		expect(applyQuickFilters(rows, { Brand: '' }, [field('Brand')])).toHaveLength(3);
	});
});

describe('applyOwnedOnly', () => {
	it('keeps only rows whose counter field is > 0', () => {
		expect(applyOwnedOnly(rows, field('Units')).map((r) => r.Name)).toEqual(['Pro Pen']);
	});
	it('is a no-op when the field is undefined', () => {
		expect(applyOwnedOnly(rows, undefined)).toHaveLength(3);
	});
});

describe('applyTextSearch', () => {
	it('matches case-insensitively across the given defs', () => {
		expect(applyTextSearch(rows, 'PEN', [field('Name')]).map((r) => r.Name)).toEqual([
			'Pro Pen',
			'Grip Pen',
		]);
	});
	it('is a no-op for a blank query', () => {
		expect(applyTextSearch(rows, '   ', [field('Name')])).toHaveLength(3);
	});
});
