import { describe, expect, it } from 'vitest';
import { presenceOf, searchCandidates, type Candidate } from './candidates';

const cands: Candidate[] = [
	{
		ref: { type: 'model', id: 'wacom.tablet.pth660' },
		kindLabel: 'tablet',
		label: 'Wacom Intuos Pro 2017 Medium',
		detail: 'PTH-660',
		modelId: 'wacom.tablet.pth660',
		searchTexts: ['PTH-660'],
	},
	{
		ref: { type: 'family', id: 'wacom.tabletfamily.wacom_intuospro_2017' },
		kindLabel: 'family · 3 tablets',
		label: 'Wacom Intuos Pro 2017 tablet series',
		searchTexts: [],
	},
	{
		ref: { type: 'model', id: 'wacom.tablet.ctl4100' },
		kindLabel: 'tablet',
		label: 'Wacom Intuos S',
		detail: 'CTL-4100',
		modelId: 'wacom.tablet.ctl4100',
		searchTexts: ['CTL-4100'],
	},
];

describe('searchCandidates', () => {
	it('matches labels and ids, separator-insensitively, families first', () => {
		expect(searchCandidates(cands, 'intuos pro 2017').map((c) => c.ref.type)).toEqual([
			'family',
			'model',
		]);
		expect(searchCandidates(cands, 'pth660').map((c) => c.detail)).toEqual(['PTH-660']);
		expect(searchCandidates(cands, 'ctl4100').map((c) => c.detail)).toEqual(['CTL-4100']);
	});

	it('an empty query offers nothing (the rail shows flagged items instead)', () => {
		expect(searchCandidates(cands, '   ')).toEqual([]);
	});
});

describe('presenceOf', () => {
	const cols = [
		{
			id: 'a',
			name: 'Mediums',
			refs: [{ ref: { type: 'model' as const, id: 'wacom.tablet.pth660' } }],
			models: [{ id: 'wacom.tablet.pth660' }],
		},
		{
			id: 'b',
			name: 'Intuos Pro 2017',
			refs: [{ ref: { type: 'family' as const, id: 'wacom.tabletfamily.wacom_intuospro_2017' } }],
			models: [{ id: 'wacom.tablet.pth660' }],
		},
	];
	const id = (m: { id: string }) => m.id;

	it('names direct columns and columns that reach the model another way', () => {
		expect(presenceOf(cands[0], cols as never, id)).toBe(
			'in Mediums, and in Intuos Pro 2017 via another member',
		);
		expect(presenceOf(cands[1], cols as never, id)).toBe('in Intuos Pro 2017');
		expect(presenceOf(cands[2], cols as never, id)).toBe('');
	});
});
