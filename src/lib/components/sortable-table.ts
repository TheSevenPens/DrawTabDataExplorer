// Shared sort logic + column typing for SortableTable.svelte — a generic
// clickable-header sortable table used by the Data Quality tables. Kept as a
// pure module so the comparator is unit-testable.

export type SortDir = 'asc' | 'desc';

// Column config is intentionally row-type-agnostic (`any` like the
// EntityExplorer boundary): the Data Quality page passes many differently
// shaped row arrays, read only through the column accessors below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SortableColumn<T = any> = {
	key: string;
	label: string;
	/** Display value for the cell. */
	get: (row: T) => string | number;
	/** Sort key, when it differs from the display value (e.g. numeric behind a
	 * formatted string). Falls back to `get`. */
	sortValue?: (row: T) => string | number;
	/** When present, the cell is wrapped in an `<a href>`. */
	href?: (row: T) => string | null | undefined;
	/** Monospace cell. */
	mono?: boolean;
	/** Right-aligned numeric cell. */
	num?: boolean;
	/** Set false to make the column non-sortable (e.g. a progress-bar cell). */
	sortable?: boolean;
};

/**
 * Compare two cell values: numeric when both are numbers, otherwise natural
 * (numeric-aware) string comparison so "A2" sorts before "A10".
 */
export function compareValues(a: string | number, b: string | number): number {
	if (typeof a === 'number' && typeof b === 'number') return a - b;
	return String(a).localeCompare(String(b), undefined, { numeric: true });
}

/** Return a new array sorted by `accessor` in the given direction (stable). */
export function sortRows<T>(
	rows: readonly T[],
	accessor: (row: T) => string | number,
	dir: SortDir,
): T[] {
	const mult = dir === 'asc' ? 1 : -1;
	return [...rows].sort((a, b) => compareValues(accessor(a), accessor(b)) * mult);
}
