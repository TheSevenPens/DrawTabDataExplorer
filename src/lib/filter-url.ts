import { base } from '$app/paths';
import type { ResolvedPathname } from '$app/types';

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
	const params = new URLSearchParams();
	for (const f of filters) params.append('filter', `${f.field}:${f.operator}:${f.value}`);
	return `${base}${entityPath}?${params.toString()}` as ResolvedPathname;
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
