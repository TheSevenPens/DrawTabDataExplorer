// One analysis section per numeric attribute, with Distribution / Lowest /
// Highest tabs (the "ranked metric" pattern). Pure helpers for the tab state
// and its URL hash, so the SectionedPage tree and the tabs agree on which
// section is open.
//
// The hash is `#<sectionId>` for the Distribution tab and
// `#<sectionId>-lowest` / `#<sectionId>-highest` for the rankings. Those are
// exactly the ids the old separate Lowest / Highest sections used, so
// bookmarks to them still land on the right section and tab.

import { matchesTypeBrand, rankRows, type MetricRankRow } from '$lib/tablet-analysis/helpers.js';

export type MetricTab = 'distribution' | 'lowest' | 'highest';
export type RankDirection = Exclude<MetricTab, 'distribution'>;

export const METRIC_TABS: { id: MetricTab; label: string }[] = [
	{ id: 'distribution', label: 'Distribution' },
	{ id: 'lowest', label: 'Lowest' },
	{ id: 'highest', label: 'Highest' },
];

export const RANK_COUNT_OPTIONS = [10, 20, 30];

/** Tab labels, with the rank tabs renamed where an attribute reads better
 *  as e.g. Smallest / Largest. The tab ids (and so the hashes) don't change. */
export function metricTabs(
	lowLabel = 'Lowest',
	highLabel = 'Highest',
): { id: MetricTab; label: string }[] {
	return METRIC_TABS.map((t) =>
		t.id === 'lowest'
			? { ...t, label: lowLabel }
			: t.id === 'highest'
				? { ...t, label: highLabel }
				: t,
	);
}

/** Export filename for a ranking: `<base>-<label>`, e.g. `analysis-pen-tablet-diagonal-largest`. */
export function rankFilename(base: string, label: string): string {
	return `${base}-${label.toLowerCase()}`;
}

/** The URL hash (without `#`) that opens `tab` of `sectionId`. */
export function metricTabHash(sectionId: string, tab: MetricTab): string {
	return tab === 'distribution' ? sectionId : `${sectionId}-${tab}`;
}

/** The tab of `sectionId` a hash selects; Distribution when it names no rank tab. */
export function metricTabFromHash(hash: string, sectionId: string): MetricTab {
	const h = hash.startsWith('#') ? hash.slice(1) : hash;
	if (h === metricTabHash(sectionId, 'lowest')) return 'lowest';
	if (h === metricTabHash(sectionId, 'highest')) return 'highest';
	return 'distribution';
}

/**
 * Hash aliases for SectionedPage: each rank-tab hash maps to its section, so
 * the tree keeps the section highlighted and renders it.
 */
export function metricTabAliases(sectionIds: readonly string[]): Record<string, string> {
	const aliases: Record<string, string> = {};
	for (const id of sectionIds) {
		aliases[metricTabHash(id, 'lowest')] = id;
		aliases[metricTabHash(id, 'highest')] = id;
	}
	return aliases;
}

/** A stored numeric-string spec value as a number; null when blank or not numeric. */
export function parseMetricNumber(v: string | number | null | undefined): number | null {
	if (v == null || v === '') return null;
	const n = Number(v);
	return Number.isFinite(n) ? n : null;
}

/** Filter state of one ranking tab. `''` = all. */
export interface RankFilter {
	type: string;
	brand: string;
	count: number;
}

export type RankFilters = Record<RankDirection, RankFilter>;

export function defaultRankFilters(): RankFilters {
	return {
		lowest: { type: '', brand: '', count: RANK_COUNT_OPTIONS[0] },
		highest: { type: '', brand: '', count: RANK_COUNT_OPTIONS[0] },
	};
}

/** The top `filter.count` rows matching the filter, lowest or highest first. */
export function rankMetric(
	rows: readonly MetricRankRow[],
	direction: RankDirection,
	filter: RankFilter,
): MetricRankRow[] {
	const filtered = rows.filter((r) => matchesTypeBrand(r, filter.type, filter.brand));
	return rankRows(filtered, (r) => r.value, direction === 'lowest' ? 'asc' : 'desc', filter.count);
}
