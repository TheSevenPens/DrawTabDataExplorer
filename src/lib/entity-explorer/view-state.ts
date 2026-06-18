// Pure conversion from EntityExplorer's UI state to a queriton pipeline.
// Extracted so it's unit-testable without rendering Svelte (first slice of
// GitHub #219; pins the saved-view policy from #227).

import type { Step } from '@thesevenpens/queriton';

export interface FilterItem {
	field: string;
	operator: string;
	value: string;
	/** Transient UI state — a disabled filter is excluded from the running
	 * query AND from saved views (it is not persisted). */
	disabled?: boolean;
}

export interface SortItem {
	field: string;
	direction: 'asc' | 'desc';
}

/**
 * Build the active queriton pipeline (filters → sorts → select) from UI state.
 *
 * Omitted: disabled filters, and filters whose operator needs a value but has
 * none (a half-entered pill). This is BOTH the query that executes and the
 * query saved into a view — saved views capture the active query only; disabled
 * filters remain transient UI state and are not persisted (GitHub #227).
 */
export function buildActiveSteps(
	filters: readonly FilterItem[],
	sorts: readonly SortItem[],
	selectedColumns: string[],
): Step[] {
	const steps: Step[] = [];
	for (const f of filters) {
		const needsValue = f.operator !== 'empty' && f.operator !== 'notempty';
		if (!f.disabled && (!needsValue || f.value !== '')) {
			steps.push({ kind: 'filter', field: f.field, operator: f.operator, value: f.value });
		}
	}
	for (const s of sorts) {
		steps.push({ kind: 'sort', field: s.field, direction: s.direction });
	}
	steps.push({ kind: 'select', fields: selectedColumns });
	return steps;
}
