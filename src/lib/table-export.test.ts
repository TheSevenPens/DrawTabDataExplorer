import { describe, expect, it } from 'vitest';
import {
	cellString,
	tableFromArrays,
	toCSV,
	toHTML,
	toJSON,
	toMarkdown,
	uniqueKeys,
} from './table-export.js';

// The #329 case: comparing CTL-4100 and CTL-490, both "Wacom Intuos Small".
const dup = tableFromArrays(
	['Field', 'Wacom Intuos Small', 'Wacom Intuos Small'],
	[
		['Release year', 2018, 2015],
		['Pressure levels', 4096, 1024],
	],
);

describe('tableFromArrays', () => {
	it('keeps same-headed columns distinct', () => {
		expect(dup.rows).toEqual([
			['Release year', '2018', '2015'],
			['Pressure levels', '4096', '1024'],
		]);
	});

	it('pads short rows and blanks null/undefined', () => {
		const t = tableFromArrays(['A', 'B', 'C'], [['x', null as unknown as string]]);
		expect(t.rows).toEqual([['x', '', '']]);
	});
});

describe('duplicate headings survive every format', () => {
	it('CSV', () => {
		expect(toCSV(dup)).toBe(
			'Field,Wacom Intuos Small,Wacom Intuos Small\n' +
				'Release year,2018,2015\n' +
				'Pressure levels,4096,1024',
		);
	});

	it('JSON disambiguates the repeated key instead of overwriting', () => {
		expect(JSON.parse(toJSON(dup))).toEqual([
			{ Field: 'Release year', 'Wacom Intuos Small': '2018', 'Wacom Intuos Small (2)': '2015' },
			{ Field: 'Pressure levels', 'Wacom Intuos Small': '4096', 'Wacom Intuos Small (2)': '1024' },
		]);
	});

	it('HTML', () => {
		const html = toHTML(dup);
		expect(html).toContain('<td>2018</td><td>2015</td>');
		expect(html).toContain('<td>4096</td><td>1024</td>');
	});

	it('Markdown', () => {
		expect(toMarkdown(dup).split('\n')[2]).toBe('| Release year | 2018 | 2015 |');
	});
});

describe('escaping', () => {
	const t = tableFromArrays(['Note', 'Pipe'], [['say "hi", ok\nline 2', 'a|b <c>']]);

	it('CSV quotes commas, quotes and newlines', () => {
		expect(toCSV(t).split('\n').slice(1).join('\n')).toBe('"say ""hi"", ok\nline 2",a|b <c>');
	});

	it('Markdown escapes pipes and folds newlines', () => {
		expect(toMarkdown(t).split('\n')[2]).toBe('| say "hi", ok<br>line 2 | a\\|b <c> |');
	});

	it('HTML escapes markup', () => {
		expect(toHTML(t)).toContain('<td>a|b &lt;c&gt;</td>');
	});
});

describe('toJSON with explicit keys', () => {
	it('uses field keys rather than labels', () => {
		const t = tableFromArrays(['Model ID'], [['PTK-1240']]);
		expect(JSON.parse(toJSON(t, ['ModelId']))).toEqual([{ ModelId: 'PTK-1240' }]);
	});
});

describe('uniqueKeys', () => {
	it('suffixes repeats in order and leaves unique headings alone', () => {
		expect(uniqueKeys(['A', 'B', 'A', 'A'])).toEqual(['A', 'B', 'A (2)', 'A (3)']);
	});

	it('does not collide with a heading that already has the suffix', () => {
		expect(uniqueKeys(['A', 'A (2)', 'A'])).toEqual(['A', 'A (2)', 'A (3)']);
	});
});

describe('cellString', () => {
	it('stringifies values and blanks nullish', () => {
		expect(cellString(0)).toBe('0');
		expect(cellString(null)).toBe('');
		expect(cellString(undefined)).toBe('');
	});
});
