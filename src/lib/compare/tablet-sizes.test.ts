import { describe, expect, it } from 'vitest';
import {
	outlineGroups,
	populationNoun,
	sizeMarkers,
	sizeSubtitle,
	sizeTypeFilter,
} from './tablet-sizes';

describe('sizeTypeFilter / populationNoun', () => {
	it('names the population the compared set belongs to', () => {
		expect(populationNoun(sizeTypeFilter(['PENTABLET', 'PENTABLET']))).toBe('pen tablets');
		expect(populationNoun(sizeTypeFilter(['PENDISPLAY', 'STANDALONE']))).toBe('pen displays');
		expect(populationNoun(sizeTypeFilter(['PENTABLET', 'PENDISPLAY']))).toBe('tablets');
	});
});

describe('sizeSubtitle', () => {
	it('names the compared tablets, and the bars only when they are drawn', () => {
		expect(sizeSubtitle({ markerCount: 6, columnCount: 2, context: null })).toBe(
			'6 compared tablets in 2 columns',
		);
		expect(
			sizeSubtitle({
				markerCount: 1,
				columnCount: 1,
				context: { noun: 'pen tablets', years: 15, count: 212 },
			}),
		).toBe(
			'1 compared tablet in 1 column · bars: all 212 pen tablets released in the last 15 years',
		);
		expect(
			sizeSubtitle({
				markerCount: 2,
				columnCount: 2,
				context: { noun: 'tablets', years: null, count: 400 },
			}),
		).toBe('2 compared tablets in 2 columns · bars: all 400 tablets of any year');
	});
});

describe('sizeMarkers', () => {
	it('colours each member by its column and skips members with no diagonal', () => {
		const cols = [
			{
				models: [
					{ n: 'S', d: 20 },
					{ n: 'M', d: null },
				],
			},
			{ models: [{ n: 'S', d: 20 }] },
		];
		const markers = sizeMarkers(
			cols,
			['#a', '#b'],
			(t) => t.d,
			(t) => t.n,
		);
		expect(markers).toEqual([
			{ value: 20, label: 'S', color: '#a' },
			{ value: 20, label: 'S', color: '#b' },
		]);
	});
});

describe('outlineGroups', () => {
	const t = (id: string, w?: number, h?: number) => ({ id, dims: { Width: w, Height: h } });
	const cols = [
		{ id: 'a', name: 'Pro 2017', models: [t('s', 160, 100), t('l', 311, 216)] },
		{ id: 'b', name: 'Pro 2025', models: [t('s', 160, 100), t('x')] },
		{ id: 'c', name: 'Empty', models: [t('y')] },
	];
	const g = outlineGroups(
		cols,
		['#a', '#b', '#c'],
		(m) => m.dims,
		(m) => m.id,
		(m) => m.id,
	);

	it('together: each tablet once, in its first column colour', () => {
		expect(g.together.map((i) => `${i.label}${i.color}`)).toEqual(['s#a', 'l#a']);
	});

	it('by column: a set per column with dimensions, all in the column colour', () => {
		expect(g.byColumn.map((c) => [c.name, c.items.map((i) => i.label + i.color)])).toEqual([
			['Pro 2017', ['s#a', 'l#a']],
			['Pro 2025', ['s#b']],
		]);
	});

	it('one shared scale: the largest short side anywhere', () => {
		expect(g.scaleRefMm).toBe(216);
	});
});
