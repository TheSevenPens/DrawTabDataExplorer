import { base } from '$app/paths';
import type { ResolvedPathname } from '$app/types';
import type { SortItem } from '$lib/entity-explorer/view-state.js';

// Deep links into an entity list: `?filter=Field:operator:value`, repeatable.
// The builder and the parser live together so they can't drift — a value
// containing `&`, `#`, `+` or `%` used to be written raw and read back
// truncated or altered (#334). Only the first two `:` separate; the value
// may itself contain colons.

export interface UrlFilter {
	field: string;
	operator: string;
	value: string;
}

// These return type-branded `ResolvedPathname` so callers like
// `<a href={buildFilterUrl(...)}>` satisfy the
// `svelte/no-navigation-without-resolve` lint rule (which whitelists
// `ResolvedPathname` returns via TypeScript type analysis).
export function buildFilterUrl(entityPath: string, filters: UrlFilter[]): ResolvedPathname {
	return `${base}${entityPath}?${buildFilterParams(filters).toString()}` as ResolvedPathname;
}

/** Shared encoding for list links, including absolute WebMCP result URLs. */
export function buildFilterParams(
	filters: UrlFilter[],
	view: { sorts?: SortItem[]; columns?: string[] } = {},
): URLSearchParams {
	const params = new URLSearchParams();
	for (const f of filters) params.append('filter', `${f.field}:${f.operator}:${f.value}`);
	for (const sort of view.sorts ?? []) params.append('sort', `${sort.field}:${sort.direction}`);
	for (const column of view.columns ?? []) params.append('column', column);
	return params;
}

/** Unknown field keys are checked against the current entity's fields by the caller. */
export function parseSortParams(params: URLSearchParams): SortItem[] {
	return params.getAll('sort').flatMap((value) => {
		const parts = value.split(':');
		const [field, direction] = parts;
		return field && parts.length === 2 && (direction === 'asc' || direction === 'desc')
			? [{ field, direction }]
			: [];
	});
}

export function parseColumnParams(params: URLSearchParams): string[] {
	return [...new Set(params.getAll('column').filter(Boolean))];
}

/** Read the `filter` params back. Entries without a field are dropped; a
 * missing operator defaults to `==`. */
export function parseFilterParams(params: URLSearchParams): UrlFilter[] {
	return params
		.getAll('filter')
		.map((raw) => {
			const parts = raw.split(':');
			return {
				field: parts[0] ?? '',
				operator: parts[1] || '==',
				value: parts.slice(2).join(':'),
			};
		})
		.filter((f) => f.field);
}
