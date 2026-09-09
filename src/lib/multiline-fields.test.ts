import { describe, it, expect } from 'vitest';
import type { AnyFieldDisplayDef } from '@thesevenpens/queriton';
import { inlineFields, multilineFieldValues } from './multiline-fields.js';

const FIELDS: AnyFieldDisplayDef[] = [
	{ key: 'Name', label: 'Name', getValue: (r) => r.Name ?? '', type: 'string', group: 'Model' },
	{
		key: 'Notes',
		label: 'Notes',
		getValue: (r) => r.Notes ?? '',
		type: 'string',
		group: 'Model',
		multiline: true,
	},
	{
		key: 'Extra',
		label: 'Extra',
		getValue: (r) => r.Extra ?? '',
		type: 'string',
		group: 'Model',
		multiline: true,
	},
];

describe('inlineFields', () => {
	it('drops the multiline fields', () => {
		expect(inlineFields(FIELDS).map((f) => f.key)).toEqual(['Name']);
	});

	it('leaves a list with no multiline fields untouched', () => {
		const plain = FIELDS.slice(0, 1);
		expect(inlineFields(plain)).toEqual(plain);
	});
});

describe('multilineFieldValues', () => {
	it('returns only multiline fields that have a value', () => {
		const rows = multilineFieldValues({ Name: 'KP-503E', Notes: 'a\nb' }, FIELDS);
		expect(rows).toEqual([{ key: 'Notes', label: 'Notes', value: 'a\nb' }]);
	});

	it('preserves interior whitespace verbatim', () => {
		const value = '# Heading\n\n    indented\ttab\n';
		const [row] = multilineFieldValues({ Notes: value }, FIELDS);
		expect(row.value).toBe(value);
	});

	it('treats a whitespace-only value as empty', () => {
		expect(multilineFieldValues({ Notes: '   \n\t ' }, FIELDS)).toEqual([]);
	});

	it('keeps field order and returns every populated field', () => {
		const rows = multilineFieldValues({ Notes: 'n', Extra: 'e' }, FIELDS);
		expect(rows.map((r) => r.key)).toEqual(['Notes', 'Extra']);
	});
});
