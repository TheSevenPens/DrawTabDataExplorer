// Flattens every tablet entity's Model.Links into a flat row list for the
// reference-page "Tablet Links" section. One row per (tablet, link). Labels
// go through the canonical tablet formatters (see tablet-helpers) — never
// reconstruct "Brand Name (Id)" inline.
import type { Tablet } from '$data/lib/drawtab-loader.js';
import { brandName } from '$data/lib/drawtab-loader.js';
import { tabletFullName, tabletNameAndId } from '$lib/tablet-helpers.js';

export interface TabletLinkRow {
	tabletEntityId: string;
	/** Brand + Name + Id, used for the search filter (matches any of them). */
	tabletFullName: string;
	/** Name (Id) only — brand lives in its own column, so it's dropped here. */
	tabletLabel: string;
	/** Brand enum code (e.g. "WACOM"), for the brand dropdown value. */
	brand: string;
	/** Brand display name (e.g. "Wacom"), shown in the table + dropdown label. */
	brandName: string;
	type: string;
	url: string;
	title: string;
	author: string;
	publishDate: string;
}

// Presentation order for the type column / default row sort.
const TYPE_RANK: Record<string, number> = { REVIEW: 0, PRODUCTINFO: 1, USERMANUAL: 2, STORE: 3 };

export function buildTabletLinkRows(tablets: Tablet[]): TabletLinkRow[] {
	const rows: TabletLinkRow[] = [];
	for (const t of tablets) {
		for (const l of t.Model.Links ?? []) {
			rows.push({
				tabletEntityId: t.Meta.EntityId,
				tabletFullName: tabletFullName(t),
				tabletLabel: tabletNameAndId(t),
				brand: t.Model.Brand,
				brandName: brandName(t.Model.Brand),
				type: l.Type,
				url: l.URL,
				title: l.Title ?? '',
				author: l.Author ?? '',
				publishDate: l.PublishDate ?? '',
			});
		}
	}
	rows.sort(
		(a, b) =>
			a.tabletFullName.localeCompare(b.tabletFullName) ||
			(TYPE_RANK[a.type] ?? 9) - (TYPE_RANK[b.type] ?? 9) ||
			a.title.localeCompare(b.title),
	);
	return rows;
}
