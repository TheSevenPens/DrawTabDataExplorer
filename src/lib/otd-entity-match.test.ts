import { describe, it, expect } from 'vitest';
import { matchOtdToTablets, candidateIds } from './otd-entity-match.js';
import type { Tablet, OTDTablet } from '$data/lib/drawtab-loader.js';

// Minimal fixtures — only the fields the matcher reads.
function tab(id: string, w?: number, h?: number): Tablet {
	return {
		Meta: { EntityId: `wacom.tablet.${id.replace(/[^a-z0-9]/gi, '').toLowerCase()}` },
		Model: { Id: id },
		Digitizer: w != null && h != null ? { Dimensions: { Width: w, Height: h } } : undefined,
	} as unknown as Tablet;
}
function otd(name: string, w: number | null, h: number | null, vendor = 'Wacom'): OTDTablet {
	return {
		vendor,
		file: `${vendor}/${name}.json`,
		name,
		specs: {
			widthMM: w,
			heightMM: h,
			maxX: null,
			maxY: null,
			penMaxPressure: null,
			penButtons: null,
			auxButtons: null,
		},
		identifiers: [],
	};
}

describe('candidateIds', () => {
	it('takes the model number after the vendor prefix', () => {
		expect(candidateIds('Wacom PTK-440', 'Wacom')).toContain('PTK440');
	});
	it('prefers a parenthetical model number, tried first', () => {
		const c = candidateIds('Wacom Cintiq 16 (DTK1660)', 'Wacom');
		expect(c[0]).toBe('DTK1660');
	});
	it('handles vendors with regex-special chars (XP-Pen)', () => {
		expect(candidateIds('XP-Pen Deco 01', 'XP-Pen')).toContain('DECO01');
	});
});

describe('matchOtdToTablets', () => {
	const ours = [
		tab('PTK-440', 157.5, 98.4),
		tab('DTK-1660', 344.2, 193.6),
		tab('CTL-472', 152, 95),
	];

	it('matches by id and confirms with area (id+area)', () => {
		const [r] = matchOtdToTablets([otd('Wacom PTK-440', 157.5, 98.4)], ours);
		expect(r.entityId).toBe('wacom.tablet.ptk440');
		expect(r.basis).toBe('id+area');
	});

	it('matches by id alone when the area disagrees', () => {
		const [r] = matchOtdToTablets([otd('Wacom PTK-440', 999, 999)], ours);
		expect(r.entityId).toBe('wacom.tablet.ptk440');
		expect(r.basis).toBe('id');
	});

	it('extracts the model id from a parenthetical marketing name', () => {
		const [r] = matchOtdToTablets([otd('Wacom Cintiq 16 (DTK1660)', 344.2, 193.6)], ours);
		expect(r.entityId).toBe('wacom.tablet.dtk1660');
		expect(r.basis).toBe('id+area');
	});

	it('falls back to a unique area match when no id matches', () => {
		const [r] = matchOtdToTablets([otd('Wacom Mystery Model', 152, 95)], ours);
		expect(r.entityId).toBe('wacom.tablet.ctl472');
		expect(r.basis).toBe('area');
	});

	it('reports no match when neither id nor area resolves', () => {
		const [r] = matchOtdToTablets([otd('Wacom Nonexistent', 1, 1)], ours);
		expect(r.entityId).toBeNull();
		expect(r.basis).toBe('none');
	});

	it('disambiguates a reused Model.Id by area', () => {
		const dup = [tab('CT-0405-U', 128, 93), tab('CT-0405-U', 200, 150)];
		// both share Model.Id but the EntityId encodes the id sans punctuation;
		// give them distinct areas so only one matches.
		const [r] = matchOtdToTablets([otd('Wacom CT-0405-U', 200, 150)], dup);
		expect(r.ourWidthMM).toBe(200);
		expect(r.basis).toBe('id+area');
	});
});
