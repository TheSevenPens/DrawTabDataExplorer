/**
 * Row selection for list tables (#379). Selections are plain Sets driven by
 * reassignment — each helper returns a new Set so `$state` sees the change
 * (CLAUDE.md § Svelte 5 reactive state gotchas).
 */

export type SelectionState = 'none' | 'some' | 'all';

/** Add or remove every id in `ids`, keeping selections outside them. */
export function setAll(
	selected: ReadonlySet<string>,
	ids: readonly string[],
	on: boolean,
): Set<string> {
	const next = new Set(selected);
	for (const id of ids) {
		if (on) next.add(id);
		else next.delete(id);
	}
	return next;
}

/** How much of `ids` is selected — drives a header checkbox (checked / indeterminate). */
export function selectionState(
	selected: ReadonlySet<string>,
	ids: readonly string[],
): SelectionState {
	let n = 0;
	for (const id of ids) if (selected.has(id)) n++;
	return n === 0 ? 'none' : n === ids.length ? 'all' : 'some';
}

export function toggleOne(selected: ReadonlySet<string>, id: string): Set<string> {
	return setAll(selected, [id], !selected.has(id));
}
