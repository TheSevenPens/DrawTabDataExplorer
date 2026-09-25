import { describe, expect, it } from 'vitest';
import { populationNoun, sizeMarkers, sizeSubtitle, sizeTypeFilter } from './tablet-sizes';

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
