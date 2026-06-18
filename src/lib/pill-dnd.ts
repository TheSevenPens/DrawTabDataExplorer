// Pure drag-and-drop reorder helpers shared by the query-pill bars (SortBar,
// ColumnBar — see GitHub issue #218). The bars keep their own drag *state* and
// bar-specific removal rules; only the index math lives here so it can be
// unit-tested without rendering Svelte.

/**
 * The array index to insert at when an item dragged from `from` is dropped onto
 * the pill at `over`, on its `side`. Accounts for the gap left once the dragged
 * item is removed (so dropping just to the left of your original slot is a
 * no-op, etc.).
 */
export function computeDropIndex(from: number, over: number, side: 'left' | 'right'): number {
	let insertAt = side === 'right' ? over + 1 : over;
	if (from < over) insertAt--;
	return Math.max(0, insertAt);
}

/**
 * Pure reorder: returns a new array with the item at `from` moved to the drop
 * position for (`over`, `side`). Returns a copy unchanged when `from === over`
 * or `from` is out of range.
 */
export function moveItem<T>(
	items: readonly T[],
	from: number,
	over: number,
	side: 'left' | 'right',
): T[] {
	const next = [...items];
	if (from === over || from < 0 || from >= next.length) return next;
	const [item] = next.splice(from, 1);
	next.splice(computeDropIndex(from, over, side), 0, item as T);
	return next;
}
