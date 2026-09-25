import { describe, expect, it } from 'vitest';
import {
	estimateWidth,
	fitText,
	layoutMatrixImage,
	membersImageInput,
	summaryImageInput,
	type MatrixImageInput,
} from './matrix-image';

const input: MatrixImageInput = {
	title: 'Tablet comparison',
	subtitle: '2 columns · summary',
	columns: [
		{ name: 'Intuos Pro 2017', color: '#a' },
		{ name: 'Intuos Pro 2025', color: '#b' },
	],
	sections: [
		{
			title: 'Model',
			rows: [
				{ label: 'Year', cells: [{ text: '2017' }, { text: '2025' }], differs: true },
				{
					label: 'Pen',
					cells: [{ text: 'Pro Pen 2', sub: '2 of 3 recorded' }, { text: 'Pro Pen 3' }],
					differs: true,
				},
				{ label: 'Status', cells: [{ text: '' }, { text: '' }], differs: false },
			],
		},
	],
};

describe('fitText', () => {
	it('keeps text that fits and ellipsises text that does not', () => {
		expect(fitText('short', 200, 'subtitle')).toBe('short');
		const cut = fitText('a much longer value than the column can hold', 60, 'subtitle');
		expect(cut.endsWith('…')).toBe(true);
		expect(estimateWidth(cut, 'subtitle')).toBeLessThanOrEqual(60);
	});
});

describe('layoutMatrixImage', () => {
	const l = layoutMatrixImage(input);
	const textOf = (t: string) => l.texts.find((x) => x.text === t);

	it('draws the title, every column head with its swatch, and each row', () => {
		expect(textOf('Tablet comparison')?.role).toBe('title');
		expect(textOf('Intuos Pro 2017')).toBeDefined();
		expect(l.rects.filter((r) => r.kind === 'swatch').map((r) => r.color)).toEqual(['#a', '#b']);
		expect(textOf('Year')).toBeDefined();
		expect(textOf('2 of 3 recorded')?.tone).toBe('dim');
	});

	it('washes only differing rows, and draws blanks as a dim dash', () => {
		expect(l.rects.filter((r) => r.kind === 'wash')).toHaveLength(2);
		const dashes = l.texts.filter((t) => t.text === '—');
		expect(dashes).toHaveLength(2);
		expect(dashes.every((d) => d.tone === 'dim')).toBe(true);
	});

	it('a row with a sub-line is taller, so nothing overlaps', () => {
		const y = (t: string) => textOf(t)!.y;
		expect(y('Status') - y('Pen')).toBeGreaterThan(y('Pen') - y('Year'));
		expect(l.height).toBeGreaterThan(y('Status'));
	});

	it('members view: spans name the comparison columns and carry the swatches', () => {
		const m = layoutMatrixImage({
			...input,
			columns: [{ name: 'Small' }, { name: 'Medium' }],
			spans: [{ name: 'Intuos Pro 2017', color: '#a', count: 2 }],
		});
		expect(m.texts.some((t) => t.text === 'Intuos Pro 2017')).toBe(true);
		expect(m.rects.filter((r) => r.kind === 'swatch').map((r) => r.color)).toEqual(['#a']);
	});
});

describe('image inputs from the two matrix views', () => {
	it('summary: "varies" and the recorded note become the sub-line', () => {
		const i = summaryImageInput(
			'T',
			'S',
			[{ name: 'A', color: '#a' }],
			[
				{
					group: 'Model',
					rows: [
						{
							key: 'y',
							label: 'Year',
							differs: false,
							multiline: false,
							cells: [{ text: '2017 – 2019', varies: true, note: '2 of 3 recorded' }],
						},
						{
							key: 's',
							label: 'Status',
							differs: false,
							multiline: false,
							cells: [{ text: 'X', varies: false, note: '' }],
						},
					],
				},
			],
		);
		expect(i.sections[0].rows[0].cells[0].sub).toBe('varies · 2 of 3 recorded');
		expect(i.sections[0].rows[1].cells[0].sub).toBeUndefined();
	});

	it('members: one column per member, spans only for columns that have members', () => {
		const i = membersImageInput(
			'T',
			'S',
			[{ name: 'A', color: '#a' }, { name: 'Empty' }, { name: 'B', color: '#b' }],
			[['a1', 'a2'], [], ['b1']],
			[
				{
					group: 'Model',
					fields: [
						{ key: 'y', label: 'Year', values: ['1', '2', '3'], differs: true, multiline: false },
					],
				},
			],
		);
		expect(i.columns.map((c) => c.name)).toEqual(['a1', 'a2', 'b1']);
		expect(i.spans?.map((s) => [s.name, s.count])).toEqual([
			['A', 2],
			['B', 1],
		]);
		expect(i.sections[0].rows[0].cells.map((c) => c.text)).toEqual(['1', '2', '3']);
	});
});
