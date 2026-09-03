import { describe, it, expect } from 'vitest';
import type { Tablet } from '$data/lib/drawtab-loader.js';
import { diagonalRows, topByDiagonal, diagonalBrands, touchTabletRows } from './helpers.js';

const tablet = (
	id: string,
	brand: string,
	w: number | null,
	h: number | null,
	year = '2020',
): Tablet =>
	({
		Meta: { EntityId: `${brand.toLowerCase()}.tablet.${id.toLowerCase()}` },
		Model: { Brand: brand, Id: id, Name: id, Type: 'PENTABLET', ReleaseYear: year },
		Digitizer: w === null || h === null ? {} : { Dimensions: { Width: w, Height: h } },
	}) as unknown as Tablet;

describe('diagonalRows', () => {
	it('computes the diagonal and carries the identifying fields', () => {
		const [row] = diagonalRows([tablet('A', 'WACOM', 3, 4, '2019')]);
		expect(row.diagonalMm).toBeCloseTo(5);
		expect(row).toMatchObject({
			entityId: 'wacom.tablet.a',
			id: 'A',
			brand: 'WACOM',
			year: '2019',
		});
	});

	it('skips tablets with no computable diagonal', () => {
		const rows = diagonalRows([
			tablet('OK', 'WACOM', 3, 4),
			tablet('NODIMS', 'WACOM', null, null),
			tablet('HALF', 'WACOM', 10, null),
		]);
		expect(rows.map((r) => r.id)).toEqual(['OK']);
	});

	it('defaults a missing year to an empty string rather than dropping the row', () => {
		const t = tablet('NOYEAR', 'WACOM', 3, 4);
		delete (t.Model as { ReleaseYear?: string }).ReleaseYear;
		expect(diagonalRows([t])[0].year).toBe('');
	});
});

describe('topByDiagonal', () => {
	const rows = diagonalRows([
		tablet('SMALL', 'WACOM', 3, 4), // 5
		tablet('BIG', 'XPPEN', 30, 40), // 50
		tablet('MID', 'WACOM', 6, 8), // 10
	]);

	it('orders largest first', () => {
		expect(topByDiagonal(rows, '', 10).map((r) => r.id)).toEqual(['BIG', 'MID', 'SMALL']);
	});

	it('truncates to the requested count', () => {
		expect(topByDiagonal(rows, '', 2).map((r) => r.id)).toEqual(['BIG', 'MID']);
	});

	it('limits to one brand, and an empty brand means all', () => {
		expect(topByDiagonal(rows, 'WACOM', 10).map((r) => r.id)).toEqual(['MID', 'SMALL']);
		expect(topByDiagonal(rows, '', 10)).toHaveLength(3);
	});

	it('returns empty for a brand with no rows, rather than falling back to all', () => {
		expect(topByDiagonal(rows, 'HUION', 10)).toEqual([]);
	});

	it('does not mutate the input order', () => {
		const before = rows.map((r) => r.id);
		topByDiagonal(rows, '', 3);
		expect(rows.map((r) => r.id)).toEqual(before);
	});

	it('orders smallest first when asked, and it is not merely the reverse slice', () => {
		// With count < total the two directions pick different tablets, not the
		// same three read backwards — SMALL is absent from 'largest' at count 2.
		expect(topByDiagonal(rows, '', 3, 'smallest').map((r) => r.id)).toEqual([
			'SMALL',
			'MID',
			'BIG',
		]);
		expect(topByDiagonal(rows, '', 2, 'smallest').map((r) => r.id)).toEqual(['SMALL', 'MID']);
		expect(topByDiagonal(rows, '', 2, 'largest').map((r) => r.id)).toEqual(['BIG', 'MID']);
	});

	it('defaults to largest, matching the behaviour before direction was selectable', () => {
		expect(topByDiagonal(rows, '', 3)).toEqual(topByDiagonal(rows, '', 3, 'largest'));
	});

	it('applies the brand filter in either direction', () => {
		expect(topByDiagonal(rows, 'WACOM', 10, 'smallest').map((r) => r.id)).toEqual(['SMALL', 'MID']);
		expect(topByDiagonal(rows, 'WACOM', 10, 'largest').map((r) => r.id)).toEqual(['MID', 'SMALL']);
	});
});

