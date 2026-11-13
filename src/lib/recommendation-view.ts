// Shapes a device's recommendation and price records for its detail page:
// the current rating (via the data library's currentRating), the current and
// launch U.S. prices, and every record newest first.
import {
	currentPrice,
	currentRating,
	launchPrice,
	type CurrentRating,
} from '$data/lib/recommendations.js';
import type { Price, Rating, RecommendationList, RecommendationNote } from '$data/lib/schemas.js';

export interface DeviceRecs {
	ratings: Rating[];
	notes: RecommendationNote[];
	lists: RecommendationList[];
	prices: Price[];
}

export interface RecommendationView {
	rating: CurrentRating | null;
	ratings: Rating[];
	notes: RecommendationNote[];
	lists: string[];
	current: Price | null;
	launch: Price | null;
	prices: Price[];
	isEmpty: boolean;
}

/** The records about one EntityId, from whole collections. */
export function recsFor(entityId: string, all: DeviceRecs): DeviceRecs {
	const mine = <T extends { EntityId: string }>(rows: T[]) =>
		rows.filter((r) => r.EntityId === entityId);
	return {
		ratings: mine(all.ratings),
		notes: mine(all.notes),
		lists: mine(all.lists),
		prices: mine(all.prices),
	};
}

const newestFirst = <T extends { Date?: string }>(rows: readonly T[]) =>
	[...rows].sort((a, b) => (b.Date ?? '').localeCompare(a.Date ?? ''));

export function recommendationView(r: DeviceRecs): RecommendationView {
	return {
		rating: currentRating(r.ratings),
		ratings: newestFirst(r.ratings),
		notes: newestFirst(r.notes),
		lists: [...new Set(r.lists.map((l) => l.List))],
		current: currentPrice(r.prices),
		launch: launchPrice(r.prices),
		prices: newestFirst(r.prices),
		isEmpty: !r.ratings.length && !r.notes.length && !r.lists.length && !r.prices.length,
	};
}

/** "699.95" + "USD" -> "$699.95"; other currencies keep their code. */
export function formatPrice(amount: string, currency: string): string {
	const n = Number(amount);
	if (!Number.isFinite(n)) return `${amount} ${currency}`;
	const s = n.toLocaleString('en-US', {
		minimumFractionDigits: n % 1 ? 2 : 0,
		maximumFractionDigits: 2,
	});
	return currency === 'USD' ? `$${s}` : `${s} ${currency}`;
}
