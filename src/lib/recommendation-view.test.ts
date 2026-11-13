import { describe, expect, it } from 'vitest';
import { formatPrice, recommendationView, recsFor } from './recommendation-view';
import type { Price, Rating } from '$data/lib/schemas.js';

const meta = {
	_id: '00000000-0000-0000-0000-000000000000',
	_CreateDate: '2026-01-01T00:00:00.000Z',
	_ModifiedDate: '2026-01-01T00:00:00.000Z',
};
const rating = (EntityId: string, Date: string, r: Rating['Rating']): Rating => ({
	EntityId,
	Brand: 'WACOM',
	Date,
	Rating: r,
	Source: 't',
	...meta,
});
const price = (Kind: Price['Kind'], Amount: string, Date: string): Price => ({
	EntityId: 'a',
	Brand: 'WACOM',
	Kind,
	Amount,
	Currency: 'USD',
	Date,
	CheckedOn: '2026-11-04',
	Primary: true,
	Source: 't',
	...meta,
});

describe('recommendationView', () => {
	it('picks the current rating and prices for one device', () => {
		const all = {
			ratings: [
				rating('a', '2024-01-01', 'GOOD'),
				rating('a', '2025-01-01', 'EXCELLENT'),
				rating('b', '2026-01-01', 'AVOID'),
			],
			notes: [],
			lists: [],
			prices: [price('LAUNCH', '399', '2020-01-01'), price('CURRENT', '279', '2026-11-04')],
		};
		const v = recommendationView(recsFor('a', all));
		expect(v.rating?.rating).toBe('EXCELLENT');
		expect(v.ratings.map((r) => r.Date)).toEqual(['2025-01-01', '2024-01-01']);
		expect(v.current?.Amount).toBe('279');
		expect(v.launch?.Amount).toBe('399');
		expect(v.isEmpty).toBe(false);
	});
	it('is empty without records', () => {
		expect(recommendationView({ ratings: [], notes: [], lists: [], prices: [] }).isEmpty).toBe(
			true,
		);
	});
});

describe('formatPrice', () => {
	it('formats USD with cents only when present', () => {
		expect(formatPrice('699.95', 'USD')).toBe('$699.95');
		expect(formatPrice('1299', 'USD')).toBe('$1,299');
		expect(formatPrice('35800', 'JPY')).toBe('35,800 JPY');
	});
});
