/**
 * What the Compare add rail can offer (#373): models, families and, for pens,
 * inventory units — searched the same way the pickers search (compileSearch:
 * the drawn label plus separator-insensitive IDs), and annotated with where
 * each one already sits in the comparison.
 */

import { compileSearch } from '$lib/search-match.js';
import type { MemberRef } from './model';
import { refKey } from './model';
import type { ResolvedColumn } from './resolve';

export interface Candidate {
	ref: MemberRef;
	/** "family · 3 tablets", "pen", "unit" … */
	kindLabel: string;
	label: string;
	/** Dimmed text after the label, e.g. a model id. */
	detail?: string;
	/** Model EntityId (lowercase) — a model or unit candidate's model, for presence. */
	modelId?: string;
	/** Strings the search matches besides the label: ids, alternate names. */
	searchTexts: string[];
}

const KIND_ORDER: Record<MemberRef['type'], number> = { family: 0, model: 1, unit: 2 };

/**
 * Candidates matching `query`, families first. An empty query returns none —
 * the rail shows the flagged inbox instead of the whole catalog.
 */
export function searchCandidates(
	candidates: readonly Candidate[],
	query: string,
	limit = 40,
): Candidate[] {
	const search = compileSearch(query);
	if (!search) return [];
	return candidates
		.filter((c) => {
			const all = [c.label, c.detail ?? '', ...c.searchTexts];
			return search.exact(all.join(' ')) || all.some((t) => t && search.stripped(t));
		})
		.sort((a, b) => KIND_ORDER[a.ref.type] - KIND_ORDER[b.ref.type])
		.slice(0, limit);
}

/**
 * Where a candidate already is: the names of columns that hold it directly,
 * and of columns that reach its model through a family or another ref.
 * "in Mediums, and in Intuos Pro 2025 via its family".
 */
export function presenceOf<T>(
	c: Candidate,
	columns: readonly (Pick<ResolvedColumn<T>, 'name' | 'refs' | 'models'> & { id: string })[],
	modelId: (m: T) => string,
): string {
	const key = refKey(c.ref);
	const direct = columns
		.filter((col) => col.refs.some((r) => refKey(r.ref) === key))
		.map((c2) => c2.name);
	const via = c.modelId
		? columns
				.filter(
					(col) => !direct.includes(col.name) && col.models.some((m) => modelId(m) === c.modelId),
				)
				.map((c2) => c2.name)
		: [];
	if (direct.length === 0 && via.length === 0) return '';
	const parts = [];
	if (direct.length) parts.push(`in ${direct.join(', ')}`);
	if (via.length)
		parts.push(`${direct.length ? 'and ' : ''}in ${via.join(', ')} via another member`);
	return parts.join(', ');
}
