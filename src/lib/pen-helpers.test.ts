import { describe, expect, it } from 'vitest';
import type { Pen } from '$data/lib/drawtab-loader.js';
import { buildPenNameMap, formatPenIds } from './pen-helpers.js';

const PEN = (overrides: Partial<Pen>): Pen =>
	({
		EntityId: 'wacom.pen.kp503e',
		Brand: 'WACOM',
		PenId: 'KP-503E',
		PenName: 'Pro Pen 3',
		PenFamily: 'wacom.penfamily.wacomkpgen3',
		PenYear: '2023',
		_id: '00000000-0000-0000-0000-000000000000',
		_CreateDate: '2024-01-01T00:00:00Z',
		_ModifiedDate: '2024-01-01T00:00:00Z',
		...overrides,
	}) as Pen;

describe('buildPenNameMap', () => {
	it('maps EntityId to "Brand PenName (PenId)" labels', () => {
		const map = buildPenNameMap([PEN({}), PEN({ EntityId: 'wacom.pen.kp701e', PenId: 'KP-701E' })]);
		expect(map.get('wacom.pen.kp503e')).toBe('Wacom Pro Pen 3 (KP-503E)');
		expect(map.get('wacom.pen.kp701e')).toBe('Wacom Pro Pen 3 (KP-701E)');
	});

	it('drops the trailing "(PenId)" when PenName already contains it', () => {
		const map = buildPenNameMap([
			PEN({
				EntityId: 'asus.pen.mpa01',
				Brand: 'ASUS',
				PenId: 'MPA01',
				PenName: 'ProArt Pen MPA01',
			}),
			PEN({ EntityId: 'digidraw.pen.m3', Brand: 'DIGIDRAW', PenId: 'M3', PenName: 'M3 Pen' }),
		]);
		expect(map.get('asus.pen.mpa01')).toBe('Asus ProArt Pen MPA01');
		expect(map.get('digidraw.pen.m3')).toBe('DigiDraw M3 Pen');
	});

	it('keeps "(PenId)" when PenId only appears as a substring of a larger token', () => {
		// PenId "M3" must not match "MX300"
		const map = buildPenNameMap([
			PEN({ EntityId: 'foo.pen.m3', Brand: 'WACOM', PenId: 'M3', PenName: 'MX300 something' }),
		]);
		expect(map.get('foo.pen.m3')).toBe('Wacom MX300 something (M3)');
	});

	it('returns an empty map for an empty pen list', () => {
		expect(buildPenNameMap([]).size).toBe(0);
	});
});

describe('formatPenIds', () => {
	const map = buildPenNameMap([PEN({})]);

	it('joins resolved names with commas', () => {
		expect(formatPenIds(['wacom.pen.kp503e'], map)).toBe('Wacom Pro Pen 3 (KP-503E)');
	});

	it('falls back to the raw ID when not in the map', () => {
		expect(formatPenIds(['wacom.pen.kp503e', 'unknown.pen.x'], map)).toBe(
			'Wacom Pro Pen 3 (KP-503E), unknown.pen.x',
		);
	});

	it('returns an empty string for an empty list', () => {
		expect(formatPenIds([], map)).toBe('');
	});
});
