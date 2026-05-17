import { base } from '$app/paths';
import type { ResolvedPathname } from '$app/types';

// These return type-branded `ResolvedPathname` so callers like
// `<a href={buildFilterUrl(...)}>` satisfy the
// `svelte/no-navigation-without-resolve` lint rule (which whitelists
// `ResolvedPathname` returns via TypeScript type analysis).
export function buildFilterUrl(
	entityPath: string,
	filters: { field: string; operator: string; value: string }[],
): ResolvedPathname {
	const parts = filters.map((f) => `filter=${f.field}:${f.operator}:${f.value}`);
	return `${base}${entityPath}?${parts.join('&')}` as ResolvedPathname;
}

export function buildFilterUrlForValues(
	entityPath: string,
	field: string,
	values: string[],
): ResolvedPathname {
	// For small lists, use individual equality filters
	// For the explorer to handle, we encode as a special "in" filter
	const params = new URLSearchParams();
	params.set('filterIn', `${field}:${values.join(',')}`);
	return `${base}${entityPath}?${params.toString()}` as ResolvedPathname;
}
