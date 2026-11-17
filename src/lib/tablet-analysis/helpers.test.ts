import { describe, it, expect } from 'vitest';
import type { Tablet } from '$data/lib/drawtab-loader.js';
import {
	touchTabletRows,
	rankRows,
	metricRankRows,
	rankBrands,
	matchesTypeBrand,
	digitizerDensity,
	displayPpi,
} from './helpers.js';

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
			OtherInputs: supportsTouch === undefined ? {} : { Touch: supportsTouch },
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

describe('rankRows', () => {
	const rows = [
		{ entityId: 'b.tablet.two', v: 5 },
		{ entityId: 'a.tablet.one', v: 5 },
		{ entityId: 'c.tablet.big', v: 9 },
		{ entityId: 'a.tablet.zero', v: 5 },
	];

	it('ranks by value, breaking ties on EntityId (not input order)', () => {
		expect(rankRows(rows, (r) => r.v, 'desc', 3).map((r) => r.entityId)).toEqual([
			'c.tablet.big',
			'a.tablet.one',
			'a.tablet.zero',
		]);
		expect(rankRows([...rows].reverse(), (r) => r.v, 'desc', 3)).toEqual(
			rankRows(rows, (r) => r.v, 'desc', 3),
		);
	});

	it('ascending keeps the same tie order', () => {
		expect(rankRows(rows, (r) => r.v, 'asc', 2).map((r) => r.entityId)).toEqual([
			'a.tablet.one',
			'a.tablet.zero',
		]);
	});
});

describe('displayPpi', () => {
	const display = (px: number | null, mm: number | null) =>
		({
			Display: px === null ? {} : { PixelDimensions: { Width: px, Height: 1 } },
			Digitizer: mm === null ? {} : { Dimensions: { Width: mm, Height: 1 } },
		}) as unknown as Tablet;

	it('converts horizontal px per mm of active width to PPI', () => {
		// 3840 px across 345.6 mm is the 16" 4K class: ~282 PPI.
		expect(displayPpi(display(3840, 345.6))).toBeCloseTo(282.2, 1);
		expect(displayPpi(display(254, 254))).toBeCloseTo(25.4);
	});

	it('is null when the resolution or the width is missing', () => {
		expect(displayPpi(display(null, 300))).toBeNull();
		expect(displayPpi(display(1920, null))).toBeNull();
		expect(displayPpi(display(1920, 0))).toBeNull();
	});
});

describe('digitizerDensity', () => {
	const withDensity = (d: unknown) => ({ Digitizer: { Density: d } }) as unknown as Tablet;
	it('reads numeric strings and numbers, null otherwise', () => {
		expect(digitizerDensity(withDensity('200'))).toBe(200);
		expect(digitizerDensity(withDensity(100))).toBe(100);
		expect(digitizerDensity(withDensity(''))).toBeNull();
		expect(digitizerDensity(withDensity(undefined))).toBeNull();
		expect(digitizerDensity(withDensity('n/a'))).toBeNull();
	});
});

describe('metricRankRows', () => {
	it('keeps tablets with a finite value and carries the identifying fields', () => {
		const rows = metricRankRows(
			[tablet('A', 'WACOM', 3, 4, '2019'), tablet('B', 'HUION', null, null)],
			(t) => t.Digitizer?.Dimensions?.Width ?? null,
		);
		expect(rows).toEqual([
			{
				entityId: 'wacom.tablet.a',
				name: 'A',
				id: 'A',
				brand: 'WACOM',
				type: 'PENTABLET',
				year: '2019',
				value: 3,
			},
		]);
	});

	it('drops NaN values', () => {
		expect(metricRankRows([tablet('A', 'WACOM', 3, 4)], () => NaN)).toEqual([]);
	});
});

describe('matchesTypeBrand', () => {
	const item = { type: 'PENDISPLAY', brand: 'WACOM' };

	it('treats an empty filter as "all"', () => {
		expect(matchesTypeBrand(item, '', '')).toBe(true);
	});

	it('requires each set filter to match', () => {
		expect(matchesTypeBrand(item, 'PENDISPLAY', 'WACOM')).toBe(true);
		expect(matchesTypeBrand(item, 'STANDALONE', '')).toBe(false);
		expect(matchesTypeBrand(item, '', 'HUION')).toBe(false);
	});
});

describe('rankBrands', () => {
	it('dedupes and orders by display label', () => {
		const label = (b: string) => ({ XPPEN: 'XP-Pen', HUION: 'Huion', WACOM: 'Wacom' })[b] ?? b;
		expect(
			rankBrands(
				[{ brand: 'XPPEN' }, { brand: 'WACOM' }, { brand: 'HUION' }, { brand: 'XPPEN' }],
				label,
			),
		).toEqual(['HUION', 'WACOM', 'XPPEN']);
	});
});
