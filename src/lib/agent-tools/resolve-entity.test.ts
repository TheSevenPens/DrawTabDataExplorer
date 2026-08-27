import { describe, expect, it } from 'vitest';
import { resolveEntity } from './resolve-entity.js';

type Row = { id: string; label: string; alt: string[] };
const R = (id: string, label: string, ...alt: string[]): Row => ({ id, label, alt });

// The real shape of the ambiguity: four Huion tablets whose names are prefixes
// of one another. This is the fixture the A4 walkthrough hit.
const KAMVAS: Row[] = [
	R('huion.tablet.gs2201', 'Huion Kamvas 22', 'Kamvas 22', 'GS2201'),
	R('huion.tablet.gs2202', 'Huion Kamvas 22 Plus', 'Kamvas 22 Plus', 'GS2202'),
	R('huion.tablet.gt221p2', 'Huion Kamvas 22 Pro (2019)', 'Kamvas 22 Pro (2019)', 'GT221P2'),
	R('huion.tablet.gs2233', 'Huion Kamvas 22 GEN3', 'Kamvas 22 GEN3', 'GS2233'),
];

const opts = {
	idOf: (r: Row) => r.id,
	labelOf: (r: Row) => r.label,
	aliasesOf: (r: Row) => r.alt,
};

describe('resolveEntity', () => {
	it('resolves a bare model name to the exact row, not its longer siblings', () => {
		const res = resolveEntity('kamvas 22', KAMVAS, opts);
		expect(res.matches[0].id).toBe('huion.tablet.gs2201');
		expect(res.matches[0].kind).toBe('exact');
		expect(res.ambiguous).toBe(false);
	});

	it('still returns the siblings as candidates', () => {
		// The point of the tool: the caller sees the near-misses and can ask.
		const res = resolveEntity('kamvas 22', KAMVAS, opts);
		expect(res.totalMatches).toBe(4);
		expect(res.matches.map((m) => m.id)).toContain('huion.tablet.gs2202');
	});

	it('flags ambiguity when nothing matches exactly', () => {
		const res = resolveEntity('kamvas', KAMVAS, opts);
		expect(res.ambiguous).toBe(true);
		expect(res.totalMatches).toBe(4);
	});

	it('resolves by model id', () => {
		const res = resolveEntity('GS2202', KAMVAS, opts);
		expect(res.matches[0].id).toBe('huion.tablet.gs2202');
		expect(res.matches[0].kind).toBe('exact');
	});

	it('ignores punctuation differences', () => {
		const rows = [R('xppen.tablet.x3', 'XP-Pen Artist 16')];
		const o = { idOf: (r: Row) => r.id, labelOf: (r: Row) => r.label };
		expect(resolveEntity('xppen artist 16', rows, o).matches[0]?.kind).toBe('exact');
		expect(resolveEntity('XP Pen Artist 16', rows, o).matches[0]?.kind).toBe('exact');
	});

	it('returns nothing rather than a bad guess when there is no match', () => {
		const res = resolveEntity('cintiq 27', KAMVAS, opts);
		expect(res.matches).toEqual([]);
		expect(res.ambiguous).toBe(false);
		expect(res.totalMatches).toBe(0);
	});

	it('orders by score, then by closeness of label', () => {
		const res = resolveEntity('kamvas 22 p', KAMVAS, opts);
		// Both "Plus" and "Pro (2019)" are prefix matches; the shorter label is
		// the closer read and must come first deterministically.
		expect(res.matches[0].label).toBe('Huion Kamvas 22 Plus');
	});

	it('throws on a bad idOf path rather than returning id-less candidates', () => {
		// Regression: a wrong accessor made every candidate carry `id: undefined`,
		// so the caller's lookup matched the first row and compared two unrelated
		// tablets with full confidence.
		const bad = { ...opts, idOf: () => undefined as unknown as string };
		expect(() => resolveEntity('kamvas 22', KAMVAS, bad)).toThrow(/idOf returned/);
	});

	it('truncates to limit but reports the true total', () => {
		const res = resolveEntity('kamvas', KAMVAS, { ...opts, limit: 2 });
		expect(res.matches).toHaveLength(2);
		expect(res.totalMatches).toBe(4);
	});
});
