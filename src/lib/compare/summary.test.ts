import { describe, expect, it } from 'vitest';
import type { FieldDisplayDef } from '@thesevenpens/queriton';
import { toMarkdownTable } from './markdown';
import {
	buildSummaryGroups,
	countIdenticalRows,
	onlyDifferingRows,
	summarizeCell,
	summaryExportRows,
} from './summary';

type Row = Record<string, string>;
const F = (
	key: string,
	group: string,
	extra: Partial<FieldDisplayDef<Row>> = {},
): FieldDisplayDef<Row> => ({
	key,
	label: key,
	group,
	type: 'string',
	getValue: (r) => r[key] ?? '',
	...extra,
});
// Display appends a unit, like the real getDisplayVal does, to prove ranges keep member display text.
const show = (f: FieldDisplayDef<Row>, r: Row) =>
	r[f.key] ? `${r[f.key]}${f.unit ? ` ${f.unit}` : ''}` : '';

describe('summarizeCell', () => {
	const weight = F('Weight', 'Physical', { unit: 'g' });

	it('a shared value is shown as is', () => {
		expect(summarizeCell(weight, [{ Weight: '15' }, { Weight: '15' }], show)).toEqual({
			text: '15 g',
			varies: false,
			note: '',
		});
	});

	it('numbers rank by stored value, not by text', () => {
		const c = summarizeCell(weight, [{ Weight: '15' }, { Weight: '9.1' }, { Weight: '100' }], show);
		expect(c).toEqual({ text: '9.1 g – 100 g', varies: true, note: '' });
	});

	it('text values are listed up to three, then counted', () => {
		const touch = F('Touch', 'Digitizer');
		expect(summarizeCell(touch, [{ Touch: 'NO' }, { Touch: 'YES' }], show).text).toBe('NO / YES');
		const many = [{ Touch: 'a' }, { Touch: 'b' }, { Touch: 'c' }, { Touch: 'd' }];
		expect(summarizeCell(touch, many, show).text).toBe('4 values');
	});

	it('ISO dates of mixed precision get an earliest – latest range', () => {
		const date = F('Released', 'Model');
		const c = summarizeCell(
			date,
			[{ Released: '2019-05-16' }, { Released: '2017-01' }, { Released: '2018-03-02' }],
			show,
		);
		expect(c.text).toBe('2017-01 – 2019-05-16');
	});

	it('blanks are not values; partial coverage is noted; all-blank is blank', () => {
		const rate = F('Rate', 'Digitizer');
		expect(summarizeCell(rate, [{ Rate: '' }, { Rate: '200' }], show)).toEqual({
			text: '200',
			varies: false,
			note: '1 of 2 recorded',
		});
		expect(summarizeCell(rate, [{}, {}], show)).toEqual({ text: '', varies: false, note: '' });
	});

	it('differing long notes are counted, not concatenated', () => {
		const notes = F('Notes', 'Model', { multiline: true });
		expect(summarizeCell(notes, [{ Notes: 'x' }, { Notes: 'y' }], show).text).toBe(
			'2 different notes',
		);
	});
});

describe('buildSummaryGroups', () => {
	const fields = [F('Year', 'Model'), F('Levels', 'Sensors'), F('Unused', 'Sensors')];
	const cols = [
		{ models: [{ Year: '2025', Levels: '8192' }] },
		{
			models: [
				{ Year: '2017', Levels: '8192' },
				{ Year: '2019', Levels: '8192' },
			],
		},
	];

	it('one cell per column; blank rows and empty groups are dropped; differs compares columns', () => {
		const groups = buildSummaryGroups(cols, fields, ['Model', 'Sensors'], show);
		expect(groups.map((g) => g.rows.map((r) => [r.key, r.differs]))).toEqual([
			[['Year', true]],
			[['Levels', false]],
		]);
		expect(groups[0].rows[0].cells.map((c) => c.text)).toEqual(['2025', '2017 – 2019']);
		expect(countIdenticalRows(groups)).toBe(1);
		expect(onlyDifferingRows(groups).map((g) => g.group)).toEqual(['Model']);
		expect(groups[0].rows.every((r) => r.multiline === false)).toBe(true);
	});

	it('exports rows with varies and notes spelled out, and as Markdown', () => {
		const rows = summaryExportRows(buildSummaryGroups(cols, fields, ['Model', 'Sensors'], show));
		expect(rows[0]).toEqual(['Model', 'Year', '2025', '2017 – 2019 (varies)']);
		const md = toMarkdownTable(['Section', 'Field', 'A', 'B'], rows);
		expect(md.split('\n')[0]).toBe('| Section | Field | A | B |');
		expect(md).toContain('| Model | Year | 2025 | 2017 – 2019 (varies) |');
	});
});

describe('toMarkdownTable', () => {
	it('escapes pipes and newlines so a cell cannot break the table', () => {
		expect(toMarkdownTable(['a'], [['x | y\nz']])).toBe('| a |\n| --- |\n| x \\| y z |\n');
	});
});