describe('diagonalBrands', () => {
	it('dedupes and orders by display name, not brand code', () => {
		// Codes and display names deliberately sort in opposite directions, so
		// this fails if the sort ever falls back to the raw brand code.
		const rows = diagonalRows([
			tablet('A', 'ALP', 3, 4),
			tablet('B', 'ZED', 3, 4),
			tablet('C', 'ALP', 3, 4),
		]);
		const label = (b: string) => (b === 'ALP' ? 'Zulu' : 'Alpha');
		expect(diagonalBrands(rows, label)).toEqual(['ZED', 'ALP']);
	});
});

describe('touchTabletRows', () => {
	const touchTablet = (
		id: string,
		brand: string,
		type: string,
		supportsTouch: string | undefined,
		name = id,
		year = '2020',
	): Tablet =>
		({
			Meta: { EntityId: `${brand.toLowerCase()}.tablet.${id.toLowerCase()}` },
			Model: { Brand: brand, Id: id, Name: name, Type: type, ReleaseYear: year },
			Digitizer: supportsTouch === undefined ? {} : { SupportsTouch: supportsTouch },
		}) as unknown as Tablet;

	const ident = (b: string) => b;
	const allTypes = new Set(['PENTABLET', 'PENDISPLAY', 'STANDALONE']);

	const sample = [
		touchTablet('PT1', 'WACOM', 'PENTABLET', 'YES'),
		touchTablet('PT2', 'WACOM', 'PENTABLET', 'NO'),
		touchTablet('PT3', 'WACOM', 'PENTABLET', undefined),
		touchTablet('PD1', 'HUION', 'PENDISPLAY', 'YES'),
		touchTablet('SA1', 'APPLE', 'STANDALONE', 'YES'),
	];

	it('keeps only tablets that report touch support', () => {
		expect(
			touchTabletRows(sample, allTypes, ident)
				.map((r) => r.id)
				.sort(),
		).toEqual(['PD1', 'PT1', 'SA1']);
	});

	it('limits to the selected device types', () => {
		const rows = touchTabletRows(sample, new Set(['PENTABLET', 'PENDISPLAY']), ident);
		expect(rows.map((r) => r.id)).toEqual(['PD1', 'PT1']);
	});

	it('returns nothing when no type is selected, rather than falling back to all', () => {
		expect(touchTabletRows(sample, new Set(), ident)).toEqual([]);
	});

	it('orders by brand display name, then name', () => {
		const rows = touchTabletRows(
			[
				touchTablet('B', 'ALP', 'PENTABLET', 'YES', 'Zeta'),
				touchTablet('C', 'ALP', 'PENTABLET', 'YES', 'Alpha'),
				touchTablet('A', 'ZED', 'PENTABLET', 'YES', 'Mid'),
			],
			allTypes,
			// Codes and display names sort in opposite directions, so this fails
			// if the sort falls back to the raw brand code.
			(b) => (b === 'ALP' ? 'Zulu' : 'Alpha'),
		);
		expect(rows.map((r) => r.name)).toEqual(['Mid', 'Alpha', 'Zeta']);
	});

	it('carries the identifying fields and a display label for the type', () => {
		const [row] = touchTabletRows(
			[touchTablet('SA1', 'APPLE', 'STANDALONE', 'YES')],
			allTypes,
			ident,
		);
		expect(row).toMatchObject({
			entityId: 'apple.tablet.sa1',
			id: 'SA1',
			brand: 'APPLE',
			type: 'STANDALONE',
			typeLabel: 'Standalone',
			year: '2020',
		});
	});
});
