import type { BuilderFilter } from './mockup-templates.js';

const VALUELESS_OPS = new Set(['empty', 'notempty']);

function parseFilterInValues(value: string): string[] {
	return value
		.split(',')
		.map((v) => v.trim())
		.filter(Boolean);
}

/** True when a filter row is complete enough to apply to a query. */
export function isCompleteBuilderFilter(f: BuilderFilter): boolean {
	if (f.disabled) return false;
	if (!f.operator?.trim()) return false;
	if (VALUELESS_OPS.has(f.operator)) return true;
	if (f.operator === 'in') return parseFilterInValues(f.value).length > 0;
	return f.value.trim() !== '';
}

export function completeBuilderFilters(filters: BuilderFilter[]): BuilderFilter[] {
	return filters.filter(isCompleteBuilderFilter);
}
