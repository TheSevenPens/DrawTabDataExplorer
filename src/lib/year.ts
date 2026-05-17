// Coerce a year-like value (number, numeric string, null, undefined, or
// garbage) to a number for sort comparators. Non-numeric inputs collapse to
// -Infinity so nulls/undefineds sink to the bottom of a descending sort.
export function yearNum(y: unknown): number {
	const n = typeof y === 'number' ? y : parseInt(String(y ?? ''), 10);
	return Number.isFinite(n) ? n : -Infinity;
}
